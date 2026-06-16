import { useEffect } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import { useUiTheme } from "@/lib/UiThemeContext";

const HEALTH_TOOLTIP_TEXT = {
  energy:
    "Die Energie deines Florabots lädt sich auf, wenn du mit ihm spazieren gehst. Je mehr Strecke zwischen den Scans ist, desto mehr Energie lädt sich auf (max. 15 / Tag). Höhere Energie vergrößert die größe der Zonen, die dein Florabot aufspüren kann.",
  "data-quality":
    "Die Datenqualität steigt, wenn innerhalb einer Zone gescannt wird. Mit jedem weiteren Scan in der gleichen Zone, sinkt der Zuwachs. Je höher die Datenqualität, desto mehr Zonen kann der Florabot aufspüren. Ab 80 gibt es eine zusätzliche Bonuszone, ab 90 sogar 3 Bonuszonen. Du kannst somit bis zu 12 aktive Zonen pro Tag erreichen.  ",
  care: "Der Pflegewert zeigt, wie regelmaessig du im Floralog aktiv bist. Durch regelmaessige Pflege kannst du den Pflegewert steigern. Ausserdem bringt der erste Scan am Tag +3 auf den Pflegewert. Je hoeher der Pflegewert, desto mehr Rerolls fuer die Tageszonen hast du zur Verfuegung. Ab 80 hast du insgesamt 2 Rerolls, ab 90 insgesamt 3. Darunter hast du 1 Reroll pro Tag.",
};

export default function PlantHeroHealthPanel({
  plantHealthState,
  healthStateBonus,
  healthStats,
  isLoading = false,
  isDailyCareLoading = false,
  wateringCountToday = 0,
  wateringLimitPerDay = 0,
  remainingWatersToday = 0,
  isWateringPending = false,
  isFertilizerPending = false,
  isFertilizerInventoryLoading = false,
  fertilizerInventoryItems = [],
  activeFertilizerItemId = null,
  activeFertilizerRemainingDays = 0,
  activeDecayEffects: _activeDecayEffects = [],
  activeDecayPercent = 0,
  careActionMessage = null,
  careGainFeedback = null,
  onWaterPlant = () => {},
  onUseFertilizerItem = () => {},
  onOpenFertilizerShop = () => {},
  showCareActions = true,
}) {
  const { isLightUi } = useUiTheme();
  const safeHealthStats = Array.isArray(healthStats) ? healthStats : [];
  const wateringPulseControls = useAnimationControls();

  useEffect(() => {
    if (!careGainFeedback?.id || Number(careGainFeedback?.delta || 0) <= 0) {
      return;
    }

    wateringPulseControls.start({
      scale: [1, 1.06, 0.98, 1],
      transition: { duration: 0.34, ease: "easeOut" },
    });
  }, [careGainFeedback?.id, careGainFeedback?.delta, wateringPulseControls]);

  return (
    <motion.div
      key="hero-stats"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="absolute inset-0 px-0 pt-[5.5rem] md:pt-[5.8rem] flex flex-col justify-start pointer-events-none"
    >
      <div
        className={`w-full rounded-2xl border px-3 py-3 space-y-2.5 max-h-[calc(100vh-7rem)] overflow-y-auto backdrop-blur-md pointer-events-auto z-[15] ${
          isLightUi
            ? "border-[#c8ac62]/45 bg-white/48 text-stone-700"
            : "border-[#f0e5a5]/35 bg-black/38 text-stone-100"
        }`}
      >
        <div className="text-[11px] md:text-xs">
          <div
            className={`font-semibold uppercase tracking-wide ${
              isLightUi ? "text-stone-800" : "text-stone-50"
            }`}
          >
            {plantHealthState.label}
          </div>
          <div className={isLightUi ? "text-stone-700/85" : "text-stone-200/80"}>
            Scan-Bonus: <strong>{isLoading ? "..." : `+${healthStateBonus}`}</strong>
          </div>
        </div>

        {safeHealthStats.map((stat) => (
          <div key={stat.id} className="space-y-1">
            <div
              className={`relative flex items-center justify-between text-[11px] md:text-xs ${
                isLightUi ? "text-stone-700" : "text-stone-100/90"
              }`}
            >
              <LockedTooltip
                  contentClassName={isLightUi ? "" : "text-white/90"}
                  content={
                  <span className="text-xs leading-relaxed">
                    {HEALTH_TOOLTIP_TEXT[stat.id] || "Wert der Robopflanze"}
                  </span>
                }
              >
                <button
                  type="button"
                  className="font-semibold uppercase tracking-wide underline decoration-dotted underline-offset-2"
                  aria-label={`${stat.label} Info`}
                >
                  {stat.label}
                </button>
              </LockedTooltip>
              <span className="font-bold">{isLoading ? "..." : `${stat.value}%`}</span>

              <AnimatePresence>
                {stat.id === "care" && Number(careGainFeedback?.delta || 0) > 0 && (
                  <motion.span
                    key={careGainFeedback?.id}
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: -10, scale: 1 }}
                    exit={{ opacity: 0, y: -24, scale: 1.03 }}
                    transition={{ duration: 0.85, ease: "easeOut" }}
                    className="absolute right-0 -top-5 text-xs md:text-sm font-bold pointer-events-none"
                    style={{
                      color: stat.color,
                      textShadow: "0 0 12px rgba(245,158,11,0.45)",
                    }}
                  >
                    +{careGainFeedback.delta}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-black/35 border border-black/25">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${isLoading ? 35 : stat.value}%`,
                  background: isLoading
                    ? "linear-gradient(90deg, #6b7280 0%, rgba(255,255,255,0.78) 100%)"
                    : `linear-gradient(90deg, ${stat.color} 0%, rgba(255,255,255,0.78) 100%)`,
                }}
              />
            </div>
          </div>
        ))}

        {showCareActions && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <motion.button
              type="button"
              onClick={onWaterPlant}
              disabled={isLoading || isDailyCareLoading || isWateringPending || remainingWatersToday <= 0}
              animate={wateringPulseControls}
              className={`h-14 rounded-xl border flex flex-col items-center justify-center disabled:opacity-60 ${
                isLightUi
                  ? "border-[#c8ac62]/55 bg-white/60 text-stone-800"
                  : "border-[#f0e5a5]/45 bg-black/40 text-stone-100"
              }`}
            >
              <span className="text-[11px] md:text-xs font-semibold leading-none">
                Gießen
              </span>
              <span className="text-[10px] md:text-[11px] mt-1 leading-none opacity-90">
                {(isLoading || isDailyCareLoading) ? "..." : `${wateringCountToday}/${wateringLimitPerDay}`}
              </span>
            </motion.button>

            <LockedTooltip
              contentClassName={isLightUi ? "" : "text-white/90"}
              content={
                <span className="text-xs leading-relaxed">
                  Die Partner-Funktion kommt mit einem spaeteren Update.
                </span>
              }
            >
              <button
                type="button"
                className={`h-14 rounded-xl border flex flex-col items-center justify-center ${
                  isLightUi
                    ? "border-[#c8ac62]/55 bg-white/60 text-stone-800"
                    : "border-[#f0e5a5]/45 bg-black/40 text-stone-100"
                }`}
                aria-label="Partner-Funktion Hinweis"
              >
                <span className="text-[11px] md:text-xs font-semibold leading-none">
                  Partner
                </span>
                <span className="text-[10px] md:text-[11px] mt-1 leading-none opacity-90">
                  Bald
                </span>
              </button>
            </LockedTooltip>
          </div>
        )}

        {!!careActionMessage && (
          <div className={`text-[10px] md:text-[11px] ${isLightUi ? "text-stone-700/90" : "text-stone-200/90"}`}>
            {careActionMessage}
          </div>
        )}
      </div>
    </motion.div>
  );
}
