import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import proj4 from "https://esm.sh/proj4@2.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Phase 5: Slim OSM tile-based zone generation
// Reads directly from OSMTileChunkLite + OSMTileValue instead of GeoRasterCell.

type ZoneTheme = "forest" | "urban" | "water" | "meadow";
const PLAYER_RADIUS_M = 3500;
const TILE_SIZE_M = 100;
const CHUNK_SIZE_TILES = 10;
const DATASET_VERSION = "osm_de_2026_04_10";
const EPSG_3035 = "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +datum=ETRS89 +units=m +no_defs +type=crs";

proj4.defs("EPSG:3035", EPSG_3035);

interface RequestBody {
  authId?: string;
  userEmail?: string | null;
  authDayKey?: string;
  mode?: "initial" | "reroll";
  latitude?: number;
  longitude?: number;
  forceRegenerate?: boolean;
}

interface RasterCell {
  id: string;
  grid_id: string;
  is_valid: boolean;
  theme: ZoneTheme;
  center_lat: number;
  center_lng: number;
  theme_confidence: number;
  dominant_osm_tags: Record<string, string>;
  theme_scores?: Partial<Record<ZoneTheme, number>>;
  theme_anchor_points?: Partial<Record<ZoneTheme, { lat: number; lng: number }>>;
  osm_element_count?: number;
}

interface SlimChunkRow {
  id: string;
  chunk_x: number;
  chunk_y: number;
  tile_count: number;
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

interface GeneratedZone {
  id: string;
  theme: ZoneTheme;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  zoneKey: string;
  confidence: number;
  bonusMultiplier: number;
}

interface ThemeCandidate {
  cellId: string;
  theme: ZoneTheme;
  lat: number;
  lng: number;
  probability: number;
  osmElementCount: number;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isUuid(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeEmail(value: string | null | undefined): string | null {
  const norm = value?.trim().toLowerCase();
  return norm || null;
}


function getAllowedOrigins(): string[] {
  return [
    Deno.env.get("FLORALOG_URL"),
    Deno.env.get("SITE_URL"),
    "http://localhost",
    "https://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "capacitor://localhost",
    "ionic://localhost",
    "file://",
    "", // leere Origin für App-Requests ohne Origin-Header
  ].filter((v) => v !== undefined);
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return getAllowedOrigins().some((a) => origin.toLowerCase() === a.toLowerCase());
}

function toDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function roundPosition(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  const radiusSq = radiusM * radiusM; // Avoid repeated Math.sqrt on iOS
  
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

function getThemeForZoneType(zoneType: number): ZoneTheme | null {
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
      return "water";
    case 5:
      return "water";
    default:
      return null;
  }
}

function buildSlimRasterCells(
  chunks: SlimChunkRow[],
  tileValues: SlimTileValueRow[],
  validTileKeys: Set<string>,
): RasterCell[] {
  const chunkById = new Map<string, SlimChunkRow>();
  for (const chunk of chunks) {
    chunkById.set(chunk.id, chunk);
  }
  
  // Pre-allocate and reuse theme totals to reduce GC pressure on iOS
  const tileMap = new Map<string, {
    tileX: number;
    tileY: number;
    forest: number;
    water: number;
    meadow: number;
    urban: number;
    zoneRowCount: number;
  }>();

  for (const row of tileValues) {
    const chunk = chunkById.get(row.chunk_id);
    if (!chunk) continue;

    const tileX = chunk.chunk_x * CHUNK_SIZE_TILES + Number(row.tile_local_x);
    const tileY = chunk.chunk_y * CHUNK_SIZE_TILES + Number(row.tile_local_y);
    const tileKey = `${tileX}:${tileY}`;
    if (!validTileKeys.has(tileKey)) continue;

    const theme = getThemeForZoneType(Number(row.zone_type));
    if (!theme) continue;

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
        zoneRowCount: 0,
      };
      tileMap.set(tileKey, tileData);
    }

    tileData[theme] += zoneValue;
    tileData.zoneRowCount += 1;
  }

  const cells: RasterCell[] = [];
  cells.length = tileMap.size; // Pre-allocate array
  let cellIndex = 0;

  for (const [tileKey, tileData] of tileMap.entries()) {
    const total = tileData.forest + tileData.water + tileData.meadow + tileData.urban;
    if (total <= 0) continue;

    const center = getTileCenter(tileData.tileX, tileData.tileY);
    
    // Build theme scores only if needed
    const themeScores: Partial<Record<ZoneTheme, number>> = {};
    let dominantTheme: ZoneTheme = "meadow";
    let dominantScore = -1;

    const themes: ZoneTheme[] = ["forest", "water", "urban", "meadow"];
    for (const theme of themes) {
      const rawValue = tileData[theme];
      if (rawValue <= 0) continue;
      const normalized = rawValue / total;
      themeScores[theme] = normalized;
      if (normalized > dominantScore) {
        dominantScore = normalized;
        dominantTheme = theme;
      }
    }

    cells[cellIndex++] = {
      id: tileKey,
      grid_id: tileKey,
      is_valid: true,
      theme: dominantTheme,
      center_lat: center.lat,
      center_lng: center.lng,
      theme_confidence: dominantScore,
      dominant_osm_tags: {},
      theme_scores: themeScores,
      theme_anchor_points: { [dominantTheme]: { lat: center.lat, lng: center.lng } },
      osm_element_count: tileData.zoneRowCount,
    };
  }

  cells.length = cellIndex; // Trim to actual size
  return cells;
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
      .select("id, chunk_x, chunk_y, tile_count")
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

function hashStrToInt(s: string): number {
  // FNV-1a 32-bit — fast, deterministic, good distribution
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function pickThemeByWeightedProbability(
  themes: ZoneTheme[],
  weights: Partial<Record<ZoneTheme, number>>,
  rng: () => number,
): ZoneTheme {
  const validThemes = themes.filter((theme) => (weights[theme] || 0) > 0);
  if (validThemes.length === 0) return themes[0];

  const total = validThemes.reduce((acc, theme) => acc + (weights[theme] || 0), 0);
  if (total <= 0) return validThemes[0];

  let roll = rng() * total;
  for (const theme of validThemes) {
    roll -= weights[theme] || 0;
    if (roll <= 0) return theme;
  }

  return validThemes[validThemes.length - 1];
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const computeOverallHealth = (energyValue: number, dataQualityValue: number, careValue: number): number => {
  const avg = (clamp(Number(energyValue ?? 0), 0, 100) + clamp(Number(dataQualityValue ?? 0), 0, 100) + clamp(Number(careValue ?? 0), 0, 100)) / 3;
  return clamp(Math.floor(avg), 0, 100);
};

const computeZoneCountFromDataQuality = (dataQualityValue: number): number => {
  const safeDataQuality = clamp(Number(dataQualityValue ?? 0), 0, 100);
  const baseZoneCount = Math.min(8, Math.max(1, Math.floor(safeDataQuality / 10)));
  const bonusZones = safeDataQuality >= 90 ? 4 : safeDataQuality >= 80 ? 2 : 0;
  return baseZoneCount + bonusZones;
};

const computeZoneRerollsFromCare = (careValue: number): number => {
  const safeCare = clamp(Number(careValue ?? 0), 0, 100);
  if (safeCare >= 90) return 2;
  if (safeCare >= 80) return 1;
  return 0;
};

const pickZoneRadius = (energyValue: number, rng: () => number): number => {
  const baseMin = 50;
  const baseMax = 500;
  const safeEnergy = clamp(Number(energyValue ?? 0), 0, 100);
  const base = baseMin + Math.round(rng() * (baseMax - baseMin));
  return Math.round(base * (1 + safeEnergy / 100));
};

const scoreZoneSet = (zones: GeneratedZone[], centerLat: number, centerLng: number): number => {
  if (zones.length === 0) return -Infinity;
  const themes = new Set(zones.map((zone) => zone.theme));
  const totalDistance = zones.reduce(
    (acc, zone) => acc + distanceMeters(centerLat, centerLng, zone.centerLat, zone.centerLng),
    0,
  );

  // Weighted for broad theme coverage and nearby zones.
  return themes.size * 1000 + zones.length * 120 - totalDistance / 300;
};

/**
 * Select best zones from available raster cells
 * iOS Optimization: Pre-compute distances, minimize array allocations
 */
function selectBestZones(
  cells: RasterCell[],
  centerLat: number,
  centerLng: number,
  options?: {
    randomize?: boolean;
    seed?: number;
    maxDistanceM?: number;
    fallbackCells?: RasterCell[];
    targetZoneCount?: number;
    energyValue?: number;
  },
): GeneratedZone[] {
  const MIN_THEME_CONFIDENCE = 0.1;
  const MAX_CANDIDATES = Math.min(cells.length * 2, 500); // Limit on iOS
  const randomize = options?.randomize === true;
  const maxDistanceM = options?.maxDistanceM ?? PLAYER_RADIUS_M;
  const fallbackCells = options?.fallbackCells || [];
  const rng = randomize ? createSeededRng(options?.seed ?? Date.now()) : Math.random;
  const themePickRng = rng;
  const targetZoneCount = Math.max(0, Number(options?.targetZoneCount ?? 0));
  const energyValue = Number(options?.energyValue ?? 0);

  if (targetZoneCount <= 0) {
    return [];
  }

  // Pre-compute distances for all cells (iOS: do this once, not repeatedly)
  const distanceCache = new Map<string, number>();
  for (const cell of cells) {
    const dist = distanceMeters(centerLat, centerLng, cell.center_lat, cell.center_lng);
    distanceCache.set(cell.id, dist);
  }

  const allCandidates: ThemeCandidate[] = [];
  allCandidates.length = MAX_CANDIDATES; // Pre-allocate
  let candidateCount = 0;

  for (const cell of cells) {
    const cellDistance = distanceCache.get(cell.id) ?? maxDistanceM + 1;
    if (cellDistance > maxDistanceM) continue;

    const themeScores = cell.theme_scores || {};
    const availableThemes = (Object.keys(themeScores) as ZoneTheme[])
      .filter((theme) => (themeScores[theme] || 0) >= MIN_THEME_CONFIDENCE);

    if (availableThemes.length === 0) {
      if (candidateCount < MAX_CANDIDATES) {
        allCandidates[candidateCount++] = {
          cellId: cell.id,
          theme: cell.theme,
          lat: cell.center_lat,
          lng: cell.center_lng,
          probability: Math.max(cell.theme_confidence || 0, MIN_THEME_CONFIDENCE),
          osmElementCount: cell.osm_element_count || 0,
        };
      }
      continue;
    }

    const selectedTheme = pickThemeByWeightedProbability(availableThemes, themeScores, themePickRng);
    if (candidateCount < MAX_CANDIDATES) {
      const anchorPoints = cell.theme_anchor_points || {};
      const anchor = anchorPoints[selectedTheme];
      allCandidates[candidateCount++] = {
        cellId: cell.id,
        theme: selectedTheme,
        lat: anchor?.lat ?? cell.center_lat,
        lng: anchor?.lng ?? cell.center_lng,
        probability: Number(themeScores[selectedTheme] || 0),
        osmElementCount: cell.osm_element_count || 0,
      };
    }
  }

  allCandidates.length = candidateCount; // Trim to actual size

  // Sort by distance once (iOS: avoids repeated distance calculations)
  allCandidates.sort((a, b) => {
    const distA = distanceMeters(centerLat, centerLng, a.lat, a.lng);
    const distB = distanceMeters(centerLat, centerLng, b.lat, b.lng);
    if (distA !== distB) return distA - distB;
    if (b.probability !== a.probability) return b.probability - a.probability;
    return b.osmElementCount - a.osmElementCount;
  });

  const selectedZones: GeneratedZone[] = [];
  const dayKey = toDayKey();
  const themes: ZoneTheme[] = ["forest", "water", "urban", "meadow"];
  const maxPerTheme = Math.max(1, Math.ceil(targetZoneCount / themes.length) + 1);
  const themeCount: Record<ZoneTheme, number> = { forest: 0, water: 0, urban: 0, meadow: 0 };

  const overlapsExisting = (lat: number, lng: number, radiusM: number): boolean => {
    for (const zone of selectedZones) {
      const dist = distanceMeters(lat, lng, zone.centerLat, zone.centerLng);
      const minSeparation = zone.radiusM + radiusM;
      if (dist < minSeparation) {
        return true;
      }
    }
    return false;
  };

  const addZoneCandidate = (candidate: ThemeCandidate, suffix: string): boolean => {
    const radiusM = pickZoneRadius(energyValue, rng);
    if (overlapsExisting(candidate.lat, candidate.lng, radiusM)) return false;

    selectedZones.push({
      id: candidate.cellId,
      theme: candidate.theme,
      centerLat: candidate.lat,
      centerLng: candidate.lng,
      radiusM,
      zoneKey: `${dayKey}-${candidate.theme}-${candidate.cellId.substring(0, 8)}-${suffix}`,
      confidence: candidate.probability,
      bonusMultiplier: 1.5,
    });
    themeCount[candidate.theme] += 1;
    return true;
  };

  // First pass: Select one zone per theme
  for (const theme of themes) {
    const themeCandidates = allCandidates.filter((c) => c.theme === theme);
    if (themeCandidates.length === 0) continue;
    for (const candidate of themeCandidates) {
      if (addZoneCandidate(candidate, "base")) {
        break;
      }
    }
  }

  // Second pass: Fill remaining slots from all candidates
  const alreadySelectedKeys = new Set(selectedZones.map((z) => `${z.id}:${z.theme}`));
  for (const candidate of allCandidates) {
    if (selectedZones.length >= targetZoneCount) break;
    const candidateKey = `${candidate.cellId}:${candidate.theme}`;
    if (alreadySelectedKeys.has(candidateKey)) continue;
    if (themeCount[candidate.theme] >= maxPerTheme) continue;

    if (addZoneCandidate(candidate, String(selectedZones.length))) {
      alreadySelectedKeys.add(candidateKey);
    }
  }

  if (selectedZones.length < targetZoneCount && fallbackCells.length > 0) {
    const fallbackCandidates = fallbackCells
      .map((cell) => ({
        cell,
        distanceToPlayer: distanceMeters(centerLat, centerLng, cell.center_lat, cell.center_lng),
      }))
      .filter((entry) => entry.distanceToPlayer <= maxDistanceM)
      .sort((a, b) => a.distanceToPlayer - b.distanceToPlayer);

    for (const entry of fallbackCandidates) {
      if (selectedZones.length >= targetZoneCount) break;

      const radiusM = pickZoneRadius(energyValue, rng);
      if (overlapsExisting(entry.cell.center_lat, entry.cell.center_lng, radiusM)) continue;

      selectedZones.push({
        id: entry.cell.id,
        theme: "meadow",
        centerLat: entry.cell.center_lat,
        centerLng: entry.cell.center_lng,
        radiusM,
        zoneKey: `${dayKey}-fallback-${entry.cell.id.substring(0, 8)}-${selectedZones.length}`,
        confidence: 0.12,
        bonusMultiplier: 1.5,
      });
    }
  }

  return selectedZones;
}

const buildBestZoneSetWithRerolls = (
  cells: RasterCell[],
  centerLat: number,
  centerLng: number,
  options: {
    randomize?: boolean;
    seed?: number;
    maxDistanceM?: number;
    fallbackCells?: RasterCell[];
    targetZoneCount: number;
    energyValue: number;
    rerolls: number;
  },
): GeneratedZone[] => {
  const attempts = Math.max(1, options.rerolls + 1);
  let bestZones: GeneratedZone[] = [];
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const zones = selectBestZones(cells, centerLat, centerLng, {
      ...options,
      seed: (options.seed ?? Date.now()) + attempt,
      randomize: true,
    });
    const score = scoreZoneSet(zones, centerLat, centerLng);
    if (score > bestScore) {
      bestScore = score;
      bestZones = zones;
    }
  }

  return bestZones;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    console.log("[robotPlantDailyZones] Request received");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[robotPlantDailyZones] Missing config: SUPABASE_URL or SERVICE_ROLE_KEY");
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    const requestOrigin = req.headers.get("Origin");
    if (!isAllowedOrigin(requestOrigin)) {
      console.warn("[robotPlantDailyZones] Origin not allowed", { requestOrigin });
      return jsonResponse({ error: "Origin not allowed", origin: requestOrigin }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as RequestBody;
    const authId = String(body.authId || "").trim();
    const providedEmail = normalizeEmail(body.userEmail);
    const authDayKey = String(body.authDayKey || "").trim();
    const callMode: "initial" | "reroll" = body.mode === "reroll" ? "reroll" : "initial";

    if (!isUuid(authId)) {
      return jsonResponse({ error: "authId required" }, 400);
    }

    const { data: userLookup, error: userLookupError } = await adminClient.auth.admin.getUserById(authId);
    if (userLookupError || !userLookup?.user) {
      return jsonResponse({ error: "Invalid authId" }, 401);
    }

    const resolvedEmail = normalizeEmail(userLookup.user.email);
    if (providedEmail && resolvedEmail && providedEmail !== resolvedEmail) {
      return jsonResponse({ error: "authId/email mismatch" }, 403);
    }

    const { data: profile } = await adminClient
      .from("PublicProfile")
      .select("role")
      .eq("auth_id", authId)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";

    const forceRegenerate = body?.forceRegenerate === true;
    const providedLat = Number(body.latitude);
    const providedLng = Number(body.longitude);

    // Load or create RobotPlant record
    const { data: robots, error: robotError } = await adminClient
      .from("RobotPlant")
      .select("*")
      .eq("auth_id", authId)
      .single();

    if (robotError && robotError.code !== "PGRST116") {
      console.error("[robotPlantDailyZones] RobotPlant read error:", robotError);
      return jsonResponse({ error: "Failed to load robot plant" }, 500);
    }

    const robot = robots as any;
    const dayKey = toDayKey();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(authDayKey)) {
      return jsonResponse({
        success: false,
        error: "authDayKey required",
        code: "AUTH_DAY_KEY_REQUIRED",
      }, 400);
    }

    if (callMode === "initial" && forceRegenerate) {
      return jsonResponse({
        success: false,
        error: "Initial mode cannot force regenerate.",
        code: "INITIAL_FORCE_REGENERATE_NOT_ALLOWED",
      }, 400);
    }

    if (callMode === "reroll" && !forceRegenerate) {
      return jsonResponse({
        success: false,
        error: "Reroll mode requires forceRegenerate=true.",
        code: "REROLL_REQUIRES_FORCE_REGENERATE",
      }, 400);
    }

    // Initial calls are idempotent: if today's zones already exist, return cached zones later.

    if (callMode === "reroll" && authDayKey !== dayKey) {
      return jsonResponse({
        success: false,
        error: "Reroll requires a successful initial call today.",
        code: "REROLL_REQUIRES_INITIAL_TODAY",
      }, 409);
    }

    // === DAILY DECAY TICK ===
    // Order: 1) snapshot pre-decay reroll bonus, 2) apply decay, 3) use post-decay energy for zones
    let currentEnergy = clamp(Number(robot?.energy ?? 70), 0, 100);
    let currentCare = clamp(Number(robot?.care ?? 72), 0, 100);
    let currentDq = clamp(Number(robot?.data_quality ?? 65), 0, 100);

    const lastDecayAt = robot?.last_decay_at ? new Date(robot.last_decay_at) : null;
    const lastDecayDayKey = lastDecayAt ? toDayKey(lastDecayAt) : null;
    const isNewDay = lastDecayDayKey !== dayKey;

    // Pre-decay snapshot: compute bonus rerolls BEFORE care drops
    const preDecayBonusRerolls = computeZoneRerollsFromCare(currentCare); // 0/1/2/4
    const totalRerollsGrantedToday = 1 + preDecayBonusRerolls; // 1 free base + care bonus

    if (isNewDay) {
      const hoursSinceLastDecay = lastDecayAt
        ? Math.max(24, (Date.now() - lastDecayAt.getTime()) / 3600000)
        : 24;
      const dayFactor = Math.min(hoursSinceLastDecay / 24, 30); // cap backfill at 30 days

      const nowIso = new Date().toISOString();
      let activeDecayReduction = 0;
      let partnerDecayReduction = 0;

      if (resolvedEmail) {
        const { data: partnerRelation, error: partnerRelationError } = await adminClient
          .from("Friend")
          .select("id, status, request_sent_by, request_sent_to")
          .eq("status", "partner")
          .or(`request_sent_by.eq.${resolvedEmail},request_sent_to.eq.${resolvedEmail}`)
          .limit(1)
          .maybeSingle();

        if (partnerRelationError) {
          console.warn("[robotPlantDailyZones] Failed to load partner relation (non-fatal):", partnerRelationError);
        } else if (String(partnerRelation?.status || "").toLowerCase() === "partner") {
          partnerDecayReduction = 0.5;
        }
      }

      const { data: activeDecayEffects, error: activeDecayEffectsError } = await adminClient
        .from("RobotPlantActiveEffect")
        .select("effect_value")
        .eq("auth_id", authId)
        .eq("effect_type", "decay_reduction")
        .gt("expires_at", nowIso);

      if (activeDecayEffectsError) {
        console.warn("[robotPlantDailyZones] Failed to load active decay-reduction effects (non-fatal):", activeDecayEffectsError);
      } else {
        const summedReduction = (activeDecayEffects || []).reduce(
          (acc, effect) => acc + Number(effect?.effect_value || 0),
          0,
        );
        activeDecayReduction = clamp(summedReduction + partnerDecayReduction, 0, 0.9);
      }

      const computeStatDecay = (value: number) => {
        if (value < 10) return 0;
        return Math.round(Math.floor(value / 10) * dayFactor * (1 - activeDecayReduction));
      };
      const energyDecay = computeStatDecay(currentEnergy);
      const dqDecay = computeStatDecay(currentDq);
      const careDecay = computeStatDecay(currentCare);
      const newEnergy = clamp(currentEnergy - energyDecay, 0, 100);
      const newDq = clamp(currentDq - dqDecay, 0, 100);
      const newCare = clamp(currentCare - careDecay, 0, 100);

      const { error: decayUpdateError } = await adminClient
        .from("RobotPlant")
        .update({
          energy: newEnergy,
          data_quality: newDq,
          care: newCare,
          last_decay_at: new Date().toISOString(),
        })
        .eq("auth_id", authId);

      if (decayUpdateError) {
        console.warn("[robotPlantDailyZones] Decay update failed (non-fatal):", decayUpdateError);
      } else {
        console.log(
          `[robotPlantDailyZones] Decay tick: E:${currentEnergy}→${newEnergy}(-${energyDecay}) DQ:${currentDq}→${newDq}(-${dqDecay}) C:${currentCare}→${newCare}(-${careDecay})` +
          ` (factor:${dayFactor.toFixed(2)}, fertilizerReduction:${activeDecayReduction}, partnerReduction:${partnerDecayReduction}, preDecayBonusRerolls:+${preDecayBonusRerolls})`,
        );
        currentEnergy = newEnergy;
        currentDq = newDq;
        currentCare = newCare;
      }
    }

    // Post-decay values used for zone budget
    const hasProvidedPos = Number.isFinite(providedLat) && Number.isFinite(providedLng);
    const targetZoneCount = computeZoneCountFromDataQuality(currentDq);
    const rerolls = computeZoneRerollsFromCare(currentCare);
    const hasStoredPos =
      robot &&
      Number.isFinite(Number(robot.last_valid_geo_lat)) &&
      Number.isFinite(Number(robot.last_valid_geo_lng));

    if (!hasProvidedPos && !hasStoredPos) {
      return jsonResponse({ error: "latitude/longitude required on first generation" }, 400);
    }

    const baseLat = hasProvidedPos ? roundPosition(providedLat, 3) : Number(robot.last_valid_geo_lat);
    const baseLng = hasProvidedPos ? roundPosition(providedLng, 3) : Number(robot.last_valid_geo_lng);

    // Upsert position
    const { error: upsertError } = await adminClient.from("RobotPlant").upsert(
      {
        auth_id: authId,
        last_valid_geo_lat: baseLat,
        last_valid_geo_lng: baseLng,
        last_valid_geo_at: new Date().toISOString(),
      },
      { onConflict: "auth_id" },
    );

    if (upsertError) {
      console.error("[robotPlantDailyZones] Upsert error:", upsertError);
    }

    const authKeySuffix = authId.replace(/-/g, "");
    const queryStartTime = Date.now();
    const zoneThemes = ["forest", "urban", "water", "meadow"];

    const { data: todaysExistingZones, error: todaysExistingError } = await adminClient
      .from("RobotPlantZone")
      .select("id")
      .eq("day_generated", dayKey)
      .like("zone_key", `%:${authKeySuffix}`)
      .in("theme", zoneThemes)
      .limit(1);

    if (todaysExistingError) {
      console.error("[robotPlantDailyZones] Failed to check today's existing zones:", todaysExistingError);
      return jsonResponse({ error: "Failed to validate daily zone call" }, 500);
    }

    // Initial calls are allowed even when zones already exist for today.
    // The existing-zone cache path below will return today's zones.

    if (callMode === "reroll" && (!Array.isArray(todaysExistingZones) || todaysExistingZones.length === 0)) {
      return jsonResponse({
        success: false,
        error: "Reroll requires existing zones for today.",
        code: "REROLL_MISSING_BASE_ZONES",
      }, 409);
    }

    // Keep only today's cache rows for this user and purge stale day-bound cache rows.
    const { error: staleCacheCleanupError } = await adminClient
      .from("RobotPlantZone")
      .delete()
      .like("zone_key", `%:${authKeySuffix}`)
      .in("theme", zoneThemes)
      .or(`day_generated.is.null,day_generated.neq.${dayKey}`);

    if (staleCacheCleanupError) {
      console.warn("[robotPlantDailyZones] Failed to cleanup stale cache rows (non-fatal):", staleCacheCleanupError);
    }

    if (targetZoneCount <= 0) {
      const { error: clearZonesError } = await adminClient
        .from("RobotPlantZone")
        .delete()
        .eq("day_generated", dayKey)
        .like("zone_key", `%:${authKeySuffix}`)
        .in("theme", zoneThemes);

      if (clearZonesError) {
        console.error("[robotPlantDailyZones] Failed to clear zones for low energy", clearZonesError);
      }

      return jsonResponse({
        success: true,
        cached: false,
        rasterBased: false,
        osmSlimBased: true,
        queryDurationMs: 0,
        zones: [],
      });
    }

    // === LOAD GENERATION LOG (multi-reroll tracking) ===
    const { data: genLog } = await adminClient
      .from("RobotPlantZoneGenerationLog")
      .select("*")
      .eq("auth_id", authId)
      .eq("day_key", dayKey)
      .maybeSingle();

    // Use stored rerolls_granted_today if available (preserves pre-decay snapshot), else compute now
    const rerollsGrantedToday: number | null = !isAdmin
      ? (genLog?.rerolls_granted_today ?? totalRerollsGrantedToday)
      : null;
    const rerollsUsedToday = !isAdmin ? (genLog?.reroll_count ?? 0) : 0;
    const rerollsRemaining: number | null = rerollsGrantedToday !== null
      ? Math.max(0, rerollsGrantedToday - rerollsUsedToday)
      : null;

    // On new day: ensure generation log exists with today's pre-decay reroll grant
    if (isNewDay && !isAdmin && !genLog) {
      await adminClient
        .from("RobotPlantZoneGenerationLog")
        .upsert({
          auth_id: authId,
          day_key: dayKey,
          rerolls_granted_today: totalRerollsGrantedToday,
          reroll_count: 0,
        }, { onConflict: "auth_id,day_key" });
    }

    if (forceRegenerate && !isAdmin) {
      if (rerollsRemaining !== null && rerollsRemaining <= 0) {
        return jsonResponse({
          success: false,
          error: "Keine Rerolls mehr verfuegbar fuer heute.",
          rateLimited: true,
          rerollsRemainingToday: 0,
        }, 200);
      }
    }

    // Force regeneration should fully replace today's zones.
    if (forceRegenerate) {
      // Clear all cached zone rows for this user before regenerating.
      const { error: deleteUserScopedError } = await adminClient
        .from("RobotPlantZone")
        .delete()
        .like("zone_key", `%:${authKeySuffix}`)
        .in("theme", zoneThemes);

      if (deleteUserScopedError) {
        console.error("[robotPlantDailyZones] Failed to clear user-scoped zones for force regeneration:", deleteUserScopedError);
        return jsonResponse({ error: "Failed to clear existing zones" }, 500);
      }

      // Backward-compat cleanup for old rows created before user-scoped zone_key suffix existed.
      const { error: deleteLegacyError } = await adminClient
        .from("RobotPlantZone")
        .delete()
        .eq("day_generated", dayKey)
        .like("zone_key", `${dayKey}-%`)
        .not("zone_key", "like", "%:%")
        .in("theme", zoneThemes);

      if (deleteLegacyError) {
        console.warn("[robotPlantDailyZones] Legacy zone cleanup failed (non-fatal):", deleteLegacyError);
      }

      console.log("[robotPlantDailyZones] Cleared existing zones for force regeneration");
    }

    // Check for existing cached zones
    if (!forceRegenerate) {
      const { data: existing, error: existError } = await adminClient
        .from("RobotPlantZone")
        .select("*")
        .eq("day_generated", dayKey)
        .like("zone_key", `%:${authKeySuffix}`)
        .in("theme", zoneThemes);

      if (!existError && Array.isArray(existing) && existing.length > 0) {
        const { data: zoneStates, error: zoneStateError } = await adminClient
          .from("RobotPlantUserZoneState")
          .select("zone_id, scans_in_zone")
          .eq("auth_id", authId)
          .eq("day_key", dayKey)
          .in("zone_id", existing.map((zone) => zone.id));

        if (zoneStateError) {
          console.error("[robotPlantDailyZones] Zone-state query error:", zoneStateError);
          return jsonResponse({ error: "Failed to query zone scan progress" }, 500);
        }

        const scanCountsByZoneId = new Map(
          (zoneStates || []).map((state) => [state.zone_id, Number(state.scans_in_zone) || 0]),
        );
        console.log(`[robotPlantDailyZones] Returning ${existing.length} cached zones for today`);
        return jsonResponse({
          success: true,
          cached: true,
          rerollsRemainingToday: rerollsRemaining,
          zones: existing.map((z) => ({
            id: z.id,
            theme: z.theme,
            centerLat: z.center_lat,
            centerLng: z.center_lng,
            radiusM: z.radius_m,
            zoneKey: z.zone_key,
            bonusMultiplier: z.zone_bonus_multiplier || 1.0,
            scansToday: scanCountsByZoneId.get(z.id) || 0,
          })),
        });
      }
    }

    // === SLIM OSM TILE-BASED ZONE GENERATION ===
    console.log(`[robotPlantDailyZones] Generating zones from slim OSM tiles for (${baseLat}, ${baseLng})`);

    const searchRadiusM = PLAYER_RADIUS_M;
    const searchTiles = getTilesInRadius(baseLat, baseLng, searchRadiusM);
    console.log(`[robotPlantDailyZones] Searching ${searchTiles.length} OSM tiles within ${searchRadiusM}m radius`);

    const validTileKeys = new Set(searchTiles.map((tile) => `${tile.tileX}:${tile.tileY}`));
    const minChunkX = Math.min(...searchTiles.map((tile) => Math.floor(tile.tileX / CHUNK_SIZE_TILES)));
    const maxChunkX = Math.max(...searchTiles.map((tile) => Math.floor(tile.tileX / CHUNK_SIZE_TILES)));
    const minChunkY = Math.min(...searchTiles.map((tile) => Math.floor(tile.tileY / CHUNK_SIZE_TILES)));
    const maxChunkY = Math.max(...searchTiles.map((tile) => Math.floor(tile.tileY / CHUNK_SIZE_TILES)));

    const { rows: chunkRows, error: chunkError } = await fetchChunksInBounds(
      adminClient,
      minChunkX,
      maxChunkX,
      minChunkY,
      maxChunkY,
    );

    if (chunkError) {
      console.error("[robotPlantDailyZones] Chunk query error:", chunkError);
      return jsonResponse({ error: "Failed to query OSM chunks" }, 500);
    }

    const chunks = chunkRows;
    if (chunks.length === 0) {
      return jsonResponse({
        success: false,
        error: "No precomputed OSM chunk data available for this location.",
        zones: [],
      }, 503);
    }

    const chunkIds = chunks.map((chunk) => chunk.id);
    const { rows: tileValueRows, error: tileValueError } = await fetchTileValuesForChunkIds(
      adminClient,
      chunkIds,
    );

    if (tileValueError) {
      console.error("[robotPlantDailyZones] Tile value query error:", tileValueError);
      return jsonResponse({ error: "Failed to query OSM tile values" }, 500);
    }

    console.log(
      `[robotPlantDailyZones] Fetched ${chunks.length} chunks and ${tileValueRows.length} tile-value rows (paginated)`
    );

    const rasterRows = buildSlimRasterCells(chunks, tileValueRows, validTileKeys);
    const cells = rasterRows.filter((row) => row.is_valid === true) as RasterCell[];
    const fallbackCells: RasterCell[] = [];
    const nearestValidDistance = cells.length > 0
      ? Math.min(...cells.map((cell) => distanceMeters(baseLat, baseLng, cell.center_lat, cell.center_lng)))
      : null;

    console.log(
      `[robotPlantDailyZones] Found ${cells.length} usable slim OSM tiles from ${chunks.length} chunks and ${tileValueRows.length} tile-value rows` +
      (nearestValidDistance !== null ? ` (nearest valid=${Math.round(nearestValidDistance)}m)` : ""),
    );

    if (cells.length === 0) {
      return jsonResponse({
        success: false,
        error: "No usable precomputed OSM tile data available for this location.",
        zones: [],
      }, 503);
    }

    // Select best zones from available cells based on current energy budget.
    // For normal loads: deterministic seed so concurrent calls (Layout warmup + Home load)
    // always generate the same zones → same zone_keys → upsert dedup is effective.
    // For force-regenerate: random seed per reroll so the user gets fresh zones.
    const regenerationSeed = forceRegenerate
      ? Date.now() + (rerollsUsedToday + 1) * 31337
      : hashStrToInt(`${dayKey}:${authId}`);
    const selectedZones = buildBestZoneSetWithRerolls(cells, baseLat, baseLng, {
      randomize: true,
      seed: regenerationSeed,
      maxDistanceM: PLAYER_RADIUS_M,
      fallbackCells,
      targetZoneCount,
      energyValue: currentEnergy,
      rerolls,
    });

    // Insert generated zones into RobotPlantZone table
    const zoneRecords = selectedZones.map((zone) => ({
      zone_key: `${zone.zoneKey}:${authKeySuffix}`,
      title: `${zone.theme.charAt(0).toUpperCase() + zone.theme.slice(1)} Zone`,
      theme: zone.theme,
      center_lat: zone.centerLat,
      center_lng: zone.centerLng,
      radius_m: zone.radiusM,
      zone_bonus_multiplier: zone.bonusMultiplier,
      is_active: true,
      valid_from: new Date().toISOString(),
      valid_to: new Date(Date.now() + 86400000).toISOString(),
      day_generated: dayKey,
    }));

    console.log(`[robotPlantDailyZones] Inserting ${zoneRecords.length} zone records`);
    const { data: insertedZones, error: insertError } = await adminClient
      .from("RobotPlantZone")
      .upsert(zoneRecords, { onConflict: "zone_key", ignoreDuplicates: true })
      .select("*");

    if (insertError) {
      console.error("[robotPlantDailyZones] Insert error:", insertError);
      return jsonResponse({ error: "Failed to insert zones" }, 500);
    }

    const queryDuration = Date.now() - queryStartTime;
    console.log(`[robotPlantDailyZones] Zone generation completed in ${queryDuration}ms with ${insertedZones?.length || 0} zones`);

    if (forceRegenerate && !isAdmin) {
      const themeCounts = {
        forest: selectedZones.filter((zone) => zone.theme === "forest").length,
        water: selectedZones.filter((zone) => zone.theme === "water").length,
        urban: selectedZones.filter((zone) => zone.theme === "urban").length,
        meadow: selectedZones.filter((zone) => zone.theme === "meadow").length,
      };

      const { error: regenLogError } = await adminClient
        .from("RobotPlantZoneGenerationLog")
        .upsert({
          auth_id: authId,
          day_key: dayKey,
          rerolls_granted_today: rerollsGrantedToday ?? totalRerollsGrantedToday,
          reroll_count: rerollsUsedToday + 1,
          search_radius_m: searchRadiusM,
          candidate_count_by_theme: themeCounts,
          selected_zone_count: selectedZones.length,
          total_duration_ms: queryDuration,
        }, { onConflict: "auth_id,day_key" });

      if (regenLogError) {
        console.warn("[robotPlantDailyZones] Failed to log regeneration usage:", regenLogError);
      }
    }

    // Log query metrics
    const { error: logError } = await adminClient
      .from("RasterCellQueryLog")
      .insert({
        auth_id: authId,
        query_date: dayKey,
        search_lat: baseLat,
        search_lng: baseLng,
        search_radius_m: searchRadiusM,
        cells_found: cells.length,
        cells_by_theme: {
          forest: cells.filter(c => c.theme === "forest").length,
          water: cells.filter(c => c.theme === "water").length,
          urban: cells.filter(c => c.theme === "urban").length,
          meadow: cells.filter(c => c.theme === "meadow").length,
        },
        query_duration_ms: queryDuration,
      });

    if (logError) {
      console.warn("[robotPlantDailyZones] Failed to log query metrics:", logError);
    }

    const generatedZoneIds = (insertedZones || []).map((zone) => zone.id);
    const { data: zoneStates, error: zoneStateError } = generatedZoneIds.length > 0
      ? await adminClient
        .from("RobotPlantUserZoneState")
        .select("zone_id, scans_in_zone")
        .eq("auth_id", authId)
        .eq("day_key", dayKey)
        .in("zone_id", generatedZoneIds)
      : { data: [], error: null };

    if (zoneStateError) {
      console.error("[robotPlantDailyZones] Zone-state query error:", zoneStateError);
      return jsonResponse({ error: "Failed to query zone scan progress" }, 500);
    }

    const scanCountsByZoneId = new Map(
      (zoneStates || []).map((state) => [state.zone_id, Number(state.scans_in_zone) || 0]),
    );

    return jsonResponse({
      success: true,
      cached: false,
      rasterBased: false,
      osmSlimBased: true,
      rerollsRemainingToday: isAdmin ? null : Math.max(0, (rerollsGrantedToday ?? totalRerollsGrantedToday) - (rerollsUsedToday + 1)),
      queryDurationMs: queryDuration,
      zones: (insertedZones || []).map((z) => ({
        id: z.id,
        theme: z.theme,
        centerLat: z.center_lat,
        centerLng: z.center_lng,
        radiusM: z.radius_m,
        zoneKey: z.zone_key,
        bonusMultiplier: z.zone_bonus_multiplier || 1.0,
        scansToday: scanCountsByZoneId.get(z.id) || 0,
      })),
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : "";
    console.error("[robotPlantDailyZones] Unhandled error:", errMsg);
    console.error("[robotPlantDailyZones] Stack:", errStack);
    return jsonResponse({ error: `Internal server error: ${errMsg}` }, 500);
  }
});
