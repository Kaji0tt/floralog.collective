import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Sparkles, Sprout } from "lucide-react";

const THEME_LABELS = {
  forest: "Wald-Zone",
  water: "Wasser-Zone",
  meadow: "Wiesen-Zone",
  urban: "Stadt-Zone",
  beach: "Strand-Zone",
  wetlands: "Feuchtgebiet",
};

export default function ZoneLootboxNotification({ reward, onComplete }) {
  const [isOpening, setIsOpening] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (!reward) return undefined;

    const timeoutId = window.setTimeout(() => {
      setIsRevealed(true);
    }, 9000);

    return () => window.clearTimeout(timeoutId);
  }, [reward]);

  if (!reward) return null;

  const isDuplicate = reward.rewardStatus === "duplicate_compensated";
  const duplicateSeeds = Number(reward.duplicateSeedValue ?? 0);
  const currencyText = (reward.currencies || [])
    .map((currency) => `${currency.amount} ${currency.currencyCode === "seeds_progress" ? "Seeds" : currency.currencyCode === "sparks" ? "Funken" : "Bernstein"}`)
    .join(" + ");
  const themeLabel = THEME_LABELS[reward.zoneTheme] || "Geo-Zone";
  const title = isDuplicate ? "Doppelter Fund" : reward.display_name || reward.name || "Entdecker-Knospe";
  const value = isDuplicate
    ? `${duplicateSeeds} Samen als Kompensation`
    : [reward.value, currencyText].filter(Boolean).join(" + ") || "Neue Belohnung freigeschaltet";

  const handleOpen = () => {
    if (isRevealed) {
      onComplete?.();
      return;
    }

    setIsOpening(true);
    window.setTimeout(() => setIsRevealed(true), 850);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[135] flex items-center justify-center px-4"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="absolute inset-0 bg-[#07120d]/90 backdrop-blur-md" />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-emerald-200/30 bg-[#10261b]/95 p-6 text-stone-100 shadow-[0_24px_100px_rgba(0,0,0,0.7)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(163,230,53,0.25),transparent_52%),linear-gradient(160deg,rgba(16,185,129,0.2),transparent_58%)]" />

          <div className="relative z-10 space-y-5 text-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-200/80">{themeLabel} abgeschlossen</p>
              <h3 className="mt-2 text-2xl font-bold text-stone-50">{isRevealed ? "Deine Belohnung" : "Eine Entdecker-Knospe wartet"}</h3>
            </div>

            <div className="relative flex min-h-52 items-center justify-center">
              <AnimatePresence mode="wait">
                {!isRevealed ? (
                  <motion.button
                    key="bud"
                    type="button"
                    onClick={handleOpen}
                    aria-label="Knospe öffnen"
                    initial={{ scale: 0.74, opacity: 0, y: 12 }}
                    animate={{
                      scale: isOpening ? [1, 1.1, 0.96, 1.14, 1] : [1, 1.04, 1],
                      opacity: 1,
                      y: 0,
                      rotate: isOpening ? [0, -7, 5, -4, 0] : [0, 3, -3, 2, 0],
                    }}
                    transition={{
                      duration: isOpening ? 0.95 : 2.4,
                      repeat: isOpening ? 0 : Infinity,
                      ease: "easeInOut",
                    }}
                    className="group relative flex h-40 w-40 items-center justify-center rounded-[48%_52%_45%_55%/58%_46%_54%_42%] border border-lime-200/60 bg-[radial-gradient(circle_at_30%_25%,rgba(254,249,195,0.5),transparent_24%),linear-gradient(135deg,#d9f99d_0%,#4ade80_28%,#166534_64%,#052e16_100%)] text-emerald-950 shadow-[0_0_80px_rgba(74,222,128,0.28)]"
                  >
                    <motion.span
                      className="absolute inset-2 rounded-[48%_52%_45%_55%/58%_46%_54%_42%] border border-white/35"
                      animate={isOpening ? { opacity: [1, 1, 0.8, 1] } : { opacity: 1 }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    />
                    <motion.div
                      animate={isOpening ? { scale: [1, 1.15, 0.86, 1.08, 1] } : { scale: [1, 1.04, 1] }}
                      transition={{ duration: 0.9, ease: "easeInOut" }}
                      className="relative z-10"
                    >
                      <Sprout className="h-16 w-16 transition-transform duration-300 group-hover:scale-110" />
                    </motion.div>
                    <motion.span
                      className="absolute -right-4 top-3 h-7 w-7 rounded-full bg-emerald-200/80 blur-[2px]"
                      animate={{ rotate: isOpening ? [0, 25, -14, 0] : [0, 12, -12, 0], x: [0, 4, -3, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.span
                      className="absolute -left-5 bottom-7 h-8 w-8 rounded-full bg-lime-300/70 blur-[2px]"
                      animate={{ rotate: isOpening ? [0, -25, 18, 0] : [0, -10, 12, 0], x: [0, -3, 2, 0] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <Sparkles className="absolute -right-3 -top-3 h-8 w-8 text-lime-100" />
                    <Sparkles className="absolute -bottom-4 -left-3 h-6 w-6 text-emerald-100" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="reward"
                    initial={{ opacity: 0, scale: 0.45, y: 18 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", damping: 16, stiffness: 220 }}
                    className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border border-lime-200/60 bg-[radial-gradient(circle_at_50%_30%,rgba(163,230,53,0.3),transparent_30%),linear-gradient(135deg,#052e16,#064e3b,#14532d)] shadow-[0_0_70px_rgba(163,230,53,0.45)]"
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0.2 }}
                      animate={{ scale: [1, 1.08, 1], opacity: 1 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className="absolute inset-3 rounded-full border border-lime-200/25"
                    />
                    {reward.image_url ? (
                      <img src={reward.image_url} alt={title} className="relative z-10 h-full w-full rounded-full object-cover" />
                    ) : isDuplicate ? (
                      <Sprout className="relative z-10 h-16 w-16 text-lime-200" />
                    ) : (
                      <Gift className="relative z-10 h-16 w-16 text-lime-200" />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              {isRevealed ? (
                <motion.div key="details" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                  <p className="text-lg font-semibold text-stone-50">{title}</p>
                  <p className="text-sm text-lime-100/85">{value}</p>
                </motion.div>
              ) : (
                <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-emerald-100/80">
                  Tippe auf die Knospe, um sie zu öffnen
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={handleOpen}
              className="w-full rounded-xl border border-lime-200/35 bg-emerald-700/80 px-4 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-emerald-600"
            >
              {isRevealed ? "Weiter" : "Knospe öffnen"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
