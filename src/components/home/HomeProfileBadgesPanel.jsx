import { Leaf } from "lucide-react";
import GoldGradientCard from "@/components/home/GoldGradientCard";

const BADGE_TOP_SIDE_REM = 2.9;
const BADGE_TOP_CENTER_REM = 1.1;
const BADGE_ROW_HEIGHT_REM = 7.25;

const BADGE_ARC_POSITIONS = [
  { left: "16.6667%", topRem: BADGE_TOP_SIDE_REM },
  { left: "50%", topRem: BADGE_TOP_CENTER_REM },
  { left: "83.3333%", topRem: BADGE_TOP_SIDE_REM },
];

const BADGE_RANK_ICON_STYLE = {
  gray: "text-[#9ca3af]",
  white: "text-white",
  bronze: "text-[#cd7f32]",
  silver: "text-[#c0c7d1]",
  gold: "text-[#f5c542]",
};

const BADGE_GLASS_CLASS =
  "border-[#f0e5a5]/55 bg-black/88 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl";

const formatCompactValue = (value) => {
  const safeValue = Math.max(0, Number(value) || 0);
  if (safeValue < 1000) return String(Math.round(safeValue));
  if (safeValue < 1000000) return `${Math.round(safeValue / 1000)}k`;
  return `${Math.round(safeValue / 1000000)}m`;
};

/**
 * Dedicated profile-badges container: arc-positioned badge icons plus the
 * detail info (label/description/value/rank) shown directly below instead of on hover.
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
    <GoldGradientCard className={className} contentClassName="px-3 pt-3 pb-2.5">
      <div className="relative" style={{ height: `${BADGE_ROW_HEIGHT_REM}rem` }} aria-label="Ausgewählte Abzeichen">
        {badgeSlots.map((badge, slotIndex) => {
          const badgePosition = BADGE_ARC_POSITIONS[slotIndex] || BADGE_ARC_POSITIONS[1];
          const badgePositionStyle = { left: badgePosition.left, top: `${badgePosition.topRem}rem` };

          if (!badge) {
            return (
              <div
                key={`badge-slot-empty-${slotIndex}`}
                style={badgePositionStyle}
                className={`absolute -translate-x-1/2 h-16 w-16 overflow-hidden rounded-full border flex items-center justify-center text-[9px] font-medium ${BADGE_GLASS_CLASS}`}
              >
                <span className="text-stone-300/70">Leer</span>
              </div>
            );
          }

          const Icon = badge?.Icon || Leaf;
          const rankKey = String(badge?.rankKey || "gray").toLowerCase();
          const iconToneClass = BADGE_RANK_ICON_STYLE[rankKey] || BADGE_RANK_ICON_STYLE.gray;
          const valueLabel = resolveBadgeValueLabel(badge);

          return (
            <div
              key={badge.id}
              style={badgePositionStyle}
              className={`absolute -translate-x-1/2 h-16 w-16 overflow-hidden rounded-full border flex flex-col items-center justify-center gap-1 ${BADGE_GLASS_CLASS}`}
              aria-label={`${badge.label}: ${valueLabel}`}
            >
              <Icon className={`h-6 w-6 ${iconToneClass}`} />
              <span className="w-full max-w-[3.3rem] text-center text-[10px] leading-none font-bold text-stone-100">
                {valueLabel}
              </span>
            </div>
          );
        })}
      </div>

      <div className={`space-y-1.5 border-t pt-2 ${isLightUi ? "border-stone-800/10" : "border-white/10"}`}>
        {badgeSlots.filter(Boolean).map((badge) => {
          const Icon = badge?.Icon || Leaf;
          const rankKey = String(badge?.rankKey || "gray").toLowerCase();
          const iconToneClass = BADGE_RANK_ICON_STYLE[rankKey] || BADGE_RANK_ICON_STYLE.gray;
          const rankLabel = badge?.rankMeta?.label || "Grau";
          const valueLabel = resolveBadgeValueLabel(badge);

          return (
            <div key={`${badge.id}-info`} className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconToneClass}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold">{badge.label}</p>
                  <span className={`shrink-0 text-[10px] font-semibold ${isLightUi ? "text-stone-700" : "text-stone-200/90"}`}>
                    {valueLabel} · {rankLabel}
                  </span>
                </div>
                {badge.description && (
                  <p className={`truncate text-[10px] leading-snug ${isLightUi ? "text-stone-600" : "text-stone-300/75"}`}>
                    {badge.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GoldGradientCard>
  );
}
