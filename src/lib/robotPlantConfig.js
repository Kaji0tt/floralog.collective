export const ROBOT_PLANT_VALUES = {
  energy: {
    id: "energy",
    label: "Energy",
    min: 0,
    max: 100,
    initial: 70,
    decayPerDay: 6,
    inactivityExtraDecayPerDay: 8,
    warningThreshold: 35,
    criticalThreshold: 20,
  },
  dataQuality: {
    id: "dataQuality",
    label: "Data Quality",
    min: 0,
    max: 100,
    initial: 65,
    decayPerDay: 4,
    warningThreshold: 32,
    criticalThreshold: 18,
  },
  care: {
    id: "care",
    label: "Care",
    min: 0,
    max: 100,
    initial: 72,
    decayPerDay: 7,
    warningThreshold: 30,
    criticalThreshold: 16,
  },
};

export const ROBOT_PLANT_EVENT_SOURCES = Object.freeze({
  scan: "scan",
  userQuestCompletion: "user_quest_completion",
  weeklyQuestCompletion: "weekly_quest_completion",
  monthlyQuestCompletion: "monthly_quest_completion",
  dailyChallengeCompletion: "daily_challenge_completion",
  shareScan: "share_scan",
  weeklyChallengeParticipation: "weekly_challenge_participation",
  weeklyChallengeLikeReceived: "weekly_challenge_like_received",
  waterPlant: "water_plant",
  fertilizePlant: "fertilize_plant",
  decayTick: "decay_tick",
  shopBoost: "shop_boost",
});

export const REWARD_FORMULA_CONFIG = Object.freeze({
  baseByEvent: {
    [ROBOT_PLANT_EVENT_SOURCES.scan]: 10,
    [ROBOT_PLANT_EVENT_SOURCES.userQuestCompletion]: 22,
    [ROBOT_PLANT_EVENT_SOURCES.weeklyQuestCompletion]: 30,
    [ROBOT_PLANT_EVENT_SOURCES.monthlyQuestCompletion]: 40,
    [ROBOT_PLANT_EVENT_SOURCES.dailyChallengeCompletion]: 35,
    [ROBOT_PLANT_EVENT_SOURCES.shareScan]: 8,
    [ROBOT_PLANT_EVENT_SOURCES.weeklyChallengeParticipation]: 12,
    [ROBOT_PLANT_EVENT_SOURCES.weeklyChallengeLikeReceived]: 4,
    [ROBOT_PLANT_EVENT_SOURCES.waterPlant]: 0,
    [ROBOT_PLANT_EVENT_SOURCES.fertilizePlant]: 0,
    [ROBOT_PLANT_EVENT_SOURCES.decayTick]: 0,
    [ROBOT_PLANT_EVENT_SOURCES.shopBoost]: 0,
  },
  zoneMultiplier: {
    min: 1,
    max: 1.75,
    default: 1,
  },
  noveltyMultiplier: {
    min: 0.7,
    max: 1.5,
    default: 1,
  },
  streakMultiplier: {
    min: 1,
    max: 1.4,
    default: 1,
  },
  dataQualityMultiplier: {
    min: 0.7,
    max: 1.6,
    default: 1,
  },
  careMultiplier: {
    min: 0.7,
    max: 1.5,
    default: 1,
  },
  energyInfluence: {
    noBonusThreshold: 20,
    minRewardMultiplier: 1,
    maxRewardMultiplier: 1.6,
  },
  absoluteMinReward: 1,
  absoluteMaxReward: 250,
});

export const ROBOT_PLANT_SHOP_EFFECTS = Object.freeze({
  antiDecaySmall: {
    id: "anti_decay_small",
    type: "decay_reduction",
    durationHours: 12,
    value: 0.15,
  },
  antiDecayMedium: {
    id: "anti_decay_medium",
    type: "decay_reduction",
    durationHours: 24,
    value: 0.25,
  },
  bonusBoostSmall: {
    id: "bonus_boost_small",
    type: "reward_boost",
    durationHours: 6,
    value: 0.1,
  },
});

export const ROBOT_PLANT_DEFAULT_STATE = Object.freeze({
  energy: ROBOT_PLANT_VALUES.energy.initial,
  dataQuality: ROBOT_PLANT_VALUES.dataQuality.initial,
  care: ROBOT_PLANT_VALUES.care.initial,
  streakDays: 0,
  lastMaintenanceAt: null,
  lastDecayAt: null,
});

export const clampRobotPlantValue = (valueName, value) => {
  const config = ROBOT_PLANT_VALUES[valueName];
  if (!config) return value;
  return Math.max(config.min, Math.min(config.max, value));
};
