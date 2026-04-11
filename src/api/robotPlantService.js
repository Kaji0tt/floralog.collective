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
  const delta = buildDecayDelta({ hoursSinceLastDecay, decayReduction });
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

export const getRobotPlantDailyZones = async ({ latitude, longitude, forceRegenerate = false }) => {
  const { authId, userEmail } = await getCurrentAuthContext();

  console.log("[getRobotPlantDailyZones] Calling function with:", {
    latitude,
    longitude,
    forceRegenerate,
    authId: authId?.substring(0, 8) + "...",
  });

  const { data, error } = await supabase.functions.invoke("robotPlantDailyZones", {
    body: {
      authId,
      userEmail,
      latitude,
      longitude,
      forceRegenerate,
    },
  });

  if (error) {
    console.error("[getRobotPlantDailyZones] Function error:", error);
    throw error;
  }

  console.log("[getRobotPlantDailyZones] Response:", { success: data?.success, cached: data?.cached, zoneCount: data?.zones?.length });

  if (!data?.success || !Array.isArray(data?.zones)) {
    const errMsg = data?.error || "Failed to load daily zones";
    console.error("[getRobotPlantDailyZones] Error response:", errMsg);
    const err = new Error(errMsg);
    err.rateLimited = data?.rateLimited === true;
    throw err;
  }

  return {
    generated: data.cached === false,
    dayKey: data.dayKey,
    zones: data.zones || [],
    rerollsRemainingToday: data.rerollsRemainingToday ?? null,
  };
};
