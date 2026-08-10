/**
 * Unified 1-6 plant rarity scale, derived from Red List data (Bestand + Gefaehrdung).
 * rarity level = max(populationLevel, threatLevel). This is the single source of
 * truth for `plant.rarity` going forward (see supabase/functions/_shared/plantRarityLevels.ts
 * for the Deno-side mirror used by edge functions - keep both in sync).
 */
import { getPopulationMeta, getThreatMeta } from "@/lib/conservationStatus";

const RARITY_LEVELS = [
  {
    level: 1,
    label: "Häufig",
    glowColor: "rgba(73, 175, 119, 0.85)",
    reflectionColor: "rgba(93, 155, 121, 0.85)",
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
    level: 2,
    label: "Gelegentlich",
    glowColor: "rgba(116, 199, 61, 0.85)",
    reflectionColor: "rgba(149, 167, 71, 0.85)",
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
    level: 3,
    label: "Selten",
    glowColor: "rgba(238, 234, 0, 0.9)",
    reflectionColor: "rgba(238, 222, 0, 0.9)",
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
    level: 4,
    label: "Sehr selten",
    glowColor: "rgba(249, 177, 22, 0.9)",
    reflectionColor: "rgba(249, 177, 22, 0.9)",
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
    level: 5,
    label: "Extrem selten",
    glowColor: "rgba(207, 59, 40, 0.92)",
    reflectionColor: "rgba(207, 59, 40, 0.92)",
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
    level: 6,
    label: "Ausgestorben oder verschollen",
    glowColor: "rgba(127, 29, 59, 0.92)",
    reflectionColor: "rgba(127, 29, 59, 0.92)",
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
];

const RARITY_LEVEL_MIN = 1;
const RARITY_LEVEL_MAX = RARITY_LEVELS.length;

const RARITY_BY_LEVEL = Object.fromEntries(RARITY_LEVELS.map((entry) => [entry.level, entry]));

const clampLevel = (level) => Math.max(RARITY_LEVEL_MIN, Math.min(RARITY_LEVEL_MAX, Math.round(Number(level) || RARITY_LEVEL_MIN)));

// Population score (from conservationStatus.js) -> unified 1-6 rarity level.
const POPULATION_KEY_TO_LEVEL = {
  sehr_haeufig: 1,
  haeufig: 2,
  maessig_haeufig: 2,
  selten: 3,
  sehr_selten: 4,
  extrem_selten: 5,
  ausgestorben_oder_verschollen: 6,
};

// Threat level (0-5, from conservationStatus.js) -> unified 1-6 rarity level (+1 shift).
const THREAT_LEVEL_TO_RARITY_LEVEL = {
  0: 1, // ungefaehrdet
  1: 2, // vorwarnliste
  2: 3, // gefaehrdet
  3: 4, // stark_gefaehrdet
  4: 5, // vom_aussterben_bedroht
  5: 6, // ausgestorben_oder_verschollen
};

export const getPopulationUnifiedLevel = (populationRaw) => {
  const meta = getPopulationMeta(populationRaw);
  return POPULATION_KEY_TO_LEVEL[meta.key] || RARITY_LEVEL_MIN;
};

export const getThreatUnifiedLevel = (threatRaw) => {
  const meta = getThreatMeta(threatRaw);
  return THREAT_LEVEL_TO_RARITY_LEVEL[meta.level] ?? RARITY_LEVEL_MIN;
};

/** rarity level = max(Bestand-Level, Gefaehrdungs-Level), volle Kopplung */
export const computeRarityLevel = (populationRaw, threatRaw) =>
  Math.max(getPopulationUnifiedLevel(populationRaw), getThreatUnifiedLevel(threatRaw));

export const getRarityLabelFromLevel = (level) => RARITY_BY_LEVEL[clampLevel(level)].label;

export const computeRarityLabel = (populationRaw, threatRaw) =>
  getRarityLabelFromLevel(computeRarityLevel(populationRaw, threatRaw));

const normalizeRarityText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Robust, case-insensitive Rueckwaertskonvertierung gespeicherter Label-Strings -> Level (1-6). */
export const getRarityLevelFromLabel = (labelValue) => {
  const normalized = normalizeRarityText(labelValue);
  if (!normalized) return RARITY_LEVEL_MIN;

  if (/ausgestorben|verschollen/.test(normalized)) return 6;
  if (/extrem\s*selten/.test(normalized)) return 5;
  if (/sehr\s*selten/.test(normalized)) return 4;
  if (/\bselten\b/.test(normalized)) return 3;
  if (/gelegentlich|ungewohnlich/.test(normalized)) return 2;
  if (/haufig|common/.test(normalized)) return 1;
  return RARITY_LEVEL_MIN;
};

/** Nimmt entweder ein plant.rarity-Label (string) oder bereits einen Level (number) entgegen. */
const resolveRarityLevel = (rarityLabelOrLevel) => {
  if (typeof rarityLabelOrLevel === "number") return clampLevel(rarityLabelOrLevel);
  return getRarityLevelFromLabel(rarityLabelOrLevel);
};

export const getRarityMeta = (rarityLabelOrLevel) => RARITY_BY_LEVEL[resolveRarityLevel(rarityLabelOrLevel)];

export const getRarityStars = (rarityLabelOrLevel) => "⭐".repeat(resolveRarityLevel(rarityLabelOrLevel));

export const getRarityBadgeClass = (rarityLabelOrLevel, { soft = false } = {}) => {
  const meta = getRarityMeta(rarityLabelOrLevel);
  return soft ? meta.styles.badgeSoft : meta.styles.badgeSolid;
};

export const getRarityAccentClasses = (rarityLabelOrLevel, isLightUi) => {
  const meta = getRarityMeta(rarityLabelOrLevel);
  return {
    border: isLightUi ? meta.styles.borderLight : meta.styles.borderDark,
    softBg: isLightUi ? meta.styles.softBgLight : meta.styles.softBgDark,
    imageBorder: isLightUi ? meta.styles.imageBorderLight : meta.styles.imageBorderDark,
  };
};

export const getRarityBorderClass = (rarityLabelOrLevel, isLightUi) => {
  const meta = getRarityMeta(rarityLabelOrLevel);
  return isLightUi ? meta.styles.borderLight : meta.styles.borderDark;
};

export const getRarityScanBackgroundClass = (rarityLabelOrLevel) =>
  getRarityMeta(rarityLabelOrLevel).styles.scanBackground;

export const getRarityGlowColor = (rarityLabelOrLevel) => getRarityMeta(rarityLabelOrLevel).glowColor;

export const getRarityReflectionColor = (rarityLabelOrLevel) => getRarityMeta(rarityLabelOrLevel).reflectionColor;

/** Level 3-6 -> bestehende CSS-Klassen threat-effect-level-2..5 (Level 1-2: keine Animation). */
export const getRarityAnimationClass = (rarityLabelOrLevel) => {
  const level = resolveRarityLevel(rarityLabelOrLevel);
  if (level >= 6) return "threat-effect-level-5";
  if (level === 5) return "threat-effect-level-4";
  if (level === 4) return "threat-effect-level-3";
  if (level === 3) return "threat-effect-level-2";
  return "";
};

/** threat-glow-border zusaetzlich ab Level 5 (oberste 2 von 6 Stufen). */
export const getRarityGlowBorderClass = (rarityLabelOrLevel) =>
  resolveRarityLevel(rarityLabelOrLevel) >= 5 ? "threat-glow-border" : "";

export { RARITY_LEVELS, RARITY_LEVEL_MIN, RARITY_LEVEL_MAX };
