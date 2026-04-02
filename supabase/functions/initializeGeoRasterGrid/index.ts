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

type ZoneTheme = "forest" | "water" | "urban" | "meadow";

interface ThemeAnchorPoint {
  lat: number;
  lng: number;
}

interface CellThemeAggregate {
  score: number;
  latSum: number;
  lngSum: number;
  count: number;
}

interface RasterCellData {
  grid_id: string;
  grid_lat_idx: number;
  grid_lng_idx: number;
  center_lat: number;
  center_lng: number;
  theme: ZoneTheme;
  theme_confidence: number;
  dominant_osm_tags: Record<string, string>;
  theme_scores: Partial<Record<ZoneTheme, number>>;
  theme_anchor_points: Partial<Record<ZoneTheme, ThemeAnchorPoint>>;
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
): { theme: ZoneTheme; confidence: number } {
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
  const toTiles = (source: BoundingBox, maxSpan = 0.1): BoundingBox[] => {
    const tiles: BoundingBox[] = [];
    for (let south = source.south; south < source.north; south += maxSpan) {
      const north = Math.min(source.north, south + maxSpan);
      for (let west = source.west; west < source.east; west += maxSpan) {
        const east = Math.min(source.east, west + maxSpan);
        tiles.push({ south, west, north, east });
      }
    }
    return tiles;
  };

  const queryTile = async (tile: BoundingBox) => {
    const { south, west, north, east } = tile;
    const query = `
[out:json][timeout:20];
(
  way(${south},${west},${north},${east})["natural"~"^(water|forest|wood|meadow|grassland|riverbank)$"];
  way(${south},${west},${north},${east})["landuse"~"^(forest|meadow|residential|industrial|commercial|retail|water)$"];
  way(${south},${west},${north},${east})["leisure"~"^(park)$"];
  way(${south},${west},${north},${east})["waterway"~"^(river|stream|canal|water)$"];
);
out center;
`;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      signal: AbortSignal.timeout(25000),
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
      const centerLat = elem.center?.lat || elem.lat;
      const centerLng = elem.center?.lon || elem.lon;
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

    return results;
  };

  const tiles = toTiles(bbox, 0.1);
  console.log(`[Overpass] Querying ${tiles.length} tile(s) for bounds: ${bbox.south},${bbox.west},${bbox.north},${bbox.east}`);

  const unique = new Map<string, {
    centerLat: number;
    centerLng: number;
    tags: Record<string, string>;
    osmType: string;
    osmId: string;
  }>();

  let succeeded = 0;
  for (const [index, tile] of tiles.entries()) {
    try {
      const tileResults = await queryTile(tile);
      for (const item of tileResults) {
        unique.set(`${item.osmType}:${item.osmId}`, item);
      }
      succeeded += 1;
      console.log(`[Overpass] Tile ${index + 1}/${tiles.length} ok (${tileResults.length} elements)`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Overpass] Tile ${index + 1}/${tiles.length} failed: ${errMsg}`);
    }
  }

  if (succeeded === 0) {
    throw new Error("Signal timed out.");
  }

  const merged = Array.from(unique.values());
  console.log(`[Overpass] Retrieved ${merged.length} unique elements from ${succeeded}/${tiles.length} tiles`);
  return merged;
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
        theme_scores: {},
        theme_anchor_points: {},
        osm_element_count: 0,
        nearest_osm_element_distance_m: 999999,
      });
    }
  }

  console.log(`[Grid] Created ${grid.size} cells`);

  const MIN_THEME_CONFIDENCE = 0.1;

  // Per-cell, per-theme aggregates for mixed-zone probabilities and precise anchors.
  const cellThemeAggregates = new Map<string, Partial<Record<ZoneTheme, CellThemeAggregate>>>();

  // Distribute OSM elements into grid cells
  for (const elem of osmElements) {
    const indices = getGridCellIndex(elem.centerLat, elem.centerLng);
    const gridId = `${indices.latIdx}_${indices.lngIdx}`;
    const cell = grid.get(gridId);

    if (!cell) continue;

    // Update cell classification based on OSM element
    const classification = classifyTheme(elem.tags);

    const cellAggregates = cellThemeAggregates.get(gridId) || {};
    const currentAggregate = cellAggregates[classification.theme] || {
      score: 0,
      latSum: 0,
      lngSum: 0,
      count: 0,
    };
    currentAggregate.score += classification.confidence;
    currentAggregate.latSum += elem.centerLat;
    currentAggregate.lngSum += elem.centerLng;
    currentAggregate.count += 1;
    cellAggregates[classification.theme] = currentAggregate;
    cellThemeAggregates.set(gridId, cellAggregates);
    
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

  // Build normalized theme probabilities and per-theme anchor points per cell.
  for (const [gridId, cell] of grid) {
    const aggregates = cellThemeAggregates.get(gridId);
    if (!aggregates) continue;

    const themes = Object.keys(aggregates) as ZoneTheme[];
    const totalScore = themes.reduce((acc, theme) => acc + (aggregates[theme]?.score || 0), 0);
    if (totalScore <= 0) continue;

    const rawScores: Partial<Record<ZoneTheme, number>> = {};
    const anchorPoints: Partial<Record<ZoneTheme, ThemeAnchorPoint>> = {};

    for (const theme of themes) {
      const aggregate = aggregates[theme];
      if (!aggregate || aggregate.count === 0) continue;

      const normalizedScore = aggregate.score / totalScore;
      if (normalizedScore < MIN_THEME_CONFIDENCE) continue;

      rawScores[theme] = normalizedScore;
      anchorPoints[theme] = {
        lat: aggregate.latSum / aggregate.count,
        lng: aggregate.lngSum / aggregate.count,
      };
    }

    const acceptedThemes = Object.keys(rawScores) as ZoneTheme[];
    if (acceptedThemes.length === 0) continue;

    const acceptedTotal = acceptedThemes.reduce((acc, theme) => acc + (rawScores[theme] || 0), 0);
    if (acceptedTotal <= 0) continue;

    const normalizedScores: Partial<Record<ZoneTheme, number>> = {};
    for (const theme of acceptedThemes) {
      normalizedScores[theme] = (rawScores[theme] || 0) / acceptedTotal;
    }

    const dominantTheme = acceptedThemes.reduce((best, current) => {
      const bestScore = normalizedScores[best] || 0;
      const currentScore = normalizedScores[current] || 0;
      return currentScore > bestScore ? current : best;
    }, acceptedThemes[0]);

    cell.theme_scores = normalizedScores;
    cell.theme_anchor_points = anchorPoints;
    cell.theme = dominantTheme;
    cell.theme_confidence = normalizedScores[dominantTheme] || cell.theme_confidence;
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
        geometry: `POINT(${cell.center_lng} ${cell.center_lat})`,
        theme: cell.theme,
        theme_confidence: cell.theme_confidence,
        dominant_osm_tags: cell.dominant_osm_tags,
        theme_scores: cell.theme_scores,
        theme_anchor_points: cell.theme_anchor_points,
        osm_element_count: cell.osm_element_count,
        nearest_osm_element_distance_m: Math.round(cell.nearest_osm_element_distance_m),
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
