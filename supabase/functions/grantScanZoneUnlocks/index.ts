import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import proj4 from "https://esm.sh/proj4@2.15.0";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EARTH_RADIUS_M = 6371000;
const AREA_SIZE_M = 100;

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
  genus_category: string | null;
  genus_number: number | null;
};

type PlantGenusRow = {
  id: string;
  genus_name: string | null;
  scientific_genus: string | null;
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
  requires_plant_species_id?: string | null;
  requires_plant_genus_id?: string | null;
};

type ProfileRow = {
  display_name?: string | null;
  full_name?: string | null;
};

type SharedInviteRow = {
  id: string;
  sender_auth_id: string;
  recipient_auth_id: string;
  zone_theme: string | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  challenge_expires_at: string | null;
  status: string;
};

async function grantSharedInviteAreas(
  adminClient: ReturnType<typeof createClient>,
  invite: SharedInviteRow,
): Promise<void> {
  const centerLat = Number(invite.center_lat);
  const centerLng = Number(invite.center_lng);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return;

  const center = getAreaFromLatLng(centerLat, centerLng);
  const candidates = [
    [0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
  ];
  const owners = [invite.sender_auth_id, invite.recipient_auth_id];
  let candidateIndex = 0;

  for (const ownerAuthId of owners) {
    let granted = 0;
    while (granted < 3 && candidateIndex < candidates.length) {
      const [offsetX, offsetY] = candidates[candidateIndex++];
      const areaX = center.areaX + offsetX;
      const areaY = center.areaY + offsetY;
      const { data: existing } = await adminClient
        .from("AreaClaim")
        .select("area_x")
        .eq("area_x", areaX)
        .eq("area_y", areaY)
        .maybeSingle();
      if (existing) continue;

      const { error: claimError } = await adminClient.from("AreaClaim").insert({
        area_x: areaX,
        area_y: areaY,
        owner_auth_id: ownerAuthId,
        owner_scan_count: 5,
        claim_group_name: "Geteilte Zone",
      });
      if (claimError) continue;

      const { error: walletError } = await adminClient.rpc("wallet_grant_currency", {
        p_auth_id: ownerAuthId,
        p_currency_code: "seeds_progress",
        p_event_source: "zone_shared_invite_area",
        p_event_reference: `${invite.id}:${ownerAuthId}:${areaX}:${areaY}`,
        p_amount: 1,
        p_direction: "credit",
        p_metadata: { invite_id: invite.id, area_x: areaX, area_y: areaY },
      });
      if (walletError) console.warn("[grantScanZoneUnlocks] Shared area seed grant failed:", walletError.message);
      granted += 1;
    }

    await grantRandomHealthBoost(adminClient, ownerAuthId, 3);
  }
}

const HEALTH_STAT_COLUMNS = ["energy", "data_quality", "care"] as const;

async function grantRandomHealthBoost(
  adminClient: ReturnType<typeof createClient>,
  authId: string,
  amount: number,
): Promise<void> {
  const column = HEALTH_STAT_COLUMNS[Math.floor(Math.random() * HEALTH_STAT_COLUMNS.length)];

  const { data: robotPlant, error: fetchError } = await adminClient
    .from("RobotPlant")
    .select(column)
    .eq("auth_id", authId)
    .maybeSingle();

  if (fetchError || !robotPlant) {
    console.warn("[grantScanZoneUnlocks] Could not load RobotPlant for health boost:", fetchError?.message);
    return;
  }

  const currentValue = Number((robotPlant as Record<string, number | null>)[column] ?? 0);
  const nextValue = Math.min(100, Math.max(0, currentValue) + amount);

  const { error: updateError } = await adminClient
    .from("RobotPlant")
    .update({ [column]: nextValue })
    .eq("auth_id", authId);

  if (updateError) {
    console.warn("[grantScanZoneUnlocks] Shared invite health boost update failed:", updateError.message);
  }
}

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

function getAreaFromLatLng(lat: number, lng: number): { areaX: number; areaY: number } {
  const [x, y] = proj4("EPSG:4326", "EPSG:3035", [lng, lat]);
  return { areaX: Math.floor(Number(x) / AREA_SIZE_M), areaY: Math.floor(Number(y) / AREA_SIZE_M) };
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
      .select("id, species_name, genus_category, genus_number")
      .eq("id", effectivePlantId)
      .maybeSingle<PlantRow>();

    if (plantError || !plant) {
      return jsonResponse({ success: true, unlocked: [] });
    }

    let plantGenusId = "";
    const plantGenusCategory = String(plant.genus_category || "").trim();
    const plantGenusNumber = Number(plant.genus_number);
    if (plantGenusCategory && Number.isFinite(plantGenusNumber)) {
      const { data: plantGenus } = await adminClient
        .from("PlantGenus")
        .select("id, genus_name, scientific_genus")
        .eq("category", plantGenusCategory)
        .eq("category_dex_number", plantGenusNumber)
        .maybeSingle<PlantGenusRow>();

      plantGenusId = plantGenus?.id || "";
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

    let zoneProgress: {
      zoneId: string;
      zoneTheme: string | null;
      scanCount: number;
      previousScanCount: number;
      completed: boolean;
      claimKey: string;
    } | null = null;

    if (discovery?.id && matchedZone?.id) {
      const { data: currentZoneState, error: currentZoneStateError } = await adminClient
        .from("RobotPlantUserZoneState")
        .select("scans_in_zone")
        .eq("auth_id", authId)
        .eq("zone_id", matchedZone.id)
        .eq("day_key", dayKey)
        .maybeSingle();

      const previousScanCount = Number(currentZoneState?.scans_in_zone ?? 0);

      const { data: scanCount, error: zoneStateError } = await adminClient.rpc(
        "record_robotplant_zone_scan",
        {
          p_auth_id: authId,
          p_zone_id: matchedZone.id,
          p_discovery_id: discovery.id,
          p_day_key: dayKey,
        },
      );

      if (zoneStateError) {
        console.error("[grantScanZoneUnlocks] Failed to record zone scan:", zoneStateError);
      } else {
        const nextScanCount = Number(scanCount ?? 0);
        const completionEligible = nextScanCount >= 5;

        zoneProgress = {
          zoneId: matchedZone.id,
          zoneTheme: matchedZone.theme,
          scanCount: nextScanCount,
          previousScanCount,
          completed: completionEligible,
          claimKey: `zone-lootbox:${authId}:${matchedZone.id}:${dayKey}`,
        };

        console.log(`[grantScanZoneUnlocks] Recorded zone scan ${discovery.id}; count=${nextScanCount}; completionEligible=${completionEligible}`);
      }
    }

    const { data: sharedInvites, error: sharedInviteError } = await adminClient
      .from("ZoneSharedInvite")
      .select("id, sender_auth_id, recipient_auth_id, zone_theme, center_lat, center_lng, radius_m, challenge_expires_at, status")
      .eq("status", "accepted")
      .or(`sender_auth_id.eq.${authId},recipient_auth_id.eq.${authId}`);

    if (sharedInviteError) {
      console.warn("[grantScanZoneUnlocks] Could not load shared zone invites:", sharedInviteError.message);
    } else if (discovery?.id && coords) {
      for (const invite of (sharedInvites || []) as SharedInviteRow[]) {
        if (!invite.challenge_expires_at || new Date(invite.challenge_expires_at).getTime() <= Date.now()) continue;
        const inviteCenter = {
          lat: Number(invite.center_lat),
          lng: Number(invite.center_lng),
        };
        if (!Number.isFinite(inviteCenter.lat) || !Number.isFinite(inviteCenter.lng)) continue;
        if (distanceM(coords, inviteCenter) > Number(invite.radius_m || 0)) continue;

        const { error: sharedScanError } = await adminClient
          .from("ZoneSharedInviteScan")
          .upsert({
            invite_id: invite.id,
            auth_id: authId,
            discovery_id: discovery.id,
          }, { onConflict: "invite_id,discovery_id", ignoreDuplicates: true });

        if (sharedScanError) {
          console.warn("[grantScanZoneUnlocks] Could not record shared zone scan:", sharedScanError.message);
          continue;
        }

        const { data: progressRows } = await adminClient
          .from("ZoneSharedInviteScan")
          .select("auth_id")
          .eq("invite_id", invite.id);
        const senderCount = (progressRows || []).filter((row) => row.auth_id === invite.sender_auth_id).length;
        const recipientCount = (progressRows || []).filter((row) => row.auth_id === invite.recipient_auth_id).length;

        if (senderCount >= 5 && recipientCount >= 5) {
          const { data: completedInvite } = await adminClient
            .from("ZoneSharedInvite")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", invite.id)
            .eq("status", "accepted")
            .select("id")
            .maybeSingle();
          if (completedInvite?.id) {
            await grantSharedInviteAreas(adminClient, invite);
          }
        }
      }
    }

    const { data: rewards, error: rewardsError } = await adminClient
      .from("Rewards")
      .select("id, name, display_name, value, image_url, type, requires_zone_theme, requires_plant_species_id, requires_plant_genus_id");

    if (rewardsError) {
      return jsonResponse({ success: false, error: rewardsError.message }, 500);
    }

    const matchingRewards = ((rewards || []) as RewardRow[]).filter((reward) => {
      const requiredTheme = normalizeText(reward.requires_zone_theme);
      if (!requiredTheme || requiredTheme !== matchedTheme) {
        return false;
      }

      const requiredPlantSpeciesId = String(reward.requires_plant_species_id || "").trim();
      const requiredPlantGenusId = String(reward.requires_plant_genus_id || "").trim();
      const hasPlantCondition = !!requiredPlantSpeciesId || !!requiredPlantGenusId;
      if (!hasPlantCondition) {
        return false;
      }

      const speciesMatches = !!requiredPlantSpeciesId && requiredPlantSpeciesId === plant.id;
      const genusMatches = !!requiredPlantGenusId && requiredPlantGenusId === plantGenusId;

      return speciesMatches || genusMatches;
    });

    const firstZoneBackgroundValueByTheme: Record<string, string> = {
      water: "profile_bg_background_water",
      meadow: "profile_bg_background_flowers",
      forest: "profile_bg_background_forest",
      urban: "profile_bg_background_urban",
    };
    const firstZoneBackgroundValue = zoneProgress?.completed
      ? firstZoneBackgroundValueByTheme[matchedTheme]
      : null;
    const firstZoneBackgroundReward = firstZoneBackgroundValue
      ? ((rewards || []) as RewardRow[]).find(
          (reward) => normalizeText(reward.value) === firstZoneBackgroundValue,
        )
      : null;
    const rewardsToConsider = firstZoneBackgroundReward
      ? [...matchingRewards, firstZoneBackgroundReward]
      : matchingRewards;

    const rewardIds = Array.from(new Set(rewardsToConsider.map((reward) => reward.id)));
    if (rewardIds.length === 0) {
      return jsonResponse({ success: true, unlocked: [], zoneProgress });
    }
    const { data: existingUserRewards } = await adminClient
      .from("UserRewards")
      .select("reward_id")
      .eq("auth_id", authId)
      .in("reward_id", rewardIds);

    const unlockedIds = new Set((existingUserRewards || []).map((row) => row.reward_id));
    const rewardsToInsert = rewardsToConsider.filter((reward) => !unlockedIds.has(reward.id));

    if (rewardsToInsert.length === 0) {
      return jsonResponse({ success: true, unlocked: [], zoneProgress });
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
      zoneProgress,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});