import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import {
  ROBOT_PLANT_DEFAULT_STATE,
  ROBOT_PLANT_EVENT_SOURCES,
} from "@/lib/robotPlantConfig";
import {
  applyRobotPlantDelta,
  buildDecayDelta,
  computeRobotPlantRewardBreakdown,
  computeRobotPlantReward,
} from "@/lib/robotPlantEconomy";

const getCurrentAuthContext = async () => {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  const user = data?.user;
  if (!user?.id) {
    throw new Error("Authenticated user is required");
  }

  return {
    authId: user.id,
    userEmail: user.email || null,
  };
};

export const getRobotPlantState = async (authId) => {
  if (!authId) return null;

  const rows = await Query.RobotPlant.filter({ auth_id: authId });
  const existing = rows?.[0] || null;

  if (!existing) {
    return {
      auth_id: authId,
      ...ROBOT_PLANT_DEFAULT_STATE,
      source: "default",
    };
  }

  return {
    ...ROBOT_PLANT_DEFAULT_STATE,
    ...existing,
    source: "database",
  };
};

export const simulateRobotPlantDecay = (state, hoursSinceLastDecay, decayReduction = 0) => {
  const energyValue = Number(state?.energy ?? state?.energy_value ?? 0);
  const dataQualityValue = Number(state?.dataQuality ?? state?.data_quality ?? state?.data_quality_value ?? 0);
  const careValue = Number(state?.care ?? state?.care_value ?? 0);
  const delta = buildDecayDelta({ hoursSinceLastDecay, decayReduction, energyValue, dataQualityValue, careValue });
  return applyRobotPlantDelta(state, delta);
};

export const estimateRewardForEvent = ({
  eventSource = ROBOT_PLANT_EVENT_SOURCES.scan,
  duplicateScanCount,
  streakDays,
  energyValue,
  dataQualityValue,
  careValue,
  isInActiveZone,
  rarity,
}) => {
  return computeRobotPlantReward({
    eventSource,
    duplicateScanCount,
    streakDays,
    energyValue,
    dataQualityValue,
    careValue,
    isInActiveZone,
    rarity,
  });
};

export const getScanRewardDetails = async ({
  authId,
  eventSource,
  duplicateScanCount = 0,
  isInActiveZone = true,
  rarity = null,
}) => {
  const robotPlantState = await getRobotPlantState(authId);

  return computeRobotPlantRewardBreakdown({
    eventSource,
    duplicateScanCount,
    isInActiveZone,
    rarity,
    energyValue: robotPlantState?.energy,
    dataQualityValue: robotPlantState?.dataQuality ?? robotPlantState?.data_quality,
    careValue: robotPlantState?.care,
    streakDays: robotPlantState?.streakDays ?? robotPlantState?.streak_days,
  });
};

export const grantRobotPlantRewardServerSide = async ({
  eventSource,
  eventReference,
  amount,
  energyDelta = 0,
  dataQualityDelta = 0,
  careDelta = 0,
  metadata = {},
}) => {
  const { authId, userEmail } = await getCurrentAuthContext();

  const { data, error } = await supabase.functions.invoke("robotPlantGrantReward", {
    body: {
      authId,
      userEmail,
      eventSource,
      eventReference,
      amount,
      energyDelta,
      dataQualityDelta,
      careDelta,
      metadata,
    },
  });

  if (error) {
    throw error;
  }

  return data || null;
};

export const initializeGeoRasterGrid = async ({ bounds, forceRefresh = false }) => {
  const { authId } = await getCurrentAuthContext();

  const { data, error } = await supabase.functions.invoke("initializeGeoRasterGrid", {
    body: {
      authId,
      bounds,
      forceRefresh,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to initialize raster grid");
  }

  return data;
};

const ROBOT_PLANT_ZONE_ERROR_MESSAGES = {
  AUTH_DAY_KEY_REQUIRED: "Die Tagesfreigabe fuer die Zonengenerierung fehlt. Bitte lade die Seite neu.",
  INITIAL_FORCE_REGENERATE_NOT_ALLOWED: "Die erste Zonengenerierung des Tages darf nicht als Reroll gestartet werden.",
  REROLL_REQUIRES_FORCE_REGENERATE: "Ein Reroll ist nur ueber den Neu-Button moeglich.",
  INITIAL_ALREADY_CALLED_TODAY: "Die Tageszonen wurden heute bereits initial geladen.",
  INITIAL_ALREADY_COMPLETED_TODAY: "Die Tageszonen wurden heute bereits erzeugt.",
  REROLL_REQUIRES_INITIAL_TODAY: "Ein Reroll ist erst moeglich, nachdem die Tageszonen einmal geladen wurden.",
  REROLL_MISSING_BASE_ZONES: "Es gibt noch keine Tageszonen als Basis fuer einen Reroll.",
};

/**
 * @typedef {{
 *   code?: keyof typeof ROBOT_PLANT_ZONE_ERROR_MESSAGES | string | null,
 *   error?: string | null,
 *   rateLimited?: boolean,
 *   rerollsRemainingToday?: number | null,
 * }} RobotPlantZoneErrorPayload
 */

/**
 * @param {RobotPlantZoneErrorPayload | null | undefined} payload
 * @param {string} fallbackMessage
 */
function createRobotPlantZoneError(payload, fallbackMessage) {
  const errorCode = payload?.code || null;
  const zoneErrorMessagesByCode = /** @type {Record<string, string>} */ (ROBOT_PLANT_ZONE_ERROR_MESSAGES);
  const resolvedMessage =
    (typeof errorCode === "string" && errorCode in zoneErrorMessagesByCode
      ? zoneErrorMessagesByCode[errorCode]
      : null) || payload?.error || fallbackMessage;

  const err = /** @type {Error & { code?: string | null, rateLimited?: boolean, rerollsRemainingToday?: number | null }} */ (
    new Error(resolvedMessage)
  );
  err.code = typeof errorCode === "string" ? errorCode : null;
  err.rateLimited = payload?.rateLimited === true;
  err.rerollsRemainingToday = payload?.rerollsRemainingToday ?? null;
  return err;
}

export const getRobotPlantDailyZones = async ({
  latitude,
  longitude,
  forceRegenerate = false,
  authDayKey = null,
  mode = "initial",
}) => {
  const { authId, userEmail } = await getCurrentAuthContext();
  const effectiveAuthDayKey = authDayKey || "1970-01-01";
  const effectiveMode = mode === "reroll" ? "reroll" : "initial";

  console.log("[getRobotPlantDailyZones] Calling function with:", {
    latitude,
    longitude,
    forceRegenerate,
    authDayKey: effectiveAuthDayKey,
    mode: effectiveMode,
    authId: authId?.substring(0, 8) + "...",
  });

  const { data, error } = await supabase.functions.invoke("robotPlantDailyZones", {
    body: {
      authId,
      userEmail,
      latitude,
      longitude,
      forceRegenerate,
      authDayKey: effectiveAuthDayKey,
      mode: effectiveMode,
    },
  });

  if (error) {
    console.error("[getRobotPlantDailyZones] Function error:", error);
    let responsePayload = null;
    try {
      responsePayload = await error.context?.json?.();
    } catch (_parseError) {
      responsePayload = null;
    }

    if (responsePayload) {
      throw createRobotPlantZoneError(responsePayload, "Zonen konnten nicht geladen werden.");
    }

    throw new Error(error.message || "Zonen konnten nicht geladen werden.");
  }

  console.log("[getRobotPlantDailyZones] Response:", { success: data?.success, cached: data?.cached, zoneCount: data?.zones?.length });

  if (!data?.success || !Array.isArray(data?.zones)) {
    console.error("[getRobotPlantDailyZones] Error response:", data?.error || "Failed to load daily zones");
    throw createRobotPlantZoneError(data, "Zonen konnten nicht geladen werden.");
  }

  return {
    generated: data.cached === false,
    dayKey: data.dayKey,
    zones: data.zones || [],
    rerollsRemainingToday: data.rerollsRemainingToday ?? null,
  };
};

export const listRobotPlantShopItems = async () => {
  const items = await Query.RobotPlantShopItem.list("created_at");
  return Array.isArray(items) ? items : [];
};

export const listRobotPlantInventory = async (authId) => {
  if (!authId) return [];
  const inventory = await Query.RobotPlantUserInventory.filter({ auth_id: authId });
  return Array.isArray(inventory) ? inventory : [];
};

export const listRobotPlantActiveEffects = async (authId) => {
  if (!authId) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("RobotPlantActiveEffect")
    .select("*")
    .eq("auth_id", authId)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: true });

  if (error) {
    throw error;
  }

  const effects = data || [];
  return Array.isArray(effects) ? effects : [];
};

export const getRobotPlantDailyCareStatus = async (authId) => {
  const fallback = {
    dayKey: new Date().toISOString().slice(0, 10),
    wateringCountToday: 0,
    wateringLimitPerDay: 3,
    remainingWatersToday: 3,
  };

  if (!authId) return fallback;

  const dayKey = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("RobotPlantDailyCareAction")
    .select("watering_count")
    .eq("auth_id", authId)
    .eq("day_key", dayKey)
    .maybeSingle();

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const missingTable =
      error?.code === "PGRST201" ||
      error?.code === "PGRST301" ||
      error?.code === "42P01" ||
      message.includes("does not exist") ||
      message.includes("not found");

    if (missingTable) {
      return fallback;
    }

    throw error;
  }

  const wateringCountToday = Math.max(0, Math.min(3, Number(data?.watering_count ?? 0)));
  return {
    dayKey,
    wateringCountToday,
    wateringLimitPerDay: 3,
    remainingWatersToday: Math.max(0, 3 - wateringCountToday),
  };
};

export const purchaseRobotPlantShopItem = async ({ itemId, quantity = 1, eventReference = null }) => {
  const { authId } = await getCurrentAuthContext();

  const { data, error } = await supabase.rpc("robot_plant_purchase_item", {
    p_auth_id: authId,
    p_item_id: itemId,
    p_quantity: quantity,
    p_event_reference: eventReference,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
};

export const useRobotPlantInventoryItem = async ({ itemId, eventReference = null }) => {
  const { authId } = await getCurrentAuthContext();

  const { data, error } = await supabase.rpc("robot_plant_use_inventory_item", {
    p_auth_id: authId,
    p_item_id: itemId,
    p_event_reference: eventReference,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
};

export const waterRobotPlant = async ({ eventReference = null } = {}) => {
  const { authId } = await getCurrentAuthContext();

  const { data, error } = await supabase.rpc("robot_plant_water_plant", {
    p_auth_id: authId,
    p_event_reference: eventReference,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
};
