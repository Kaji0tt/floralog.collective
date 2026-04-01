import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Phase 3.2: Polygon-aware zone generation with OSM geometry
type ZoneTheme = "forest" | "urban" | "water" | "meadow";

interface RequestBody {
  authId?: string;
  userEmail?: string | null;
  latitude?: number;
  longitude?: number;
  forceRegenerate?: boolean;
}

interface OSMElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  members?: Array<{ ref: number; type: string; role: string }>;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

interface CandidateZone {
  osmId: string;
  theme: ZoneTheme;
  centerLat: number;
  centerLng: number;
  radiusM?: number;
  polygonGeometry?: string; // GeoJSON as WKT or JSON string
  sourceAreaM2?: number;
  confidence: number;
  distanceFromm: number;
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

function parseThemeFromTags(tags: Record<string, string> | undefined): ZoneTheme | null {
  if (!tags) return null;
  const natural = (tags.natural || "").toLowerCase();
  const landuse = (tags.landuse || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();
  const water = (tags.water || "").toLowerCase();
  const waterway = (tags.waterway || "").toLowerCase();

  if (["water", "riverbank"].includes(natural) || water.length > 0 || ["river", "stream", "canal"].includes(waterway)) {
    return "water";
  }
  if (["forest", "wood"].includes(natural) || landuse === "forest") return "forest";
  if (["meadow", "grassland"].includes(natural) || landuse === "meadow" || leisure === "park") return "meadow";
  if (["residential", "industrial", "commercial", "retail"].includes(landuse)) return "urban";
  return null;
}

function generateFallbackCandidates(
  latitude: number,
  longitude: number,
  radiusM: number,
  theme: ZoneTheme,
): CandidateZone[] {
  // Generate deterministic pseudo-zones based on lat/lng/theme seed
  // This ensures every user in the same area gets similar fallback zones
  const candidates: CandidateZone[] = [];
  
  // Use theme + position as seed for deterministic ordering
  const seed = (theme.charCodeAt(0) + Math.floor(latitude * 100) + Math.floor(longitude * 100)) % 4;
  
  // Generate 1-2 fallback candidates per theme at fixed offsets
  // This ensures variety while being deterministic
  const angles = [seed * 90, (seed + 2) * 90]; // Two zones at 90° apart
  const distanceFromCenter = radiusM * 0.6;
  
  for (let i = 0; i < 2; i++) {
    const angleRad = (angles[i] * Math.PI) / 180;
    const offsetLat = (distanceFromCenter / 111000) * Math.cos(angleRad);
    const offsetLng = (distanceFromCenter / (111000 * Math.cos((latitude * Math.PI) / 180))) * Math.sin(angleRad);
    
    candidates.push({
      osmId: `fallback-${theme}-${i}`,
      theme,
      centerLat: latitude + offsetLat,
      centerLng: longitude + offsetLng,
      confidence: 0.5, // Lower confidence for fallback
      distanceFromm: distanceFromCenter,
    });
  }
  
  console.log(`[OSM Fallback] Generated ${candidates.length} deterministic fallback candidates for ${theme}`);
  return candidates;
}

async function queryOverpassForTheme(
  latitude: number,
  longitude: number,
  radiusM: number,
  theme: ZoneTheme,
  timeoutMs: number,
): Promise<CandidateZone[]> {
  let query = "";
  if (theme === "water") {
    query = `
[out:json][timeout:8];
(
  way(around:${radiusM},${latitude},${longitude})["natural"~"water|riverbank"];
  way(around:${radiusM},${latitude},${longitude})["waterway"];
  relation(around:${radiusM},${latitude},${longitude})["natural"="water"];
  relation(around:${radiusM},${latitude},${longitude})["waterway"];
);
out center geom;
`;
  } else if (theme === "forest") {
    query = `
[out:json][timeout:8];
(
  way(around:${radiusM},${latitude},${longitude})["natural"~"forest|wood"];
  way(around:${radiusM},${latitude},${longitude})["landuse"="forest"];
  relation(around:${radiusM},${latitude},${longitude})["natural"~"forest|wood"];
);
out center geom;
`;
  } else if (theme === "meadow") {
    query = `
[out:json][timeout:8];
(
  way(around:${radiusM},${latitude},${longitude})["natural"~"meadow|grassland"];
  way(around:${radiusM},${latitude},${longitude})["leisure"="park"];
  relation(around:${radiusM},${latitude},${longitude})["natural"~"meadow|grassland"];
);
out center geom;
`;
  } else if (theme === "urban") {
    query = `
[out:json][timeout:8];
(
  way(around:${radiusM},${latitude},${longitude})["landuse"~"residential|industrial|commercial|retail"];
  relation(around:${radiusM},${latitude},${longitude})["landuse"~"residential|industrial|commercial|retail"];
);
out center geom;
`;
  }

  if (!query) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    console.log(`[OSM] Querying ${theme} with radius ${radiusM}m around ${latitude}, ${longitude}`);
    const startTime = Date.now();

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      signal: controller.signal,
    });

    const duration = Date.now() - startTime;
    clearTimeout(timer);

    console.log(`[OSM] Response received in ${duration}ms with status ${response.status}`);

    if (!response.ok) {
      console.warn(`[OSM] Non-OK response for ${theme}: ${response.status}. Using fallback candidates.`);
      // Fallback: generate deterministic pseudo-zones
      return generateFallbackCandidates(latitude, longitude, radiusM, theme);
    }

    const payload = await response.json();
    const elements: OSMElement[] = Array.isArray(payload?.elements) ? payload.elements : [];

    console.log(`[OSM] Found ${elements.length} elements for ${theme}`);

    const candidates: CandidateZone[] = [];
    for (const elem of elements.slice(0, 5)) {
      // Limit per query
      // Try to extract center: prefer center.lat/lon, then lat/lon, then geometry[0]
      let centerLat = elem.center?.lat || elem.lat;
      let centerLng = elem.center?.lon || elem.lon;
      
      if (typeof centerLat !== "number" || typeof centerLng !== "number") {
        // Fallback: use first point from geometry array
        if (Array.isArray(elem.geometry) && elem.geometry.length > 0) {
          centerLat = elem.geometry[0]?.lat;
          centerLng = elem.geometry[0]?.lon;
          if (typeof centerLat !== "number" || typeof centerLng !== "number") {
            console.log(`[OSM Debug] Element ${elem.id} has no valid center. Type: ${elem.type}, has_center: ${!!elem.center}, has_lat: ${typeof elem.lat}, has_geometry: ${Array.isArray(elem.geometry)}`);
            continue;
          }
        } else {
          continue;
        }
      }

      const dist = distanceMeters(latitude, longitude, centerLat, centerLng);
      if (dist > radiusM) continue;

      candidates.push({
        osmId: `${elem.type[0]}-${elem.id}`,
        theme,
        centerLat,
        centerLng,
        confidence: 0.8,
        distanceFromm: dist,
      });
    }

    console.log(`[OSM] Extracted ${candidates.length} valid candidates for ${theme}`);
    return candidates.length > 0 ? candidates : generateFallbackCandidates(latitude, longitude, radiusM, theme);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[OSM] Error querying ${theme}: ${errMsg}. Using fallback candidates.`);
    return generateFallbackCandidates(latitude, longitude, radiusM, theme);
  }
}

function samplePointInCircle(centerLat: number, centerLng: number, radiusM: number, rng: () => number): {
  lat: number;
  lng: number;
} {
  const r = radiusM * Math.sqrt(rng());
  const theta = rng() * 2 * Math.PI;

  const latOffset = (r / 6371000) * (180 / Math.PI);
  const lngOffset = (latOffset / Math.cos((centerLat * Math.PI) / 180));

  return {
    lat: centerLat + latOffset * Math.cos(theta),
    lng: centerLng + lngOffset * Math.sin(theta),
  };
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
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

    // Check for existing zones
    if (!forceRegenerate) {
      const { data: existing, error: existError } = await adminClient
        .from("RobotPlantZone")
        .select("*")
        .eq("day_generated", dayKey)
        .in("theme", ["forest", "urban", "water", "meadow"]);

      if (!existError && Array.isArray(existing) && existing.length >= 3) {
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

    // Generate fresh zones: query OSM for each theme
    console.log(`[robotPlantDailyZones] Generating fresh zones for ${baseLat}, ${baseLng}`);
    const themes: ZoneTheme[] = ["forest", "water", "urban", "meadow"];
    const allCandidates: Record<ZoneTheme, CandidateZone[]> = {
      forest: [],
      urban: [],
      water: [],
      meadow: [],
    };

    // Search radius: 2500m (from frontend config, hardcoded here since Edge Functions can't import frontend code)
    const searchRadiusM = 2500;

    // Query each theme sequentially (not in parallel)
    for (const theme of themes) {
      console.log(`[robotPlantDailyZones] Querying OSM for theme: ${theme}`);
      const startTime = Date.now();
      const candidates = await queryOverpassForTheme(baseLat, baseLng, searchRadiusM, theme, 8000);
      const duration = Date.now() - startTime;
      console.log(`[robotPlantDailyZones] OSM query for ${theme} completed in ${duration}ms, found ${candidates.length} candidates`);
      allCandidates[theme] = candidates.sort((a, b) => a.distanceFromm - b.distanceFromm).slice(0, 2);
    }

    // Select 3-4 zones, 1-2 per theme — with overlap check
    console.log(`[robotPlantDailyZones] Selecting zones from candidates`);
    const selectedZones: CandidateZone[] = [];
    const themeUsed: Record<ZoneTheme, number> = { forest: 0, urban: 0, water: 0, meadow: 0 };

    // Returns true if candidate overlaps any already-selected zone
    const overlapsExisting = (cand: CandidateZone): boolean => {
      for (const sel of selectedZones) {
        const dLat = (cand.centerLat - sel.centerLat) * Math.PI / 180;
        const dLng = (cand.centerLng - sel.centerLng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(sel.centerLat * Math.PI / 180) *
          Math.cos(cand.centerLat * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const distM = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const minSeparation = (cand.radiusM || 120) + (sel.radiusM || 120);
        if (distM < minSeparation) {
          console.log(`[ZoneOverlap] Skipping ${cand.theme} candidate (${distM.toFixed(0)}m < ${minSeparation}m separation from ${sel.theme})`);
          return true;
        }
      }
      return false;
    };

    for (const theme of themes) {
      // Try each candidate for the theme until one doesn't overlap
      for (const candidate of allCandidates[theme]) {
        if (themeUsed[theme] >= 1) break;
        if (!overlapsExisting(candidate)) {
          selectedZones.push(candidate);
          themeUsed[theme] += 1;
          break;
        }
      }
    }

    console.log(`[robotPlantDailyZones] Selected ${selectedZones.length} zones for insertion`);

    // Insert zones
    const zoneRecords = selectedZones.map((cand) => ({
      zone_key: `${dayKey}-${cand.theme}-${Math.random().toString(36).slice(2, 8)}`,
      title: `${cand.theme.charAt(0).toUpperCase() + cand.theme.slice(1)} Zone`,
      theme: cand.theme,
      center_lat: cand.centerLat,
      center_lng: cand.centerLng,
      radius_m: 120, // Default fallback radius
      zone_bonus_multiplier: 1.1,
      is_active: true,
      valid_from: new Date().toISOString(),
      valid_to: new Date(Date.now() + 86400000).toISOString(),
      osm_id: cand.osmId,
      source_polygon_confidence: cand.confidence,
      day_generated: dayKey,
    }));

    console.log(`[robotPlantDailyZones] Inserting ${zoneRecords.length} zone records`);
    const { data: insertedZones, error: insertError } = await adminClient.from("RobotPlantZone").insert(zoneRecords).select("*");

    if (insertError) {
      console.error("[robotPlantDailyZones] Insert error:", insertError);
      return jsonResponse({ error: "Failed to generate zones" }, 500);
    }

    console.log(`[robotPlantDailyZones] Successfully inserted ${insertedZones?.length || 0} zones`);

    // Response
    return jsonResponse({
      success: true,
      cached: false,
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
