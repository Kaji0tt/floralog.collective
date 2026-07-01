import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dice6, Gift, Sparkles } from "lucide-react";

/**
 * Zeigt eine Benachrichtigung an, wenn der Spieler einen zufälligen Glücks-Reward erhalten hat.
 * Props:
 *   reward  – { id, display_name, name, image_url, value, random_chance }
 *   remainingCount – Anzahl weiterer ausstehender Random-Rewards
 *   onComplete – Callback, wenn die Notification geschlossen wird
 */
export default function RandomRewardNotification({ reward, remainingCount = 0, onComplete }) {
  useEffect(() => {
    if (!reward) return undefined;

    const timeoutId = window.setTimeout(() => {
      onComplete?.();
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [reward, onComplete]);

  if (!reward) return null;

  const title = reward.display_name || reward.name || "Glücks-Reward";
  const imageUrl = reward.image_url || null;
  const value = reward.value || "";
  const chance = reward.random_chance ? `1 : ${reward.random_chance}` : null;

  // Floating sparkle particles
  const sparks = Array.from({ length: 6 }, (_, i) => {
    const delay = i * 0.18;
    const duration = 1.6 + Math.random() * 0.8;
    return { delay, duration };
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[130] flex items-end justify-center p-4 md:items-center"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[3px]" />

        {/* Floating sparkles */}
        {sparks.map((s, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute text-amber-300/70 select-none"
            style={{
              left: `${15 + i * 14}%`,
              top: `${30 + (i % 2) * 15}%`,
            }}
            animate={{
              opacity: [0, 1, 0],
              y: [6, -24, -48],
              scale: [0.6, 1.1, 0.7],
            }}
            transition={{
              duration: s.duration,
              delay: s.delay,
              repeat: Infinity,
              ease: "easeOut",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </motion.span>
        ))}

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: "spring", damping: 26, stiffness: 250 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/35 bg-black/60 p-5 text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          {/* Background gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-500/20 via-amber-300/10 to-black/40" />

          <div className="relative z-10 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-500/25 text-amber-200">
                <Dice6 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                  Glücks-Reward
                </p>
                <h3 className="text-xl font-bold text-stone-50">Zufalls-Freischaltung!</h3>
              </div>
            </div>

            {/* Reward box */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="flex items-center gap-4 rounded-2xl border border-amber-300/25 bg-black/35 p-3"
            >
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-amber-300/30 bg-amber-900/30">
                {imageUrl ? (
                  <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
                ) : (
                  <Gift className="h-8 w-8 text-amber-200" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-stone-100">{title}</p>
                {value ? (
                  <p className="truncate text-sm text-stone-300">{value}</p>
                ) : null}
              </div>
            </motion.div>

            {/* Probability hint */}
            {chance && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28 }}
                className="flex items-center gap-1.5 text-xs text-amber-200/80"
              >
                <Dice6 className="h-3.5 w-3.5 shrink-0" />
                Chance: {chance} – du hattest wirklich Glück!
              </motion.p>
            )}

            {remainingCount > 0 && (
              <p className="text-xs text-amber-200/90">
                +{remainingCount} weiterer Glücks-Reward bereit
              </p>
            )}

            {/* Close button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onComplete?.()}
                className="rounded-xl border border-amber-300/35 bg-gradient-to-r from-amber-700/80 via-amber-500/70 to-amber-700/80 px-4 py-2 text-sm font-semibold text-stone-100 transition hover:brightness-110"
              >
                Weiter
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
