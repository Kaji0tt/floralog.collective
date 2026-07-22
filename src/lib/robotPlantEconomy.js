import {
  REWARD_FORMULA_CONFIG,
  ROBOT_PLANT_EVENT_SOURCES,
  ROBOT_PLANT_HEALTH_STATES,
  ROBOT_PLANT_VALUES,
  ROBOT_PLANT_GAIN_RULES,
  ROBOT_PLANT_GEO_ZONE_CONFIG,
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

const NORMALIZED_RARITY_MULTIPLIERS = Object.freeze({
  haufig: 1,
  haeufig: 1,
  gelegentlich: 2,
  selten: 3,
  sehrselten: 3,
  extremselten: 3,
});

const normalizeRarityKey = (rarity) =>
  String(rarity ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

export const isRobotPlantScanEvent = (eventSource) => SCAN_EVENT_SOURCES.has(eventSource);

export const computeRarityMultiplier = (rarity) => {
  const normalizedRarity = normalizeRarityKey(rarity);
  return NORMALIZED_RARITY_MULTIPLIERS[normalizedRarity] ?? 1;
};

export const computeZoneMultiplierFromScanCount = (scanCountInZoneToday = 0) => {
  const safeCount = Math.max(0, Number(scanCountInZoneToday ?? 0));
  const decremented =
    REWARD_FORMULA_CONFIG.zoneMultiplier.start -
    safeCount * REWARD_FORMULA_CONFIG.zoneMultiplier.decrementPerAdditionalScan;

  return clamp(
    decremented,
    REWARD_FORMULA_CONFIG.zoneMultiplier.min,
    REWARD_FORMULA_CONFIG.zoneMultiplier.max
  );
};

export const computeZoneMultiplier = ({
  isInActiveZone = true,
  scanCountInZoneToday = null,
}) => {
  if (!isInActiveZone) {
    return REWARD_FORMULA_CONFIG.zoneMultiplier.default;
  }

  if (scanCountInZoneToday !== null && scanCountInZoneToday !== undefined) {
    return computeZoneMultiplierFromScanCount(scanCountInZoneToday);
  }

  return REWARD_FORMULA_CONFIG.zoneMultiplier.start;
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
  const safeCare = clamp(Number(careValue ?? 0), 0, 100);
  return clamp(
    1 + safeCare / 100,
    REWARD_FORMULA_CONFIG.careMultiplier.min,
    REWARD_FORMULA_CONFIG.careMultiplier.max
  );
};

export const computeRecoveryMultiplier = (currentValue = 0) => {
  const safeValue = clamp(Number(currentValue ?? 0), 0, 100);

  if (safeValue < 50) {
    return 3;
  }

  if (safeValue < 75) {
    return 2;
  }

  return 1;
};

export const computeOverallPlantHealth = ({
  energyValue = ROBOT_PLANT_VALUES.energy.initial,
  dataQualityValue = ROBOT_PLANT_VALUES.dataQuality.initial,
  careValue = ROBOT_PLANT_VALUES.care.initial,
}) => {
  const safeEnergy = clamp(Number(energyValue ?? 0), 0, 100);
  const safeDataQuality = clamp(Number(dataQualityValue ?? 0), 0, 100);
  const safeCare = clamp(Number(careValue ?? 0), 0, 100);

  if (safeEnergy <= 0 || safeDataQuality <= 0 || safeCare <= 0) {
    return 0;
  }

  return roundReward(3 / (1 / safeEnergy + 1 / safeDataQuality + 1 / safeCare));
};

export const computePlantHealthState = ({
  overallPlantHealth = null,
  energyValue = ROBOT_PLANT_VALUES.energy.initial,
  dataQualityValue = ROBOT_PLANT_VALUES.dataQuality.initial,
  careValue = ROBOT_PLANT_VALUES.care.initial,
} = {}) => {
  const resolvedOverallPlantHealth =
    overallPlantHealth === null || overallPlantHealth === undefined
      ? computeOverallPlantHealth({ energyValue, dataQualityValue, careValue })
      : clamp(Number(overallPlantHealth ?? 0), 0, 100);

  return (
    ROBOT_PLANT_HEALTH_STATES.find((state) => resolvedOverallPlantHealth >= state.minOverallHealth) ||
    ROBOT_PLANT_HEALTH_STATES[ROBOT_PLANT_HEALTH_STATES.length - 1]
  );
};

export const computeHealthStateScanBonus = ({
  overallPlantHealth = null,
  energyValue = ROBOT_PLANT_VALUES.energy.initial,
  dataQualityValue = ROBOT_PLANT_VALUES.dataQuality.initial,
  careValue = ROBOT_PLANT_VALUES.care.initial,
} = {}) => {
  return computePlantHealthState({
    overallPlantHealth,
    energyValue,
    dataQualityValue,
    careValue,
  }).scanEventBonus;
};

export const computeStreakMultiplier = (streakDays = 0) => {
  const safeDays = Math.max(0, Number(streakDays ?? 0));
  return clamp(
    safeDays <= 1 ? 1 : safeDays,
    REWARD_FORMULA_CONFIG.streakMultiplier.min,
    REWARD_FORMULA_CONFIG.streakMultiplier.max
  );
};

export const computeFirstScanOfDayMultiplier = (isFirstScanOfDay = false) => {
  return isFirstScanOfDay
    ? REWARD_FORMULA_CONFIG.firstScanOfDayMultiplier.max
    : REWARD_FORMULA_CONFIG.firstScanOfDayMultiplier.default;
};

export const computeDailyFirstScanMultiplier = (isFirstScanOfDay = false) => {
  return computeFirstScanOfDayMultiplier(isFirstScanOfDay);
};

export const computeDecayReductionFromCare = () => {
  return 0;
};

export const computeDailyEnergyGainFromMeters = (meters = 0) => {
  const safeMeters = Math.max(0, Number(meters ?? 0));
  const points = Math.floor(safeMeters / ROBOT_PLANT_GAIN_RULES.energy.metersPerPoint);
  return clamp(points, 0, ROBOT_PLANT_GAIN_RULES.energy.maxPerDay);
};

export const computeDailyEnergyZoneBudget = (energyValue = ROBOT_PLANT_VALUES.energy.initial) => {
  const safeEnergy = clamp(Number(energyValue ?? 0), 0, 100);
  const band = ROBOT_PLANT_GEO_ZONE_CONFIG.zoneCountByEnergyBand.find(
    (entry) => safeEnergy >= entry.min && safeEnergy <= entry.max
  );
  return band?.zoneCount ?? ROBOT_PLANT_GEO_ZONE_CONFIG.dailyZoneCountMin;
};

export const computeZoneRerollsFromEnergy = (energyValue = ROBOT_PLANT_VALUES.energy.initial) => {
  const safeEnergy = clamp(Number(energyValue ?? 0), 0, 100);
  const band = ROBOT_PLANT_GEO_ZONE_CONFIG.rerollsByEnergyBand.find(
    (entry) => safeEnergy >= entry.min && safeEnergy <= entry.max
  );
  return band?.rerolls ?? 0;
};

export const computeScaledZoneRadius = ({ baseRadiusM, energyValue = ROBOT_PLANT_VALUES.energy.initial }) => {
  const safeRadius = Math.max(0, Number(baseRadiusM ?? 0));
  const safeEnergy = clamp(Number(energyValue ?? 0), 0, 100);
  return Math.round(safeRadius * (1 + safeEnergy / 100));
};

export const computeRobotPlantRewardBreakdown = ({
  eventSource,
  duplicateScanCount = 0,
  energyValue = ROBOT_PLANT_VALUES.energy.initial,
  dataQualityValue = ROBOT_PLANT_VALUES.dataQuality.initial,
  careValue = ROBOT_PLANT_VALUES.care.initial,
  streakDays = 0,
  isInActiveZone = true,
  rarity = null,
  isFirstScanOfDay = false,
}) => {
  const baseReward = REWARD_FORMULA_CONFIG.baseByEvent[eventSource] ?? 0;

  if (baseReward <= 0) {
    return {
      eventSource,
      isScanReward: false,
      isInActiveZone: false,
      baseReward: 0,
      adjustedBaseReward: 0,
      healthStateLabel: computePlantHealthState({ energyValue, dataQualityValue, careValue }).label,
      healthStateBonus: 0,
      zoneMultiplier: 1,
      rarityMultiplier: 1,
      noveltyMultiplier: 1,
      careMultiplier: 1,
      streakMultiplier: 1,
      firstScanOfDayMultiplier: 1,
      preStreakReward: 0,
      finalReward: 0,
    };
  }

  if (!isRobotPlantScanEvent(eventSource)) {
    const reward = Math.max(
      REWARD_FORMULA_CONFIG.absoluteMinReward,
      roundReward(baseReward)
    );

    return {
      eventSource,
      isScanReward: false,
      isInActiveZone: false,
      baseReward,
      adjustedBaseReward: reward,
      healthStateLabel: computePlantHealthState({ energyValue, dataQualityValue, careValue }).label,
      healthStateBonus: 0,
      zoneMultiplier: 1,
      rarityMultiplier: 1,
      noveltyMultiplier: 1,
      careMultiplier: 1,
      streakMultiplier: 1,
      firstScanOfDayMultiplier: 1,
      preStreakReward: reward,
      finalReward: reward,
    };
  }

  const zoneMultiplier = computeZoneMultiplier({ isInActiveZone });
  const rarityMultiplier = computeRarityMultiplier(rarity);
  const noveltyMultiplier = computeNoveltyMultiplier(duplicateScanCount);
  const careMultiplier = computeCareMultiplier(careValue);
  const healthState = computePlantHealthState({ energyValue, dataQualityValue, careValue });
  const healthStateBonus = healthState.scanEventBonus;
  const adjustedBaseReward = baseReward + healthStateBonus;
  const streakMultiplier = computeStreakMultiplier(streakDays);
  const firstScanOfDayMultiplier = computeFirstScanOfDayMultiplier(isFirstScanOfDay);

  const rawPreStreakReward =
    adjustedBaseReward * zoneMultiplier * rarityMultiplier * noveltyMultiplier * careMultiplier * firstScanOfDayMultiplier;
  const preStreakReward = Math.max(
    REWARD_FORMULA_CONFIG.absoluteMinReward,
    roundReward(rawPreStreakReward)
  );
  const finalReward = roundReward(preStreakReward * streakMultiplier);

  return {
    eventSource,
    isScanReward: true,
    isInActiveZone,
    baseReward,
    adjustedBaseReward,
    healthStateLabel: healthState.label,
    healthStateBonus,
    zoneMultiplier: roundMultiplier(zoneMultiplier),
    rarityMultiplier,
    noveltyMultiplier: roundMultiplier(noveltyMultiplier),
    careMultiplier: roundMultiplier(careMultiplier),
    streakMultiplier: roundMultiplier(streakMultiplier),
    firstScanOfDayMultiplier: roundMultiplier(firstScanOfDayMultiplier),
    preStreakReward,
    finalReward,
  };
};

export const computeRobotPlantReward = ({
  eventSource,
  duplicateScanCount = 0,
  energyValue = ROBOT_PLANT_VALUES.energy.initial,
  dataQualityValue = ROBOT_PLANT_VALUES.dataQuality.initial,
  careValue = ROBOT_PLANT_VALUES.care.initial,
  streakDays = 0,
  isInActiveZone = true,
  rarity = null,
}) => {
  return computeRobotPlantRewardBreakdown({
    eventSource,
    duplicateScanCount,
    energyValue,
    dataQualityValue,
    careValue,
    streakDays,
    isInActiveZone,
    rarity,
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

export const buildDecayDelta = ({
  hoursSinceLastDecay = 24,
  decayReduction = 0,
  overallHealth = (ROBOT_PLANT_VALUES.energy.initial + ROBOT_PLANT_VALUES.dataQuality.initial + ROBOT_PLANT_VALUES.care.initial) / 3,
}) => {
  const safeReduction = clamp(decayReduction, 0, 0.9);
  const dayFactor = Math.max(0, hoursSinceLastDecay) / 24;
  const safeOverallHealth = clamp(
    Number(overallHealth),
    0,
    100
  );
  const baseDailyDecay = Math.max(1, Math.floor(safeOverallHealth / 10));
  const effectiveDecay = Math.max(1, Math.round(baseDailyDecay * dayFactor * (1 - safeReduction)));
  const delta = {};

  Object.entries(ROBOT_PLANT_VALUES).forEach(([key, config]) => {
    if (!config) return;
    delta[key] = -effectiveDecay;
  });

  return delta;
};

export const applyGainBoostToDelta = (deltaValue = 0, careValue = ROBOT_PLANT_VALUES.care.initial) => {
  void careValue;
  return Math.round(Number(deltaValue ?? 0));
};
