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
  zone_key: string | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  zone_bonus_multiplier: number | null;
};

type RewardBreakdown = {
  eventSource: string;
  isScanReward: boolean;
  isInActiveZone: boolean;
  baseReward: number;
  adjustedBaseReward: number;
  healthStateLabel: string;
  healthStateBonus: number;
  zoneMultiplier: number;
  rarityMultiplier: number;
  noveltyMultiplier: number;
  careMultiplier: number;
  streakMultiplier: number;
  firstScanOfDayMultiplier: number;
  preStreakReward: number;
  finalReward: number;
};

type ScanRewardContext = {
  eventSource: string;
  duplicateScanCount: number;
  discovery: DiscoveryRow;
  robotPlantState: RobotPlantStateRow | null;
  rewardDetails: RewardBreakdown;
  derivedEnergyDelta: number;
  derivedDataQualityDelta: number;
  matchedZoneId: string | null;
  nextZoneMultiplier: number | null;
};

const SCAN_EVENT_SOURCES = new Set(["scan", "new_scan", "new_global_scan"]);

const REWARD_FORMULA_CONFIG = {
  baseByEvent: {
    scan: 10,
    new_scan: 30,
    new_global_scan: 50,
  },
  zoneMultiplier: { min: 1, max: 1.5, default: 1, start: 1.5, decrementPerAdditionalScan: 0.1 },
  noveltyMultiplier: { min: 0.2, max: 1, decrementPerDuplicateScan: 0.2 },
  streakMultiplier: { min: 1, max: 7 },
  careMultiplier: { min: 0.5, max: 1.5 },
  firstScanOfDayMultiplier: { min: 1, max: 2, default: 1 },
  absoluteMinReward: 1,
  absoluteMaxReward: 350,
};

const ROBOT_PLANT_HEALTH_STATES = [
  { minOverallHealth: 90, label: "Kraeftig", scanEventBonus: 50 },
  { minOverallHealth: 70, label: "Vital", scanEventBonus: 30 },
  { minOverallHealth: 45, label: "Stabil", scanEventBonus: 15 },
  { minOverallHealth: 25, label: "Schwach", scanEventBonus: 5 },
  { minOverallHealth: 0, label: "Kritisch", scanEventBonus: 0 },
] as const;

const ENERGY_GAIN_CONFIG = {
  metersPerPoint: 100,
  maxPerDay: 15,
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
const SCAN_LIKE_CARE_GAIN_DAILY_CAP = 5;

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

function getUtcDayWindow(date = new Date()): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0,
  ));
  const end = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  ));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const roundMultiplier = (value: number): number => Math.round(value * 100) / 100;

const lerpMultiplier = (value: number, min: number, max: number): number => {
  const safeValue = clamp(Number(value ?? 0), 0, 100);
  return min + (safeValue / 100) * (max - min);
};

const computeCareMultiplier = (careValue: number): number => {
  const safeCare = clamp(Number(careValue ?? 0), 0, 100);
  return clamp(0.5 + safeCare / 100, REWARD_FORMULA_CONFIG.careMultiplier.min, REWARD_FORMULA_CONFIG.careMultiplier.max);
};

const computeOverallPlantHealth = ({
  energyValue,
  dataQualityValue,
  careValue,
}: {
  energyValue: number;
  dataQualityValue: number;
  careValue: number;
}): number => {
  const safeEnergy = clamp(Number(energyValue ?? 0), 0, 100);
  const safeDataQuality = clamp(Number(dataQualityValue ?? 0), 0, 100);
  const safeCare = clamp(Number(careValue ?? 0), 0, 100);

  if (safeEnergy <= 0 || safeDataQuality <= 0 || safeCare <= 0) {
    return 0;
  }

  return Math.round(3 / (1 / safeEnergy + 1 / safeDataQuality + 1 / safeCare));
};

const computePlantHealthState = ({
  energyValue,
  dataQualityValue,
  careValue,
}: {
  energyValue: number;
  dataQualityValue: number;
  careValue: number;
}) => {
  const overallPlantHealth = computeOverallPlantHealth({ energyValue, dataQualityValue, careValue });
  return (
    ROBOT_PLANT_HEALTH_STATES.find((state) => overallPlantHealth >= state.minOverallHealth) ??
    ROBOT_PLANT_HEALTH_STATES[ROBOT_PLANT_HEALTH_STATES.length - 1]
  );
};

const computeZoneMultiplierFromScanCount = (scanCountInZoneToday: number): number => {
  const safeCount = Math.max(0, Number(scanCountInZoneToday ?? 0));
  const decremented = REWARD_FORMULA_CONFIG.zoneMultiplier.start - safeCount * REWARD_FORMULA_CONFIG.zoneMultiplier.decrementPerAdditionalScan;
  return clamp(decremented, REWARD_FORMULA_CONFIG.zoneMultiplier.min, REWARD_FORMULA_CONFIG.zoneMultiplier.max);
};

const computeDailyEnergyGainFromMeters = (meters: number): number => {
  const safeMeters = Math.max(0, Number(meters ?? 0));
  const points = Math.floor(safeMeters / ENERGY_GAIN_CONFIG.metersPerPoint);
  return clamp(points, 0, ENERGY_GAIN_CONFIG.maxPerDay);
};

const computeDataQualityGainFromZoneMultiplier = (zoneMultiplier: number): number => {
  const safeZoneMultiplier = clamp(
    Number(zoneMultiplier ?? REWARD_FORMULA_CONFIG.zoneMultiplier.default),
    REWARD_FORMULA_CONFIG.zoneMultiplier.min,
    REWARD_FORMULA_CONFIG.zoneMultiplier.max,
  );

  const derivedGain = Math.round((safeZoneMultiplier - 1) * 10);
  return Math.max(1, derivedGain);
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
  energyValue,
  dataQualityValue,
  careValue,
  streakDays,
  isInActiveZone,
  rarity,
  isFirstScanOfDay,
  zoneMultiplier,
}: {
  eventSource: string;
  duplicateScanCount: number;
  energyValue: number;
  dataQualityValue: number;
  careValue: number;
  streakDays: number;
  isInActiveZone: boolean;
  rarity: string | null;
  isFirstScanOfDay?: boolean;
  zoneMultiplier: number;
}): RewardBreakdown => {
  const baseReward = REWARD_FORMULA_CONFIG.baseByEvent[eventSource as keyof typeof REWARD_FORMULA_CONFIG.baseByEvent] ?? 0;
  const healthState = computePlantHealthState({
    energyValue,
    dataQualityValue,
    careValue,
  });
  const effectiveZoneMultiplier = isInActiveZone
    ? clamp(zoneMultiplier, REWARD_FORMULA_CONFIG.zoneMultiplier.min, REWARD_FORMULA_CONFIG.zoneMultiplier.max)
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
  const careMultiplier = computeCareMultiplier(careValue);
  const healthStateBonus = healthState.scanEventBonus;
  const adjustedBaseReward = baseReward + healthStateBonus;
  const streakMultiplier = clamp(
    streakDays <= 1 ? 1 : streakDays,
    REWARD_FORMULA_CONFIG.streakMultiplier.min,
    REWARD_FORMULA_CONFIG.streakMultiplier.max,
  );
  const firstScanOfDayMultiplier = isFirstScanOfDay
    ? REWARD_FORMULA_CONFIG.firstScanOfDayMultiplier.max
    : REWARD_FORMULA_CONFIG.firstScanOfDayMultiplier.default;

  const rawPreStreak =
    adjustedBaseReward * effectiveZoneMultiplier * rarityMultiplier * noveltyMultiplier * careMultiplier * firstScanOfDayMultiplier;
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
    adjustedBaseReward,
    healthStateLabel: healthState.label,
    healthStateBonus,
    zoneMultiplier: roundMultiplier(effectiveZoneMultiplier),
    rarityMultiplier,
    noveltyMultiplier: roundMultiplier(noveltyMultiplier),
    careMultiplier: roundMultiplier(careMultiplier),
    streakMultiplier: roundMultiplier(streakMultiplier),
    firstScanOfDayMultiplier: roundMultiplier(firstScanOfDayMultiplier),
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

  const dayKey = new Date().toISOString().slice(0, 10);
  const authKeySuffix = authId.replace(/-/g, "");
  const discoveryCoordinates = parseDiscoveryLocation(discovery.discovery_location);

  let isInActiveZone = false;
  let matchedZone: ZoneRow | null = null;
  if (discoveryCoordinates) {
    const { data: zones } = await adminClient
      .from("RobotPlantZone")
      .select("id, zone_key, center_lat, center_lng, radius_m, zone_bonus_multiplier")
      .eq("is_active", true)
      .eq("day_generated", dayKey)
      .like("zone_key", `%:${authKeySuffix}`);

    matchedZone = (zones || [])
      .filter((zone): zone is ZoneRow => Number.isFinite(Number(zone.center_lat)) && Number.isFinite(Number(zone.center_lng)))
      .map((zone) => ({
        ...zone,
        distanceM: getDistanceBetweenCoordinatesM(discoveryCoordinates, {
          lat: Number(zone.center_lat),
          lng: Number(zone.center_lng),
        }),
      }))
      .filter((zone) => zone.distanceM <= Number(zone.radius_m ?? 150))
      .sort((left, right) => left.distanceM - right.distanceM)[0] || null;

    isInActiveZone = !!matchedZone;
  }

  const zoneMultiplier = isInActiveZone
    ? clamp(
        Number(matchedZone?.zone_bonus_multiplier ?? REWARD_FORMULA_CONFIG.zoneMultiplier.start),
        REWARD_FORMULA_CONFIG.zoneMultiplier.min,
        REWARD_FORMULA_CONFIG.zoneMultiplier.max,
      )
    : REWARD_FORMULA_CONFIG.zoneMultiplier.default;

  // Check if this is the first scan of the UTC day for this user.
  // The discovery usually exists already, so <=1 still means first scan.
  const now = new Date();
  const utcDayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0,
  ));
  const utcNextDayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  ));

  const { count: todayScanCount, error: todayScansError } = await adminClient
    .from("UserPlantDiscovery")
    .select("id", { count: "exact", head: true })
    .eq("auth_id", authId)
    .gte("discovered_date", utcDayStart.toISOString())
    .lt("discovered_date", utcNextDayStart.toISOString());

  if (todayScansError) {
    throw new Error(`Failed to load today's scan count: ${todayScansError.message}`);
  }

  const isFirstScanOfDay = Number(todayScanCount ?? 0) <= 1;

  const careValue = Number(robotPlantState?.care ?? ROBOT_PLANT_DEFAULT_STATE.care);
  const energyValue = Number(robotPlantState?.energy ?? ROBOT_PLANT_DEFAULT_STATE.energy);
  const dataQualityValue = Number(robotPlantState?.data_quality ?? ROBOT_PLANT_DEFAULT_STATE.data_quality);
  let derivedEnergyDelta = 0;
  if (discoveryCoordinates) {
    const { data: todayDiscoveries, error: todayDiscoveriesError } = await adminClient
      .from("UserPlantDiscovery")
      .select("id, discovery_location, discovered_date")
      .eq("auth_id", authId)
      .gte("discovered_date", utcDayStart.toISOString())
      .lt("discovered_date", utcNextDayStart.toISOString())
      .order("discovered_date", { ascending: true });

    if (todayDiscoveriesError) {
      throw new Error(`Failed to load today's discoveries: ${todayDiscoveriesError.message}`);
    }

    const computeDailyMeters = (rows: Array<{ id: string; discovery_location: string | null; discovered_date: string | null }>) => {
      const points = rows
        .map((row) => parseDiscoveryLocation(row.discovery_location))
        .filter((coords): coords is { lat: number; lng: number } => !!coords);

      if (points.length < 2) return 0;

      let total = 0;
      for (let i = 1; i < points.length; i += 1) {
        total += getDistanceBetweenCoordinatesM(points[i - 1], points[i]);
      }

      return total;
    };

    const beforeRows = (todayDiscoveries || []).filter((row) => row.id !== discovery.id);
    const beforeEnergy = computeDailyEnergyGainFromMeters(computeDailyMeters(beforeRows));
    const afterEnergy = computeDailyEnergyGainFromMeters(computeDailyMeters(todayDiscoveries || []));

    derivedEnergyDelta = Math.max(0, afterEnergy - beforeEnergy);
  }

  const rewardDetails = computeScanRewardBreakdown({
    eventSource,
    duplicateScanCount,
    energyValue,
    dataQualityValue,
    careValue,
    streakDays: Number(robotPlantState?.streak_days ?? ROBOT_PLANT_DEFAULT_STATE.streak_days),
    isInActiveZone,
    rarity: plant.rarity,
    isFirstScanOfDay,
    zoneMultiplier,
  });

  const derivedDataQualityDelta = isInActiveZone
    ? computeDataQualityGainFromZoneMultiplier(zoneMultiplier)
    : 0;
  const finalEnergyDelta = Math.round(derivedEnergyDelta);

  const nextZoneMultiplier = isInActiveZone
    ? clamp(
        zoneMultiplier - REWARD_FORMULA_CONFIG.zoneMultiplier.decrementPerAdditionalScan,
        REWARD_FORMULA_CONFIG.zoneMultiplier.min,
        REWARD_FORMULA_CONFIG.zoneMultiplier.max,
      )
    : null;

  return {
    eventSource,
    duplicateScanCount,
    discovery,
    robotPlantState,
    rewardDetails,
    derivedEnergyDelta: finalEnergyDelta,
    derivedDataQualityDelta,
    matchedZoneId: matchedZone?.id || null,
    nextZoneMultiplier,
  };
}

function getAllowedOrigins(): string[] {
  const configured = [
    Deno.env.get("FLORALOG_URL"),
    Deno.env.get("SITE_URL"),
  ].filter(Boolean) as string[];

  return [
    ...configured,
    "http://localhost",
    "https://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "capacitor://localhost",
    "ionic://localhost",
    "file://",
  ];
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

    const requestOrigin = req.headers.get("Origin");
    if (!isAllowedOrigin(requestOrigin)) {
      console.warn("[robotPlantGrantReward] Origin not allowed", { requestOrigin });
      return jsonResponse({ error: "Origin not allowed", origin: requestOrigin }, 403);
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
    let effectiveEnergyDelta = energyDelta;
    let effectiveDataQualityDelta = dataQualityDelta;
    let effectiveCareDelta = careDelta;
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
      effectiveEnergyDelta = scanContext.derivedEnergyDelta;
      effectiveDataQualityDelta = scanContext.derivedDataQualityDelta;
      effectiveCareDelta = 0;
      metadata = {
        ...metadata,
        reward_breakdown: rewardDetails,
        duplicate_scan_count: scanContext.duplicateScanCount,
        reward_computed_server_side: true,
        derived_energy_delta: effectiveEnergyDelta,
        derived_data_quality_delta: effectiveDataQualityDelta,
        zone_scan_applied: scanContext.matchedZoneId,
      };
    } else if (!Number.isFinite(effectiveAmount) || effectiveAmount < 0) {
      return jsonResponse({ error: "amount must be a number >= 0" }, 400);
    }

    if (effectiveEventSource === "scan_like_received") {
      const { startIso, endIso } = getUtcDayWindow();
      const { count: likeRewardsTodayCount, error: likeRewardsTodayError } = await adminClient
        .from("RobotPlantWalletLedger")
        .select("id", { count: "exact", head: true })
        .eq("auth_id", authId)
        .eq("event_source", "scan_like_received")
        .gte("created_at", startIso)
        .lt("created_at", endIso);

      if (likeRewardsTodayError) {
        console.error("[robotPlantGrantReward] failed to count today's like rewards", likeRewardsTodayError);
        return jsonResponse({ error: "Failed to validate daily like care limit" }, 500);
      }

      const likeRewardsToday = Math.max(0, Number(likeRewardsTodayCount ?? 0));
      const canGrantLikeCare = likeRewardsToday < SCAN_LIKE_CARE_GAIN_DAILY_CAP;
      effectiveCareDelta = canGrantLikeCare ? 1 : 0;

      metadata = {
        ...metadata,
        like_care_delta_applied: effectiveCareDelta,
        like_care_daily_cap: SCAN_LIKE_CARE_GAIN_DAILY_CAP,
        like_rewards_today_before_apply: likeRewardsToday,
      };
    }

    const { data, error } = await adminClient.rpc("robot_plant_grant_reward", {
      p_auth_id: authId,
      p_event_source: effectiveEventSource,
      p_event_reference: eventReference,
      p_amount: Math.round(effectiveAmount),
      p_energy_delta: Math.round(effectiveEnergyDelta),
      p_data_quality_delta: Math.round(effectiveDataQualityDelta),
      p_care_delta: Math.round(effectiveCareDelta),
      p_metadata: metadata,
    });

    if (error) {
      console.error("[robotPlantGrantReward] rpc error", error);
      return jsonResponse({ error: "Failed to grant reward" }, 500);
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (scanContext?.matchedZoneId && Number.isFinite(scanContext.nextZoneMultiplier)) {
      const { error: zoneUpdateError } = await adminClient
        .from("RobotPlantZone")
        .update({ zone_bonus_multiplier: scanContext.nextZoneMultiplier })
        .eq("id", scanContext.matchedZoneId);

      if (zoneUpdateError) {
        console.warn("[robotPlantGrantReward] zone multiplier update failed", zoneUpdateError);
      }
    }

    return jsonResponse(
      {
        ok: true,
        result,
        rewardDetails,
        eventSource: effectiveEventSource,
        energyDelta: Math.round(effectiveEnergyDelta),
        dataQualityDelta: Math.round(effectiveDataQualityDelta),
        careDelta: Math.round(effectiveCareDelta),
      },
      200,
    );
  } catch (error) {
    console.error("[robotPlantGrantReward] unexpected error", error);
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
