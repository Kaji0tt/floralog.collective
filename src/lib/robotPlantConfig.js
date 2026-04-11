export const ROBOT_PLANT_VALUES = {
  energy: {
    id: "energy",
    label: "Energy",
    min: 0,
    max: 100,
    initial: 70,
    decayPerDay: 5,
    warningThreshold: 35,
    criticalThreshold: 20,
  },
  dataQuality: {
    id: "dataQuality",
    label: "Data Quality",
    min: 0,
    max: 100,
    initial: 65,
    decayPerDay: 5,
    warningThreshold: 32,
    criticalThreshold: 18,
  },
  care: {
    id: "care",
    label: "Care",
    min: 0,
    max: 100,
    initial: 72,
    decayPerDay: 5,
    warningThreshold: 30,
    criticalThreshold: 16,
  },
};

export const ROBOT_PLANT_HEALTH_STATES = Object.freeze([
  {
    minOverallHealth: 90,
    label: "Kraeftig",
    color: "#166534",
    scanEventBonus: 50,
  },
  {
    minOverallHealth: 70,
    label: "Vital",
    color: "#22c55e",
    scanEventBonus: 30,
  },
  {
    minOverallHealth: 45,
    label: "Stabil",
    color: "#e6d111",
    scanEventBonus: 15,
  },
  {
    minOverallHealth: 25,
    label: "Schwach",
    color: "#f97316",
    scanEventBonus: 5,
  },
  {
    minOverallHealth: 0,
    label: "Kritisch",
    color: "#dc2626",
    scanEventBonus: 0,
  },
]);

export const ROBOT_PLANT_EVENT_SOURCES = Object.freeze({
  scan: "scan",
  newScan: "new_scan",
  newGlobalScan: "new_global_scan",
  userQuestCompletion: "user_quest_completion",
  weeklyQuestCompletion: "weekly_quest_completion",
  monthlyQuestCompletion: "monthly_quest_completion",
  dailyChallengeCompletion: "daily_challenge_completion",
  shareScan: "share_scan",
  weeklyChallengeParticipation: "weekly_challenge_participation",
  weeklyChallengeLikeReceived: "weekly_challenge_like_received",
  scanLikeReceived: "scan_like_received",
  waterPlant: "water_plant",
  fertilizePlant: "fertilize_plant",
  decayTick: "decay_tick",
  shopBoost: "shop_boost",
});

export const REWARD_FORMULA_CONFIG = Object.freeze({
  baseByEvent: {
    [ROBOT_PLANT_EVENT_SOURCES.scan]: 10,
    [ROBOT_PLANT_EVENT_SOURCES.newScan]: 30,
    [ROBOT_PLANT_EVENT_SOURCES.newGlobalScan]: 50,
    [ROBOT_PLANT_EVENT_SOURCES.userQuestCompletion]: 22,
    [ROBOT_PLANT_EVENT_SOURCES.weeklyQuestCompletion]: 30,
    [ROBOT_PLANT_EVENT_SOURCES.monthlyQuestCompletion]: 40,
    [ROBOT_PLANT_EVENT_SOURCES.dailyChallengeCompletion]: 35,
    [ROBOT_PLANT_EVENT_SOURCES.shareScan]: 8,
    [ROBOT_PLANT_EVENT_SOURCES.weeklyChallengeParticipation]: 12,
    [ROBOT_PLANT_EVENT_SOURCES.weeklyChallengeLikeReceived]: 20,
    [ROBOT_PLANT_EVENT_SOURCES.scanLikeReceived]: 5,
    [ROBOT_PLANT_EVENT_SOURCES.waterPlant]: 0,
    [ROBOT_PLANT_EVENT_SOURCES.fertilizePlant]: 0,
    [ROBOT_PLANT_EVENT_SOURCES.decayTick]: 0,
    [ROBOT_PLANT_EVENT_SOURCES.shopBoost]: 0,
  },
  zoneMultiplier: {
    min: 0.5,
    max: 1.5,
    default: 1,
    start: 1.5,
    decrementPerAdditionalScan: 0.2,
  },
  noveltyMultiplier: {
    min: 0.2,
    max: 1,
    default: 1,
    decrementPerDuplicateScan: 0.2,
  },
  streakMultiplier: {
    min: 1,
    max: 7,
    default: 1,
    capDays: 7,
  },
  careMultiplier: {
    min: 0.5,
    max: 1.5,
    default: 1,
  },
  firstScanOfDayMultiplier: {
    min: 1,
    max: 2,
    default: 1,
  },
  absoluteMinReward: 1,
  absoluteMaxReward: 350,
});

export const ROBOT_PLANT_GEO_ZONE_CONFIG = Object.freeze({
  // Basic Zone Parameters
  enabled: true,
  dailyZoneCountMin: 0,
  dailyZoneCountMax: 8,
  searchRadiusM: 2500,
  themes: ["forest", "urban", "water", "meadow"],
  
  // Zone Size (circle-based zones)
  zoneRadiusMinM: 50,
  zoneRadiusMaxM: 500,
  zoneBaseMultiplier: 1.5,
  zoneMultiplierFloor: 0.5,
  zoneMultiplierStepDownPerAdditionalScan: 0.2,

  // Energy based zone budget
  zoneCountByEnergyBand: [
    { min: 0, max: 9, zoneCount: 0 },
    { min: 10, max: 19, zoneCount: 1 },
    { min: 20, max: 29, zoneCount: 2 },
    { min: 30, max: 39, zoneCount: 3 },
    { min: 40, max: 49, zoneCount: 4 },
    { min: 50, max: 59, zoneCount: 5 },
    { min: 60, max: 69, zoneCount: 6 },
    { min: 70, max: 79, zoneCount: 7 },
    { min: 80, max: 100, zoneCount: 8 },
  ],
  rerollsByEnergyBand: [
    { min: 80, max: 89, rerolls: 1 },
    { min: 90, max: 99, rerolls: 2 },
    { min: 100, max: 100, rerolls: 4 },
  ],
  
  // OSM Query Parameters
  classificationRadiusM: 120, // Reduced from 400 for tighter matching
  positionRoundingDecimals: 3,
  
  // Rate-Limit & Reliability
  maxOsmCallsPerGeneration: 4, // Strict per-user daily limit
  osmQueryTimeoutMs: 8000,
  osmMaxFeaturesPerQuery: 5,
  osmCacheTtlHours: 24,
  osmRetryAttempts: 2,
  osmRetryBackoffMs: 500,
  
  // Candidate Selection
  candidateAttempts: 10,
  sourceFeaturesPerThemeMin: 1,
  sourceFeaturesPerThemeMax: 2,
  confidenceMin: 0.6,
  
  // Theme Weighting
  themeBonusByTheme: {
    forest: 1.16,
    urban: 1.12,
    water: 1.2,
    meadow: 1.14,
  },
  
  // Anti-Spoofing
  cooldownSeconds: 180,
  maxPlausibleSpeedKmh: 130,
  maxGpsAccuracyM: 80,
  
  // Fallback Mode (if OSM fails)
  fallbackToSimpleCircles: true,
  fallbackThemeDistribution: {
    forest: 0.35,
    urban: 0.25,
    water: 0.2,
    meadow: 0.2,
  },
});

export const ROBOT_PLANT_CARE_RULES = Object.freeze({
  gainBoostThreshold: 90,
  gainBoostMultiplier: 2,
  decayReductionByCareThreshold: [
    { min: 100, reduction: 0.8 },
    { min: 90, reduction: 0.5 },
    { min: 80, reduction: 0.25 },
  ],
});

export const ROBOT_PLANT_GAIN_RULES = Object.freeze({
  energy: {
    metersPerPoint: 100,
    maxPerDay: 15,
  },
  care: {
    wateringByRepeatIndex: [3, 2, 1],
  },
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
