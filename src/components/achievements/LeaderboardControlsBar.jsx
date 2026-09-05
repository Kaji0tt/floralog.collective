import { useRef } from "react";
import { ChevronLeft, ChevronRight, Sprout, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GoldGradientCard from "@/components/home/GoldGradientCard";

/**
 * @param {{
 *   seasons: Array<{ id: string, title: string, emoji?: string }>,
 *   selectedSeasonId: string,
 *   onSelectSeason: (seasonId: string) => void,
 *   metric: "seeds" | "highest_scan",
 *   onChangeMetric: (metric: "seeds" | "highest_scan") => void,
 *   isLightUi?: boolean,
 * }} props
 */
export default function LeaderboardControlsBar({
  seasons = [],
  selectedSeasonId,
  onSelectSeason,
  metric = "seeds",
  onChangeMetric,
  isLightUi = false,
}) {
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);

  const currentIndex = seasons.findIndex((s) => s.id === selectedSeasonId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentSeason = seasons[safeIndex] || seasons[0];

  const handlePrev = () => {
    if (seasons.length === 0) return;
    const nextIndex = (safeIndex - 1 + seasons.length) % seasons.length;
    onSelectSeason(seasons[nextIndex].id);
  };

  const handleNext = () => {
    if (seasons.length === 0) return;
    const nextIndex = (safeIndex + 1) % seasons.length;
    onSelectSeason(seasons[nextIndex].id);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - (touchStartYRef.current || touch.clientY);

    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const metricOptions = [
    {
      id: "seeds",
      label: "Samen",
      icon: Sprout,
    },
    {
      id: "highest_scan",
      label: "Scanergebnis",
      icon: Sparkles,
    },
  ];

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Container with Season Selector */}
      <GoldGradientCard
        as="div"
        className="w-full shrink-0"
        blur
        rounded="2xl"
        shadow={false}
        borderClassName="gold-gradient-border-mask-thin"
        contentClassName="p-2 flex flex-col items-center justify-center"
      >
        <div
          className="w-full flex items-center justify-between px-2 select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Vorherige Saison"
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-95 ${
              isLightUi
                ? "bg-white/80 text-stone-700 hover:bg-white border border-[#d9c48a]/50"
                : "bg-black/40 text-[#f7f0c1] hover:bg-black/60 border border-[#f0e5a5]/30 shadow-sm"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-center min-w-0 flex-1 px-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentSeason.id}
                initial={{ opacity: 0, y: -3, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 3, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className="flex items-center gap-2 text-center truncate"
              >
                <span
                  className={`text-xl sm:text-2xl font-black tracking-wide truncate ${
                    isLightUi
                      ? "text-[#8f6b22] drop-shadow-[0_2px_6px_rgba(200,172,98,0.6)]"
                      : "text-[#fefce8] drop-shadow-[0_2px_14px_rgba(240,229,165,0.9)] [text-shadow:_0_3px_10px_rgba(0,0,0,0.95)]"
                  }`}
                >
                  {currentSeason.title}
                </span>
                {currentSeason.emoji && (
                  <span className="text-xl sm:text-2xl flex-shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                    {currentSeason.emoji}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Nächste Saison"
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-95 ${
              isLightUi
                ? "bg-white/80 text-stone-700 hover:bg-white border border-[#d9c48a]/50"
                : "bg-black/40 text-[#f7f0c1] hover:bg-black/60 border border-[#f0e5a5]/30 shadow-sm"
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </GoldGradientCard>

      {/* Row 2: Metric Buttons außerhalb des Containers, mittig mit 16px Abstand und Schattenwurf */}
      <div className="flex items-center justify-center gap-4 w-full py-0.5">
        {metricOptions.map((opt) => {
          const isSelected = metric === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeMetric(opt.id)}
              className={`flex items-center justify-center gap-1.5 py-1 px-2 text-xs sm:text-sm font-bold transition-all ${
                isSelected
                  ? isLightUi
                    ? "text-[#785918] font-black scale-105 drop-shadow-[0_1px_3px_rgba(200,172,98,0.6)]"
                    : "text-[#fefce8] font-black scale-105 drop-shadow-[0_2px_10px_rgba(240,229,165,0.9)] [text-shadow:_0_2px_8px_rgba(0,0,0,0.95)]"
                  : isLightUi
                  ? "text-stone-600 hover:text-stone-900 opacity-75 hover:opacity-100 drop-shadow-sm"
                  : "text-stone-300 hover:text-stone-100 opacity-75 hover:opacity-100 [text-shadow:_0_1px_6px_rgba(0,0,0,0.85)]"
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${
                  isSelected
                    ? isLightUi
                      ? "text-[#8f6b22]"
                      : "text-amber-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]"
                    : isLightUi
                    ? "text-stone-500"
                    : "text-stone-400"
                }`}
              />
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
