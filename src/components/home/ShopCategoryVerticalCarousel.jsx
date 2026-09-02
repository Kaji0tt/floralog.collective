import { useEffect, useRef, useState } from "react";
import GoldGradientCard from "@/components/home/GoldGradientCard";
import { FLAT_CATEGORY_ENTRIES } from "@/components/shop/ShopFeatureRoot";

const ROW_HEIGHT_PX = 28;
const VISIBLE_ROW_COUNT = 5;
const CENTER_ROW_INDEX = Math.floor(VISIBLE_ROW_COUNT / 2);
const CAROUSEL_HEIGHT_PX = ROW_HEIGHT_PX * VISIBLE_ROW_COUNT;
const ROW_HEIGHT_CLASS = "h-7";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const TRACK_FADE_MASK = "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.55) 20%, #000 38%, #000 62%, rgba(0,0,0,0.55) 80%, transparent 100%)";

/**
 * Vertical replacement for the horizontal ProfileCategorySnapCarousel, rendered in Home.jsx's
 * "Anpassen" header (where the currency chips used to sit). Same subtext font styling as the
 * default Home header, active entry wrapped in a GoldGradientCard pill.
 */
export default function ShopCategoryVerticalCarousel({ activeKey, onSelect, isLightUi }) {
  const activeIndex = Math.max(0, FLAT_CATEGORY_ENTRIES.findIndex((entry) => entry.key === activeKey));
  const widestCategoryTitle = FLAT_CATEGORY_ENTRIES.reduce(
    (widestTitle, entry) => entry.title.length > widestTitle.length ? entry.title : widestTitle,
    "",
  );
  const [offsetY, setOffsetY] = useState(0);
  const dragStartYRef = useRef(null);
  const dragStartOffsetRef = useRef(0);
  const wheelCommitTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const maxOffsetUp = -((FLAT_CATEGORY_ENTRIES.length - 1 - activeIndex) * ROW_HEIGHT_PX);
  const maxOffsetDown = activeIndex * ROW_HEIGHT_PX;
  const trackOffsetY = (CENTER_ROW_INDEX - activeIndex) * ROW_HEIGHT_PX + offsetY;

  useEffect(() => () => window.clearTimeout(wheelCommitTimerRef.current), []);

  const getNearestIndex = (currentOffsetY) => clamp(
    activeIndex - Math.round(currentOffsetY / ROW_HEIGHT_PX),
    0,
    FLAT_CATEGORY_ENTRIES.length - 1,
  );

  const settleSelection = (currentOffsetY) => {
    const nearestIndex = getNearestIndex(currentOffsetY);
    setOffsetY(0);
    if (nearestIndex !== activeIndex) {
      onSelect(FLAT_CATEGORY_ENTRIES[nearestIndex].key);
    }
  };

  const updateOffset = (nextOffsetY) => {
    setOffsetY(clamp(nextOffsetY, maxOffsetUp, maxOffsetDown));
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartYRef.current = event.clientY;
    dragStartOffsetRef.current = offsetY;
    suppressClickRef.current = false;
  };

  const handlePointerMove = (event) => {
    if (dragStartYRef.current === null) return;
    const deltaY = event.clientY - dragStartYRef.current;
    if (Math.abs(deltaY) > 4) suppressClickRef.current = true;
    updateOffset(dragStartOffsetRef.current + deltaY);
  };

  const handlePointerEnd = (event) => {
    if (dragStartYRef.current === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartYRef.current = null;
    settleSelection(offsetY);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const nextOffsetY = clamp(offsetY - event.deltaY, maxOffsetUp, maxOffsetDown);
    setOffsetY(nextOffsetY);
    window.clearTimeout(wheelCommitTimerRef.current);
    wheelCommitTimerRef.current = window.setTimeout(() => settleSelection(nextOffsetY), 130);
  };

  return (
    <div
      className="pointer-events-auto relative inline-block w-max select-none touch-none"
      style={{ height: CAROUSEL_HEIGHT_PX }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={handleWheel}
    >
      <span
        aria-hidden="true"
        className="invisible block h-7 px-3 text-sm font-bold md:text-base"
      >
        {widestCategoryTitle}
      </span>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0"
        style={{ top: CENTER_ROW_INDEX * ROW_HEIGHT_PX }}
      >
        <GoldGradientCard
          className={`rounded-full ${ROW_HEIGHT_CLASS}`}
          contentClassName={`rounded-full ${ROW_HEIGHT_CLASS}`}
          blur
        />
      </div>
      <div
        className="absolute inset-0 z-10 overflow-hidden"
        style={{ maskImage: TRACK_FADE_MASK, WebkitMaskImage: TRACK_FADE_MASK }}
      >
        <div
          className="absolute inset-x-0 top-0 will-change-transform"
          style={{ transform: `translateY(${trackOffsetY}px)` }}
        >
          {FLAT_CATEGORY_ENTRIES.map((entry, index) => {
            const nearestIndex = getNearestIndex(offsetY);
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  onSelect(entry.key);
                }}
                className={`flex w-full items-center truncate px-3 text-left text-sm md:text-base [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.7)] ${ROW_HEIGHT_CLASS} ${index === nearestIndex ? "font-bold" : "font-normal"} ${isLightUi ? "text-[#6f5314]" : "text-[#f8efbe]"}`}
              >
                {entry.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
