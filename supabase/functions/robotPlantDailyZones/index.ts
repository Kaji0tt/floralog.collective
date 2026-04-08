import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBoundsForGridRange, getGridCellCenter, GRID_RESOLUTION, initializeGeoRasterCells } from "../_shared/geoRaster.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Phase 4: Raster-Based Zone Generation
// Uses pre-computed GeoRasterCell grid instead of live Overpass API calls
// Guarantees <100ms response time with consistent data quality

type ZoneTheme = "forest" | "urban" | "water" | "meadow";
const PLAYER_RADIUS_M = 3500;

interface RequestBody {
  authId?: string;
  userEmail?: string | null;
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
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean) as string[];
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

/**
 * Calculate grid cell coordinates from latitude/longitude
 * Grid cell size: ~707m per side (0.5km² area)
 * Grid resolution: ~0.00636° per cell
 */
function getGridCellCoordinates(lat: number, lng: number): { latIdx: number; lngIdx: number } {
  return {
    latIdx: Math.floor(lat / GRID_RESOLUTION),
    lngIdx: Math.floor(lng / GRID_RESOLUTION),
  };
}

/**
 * Get all grid cell indices within a search radius
 */
function getGridCellsInRadius(centerLat: number, centerLng: number, radiusM: number): Array<{ latIdx: number; lngIdx: number }> {
  const radiusInDegrees = radiusM / 111000; // Rough conversion: 1° ≈ 111km
  
  const centerCell = getGridCellCoordinates(centerLat, centerLng);
  const cellOffset = Math.ceil(radiusInDegrees / GRID_RESOLUTION);
  
  const cells: Array<{ latIdx: number; lngIdx: number }> = [];
  for (let latIdx = centerCell.latIdx - cellOffset; latIdx <= centerCell.latIdx + cellOffset; latIdx++) {
    for (let lngIdx = centerCell.lngIdx - cellOffset; lngIdx <= centerCell.lngIdx + cellOffset; lngIdx++) {
      const center = getGridCellCenter(latIdx, lngIdx);
      if (distanceMeters(centerLat, centerLng, center.lat, center.lng) <= radiusM) {
        cells.push({ latIdx, lngIdx });
      }
    }
  }
  return cells;
}

function toGridId(latIdx: number, lngIdx: number): string {
  return `${latIdx}_${lngIdx}`;
}

function getMissingGridRegions(missingCells: Array<{ latIdx: number; lngIdx: number }>):
  Array<{ minLatIdx: number; maxLatIdx: number; minLngIdx: number; maxLngIdx: number }> {
  if (missingCells.length === 0) return [];

  const keySet = new Set(missingCells.map((c) => toGridId(c.latIdx, c.lngIdx)));
  const visited = new Set<string>();
  const regions: Array<{ minLatIdx: number; maxLatIdx: number; minLngIdx: number; maxLngIdx: number }> = [];

  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const cell of missingCells) {
    const startKey = toGridId(cell.latIdx, cell.lngIdx);
    if (visited.has(startKey)) continue;

    let minLatIdx = cell.latIdx;
    let maxLatIdx = cell.latIdx;
    let minLngIdx = cell.lngIdx;
    let maxLngIdx = cell.lngIdx;

    const queue: Array<{ latIdx: number; lngIdx: number }> = [cell];
    visited.add(startKey);

    while (queue.length > 0) {
      const current = queue.shift()!;

      minLatIdx = Math.min(minLatIdx, current.latIdx);
      maxLatIdx = Math.max(maxLatIdx, current.latIdx);
      minLngIdx = Math.min(minLngIdx, current.lngIdx);
      maxLngIdx = Math.max(maxLngIdx, current.lngIdx);

      for (const [dLat, dLng] of neighbors) {
        const nextLatIdx = current.latIdx + dLat;
        const nextLngIdx = current.lngIdx + dLng;
        const nextKey = toGridId(nextLatIdx, nextLngIdx);

        if (!keySet.has(nextKey) || visited.has(nextKey)) continue;
        visited.add(nextKey);
        queue.push({ latIdx: nextLatIdx, lngIdx: nextLngIdx });
      }
    }

    regions.push({ minLatIdx, maxLatIdx, minLngIdx, maxLngIdx });
  }

  return regions;
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

const computeZoneCountFromEnergy = (energyValue: number): number => {
  const safeEnergy = clamp(Number(energyValue ?? 0), 0, 100);
  if (safeEnergy < 10) return 0;
  return Math.min(8, Math.floor(safeEnergy / 10));
};

const computeZoneRerollsFromEnergy = (energyValue: number): number => {
  const safeEnergy = clamp(Number(energyValue ?? 0), 0, 100);
  if (safeEnergy >= 100) return 5;
  if (safeEnergy >= 90) return 3;
  if (safeEnergy >= 80) return 1;
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

  const candidatesByTheme: Record<ZoneTheme, ThemeCandidate[]> = {
    forest: [],
    water: [],
    urban: [],
    meadow: [],
  };

  for (const cell of cells) {
    const themeScores = cell.theme_scores || {};
    const anchorPoints = cell.theme_anchor_points || {};

    const availableThemes = (Object.keys(themeScores) as ZoneTheme[])
      .filter((theme) => (themeScores[theme] || 0) >= MIN_THEME_CONFIDENCE);

    if (availableThemes.length === 0) {
      const fallbackDistance = distanceMeters(centerLat, centerLng, cell.center_lat, cell.center_lng);
      if (fallbackDistance > maxDistanceM) continue;

      candidatesByTheme[cell.theme].push({
        cellId: cell.id,
        theme: cell.theme,
        lat: cell.center_lat,
        lng: cell.center_lng,
        probability: Math.max(cell.theme_confidence || 0, MIN_THEME_CONFIDENCE),
        osmElementCount: cell.osm_element_count || 0,
      });
      continue;
    }

    const selectedTheme = pickThemeByWeightedProbability(availableThemes, themeScores, themePickRng);
    const anchor = anchorPoints[selectedTheme];
    const lat = Number(anchor?.lat ?? cell.center_lat);
    const lng = Number(anchor?.lng ?? cell.center_lng);
    const candidateDistance = distanceMeters(centerLat, centerLng, lat, lng);
    if (candidateDistance > maxDistanceM) continue;

    candidatesByTheme[selectedTheme].push({
      cellId: cell.id,
      theme: selectedTheme,
      lat,
      lng,
      probability: Number(themeScores[selectedTheme] || 0),
      osmElementCount: cell.osm_element_count || 0,
    });
  }

  for (const theme of Object.keys(candidatesByTheme) as ZoneTheme[]) {
    candidatesByTheme[theme].sort((a, b) => {
      const distA = distanceMeters(centerLat, centerLng, a.lat, a.lng);
      const distB = distanceMeters(centerLat, centerLng, b.lat, b.lng);
      if (distA !== distB) return distA - distB;
      if (b.probability !== a.probability) return b.probability - a.probability;
      return b.osmElementCount - a.osmElementCount;
    });

    if (randomize && candidatesByTheme[theme].length > 1) {
      const topWindowSize = Math.min(8, candidatesByTheme[theme].length);
      const topWindow = candidatesByTheme[theme].slice(0, topWindowSize);
      shuffleInPlace(topWindow, rng);
      candidatesByTheme[theme] = topWindow.concat(candidatesByTheme[theme].slice(topWindowSize));
    }
  }

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

  for (const theme of themes) {
    const themeCandidates = candidatesByTheme[theme];
    if (themeCandidates.length === 0) continue;

    for (const candidate of themeCandidates) {
      if (themeCount[theme] >= 1) break;
      if (addZoneCandidate(candidate, "base")) {
        break;
      }
    }
  }

  type ScoredCandidate = ThemeCandidate & { distanceToPlayer: number };
  const allCandidates: ScoredCandidate[] = [];
  for (const theme of themes) {
    for (const candidate of candidatesByTheme[theme]) {
      allCandidates.push({
        ...candidate,
        distanceToPlayer: distanceMeters(centerLat, centerLng, candidate.lat, candidate.lng),
      });
    }
  }

  allCandidates.sort((a, b) => {
    if (a.distanceToPlayer !== b.distanceToPlayer) return a.distanceToPlayer - b.distanceToPlayer;
    if (b.probability !== a.probability) return b.probability - a.probability;
    return b.osmElementCount - a.osmElementCount;
  });

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

    if (!isAllowedOrigin(req.headers.get("Origin"))) {
      return jsonResponse({ error: "Origin not allowed" }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as RequestBody;
    const authId = String(body.authId || "").trim();
    const providedEmail = normalizeEmail(body.userEmail);

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

    const hasProvidedPos = Number.isFinite(providedLat) && Number.isFinite(providedLng);
    const robot = robots as any;
    const currentEnergy = clamp(Number(robot?.energy ?? 70), 0, 100);
    const targetZoneCount = computeZoneCountFromEnergy(currentEnergy);
    const rerolls = computeZoneRerollsFromEnergy(currentEnergy);
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

    const dayKey = toDayKey();
    const authKeySuffix = authId.replace(/-/g, "");
    const queryStartTime = Date.now();

    if (targetZoneCount <= 0) {
      const { error: clearZonesError } = await adminClient
        .from("RobotPlantZone")
        .delete()
        .eq("day_generated", dayKey)
        .like("zone_key", `%:${authKeySuffix}`)
        .in("theme", ["forest", "urban", "water", "meadow"]);

      if (clearZonesError) {
        console.error("[robotPlantDailyZones] Failed to clear zones for low energy", clearZonesError);
      }

      return jsonResponse({
        success: true,
        cached: false,
        rasterBased: true,
        queryDurationMs: 0,
        zones: [],
      });
    }

    if (forceRegenerate && !isAdmin) {
      const { data: existingRegen, error: regenCheckError } = await adminClient
        .from("RobotPlantZoneGenerationLog")
        .select("id")
        .eq("auth_id", authId)
        .eq("day_key", dayKey)
        .maybeSingle();

      if (regenCheckError) {
        console.error("[robotPlantDailyZones] Failed to check daily regeneration limit:", regenCheckError);
        return jsonResponse({ error: "Failed to validate regeneration limit" }, 500);
      }

      if (existingRegen?.id) {
        return jsonResponse({
          success: false,
          error: "Zonen-Neugenerierung ist fuer normale Nutzer nur 1x pro Tag verfuegbar.",
        }, 429);
      }
    }

    // Force regeneration should fully replace today's zones.
    if (forceRegenerate) {
      const { error: deleteUserScopedError } = await adminClient
        .from("RobotPlantZone")
        .delete()
        .eq("day_generated", dayKey)
        .like("zone_key", `%:${authKeySuffix}`)
        .in("theme", ["forest", "urban", "water", "meadow"]);

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
        .in("theme", ["forest", "urban", "water", "meadow"]);

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
        .in("theme", ["forest", "urban", "water", "meadow"]);

      if (!existError && Array.isArray(existing) && existing.length >= targetZoneCount) {
        console.log(`[robotPlantDailyZones] Returning ${existing.length} cached zones for today`);
        return jsonResponse({
          success: true,
          cached: true,
          zones: existing.map((z) => ({
            id: z.id,
            theme: z.theme,
            centerLat: z.center_lat,
            centerLng: z.center_lng,
            radiusM: z.radius_m,
            zoneKey: z.zone_key,
            bonusMultiplier: z.zone_bonus_multiplier || 1.0,
          })),
        });
      }
    }

    // === RASTER-BASED ZONE GENERATION ===
    console.log(`[robotPlantDailyZones] Generating zones from raster grid for (${baseLat}, ${baseLng})`);

    const searchRadiusM = PLAYER_RADIUS_M;
    const cellIndices = getGridCellsInRadius(baseLat, baseLng, searchRadiusM);
    console.log(`[robotPlantDailyZones] Searching ${cellIndices.length} grid cells within ${searchRadiusM}m radius`);

    // Build bounding box range query (much more efficient than per-cell OR conditions)
    const minLatIdx = Math.min(...cellIndices.map(c => c.latIdx));
    const maxLatIdx = Math.max(...cellIndices.map(c => c.latIdx));
    const minLngIdx = Math.min(...cellIndices.map(c => c.lngIdx));
    const maxLngIdx = Math.max(...cellIndices.map(c => c.lngIdx));

    const fetchRasterCells = async (): Promise<RasterCell[]> => {
      const { data: rasterCells, error: rasterError } = await adminClient
        .from("GeoRasterCell")
        .select("id, grid_id, is_valid, theme, center_lat, center_lng, theme_confidence, dominant_osm_tags, theme_scores, theme_anchor_points, osm_element_count")
        .gte("grid_lat_idx", minLatIdx)
        .lte("grid_lat_idx", maxLatIdx)
        .gte("grid_lng_idx", minLngIdx)
        .lte("grid_lng_idx", maxLngIdx);

      if (rasterError) {
        console.error("[robotPlantDailyZones] Raster query error:", rasterError);
        throw new Error("Failed to query raster grid");
      }

      return (rasterCells || []) as RasterCell[];
    };

    let rasterRows: RasterCell[];
    try {
      rasterRows = await fetchRasterCells();
    } catch (fetchError) {
      const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      return jsonResponse({ error: errMsg }, 500);
    }

    const existingGridIds = new Set(rasterRows.map((row) => row.grid_id));
    let missingCells = cellIndices.filter((cell) => !existingGridIds.has(toGridId(cell.latIdx, cell.lngIdx)));
    let missingInitFailed = false;

    if (missingCells.length > 0) {
      const regions = getMissingGridRegions(missingCells);
      const regionsSortedByDistance = [...regions].sort((a, b) => {
        const centerA = getGridCellCenter(
          Math.floor((a.minLatIdx + a.maxLatIdx) / 2),
          Math.floor((a.minLngIdx + a.maxLngIdx) / 2),
        );
        const centerB = getGridCellCenter(
          Math.floor((b.minLatIdx + b.maxLatIdx) / 2),
          Math.floor((b.minLngIdx + b.maxLngIdx) / 2),
        );
        const distA = distanceMeters(baseLat, baseLng, centerA.lat, centerA.lng);
        const distB = distanceMeters(baseLat, baseLng, centerB.lat, centerB.lng);
        return distA - distB;
      });

      console.log(`[robotPlantDailyZones] Found ${missingCells.length} uncomputed cells in ${regions.length} missing region(s). Triggering on-demand initialization from near to far.`);

      try {
        for (const [index, region] of regionsSortedByDistance.entries()) {
          const bbox = getBoundsForGridRange(region.minLatIdx, region.maxLatIdx, region.minLngIdx, region.maxLngIdx);
          const initResult = await initializeGeoRasterCells(adminClient, bbox, {
            forceRefresh: false,
            trigger: `robotPlantDailyZones:${authId}:missing-region-${index + 1}/${regionsSortedByDistance.length}`,
          });
          console.log(`[robotPlantDailyZones] Initialized missing region ${index + 1}/${regionsSortedByDistance.length} with ${initResult.cellsCreated} cells in ${initResult.durationMs}ms`);
        }
      } catch (initError) {
        const initMessage = initError instanceof Error ? initError.message : String(initError);
        missingInitFailed = true;
        console.warn("[robotPlantDailyZones] On-demand raster initialization for missing cells failed, continuing with existing cells:", initMessage);
      }

      try {
        rasterRows = await fetchRasterCells();
      } catch (fetchError) {
        const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        if (!missingInitFailed) {
          return jsonResponse({ error: errMsg }, 500);
        }
        console.warn("[robotPlantDailyZones] Raster refresh after failed initialization also failed; using previously loaded rows:", errMsg);
      }

      const refreshedGridIds = new Set(rasterRows.map((row) => row.grid_id));
      missingCells = cellIndices.filter((cell) => !refreshedGridIds.has(toGridId(cell.latIdx, cell.lngIdx)));
      if (missingCells.length > 0) {
        console.warn(`[robotPlantDailyZones] ${missingCells.length} cells are still uncomputed after on-demand initialization.`);
      }
    }

    const cells = rasterRows.filter((row) => row.is_valid === true) as RasterCell[];
    const fallbackCells = rasterRows.filter((row) => row.is_valid !== true) as RasterCell[];
    const nearestValidDistance = cells.length > 0
      ? Math.min(...cells.map((cell) => distanceMeters(baseLat, baseLng, cell.center_lat, cell.center_lng)))
      : null;

    console.log(
      `[robotPlantDailyZones] Found ${cells.length} valid raster cells and ${rasterRows.length} computed cells in search range` +
      (nearestValidDistance !== null ? ` (nearest valid=${Math.round(nearestValidDistance)}m)` : ""),
    );

    if (cells.length === 0) {
      console.warn(`[robotPlantDailyZones] Raster initialization completed, but no usable raster cells were available near (${baseLat}, ${baseLng}).`);
      return jsonResponse({
        success: false,
        error: "No usable geo-raster data available for this location after initialization.",
        zones: [],
      }, 503);
    }

    // Select best zones from available cells based on current energy budget.
    const regenerationSeed = Date.now();
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

    return jsonResponse({
      success: true,
      cached: false,
      rasterBased: true,
      queryDurationMs: queryDuration,
      zones: (insertedZones || []).map((z) => ({
        id: z.id,
        theme: z.theme,
        centerLat: z.center_lat,
        centerLng: z.center_lng,
        radiusM: z.radius_m,
        zoneKey: z.zone_key,
        bonusMultiplier: z.zone_bonus_multiplier || 1.0,
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
