import { Leaf } from "lucide-react";
import BadgeCircleIcon from "@/components/home/BadgeCircleIcon";

const BADGE_RANK_ICON_STYLE = {
  gray: "text-[#9ca3af]",
  white: "text-white",
  bronze: "text-[#cd7f32]",
  silver: "text-[#c0c7d1]",
  gold: "text-[#f5c542]",
};

const formatCompactValue = (value) => {
  const safeValue = Math.max(0, Number(value) || 0);
  if (safeValue < 1000) return String(Math.round(safeValue));
  if (safeValue < 1000000) return `${Math.round(safeValue / 1000)}k`;
  return `${Math.round(safeValue / 1000000)}m`;
};

// Badges are centered on the card's top edge; left/right badges are lifted further above it.
const SIDE_BADGE_EXTRA_LIFT_PX = 15;
// BadgeCircleIcon's default size (see BadgeCircleIcon.jsx); translateY(-75%) leaves this fraction
// of the circle below the column's top edge, so the column needs at least that much height or the
// sibling below (RewardCardWrapper) sits directly under it and the circle overlaps it.
const BADGE_CIRCLE_SIZE_REM = 3.5;
const BADGE_CIRCLE_VISIBLE_BELOW_TOP_REM = BADGE_CIRCLE_SIZE_REM * 0.25;

/**
 * Dedicated profile-badges container: 3 equal columns, each showing the badge icon
 * plus its own label/rank/description directly beneath - no separate arc or list.
 */
export default function HomeProfileBadgesPanel({
  isLightUi,
  selectedProfileBadges = [],
  playerSeeds = 0,
  className = "",
}) {
  const selectedBadges = Array.isArray(selectedProfileBadges)
    ? selectedProfileBadges.filter(Boolean).slice(0, 3)
    : [];
  const badgeSlots = Array.from({ length: 3 }, (_, index) => selectedBadges[index] || null);

  if (badgeSlots.every((badge) => !badge)) {
    return null;
  }

  const resolveBadgeValueLabel = (badge) => {
    if (!badge) return "-";
    if (badge.id === "seed_rank_medal") return formatCompactValue(playerSeeds);
    if (badge.id === "distance_waypoints") return String(badge.valueLabel || "-").replace(/\s*km$/i, "").trim();
    return String(badge.valueLabel || "-");
  };

  return (
    <div className={className}>
      <div
        className="grid grid-cols-3"
        style={{ minHeight: `${BADGE_CIRCLE_VISIBLE_BELOW_TOP_REM}rem` }}
        aria-label="Ausgewählte Abzeichen"
      >
        {badgeSlots.map((badge, slotIndex) => {
          const isSideSlot = slotIndex !== 1;
          const circleTransform = isSideSlot
            ? `translateY(calc(-75% - ${SIDE_BADGE_EXTRA_LIFT_PX}px))`
            : "translateY(-75%)";

          if (!badge) {
            return (
              <div key={`badge-slot-empty-${slotIndex}`} className="relative min-w-0">
                <BadgeCircleIcon
                  className="absolute left-1/2 top-0 z-10 text-[9px] font-medium text-stone-100"
                  style={{ transform: `translateX(-50%) ${circleTransform}` }}
                >
                  <span className="opacity-70">Leer</span>
                </BadgeCircleIcon>
              </div>
            );
          }

          const Icon = badge?.Icon || Leaf;
          const rankKey = String(badge?.rankKey || "gray").toLowerCase();
          const iconToneClass = BADGE_RANK_ICON_STYLE[rankKey] || BADGE_RANK_ICON_STYLE.gray;
          const valueLabel = resolveBadgeValueLabel(badge);

          return (
            <div key={badge.id} className="relative min-w-0">
              <BadgeCircleIcon
                className="absolute left-1/2 top-0 z-10 shrink-0"
                style={{ transform: `translateX(-50%) ${circleTransform}` }}
                contentClassName="flex-col gap-0.5"
                aria-label={`${badge.label}: ${valueLabel}`}
              >
                <Icon className={`h-5 w-5 ${iconToneClass}`} />
                <span className="w-full max-w-[3rem] truncate text-center text-[10px] leading-none font-bold text-stone-50">
                  {valueLabel}
                </span>
              </BadgeCircleIcon>
            </div>
          );
        })}
      </div>
    </div>
  );
}
