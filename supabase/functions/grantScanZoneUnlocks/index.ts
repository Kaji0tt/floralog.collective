import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EARTH_RADIUS_M = 6371000;

type RequestBody = {
  discoveryId?: string | null;
  plantId?: string | null;
  discoveryLocation?: string | null;
};

type DiscoveryRow = {
  id: string;
  auth_id: string;
  plant_id: string | null;
  discovery_location: string | null;
};

type PlantRow = {
  id: string;
  species_name: string | null;
};

type ZoneRow = {
  id: string;
  theme: string | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
};

type RewardRow = {
  id: string;
  name: string | null;
  display_name: string | null;
  value: string | null;
  image_url: string | null;
  type: string | null;
  requires_zone_theme?: string | null;
  requires_plant_id?: string | null;
  requires_plant_species?: string | null;
};

type ProfileRow = {
  display_name?: string | null;
  full_name?: string | null;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function parseLocation(location: string | null | undefined): { lat: number; lng: number } | null {
  if (!location) return null;
  const parts = location.split(",").map((part) => Number(part.trim()));
  if (parts.length < 2) return null;
  const [lat, lng] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function distanceM(first: { lat: number; lng: number }, second: { lat: number; lng: number }): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(second.lat - first.lat);
  const dLng = toRadians(second.lng - first.lng);
  const lat1 = toRadians(first.lat);
  const lat2 = toRadians(second.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

function normalizeText(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "grantScanZoneUnlocks");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase service not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const authId = userData.user.id;
    const userEmail = userData.user.email || "";

    let body: RequestBody = {};
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      body = {};
    }

    let discovery: DiscoveryRow | null = null;
    const discoveryId = String(body.discoveryId || "").trim();

    if (discoveryId) {
      const { data: discoveryData, error: discoveryError } = await adminClient
        .from("UserPlantDiscovery")
        .select("id, auth_id, plant_id, discovery_location")
        .eq("id", discoveryId)
        .maybeSingle<DiscoveryRow>();

      if (discoveryError || !discoveryData) {
        return jsonResponse({ success: true, unlocked: [] });
      }

      if (discoveryData.auth_id !== authId) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      discovery = discoveryData;
    }

    const effectivePlantId = String(discovery?.plant_id || body.plantId || "").trim();
    const effectiveLocation = String(discovery?.discovery_location || body.discoveryLocation || "").trim();

    if (!effectivePlantId || !effectiveLocation) {
      return jsonResponse({ success: true, unlocked: [] });
    }

    const coords = parseLocation(effectiveLocation);
    if (!coords) {
      return jsonResponse({ success: true, unlocked: [] });
    }

    const { data: plant, error: plantError } = await adminClient
      .from("Plant")
      .select("id, species_name")
      .eq("id", effectivePlantId)
      .maybeSingle<PlantRow>();

    if (plantError || !plant) {
      return jsonResponse({ success: true, unlocked: [] });
    }

    const dayKey = new Date().toISOString().slice(0, 10);
    const authKeySuffix = authId.replace(/-/g, "");

    const { data: zones, error: zoneError } = await adminClient
      .from("RobotPlantZone")
      .select("id, theme, center_lat, center_lng, radius_m")
      .eq("is_active", true)
      .eq("day_generated", dayKey)
      .like("zone_key", `%:${authKeySuffix}`);

    if (zoneError) {
      return jsonResponse({ success: true, unlocked: [] });
    }

    const matchedZone = (zones || [])
      .filter((zone): zone is ZoneRow => Number.isFinite(Number(zone.center_lat)) && Number.isFinite(Number(zone.center_lng)))
      .map((zone) => ({
        ...zone,
        distance: distanceM(coords, {
          lat: Number(zone.center_lat),
          lng: Number(zone.center_lng),
        }),
      }))
      .filter((zone) => zone.distance <= Number(zone.radius_m ?? 150))
      .sort((left, right) => left.distance - right.distance)[0] || null;

    const matchedTheme = normalizeText(matchedZone?.theme);
    if (!matchedTheme) {
      return jsonResponse({ success: true, unlocked: [] });
    }

    const { data: rewards, error: rewardsError } = await adminClient
      .from("Rewards")
      .select("id, name, display_name, value, image_url, type, requires_zone_theme, requires_plant_id, requires_plant_species")
      .not("requires_zone_theme", "is", null);

    if (rewardsError) {
      return jsonResponse({ success: false, error: rewardsError.message }, 500);
    }

    const normalizedSpeciesName = normalizeText(plant.species_name);

    const matchingRewards = ((rewards || []) as RewardRow[]).filter((reward) => {
      const requiredTheme = normalizeText(reward.requires_zone_theme);
      if (!requiredTheme || requiredTheme !== matchedTheme) {
        return false;
      }

      const requiredPlantId = String(reward.requires_plant_id || "").trim();
      const requiredPlantSpecies = normalizeText(reward.requires_plant_species);
      const hasPlantCondition = !!requiredPlantId || !!requiredPlantSpecies;
      if (!hasPlantCondition) {
        return false;
      }

      const plantIdMatches = !!requiredPlantId && requiredPlantId === effectivePlantId;
      const speciesMatches = !!requiredPlantSpecies && requiredPlantSpecies === normalizedSpeciesName;

      return plantIdMatches || speciesMatches;
    });

    if (matchingRewards.length === 0) {
      return jsonResponse({ success: true, unlocked: [] });
    }

    const rewardIds = matchingRewards.map((reward) => reward.id);
    const { data: existingUserRewards } = await adminClient
      .from("UserRewards")
      .select("reward_id")
      .eq("auth_id", authId)
      .in("reward_id", rewardIds);

    const unlockedIds = new Set((existingUserRewards || []).map((row) => row.reward_id));
    const rewardsToInsert = matchingRewards.filter((reward) => !unlockedIds.has(reward.id));

    if (rewardsToInsert.length === 0) {
      return jsonResponse({ success: true, unlocked: [] });
    }

    const { data: profile } = await adminClient
      .from("PublicProfile")
      .select("display_name, full_name")
      .eq("auth_id", authId)
      .maybeSingle<ProfileRow>();

    const displayName = profile?.display_name || profile?.full_name || userEmail;
    const nowIso = new Date().toISOString();

    const { error: insertError } = await adminClient.from("UserRewards").insert(
      rewardsToInsert.map((reward) => ({
        reward_id: reward.id,
        reward_name: reward.display_name || reward.name || "Belohnung",
        auth_id: authId,
        user_email: userEmail,
        user_name: displayName,
        unlocked_date: nowIso,
      })),
    );

    if (insertError) {
      return jsonResponse({ success: false, error: insertError.message }, 500);
    }

    return jsonResponse({
      success: true,
      unlocked: rewardsToInsert.map((reward) => ({
        reward_id: reward.id,
        display_name: reward.display_name || reward.name || "Belohnung",
        value: reward.value,
        image_url: reward.image_url,
        type: reward.type,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});