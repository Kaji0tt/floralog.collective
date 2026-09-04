import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CalendarRange, ChevronRight, Users } from "lucide-react";
import BadgeCircleIcon, {
  MUTED_CIRCLE_BACKGROUND_GRADIENT,
  MUTED_CIRCLE_BORDER_GRADIENT,
  MUTED_CIRCLE_SHADOW,
} from "@/components/home/BadgeCircleIcon";

const EVENT_KIND_ICONS = {
  weekly: CalendarDays,
  monthly: CalendarRange,
  community: Users,
};

const EVENT_KIND_LABELS = {
  weekly: "Wochenquest",
  monthly: "Monatsquest",
  community: "Community Event",
};

const ROTATION_INTERVAL_MS = 6000;
const SWIPE_THRESHOLD_PX = 36;

/**
 * Full-width stripe (same visual language as RewardCard) for time-limited content
 * (weekly/monthly quests, later community events). Auto-rotates through `events`
 * inside the same container - old content fades out, next one fades in.
 */
export default function HomeEventStripe({ events = [], isLightUi = false, className = "" }) {
  const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const swipeStartXRef = useRef(null);
  const didSwipeRef = useRef(false);

  useEffect(() => {
    if (activeIndex >= safeEvents.length) setActiveIndex(0);
  }, [safeEvents.length, activeIndex]);

  useEffect(() => {
    if (safeEvents.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % safeEvents.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [safeEvents.length]);

  const activeEvent = safeEvents[activeIndex];

  const borderGradient = isLightUi
    ? "linear-gradient(to bottom right, #000000, #272625, rgba(143,107,34,0.7))"
    : "linear-gradient(to bottom right, #333333, rgba(70, 67, 58, 0.85), #8f6b22)";

  const progressPercent = useMemo(() => {
    if (!activeEvent?.progressTarget) return 0;
    return Math.min(100, Math.max(0, (Number(activeEvent.progressCurrent || 0) / Number(activeEvent.progressTarget)) * 100));
  }, [activeEvent]);

  if (!activeEvent) return null;

  const TypeIcon = EVENT_KIND_ICONS[activeEvent.kind] || CalendarDays;
  const kindLabel = activeEvent.label || EVENT_KIND_LABELS[activeEvent.kind] || "Zeitlich begrenzt";

  const showRelativeEvent = (offset) => {
    if (safeEvents.length <= 1) return;
    setActiveIndex((currentIndex) => (currentIndex + offset + safeEvents.length) % safeEvents.length);
  };

  const handlePointerDown = (event) => {
    swipeStartXRef.current = event.clientX;
    didSwipeRef.current = false;
  };

  const handlePointerUp = (event) => {
    if (swipeStartXRef.current === null) return;

    const horizontalDistance = event.clientX - swipeStartXRef.current;
    swipeStartXRef.current = null;
    if (Math.abs(horizontalDistance) < SWIPE_THRESHOLD_PX) return;

    didSwipeRef.current = true;
    showRelativeEvent(horizontalDistance < 0 ? 1 : -1);
  };

  const handleClick = () => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    activeEvent.onClick?.();
  };

  return (
    <div className={`relative w-full shrink-0 rounded-2xl shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] ${className}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 rounded-2xl backdrop-blur-sm ${isLightUi ? "bg-white/40" : "bg-black/20"}`}
      />
      <div
        className="relative cursor-pointer overflow-hidden p-2.5"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { swipeStartXRef.current = null; }}
        role={activeEvent.onClick ? "button" : undefined}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeEvent.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: "easeInOut" }}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2">
              <BadgeCircleIcon
                size="2rem"
                className="shrink-0"
                borderGradient={MUTED_CIRCLE_BORDER_GRADIENT}
                backgroundGradient={MUTED_CIRCLE_BACKGROUND_GRADIENT}
                shadow={MUTED_CIRCLE_SHADOW}
              >
                <TypeIcon className="h-4 w-4 text-stone-200" />
              </BadgeCircleIcon>
              <div className="min-w-0 flex-1">
                <p className={`text-[9px] font-medium uppercase tracking-wide ${isLightUi ? "text-stone-500" : "text-stone-400/70"}`}>
                  {kindLabel}
                  {activeEvent.isAvailable ? " · Neu" : ""}
                </p>
                <p className={`truncate text-[11px] font-medium leading-tight ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                  {activeEvent.title || "Aufgabe"}
                </p>
              </div>
              {activeEvent.onClick && (
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 opacity-30 ${isLightUi ? "text-stone-500" : "text-stone-300"}`} />
              )}
            </div>

            {activeEvent.description && (
              <p className={`line-clamp-2 text-[9.5px] leading-snug ${isLightUi ? "text-stone-500" : "text-stone-400/80"}`}>
                {activeEvent.isCompleted ? "Abgeschlossen." : activeEvent.description}
              </p>
            )}

            {Number(activeEvent.progressTarget) > 0 && (
              <div className="flex flex-col gap-1">
                <p className={`text-[9px] font-medium ${isLightUi ? "text-stone-500" : "text-stone-400/70"}`}>
                  {`${Math.min(activeEvent.progressCurrent, activeEvent.progressTarget)} / ${activeEvent.progressTarget}`}
                </p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-black/20">
                  <div
                    className="h-full rounded-full opacity-70"
                    style={{ width: `${progressPercent}%`, background: MUTED_CIRCLE_BORDER_GRADIENT }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div aria-hidden="true" className="gold-gradient-border-mask gold-gradient-border-mask-thin" style={{ background: borderGradient }} />
    </div>
  );
}
