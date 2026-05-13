import { LOGO_ACCESSORY_SECTIONS } from "@/lib/logoAccessoryAssets";

const LOGO_ACCESSORY_REWARD_TYPES = new Set(["logo_accessory", "accessory"]);

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
    if (normalizedCount < row.threshold) return [];

    return row.colors.map((color) => ({
      id: `color:${color}`,
      type: "color",
      value: color,
      label: color,
      unlockLabel: row.label,
      threshold: row.threshold,
    }));
  });
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
      const title = resolveTitleValue(
        achievement?.title_reward,
        linkedReward?.display_name,
        linkedReward?.value
      );
      if (!title) return null;

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

      const rewardType = String(reward?.type || reward?.reward_type || reward?.kind || "").trim().toLowerCase();
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
    .filter((reward) => unlockedRewardIds.has(reward?.id) && reward?.type === "background" && reward?.value)
    .map((reward) => ({
      id: `reward-background:${reward.id}`,
      type: "preset",
      value: reward.value,
      label: reward.display_name || reward.value,
      previewColor: reward.color || null,
      source: "reward",
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
  userDiscoveries = [],
  scannedPlantsCount = 0,
  uniqueSpeciesCount = 0,
} = {}) => {
  const presetOptions = getUnlockedPresetBackgrounds({ rewards, userRewards });
  const colorOptions = getUnlockedColorBackgrounds(scannedPlantsCount);
  const scanOptions = getUnlockedScanBackgrounds({ userDiscoveries, uniqueSpeciesCount });

  return [
    {
      key: "presets",
      title: "Hintergruende",
      emptyLabel: "Noch keine freigeschalteten Hintergrundbilder.",
      options: presetOptions,
    },
    {
      key: "colors",
      title: "Einfarbiger Hintergrund",
      emptyLabel: "Noch keine Hintergrundfarben freigeschaltet.",
      options: colorOptions,
    },
    {
      key: "scans",
      title: "Scan-Hintergrund",
      emptyLabel: "Scan-Hintergründe werden ab 50 verschiedenen Arten freigeschaltet.",
      options: scanOptions,
    },
  ];
};

const getRewardUnlockedAccessoryIds = ({ rewards = [], userRewards = [] } = {}) => {
  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((entry) => entry?.reward_id).filter(Boolean)
  );

  return new Set(
    (Array.isArray(rewards) ? rewards : [])
      .filter((reward) => unlockedRewardIds.has(reward?.id) && LOGO_ACCESSORY_REWARD_TYPES.has(reward?.type))
      .map((reward) => String(reward?.value || "").trim())
      .filter(Boolean)
  );
};

const getAccessoryUnlockCondition = (accessoryId, rewards = []) => {
  const rewardsForAccessory = (Array.isArray(rewards) ? rewards : [])
    .filter((r) => String(r?.value || "").trim() === accessoryId && (r?.requires_zone_theme || r?.requires_plant_species));

  if (rewardsForAccessory.length === 0) return null;

  const zoneTranslations = {
    water: "Wasserzone",
    forest: "Waldzone",
    meadow: "Wiese",
    urban: "Stadt",
  };

  const conditions = rewardsForAccessory.map((reward) => {
    const plantSpecies = String(reward?.requires_plant_species || "").trim();
    const zoneTheme = String(reward?.requires_zone_theme || "").trim();
    const zoneName = zoneTranslations[zoneTheme] || zoneTheme;

    if (plantSpecies && zoneName) {
      return `${plantSpecies} in einer ${zoneName} scannen`;
    }
    return null;
  }).filter(Boolean);

  return conditions.length > 0 ? conditions[0] : null;
};

const buildFallbackAccessorySections = ({ rewardUnlockedIds = new Set(), rewards = [] } = {}) => {
  return LOGO_ACCESSORY_SECTIONS.map((section) => ({
    key: section.key,
    title: section.title,
    profileField: section.profileField,
    emptyLabel: "Noch keine Accessoire-Optionen verfuegbar.",
    options: section.options.map((option) => {
      const isDefaultUnlocked = ["border_original", "plant_leaf", "plant_legacy", "face_original"].includes(option.value);
      const isUnlocked = isDefaultUnlocked || rewardUnlockedIds.has(option.value);
      const unlockCondition = !isUnlocked ? getAccessoryUnlockCondition(option.value, rewards) : null;
      return {
        ...option,
        isLocked: !isUnlocked,
        unlockCondition,
      };
    }),
  }));
};

export const getAccessorySections = ({ logoAssets = [], rewards = [], userRewards = [] } = {}) => {
  const rewardUnlockedIds = getRewardUnlockedAccessoryIds({ rewards, userRewards });

  const normalizedLogoAssets = Array.isArray(logoAssets) ? logoAssets : [];
  if (normalizedLogoAssets.length === 0) {
    return buildFallbackAccessorySections({ rewardUnlockedIds, rewards });
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

    const isDefaultUnlocked = Boolean(asset?.default_unlocked);
    const isUnlocked = isDefaultUnlocked || rewardUnlockedIds.has(assetId);
    const unlockCondition = !isUnlocked ? getAccessoryUnlockCondition(assetId, rewards) : null;

    grouped[assetType].push({
      id: assetId,
      value: assetId,
      label: asset?.display_name || assetId,
      profileField: `selected_${assetType}_asset`,
      imageUrl: asset?.public_url,
      type: "accessory",
      isLocked: !isUnlocked,
      unlockCondition,
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

export const PROFILE_CUSTOMIZATION_CATEGORY_ORDER = ["backgrounds", "titles", "accessories"];

export const getUnlockedProfileCustomizationCatalog = ({
  achievements = [],
  userAchievements = [],
  rewards = [],
  userRewards = [],
  userDiscoveries = [],
  logoAssets = [],
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
  const accessorySections = getAccessorySections({ logoAssets, rewards, userRewards });

  return {
    scannedPlantsCount,
    uniqueSpeciesCount,
    categories: [
      {
        key: "backgrounds",
        title: "Hintergruende",
        subtitle: "Alle freigeschalteten Hintergründe fuer dein Profil",
        sections: backgroundSections,
        optionCount: backgroundSections.reduce((sum, section) => sum + section.options.length, 0),
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
    ],
  };
};

export const profileCustomizationCategoryComparator = (left, right) => {
  return PROFILE_CUSTOMIZATION_CATEGORY_ORDER.indexOf(left.key) - PROFILE_CUSTOMIZATION_CATEGORY_ORDER.indexOf(right.key);
};