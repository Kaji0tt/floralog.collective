import { useEffect } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import { useUiTheme } from "@/lib/UiThemeContext";
import InventorySlotPickerPopover from "@/components/robotPlant/InventorySlotPickerPopover";

const HEALTH_TOOLTIP_TEXT = {
  energy:
    "Energie bestimmt die Zonengroesse und den taeglichen Energiegewinn aus gelaufener Scan-Distanz. Niedrige Werte holen schneller auf: unter 50% gibt es 3x Zuwachs, unter 75% 2x, ab 75% 1x. Der taegliche Decay basiert auf der Gesamtgesundheit vor Decay (floor(Overall/10), mindestens 1).",
  "data-quality":
    "Datenqualitaet bestimmt die Anzahl der taeglichen Zonen (mindestens 1, maximal 8) und steigt nur bei Scans innerhalb einer aktiven Zone. Niedrige Werte holen schneller auf: unter 50% gibt es 3x Zuwachs, unter 75% 2x, ab 75% 1x. Ausserhalb aktiver Zonen gibt es +0.",
  care: "Pflege wirkt direkt als Multiplikator (1.0 bis 2.0) auf die Seed-Belohnung und bestimmt die taeglichen Zone-Rerolls (0/1/2/4 bei >=80/>=90/>=100). Niedrige Werte holen schneller auf: unter 50% gibt es 3x Zuwachs, unter 75% 2x, ab 75% 1x. Likes geben weiterhin zusaetzlich bis zu +1 (max. 5x pro Tag).",
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
      className="absolute inset-0 px-0 pt-[5.5rem] md:pt-[5.8rem] flex flex-col justify-start"
    >
      <div
        className={`w-full rounded-2xl border px-3 py-3 space-y-2.5 ${
          isLightUi
            ? "border-[#c8ac62]/45 bg-white/36 text-stone-700"
            : "border-[#f0e5a5]/35 bg-black/28 text-stone-100"
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

            <InventorySlotPickerPopover
              items={fertilizerInventoryItems}
              activeItemId={activeFertilizerItemId}
              disabled={isLoading || isFertilizerPending}
              isPending={isFertilizerPending}
              isLoading={isFertilizerInventoryLoading}
              isLightUi={isLightUi}
              emptyText="Keine Dünger vorhanden."
              emptyActionLabel="Zum Shop ->"
              onUseItem={onUseFertilizerItem}
              onOpenShop={onOpenFertilizerShop}
            >
              <button
                type="button"
                className={`h-14 rounded-xl border flex flex-col items-center justify-center disabled:opacity-60 ${
                  isLightUi
                    ? "border-[#c8ac62]/55 bg-white/60 text-stone-800"
                    : "border-[#f0e5a5]/45 bg-black/40 text-stone-100"
                }`}
              >
                <span className="text-[11px] md:text-xs font-semibold leading-none">
                  Dünger
                </span>
                <span className="text-[10px] md:text-[11px] mt-1 leading-none opacity-90">
                  {isLoading ? "..." : `${activeFertilizerRemainingDays} | ${Math.round(activeDecayPercent * 100)}%`}
                </span>
              </button>
            </InventorySlotPickerPopover>
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
