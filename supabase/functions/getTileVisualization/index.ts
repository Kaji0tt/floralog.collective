/**
 * Admin-only function: Get OSM tile visualization for debugging/admin purposes
 * Shows all tiles in a radius with their assigned themes and highlights them on the map
 *
 * Usage: POST /functions/v1/getTileVisualization
 * Body: { authId, latitude, longitude, radiusM?, showZoneTypes? }
 *
 * Returns: { success, tiles: Array<{ tileX, tileY, centerLat, centerLng, themes: { forest, water, meadow, urban } }> }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import proj4 from "https://esm.sh/proj4@2.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TILE_SIZE_M = 100;
const CHUNK_SIZE_TILES = 10;
const DATASET_VERSION = "osm_de_2026_04_10";
const EPSG_3035 = "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +datum=ETRS89 +units=m +no_defs +type=crs";

proj4.defs("EPSG:3035", EPSG_3035);

interface TileVisualizationRequest {
  authId?: string;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
  showZoneTypes?: boolean;
}

interface TileData {
  tileX: number;
  tileY: number;
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

interface SlimTileValueRow {
  chunk_id: string;
  tile_local_x: number;
  tile_local_y: number;
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

function getTileCoordinates(lat: number, lng: number): { tileX: number; tileY: number } {
  const { x, y } = lngLatToMetric(lng, lat);
  return {
    tileX: Math.floor(x / TILE_SIZE_M),
    tileY: Math.floor(y / TILE_SIZE_M),
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

function getTileCenter(tileX: number, tileY: number): { lat: number; lng: number } {
  const centerX = (tileX + 0.5) * TILE_SIZE_M;
  const centerY = (tileY + 0.5) * TILE_SIZE_M;
  return metricToLngLat(centerX, centerY);
}

function getTilesInRadius(centerLat: number, centerLng: number, radiusM: number): Array<{ tileX: number; tileY: number }> {
  const { x: centerX, y: centerY } = lngLatToMetric(centerLng, centerLat);
  const minTileX = Math.floor((centerX - radiusM) / TILE_SIZE_M);
  const maxTileX = Math.floor((centerX + radiusM) / TILE_SIZE_M);
  const minTileY = Math.floor((centerY - radiusM) / TILE_SIZE_M);
  const maxTileY = Math.floor((centerY + radiusM) / TILE_SIZE_M);

  const tiles: Array<{ tileX: number; tileY: number }> = [];
  const radiusSq = radiusM * radiusM;

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      const tileCenterX = (tileX + 0.5) * TILE_SIZE_M;
      const tileCenterY = (tileY + 0.5) * TILE_SIZE_M;
      const dx = tileCenterX - centerX;
      const dy = tileCenterY - centerY;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq) {
        tiles.push({ tileX, tileY });
      }
    }
  }

  return tiles;
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
      .from("OSMTileChunkLite")
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

async function fetchTileValuesForChunkIds(
  adminClient: ReturnType<typeof createClient>,
  chunkIds: string[],
): Promise<{ rows: SlimTileValueRow[]; error: unknown | null }> {
  const allRows: SlimTileValueRow[] = [];

  for (let i = 0; i < chunkIds.length; i += CHUNK_ID_BATCH_SIZE) {
    const batchIds = chunkIds.slice(i, i + CHUNK_ID_BATCH_SIZE);
    let offset = 0;

    while (true) {
      const { data, error } = await adminClient
        .from("OSMTileValue")
        .select("chunk_id, tile_local_x, tile_local_y, zone_type, zone_value")
        .in("chunk_id", batchIds)
        .order("chunk_id", { ascending: true })
        .order("tile_local_x", { ascending: true })
        .order("tile_local_y", { ascending: true })
        .order("zone_type", { ascending: true })
        .range(offset, offset + DB_PAGE_SIZE - 1);

      if (error) {
        return { rows: [], error };
      }

      const pageRows = (data || []) as SlimTileValueRow[];
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    console.log("[getTileVisualization] Request received");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as TileVisualizationRequest;
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

    console.log(`[getTileVisualization] Admin ${authId.substring(0, 8)} requesting tile visualization for (${latitude}, ${longitude}), radius ${radiusM}m`);

    // Get tiles in radius
    const searchTiles = getTilesInRadius(latitude, longitude, radiusM);
    console.log(`[getTileVisualization] Found ${searchTiles.length} tiles in radius`);

    // Calculate chunk bounds
    const minChunkX = Math.min(...searchTiles.map((tile) => Math.floor(tile.tileX / CHUNK_SIZE_TILES)));
    const maxChunkX = Math.max(...searchTiles.map((tile) => Math.floor(tile.tileX / CHUNK_SIZE_TILES)));
    const minChunkY = Math.min(...searchTiles.map((tile) => Math.floor(tile.tileY / CHUNK_SIZE_TILES)));
    const maxChunkY = Math.max(...searchTiles.map((tile) => Math.floor(tile.tileY / CHUNK_SIZE_TILES)));

    // Query chunks
    const { rows: chunkRows, error: chunkError } = await fetchChunksInBounds(
      adminClient,
      minChunkX,
      maxChunkX,
      minChunkY,
      maxChunkY,
    );

    if (chunkError) {
      console.error("[getTileVisualization] Chunk query error:", chunkError);
      return jsonResponse({ error: "Failed to query chunks" }, 500);
    }

    const chunks = chunkRows;
    if (chunks.length === 0) {
      return jsonResponse({ success: true, tiles: [] });
    }

    const chunkById = new Map(chunks.map((c) => [c.id, c]));
    const chunkIds = chunks.map((c) => c.id);

    const { rows: tileValueRows, error: tileValueError } = await fetchTileValuesForChunkIds(
      adminClient,
      chunkIds,
    );

    if (tileValueError) {
      console.error("[getTileVisualization] Tile value query error:", tileValueError);
      return jsonResponse({ error: "Failed to query tile values" }, 500);
    }

    console.log(`[getTileVisualization] Fetched ${chunks.length} chunks and ${tileValueRows.length} tile-value rows (paginated)`);

    // Aggregate tiles by theme
    const tileMap = new Map<string, {
      tileX: number;
      tileY: number;
      forest: number;
      water: number;
      meadow: number;
      urban: number;
      beach: number;
      wetlands: number;
    }>();

    const validSearchTileKeys = new Set(searchTiles.map((t) => `${t.tileX}:${t.tileY}`));
    for (const row of tileValueRows) {
      const chunk = chunkById.get(row.chunk_id);
      if (!chunk) continue;

      const tileX = chunk.chunk_x * CHUNK_SIZE_TILES + Number(row.tile_local_x);
      const tileY = chunk.chunk_y * CHUNK_SIZE_TILES + Number(row.tile_local_y);
      const tileKey = `${tileX}:${tileY}`;

      if (!validSearchTileKeys.has(tileKey)) continue;

      const zoneType = Number(row.zone_type) || 0;
      const zoneName = getThemeName(zoneType);
      const zoneValue = Math.max(0, Number(row.zone_value) || 0);

      if (zoneValue <= 0) continue;

      let tileData = tileMap.get(tileKey);
      if (!tileData) {
        tileData = {
          tileX,
          tileY,
          forest: 0,
          water: 0,
          meadow: 0,
          urban: 0,
          beach: 0,
          wetlands: 0,
        };
        tileMap.set(tileKey, tileData);
      }

      switch (zoneName) {
        case "forest":
          tileData.forest += zoneValue;
          break;
        case "water":
          tileData.water += zoneValue;
          break;
        case "meadow":
          tileData.meadow += zoneValue;
          break;
        case "urban":
          tileData.urban += zoneValue;
          break;
        case "beach":
          tileData.beach += zoneValue;
          break;
        case "wetlands":
          tileData.wetlands += zoneValue;
          break;
      }
    }

    // Build response
    const tiles: TileData[] = [];
    for (const [tileKey, tileData] of tileMap.entries()) {
      const center = getTileCenter(tileData.tileX, tileData.tileY);

      const themes = {
        forest: tileData.forest,
        water: tileData.water,
        meadow: tileData.meadow,
        urban: tileData.urban,
        beach: tileData.beach,
        wetlands: tileData.wetlands,
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

      tiles.push({
        tileX: tileData.tileX,
        tileY: tileData.tileY,
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

    console.log(`[getTileVisualization] Returning ${tiles.length} tiles with theme data`);

    return jsonResponse({
      success: true,
      tilesCount: tiles.length,
      tileSize: TILE_SIZE_M,
      chunkSize: CHUNK_SIZE_TILES,
      tiles,
    });
  } catch (error) {
    console.error("[getTileVisualization] Error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
