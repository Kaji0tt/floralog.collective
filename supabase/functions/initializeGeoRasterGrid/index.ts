/**
 * Supabase Edge Function: Initialize Geo Raster Grid
 *
 * ⚠️ DEPRECATED: This function and the GeoRasterCell system are no longer in use.
 * The system has been completely migrated to the slim OSM database (OSMTileChunkLite + OSMTileValue).
 * This function is kept for backward compatibility only and should NOT be called.
 * Last used: Version with proj4-based robotPlantDailyZones migration (April 2026)
 *
 * Admin-only manual initialization endpoint. The underlying raster builder is
 * shared with robotPlantDailyZones so the same logic can also run on-demand.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BoundingBox, initializeGeoRasterCells } from "../_shared/geoRaster.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    console.log("[initializeGeoRasterGrid] Request received");
    const startTime = Date.now();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    const body = await req.json() as {
      authId: string;
      bounds: BoundingBox;
      forceRefresh?: boolean;
    };

    if (!body.authId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.authId)) {
      return jsonResponse({ error: "authId required" }, 400);
    }

    if (!body.bounds || !body.bounds.north || !body.bounds.south || !body.bounds.east || !body.bounds.west) {
      return jsonResponse({ error: "Invalid bounds parameter" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("PublicProfile")
      .select("role")
      .eq("auth_id", body.authId)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      console.warn("[initializeGeoRasterGrid] Non-admin user attempted access:", body.authId);
      return jsonResponse({ error: "Unauthorized: admin role required" }, 403);
    }

    const result = await initializeGeoRasterCells(adminClient, body.bounds, {
      forceRefresh: body.forceRefresh,
      trigger: "initializeGeoRasterGrid",
    });

    const duration = Date.now() - startTime;
    console.log(`[initializeGeoRasterGrid] Complete in ${duration}ms. Inserted ${result.cellsCreated} cells.`);

    return jsonResponse({
      success: true,
      cellsCreated: result.cellsCreated,
      warning: result.warning,
      bbox: body.bounds,
      duration_ms: duration,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[initializeGeoRasterGrid] Error:", errMsg);
    return jsonResponse({ error: `Error: ${errMsg}` }, 500);
  }
});