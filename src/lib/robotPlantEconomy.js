import {
  REWARD_FORMULA_CONFIG,
  ROBOT_PLANT_EVENT_SOURCES,
  ROBOT_PLANT_DATA_QUALITY_RULES,
  ROBOT_PLANT_VALUES,
  clampRobotPlantValue,
} from "@/lib/robotPlantConfig";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const roundReward = (value) => Math.round(value);

const roundMultiplier = (value) => Math.round(value * 100) / 100;

const lerpMultiplier = (value, min, max) => {
  const safeValue = clamp(Number(value ?? 0), 0, 100);
  return min + (safeValue / 100) * (max - min);
};

const SCAN_EVENT_SOURCES = new Set([
  ROBOT_PLANT_EVENT_SOURCES.scan,
  ROBOT_PLANT_EVENT_SOURCES.newScan,
  ROBOT_PLANT_EVENT_SOURCES.newGlobalScan,
]);

export const isRobotPlantScanEvent = (eventSource) => SCAN_EVENT_SOURCES.has(eventSource);

export const computeZoneMultiplier = ({ dataQualityValue, isInActiveZone = true }) => {
  if (!isInActiveZone) {
    return REWARD_FORMULA_CONFIG.zoneMultiplier.default;
  }

  return lerpMultiplier(
    dataQualityValue,
    REWARD_FORMULA_CONFIG.zoneMultiplier.min,
    REWARD_FORMULA_CONFIG.zoneMultiplier.max
  );
};

export const computeNoveltyMultiplier = (duplicateScanCount = 0) => {
  const safeCount = Math.max(0, Number(duplicateScanCount ?? 0));
  const value =
    REWARD_FORMULA_CONFIG.noveltyMultiplier.max -
    safeCount * REWARD_FORMULA_CONFIG.noveltyMultiplier.decrementPerDuplicateScan;

  return clamp(
    value,
    REWARD_FORMULA_CONFIG.noveltyMultiplier.min,
    REWARD_FORMULA_CONFIG.noveltyMultiplier.max
  );
};

export const computeCareMultiplier = (careValue = ROBOT_PLANT_VALUES.care.initial) => {
  return lerpMultiplier(
    careValue,
    REWARD_FORMULA_CONFIG.careMultiplier.min,
    REWARD_FORMULA_CONFIG.careMultiplier.max
  );
};

export const computeEnergyMultiplier = (energyValue = ROBOT_PLANT_VALUES.energy.initial) => {
  return lerpMultiplier(
    energyValue,
    REWARD_FORMULA_CONFIG.energyMultiplier.min,
    REWARD_FORMULA_CONFIG.energyMultiplier.max
  );
};

export const computeStreakMultiplier = (streakDays = 0) => {
  const safeDays = Math.max(0, Number(streakDays ?? 0));
  return clamp(
    safeDays <= 1 ? 1 : safeDays,
    REWARD_FORMULA_CONFIG.streakMultiplier.min,
    REWARD_FORMULA_CONFIG.streakMultiplier.max
  );
};

export const computeRobotPlantRewardBreakdown = ({
  eventSource,
  dataQualityValue = ROBOT_PLANT_VALUES.dataQuality.initial,
  duplicateScanCount = 0,
  careValue = ROBOT_PLANT_VALUES.care.initial,
  energyValue = ROBOT_PLANT_VALUES.energy.initial,
  streakDays = 0,
  isInActiveZone = true,
}) => {
  const baseReward = REWARD_FORMULA_CONFIG.baseByEvent[eventSource] ?? 0;

  if (baseReward <= 0) {
    return {
      eventSource,
      isScanReward: false,
      isInActiveZone: false,
      baseReward: 0,
      zoneMultiplier: 1,
      noveltyMultiplier: 1,
      careMultiplier: 1,
      energyMultiplier: 1,
      streakMultiplier: 1,
      preStreakReward: 0,
      finalReward: 0,
    };
  }

  if (!isRobotPlantScanEvent(eventSource)) {
    const reward = clamp(
      roundReward(baseReward),
      REWARD_FORMULA_CONFIG.absoluteMinReward,
      REWARD_FORMULA_CONFIG.absoluteMaxReward
    );

    return {
      eventSource,
      isScanReward: false,
      isInActiveZone: false,
      baseReward,
      zoneMultiplier: 1,
      noveltyMultiplier: 1,
      careMultiplier: 1,
      energyMultiplier: 1,
      streakMultiplier: 1,
      preStreakReward: reward,
      finalReward: reward,
    };
  }

  const zoneMultiplier = computeZoneMultiplier({ dataQualityValue, isInActiveZone });
  const noveltyMultiplier = computeNoveltyMultiplier(duplicateScanCount);
  const careMultiplier = computeCareMultiplier(careValue);
  const energyMultiplier = computeEnergyMultiplier(energyValue);
  const streakMultiplier = computeStreakMultiplier(streakDays);

  const rawPreStreakReward =
    baseReward * zoneMultiplier * noveltyMultiplier * careMultiplier * energyMultiplier;
  const preStreakReward = clamp(
    roundReward(rawPreStreakReward),
    REWARD_FORMULA_CONFIG.absoluteMinReward,
    REWARD_FORMULA_CONFIG.absoluteMaxReward
  );
  const finalReward = roundReward(preStreakReward * streakMultiplier);

  return {
    eventSource,
    isScanReward: true,
    isInActiveZone,
    baseReward,
    zoneMultiplier: roundMultiplier(zoneMultiplier),
    noveltyMultiplier: roundMultiplier(noveltyMultiplier),
    careMultiplier: roundMultiplier(careMultiplier),
    energyMultiplier: roundMultiplier(energyMultiplier),
    streakMultiplier: roundMultiplier(streakMultiplier),
    preStreakReward,
    finalReward,
  };
};

export const computeRobotPlantReward = ({
  eventSource,
  dataQualityValue = ROBOT_PLANT_VALUES.dataQuality.initial,
  duplicateScanCount = 0,
  careValue = ROBOT_PLANT_VALUES.care.initial,
  energyValue = ROBOT_PLANT_VALUES.energy.initial,
  streakDays = 0,
  isInActiveZone = true,
}) => {
  return computeRobotPlantRewardBreakdown({
    eventSource,
    dataQualityValue,
    duplicateScanCount,
    careValue,
    energyValue,
    streakDays,
    isInActiveZone,
  }).finalReward;
};

export const applyRobotPlantDelta = (state, delta) => {
  const nextState = { ...state };

  Object.keys(ROBOT_PLANT_VALUES).forEach((key) => {
    const baseValue = Number(nextState[key] ?? 0);
    const change = Number(delta?.[key] ?? 0);
    nextState[key] = clampRobotPlantValue(key, baseValue + change);
  });

  return nextState;
};

export const buildDecayDelta = ({ hoursSinceLastDecay = 24, decayReduction = 0 }) => {
  const safeReduction = clamp(decayReduction, 0, 0.9);
  const dayFactor = Math.max(0, hoursSinceLastDecay) / 24;
  const delta = {};

  Object.entries(ROBOT_PLANT_VALUES).forEach(([key, config]) => {
    const effectiveDecay = config.decayPerDay * dayFactor * (1 - safeReduction);
    delta[key] = -Math.round(effectiveDecay);
  });

  return delta;
};

export const computeDataQualityDeltaFromZoneDiversity = ({
  hasVisitedZoneToday,
  hasVisitedThemeToday,
  distinctThemeCountToday,
  accumulatedDailyDataQualityDelta = 0,
}) => {
  const rules = ROBOT_PLANT_DATA_QUALITY_RULES;

  let delta = 0;

  delta += hasVisitedZoneToday ? rules.repeatedZoneDelta : rules.newZoneDelta;
  delta += hasVisitedThemeToday ? rules.repeatedThemeDelta : rules.newThemeDelta;

  if (
    !hasVisitedThemeToday &&
    distinctThemeCountToday + 1 >= rules.distinctThemesForVarietyBonus
  ) {
    delta += rules.varietyBonusDelta;
  }

  const remainingBudget = Math.max(
    0,
    rules.maxDailyDataQualityFromZones - accumulatedDailyDataQualityDelta
  );

  return clamp(delta, 0, remainingBudget);
};
