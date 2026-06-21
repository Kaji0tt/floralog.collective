/**
 * Unique badges are special one-off badges awarded to specific users.
 * They are stored in the `unique_badges` table and cannot be earned through metrics.
 */

const UNIQUE_BADGE_DEFINITIONS = [
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
export const resolveOwnedUniqueBadges = (ownedBadgeIds) => {
  if (!Array.isArray(ownedBadgeIds)) return [];
  return ownedBadgeIds
    .map((id) => UNIQUE_BADGE_BY_ID[id] || null)
    .filter(Boolean)
    .map((badge) => ({
      ...badge,
      value: null,
      valueLabel: badge.label,
      rankMeta: { key: "gold", label: "Gold", color: "#f5c542", order: 4 },
    }));
};

export const isUniqueBadgeId = (badgeId) => {
  return UNIQUE_BADGE_IDS.has(String(badgeId || "").trim());
};

export const getUniqueBadgeById = (badgeId) => {
  return UNIQUE_BADGE_BY_ID[String(badgeId || "").trim()] || null;
};

export { UNIQUE_BADGE_DEFINITIONS, UNIQUE_BADGE_BY_ID, UNIQUE_BADGE_IDS };
