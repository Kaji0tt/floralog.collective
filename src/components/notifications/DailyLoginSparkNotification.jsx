import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DailyLoginSparkNotification({ feedback, onComplete }) {
  if (!feedback) return null;

  const awardedAmount = Math.max(0, Number(feedback?.awardedAmount ?? 0));
  const streakDays = Math.max(0, Number(feedback?.streakDays ?? 0));
  const sparksBalance = Math.max(0, Number(feedback?.sparksBalance ?? 0));

  const sparkleNodes = Array.from({ length: 12 }, (_, idx) => {
    const top = 8 + (idx % 4) * 14;
    const left = 6 + ((idx * 13) % 88);
    const delay = idx * 0.08;
    const duration = 1.8 + (idx % 3) * 0.25;

    return (
      <motion.span
        key={`daily-login-sparkle-${idx}`}
        className="pointer-events-none absolute text-amber-200/90"
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
          className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-amber-200/30 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.3),transparent_45%),radial-gradient(circle_at_80%_8%,rgba(251,191,36,0.24),transparent_40%),linear-gradient(180deg,rgba(24,18,8,0.98)_0%,rgba(16,12,5,0.99)_100%)] p-6 sm:p-8 text-stone-100 shadow-[0_36px_120px_rgba(0,0,0,0.72)]"
        >
          <div className="absolute inset-0">{sparkleNodes}</div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/35 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200/95">
              <Sparkles className="h-4 w-4" />
              Taeglicher Login-Bonus
            </div>

            <h3 className="mt-4 text-2xl sm:text-3xl font-semibold text-amber-50">
              Willkommen zurueck!
            </h3>

            <div className="mt-4 rounded-2xl border border-amber-100/25 bg-black/35 px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex items-center justify-center gap-2 text-amber-100">
                <Zap className="h-6 w-6 text-amber-300" />
                <span className="text-3xl sm:text-4xl font-bold leading-none">+{awardedAmount} Funken</span>
              </div>
              <div className="mt-3 text-center text-sm sm:text-base text-amber-100/90">
                Streak: <span className="font-semibold text-amber-50">{streakDays}</span> Tage (Cap 3)
              </div>
              <div className="mt-1 text-center text-xs sm:text-sm text-stone-200/90">
                Neuer Kontostand: <span className="font-semibold text-amber-100">{sparksBalance} Funken</span>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                onClick={() => onComplete?.()}
                className="min-w-36 bg-gradient-to-b from-amber-400 to-orange-500 text-black font-semibold hover:from-amber-300 hover:to-orange-400"
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
