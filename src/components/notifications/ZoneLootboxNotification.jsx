import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Gem, Gift, Sparkles, Sprout, Zap } from "lucide-react";

const ZONE_THEMES = {
  forest: { label: "Wald-Zone", color: "#10b981", light: "#a7f3d0", dark: "#064e3b" },
  water: { label: "Wasser-Zone", color: "#0ea5e9", light: "#bae6fd", dark: "#0c4a6e" },
  meadow: { label: "Wiesen-Zone", color: "#84cc16", light: "#d9f99d", dark: "#365314" },
  urban: { label: "Stadt-Zone", color: "#f59e0b", light: "#fde68a", dark: "#78350f" },
  beach: { label: "Strand-Zone", color: "#fbbf24", light: "#fef3c7", dark: "#92400e" },
  wetlands: { label: "Feuchtgebiet", color: "#14b8a6", light: "#99f6e4", dark: "#134e4a" },
};

export default function ZoneLootboxNotification({ reward, onComplete }) {
  const [phase, setPhase] = useState("sealed");
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setPhase("sealed");
  }, [reward]);

  useEffect(() => {
    if (!reward || phase === "revealed") return undefined;
    const timeoutId = window.setTimeout(
      () => setPhase(phase === "sealed" ? "opening" : "revealed"),
      phase === "sealed" ? 9000 : reducedMotion ? 200 : 1150,
    );
    return () => window.clearTimeout(timeoutId);
  }, [reward, phase, reducedMotion]);

  if (!reward) return null;

  const isOpening = phase === "opening";
  const isRevealed = phase === "revealed";
  const isDuplicate = reward.rewardStatus === "duplicate_compensated";
  const theme = ZONE_THEMES[reward.zoneTheme] || { ...ZONE_THEMES.meadow, label: "Geo-Zone" };
  const hasSpecialReward = Boolean(reward.type && !["lootbox", "currency", "seeds", "seeds_progress", "sparks", "amber"].includes(reward.type));
  const gold = "#c8ac62";
  const accent = hasSpecialReward ? gold : theme.light;
  const title = isDuplicate ? "Doppelter Fund" : reward.display_name || reward.name || "Entdecker-Knospe";
  const currencies = isDuplicate
    ? [{ currencyCode: "seeds_progress", amount: Number(reward.duplicateSeedValue ?? 0) }]
    : reward.currencies || [];
  const showReward = isDuplicate || hasSpecialReward || Boolean(reward.value) || currencies.length === 0;

  const handleOpen = () => {
    if (isRevealed) onComplete?.();
    else if (!isOpening) setPhase("opening");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-lootbox-title"
        className="fixed inset-0 z-[135] flex items-center justify-center px-4 text-stone-100"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 50% 45%, ${theme.color}80, ${theme.dark}70 45%, transparent 85%)` }}
          animate={{ opacity: isOpening && !reducedMotion ? [0.4, 0.85, 0.5, 1] : isRevealed ? 1 : 0.3 }}
          transition={{ duration: isOpening ? 1.15 : 0.7 }}
        />

        <motion.div
          initial={{ opacity: 0, y: reducedMotion ? 0 : 30, scale: reducedMotion ? 1 : 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="relative max-h-[calc(100dvh-4rem)] w-full max-w-md overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border p-5 text-center sm:p-6"
          style={{ borderColor: `${accent}66`, background: `linear-gradient(155deg, ${theme.dark}e6, #101513f5 75%)`, boxShadow: `0 24px 100px #000b, 0 0 60px ${theme.color}25` }}
        >
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ background: `radial-gradient(ellipse at 50% 35%, ${theme.color}80, transparent 75%)` }}
            animate={{ opacity: isRevealed ? 0.85 : isOpening ? 0.7 : 0.2 }}
            transition={{ duration: 0.6 }}
          />
          {hasSpecialReward && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-3xl"
              style={{ background: "linear-gradient(135deg, #f0e5a540, transparent 40%, #c8ac6235 75%, #8f6b2260)", boxShadow: "inset 0 0 35px #c8ac6225" }}
              animate={{ opacity: isOpening && !reducedMotion ? [0.1, 0.8, 0.3, 1] : isRevealed ? 1 : 0 }}
              transition={{ duration: 1.1 }}
            />
          )}

          <div className="relative z-10 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: theme.light }}>{theme.label} abgeschlossen</p>
              <h3 id="zone-lootbox-title" className="mt-2 break-words text-2xl font-bold text-stone-50">
                {isRevealed ? "Deine Belohnung" : isOpening ? "Die Knospe erwacht" : reward.lootboxName || "Entdecker-Knospe"}
              </h3>
            </div>

            <div className="relative flex min-h-60 items-center justify-center">
              {isRevealed && !reducedMotion && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                  <motion.span
                    className="absolute h-40 w-40 rounded-full border-2"
                    style={{ borderColor: accent, boxShadow: `0 0 35px ${theme.color}80` }}
                    initial={{ scale: 0.5, opacity: 1 }}
                    animate={{ scale: 2.3, opacity: 0 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                  />
                  {Array.from({ length: 12 }, (_, index) => {
                    const angle = (index / 12) * Math.PI * 2;
                    return (
                      <motion.span
                        key={index}
                        className="absolute"
                        style={{ color: hasSpecialReward && index % 2 === 0 ? gold : theme.light }}
                        initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
                        animate={{ x: Math.cos(angle) * 130, y: Math.sin(angle) * 110, scale: [0.3, 1.2, 0.5], opacity: [1, 1, 0], rotate: 90 }}
                        transition={{ duration: 0.85, ease: "easeOut" }}
                      >
                        <Sparkles className="h-5 w-5" />
                      </motion.span>
                    );
                  })}
                </div>
              )}
              <AnimatePresence mode="wait">
                {!isRevealed ? (
                  <motion.button
                    key="bud"
                    type="button"
                    onClick={handleOpen}
                    disabled={isOpening}
                    aria-label="Knospe öffnen"
                    initial={{ scale: reducedMotion ? 1 : 0.74, opacity: 0 }}
                    animate={{
                      scale: reducedMotion ? 1 : isOpening ? [1, 1.08, 0.96, 1.12, 0.9, 1.18] : [1, 1.04, 1],
                      rotate: reducedMotion ? 0 : isOpening ? [0, -5, 5, -9, 9, -12, 12, 0] : [0, 2, -2, 0],
                      x: reducedMotion || !isOpening ? 0 : [0, -2, 2, -4, 4, -6, 6, 0],
                      opacity: 1,
                    }}
                    exit={{ scale: reducedMotion ? 1 : 1.6, opacity: 0, filter: reducedMotion ? "none" : "brightness(2)" }}
                    transition={{ duration: reducedMotion ? 0.15 : isOpening ? 1.15 : 2.8, repeat: isOpening || reducedMotion ? 0 : Infinity, ease: "easeInOut", exit: { duration: 0.18 } }}
                    className="relative flex h-44 w-44 shrink-0 items-center justify-center rounded-[48%_52%_45%_55%/58%_46%_54%_42%] border"
                    style={{ borderColor: theme.light, background: "radial-gradient(circle at 30% 25%, #fef9c380, transparent 30%), linear-gradient(135deg, #d9f99d, #4ade80 28%, #166534 64%, #052e16)", boxShadow: `0 0 ${isOpening ? 95 : 55}px ${theme.color}${isOpening ? "bb" : "70"}` }}
                  >
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-4 rounded-full border"
                      style={{ borderColor: `${accent}80`, boxShadow: `0 0 30px ${theme.color}80, inset 0 0 25px ${theme.color}60` }}
                      animate={{ scale: reducedMotion ? 1 : isOpening ? [1, 1.12, 0.98, 1.22] : [1, 1.06, 1], opacity: isOpening ? [0.5, 1, 0.6, 1] : 0.45 }}
                      transition={{ duration: isOpening ? 1.15 : 2.8, repeat: isOpening || reducedMotion ? 0 : Infinity }}
                    />
                    <span className="absolute inset-2 rounded-[inherit] border border-white/35" />
                    <Sprout className="relative h-20 w-20 text-emerald-950" />
                    <Sparkles className="absolute -right-3 -top-3 h-8 w-8" style={{ color: accent }} />
                  </motion.button>
                ) : (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative w-full space-y-4 py-3"
                    aria-live="polite"
                  >
                    {showReward && (
                      <motion.div
                        initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.45, y: reducedMotion ? 0 : 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", damping: 14, stiffness: 240 }}
                        className="flex flex-col items-center gap-3"
                      >
                        <div
                          className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2"
                          style={{ borderColor: accent, background: `linear-gradient(135deg, ${theme.color}55, ${theme.dark})`, boxShadow: `0 0 45px ${hasSpecialReward ? `${gold}70` : `${theme.color}60`}` }}
                        >
                          {isDuplicate ? <Sprout className="h-16 w-16" style={{ color: theme.light }} /> : reward.image_url ? (
                            <img src={reward.image_url} alt={title} className="h-full w-full object-contain" />
                          ) : <Gift className="h-16 w-16" style={{ color: accent }} />}
                        </div>
                        <p className="w-full break-words text-xl font-bold" style={{ color: hasSpecialReward ? "#f0e5a5" : "#fafaf9" }}>{title}</p>
                        {!isDuplicate && reward.value && <p className="break-words text-base" style={{ color: theme.light }}>{reward.value}</p>}
                      </motion.div>
                    )}
                    <div className="flex flex-wrap justify-center gap-3">
                      {currencies.map((currency, index) => {
                        const { Icon, label } = {
                          seeds_progress: { label: "Samen", Icon: Sprout },
                          sparks: { label: "Funken", Icon: Zap },
                          amber: { label: "Bernstein", Icon: Gem },
                        }[currency.currencyCode] || { Icon: Gem, label: currency.currencyCode };
                        return (
                          <motion.div
                            key={`${currency.currencyCode}-${index}`}
                            initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.5, y: reducedMotion ? 0 : 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: "spring", damping: 13, stiffness: 230, delay: reducedMotion ? 0 : (showReward ? 0.2 : 0) + index * 0.14 }}
                            className="flex min-w-24 max-w-full flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-4"
                            style={{ borderColor: `${theme.light}55`, background: `${theme.dark}b0` }}
                          >
                            <Icon className="mb-1 h-7 w-7" style={{ color: theme.light }} />
                            <span className="max-w-full break-words text-3xl font-bold tabular-nums">{currency.amount}</span>
                            <span className="max-w-full break-words text-sm" style={{ color: theme.light }}>{label}{isDuplicate ? " als Kompensation" : ""}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={handleOpen}
              disabled={isOpening}
              className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:brightness-110 disabled:cursor-wait"
              style={{ borderColor: `${accent}80`, background: `${theme.color}35`, color: theme.light }}
            >
              {isRevealed ? <ArrowRight className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {isRevealed ? "Weiter" : isOpening ? "Öffnet sich …" : "Knospe öffnen"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
