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
    const value = String(option?.value || "").trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
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
  const unlockedAchievementIds = new Set(
    (Array.isArray(userAchievements) ? userAchievements : []).map((entry) => entry?.achievement_id).filter(Boolean)
  );
  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((entry) => entry?.reward_id).filter(Boolean)
  );

  const achievementTitles = (Array.isArray(achievements) ? achievements : [])
    .filter((achievement) => unlockedAchievementIds.has(achievement?.id) && achievement?.title_reward)
    .map((achievement) => ({
      id: `achievement-title:${achievement.id}`,
      type: "title",
      value: achievement.title_reward,
      label: achievement.title_reward,
      source: "achievement",
    }));

  const rewardTitles = (Array.isArray(rewards) ? rewards : [])
    .filter((reward) => unlockedRewardIds.has(reward?.id) && reward?.type === "title")
    .map((reward) => {
      const value = reward?.value || reward?.display_name;
      const label = reward?.display_name || reward?.value;
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

export const PROFILE_CUSTOMIZATION_CATEGORY_ORDER = ["backgrounds", "titles"];

export const getUnlockedProfileCustomizationCatalog = ({
  achievements = [],
  userAchievements = [],
  rewards = [],
  userRewards = [],
  userDiscoveries = [],
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
    ],
  };
};

export const profileCustomizationCategoryComparator = (left, right) => {
  return PROFILE_CUSTOMIZATION_CATEGORY_ORDER.indexOf(left.key) - PROFILE_CUSTOMIZATION_CATEGORY_ORDER.indexOf(right.key);
};