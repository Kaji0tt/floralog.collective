import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import {
  ROBOT_PLANT_DEFAULT_STATE,
  ROBOT_PLANT_EVENT_SOURCES,
} from "@/lib/robotPlantConfig";
import {
  applyRobotPlantDelta,
  buildDecayDelta,
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
  zoneMultiplier,
  noveltyMultiplier,
  streakMultiplier,
  dataQualityMultiplier,
  careMultiplier,
  energyLevel,
}) => {
  return computeRobotPlantReward({
    eventSource,
    zoneMultiplier,
    noveltyMultiplier,
    streakMultiplier,
    dataQualityMultiplier,
    careMultiplier,
    energyLevel,
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

  return data?.result || null;
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
    throw new Error(errMsg);
  }

  return {
    generated: data.cached === false,
    dayKey: data.dayKey,
    zones: data.zones || [],
  };
};
