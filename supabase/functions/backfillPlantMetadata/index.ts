import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("[backfillPlantMetadata] Function loaded successfully");

type BackfillBody = {
  limit?: number;
};

Deno.serve(async (req) => {
  console.log("[backfillPlantMetadata] === REQUEST RECEIVED ===");
  console.log("[backfillPlantMetadata] Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "backfillPlantMetadata");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[backfillPlantMetadata] Missing Supabase service env vars");
      return new Response(
        JSON.stringify({ error: "Supabase service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const body = (await req.json().catch(() => ({}))) as BackfillBody;
    const limit = body.limit && body.limit > 0 && body.limit <= 200 ? body.limit : 50;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 1) Pflanzen ohne vollständige Metadaten finden
    const { data: plants, error: plantsError } = await adminClient
      .from("Plant")
      .select("id, species_name, scientific_name, description, identification_features, fun_fact, rarity")
      .or("description.is.null,identification_features.is.null,fun_fact.is.null,rarity.is.null")
      .limit(limit);

    if (plantsError) {
      console.error("[backfillPlantMetadata] Failed to load plants:", plantsError);
      return new Response(
        JSON.stringify({ error: "Failed to load plants" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!plants || plants.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, message: "No plants without metadata found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log(`[backfillPlantMetadata] Found ${plants.length} plants without full metadata`);

    const updatedIds: string[] = [];
    const failedIds: string[] = [];

    for (const plant of plants as any[]) {
      try {
        const { data: meta, error: metaError } = await adminClient.functions.invoke(
          "generatePlantMetadata",
          {
            body: {
              plant_id: plant.id,
              species_name: plant.species_name,
              scientific_name: plant.scientific_name,
              language: "de",
            },
          },
        );

        if (metaError || !meta) {
          console.warn("[backfillPlantMetadata] Metadata generation failed for plant", plant.id, metaError);
          failedIds.push(plant.id);
          continue;
        }

        const identificationText = Array.isArray(meta.identification_features)
          ? meta.identification_features.join(" ")
          : meta.identification_features;

        const { error: updateError } = await adminClient
          .from("Plant")
          .update({
            description: meta.description,
            identification_features: identificationText,
            fun_fact: meta.fun_fact,
            rarity: meta.rarity,
          })
          .eq("id", plant.id);

        if (updateError) {
          console.error("[backfillPlantMetadata] Failed to update plant", plant.id, updateError);
          failedIds.push(plant.id);
          continue;
        }

        updatedIds.push(plant.id);
      } catch (plantError) {
        console.error("[backfillPlantMetadata] Unexpected error for plant", plant.id, plantError);
        failedIds.push(plant.id);
      }
    }

    return new Response(
      JSON.stringify({
        updated: updatedIds.length,
        failed: failedIds.length,
        updated_ids: updatedIds,
        failed_ids: failedIds,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error("[backfillPlantMetadata] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
