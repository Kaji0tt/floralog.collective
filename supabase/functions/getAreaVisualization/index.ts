/**
 * Admin-only function: Get OSM area visualization for debugging/admin purposes
 * Shows all areas in a radius with their assigned themes and highlights them on the map
 *
 * Usage: POST /functions/v1/getAreaVisualization
 * Body: { authId, latitude, longitude, radiusM?, showZoneTypes? }
 *
 * Returns: { success, areas: Array<{ areaX, areaY, centerLat, centerLng, themes: { forest, water, meadow, urban } }> }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import proj4 from "https://esm.sh/proj4@2.15.0";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AREA_SIZE_M = 100;
const CHUNK_SIZE_AREAS = 10;
const DATASET_VERSION = "osm_de_2026_04_10";
const EPSG_3035 = "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +datum=ETRS89 +units=m +no_defs +type=crs";

proj4.defs("EPSG:3035", EPSG_3035);

interface AreaVisualizationRequest {
  authId?: string;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
  showZoneTypes?: boolean;
}

interface AreaData {
  areaX: number;
  areaY: number;
  centerLat: number;
  centerLng: number;
  themes: Record<string, number>;
  dominantTheme: string;
}

interface SlimChunkRow {
  id: string;
  chunk_x: number;
  chunk_y: number;
}

interface SlimAreaValueRow {
  chunk_id: string;
  area_local_x: number;
  area_local_y: number;
  zone_type: number;
  zone_value: number;
}

const DB_PAGE_SIZE = 1000;
const CHUNK_ID_BATCH_SIZE = 150;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isUuid(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function lngLatToMetric(lng: number, lat: number): { x: number; y: number } {
  const [x, y] = proj4("EPSG:4326", "EPSG:3035", [lng, lat]);
  return { x, y };
}

function metricToLngLat(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4("EPSG:3035", "EPSG:4326", [x, y]);
  return { lat, lng };
}

function getAreaCoordinates(lat: number, lng: number): { areaX: number; areaY: number } {
  const { x, y } = lngLatToMetric(lng, lat);
  return {
    areaX: Math.floor(x / AREA_SIZE_M),
    areaY: Math.floor(y / AREA_SIZE_M),
  };
}

function getThemeName(zoneType: number): "forest" | "water" | "meadow" | "urban" | "beach" | "wetlands" {
  switch (zoneType) {
    case 0:
      return "forest";
    case 1:
      return "water";
    case 2:
      return "meadow";
    case 3:
      return "urban";
    case 4:
      return "beach";
    case 5:
      return "wetlands";
    default:
      return "meadow";
  }
}

function getAreaCenter(areaX: number, areaY: number): { lat: number; lng: number } {
  const centerX = (areaX + 0.5) * AREA_SIZE_M;
  const centerY = (areaY + 0.5) * AREA_SIZE_M;
  return metricToLngLat(centerX, centerY);
}

function getAreasInRadius(centerLat: number, centerLng: number, radiusM: number): Array<{ areaX: number; areaY: number }> {
  const { x: centerX, y: centerY } = lngLatToMetric(centerLng, centerLat);
  const minAreaX = Math.floor((centerX - radiusM) / AREA_SIZE_M);
  const maxAreaX = Math.floor((centerX + radiusM) / AREA_SIZE_M);
  const minAreaY = Math.floor((centerY - radiusM) / AREA_SIZE_M);
  const maxAreaY = Math.floor((centerY + radiusM) / AREA_SIZE_M);

  const areas: Array<{ areaX: number; areaY: number }> = [];
  const radiusSq = radiusM * radiusM;

  for (let areaX = minAreaX; areaX <= maxAreaX; areaX += 1) {
    for (let areaY = minAreaY; areaY <= maxAreaY; areaY += 1) {
      const areaCenterX = (areaX + 0.5) * AREA_SIZE_M;
      const areaCenterY = (areaY + 0.5) * AREA_SIZE_M;
      const dx = areaCenterX - centerX;
      const dy = areaCenterY - centerY;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq) {
        areas.push({ areaX, areaY });
      }
    }
  }

  return areas;
}

async function fetchChunksInBounds(
  adminClient: ReturnType<typeof createClient>,
  minChunkX: number,
  maxChunkX: number,
  minChunkY: number,
  maxChunkY: number,
): Promise<{ rows: SlimChunkRow[]; error: unknown | null }> {
  const allRows: SlimChunkRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await adminClient
      .from("OSMAreaChunkLite")
      .select("id, chunk_x, chunk_y")
      .eq("dataset_version", DATASET_VERSION)
      .gte("chunk_x", minChunkX)
      .lte("chunk_x", maxChunkX)
      .gte("chunk_y", minChunkY)
      .lte("chunk_y", maxChunkY)
      .order("chunk_x", { ascending: true })
      .order("chunk_y", { ascending: true })
      .range(offset, offset + DB_PAGE_SIZE - 1);

    if (error) {
      return { rows: [], error };
    }

    const pageRows = (data || []) as SlimChunkRow[];
    allRows.push(...pageRows);

    if (pageRows.length < DB_PAGE_SIZE) {
      break;
    }

    offset += DB_PAGE_SIZE;
  }

  return { rows: allRows, error: null };
}

async function fetchAreaValuesForChunkIds(
  adminClient: ReturnType<typeof createClient>,
  chunkIds: string[],
): Promise<{ rows: SlimAreaValueRow[]; error: unknown | null }> {
  const allRows: SlimAreaValueRow[] = [];

  for (let i = 0; i < chunkIds.length; i += CHUNK_ID_BATCH_SIZE) {
    const batchIds = chunkIds.slice(i, i + CHUNK_ID_BATCH_SIZE);
    let offset = 0;

    while (true) {
      const { data, error } = await adminClient
        .from("OSMAreaValue")
        .select("chunk_id, area_local_x, area_local_y, zone_type, zone_value")
        .in("chunk_id", batchIds)
        .order("chunk_id", { ascending: true })
        .order("area_local_x", { ascending: true })
        .order("area_local_y", { ascending: true })
        .order("zone_type", { ascending: true })
        .range(offset, offset + DB_PAGE_SIZE - 1);

      if (error) {
        return { rows: [], error };
      }

      const pageRows = (data || []) as SlimAreaValueRow[];
      allRows.push(...pageRows);

      if (pageRows.length < DB_PAGE_SIZE) {
        break;
      }

      offset += DB_PAGE_SIZE;
    }
  }

  return { rows: allRows, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "getAreaVisualization");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    console.log("[getAreaVisualization] Request received");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as AreaVisualizationRequest;
    const authId = String(body.authId || "").trim();
    const latitude = Number(body.latitude || 0);
    const longitude = Number(body.longitude || 0);
    const radiusM = Number(body.radiusM || 2000);

    if (!isUuid(authId)) {
      return jsonResponse({ error: "authId required" }, 400);
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return jsonResponse({ error: "latitude/longitude required" }, 400);
    }

    // Check if user is admin
    const { data: userLookup, error: userLookupError } = await adminClient.auth.admin.getUserById(authId);
    if (userLookupError || !userLookup?.user) {
      return jsonResponse({ error: "Invalid authId" }, 401);
    }

    const { data: profile } = await adminClient
      .from("PublicProfile")
      .select("role")
      .eq("auth_id", authId)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    console.log(`[getAreaVisualization] Admin ${authId.substring(0, 8)} requesting area visualization for (${latitude}, ${longitude}), radius ${radiusM}m`);

    // Get areas in radius
    const searchAreas = getAreasInRadius(latitude, longitude, radiusM);
    console.log(`[getAreaVisualization] Found ${searchAreas.length} areas in radius`);

    // Calculate chunk bounds
    const minChunkX = Math.min(...searchAreas.map((area) => Math.floor(area.areaX / CHUNK_SIZE_AREAS)));
    const maxChunkX = Math.max(...searchAreas.map((area) => Math.floor(area.areaX / CHUNK_SIZE_AREAS)));
    const minChunkY = Math.min(...searchAreas.map((area) => Math.floor(area.areaY / CHUNK_SIZE_AREAS)));
    const maxChunkY = Math.max(...searchAreas.map((area) => Math.floor(area.areaY / CHUNK_SIZE_AREAS)));

    // Query chunks
    const { rows: chunkRows, error: chunkError } = await fetchChunksInBounds(
      adminClient,
      minChunkX,
      maxChunkX,
      minChunkY,
      maxChunkY,
    );

    if (chunkError) {
      console.error("[getAreaVisualization] Chunk query error:", chunkError);
      return jsonResponse({ error: "Failed to query chunks" }, 500);
    }

    const chunks = chunkRows;
    if (chunks.length === 0) {
      return jsonResponse({ success: true, areas: [] });
    }

    const chunkById = new Map(chunks.map((c) => [c.id, c]));
    const chunkIds = chunks.map((c) => c.id);

    const { rows: areaValueRows, error: areaValueError } = await fetchAreaValuesForChunkIds(
      adminClient,
      chunkIds,
    );

    if (areaValueError) {
      console.error("[getAreaVisualization] Area value query error:", areaValueError);
      return jsonResponse({ error: "Failed to query area values" }, 500);
    }

    console.log(`[getAreaVisualization] Fetched ${chunks.length} chunks and ${areaValueRows.length} area-value rows (paginated)`);

    // Aggregate areas by theme
    const areaMap = new Map<string, {
      areaX: number;
      areaY: number;
      forest: number;
      water: number;
      meadow: number;
      urban: number;
      beach: number;
      wetlands: number;
    }>();

    const validSearchAreaKeys = new Set(searchAreas.map((t) => `${t.areaX}:${t.areaY}`));
    for (const row of areaValueRows) {
      const chunk = chunkById.get(row.chunk_id);
      if (!chunk) continue;

      const areaX = chunk.chunk_x * CHUNK_SIZE_AREAS + Number(row.area_local_x);
      const areaY = chunk.chunk_y * CHUNK_SIZE_AREAS + Number(row.area_local_y);
      const areaKey = `${areaX}:${areaY}`;

      if (!validSearchAreaKeys.has(areaKey)) continue;

      const zoneType = Number(row.zone_type) || 0;
      const zoneName = getThemeName(zoneType);
      const zoneValue = Math.max(0, Number(row.zone_value) || 0);

      if (zoneValue <= 0) continue;

      let areaData = areaMap.get(areaKey);
      if (!areaData) {
        areaData = {
          areaX,
          areaY,
          forest: 0,
          water: 0,
          meadow: 0,
          urban: 0,
          beach: 0,
          wetlands: 0,
        };
        areaMap.set(areaKey, areaData);
      }

      switch (zoneName) {
        case "forest":
          areaData.forest += zoneValue;
          break;
        case "water":
          areaData.water += zoneValue;
          break;
        case "meadow":
          areaData.meadow += zoneValue;
          break;
        case "urban":
          areaData.urban += zoneValue;
          break;
        case "beach":
          areaData.beach += zoneValue;
          break;
        case "wetlands":
          areaData.wetlands += zoneValue;
          break;
      }
    }

    // Build response
    const areas: AreaData[] = [];
    for (const [areaKey, areaData] of areaMap.entries()) {
      const center = getAreaCenter(areaData.areaX, areaData.areaY);

      const themes = {
        forest: areaData.forest,
        water: areaData.water,
        meadow: areaData.meadow,
        urban: areaData.urban,
        beach: areaData.beach,
        wetlands: areaData.wetlands,
      };

      const total = Object.values(themes).reduce((a, b) => a + b, 0);
      let dominantTheme = "meadow";
      let dominantValue = themes.meadow;

      for (const [theme, value] of Object.entries(themes)) {
        if (value > dominantValue) {
          dominantValue = value;
          dominantTheme = theme;
        }
      }

      areas.push({
        areaX: areaData.areaX,
        areaY: areaData.areaY,
        centerLat: center.lat,
        centerLng: center.lng,
        themes: {
          forest: total > 0 ? Math.round((themes.forest / total) * 100) : 0,
          water: total > 0 ? Math.round((themes.water / total) * 100) : 0,
          meadow: total > 0 ? Math.round((themes.meadow / total) * 100) : 0,
          urban: total > 0 ? Math.round((themes.urban / total) * 100) : 0,
          beach: total > 0 ? Math.round((themes.beach / total) * 100) : 0,
          wetlands: total > 0 ? Math.round((themes.wetlands / total) * 100) : 0,
        },
        dominantTheme,
      });
    }

    console.log(`[getAreaVisualization] Returning ${areas.length} areas with theme data`);

    return jsonResponse({
      success: true,
      areasCount: areas.length,
      areaSize: AREA_SIZE_M,
      chunkSize: CHUNK_SIZE_AREAS,
      areas,
    });
  } catch (error) {
    console.error("[getAreaVisualization] Error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
