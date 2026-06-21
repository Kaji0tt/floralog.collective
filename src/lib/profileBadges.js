import { UNIQUE_BADGE_IDS } from "@/lib/profileUniqueBadges";

const PROFILE_BADGE_MAX_SELECTED = 3;

const PROFILE_BADGE_RANK_META = {
  gray: { key: "gray", label: "Grau", color: "#9ca3af", order: 0 },
  white: { key: "white", label: "Weiss", color: "#f8fafc", order: 1 },
  bronze: { key: "bronze", label: "Bronze", color: "#cd7f32", order: 2 },
  silver: { key: "silver", label: "Silber", color: "#c0c7d1", order: 3 },
  gold: { key: "gold", label: "Gold", color: "#f5c542", order: 4 },
};

const PROFILE_BADGE_DEFINITIONS = [
  {
    id: "distance_waypoints",
    label: "Strecke",
    description: "Gesamte Strecke zwischen deinen Scans.",
    iconKey: "waypoints",
    metricKey: "total_distance_between_scans_km",
    direction: "higher",
    thresholds: { white: 1, bronze: 10, silver: 50, gold: 150 },
    format: "km",
  },
  {
    id: "scans_camera",
    label: "Scans",
    description: "Gesamtanzahl deiner Scans.",
    iconKey: "camera",
    metricKey: "total_scans",
    direction: "higher",
    thresholds: { white: 10, bronze: 100, silver: 500, gold: 2000 },
    format: "count",
  },
  {
    id: "seed_rank_medal",
    label: "Samen-Rang",
    description: "Globale Platzierung nach Samenbestand (niedriger ist besser).",
    iconKey: "leaf",
    metricKey: "global_seed_rank",
    direction: "lower",
    thresholds: { white: 500, bronze: 250, silver: 100, gold: 25 },
    format: "rank",
  },
  {
    id: "likes_heart",
    label: "Likes",
    description: "Likes, die deine Scans erhalten haben.",
    iconKey: "heart",
    metricKey: "received_likes_count",
    direction: "higher",
    thresholds: { white: 5, bronze: 25, silver: 100, gold: 500 },
    format: "count",
  },
  {
    id: "seeds_heart",
    label: "Samen",
    description: "Dein aktueller Samenbestand.",
    iconKey: "heart",
    metricKey: "total_seeds",
    direction: "higher",
    thresholds: { white: 1000, bronze: 10000, silver: 50000, gold: 200000 },
    format: "count",
  },
  {
    id: "tiles_inspection_panel",
    label: "Eroberte Tiles",
    description: "Anzahl geclaimter Tiles.",
    iconKey: "inspection-panel",
    metricKey: "claimed_tiles",
    direction: "higher",
    thresholds: { white: 5, bronze: 20, silver: 75, gold: 200 },
    format: "count",
  },
  {
    id: "highest_scan_square_star",
    label: "Hoechstes Scanergebnis",
    description: "Bestes bisheriges Scan-Ergebnis in Samen.",
    iconKey: "square-star",
    metricKey: "highest_scan_result",
    direction: "higher",
    thresholds: { white: 50, bronze: 120, silver: 220, gold: 350 },
    format: "count",
  },
  {
    id: "plant_status_heart_pulse",
    label: "Pflanzenstatus",
    description: "Hoechster erreichter Pflanzenstatus.",
    iconKey: "heart-pulse",
    metricKey: "highest_plant_status",
    direction: "higher",
    thresholds: { white: 40, bronze: 60, silver: 80, gold: 95 },
    format: "percent",
  },
  {
    id: "rarest_plant_wand",
    label: "Seltenste Pflanze",
    description: "Seltenheitsstufe deiner seltensten Pflanze.",
    iconKey: "wand",
    metricKey: "rarest_plant_score",
    direction: "higher",
    thresholds: { white: 3, bronze: 5, silver: 6, gold: 7 },
    format: "rarity-score",
  },
  {
    id: "weekly_bookmark_check",
    label: "Wochenaufgaben",
    description: "Abgeschlossene woechentliche Aufgaben.",
    iconKey: "bookmark-check",
    metricKey: "weekly_quests_completed",
    direction: "higher",
    thresholds: { white: 3, bronze: 10, silver: 25, gold: 60 },
    format: "count",
  },
  {
    id: "monthly_calendar_check",
    label: "Monatsaufgaben",
    description: "Abgeschlossene monatliche Aufgaben.",
    iconKey: "calendar-check-2",
    metricKey: "monthly_quests_completed",
    direction: "higher",
    thresholds: { white: 1, bronze: 3, silver: 8, gold: 18 },
    format: "count",
  },
  {
    id: "streak_flame",
    label: "Tagesserie",
    description: "Aktuelle Serie aufeinanderfolgender Tage.",
    iconKey: "flame",
    metricKey: "daily_streak_days",
    direction: "higher",
    thresholds: { white: 3, bronze: 7, silver: 30, gold: 100 },
    format: "days",
  },
  {
    id: "member_since",
    label: "Dabei seit",
    description: "Tage seit deinem ersten Login.",
    iconKey: "calendar-days",
    metricKey: "member_since_days",
    direction: "higher",
    thresholds: { white: 7, bronze: 30, silver: 120, gold: 365 },
    format: "days",
  },
  {
    id: "zone_accessories_map_pin_check",
    label: "Zonen-Accessoires",
    description: "Durch Zonen freigeschaltete Plant-Accessoires.",
    iconKey: "map-pin-check",
    metricKey: "zone_unlocked_plant_accessories",
    direction: "higher",
    thresholds: { white: 1, bronze: 3, silver: 6, gold: 10 },
    format: "count",
  },
];

const PROFILE_BADGE_BY_ID = Object.fromEntries(
  PROFILE_BADGE_DEFINITIONS.map((definition) => [definition.id, definition])
);

const PROFILE_BADGE_IDS = new Set(Object.keys(PROFILE_BADGE_BY_ID));

const toSafeNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
};

const clampNonNegative = (value) => Math.max(0, toSafeNumber(value));

const getRarityLabelFromScore = (scoreValue) => {
  const score = Math.round(clampNonNegative(scoreValue));
  if (score >= 7) return "legend";
  if (score >= 6) return "sehr selten";
  if (score >= 5) return "selten";
  if (score >= 3) return "ungewoehnlich";
  if (score >= 1) return "haeufig";
  return "unbekannt";
};

const resolveRankFromThresholds = (definition, metricValue) => {
  const value = clampNonNegative(metricValue);
  const whiteThreshold = clampNonNegative(definition?.thresholds?.white);
  const bronzeThreshold = clampNonNegative(definition?.thresholds?.bronze);
  const silverThreshold = clampNonNegative(definition?.thresholds?.silver);
  const goldThreshold = clampNonNegative(definition?.thresholds?.gold);

  if (definition?.direction === "lower") {
    if (value <= 0) return "gray";
    if (goldThreshold > 0 && value <= goldThreshold) return "gold";
    if (silverThreshold > 0 && value <= silverThreshold) return "silver";
    if (bronzeThreshold > 0 && value <= bronzeThreshold) return "bronze";
    if (whiteThreshold > 0 && value <= whiteThreshold) return "white";
    return "gray";
  }

  if (goldThreshold > 0 && value >= goldThreshold) return "gold";
  if (silverThreshold > 0 && value >= silverThreshold) return "silver";
  if (bronzeThreshold > 0 && value >= bronzeThreshold) return "bronze";
  if (whiteThreshold > 0 && value >= whiteThreshold) return "white";
  return "gray";
};

export const getProfileBadgeRankMeta = (rankKey) => {
  return PROFILE_BADGE_RANK_META[rankKey] || PROFILE_BADGE_RANK_META.gray;
};

export const formatProfileBadgeMetricValue = (definition, metricValue) => {
  const value = clampNonNegative(metricValue);

  switch (definition?.format) {
    case "km":
      return `${value.toFixed(1)} km`;
    case "rank":
      return value > 0 ? `#${Math.round(value)}` : "-";
    case "percent":
      return `${Math.round(value)} %`;
    case "days":
      if (value >= 365) {
        const years = Math.floor(value / 365);
        const months = Math.floor((value % 365) / 30);
        return months > 0 ? `${years} J ${months} M` : `${years} J`;
      }
      if (value >= 30) {
        const months = Math.floor(value / 30);
        return `${months} M`;
      }
      return `${Math.round(value)} T`;
    case "rarity-score":
      return `${getRarityLabelFromScore(value)} (${Math.round(value)})`;
    case "count":
    default:
      return `${Math.round(value)}`;
  }
};

export const evaluateProfileBadges = (metrics) => {
  const safeMetrics = metrics && typeof metrics === "object" ? metrics : {};

  return PROFILE_BADGE_DEFINITIONS.map((definition) => {
    const metricValue = clampNonNegative(safeMetrics[definition.metricKey]);
    const rankKey = resolveRankFromThresholds(definition, metricValue);

    return {
      ...definition,
      value: metricValue,
      rankKey,
      rankMeta: getProfileBadgeRankMeta(rankKey),
      valueLabel: formatProfileBadgeMetricValue(definition, metricValue),
    };
  });
};

export const sanitizeSelectedProfileBadgeIds = (selectedValue, maxSelected = PROFILE_BADGE_MAX_SELECTED) => {
  const normalizedMax = Math.max(1, Math.min(12, Math.round(toSafeNumber(maxSelected) || PROFILE_BADGE_MAX_SELECTED)));

  let source = [];
  if (Array.isArray(selectedValue)) {
    source = selectedValue;
  } else if (typeof selectedValue === "string") {
    const trimmed = selectedValue.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) source = parsed;
      } catch {
        source = trimmed.split(",");
      }
    } else if (trimmed.length > 0) {
      source = trimmed.split(",");
    }
  }

  const uniqueIds = [];
  const seen = new Set();

  for (const rawId of source) {
    const badgeId = String(rawId || "").trim();
    if (!badgeId || seen.has(badgeId) || (!PROFILE_BADGE_IDS.has(badgeId) && !UNIQUE_BADGE_IDS.has(badgeId))) continue;
    seen.add(badgeId);
    uniqueIds.push(badgeId);
    if (uniqueIds.length >= normalizedMax) break;
  }

  return uniqueIds;
};

export const buildSelectedProfileBadges = (
  selectedBadgeIds,
  evaluatedBadges,
  maxSelected = PROFILE_BADGE_MAX_SELECTED,
  ownedUniqueBadges = [],
) => {
  const safeSelectedIds = sanitizeSelectedProfileBadgeIds(selectedBadgeIds, maxSelected);
  const badgeMap = new Map((Array.isArray(evaluatedBadges) ? evaluatedBadges : []).map((badge) => [badge.id, badge]));
  const uniqueMap = new Map((Array.isArray(ownedUniqueBadges) ? ownedUniqueBadges : []).map((badge) => [badge.id, badge]));

  return safeSelectedIds
    .map((badgeId) => badgeMap.get(badgeId) || uniqueMap.get(badgeId) || null)
    .filter(Boolean)
    .slice(0, maxSelected);
};

export const getProfileBadgeDefinitionById = (badgeId) => {
  const normalizedId = String(badgeId || "").trim();
  return PROFILE_BADGE_BY_ID[normalizedId] || null;
};

export {
  PROFILE_BADGE_DEFINITIONS,
  PROFILE_BADGE_MAX_SELECTED,
  PROFILE_BADGE_RANK_META,
};
