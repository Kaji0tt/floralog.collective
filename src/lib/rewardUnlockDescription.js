// Generic, table-driven "how do I unlock this reward" text builder.
// Reads directly off the Rewards row fields so new reward configs get a
// description automatically without touching UI code.

const ZONE_NAMES = {
  water: "Wasserzone",
  forest: "Waldzone",
  meadow: "Wiesenzone",
  urban: "Urbanzone",
};

export const formatRandomChance = (randomChance) => {
  const denominator = Number(randomChance);
  if (!Number.isFinite(denominator) || denominator <= 0) return null;

  return `${Number((100 / denominator).toFixed(2)).toLocaleString("de-DE")}%`;
};

const RANDOM_EVENT_DESCRIPTIONS = {
  scan: "Kann zufällig bei einem Scan freigeschaltet werden",
  weekly_scan: "Kann zufällig bei einem wöchentlichen Scan freigeschaltet werden",
  monthly_scan: "Kann zufällig bei einem monatlichen Scan freigeschaltet werden",
  gift_scan: "Kann zufällig bei einem Geschenk-Scan freigeschaltet werden",
  rare_scan: "Kann zufällig beim Scan einer seltenen Pflanze freigeschaltet werden",
};

export const getZoneRewardRequirementDescription = (reward, { genera = [], plants = [] } = {}) => {
  const genusId = String(reward?.requires_plant_genus_id || "").trim();
  const speciesId = String(reward?.requires_plant_species_id || "").trim();
  const zoneName = ZONE_NAMES[String(reward?.requires_zone_theme || "").trim()];
  const genusName = genusId ? genera.find((genus) => genus.id === genusId)?.genus_name : null;
  const speciesName = speciesId ? plants.find((plant) => plant.id === speciesId)?.species_name : null;
  const plantName = speciesName || genusName;

  return plantName && zoneName ? `Scanne ${plantName} in einer ${zoneName}.` : null;
};

const getQuestRequirementDescription = (quest) => {
  if (!quest) return null;

  const requirement = quest.requirement || quest.description;
  return requirement ? `${quest.title}: ${requirement}` : `Schließe die Quest „${quest.title}“ ab.`;
};

const getAchievementRequirementDescription = (achievement) => {
  if (!achievement) return null;

  const requirement = achievement.requirement || achievement.description;
  return requirement ? `${achievement.title}: ${requirement}` : `Erreiche den Erfolg „${achievement.title}“.`;
};

/**
 * Builds a human-readable "how to unlock this" text purely from Rewards row fields.
 * Optional context (quests/achievements/genera/plants) enables richer, linked descriptions;
 * omit them (e.g. in the Shop) and the generic table-driven text is used instead.
 */
export const buildRewardUnlockDescription = (
  reward,
  {
    quests = [],
    weeklyQuests = [],
    monthlyQuests = [],
    achievements = [],
    genera = [],
    plants = [],
    fallback = "Noch nicht freigeschaltet.",
  } = {}
) => {
  if (!reward) return fallback;

  const specificQuest = quests.find((quest) => quest.id === reward.requires_quest);
  if (specificQuest) return getQuestRequirementDescription(specificQuest);

  const zoneRequirement = getZoneRewardRequirementDescription(reward, { genera, plants });
  if (zoneRequirement) return zoneRequirement;

  if (reward.requires_donor) return "Nur für Unterstützer.";

  const requiredReferrals = Math.max(0, Number(reward.requires_referrals || 0));
  const requiredReferralSeeds = Math.max(0, Number(reward.requires_referred_seeds_progress || 0));
  if (requiredReferrals > 0 && requiredReferralSeeds > 0) {
    return `Wirb ${requiredReferrals} Freund${requiredReferrals > 1 ? "e" : ""} und erreiche mit ${requiredReferrals > 1 ? "ihnen" : "ihm"} jeweils ${requiredReferralSeeds} Samen.`;
  }
  if (requiredReferrals > 0) return `Werbe ${requiredReferrals} Freund${requiredReferrals > 1 ? "e" : ""}.`;

  if (reward.requires_rare_plants) return `Entdecke ${reward.requires_rare_plants} seltene Pflanze${reward.requires_rare_plants > 1 ? "n" : ""}.`;
  if (reward.requires_gifts) return `Erhalte ${reward.requires_gifts} Geschenk${reward.requires_gifts > 1 ? "e" : ""}.`;
  if (reward.requires_weekly_quests) return `Schließe ${reward.requires_weekly_quests} Wochenquest${reward.requires_weekly_quests > 1 ? "s" : ""} ab.`;
  if (reward.requires_monthly_quests) return `Schließe ${reward.requires_monthly_quests} Monatsquest${reward.requires_monthly_quests > 1 ? "s" : ""} ab.`;
  if (reward.requires_quest) return "Schließe die verknüpfte Quest ab.";

  const linkedQuest = [...quests, ...weeklyQuests, ...monthlyQuests].find(
    (quest) => quest.reward_name === reward.name
  );
  if (linkedQuest) return getQuestRequirementDescription(linkedQuest);

  const linkedAchievement = achievements.find((achievement) => achievement.reward_name === reward.name);
  if (linkedAchievement) return getAchievementRequirementDescription(linkedAchievement);

  const randomEventDescription = RANDOM_EVENT_DESCRIPTIONS[reward.random_event];
  const randomChance = formatRandomChance(reward.random_chance);
  if (randomEventDescription) {
    return `${randomEventDescription}${randomChance ? ` (${randomChance} Chance).` : "."}`;
  }

  return fallback;
};
