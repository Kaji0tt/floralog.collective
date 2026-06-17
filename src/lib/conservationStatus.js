const POPULATION_FALLBACK_KEY = "sehr_haeufig";
const THREAT_FALLBACK_KEY = "ungefaehrdet";

const POPULATION_LEVELS = [
  {
    key: "ausgestorben_oder_verschollen",
    label: "Ausgestorben oder verschollen",
    score: 6,
    stars: 6,
    glowColor: "rgba(127, 29, 59, 0.92)",
    reflectionColor: "rgba(127, 29, 59, 0.92)",
    matchers: [/ausgestorben/, /verschollen/, /extinct/, /missing/],
    styles: {
      badgeSolid: "bg-rose-950 text-rose-50",
      badgeSoft: "bg-rose-200 text-rose-950",
      borderLight: "border-rose-700/90",
      borderDark: "border-rose-500/90",
      softBgLight: "bg-rose-200/55",
      softBgDark: "bg-rose-900/25",
      imageBorderLight: "border-rose-700/90",
      imageBorderDark: "border-rose-500/90",
      scanBackground: "bg-gradient-to-br from-rose-950/80 via-black/70 to-red-950/80",
    },
  },
  {
    key: "extrem_selten",
    label: "Extrem selten",
    score: 5,
    stars: 5,
    glowColor: "rgba(207, 59, 40, 0.92)",
    reflectionColor: "rgba(207, 59, 40, 0.92)",
    matchers: [/extrem\s*selten/, /aeusserst\s*selten/, /auserst\s*selten/],
    styles: {
      badgeSolid: "bg-red-600 text-white",
      badgeSoft: "bg-red-100 text-red-800",
      borderLight: "border-red-500/85",
      borderDark: "border-red-300/85",
      softBgLight: "bg-red-100/55",
      softBgDark: "bg-red-500/15",
      imageBorderLight: "border-red-500/90",
      imageBorderDark: "border-red-300/85",
      scanBackground: "bg-gradient-to-br from-rose-900/50 via-black/45 to-red-950/70",
    },
  },
  {
    key: "sehr_selten",
    label: "Sehr selten",
    score: 4,
    stars: 4,
    glowColor: "rgba(249, 177, 22, 0.9)",
    reflectionColor: "rgba(249, 177, 22, 0.9)",
    matchers: [/sehr\s*selten/, /very\s*rare/],
    styles: {
      badgeSolid: "bg-orange-600 text-white",
      badgeSoft: "bg-orange-100 text-orange-800",
      borderLight: "border-orange-400/70",
      borderDark: "border-orange-400/70",
      softBgLight: "bg-orange-100/55",
      softBgDark: "bg-orange-700/15",
      imageBorderLight: "border-orange-500/80",
      imageBorderDark: "border-orange-300/80",
      scanBackground: "bg-gradient-to-br from-amber-900/50 via-black/35 to-orange-950/60",
    },
  },
  {
    key: "selten",
    label: "Selten",
    score: 3,
    stars: 3,
    glowColor: "rgba(238, 234, 0, 0.9)",
    reflectionColor: "rgba(238, 222, 0, 0.9)",
    matchers: [/\bselten\b/, /rare/],
    styles: {
      badgeSolid: "bg-[#827242] text-[#1f2202]",
      badgeSoft: "bg-[#f2f0b6] text-[#5e5a08]",
      borderLight: "border-[#c8ac62]/60",
      borderDark: "border-[#f0e5a5]/60",
      softBgLight: "bg-amber-100/55",
      softBgDark: "bg-amber-500/12",
      imageBorderLight: "border-[#c8ac62]/80",
      imageBorderDark: "border-[#f0e5a5]/80",
      scanBackground: "bg-gradient-to-br from-yellow-900/45 via-black/35 to-amber-900/55",
    },
  },
{
    key: "maessig_haeufig",
    label: "Mäßig häufig",
    score: 2.5,
    stars: 2,
    glowColor: "rgba(116, 199, 61, 0.85)",
    reflectionColor: "rgba(149, 167, 71, 0.85)",
    matchers: [/maessig\s*haeufig/, /massig\s*haeufig/, /mittel\s*haeufig/, /noch\s*haeufig/, /moderate/],
    styles: {
  badgeSolid: "bg-[#74c73d] text-[#112e07]",
  badgeSoft: "bg-[#dbefcb] text-[#2f5f1d]",
      borderLight: "border-[#8fbca0]/65",
      borderDark: "border-[#6f957f]/60",
      softBgLight: "bg-[#dcece2]/60",
      softBgDark: "bg-[#8fbca0]/18",
      imageBorderLight: "border-[#8fbca0]/70",
      imageBorderDark: "border-[#6f957f]/60",
      scanBackground: "bg-gradient-to-br from-[#355246]/50 via-black/30 to-[#6a8f7b]/55",
    },
  },
  {
    key: "haeufig",
    label: "Häufig",
    score: 2,
    stars: 2,
    glowColor: "rgba(73, 175, 119, 0.85)",
    reflectionColor: "rgba(93, 155, 121, 0.85)",
    matchers: [/^haeufig$/, /^common$/, /^regular$/],
    styles: {
      badgeSolid: "bg-[#49af77] text-[#052815]",
      badgeSoft: "bg-[#d1ecde] text-[#215f44]",
      borderLight: "border-[#7fb195]/55",
      borderDark: "border-[#5e8f77]/50",
      softBgLight: "bg-lime-100/55",
      softBgDark: "bg-lime-500/12",
      imageBorderLight: "border-[#7fb195]/60",
      imageBorderDark: "border-[#5e8f77]/55",
      scanBackground: "bg-gradient-to-br from-lime-900/40 via-black/30 to-emerald-950/60",
    },
  },
  {
    key: "sehr_haeufig",
    label: "Sehr häufig",
    score: 0,
    stars: 1,
    glowColor: "rgba(73, 99, 81, 0.63)",
    reflectionColor: "rgba(153, 170, 158, 0.57)",
    matchers: [/sehr\s*haeufig/, /very\s*common/, /abundant/],
    styles: {
      badgeSolid: "bg-[#496351] text-[#e5eee8]",
      badgeSoft: "bg-[#dce5df] text-[#365044]",
      borderLight: "border-[#9aa8a0]/45",
      borderDark: "border-[#76847c]/40",
      softBgLight: "bg-[#efefef]/60",
      softBgDark: "bg-[#bcbcbc]/15",
      imageBorderLight: "border-[#9aa8a0]/50",
      imageBorderDark: "border-[#76847c]/45",
      scanBackground: "bg-gradient-to-br from-[#4e4e4e]/50 via-black/35 to-[#8a8a8a]/50",
    },
  },
];

const THREAT_LEVELS = [
  {
    key: "ausgestorben_oder_verschollen",
    label: "Ausgestorben oder verschollen",
    level: 5,
    matchers: [/ausgestorben/, /verschollen/, /extinct/, /missing/],
  },
  {
    key: "vom_aussterben_bedroht",
    label: "Vom Aussterben bedroht",
    level: 4,
    matchers: [/vom\s*aussterben\s*bedroht/, /critically\s*endangered/, /\bcr\b/],
  },
  {
    key: "stark_gefaehrdet",
    label: "Stark gefährdet",
    level: 3,
    matchers: [/stark\s*gefaehrdet/, /highly\s*endangered/, /\ben\b/],
  },
  {
    key: "gefaehrdet",
    label: "Gefährdet",
    level: 2,
    matchers: [/\bgefaehrdet\b/, /threatened/, /vulnerable/, /\bvu\b/],
  },
  {
    key: "vorwarnliste",
    label: "Vorwarnliste",
    level: 1,
    matchers: [/vorwarnliste/, /near\s*threatened/, /watch\s*list/, /\bnt\b/],
  },
  {
    key: "ungefaehrdet",
    label: "Ungefährdet",
    level: 0,
    matchers: [/ungefaehrdet/, /nicht\s*gefaehrdet/, /least\s*concern/, /\blc\b/],
  },
];

const POPULATION_BY_KEY = Object.fromEntries(
  POPULATION_LEVELS.map((entry) => [entry.key, entry])
);

const THREAT_BY_KEY = Object.fromEntries(
  THREAT_LEVELS.map((entry) => [entry.key, entry])
);

const normalizeConservationText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9&,/;|\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitAlternatives = (value) => {
  const normalized = normalizeConservationText(value);
  if (!normalized) return [];

  return normalized
    .split(/\s*(?:&&|\||\/|,|;)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const matchConservationLevel = (rawValue, levels, fallbackKey) => {
  const normalized = normalizeConservationText(rawValue);
  const fallback = levels.find((entry) => entry.key === fallbackKey) || levels[0];
  if (!normalized) return fallback;

  const alternatives = splitAlternatives(rawValue);
  const candidates = alternatives.length > 0 ? alternatives : [normalized];

  for (const candidate of candidates) {
    for (const level of levels) {
      if (level.matchers.some((matcher) => matcher.test(candidate))) {
        return level;
      }
    }
  }

  for (const level of levels) {
    if (level.matchers.some((matcher) => matcher.test(normalized))) {
      return level;
    }
  }

  return fallback;
};

export const resolvePlantField = (plant, key) => {
  if (plant?.[key] !== undefined && plant?.[key] !== null && plant?.[key] !== "") {
    return plant[key];
  }
  if (plant?.aiData?.[key] !== undefined && plant?.aiData?.[key] !== null && plant?.aiData?.[key] !== "") {
    return plant.aiData[key];
  }
  return null;
};

export const getPopulationMeta = (populationValue) =>
  matchConservationLevel(populationValue, POPULATION_LEVELS, POPULATION_FALLBACK_KEY);

export const getThreatMeta = (threatValue) =>
  matchConservationLevel(threatValue, THREAT_LEVELS, THREAT_FALLBACK_KEY);

export const getConservationFromPlant = (plant) => {
  const populationRaw = resolvePlantField(plant, "red_list_population");
  const threatRaw = resolvePlantField(plant, "red_list_threat");
  const population = getPopulationMeta(populationRaw);
  const threat = getThreatMeta(threatRaw);

  return {
    populationRaw,
    threatRaw,
    population,
    threat,
  };
};

export const getPopulationScore = (populationValue) => getPopulationMeta(populationValue).score;

export const getRarityStars = (populationValue) => {
  const stars = getPopulationMeta(populationValue).stars;
  return "⭐".repeat(Math.max(1, Math.min(6, stars)));
};

export const getRarityLabel = (populationValue) => getPopulationMeta(populationValue).label;

export const getRarityBadgeClass = (populationValue, { soft = false } = {}) => {
  const meta = getPopulationMeta(populationValue);
  return soft ? meta.styles.badgeSoft : meta.styles.badgeSolid;
};

export const getRarityAccentClasses = (populationValue, isLightUi) => {
  const meta = getPopulationMeta(populationValue);
  return {
    border: isLightUi ? meta.styles.borderLight : meta.styles.borderDark,
    softBg: isLightUi ? meta.styles.softBgLight : meta.styles.softBgDark,
    imageBorder: isLightUi ? meta.styles.imageBorderLight : meta.styles.imageBorderDark,
  };
};

export const getRarityBorderClass = (populationValue, isLightUi) => {
  const meta = getPopulationMeta(populationValue);
  return isLightUi ? meta.styles.borderLight : meta.styles.borderDark;
};

export const getRarityScanBackgroundClass = (populationValue) =>
  getPopulationMeta(populationValue).styles.scanBackground;

export const getRarityGlowColor = (populationValue) => {
  const meta = getPopulationMeta(populationValue);
  return meta.glowColor || POPULATION_BY_KEY[POPULATION_FALLBACK_KEY].glowColor;
};

export const getRarityReflectionColor = (populationValue) => {
  const meta = getPopulationMeta(populationValue);
  return meta.reflectionColor || POPULATION_BY_KEY[POPULATION_FALLBACK_KEY].reflectionColor;
};

const getRarityEffectLevel = (populationValue) => {
  const score = getPopulationMeta(populationValue).score;
  if (score >= 5) return 5;
  if (score >= 4) return 4;
  return 0;
};

export const getConservationEffectLevel = (threatValue, populationValue = null) => {
  const threatLevel = getThreatMeta(threatValue).level;
  const rarityLevel = getRarityEffectLevel(populationValue);
  return Math.max(threatLevel, rarityLevel);
};

export const getThreatAnimationClass = (threatValue, populationValue = null) => {
  const effectLevel = getConservationEffectLevel(threatValue, populationValue);
  if (effectLevel >= 5) return "threat-effect-level-5";
  if (effectLevel === 4) return "threat-effect-level-4";
  if (effectLevel === 3) return "threat-effect-level-3";
  if (effectLevel === 2) return "threat-effect-level-2";
  return "";
};

export const getThreatLabel = (threatValue) => getThreatMeta(threatValue).label;

export const populationKeyToLabel = (populationKey) =>
  POPULATION_BY_KEY[populationKey]?.label || POPULATION_BY_KEY[POPULATION_FALLBACK_KEY].label;

export const threatKeyToLabel = (threatKey) =>
  THREAT_BY_KEY[threatKey]?.label || THREAT_BY_KEY[THREAT_FALLBACK_KEY].label;
