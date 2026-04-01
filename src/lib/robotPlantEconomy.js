import {
  REWARD_FORMULA_CONFIG,
  ROBOT_PLANT_DATA_QUALITY_RULES,
  ROBOT_PLANT_VALUES,
  clampRobotPlantValue,
} from "@/lib/robotPlantConfig";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const roundReward = (value) => Math.round(value);

const computeEnergyEffectFactor = (energyLevel) => {
  const { noBonusThreshold } = REWARD_FORMULA_CONFIG.energyInfluence;

  const safeEnergy = clamp(Number(energyLevel ?? 0), 0, 100);

  if (safeEnergy <= noBonusThreshold) return 0;

  return (safeEnergy - noBonusThreshold) / (100 - noBonusThreshold);
};

const computeEnergyRewardMultiplier = (energyLevel) => {
  const {
    noBonusThreshold,
    minRewardMultiplier,
    maxRewardMultiplier,
  } = REWARD_FORMULA_CONFIG.energyInfluence;

  const safeEnergy = clamp(Number(energyLevel ?? 0), 0, 100);

  if (safeEnergy <= noBonusThreshold) return minRewardMultiplier;

  const linearFactor = (safeEnergy - noBonusThreshold) / (100 - noBonusThreshold);
  return clamp(
    minRewardMultiplier + linearFactor * (maxRewardMultiplier - minRewardMultiplier),
    minRewardMultiplier,
    maxRewardMultiplier
  );
};

const applyEnergyInfluenceToBonus = (multiplier, energyLevel) => {
  const effectFactor = computeEnergyEffectFactor(energyLevel);
  const safeMultiplier = Number(multiplier ?? 1);
  return 1 + (safeMultiplier - 1) * effectFactor;
};

export const computeRobotPlantReward = ({
  eventSource,
  zoneMultiplier = REWARD_FORMULA_CONFIG.zoneMultiplier.default,
  noveltyMultiplier = REWARD_FORMULA_CONFIG.noveltyMultiplier.default,
  streakMultiplier = REWARD_FORMULA_CONFIG.streakMultiplier.default,
  dataQualityMultiplier = REWARD_FORMULA_CONFIG.dataQualityMultiplier.default,
  careMultiplier = REWARD_FORMULA_CONFIG.careMultiplier.default,
  energyLevel = ROBOT_PLANT_VALUES.energy.initial,
}) => {
  const base = REWARD_FORMULA_CONFIG.baseByEvent[eventSource] ?? 0;

  if (base <= 0) return 0;

  const safeZone = clamp(
    zoneMultiplier,
    REWARD_FORMULA_CONFIG.zoneMultiplier.min,
    REWARD_FORMULA_CONFIG.zoneMultiplier.max
  );
  const safeNovelty = clamp(
    noveltyMultiplier,
    REWARD_FORMULA_CONFIG.noveltyMultiplier.min,
    REWARD_FORMULA_CONFIG.noveltyMultiplier.max
  );
  const safeStreak = clamp(
    streakMultiplier,
    REWARD_FORMULA_CONFIG.streakMultiplier.min,
    REWARD_FORMULA_CONFIG.streakMultiplier.max
  );
  const safeDataQuality = clamp(
    dataQualityMultiplier,
    REWARD_FORMULA_CONFIG.dataQualityMultiplier.min,
    REWARD_FORMULA_CONFIG.dataQualityMultiplier.max
  );
  const safeCare = clamp(
    careMultiplier,
    REWARD_FORMULA_CONFIG.careMultiplier.min,
    REWARD_FORMULA_CONFIG.careMultiplier.max
  );

  const energyRewardMultiplier = computeEnergyRewardMultiplier(energyLevel);
  const energyInfluencedDataQuality = applyEnergyInfluenceToBonus(safeDataQuality, energyLevel);
  const energyInfluencedCare = applyEnergyInfluenceToBonus(safeCare, energyLevel);

  const rawReward =
    base *
    safeZone *
    safeNovelty *
    safeStreak *
    energyInfluencedDataQuality *
    energyInfluencedCare *
    energyRewardMultiplier;
  const boundedReward = clamp(
    roundReward(rawReward),
    REWARD_FORMULA_CONFIG.absoluteMinReward,
    REWARD_FORMULA_CONFIG.absoluteMaxReward
  );

  return boundedReward;
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
