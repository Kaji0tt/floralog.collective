import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * @param {{
 *   seasons: Array<{ id: string, title: string, emoji?: string }>,
 *   selectedSeasonId: string,
 *   onSelectSeason: (seasonId: string) => void,
 *   isLightUi?: boolean,
 * }} props
 */
export default function SeasonSelector({
  seasons,
  selectedSeasonId,
  onSelectSeason,
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

    // Only swipe if horizontal movement is prominent
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  return (
    <div
      className="relative w-full flex items-center justify-center py-2 select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="inline-flex items-center justify-center gap-2 sm:gap-3 px-2">
        {/* Left Chevron */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Vorherige Saison"
          className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all active:scale-95 ${
            isLightUi
              ? "bg-white/80 border-[#d9c48a]/60 text-stone-700 hover:bg-white shadow-sm"
              : "bg-black/40 border-[#f0e5a5]/30 text-[#f7f0c1] hover:bg-black/60 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Center highlighted season title with bold text and drop-shadow */}
        <div className="flex items-center justify-center min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentSeason.id}
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-1.5 text-center min-w-0 px-1"
            >
              <span
                className={`text-xl sm:text-2xl font-black tracking-wide truncate ${
                  isLightUi
                    ? "text-[#8f6b22] drop-shadow-[0_2px_8px_rgba(200,172,98,0.55)]"
                    : "text-[#fefce8] drop-shadow-[0_2px_14px_rgba(240,229,165,0.85)] [text-shadow:_0_3px_12px_rgba(0,0,0,0.9)]"
                }`}
              >
                {currentSeason.title}
              </span>
              {currentSeason.emoji && (
                <span className="text-lg sm:text-xl flex-shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                  {currentSeason.emoji}
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Chevron */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Nächste Saison"
          className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all active:scale-95 ${
            isLightUi
              ? "bg-white/80 border-[#d9c48a]/60 text-stone-700 hover:bg-white shadow-sm"
              : "bg-black/40 border-[#f0e5a5]/30 text-[#f7f0c1] hover:bg-black/60 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
