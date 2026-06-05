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
  startAfterId?: string | null;
  includeOpenAi?: boolean;
  fullBackfill?: boolean;
};

const SLEEP_MS = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const invokeMetadataWithRetry = async (
  adminClient: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await adminClient.functions.invoke("generatePlantMetadata", {
      body: payload,
    });

    if (!error && data) {
      return { data, error: null };
    }

    const status = Number((error as any)?.context?.status || 0);
    const shouldRetry = status === 429 || status >= 500 || !status;
    if (!shouldRetry || attempt === 3) {
      return { data: null, error };
    }

    const delayMs = (2 ** attempt) * 800 + Math.floor(Math.random() * 250);
    await SLEEP_MS(delayMs);
  }

  return { data: null, error: new Error("metadata invoke retries exhausted") };
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
    const startAfterId = body.startAfterId || null;
    const includeOpenAi = body.includeOpenAi === true;
    const fullBackfill = body.fullBackfill !== false;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 1) Pflanzen ohne vollständige Metadaten finden
    let plantsQuery = adminClient
      .from("Plant")
      .select("id, species_name, scientific_name, description, identification_features, fun_fact, rarity, wild_bees_count, butterflies_count, caterpillars_count, hoverflies_count, beetles_count, red_list_threat, red_list_population, nectar_value, pollen_value, naturadb_url")
      .order("id", { ascending: true })
      .limit(limit);

    if (startAfterId) {
      plantsQuery = plantsQuery.gt("id", startAfterId);
    }

    if (!fullBackfill) {
      plantsQuery = plantsQuery.or("wild_bees_count.is.null,butterflies_count.is.null,caterpillars_count.is.null,hoverflies_count.is.null,beetles_count.is.null,red_list_threat.is.null,nectar_value.is.null,pollen_value.is.null");
    }

    const { data: plants, error: plantsError } = await plantsQuery;

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

    console.log(`[backfillPlantMetadata] Found ${plants.length} plants for this batch`);

    const updatedIds: string[] = [];
    const failedIds: string[] = [];

    for (const plant of plants as any[]) {
      try {
        const { data: meta, error: metaError } = await invokeMetadataWithRetry(adminClient, {
          plant_id: plant.id,
          species_name: plant.species_name,
          scientific_name: plant.scientific_name,
          language: "de",
          include_openai: includeOpenAi,
        });

        if (metaError || !meta) {
          console.warn("[backfillPlantMetadata] Metadata generation failed for plant", plant.id, metaError);
          failedIds.push(plant.id);
          continue;
        }

        const identificationText = Array.isArray(meta.identification_features)
          ? meta.identification_features.join(" ")
          : meta.identification_features;

        const updatePayload: Record<string, unknown> = {
          wild_bees_count: meta.wild_bees_count ?? null,
          butterflies_count: meta.butterflies_count ?? null,
          caterpillars_count: meta.caterpillars_count ?? null,
          hoverflies_count: meta.hoverflies_count ?? null,
          beetles_count: meta.beetles_count ?? null,
          red_list_threat: meta.red_list_threat ?? null,
          red_list_population: meta.red_list_population ?? null,
          nectar_value: meta.nectar_value ?? null,
          pollen_value: meta.pollen_value ?? null,
          naturadb_url: meta.naturadb_url ?? null,
          naturadb_synced_at: new Date().toISOString(),
        };

        if (includeOpenAi) {
          updatePayload.description = meta.description;
          updatePayload.identification_features = identificationText;
          updatePayload.fun_fact = meta.fun_fact;
          updatePayload.rarity = meta.rarity;
        }

        const { error: updateError } = await adminClient
          .from("Plant")
          .update(updatePayload)
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
        next_start_after_id: plants[plants.length - 1]?.id || null,
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
