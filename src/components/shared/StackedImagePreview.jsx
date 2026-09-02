import React from "react";

/**
 * Lightweight fanned/card-stack image preview, reusing the slot geometry from
 * SpeciesInfoCard's swipeable stack (percentage-based left/top/width/height/opacity/zIndex),
 * but without the drag-follow-finger interaction — images cycle on tap of the counter badge
 * or via the optional onCycle callback. Intended for static contexts like the multi-photo
 * capture preview and the community-scans section.
 *
 * @param {{
 *   images: string[],
 *   activeIndex?: number,
 *   onCycle?: () => void,
 *   compact?: boolean,
 *   className?: string,
 *   emptyContent?: React.ReactNode,
 * }} props
 */
export default function StackedImagePreview({
  images = [],
  activeIndex = 0,
  onCycle,
  compact = false,
  className = "",
  emptyContent = null,
}) {
  const safeImages = Array.isArray(images) ? images.filter(Boolean) : [];
  const total = safeImages.length;
  const safeActiveIndex = total > 0 ? ((activeIndex % total) + total) % total : 0;

  const ordered = total > 0
    ? Array.from({ length: total }, (_, offset) => safeImages[(safeActiveIndex + offset) % total])
    : [];

  const front = ordered[0] || null;
  const second = ordered[1] || null;
  const third = ordered[2] || null;
  const hasStacked = total > 1;
  const hasThreePlus = total > 2;
  const frontWidth = hasStacked ? 85 : 100;

  const secondSlot = hasThreePlus
    ? { left: 85, top: 6, width: 10, height: 90, opacity: 0.44, zIndex: 20 }
    : { left: 85, top: 6, width: 15, height: 90, opacity: 0.44, zIndex: 20 };
  const thirdSlot = hasThreePlus
    ? { left: 95, top: 12, width: 5, height: 82, opacity: 0.3, zIndex: 10 }
    : { left: 85, top: 6, width: 15, height: 90, opacity: 0.3, zIndex: 10 };

  const slotStyle = (slot) => ({
    left: `${slot.left}%`,
    top: `${slot.top}%`,
    width: `${slot.width}%`,
    height: `${slot.height}%`,
    opacity: slot.opacity,
    zIndex: slot.zIndex,
    pointerEvents: "none",
  });

  if (total === 0) {
    return emptyContent;
  }

  return (
    <div
      className={`relative w-full overflow-hidden ${compact ? "aspect-square" : "aspect-[4/3]"} ${className}`}
      onClick={hasStacked && onCycle ? onCycle : undefined}
      role={hasStacked && onCycle ? "button" : undefined}
    >
      <div className="absolute overflow-hidden" style={{ left: 0, top: 0, width: `${frontWidth}%`, height: "100%", zIndex: 30 }}>
        <img src={front} alt="" className="w-full h-full object-cover" />
      </div>
      {second && (
        <div className="absolute overflow-hidden" style={slotStyle(secondSlot)}>
          <img src={second} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      {third && (
        <div className="absolute overflow-hidden" style={slotStyle(thirdSlot)}>
          <img src={third} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      {total > 1 && (
        <div className="absolute bottom-1 right-1 z-40 rounded-full bg-black/70 text-white text-[9px] px-1.5 py-0.5 leading-none pointer-events-none">
          +{total - 1}
        </div>
      )}
    </div>
  );
}
