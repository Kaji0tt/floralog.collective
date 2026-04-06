import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GrantBody = {
  authId?: string;
  userEmail?: string | null;
  eventSource?: string;
  eventReference?: string;
  amount?: number;
  energyDelta?: number;
  dataQualityDelta?: number;
  careDelta?: number;
  metadata?: Record<string, unknown>;
};

type DiscoveryRow = {
  id: string;
  auth_id: string;
  plant_id: string | null;
  discovery_location: string | null;
  discovered_date: string | null;
};

type PlantRow = {
  id: string;
  rarity: string | null;
};

type RobotPlantStateRow = {
  data_quality: number | null;
  care: number | null;
  energy: number | null;
  streak_days: number | null;
};

type ZoneRow = {
  id: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
};

type RewardBreakdown = {
  eventSource: string;
  isScanReward: boolean;
  isInActiveZone: boolean;
  baseReward: number;
  zoneMultiplier: number;
  rarityMultiplier: number;
  noveltyMultiplier: number;
  careMultiplier: number;
  energyMultiplier: number;
  streakMultiplier: number;
  preStreakReward: number;
  finalReward: number;
};

type ScanRewardContext = {
  eventSource: string;
  duplicateScanCount: number;
  rewardDetails: RewardBreakdown;
};

const SCAN_EVENT_SOURCES = new Set(["scan", "new_scan", "new_global_scan"]);

const REWARD_FORMULA_CONFIG = {
  baseByEvent: {
    scan: 10,
    new_scan: 20,
    new_global_scan: 50,
  },
  zoneMultiplier: { min: 1, max: 1.75, default: 1 },
  noveltyMultiplier: { min: 0.2, max: 1, decrementPerDuplicateScan: 0.2 },
  streakMultiplier: { min: 1, max: 7 },
  careMultiplier: { min: 1, max: 2 },
  energyMultiplier: { min: 1, max: 2 },
  absoluteMinReward: 1,
  absoluteMaxReward: 350,
};

const ROBOT_PLANT_DEFAULT_STATE = {
  data_quality: 65,
  care: 72,
  energy: 70,
  streak_days: 0,
};

const NORMALIZED_RARITY_MULTIPLIERS: Record<string, number> = {
  haufig: 1,
  haeufig: 1,
  gelegentlich: 2,
  selten: 3,
  sehrselten: 3,
  extremselten: 3,
};

const EARTH_RADIUS_M = 6371000;

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
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const roundMultiplier = (value: number): number => Math.round(value * 100) / 100;

const lerpMultiplier = (value: number, min: number, max: number): number => {
  const safeValue = clamp(Number(value ?? 0), 0, 100);
  return min + (safeValue / 100) * (max - min);
};

const normalizeRarityKey = (rarity: string | null | undefined): string =>
  String(rarity ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

const computeRarityMultiplier = (rarity: string | null | undefined): number => {
  return NORMALIZED_RARITY_MULTIPLIERS[normalizeRarityKey(rarity)] ?? 1;
};

const parseDiscoveryLocation = (
  location: string | null | undefined,
): { lat: number; lng: number } | null => {
  if (!location) return null;
  const parts = location.split(",").map((part) => Number(part.trim()));
  if (parts.length < 2) return null;
  const [lat, lng] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const getDistanceBetweenCoordinatesM = (
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
): number => {
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
};

const computeScanRewardBreakdown = ({
  eventSource,
  duplicateScanCount,
  dataQualityValue,
  careValue,
  energyValue,
  streakDays,
  isInActiveZone,
  rarity,
}: {
  eventSource: string;
  duplicateScanCount: number;
  dataQualityValue: number;
  careValue: number;
  energyValue: number;
  streakDays: number;
  isInActiveZone: boolean;
  rarity: string | null;
}): RewardBreakdown => {
  const baseReward = REWARD_FORMULA_CONFIG.baseByEvent[eventSource as keyof typeof REWARD_FORMULA_CONFIG.baseByEvent] ?? 0;
  const zoneMultiplier = isInActiveZone
    ? lerpMultiplier(dataQualityValue, REWARD_FORMULA_CONFIG.zoneMultiplier.min, REWARD_FORMULA_CONFIG.zoneMultiplier.max)
    : REWARD_FORMULA_CONFIG.zoneMultiplier.default;
  const rarityMultiplier = computeRarityMultiplier(rarity);
  const noveltyRaw =
    REWARD_FORMULA_CONFIG.noveltyMultiplier.max -
    Math.max(0, duplicateScanCount) * REWARD_FORMULA_CONFIG.noveltyMultiplier.decrementPerDuplicateScan;
  const noveltyMultiplier = clamp(
    noveltyRaw,
    REWARD_FORMULA_CONFIG.noveltyMultiplier.min,
    REWARD_FORMULA_CONFIG.noveltyMultiplier.max,
  );
  const careMultiplier = lerpMultiplier(careValue, REWARD_FORMULA_CONFIG.careMultiplier.min, REWARD_FORMULA_CONFIG.careMultiplier.max);
  const energyMultiplier = lerpMultiplier(
    energyValue,
    REWARD_FORMULA_CONFIG.energyMultiplier.min,
    REWARD_FORMULA_CONFIG.energyMultiplier.max,
  );
  const streakMultiplier = clamp(
    streakDays <= 1 ? 1 : streakDays,
    REWARD_FORMULA_CONFIG.streakMultiplier.min,
    REWARD_FORMULA_CONFIG.streakMultiplier.max,
  );

  const rawPreStreak =
    baseReward * zoneMultiplier * rarityMultiplier * noveltyMultiplier * careMultiplier * energyMultiplier;
  const preStreakReward = clamp(
    Math.round(rawPreStreak),
    REWARD_FORMULA_CONFIG.absoluteMinReward,
    REWARD_FORMULA_CONFIG.absoluteMaxReward,
  );
  const finalReward = Math.round(preStreakReward * streakMultiplier);

  return {
    eventSource,
    isScanReward: true,
    isInActiveZone,
    baseReward,
    zoneMultiplier: roundMultiplier(zoneMultiplier),
    rarityMultiplier,
    noveltyMultiplier: roundMultiplier(noveltyMultiplier),
    careMultiplier: roundMultiplier(careMultiplier),
    energyMultiplier: roundMultiplier(energyMultiplier),
    streakMultiplier: roundMultiplier(streakMultiplier),
    preStreakReward,
    finalReward,
  };
};

async function tryResolveScanRewardContext(
  adminClient: ReturnType<typeof createClient>,
  authId: string,
  eventReference: string,
): Promise<ScanRewardContext | null> {
  const { data: discovery, error: discoveryError } = await adminClient
    .from("UserPlantDiscovery")
    .select("id, auth_id, plant_id, discovery_location, discovered_date")
    .eq("id", eventReference)
    .maybeSingle<DiscoveryRow>();

  if (discoveryError || !discovery) {
    return null;
  }

  if (discovery.auth_id !== authId) {
    throw new Error("Discovery does not belong to authId");
  }

  if (!discovery.plant_id) {
    throw new Error("Discovery has no plant_id");
  }

  const { data: plant, error: plantError } = await adminClient
    .from("Plant")
    .select("id, rarity")
    .eq("id", discovery.plant_id)
    .maybeSingle<PlantRow>();

  if (plantError || !plant) {
    throw new Error("Plant for discovery not found");
  }

  let userPlantCountQuery = adminClient
    .from("UserPlantDiscovery")
    .select("id", { count: "exact", head: true })
    .eq("auth_id", authId)
    .eq("plant_id", discovery.plant_id);

  let globalPlantCountQuery = adminClient
    .from("UserPlantDiscovery")
    .select("id", { count: "exact", head: true })
    .eq("plant_id", discovery.plant_id);

  if (discovery.discovered_date) {
    userPlantCountQuery = userPlantCountQuery.lte("discovered_date", discovery.discovered_date);
    globalPlantCountQuery = globalPlantCountQuery.lte("discovered_date", discovery.discovered_date);
  }

  const [{ count: userPlantCount }, { count: globalPlantCount }] = await Promise.all([
    userPlantCountQuery,
    globalPlantCountQuery,
  ]);

  const safeUserPlantCount = Math.max(0, Number(userPlantCount ?? 0));
  const safeGlobalPlantCount = Math.max(0, Number(globalPlantCount ?? 0));
  const duplicateScanCount = Math.max(0, safeUserPlantCount - 1);

  const eventSource =
    safeUserPlantCount <= 1
      ? safeGlobalPlantCount <= 1
        ? "new_global_scan"
        : "new_scan"
      : "scan";

  const { data: robotPlantState } = await adminClient
    .from("RobotPlant")
    .select("data_quality, care, energy, streak_days")
    .eq("auth_id", authId)
    .maybeSingle<RobotPlantStateRow>();

  let isInActiveZone = false;
  const discoveryCoordinates = parseDiscoveryLocation(discovery.discovery_location);
  if (discoveryCoordinates) {
    const dayKey = new Date().toISOString().slice(0, 10);
    const { data: zones } = await adminClient
      .from("RobotPlantZone")
      .select("id, center_lat, center_lng, radius_m")
      .eq("is_active", true)
      .eq("day_generated", dayKey);

    const matchingZone = (zones || [])
      .filter((zone): zone is ZoneRow => Number.isFinite(Number(zone.center_lat)) && Number.isFinite(Number(zone.center_lng)))
      .map((zone) => ({
        ...zone,
        distanceM: getDistanceBetweenCoordinatesM(discoveryCoordinates, {
          lat: Number(zone.center_lat),
          lng: Number(zone.center_lng),
        }),
      }))
      .filter((zone) => zone.distanceM <= Number(zone.radius_m ?? 150))
      .sort((left, right) => left.distanceM - right.distanceM)[0];

    isInActiveZone = !!matchingZone;
  }

  const rewardDetails = computeScanRewardBreakdown({
    eventSource,
    duplicateScanCount,
    dataQualityValue: Number(robotPlantState?.data_quality ?? ROBOT_PLANT_DEFAULT_STATE.data_quality),
    careValue: Number(robotPlantState?.care ?? ROBOT_PLANT_DEFAULT_STATE.care),
    energyValue: Number(robotPlantState?.energy ?? ROBOT_PLANT_DEFAULT_STATE.energy),
    streakDays: Number(robotPlantState?.streak_days ?? ROBOT_PLANT_DEFAULT_STATE.streak_days),
    isInActiveZone,
    rarity: plant.rarity,
  });

  return {
    eventSource,
    duplicateScanCount,
    rewardDetails,
  };
}

function getAllowedOrigins(): string[] {
  const configured = [
    Deno.env.get("FLORALOG_URL"),
    Deno.env.get("SITE_URL"),
  ].filter(Boolean) as string[];

  return [...configured, "http://localhost:5173", "http://127.0.0.1:5173"];
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return getAllowedOrigins().some((allowed) => origin.toLowerCase() === allowed.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    if (!isAllowedOrigin(req.headers.get("Origin"))) {
      return jsonResponse({ error: "Origin not allowed" }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as GrantBody;
    const authId = String(body.authId || "").trim();
    const providedEmail = normalizeEmail(body.userEmail);

    const requestedEventSource = String(body.eventSource || "").trim();
    const eventReference = String(body.eventReference || "").trim();
    const requestedAmount = Number(body.amount ?? 0);
    const energyDelta = Number(body.energyDelta ?? 0);
    const dataQualityDelta = Number(body.dataQualityDelta ?? 0);
    const careDelta = Number(body.careDelta ?? 0);
    let metadata = body.metadata ?? {};

    if (!isUuid(authId)) {
      return jsonResponse({ error: "authId is required" }, 400);
    }

    if (!requestedEventSource || !eventReference) {
      return jsonResponse({ error: "eventSource and eventReference are required" }, 400);
    }

    const { data: userLookup, error: userLookupError } = await adminClient.auth.admin.getUserById(authId);
    const resolvedUser = userLookup?.user;
    if (userLookupError || !resolvedUser) {
      return jsonResponse({ error: "Invalid authId" }, 401);
    }

    const resolvedEmail = normalizeEmail(resolvedUser.email);
    if (providedEmail && resolvedEmail && providedEmail !== resolvedEmail) {
      return jsonResponse({ error: "authId and userEmail do not match" }, 403);
    }

    let effectiveEventSource = requestedEventSource;
    let effectiveAmount = requestedAmount;
    let rewardDetails: RewardBreakdown | null = null;

    let scanContext: ScanRewardContext | null = null;
    try {
      scanContext = await tryResolveScanRewardContext(adminClient, authId, eventReference);
    } catch (scanResolveError) {
      console.error("[robotPlantGrantReward] scan context error", scanResolveError);
      return jsonResponse({ error: "Invalid scan reward context" }, 400);
    }

    if (scanContext || SCAN_EVENT_SOURCES.has(requestedEventSource)) {
      if (!scanContext) {
        return jsonResponse({ error: "Scan eventReference must point to a valid discovery" }, 400);
      }

      effectiveEventSource = scanContext.eventSource;
      rewardDetails = scanContext.rewardDetails;
      effectiveAmount = rewardDetails.finalReward;
      metadata = {
        ...metadata,
        reward_breakdown: rewardDetails,
        duplicate_scan_count: scanContext.duplicateScanCount,
        reward_computed_server_side: true,
      };
    } else if (!Number.isFinite(effectiveAmount) || effectiveAmount < 0) {
      return jsonResponse({ error: "amount must be a number >= 0" }, 400);
    }

    const { data, error } = await adminClient.rpc("robot_plant_grant_reward", {
      p_auth_id: authId,
      p_event_source: effectiveEventSource,
      p_event_reference: eventReference,
      p_amount: Math.round(effectiveAmount),
      p_energy_delta: Math.round(energyDelta),
      p_data_quality_delta: Math.round(dataQualityDelta),
      p_care_delta: Math.round(careDelta),
      p_metadata: metadata,
    });

    if (error) {
      console.error("[robotPlantGrantReward] rpc error", error);
      return jsonResponse({ error: "Failed to grant reward" }, 500);
    }

    const result = Array.isArray(data) ? data[0] : data;

    return jsonResponse({ ok: true, result, rewardDetails, eventSource: effectiveEventSource }, 200);
  } catch (error) {
    console.error("[robotPlantGrantReward] unexpected error", error);
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
