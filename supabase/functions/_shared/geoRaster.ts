/**
 * ⚠️ DEPRECATED MODULE
 *
 * This module implements the old GeoRasterCell-based zone generation system.
 * It has been completely replaced by the slim OSM database architecture (OSMTileChunkLite + OSMTileValue).
 *
 * The new system uses:
 * - EPSG:3035 coordinate transformation (instead of grid indices)
 * - Direct tile-based queries (instead of grid cell manipulation)
 * - Pre-computed slim OSM data (instead of on-demand Overpass API initialization)
 *
 * Migration date: April 2026
 * New implementation: supabase/functions/robotPlantDailyZones/index.ts
 *
 * DO NOT USE THIS MODULE IN NEW CODE.
 * Existing code using this module should be refactored to use OSMTileChunkLite/OSMTileValue.
 *
 * This module is kept only for archive/reference purposes.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type ZoneTheme = "forest" | "water" | "urban" | "meadow";

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

export interface RasterCellData {
  grid_id: string;
  grid_lat_idx: number;
  grid_lng_idx: number;
  center_lat: number;
  center_lng: number;
  is_valid: boolean;
  theme: ZoneTheme;
  theme_confidence: number;
  dominant_osm_tags: Record<string, string>;
  theme_scores: Partial<Record<ZoneTheme, number>>;
  theme_anchor_points: Partial<Record<ZoneTheme, ThemeAnchorPoint>>;
  osm_element_count: number;
  nearest_osm_element_distance_m: number;
}

export const GRID_RESOLUTION = 0.00636;

export function getGridCellIndex(lat: number, lng: number): { latIdx: number; lngIdx: number } {
  return {
    latIdx: Math.floor(lat / GRID_RESOLUTION),
    lngIdx: Math.floor(lng / GRID_RESOLUTION),
  };
}

export function getGridCellCenter(latIdx: number, lngIdx: number): { lat: number; lng: number } {
  return {
    lat: (latIdx + 0.5) * GRID_RESOLUTION,
    lng: (lngIdx + 0.5) * GRID_RESOLUTION,
  };
}

export function getBoundsForGridRange(
  minLatIdx: number,
  maxLatIdx: number,
  minLngIdx: number,
  maxLngIdx: number,
): BoundingBox {
  return {
    south: minLatIdx * GRID_RESOLUTION,
    north: (maxLatIdx + 1) * GRID_RESOLUTION,
    west: minLngIdx * GRID_RESOLUTION,
    east: (maxLngIdx + 1) * GRID_RESOLUTION,
  };
}

function classifyTheme(tags: Record<string, string>): { theme: ZoneTheme; confidence: number } {
  const natural = (tags.natural || "").toLowerCase();
  const landuse = (tags.landuse || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();
  const water = (tags.water || "").toLowerCase();
  const waterway = (tags.waterway || "").toLowerCase();

  if (["water", "riverbank"].includes(natural) || water.length > 0 || ["river", "stream", "canal"].includes(waterway)) {
    return { theme: "water", confidence: 0.9 };
  }

  if (["forest", "wood"].includes(natural) || landuse === "forest") {
    return { theme: "forest", confidence: 0.9 };
  }

  if (["meadow", "grassland"].includes(natural) || landuse === "meadow" || leisure === "park") {
    return { theme: "meadow", confidence: 0.85 };
  }

  if (["residential", "industrial", "commercial", "retail"].includes(landuse)) {
    return { theme: "urban", confidence: 0.88 };
  }

  return { theme: "meadow", confidence: 0.4 };
}

async function queryOverpassForBounds(bbox: BoundingBox): Promise<
  Array<{
    centerLat: number;
    centerLng: number;
    tags: Record<string, string>;
    osmType: string;
    osmId: string;
  }>
> {
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
  ];
  const ENDPOINT_RETRIES = 2;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

    const endpointErrors: string[] = [];
    for (const endpoint of OVERPASS_ENDPOINTS) {
      for (let attempt = 1; attempt <= ENDPOINT_RETRIES; attempt++) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: query,
            signal: AbortSignal.timeout(25000),
          });

          if (!response.ok) {
            endpointErrors.push(`${endpoint} attempt ${attempt} -> ${response.status}`);
            if (attempt < ENDPOINT_RETRIES) {
              await sleep(500 * attempt);
            }
            continue;
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          endpointErrors.push(`${endpoint} attempt ${attempt} -> ${errMsg}`);
          if (attempt < ENDPOINT_RETRIES) {
            await sleep(500 * attempt);
          }
        }
      }
    }

    throw new Error(`All Overpass endpoints failed (${endpointErrors.join(" | ")})`);
  };

  // Smaller tiles reduce probability of endpoint-side timeout/504 on dense areas.
  const tiles = toTiles(bbox, 0.05);
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
    throw new Error("All Overpass tiles failed");
  }

  const merged = Array.from(unique.values());
  console.log(`[Overpass] Retrieved ${merged.length} unique elements from ${succeeded}/${tiles.length} tiles`);
  return merged;
}

function buildRasterGrid(
  osmElements: Array<{
    centerLat: number;
    centerLng: number;
    tags: Record<string, string>;
    osmType: string;
    osmId: string;
  }>,
  bbox: BoundingBox,
): Map<string, RasterCellData> {
  const { south, west, north, east } = bbox;
  const grid = new Map<string, RasterCellData>();

  const startLatIdx = Math.floor(south / GRID_RESOLUTION);
  const endLatIdx = Math.ceil(north / GRID_RESOLUTION);
  const startLngIdx = Math.floor(west / GRID_RESOLUTION);
  const endLngIdx = Math.ceil(east / GRID_RESOLUTION);

  console.log(`[Grid] Initializing grid cells: lat [${startLatIdx}, ${endLatIdx}], lng [${startLngIdx}, ${endLngIdx}]`);

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
        is_valid: false,
        theme: "meadow",
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
  const cellThemeAggregates = new Map<string, Partial<Record<ZoneTheme, CellThemeAggregate>>>();

  for (const elem of osmElements) {
    const indices = getGridCellIndex(elem.centerLat, elem.centerLng);
    const gridId = `${indices.latIdx}_${indices.lngIdx}`;
    const cell = grid.get(gridId);
    if (!cell) continue;

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

    if (classification.confidence > cell.theme_confidence) {
      cell.theme = classification.theme;
      cell.theme_confidence = classification.confidence;
      cell.dominant_osm_tags = elem.tags;
    }

    cell.osm_element_count += 1;

    const dLat = (elem.centerLat - cell.center_lat) * 111000;
    const dLng = (elem.centerLng - cell.center_lng) * 111000 * Math.cos((cell.center_lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    if (dist < cell.nearest_osm_element_distance_m) {
      cell.nearest_osm_element_distance_m = dist;
    }
  }

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

  for (const [gridId, cell] of grid) {
    cell.is_valid = cell.osm_element_count > 0 || cell.theme_confidence >= 0.1;
  }

  const validCount = Array.from(grid.values()).filter((cell) => cell.is_valid).length;
  console.log(`[Grid] ${validCount}/${grid.size} cells have usable OSM data`);
  return grid;
}

export async function initializeGeoRasterCells(
  adminClient: SupabaseClient,
  bbox: BoundingBox,
  options?: { forceRefresh?: boolean; trigger?: string },
): Promise<{ cellsCreated: number; durationMs: number; warning?: string }> {
  const startTime = Date.now();

  const toTiles = (source: BoundingBox, maxSpan = 0.05): BoundingBox[] => {
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

  if (options?.forceRefresh) {
    const startLatIdx = Math.floor(bbox.south / GRID_RESOLUTION);
    const endLatIdx = Math.ceil(bbox.north / GRID_RESOLUTION);
    const startLngIdx = Math.floor(bbox.west / GRID_RESOLUTION);
    const endLngIdx = Math.ceil(bbox.east / GRID_RESOLUTION);

    console.log(`[Grid] Force refresh requested by ${options.trigger || "unknown"}: deleting cells in bounds`);
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

  const tiles = toTiles(bbox, 0.05);
  let insertedTotal = 0;
  let validTotal = 0;
  let skippedTiles = 0;
  let failedTiles = 0;

  console.log(`[Grid] Processing ${tiles.length} tile(s) for initialization`);

  for (const [index, tile] of tiles.entries()) {
    const startLatIdx = Math.floor(tile.south / GRID_RESOLUTION);
    const endLatIdx = Math.ceil(tile.north / GRID_RESOLUTION);
    const startLngIdx = Math.floor(tile.west / GRID_RESOLUTION);
    const endLngIdx = Math.ceil(tile.east / GRID_RESOLUTION);
    const expectedCellCount = (endLatIdx - startLatIdx) * (endLngIdx - startLngIdx);

    if (!options?.forceRefresh) {
      const { count: existingCount, error: countError } = await adminClient
        .from("GeoRasterCell")
        .select("grid_id", { head: true, count: "exact" })
        .gte("grid_lat_idx", startLatIdx)
        .lt("grid_lat_idx", endLatIdx)
        .gte("grid_lng_idx", startLngIdx)
        .lt("grid_lng_idx", endLngIdx);

      if (!countError && (existingCount || 0) >= expectedCellCount) {
        skippedTiles += 1;
        console.log(`[Grid] Tile ${index + 1}/${tiles.length} already initialized (${existingCount}/${expectedCellCount}), skipping`);
        continue;
      }
    }

    try {
      const osmElements = await queryOverpassForBounds(tile);
      const gridCells = buildRasterGrid(osmElements, tile);
      const cellsArray = Array.from(gridCells.values());

      const { error: insertError, data } = await adminClient
        .from("GeoRasterCell")
        .upsert(cellsArray.map((cell) => ({
          grid_id: cell.grid_id,
          grid_lat_idx: cell.grid_lat_idx,
          grid_lng_idx: cell.grid_lng_idx,
          center_lat: cell.center_lat,
          center_lng: cell.center_lng,
          theme: cell.theme,
          theme_confidence: cell.theme_confidence,
          dominant_osm_tags: cell.dominant_osm_tags,
          theme_scores: cell.theme_scores,
          theme_anchor_points: cell.theme_anchor_points,
          osm_element_count: cell.osm_element_count,
          nearest_osm_element_distance_m: Math.round(cell.nearest_osm_element_distance_m),
          is_valid: cell.is_valid,
          last_osm_update_date: new Date().toISOString().split("T")[0],
        })), { onConflict: "grid_id" })
        .select();

      if (insertError) {
        failedTiles += 1;
        console.warn(`[Grid] Tile ${index + 1}/${tiles.length} insert failed:`, insertError);
        continue;
      }

      insertedTotal += data?.length || cellsArray.length;
      validTotal += cellsArray.filter((cell) => cell.is_valid).length;
      console.log(`[Grid] Tile ${index + 1}/${tiles.length} initialized (${cellsArray.length} cells)`);
    } catch (tileError) {
      failedTiles += 1;
      const errMsg = tileError instanceof Error ? tileError.message : String(tileError);
      console.warn(`[Grid] Tile ${index + 1}/${tiles.length} failed: ${errMsg}`);
    }
  }

  let warning: string | undefined;
  if (failedTiles > 0) {
    warning = `${failedTiles}/${tiles.length} tile(s) failed during initialization; rerun continues with remaining tiles.`;
  } else if (insertedTotal === 0 && skippedTiles > 0) {
    warning = "All tiles already initialized";
  } else if (validTotal === 0) {
    warning = "No OSM-backed theme data found in requested cells";
  }

  return {
    cellsCreated: insertedTotal,
    warning,
    durationMs: Date.now() - startTime,
  };
}