import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";
import { computeRarityLabel } from "../_shared/plantRarityLevels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("[recomputePlantRarity] Function loaded successfully");

type RecomputeBody = {
  limit?: number;
  offset?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "recomputePlantRarity");
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
      console.error("[recomputePlantRarity] Missing Supabase service env vars");
      return new Response(
        JSON.stringify({ error: "Supabase service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const body = (await req.json().catch(() => ({}))) as RecomputeBody;
    const limit = body.limit && body.limit > 0 && body.limit <= 500 ? body.limit : 200;
    const offset = Number.isFinite(Number(body.offset)) && Number(body.offset) >= 0 ? Number(body.offset) : 0;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Reiner DB-Recompute: kein OpenAI/NaturaDB-Call noetig, red_list-Felder liegen bereits vor.
    const { data: plants, error: plantsError } = await adminClient
      .from("Plant")
      .select("id, rarity, red_list_population, red_list_threat")
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (plantsError) {
      console.error("[recomputePlantRarity] Failed to load plants:", plantsError);
      return new Response(
        JSON.stringify({ error: "Failed to load plants" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!plants || plants.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, unchanged: 0, next_offset: null, message: "No more plants" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    let updated = 0;
    let unchanged = 0;
    const failedIds: string[] = [];

    for (const plant of plants as any[]) {
      const newRarity = computeRarityLabel(plant.red_list_population ?? null, plant.red_list_threat ?? null);

      if (plant.rarity === newRarity) {
        unchanged += 1;
        continue;
      }

      const { error: updateError } = await adminClient
        .from("Plant")
        .update({ rarity: newRarity })
        .eq("id", plant.id);

      if (updateError) {
        console.error("[recomputePlantRarity] Failed to update plant", plant.id, updateError);
        failedIds.push(plant.id);
        continue;
      }

      updated += 1;
    }

    return new Response(
      JSON.stringify({
        updated,
        unchanged,
        failed: failedIds.length,
        failed_ids: failedIds,
        next_offset: plants.length < limit ? null : offset + plants.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error("[recomputePlantRarity] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
