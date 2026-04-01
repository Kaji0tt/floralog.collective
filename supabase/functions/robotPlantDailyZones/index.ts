import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Phase 4: Raster-Based Zone Generation
// Uses pre-computed GeoRasterCell grid instead of live Overpass API calls
// Guarantees <100ms response time with consistent data quality

type ZoneTheme = "forest" | "urban" | "water" | "meadow";

interface RequestBody {
  authId?: string;
  userEmail?: string | null;
  latitude?: number;
  longitude?: number;
  forceRegenerate?: boolean;
}

interface RasterCell {
  id: string;
  theme: ZoneTheme;
  center_lat: number;
  center_lng: number;
  theme_confidence: number;
  dominant_osm_tags: Record<string, string>;
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
  const gridResolution = 0.00636; // degrees per cell (approx 707m)
  return {
    latIdx: Math.floor(lat / gridResolution),
    lngIdx: Math.floor(lng / gridResolution),
  };
}

/**
 * Get all grid cell indices within a search radius
 */
function getGridCellsInRadius(centerLat: number, centerLng: number, radiusM: number): Array<{ latIdx: number; lngIdx: number }> {
  const gridResolution = 0.00636;
  const radiusInDegrees = radiusM / 111000; // Rough conversion: 1° ≈ 111km
  
  const centerCell = getGridCellCoordinates(centerLat, centerLng);
  const cellOffset = Math.ceil(radiusInDegrees / gridResolution);
  
  const cells: Array<{ latIdx: number; lngIdx: number }> = [];
  for (let latIdx = centerCell.latIdx - cellOffset; latIdx <= centerCell.latIdx + cellOffset; latIdx++) {
    for (let lngIdx = centerCell.lngIdx - cellOffset; lngIdx <= centerCell.lngIdx + cellOffset; lngIdx++) {
      cells.push({ latIdx, lngIdx });
    }
  }
  return cells;
}

/**
 * Select best zones from available raster cells
 * Strategy: Pick 1-2 best zones per theme based on:
 * 1. Distance from center (nearer = better)
 * 2. Theme confidence (higher = better)
 * 3. No overlaps
 */
function selectBestZones(cells: RasterCell[], centerLat: number, centerLng: number): GeneratedZone[] {
  const cellsByTheme: Record<ZoneTheme, RasterCell[]> = {
    forest: [],
    water: [],
    urban: [],
    meadow: [],
  };

  // Group cells by theme and sort by distance
  for (const cell of cells) {
    cellsByTheme[cell.theme].push(cell);
  }

  // Sort each theme group by distance
  for (const theme of Object.keys(cellsByTheme) as ZoneTheme[]) {
    cellsByTheme[theme].sort((a, b) => {
      const distA = distanceMeters(centerLat, centerLng, a.center_lat, a.center_lng);
      const distB = distanceMeters(centerLat, centerLng, b.center_lat, b.center_lng);
      return distA - distB;
    });
  }

  const selectedZones: GeneratedZone[] = [];
  const RADIUS_M = 120;
  const dayKey = toDayKey();

  /**
   * Check if a candidate zone would overlap with any already-selected zone
   */
  const overlapsExisting = (lat: number, lng: number): boolean => {
    for (const zone of selectedZones) {
      const dist = distanceMeters(lat, lng, zone.centerLat, zone.centerLng);
      const minSeparation = RADIUS_M + RADIUS_M; // No overlapping radii
      if (dist < minSeparation) {
        console.log(`[ZoneOverlap] Candidate at (${lat.toFixed(4)}, ${lng.toFixed(4)}) overlaps existing zone at (${zone.centerLat.toFixed(4)}, ${zone.centerLng.toFixed(4)}) [dist=${dist.toFixed(0)}m < ${minSeparation}m]`);
        return true;
      }
    }
    return false;
  };

  // Select up to 1 zone per theme (goal: 3-4 zones total, 1 per theme where available)
  const themes: ZoneTheme[] = ["forest", "water", "urban", "meadow"];
  const themeCount: Record<ZoneTheme, number> = { forest: 0, water: 0, urban: 0, meadow: 0 };

  for (const theme of themes) {
    const themeCells = cellsByTheme[theme];
    if (themeCells.length === 0) continue;

    // Try to pick best candidate for this theme
    for (const cell of themeCells) {
      if (themeCount[theme] >= 1) break; // Max 1 per theme
      if (!overlapsExisting(cell.center_lat, cell.center_lng)) {
        selectedZones.push({
          id: cell.id,
          theme: cell.theme,
          centerLat: cell.center_lat,
          centerLng: cell.center_lng,
          radiusM: RADIUS_M,
          zoneKey: `${dayKey}-${cell.theme}-${cell.id.substring(0, 8)}`,
          confidence: cell.theme_confidence,
          bonusMultiplier: 1.1,
        });
        themeCount[theme] += 1;
        console.log(`[ZoneSelection] Selected ${theme} zone at (${cell.center_lat.toFixed(4)}, ${cell.center_lng.toFixed(4)}) with confidence ${cell.theme_confidence}`);
        break;
      }
    }
  }

  console.log(`[ZoneSelection] Selected ${selectedZones.length} zones from ${cells.length} available raster cells`);
  return selectedZones;
}

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
    const queryStartTime = Date.now();

    // Check for existing cached zones
    if (!forceRegenerate) {
      const { data: existing, error: existError } = await adminClient
        .from("RobotPlantZone")
        .select("*")
        .eq("day_generated", dayKey)
        .in("theme", ["forest", "urban", "water", "meadow"]);

      if (!existError && Array.isArray(existing) && existing.length >= 3) {
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
            geometry: z.geometry || null,
            bonusMultiplier: z.zone_bonus_multiplier || 1.0,
          })),
        });
      }
    }

    // === RASTER-BASED ZONE GENERATION ===
    console.log(`[robotPlantDailyZones] Generating zones from raster grid for (${baseLat}, ${baseLng})`);

    const searchRadiusM = 5000; // 5km search radius
    const cellIndices = getGridCellsInRadius(baseLat, baseLng, searchRadiusM);
    console.log(`[robotPlantDailyZones] Searching ${cellIndices.length} grid cells within ${searchRadiusM}m radius`);

    // Build SQL query for all cells in the search area
    const gridConditions = cellIndices
      .map((cell) => `(grid_lat_idx = ${cell.latIdx} and grid_lng_idx = ${cell.lngIdx})`)
      .join(" or ");

    const { data: rasterCells, error: rasterError } = await adminClient
      .from("GeoRasterCell")
      .select("id, theme, center_lat, center_lng, theme_confidence, dominant_osm_tags")
      .or(gridConditions)
      .eq("is_valid", true);

    if (rasterError) {
      console.error("[robotPlantDailyZones] Raster query error:", rasterError);
      return jsonResponse({ error: "Failed to query raster grid" }, 500);
    }

    const cells = (rasterCells || []) as RasterCell[];
    console.log(`[robotPlantDailyZones] Found ${cells.length} valid raster cells`);

    if (cells.length === 0) {
      console.warn(`[robotPlantDailyZones] No raster cells found near (${baseLat}, ${baseLng}). Raster grid may not be populated yet.`);
      return jsonResponse({
        success: false,
        error: "No geo-raster data available for this location. Grid initialization pending.",
        zones: [],
      }, 503);
    }

    // Select best zones from available cells
    const selectedZones = selectBestZones(cells, baseLat, baseLng);

    // Insert generated zones into RobotPlantZone table
    const zoneRecords = selectedZones.map((zone) => ({
      zone_key: zone.zoneKey,
      title: `${zone.theme.charAt(0).toUpperCase() + zone.theme.slice(1)} Zone`,
      theme: zone.theme,
      center_lat: zone.centerLat,
      center_lng: zone.centerLng,
      radius_m: zone.radiusM,
      zone_bonus_multiplier: zone.bonusMultiplier,
      is_active: true,
      valid_from: new Date().toISOString(),
      valid_to: new Date(Date.now() + 86400000).toISOString(),
      osm_id: `raster-${zone.id}`,
      source_polygon_confidence: zone.confidence,
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
        geometry: z.geometry || null,
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
