import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CONFIG = {
  dailyZoneCount: 4,
  searchRadiusM: 5000,
  zoneRadiusMinM: 180,
  zoneRadiusMaxM: 320,
  candidateAttempts: 10,
  classificationRadiusM: 400,
  maxOsmCallsPerGeneration: 6,
  positionRoundingDecimals: 3,
  themes: ["forest", "urban", "water", "meadow"],
  themeBonusByTheme: {
    forest: 1.16,
    urban: 1.12,
    water: 1.2,
    meadow: 1.14,
  } as Record<string, number>,
};

type ZoneTheme = "forest" | "urban" | "water" | "meadow";

type RequestBody = {
  latitude?: number;
  longitude?: number;
  forceRegenerate?: boolean;
};

function getAccessTokenFromAuthHeader(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return header;
}

function toDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function roundPosition(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function destinationPointMeters(
  lat: number,
  lng: number,
  distanceM: number,
  bearingRad: number,
): { lat: number; lng: number } {
  const earthRadiusM = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDistance = distanceM / earthRadiusM;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinAng = Math.sin(angularDistance);
  const cosAng = Math.cos(angularDistance);

  const targetLat = Math.asin(
    sinLat * cosAng + cosLat * sinAng * Math.cos(bearingRad),
  );
  const targetLng =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * sinAng * cosLat,
      cosAng - sinLat * Math.sin(targetLat),
    );

  return {
    lat: (targetLat * 180) / Math.PI,
    lng: (targetLng * 180) / Math.PI,
  };
}

function pickFallbackTheme(seedKey: string): ZoneTheme {
  const idx = hashString(seedKey) % CONFIG.themes.length;
  return CONFIG.themes[idx] as ZoneTheme;
}

function parseThemeFromTags(tags: Record<string, string> | undefined): ZoneTheme | null {
  if (!tags) return null;
  const natural = (tags.natural || "").toLowerCase();
  const landuse = (tags.landuse || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();
  const water = (tags.water || "").toLowerCase();
  const waterway = (tags.waterway || "").toLowerCase();

  if (natural === "water" || water.length > 0 || waterway.length > 0) return "water";
  if (landuse === "forest" || natural === "wood") return "forest";
  if (landuse === "meadow" || natural === "grassland" || leisure === "park") return "meadow";
  if (["residential", "industrial", "commercial", "retail"].includes(landuse)) return "urban";

  return null;
}

async function classifyThemeViaOverpass(
  latitude: number,
  longitude: number,
  radiusM: number,
): Promise<ZoneTheme | null> {
  const query = `
[out:json][timeout:15];
(
  nwr(around:${radiusM},${latitude},${longitude})["natural"];
  nwr(around:${radiusM},${latitude},${longitude})["landuse"];
  nwr(around:${radiusM},${latitude},${longitude})["waterway"];
  nwr(around:${radiusM},${latitude},${longitude})["water"];
  nwr(around:${radiusM},${latitude},${longitude})["leisure"];
);
out tags 40;
`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });

  if (!response.ok) return null;

  const payload = await response.json();
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];

  const score: Record<ZoneTheme, number> = {
    forest: 0,
    urban: 0,
    water: 0,
    meadow: 0,
  };

  for (const element of elements) {
    const parsed = parseThemeFromTags(element?.tags);
    if (parsed) score[parsed] += 1;
  }

  const sorted = Object.entries(score)
    .sort((a, b) => b[1] - a[1]);

  if (!sorted[0] || sorted[0][1] <= 0) return null;
  return sorted[0][0] as ZoneTheme;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const accessToken = getAccessTokenFromAuthHeader(authHeader);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as RequestBody;
    const forceRegenerate = body?.forceRegenerate === true;

    const { data: robotPlantRows, error: robotPlantReadError } = await adminClient
      .from("RobotPlant")
      .select("id, last_valid_geo_lat, last_valid_geo_lng")
      .eq("auth_id", userData.user.id)
      .limit(1);

    if (robotPlantReadError) {
      console.error("[robotPlantDailyZones] failed reading RobotPlant", robotPlantReadError);
      return new Response(JSON.stringify({ error: "Failed to load robot plant state" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const existingPlant = robotPlantRows?.[0] || null;
    const providedLat = Number(body.latitude);
    const providedLng = Number(body.longitude);

    const hasProvidedPosition = Number.isFinite(providedLat) && Number.isFinite(providedLng);
    const hasStoredPosition =
      existingPlant &&
      Number.isFinite(Number(existingPlant.last_valid_geo_lat)) &&
      Number.isFinite(Number(existingPlant.last_valid_geo_lng));

    if (!hasProvidedPosition && !hasStoredPosition) {
      return new Response(JSON.stringify({ error: "latitude and longitude are required for first generation" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const baseLat = hasProvidedPosition
      ? roundPosition(providedLat, CONFIG.positionRoundingDecimals)
      : Number(existingPlant.last_valid_geo_lat);
    const baseLng = hasProvidedPosition
      ? roundPosition(providedLng, CONFIG.positionRoundingDecimals)
      : Number(existingPlant.last_valid_geo_lng);

    await adminClient.from("RobotPlant").upsert({
      auth_id: userData.user.id,
      last_valid_geo_lat: roundPosition(baseLat, CONFIG.positionRoundingDecimals),
      last_valid_geo_lng: roundPosition(baseLng, CONFIG.positionRoundingDecimals),
      last_valid_geo_at: new Date().toISOString(),
    }, { onConflict: "auth_id" });

    const dayKey = toDayKey();

    if (!forceRegenerate) {
      const { data: existingStates, error: existingStatesError } = await adminClient
        .from("RobotPlantUserZoneState")
        .select("day_key, scans_in_zone, unique_species_count, zone:RobotPlantZone(id, zone_key, title, theme, center_lat, center_lng, radius_m, zone_bonus_multiplier)")
        .eq("auth_id", userData.user.id)
        .eq("day_key", dayKey)
        .limit(CONFIG.dailyZoneCount);

      if (!existingStatesError && Array.isArray(existingStates) && existingStates.length >= CONFIG.dailyZoneCount) {
        const zones = existingStates
          .map((entry) => ({
            id: entry.zone?.id,
            zoneKey: entry.zone?.zone_key,
            title: entry.zone?.title,
            theme: entry.zone?.theme,
            centerLat: entry.zone?.center_lat,
            centerLng: entry.zone?.center_lng,
            radiusM: entry.zone?.radius_m,
            zoneBonusMultiplier: Number(entry.zone?.zone_bonus_multiplier || 1),
            scansInZone: entry.scans_in_zone,
            uniqueSpeciesCount: entry.unique_species_count,
          }))
          .filter((entry) => !!entry.id);

        return new Response(JSON.stringify({ ok: true, generated: false, dayKey, zones }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const seed = hashString(`${userData.user.id}:${dayKey}`);
    const rng = createRng(seed);

    const generatedZones: Array<Record<string, unknown>> = [];
    let osmCalls = 0;

    for (let i = 0; i < CONFIG.candidateAttempts && generatedZones.length < CONFIG.dailyZoneCount; i += 1) {
      const distance = 450 + rng() * (CONFIG.searchRadiusM - 450);
      const bearing = rng() * Math.PI * 2;
      const center = destinationPointMeters(baseLat, baseLng, distance, bearing);
      const roundedCenterLat = roundPosition(center.lat, CONFIG.positionRoundingDecimals);
      const roundedCenterLng = roundPosition(center.lng, CONFIG.positionRoundingDecimals);

      const zoneRadius = Math.round(
        CONFIG.zoneRadiusMinM + rng() * (CONFIG.zoneRadiusMaxM - CONFIG.zoneRadiusMinM),
      );

      let theme: ZoneTheme | null = null;
      if (osmCalls < CONFIG.maxOsmCallsPerGeneration) {
        try {
          theme = await classifyThemeViaOverpass(
            roundedCenterLat,
            roundedCenterLng,
            CONFIG.classificationRadiusM,
          );
          osmCalls += 1;
        } catch (error) {
          console.warn("[robotPlantDailyZones] OSM classification failed", error);
        }
      }

      const finalTheme = theme || pickFallbackTheme(`${seed}:${i}`);
      const zoneKey = `daily:${userData.user.id}:${dayKey}:${generatedZones.length}`;

      const zoneRecord = {
        zone_key: zoneKey,
        title: `${finalTheme[0].toUpperCase()}${finalTheme.slice(1)} Zone`,
        theme: finalTheme,
        center_lat: roundedCenterLat,
        center_lng: roundedCenterLng,
        radius_m: zoneRadius,
        zone_bonus_multiplier: CONFIG.themeBonusByTheme[finalTheme] || 1,
        is_active: true,
        valid_from: `${dayKey}T00:00:00.000Z`,
        valid_to: `${dayKey}T23:59:59.999Z`,
      };

      const { data: insertedZone, error: insertZoneError } = await adminClient
        .from("RobotPlantZone")
        .upsert(zoneRecord, { onConflict: "zone_key" })
        .select("id, zone_key, title, theme, center_lat, center_lng, radius_m, zone_bonus_multiplier")
        .single();

      if (insertZoneError || !insertedZone?.id) {
        console.error("[robotPlantDailyZones] failed creating zone", insertZoneError);
        continue;
      }

      await adminClient
        .from("RobotPlantUserZoneState")
        .upsert({
          auth_id: userData.user.id,
          zone_id: insertedZone.id,
          day_key: dayKey,
        }, { onConflict: "auth_id,zone_id,day_key" });

      generatedZones.push({
        id: insertedZone.id,
        zoneKey: insertedZone.zone_key,
        title: insertedZone.title,
        theme: insertedZone.theme,
        centerLat: insertedZone.center_lat,
        centerLng: insertedZone.center_lng,
        radiusM: insertedZone.radius_m,
        zoneBonusMultiplier: Number(insertedZone.zone_bonus_multiplier || 1),
        scansInZone: 0,
        uniqueSpeciesCount: 0,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      generated: true,
      dayKey,
      zones: generatedZones,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("[robotPlantDailyZones] unexpected error", error);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
