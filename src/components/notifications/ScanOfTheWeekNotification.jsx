import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ScanOfTheWeekNotification({ notification, onComplete }) {
  if (!notification) return null;

  const plantName = notification.description || "";
  const message =
    notification.message ||
    "Dein Scan wurde zur Aufnahme der Woche gekürt. Die Community liebt dein Foto!";

  const sparkleNodes = Array.from({ length: 14 }, (_, idx) => {
    const top = 5 + (idx % 5) * 12;
    const left = 4 + ((idx * 17) % 90);
    const delay = idx * 0.09;
    const duration = 2 + (idx % 4) * 0.22;

    return (
      <motion.span
        key={`sotw-sparkle-${idx}`}
        className="pointer-events-none absolute text-amber-200/80"
        style={{ top: `${top}%`, left: `${left}%` }}
        initial={{ opacity: 0, y: 6, scale: 0.7 }}
        animate={{
          opacity: [0, 1, 0],
          y: [6, -18, -38],
          scale: [0.7, 1.15, 0.85],
        }}
        transition={{ duration, delay, repeat: Infinity, ease: "easeOut" }}
      >
        <Sparkles className="h-3.5 w-3.5" />
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
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[3px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 28 }}
          animate={{ opacity: 1, scale: [1, 1.018, 1], y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-amber-200/30 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.32),transparent_45%),radial-gradient(circle_at_80%_8%,rgba(251,191,36,0.22),transparent_40%),linear-gradient(180deg,rgba(24,18,8,0.98)_0%,rgba(16,12,5,0.99)_100%)] p-6 sm:p-8 text-stone-100 shadow-[0_36px_120px_rgba(0,0,0,0.75)]"
        >
          <div className="absolute inset-0 pointer-events-none">
            {sparkleNodes}
          </div>

          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/35 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200/95">
              <Trophy className="h-4 w-4" />
              Scan der Woche
            </div>

            {/* Headline */}
            <h3 className="mt-4 text-2xl sm:text-3xl font-semibold text-amber-50">
              Herzlichen Glückwunsch! 🏆
            </h3>

            {/* Scan name */}
            {plantName ? (
              <p className="mt-2 text-base sm:text-lg font-bold text-amber-200">
                „{plantName}"
              </p>
            ) : null}

            {/* Message */}
            <p className="mt-3 text-sm sm:text-base text-stone-300 leading-relaxed">
              {message}
            </p>

            {/* Reward box */}
            <div className="mt-5 rounded-2xl border border-amber-100/25 bg-black/35 px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex items-center justify-center gap-2 text-amber-100">
                <Zap className="h-6 w-6 text-amber-300" />
                <span className="text-3xl sm:text-4xl font-bold leading-none">
                  +10 Funken
                </span>
              </div>
              <div className="mt-2 text-center text-sm text-amber-100/70">
                wurden deinem Konto gutgeschrieben
              </div>
            </div>

            {/* Close button */}
            <div className="mt-6 flex justify-center">
              <Button
                onClick={() => onComplete?.()}
                className="min-w-36 bg-gradient-to-b from-amber-400 to-orange-500 text-black font-semibold hover:from-amber-300 hover:to-orange-400"
              >
                Danke! 🌟
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
