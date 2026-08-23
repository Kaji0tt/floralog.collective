import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiTheme } from "@/lib/UiThemeContext";
import ScanStreakRewardTrack from "@/components/home/ScanStreakRewardTrack";

// Pflege uses the exact color of the "care" stat bar in the Home health/status display.
const PFLEGE_TEXT_COLOR = "#f59e0b";
const SPARKLE_DISPLAY_MS = 2000;

export default function DailyLoginSparkNotification({ feedback, onComplete }) {
  const { isLightUi } = useUiTheme();
  const [showSparkles, setShowSparkles] = useState(true);

  useEffect(() => {
    if (!feedback) return undefined;
    setShowSparkles(true);
    const timeoutId = window.setTimeout(() => setShowSparkles(false), SPARKLE_DISPLAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  if (!feedback) return null;

  const isClaimed = feedback?.mode === "claimed";
  const streakDays = Math.max(0, Number(feedback?.streakDays ?? 0));
  const jokerCount = Math.max(0, Number(feedback?.jokerCount ?? 0));
  const pflegeDelta = Math.max(0, Number(feedback?.pflegeDelta ?? 0));
  const funkenDelta = Math.max(0, Number(feedback?.funkenDelta ?? 0));
  const bernsteinDelta = Math.max(0, Number(feedback?.bernsteinDelta ?? 0));
  const isBoundaryDay = Boolean(feedback?.isBoundaryDay);

  const sparkleNodes = Array.from({ length: 12 }, (_, idx) => {
    const top = 8 + (idx % 4) * 14;
    const left = 6 + ((idx * 13) % 88);
    const delay = idx * 0.08;
    const duration = 1.8 + (idx % 3) * 0.25;

    return (
      <motion.span
        key={`daily-login-sparkle-${idx}`}
        className={`pointer-events-none absolute ${isLightUi ? "text-[#c8ac62]/80" : "text-[#f0e5a5]/80"}`}
        style={{ top: `${top}%`, left: `${left}%` }}
        initial={{ opacity: 0, y: 8, scale: 0.75 }}
        animate={{ opacity: [0, 1, 0], y: [8, -16, -32], scale: [0.75, 1.1, 0.9] }}
        transition={{ duration, delay, repeat: Infinity, ease: "easeOut" }}
      >
        <Sparkles className="h-4 w-4" />
      </motion.span>
    );
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2150] flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[3px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 24 }}
          animate={{ opacity: 1, scale: [1, 1.015, 1], y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className={`relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border backdrop-blur-xl p-6 sm:p-8 shadow-[0_36px_120px_rgba(0,0,0,0.55)] ${
            isLightUi ? "border-[#c8ac62]/45 bg-white/85 text-stone-800" : "border-[#f0e5a5]/35 bg-black/70 text-stone-100"
          }`}
        >
          {showSparkles && <div className="absolute inset-0">{sparkleNodes}</div>}

          <div className="relative z-10">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                isLightUi ? "border-[#c8ac62]/45 bg-[#c8ac62]/15 text-[#8f6b22]" : "border-[#f0e5a5]/35 bg-[#f0e5a5]/10 text-[#f0e5a5]"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Scan-Streak
            </div>

            <h3 className={`mt-4 text-2xl sm:text-3xl font-semibold ${isLightUi ? "text-stone-800" : "text-amber-50"}`}>
              Willkommen zurueck!
            </h3>

            <div
              className={`mt-4 rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 ${
                isLightUi ? "border-[#c8ac62]/35 bg-white/60" : "border-[#f0e5a5]/20 bg-black/35"
              }`}
            >
              <div className={`text-center text-sm sm:text-base ${isLightUi ? "text-stone-700" : "text-stone-200/90"}`}>
                {isClaimed
                  ? "Heute schon erhalten:"
                  : "Dein naechster Scan heute bringt dir:"}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-lg sm:text-xl font-bold">
                {pflegeDelta > 0 && <span style={{ color: PFLEGE_TEXT_COLOR }}>+{pflegeDelta} Pflege</span>}
                {funkenDelta > 0 && <span className="text-amber-300">+{funkenDelta} Funken</span>}
                {bernsteinDelta > 0 && <span className="text-orange-300">+{bernsteinDelta} Bernstein</span>}
              </div>

              <div className={`mt-3 text-center text-sm sm:text-base ${isLightUi ? "text-stone-700" : "text-stone-200/90"}`}>
                Streak:{" "}
                <span className={`font-semibold ${isLightUi ? "text-stone-800" : "text-amber-50"}`}>{streakDays}</span> Tage
                {isBoundaryDay && (
                  <span className="ml-2 rounded-full border border-amber-200/40 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                    Wochen-Bonus
                  </span>
                )}
              </div>
              {jokerCount > 0 && (
                <div className={`mt-1 text-center text-xs sm:text-sm ${isLightUi ? "text-stone-600" : "text-stone-300/80"}`}>
                  {jokerCount} Joker verfuegbar
                </div>
              )}
            </div>

            <div className="mt-4">
              <ScanStreakRewardTrack streakDays={streakDays} jokerCount={jokerCount} />
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                onClick={() => onComplete?.()}
                className="min-w-36 border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 text-white shadow-[0_8px_24px_rgba(34,197,94,0.3)] hover:brightness-110"
              >
                OK
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
