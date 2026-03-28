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
  const { data, error } = await supabase.functions.invoke("robotPlantGrantReward", {
    body: {
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
