/**
 * Unique badges are special one-off badges awarded to specific users.
 * They are stored in the `unique_badges` table and cannot be earned through metrics.
 */

const UNIQUE_BADGE_DEFINITIONS = [
  {
    id: "season1_rank_1",
    label: "Season 1 #1",
    description: "Platz 1 in der Season-1-Samenrangliste.",
    iconKey: "medal",
    rankKey: "gold",
    isUnique: true,
  },
  {
    id: "season1_rank_2",
    label: "Season 1 #2",
    description: "Platz 2 in der Season-1-Samenrangliste.",
    iconKey: "medal",
    rankKey: "silver",
    isUnique: true,
  },
  {
    id: "season1_rank_3",
    label: "Season 1 #3",
    description: "Platz 3 in der Season-1-Samenrangliste.",
    iconKey: "medal",
    rankKey: "bronze",
    isUnique: true,
  },
  {
    id: "season1_rank_4",
    label: "Season 1 #4",
    description: "Platz 4 in der Season-1-Samenrangliste.",
    iconKey: "medal",
    rankKey: "white",
    isUnique: true,
  },
  ...[5, 6, 7, 8, 9, 10].map((rank) => ({
    id: `season1_rank_${rank}`,
    label: `Season 1 #${rank}`,
    description: `Platz ${rank} in der Season-1-Samenrangliste.`,
    iconKey: "medal",
    rankKey: "gray",
    isUnique: true,
  })),
  {
    id: "legacy_rank_1",
    label: "Legacy #1",
    description: "Platz 1 in der Legacy-Version von Floralog erreicht.",
    iconKey: "medal",
    rankKey: "gold",
    isUnique: true,
  },
  {
    id: "legacy_rank_2",
    label: "Legacy #2",
    description: "Platz 2 in der Legacy-Version von Floralog erreicht.",
    iconKey: "medal",
    rankKey: "gold",
    isUnique: true,
  },
  {
    id: "legacy_rank_3",
    label: "Legacy #3",
    description: "Platz 3 in der Legacy-Version von Floralog erreicht.",
    iconKey: "medal",
    rankKey: "gold",
    isUnique: true,
  },
  {
    id: "legacy_rank_4",
    label: "Legacy #4",
    description: "Platz 4 in der Legacy-Version von Floralog erreicht.",
    iconKey: "medal",
    rankKey: "gold",
    isUnique: true,
  },
  {
    id: "legacy_rank_5",
    label: "Legacy #5",
    description: "Platz 5 in der Legacy-Version von Floralog erreicht.",
    iconKey: "medal",
    rankKey: "gold",
    isUnique: true,
  },
];

const UNIQUE_BADGE_BY_ID = Object.fromEntries(
  UNIQUE_BADGE_DEFINITIONS.map((def) => [def.id, def])
);

const UNIQUE_BADGE_IDS = new Set(Object.keys(UNIQUE_BADGE_BY_ID));

/**
 * Given a list of badge IDs the user owns (from unique_badges table),
 * returns the full badge objects with rank meta attached.
 */
/** @param {unknown} ownedBadgeIds */
export const resolveOwnedUniqueBadges = (ownedBadgeIds) => {
  if (!Array.isArray(ownedBadgeIds)) return [];
  return ownedBadgeIds
    .map((id) => UNIQUE_BADGE_BY_ID[id] || null)
    .filter(Boolean)
    .map((badge) => ({
      ...badge,
      value: null,
      valueLabel: badge.label,
      rankMeta: getUniqueBadgeRankMeta(badge.rankKey),
    }));
};

/** @type {Record<string, { key: string, label: string, color: string, order: number }>} */
const UNIQUE_BADGE_RANK_META = {
  gray: { key: "gray", label: "Grau", color: "#9ca3af", order: 0 },
  white: { key: "white", label: "Weiss", color: "#f8fafc", order: 1 },
  bronze: { key: "bronze", label: "Bronze", color: "#cd7f32", order: 2 },
  silver: { key: "silver", label: "Silber", color: "#c0c7d1", order: 3 },
  gold: { key: "gold", label: "Gold", color: "#f5c542", order: 4 },
};

/** @param {unknown} rankKey */
function getUniqueBadgeRankMeta(rankKey) {
  const normalizedRankKey = String(rankKey || "");
  return UNIQUE_BADGE_RANK_META[normalizedRankKey] || UNIQUE_BADGE_RANK_META.gray;
}

/** @param {unknown} badgeId */
export const isUniqueBadgeId = (badgeId) => {
  return UNIQUE_BADGE_IDS.has(String(badgeId || "").trim());
};

/** @param {unknown} badgeId */
export const getUniqueBadgeById = (badgeId) => {
  return UNIQUE_BADGE_BY_ID[String(badgeId || "").trim()] || null;
};

export { UNIQUE_BADGE_DEFINITIONS, UNIQUE_BADGE_BY_ID, UNIQUE_BADGE_IDS };
