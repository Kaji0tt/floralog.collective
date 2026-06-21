import { LOGO_ACCESSORY_SECTIONS } from "@/lib/logoAccessoryAssets";

const LOGO_ACCESSORY_REWARD_TYPES = new Set(["logo_accessory", "accessory"]);
const PROFILE_EFFECT_REWARD_TYPES = new Set(["profile_effect"]);
const LOGO_EFFECT_REWARD_TYPES = new Set(["logo_effect"]);
const DEFAULT_ACCESSORY_SPARK_SHOP_PRICES = new Map([
  ["face_sus", 10],
  ["face_annoyed", 10],
  ["face_v", 10],
]);

const normalizeAccessoryId = (value) => String(value || "").trim().toLowerCase();

const normalizeRewardType = (reward) => String(reward?.type || reward?.reward_type || reward?.kind || "").trim().toLowerCase();

const normalizeAccessoryRewardType = (reward) => normalizeRewardType(reward);

const extractAccessoryIdCandidate = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  const withoutQuery = raw.split("?")[0].split("#")[0];
  const lastPathSegment = withoutQuery.split("/").pop() || withoutQuery;
  const withoutExtension = lastPathSegment.replace(/\.(png|jpe?g|gif|webp|svg)$/i, "");

  if (!withoutExtension) return "";
  if (withoutExtension.startsWith("reward_logo_accessory_")) return withoutExtension.replace(/^reward_logo_accessory_/, "");
  if (withoutExtension.startsWith("reward_accessory_")) return withoutExtension.replace(/^reward_accessory_/, "");
  if (withoutExtension.startsWith("logo_accessory_")) return withoutExtension.replace(/^logo_accessory_/, "");
  if (withoutExtension.startsWith("accessory_")) return withoutExtension.replace(/^accessory_/, "");

  const embeddedMatch = withoutExtension.match(/(face_[a-z0-9_]+|plant_[a-z0-9_]+|border_[a-z0-9_]+)/i);
  if (embeddedMatch?.[1]) return embeddedMatch[1].toLowerCase();

  return withoutExtension;
};

const looksLikeAccessoryId = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.startsWith("face_") || normalized.startsWith("plant_") || normalized.startsWith("border_");
};

const isLikelyAccessoryReward = (reward) => {
  if (!reward) return false;
  if (LOGO_ACCESSORY_REWARD_TYPES.has(normalizeAccessoryRewardType(reward))) return true;

  const name = String(reward?.name || "").trim().toLowerCase();
  const valueCandidate = extractAccessoryIdCandidate(reward?.value);

  return name.startsWith("accessory_") || name.startsWith("logo_accessory_") || looksLikeAccessoryId(valueCandidate);
};

const normalizeAccessoryTarget = (value) => {
  const candidate = extractAccessoryIdCandidate(value);
  return normalizeRewardAccessoryValue(candidate);
};

const getRewardAccessoryIds = (reward) => {
  if (!isLikelyAccessoryReward(reward)) return [];

  const candidates = [reward?.value, reward?.name, reward?.display_name]
    .map((entry) => normalizeAccessoryTarget(entry))
    .filter((entry) => looksLikeAccessoryId(entry));

  return Array.from(new Set(candidates));
};

const rewardMatchesAccessory = (reward, accessoryId) => {
  const normalizedAccessory = normalizeAccessoryId(accessoryId);
  if (!normalizedAccessory) return false;
  return getRewardAccessoryIds(reward).includes(normalizedAccessory);
};

const normalizeRewardAccessoryValue = (value) => {
  const normalized = normalizeAccessoryId(value);
  if (!normalized) return "";
  if (normalized.startsWith("face_") || normalized.startsWith("plant_") || normalized.startsWith("border_")) {
    return normalized;
  }

  // Backward-compatible shorthand support, e.g. "blush" -> "face_blush".
  return `face_${normalized}`;
};

const COLOR_ROWS = [
  {
    threshold: 5,
    colors: ["rgb(199, 209, 163)", "rgb(196, 178, 143)", "rgb(143, 196, 178)", "rgb(196, 143, 143)"],
    label: "ab 5 Scans",
  },
  {
    threshold: 10,
    colors: ["rgb(176, 72, 72)", "rgb(176, 159, 72)", "rgb(115, 158, 63)", "rgb(227, 197, 84)"],
    label: "ab 10 Scans",
  },
  {
    threshold: 20,
    colors: ["rgb(97, 36, 31)", "rgb(31, 92, 97)", "rgb(74, 55, 21)", "rgb(30, 54, 8)"],
    label: "ab 20 Scans",
  },
];

const dedupeByValue = (options) => {
  const seen = new Set();
  return options.filter((option) => {
    const value = String(option?.value ?? "").trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const normalizeTitleCandidate = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (text === "0" || lower === "null" || lower === "undefined") return "";
  return text;
};

const looksLikeImageOrUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/^https?:\/\//i.test(text)) return true;
  if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(text)) return true;
  return false;
};

export const resolveTitleValue = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizeTitleCandidate(candidate);
    if (normalized) return normalized;
  }
  return "";
};

export const getUnlockedColorBackgrounds = (scannedPlantsCount = 0) => {
  const normalizedCount = Number(scannedPlantsCount || 0);

  return COLOR_ROWS.flatMap((row) => {
    const isUnlocked = normalizedCount >= row.threshold;

    return row.colors.map((color) => ({
      id: `color:${color}`,
      type: "color",
      value: color,
      label: color,
      unlockLabel: row.label,
      threshold: row.threshold,
      isLocked: !isUnlocked,
      unlockCondition: !isUnlocked ? `Scanne ${row.threshold} Pflanzen (${normalizedCount}/${row.threshold}).` : null,
    }));
  });
};

const getBackgroundUnlockCondition = (reward) => {
  if (!reward) return null;

  if (reward?.requires_donor) return "Nur fuer Unterstuetzer freischaltbar.";

  const requiredReferrals = Math.max(0, Number(reward?.requires_referrals || 0));
  if (requiredReferrals > 0) {
    return `Wirb ${requiredReferrals} Freund${requiredReferrals > 1 ? "e" : ""}.`;
  }

  const requiredRarePlants = Math.max(0, Number(reward?.requires_rare_plants || 0));
  if (requiredRarePlants > 0) {
    return `Entdecke ${requiredRarePlants} seltene Pflanze${requiredRarePlants > 1 ? "n" : ""}.`;
  }

  const requiredWeeklyQuests = Math.max(0, Number(reward?.requires_weekly_quests || 0));
  if (requiredWeeklyQuests > 0) {
    return `Nimm an ${requiredWeeklyQuests} Wochenquests teil.`;
  }

  if (reward?.requires_quest) {
    return "Schliesse eine Quest ab.";
  }

  return "Noch nicht freigeschaltet.";
};

const getProfileEffectUnlockCondition = (reward) => {
  if (!reward) return null;

  if (reward?.requires_donor) return "Nur fuer Unterstuetzer freischaltbar.";

  const requiredReferrals = Math.max(0, Number(reward?.requires_referrals || 0));
  if (requiredReferrals > 0) {
    return `Wirb ${requiredReferrals} Freund${requiredReferrals > 1 ? "e" : ""}.`;
  }

  const requiredRarePlants = Math.max(0, Number(reward?.requires_rare_plants || 0));
  if (requiredRarePlants > 0) {
    return `Entdecke ${requiredRarePlants} seltene Pflanze${requiredRarePlants > 1 ? "n" : ""}.`;
  }

  const requiredWeeklyQuests = Math.max(0, Number(reward?.requires_weekly_quests || 0));
  if (requiredWeeklyQuests > 0) {
    return `Nimm an ${requiredWeeklyQuests} Wochenquests teil.`;
  }

  if (reward?.requires_quest) {
    return "Schliesse eine Quest ab.";
  }

  return "Noch nicht freigeschaltet.";
};

const getProfileEffectPurchaseMeta = (reward) => {
  const configuredSparkPrice = Number(reward?.spark_price || 0);
  const sparkPrice = Number.isFinite(configuredSparkPrice) && configuredSparkPrice > 0
    ? Math.round(configuredSparkPrice)
    : 0;

  const configuredAmberPrice = Number(reward?.amber_price || 0);
  const amberPrice = Number.isFinite(configuredAmberPrice) && configuredAmberPrice > 0
    ? Math.round(configuredAmberPrice)
    : null;

  if (sparkPrice <= 0 && !amberPrice) return null;

  return {
    isPurchasable: true,
    sparkPrice,
    amberPrice,
  };
};

export const getUnlockedProfileEffectOptions = ({ rewards = [], userRewards = [] } = {}) => {
  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((entry) => entry?.reward_id).filter(Boolean)
  );

  return (Array.isArray(rewards) ? rewards : [])
    .filter((reward) => PROFILE_EFFECT_REWARD_TYPES.has(normalizeRewardType(reward)) && reward?.value)
    .map((reward) => {
      const isLocked = !unlockedRewardIds.has(reward?.id);
      const purchaseMeta = isLocked ? getProfileEffectPurchaseMeta(reward) : null;

      return {
        id: `reward-profile-effect:${reward.id}`,
        rewardId: reward.id,
        type: "profile_effect",
        value: String(reward.value),
        label: reward.display_name || reward.value,
        profileField: "selected_profile_effect",
        purchaseKind: "profile_effect",
        source: "reward",
        isLocked,
        unlockCondition: isLocked ? getProfileEffectUnlockCondition(reward) : null,
        ...(purchaseMeta || {}),
      };
    })
    .sort((left, right) => String(left.label || "").localeCompare(String(right.label || ""), "de"));
};

export const getUnlockedLogoEffectOptions = ({ rewards = [], userRewards = [] } = {}) => {
  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((entry) => entry?.reward_id).filter(Boolean)
  );

  return (Array.isArray(rewards) ? rewards : [])
    .filter((reward) => LOGO_EFFECT_REWARD_TYPES.has(normalizeRewardType(reward)) && reward?.value)
    .map((reward) => {
      const isLocked = !unlockedRewardIds.has(reward?.id);
      const purchaseMeta = isLocked ? getProfileEffectPurchaseMeta(reward) : null;

      return {
        id: `reward-logo-effect:${reward.id}`,
        rewardId: reward.id,
        type: "logo_effect",
        value: String(reward.value),
        label: reward.display_name || reward.value,
        profileField: "selected_logo_effect",
        purchaseKind: "logo_effect",
        source: "reward",
        isLocked,
        unlockCondition: isLocked ? getProfileEffectUnlockCondition(reward) : null,
        ...(purchaseMeta || {}),
      };
    })
    .sort((left, right) => String(left.label || "").localeCompare(String(right.label || ""), "de"));
};

export const getUnlockedTitleOptions = ({
  achievements = [],
  userAchievements = [],
  rewards = [],
  userRewards = [],
} = {}) => {
  const rewardsByName = new Map(
    (Array.isArray(rewards) ? rewards : [])
      .filter((reward) => !!reward?.name)
      .map((reward) => [String(reward.name), reward])
  );

  const unlockedAchievementIds = new Set(
    (Array.isArray(userAchievements) ? userAchievements : []).map((entry) => entry?.achievement_id).filter(Boolean)
  );
  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((entry) => entry?.reward_id).filter(Boolean)
  );

  const achievementTitles = (Array.isArray(achievements) ? achievements : [])
    .filter((achievement) => unlockedAchievementIds.has(achievement?.id))
    .map((achievement) => {
      const linkedReward = achievement?.reward_name ? rewardsByName.get(String(achievement.reward_name)) : null;
      const linkedRewardType = String(
        linkedReward?.type || linkedReward?.reward_type || linkedReward?.kind || ""
      ).trim().toLowerCase();

      if (linkedReward && linkedRewardType && linkedRewardType !== "title") {
        return null;
      }

      const title = resolveTitleValue(
        achievement?.title_reward,
        linkedRewardType === "title" ? linkedReward?.value : null,
        linkedRewardType === "title" ? linkedReward?.display_name : null
      );
      if (!title || looksLikeImageOrUrl(title)) return null;

      return {
        id: `achievement-title:${achievement.id}`,
        type: "title",
        value: title,
        label: title,
        source: "achievement",
      };
    })
    .filter(Boolean);

  const rewardTitles = (Array.isArray(rewards) ? rewards : [])
    .filter((reward) => {
      if (!reward || !unlockedRewardIds.has(reward.id)) return false;

      const rewardType = normalizeRewardType(reward);
      if (rewardType === "title") return true;

      const rewardValue = String(reward?.value || "").trim();
      const rewardLabel = String(reward?.display_name || "").trim();
      const looksLikeTextTitle = Boolean(rewardValue || rewardLabel) &&
        !/^https?:\/\//i.test(rewardValue) &&
        !/\.(png|jpe?g|gif|webp|svg)$/i.test(rewardValue) &&
        rewardValue.indexOf("/") === -1;

      return !rewardType && looksLikeTextTitle;
    })
    .map((reward) => {
      const label = resolveTitleValue(reward?.display_name, reward?.value);
      const value = resolveTitleValue(reward?.value, reward?.display_name);
      if (!value || !label) return null;

      return {
        id: `reward-title:${reward.id}`,
        type: "title",
        value,
        label,
        source: "reward",
      };
    })
    .filter(Boolean);

  return dedupeByValue([...achievementTitles, ...rewardTitles]).sort((left, right) =>
    String(left.label || "").localeCompare(String(right.label || ""), "de")
  );
};

export const getUnlockedPresetBackgrounds = ({ rewards = [], userRewards = [] } = {}) => {
  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((entry) => entry?.reward_id).filter(Boolean)
  );

  return (Array.isArray(rewards) ? rewards : [])
    .filter((reward) => reward?.type === "background" && reward?.value)
    .map((reward) => ({
      id: `reward-background:${reward.id}`,
      type: "preset",
      value: reward.value,
      label: reward.display_name || reward.value,
      previewColor: reward.color || null,
      source: "reward",
      isLocked: !unlockedRewardIds.has(reward?.id),
      unlockCondition: !unlockedRewardIds.has(reward?.id) ? getBackgroundUnlockCondition(reward) : null,
    }))
    .sort((left, right) => String(left.label || "").localeCompare(String(right.label || ""), "de"));
};

export const getUnlockedScanBackgrounds = ({ userDiscoveries = [], uniqueSpeciesCount = 0 } = {}) => {
  if (Number(uniqueSpeciesCount || 0) < 50) return [];

  return (Array.isArray(userDiscoveries) ? userDiscoveries : [])
    .filter((discovery) => discovery?.image_url)
    .map((discovery) => ({
      id: `scan-background:${discovery.id}`,
      type: "scan",
      value: discovery.image_url,
      label: discovery?.species_name || discovery?.discovery_label || "Scan-Hintergrund",
      discoveryId: discovery.id,
      plantId: discovery.plant_id || null,
      createdAt: discovery.created_at || discovery.discovered_date || null,
    }))
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
};

export const getUnlockedBackgroundSections = ({
  rewards = [],
  userRewards = [],
  scannedPlantsCount = 0,
} = {}) => {
  const presetOptions = getUnlockedPresetBackgrounds({ rewards, userRewards });
  const colorOptions = getUnlockedColorBackgrounds(scannedPlantsCount);

  return [
    {
      key: "presets",
      title: "Vorgefertigte Hintergruende",
      emptyLabel: "Noch keine Hintergrundbilder verfuegbar.",
      options: presetOptions,
    },
    {
      key: "colors",
      title: "Einfarbiger Hintergrund",
      emptyLabel: "Noch keine Hintergrundfarben verfuegbar.",
      options: colorOptions,
    },
  ];
};

const getRewardUnlockedAccessoryIds = ({ rewards = [], userRewards = [] } = {}) => {
  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((entry) => entry?.reward_id).filter(Boolean)
  );

  const rewardsById = new Map(
    (Array.isArray(rewards) ? rewards : []).filter((reward) => reward?.id).map((reward) => [reward.id, reward])
  );

  const unlockedAccessoryIds = new Set();

  for (const userReward of Array.isArray(userRewards) ? userRewards : []) {
    const directAccessoryCandidates = [
      normalizeAccessoryTarget(userReward?.reward_id),
      normalizeAccessoryTarget(userReward?.reward_name),
    ].filter((entry) => looksLikeAccessoryId(entry));

    for (const directCandidate of directAccessoryCandidates) {
      unlockedAccessoryIds.add(directCandidate);
    }

    const reward = rewardsById.get(userReward?.reward_id);
    if (!reward) continue;

    const rewardAccessoryIds = getRewardAccessoryIds(reward);
    for (const rewardAccessoryId of rewardAccessoryIds) {
      unlockedAccessoryIds.add(rewardAccessoryId);
    }
  }

  for (const reward of Array.isArray(rewards) ? rewards : []) {
    if (!unlockedRewardIds.has(reward?.id)) continue;
    const rewardAccessoryIds = getRewardAccessoryIds(reward);
    for (const rewardAccessoryId of rewardAccessoryIds) {
      unlockedAccessoryIds.add(rewardAccessoryId);
    }
  }

  return unlockedAccessoryIds;
};

const getAccessoryUnlockCondition = (accessoryId, rewards = [], genera = [], plants = []) => {
  const rewardsForAccessory = (Array.isArray(rewards) ? rewards : [])
    .filter((reward) => rewardMatchesAccessory(reward, accessoryId));

  if (rewardsForAccessory.length === 0) return null;

  const reward = rewardsForAccessory[0];

  const requiredReferrals = Math.max(0, Number(reward?.requires_referrals || 0));
  const requiredReferralSeeds = Math.max(0, Number(reward?.requires_referred_seeds_progress || 0));
  if (requiredReferrals > 0 && requiredReferralSeeds > 0) {
    return `Wirb ${requiredReferrals} Freund${requiredReferrals > 1 ? "e" : ""} und erreiche mit ${requiredReferrals > 1 ? "ihnen" : "ihm"} jeweils ${requiredReferralSeeds} Samen.`;
  }
  if (requiredReferrals > 0) {
    return `Wirb ${requiredReferrals} Freund${requiredReferrals > 1 ? "e" : ""}.`;
  }
  if (reward?.requires_donor) {
    return "Nur fuer Unterstuetzer freischaltbar.";
  }
  if (reward?.requires_rare_plants) {
    const count = Number(reward.requires_rare_plants);
    return `Entdecke ${count} seltene Pflanze${count > 1 ? "n" : ""}.`;
  }

  const zoneTranslations = {
    water: "Wasserzone",
    forest: "Waldzone",
    meadow: "Wiese",
    urban: "Stadt",
  };

  const conditions = rewardsForAccessory.map((zoneReward) => {
    const genusId = String(zoneReward?.requires_plant_genus_id || "").trim();
    const speciesId = String(zoneReward?.requires_plant_species_id || "").trim();
    const zoneTheme = String(zoneReward?.requires_zone_theme || "").trim();
    const zoneName = zoneTranslations[zoneTheme] || zoneTheme;

    const genusName = genusId
      ? ((Array.isArray(genera) ? genera : []).find((g) => g.id === genusId)?.genus_name || null)
      : null;
    const speciesName = speciesId
      ? ((Array.isArray(plants) ? plants : []).find((p) => p.id === speciesId)?.species_name || null)
      : null;
    const plantLabel = speciesName || genusName;

    if (plantLabel && zoneName) {
      return `${plantLabel} in einer ${zoneName} scannen`;
    }
    return null;
  }).filter(Boolean);

  return conditions.length > 0 ? conditions[0] : null;
};

const getAccessoryPurchaseMeta = (accessoryId, rewards = []) => {
  const matchingRewards = (Array.isArray(rewards) ? rewards : [])
    .filter((reward) => rewardMatchesAccessory(reward, accessoryId));

  if (matchingRewards.length === 0) return null;

  const pricedReward = matchingRewards.find((reward) =>
    Math.max(0, Math.round(Number(reward?.spark_price || 0))) > 0 ||
    Math.max(0, Math.round(Number(reward?.amber_price || 0))) > 0
  );
  const matchingReward = pricedReward || matchingRewards[0];

  const configuredSparkPrice = Number(matchingReward?.spark_price || 0);
  const sparkPriceFromReward = Number.isFinite(configuredSparkPrice) && configuredSparkPrice > 0
    ? Math.round(configuredSparkPrice)
    : 0;

  const fallbackSparkPrice = Number(DEFAULT_ACCESSORY_SPARK_SHOP_PRICES.get(accessoryId) || 0);
  const sparkPrice = sparkPriceFromReward > 0 ? sparkPriceFromReward : fallbackSparkPrice;
  const finalSparkPrice = Number.isFinite(sparkPrice) && sparkPrice > 0 ? sparkPrice : 0;

  const configuredAmberPrice = Number(matchingReward?.amber_price || 0);
  const amberPrice = Number.isFinite(configuredAmberPrice) && configuredAmberPrice > 0
    ? Math.round(configuredAmberPrice)
    : null;

  if (finalSparkPrice <= 0 && !amberPrice) return null;

  return {
    rewardId: matchingReward?.id || null,
    isPurchasable: true,
    sparkPrice: finalSparkPrice,
    amberPrice,
  };
};

const buildFallbackAccessorySections = ({ rewardUnlockedIds = new Set(), rewards = [], genera = [], plants = [] } = {}) => {
  return LOGO_ACCESSORY_SECTIONS.map((section) => ({
    key: section.key,
    title: section.title,
    profileField: section.profileField,
    emptyLabel: "Noch keine Accessoire-Optionen verfuegbar.",
    options: section.options.map((option) => {
      const isDefaultUnlocked = ["border_original", "plant_leaf", "plant_legacy", "face_original"].includes(option.value);
      const isUnlocked = isDefaultUnlocked || rewardUnlockedIds.has(option.value);
      const unlockCondition = !isUnlocked ? getAccessoryUnlockCondition(option.value, rewards, genera, plants) : null;
      const purchaseMeta = !isUnlocked ? getAccessoryPurchaseMeta(option.value, rewards) : null;
      return {
        ...option,
        isLocked: !isUnlocked,
        unlockCondition,
        ...(purchaseMeta || {}),
      };
    }),
  }));
};

export const getAccessorySections = ({ logoAssets = [], rewards = [], userRewards = [], genera = [], plants = [] } = {}) => {
  const rewardUnlockedIds = getRewardUnlockedAccessoryIds({ rewards, userRewards });

  const normalizedLogoAssets = Array.isArray(logoAssets) ? logoAssets : [];
  if (normalizedLogoAssets.length === 0) {
    return buildFallbackAccessorySections({ rewardUnlockedIds, rewards, genera, plants });
  }

  const grouped = {
    face: [],
    plant: [],
    border: [],
  };

  for (const asset of normalizedLogoAssets) {
    const assetType = String(asset?.asset_type || "");
    const assetId = String(asset?.asset_id || "").trim();
    if (!grouped[assetType] || !assetId) continue;

    const isLegacy = Boolean(asset?.legacy);
    const isDefaultUnlocked = Boolean(asset?.default_unlocked);
    const isUnlocked = isDefaultUnlocked || rewardUnlockedIds.has(assetId);

    // Legacy assets are hidden from the shop unless the user already owns them.
    if (isLegacy && !isUnlocked) continue;

    const unlockCondition = !isUnlocked ? getAccessoryUnlockCondition(assetId, rewards, genera, plants) : null;
    const purchaseMeta = (!isUnlocked && !isLegacy) ? getAccessoryPurchaseMeta(assetId, rewards) : null;

    grouped[assetType].push({
      id: assetId,
      value: assetId,
      label: asset?.display_name || assetId,
      profileField: `selected_${assetType}_asset`,
      imageUrl: asset?.public_url,
      type: "accessory",
      isLocked: !isUnlocked,
      isLegacy,
      unlockCondition,
      ...(purchaseMeta || {}),
    });
  }

  return [
    {
      key: "face",
      title: "Gesicht",
      profileField: "selected_face_asset",
      emptyLabel: "Noch keine Gesichts-Accessoires verfuegbar.",
      options: grouped.face.sort((left, right) => String(left.label).localeCompare(String(right.label), "de")),
    },
    {
      key: "plant",
      title: "Pflanze",
      profileField: "selected_plant_asset",
      emptyLabel: "Noch keine Pflanzen-Accessoires verfuegbar.",
      options: grouped.plant.sort((left, right) => String(left.label).localeCompare(String(right.label), "de")),
    },
    {
      key: "border",
      title: "Rahmen",
      profileField: "selected_border_asset",
      emptyLabel: "Noch keine Rahmen-Accessoires verfuegbar.",
      options: grouped.border.sort((left, right) => String(left.label).localeCompare(String(right.label), "de")),
    },
  ];
};

export const PROFILE_CUSTOMIZATION_CATEGORY_ORDER = ["accessories", "backgrounds", "titles", "effects"];

export const getUnlockedProfileCustomizationCatalog = ({
  achievements = [],
  userAchievements = [],
  rewards = [],
  userRewards = [],
  userDiscoveries = [],
  logoAssets = [],
  genera = [],
  plants = [],
} = {}) => {
  const scannedPlantsCount = (Array.isArray(userDiscoveries) ? userDiscoveries : []).length;
  const uniqueSpeciesCount = new Set(
    (Array.isArray(userDiscoveries) ? userDiscoveries : []).map((entry) => entry?.plant_id).filter(Boolean)
  ).size;

  const backgroundSections = getUnlockedBackgroundSections({
    rewards,
    userRewards,
    userDiscoveries,
    scannedPlantsCount,
    uniqueSpeciesCount,
  });
  const titleOptions = getUnlockedTitleOptions({
    achievements,
    userAchievements,
    rewards,
    userRewards,
  });
  const profileEffectOptions = getUnlockedProfileEffectOptions({ rewards, userRewards });
  const logoEffectOptions = getUnlockedLogoEffectOptions({ rewards, userRewards });
  const accessorySections = getAccessorySections({ logoAssets, rewards, userRewards, genera, plants });

  return {
    scannedPlantsCount,
    uniqueSpeciesCount,
    categories: [
      {
        key: "backgrounds",
        title: "Hintergruende",
        subtitle: "Alle Hintergrundoptionen fuer dein Profil",
        sections: backgroundSections,
        optionCount: (backgroundSections.find((section) => section.key === "presets")?.options.length) || 0,
      },
      {
        key: "titles",
        title: "Titel",
        subtitle: "Alle freigeschalteten Titel fuer dein Profil",
        sections: [
          {
            key: "titles",
            title: "Freigeschaltete Titel",
            emptyLabel: "Noch keine Titel freigeschaltet.",
            options: titleOptions,
          },
        ],
        optionCount: titleOptions.length,
      },
      {
        key: "accessories",
        title: "Accessoires",
        subtitle: "Austauschbare Teile fuer dein Home-Logo",
        sections: accessorySections,
        optionCount: accessorySections.reduce((sum, section) => sum + section.options.length, 0),
      },
      {
        key: "effects",
        title: "Effekte",
        subtitle: "Freischaltbare Effekte fuer Profil und Florabot",
        sections: [
          {
            key: "profile_effects",
            title: "Profileffekte",
            emptyLabel: "Noch keine Effekte freigeschaltet.",
            options: profileEffectOptions,
          },
          {
            key: "logo_effects",
            title: "Florabot-Effekte",
            emptyLabel: "Noch keine Florabot-Effekte freigeschaltet.",
            options: logoEffectOptions,
          },
        ],
        optionCount: profileEffectOptions.length + logoEffectOptions.length,
      },
    ],
  };
};

export const profileCustomizationCategoryComparator = (left, right) => {
  return PROFILE_CUSTOMIZATION_CATEGORY_ORDER.indexOf(left.key) - PROFILE_CUSTOMIZATION_CATEGORY_ORDER.indexOf(right.key);
};