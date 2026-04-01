/**
 * Supabase Edge Function: Initialize Geo Raster Grid
 * 
 * This function populates the GeoRasterCell table with pre-computed
 * zone classifications based on OSM (OpenStreetMap) data.
 * 
 * Usage (admin only):
 *   POST /functions/v1/initializeGeoRasterGrid
 *   {
 *     "bounds": {"north": 55.0, "south": 54.0, "east": 10.5, "west": 9.5},
 *     "adminKey": "<admin_secret>",
 *     "forceRefresh": false
 *   }
 * 
 * Response: {"success": true, "cellsCreated": 142, "duration_ms": 5234}
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface RasterCellData {
  grid_id: string;
  grid_lat_idx: number;
  grid_lng_idx: number;
  center_lat: number;
  center_lng: number;
  theme: "forest" | "water" | "urban" | "meadow";
  theme_confidence: number;
  dominant_osm_tags: Record<string, string>;
  osm_element_count: number;
  nearest_osm_element_distance_m: number;
}

// Grid resolution: ~0.00636 degrees per cell (approximately 707m)
const GRID_RESOLUTION = 0.00636;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getGridCellIndex(lat: number, lng: number): { latIdx: number; lngIdx: number } {
  return {
    latIdx: Math.floor(lat / GRID_RESOLUTION),
    lngIdx: Math.floor(lng / GRID_RESOLUTION),
  };
}

function getGridCellCenter(latIdx: number, lngIdx: number): { lat: number; lng: number } {
  return {
    lat: (latIdx + 0.5) * GRID_RESOLUTION,
    lng: (lngIdx + 0.5) * GRID_RESOLUTION,
  };
}

/**
 * Classify theme based on dominant OSM tags in a region
 */
function classifyTheme(
  tags: Record<string, string>
): { theme: "forest" | "water" | "urban" | "meadow"; confidence: number } {
  const natural = (tags.natural || "").toLowerCase();
  const landuse = (tags.landuse || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();
  const water = (tags.water || "").toLowerCase();
  const waterway = (tags.waterway || "").toLowerCase();

  // Water themes
  if (["water", "riverbank"].includes(natural) || 
      water.length > 0 || 
      ["river", "stream", "canal"].includes(waterway)) {
    return { theme: "water", confidence: 0.9 };
  }

  // Forest themes
  if ((["forest", "wood"].includes(natural) || landuse === "forest")) {
    return { theme: "forest", confidence: 0.9 };
  }

  // Meadow/Park themes
  if ((["meadow", "grassland"].includes(natural) || 
       landuse === "meadow" || 
       leisure === "park")) {
    return { theme: "meadow", confidence: 0.85 };
  }

  // Urban themes
  if (["residential", "industrial", "commercial", "retail"].includes(landuse)) {
    return { theme: "urban", confidence: 0.88 };
  }

  // Default fallback (mixed/unknown)
  return { theme: "meadow", confidence: 0.4 };
}

/**
 * Query Overpass API for OSM data in a bounding box
 * This captures all land use / natural area classifications
 */
async function queryOverpassForBounds(bbox: BoundingBox): Promise<
  Array<{
    centerLat: number;
    centerLng: number;
    tags: Record<string, string>;
    osmType: string;
    osmId: string;
  }>
> {
  const { south, west, north, east } = bbox;
  
  // Overpass QL query: fetch all areas with natural/landuse/leisure tags
  const query = `
[out:json][timeout:30];
(
  way(${south},${west},${north},${east})["natural"~"^(water|forest|wood|meadow|grassland|riverbank)$"];
  way(${south},${west},${north},${east})["landuse"~"^(forest|meadow|residential|industrial|commercial|retail|water)$"];
  way(${south},${west},${north},${east})["leisure"~"^(park)$"];
  way(${south},${west},${north},${east})["waterway"~"^(river|stream|canal|water)$"];
  
  relation(${south},${west},${north},${east})["natural"~"^(water|forest|wood|meadow|grassland|waterbank)$"];
  relation(${south},${west},${north},${east})["landuse"~"^(forest|meadow|residential|industrial|commercial|retail|water)$"];
  relation(${south},${west},${north},${east})["leisure"~"^(park)$"];
  relation(${south},${west},${north},${east})["waterway"~"^(river|stream|canal)$"];
);
out center;
`;

  console.log(`[Overpass] Querying bounds: ${south},${west},${north},${east}`);

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      signal: AbortSignal.timeout(60000), // 60s timeout
    });

    if (!response.ok) {
      throw new Error(`Overpass returned ${response.status}`);
    }

    const data = await response.json() as any;
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    const results: Array<{
      centerLat: number;
      centerLng: number;
      tags: Record<string, string>;
      osmType: string;
      osmId: string;
    }> = [];

    for (const elem of elements) {
      let centerLat = elem.center?.lat || elem.lat;
      let centerLng = elem.center?.lon || elem.lon;

      if (typeof centerLat === "number" && typeof centerLng === "number" && elem.tags) {
        results.push({
          centerLat,
          centerLng,
          tags: elem.tags,
          osmType: elem.type,
          osmId: String(elem.id),
        });
      }
    }

    console.log(`[Overpass] Retrieved ${results.length} elements`);
    return results;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Overpass] Query failed: ${errMsg}`);
    throw err;
  }
}

/**
 * Build raster grid from OSM elements
 */
function buildRasterGrid(
  osmElements: Array<{
    centerLat: number;
    centerLng: number;
    tags: Record<string, string>;
    osmType: string;
    osmId: string;
  }>,
  bbox: BoundingBox
): Map<string, RasterCellData> {
  const { south, west, north, east } = bbox;
  
  // Create all grid cells in the bounding box
  const grid = new Map<string, RasterCellData>();
  
  const startLatIdx = Math.floor(south / GRID_RESOLUTION);
  const endLatIdx = Math.ceil(north / GRID_RESOLUTION);
  const startLngIdx = Math.floor(west / GRID_RESOLUTION);
  const endLngIdx = Math.ceil(east / GRID_RESOLUTION);

  console.log(`[Grid] Initializing grid cells: lat [${startLatIdx}, ${endLatIdx}], lng [${startLngIdx}, ${endLngIdx}]`);

  // Initialize all cells
  for (let latIdx = startLatIdx; latIdx < endLatIdx; latIdx++) {
    for (let lngIdx = startLngIdx; lngIdx < endLngIdx; lngIdx++) {
      const center = getGridCellCenter(latIdx, lngIdx);
      const gridId = `${latIdx}_${lngIdx}`;
      
      grid.set(gridId, {
        grid_id: gridId,
        grid_lat_idx: latIdx,
        grid_lng_idx: lngIdx,
        center_lat: center.lat,
        center_lng: center.lng,
        theme: "meadow", // default
        theme_confidence: 0.3,
        dominant_osm_tags: {},
        osm_element_count: 0,
        nearest_osm_element_distance_m: 999999,
      });
    }
  }

  console.log(`[Grid] Created ${grid.size} cells`);

  // Distribute OSM elements into grid cells
  for (const elem of osmElements) {
    const indices = getGridCellIndex(elem.centerLat, elem.centerLng);
    const gridId = `${indices.latIdx}_${indices.lngIdx}`;
    const cell = grid.get(gridId);

    if (!cell) continue;

    // Update cell classification based on OSM element
    const classification = classifyTheme(elem.tags);
    
    // Only update if new classification has higher confidence
    if (classification.confidence > cell.theme_confidence) {
      cell.theme = classification.theme;
      cell.theme_confidence = classification.confidence;
      cell.dominant_osm_tags = elem.tags;
    }

    // Track element count and nearest distance
    cell.osm_element_count += 1;
    
    // Simple distance approximation (for this cell center)
    const dLat = (elem.centerLat - cell.center_lat) * 111000;
    const dLng = (elem.centerLng - cell.center_lng) * 111000 * Math.cos((cell.center_lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    
    if (dist < cell.nearest_osm_element_distance_m) {
      cell.nearest_osm_element_distance_m = dist;
    }
  }

  // Filter out cells with no OSM data
  const validCells = new Map<string, RasterCellData>();
  for (const [gridId, cell] of grid) {
    if (cell.osm_element_count > 0 || cell.theme_confidence > 0.5) {
      validCells.set(gridId, cell);
    }
  }

  console.log(`[Grid] ${validCells.size} cells have OSM data`);
  return validCells;
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

    // Verify the calling user has admin role in PublicProfile
    const { data: profile, error: profileError } = await adminClient
      .from("PublicProfile")
      .select("role")
      .eq("auth_id", body.authId)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      console.warn("[initializeGeoRasterGrid] Non-admin user attempted access:", body.authId);
      return jsonResponse({ error: "Unauthorized: admin role required" }, 403);
    }

    const bbox = body.bounds;

    // Optionally: delete existing cells in this area if forceRefresh
    if (body.forceRefresh) {
      const startLatIdx = Math.floor(bbox.south / GRID_RESOLUTION);
      const endLatIdx = Math.ceil(bbox.north / GRID_RESOLUTION);
      const startLngIdx = Math.floor(bbox.west / GRID_RESOLUTION);
      const endLngIdx = Math.ceil(bbox.east / GRID_RESOLUTION);

      console.log(`[Grid] Force refresh: deleting cells in bounds`);
      const { error: delError } = await adminClient
        .from("GeoRasterCell")
        .delete()
        .gte("grid_lat_idx", startLatIdx)
        .lt("grid_lat_idx", endLatIdx)
        .gte("grid_lng_idx", startLngIdx)
        .lt("grid_lng_idx", endLngIdx);

      if (delError) {
        console.warn("[Grid] Delete error (non-fatal):", delError);
      }
    }

    // Query Overpass for OSM data
    const osmElements = await queryOverpassForBounds(bbox);

    // Build raster grid
    const gridCells = buildRasterGrid(osmElements, bbox);

    // Insert cells into database
    if (gridCells.size === 0) {
      return jsonResponse({
        success: true,
        cellsCreated: 0,
        warning: "No OSM data found in bounding box",
        duration_ms: Date.now() - startTime,
      });
    }

    const cellsArray = Array.from(gridCells.values());
    console.log(`[DB] Inserting ${cellsArray.length} cells`);

    const { error: insertError, data } = await adminClient
      .from("GeoRasterCell")
      .upsert(cellsArray.map(cell => ({
        grid_id: cell.grid_id,
        grid_lat_idx: cell.grid_lat_idx,
        grid_lng_idx: cell.grid_lng_idx,
        center_lat: cell.center_lat,
        center_lng: cell.center_lng,
        theme: cell.theme,
        theme_confidence: cell.theme_confidence,
        dominant_osm_tags: cell.dominant_osm_tags,
        osm_element_count: cell.osm_element_count,
        nearest_osm_element_distance_m: cell.nearest_osm_element_distance_m,
        is_valid: true,
        last_osm_update_date: new Date().toISOString().split("T")[0],
      })), { onConflict: "grid_id" })
      .select();

    if (insertError) {
      console.error("[DB] Insert error:", insertError);
      return jsonResponse({ error: "Failed to insert grid cells" }, 500);
    }

    const duration = Date.now() - startTime;
    console.log(`[initializeGeoRasterGrid] Complete in ${duration}ms. Inserted ${data?.length || 0} cells.`);

    return jsonResponse({
      success: true,
      cellsCreated: data?.length || cellsArray.length,
      duration_ms: duration,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[initializeGeoRasterGrid] Error:", errMsg);
    return jsonResponse({ error: `Error: ${errMsg}` }, 500);
  }
});
