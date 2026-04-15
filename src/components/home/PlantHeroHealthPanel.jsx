import React from "react";
import { motion } from "framer-motion";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import { useUiTheme } from "@/lib/UiThemeContext";

const HEALTH_TOOLTIP_TEXT = {
  energy:
    "Energie bestimmt Zonenanzahl, taegliche Rerolls, Zonengroesse und den taeglichen Energiegewinn aus gelaufener Scan-Distanz. Der taegliche Decay basiert auf der Gesamtgesundheit vor Decay (floor(Overall/10), mindestens 1).",
  "data-quality":
    "Datenqualitaet steigt nur bei Scans innerhalb einer aktiven Zone.",
  care: "Pflege wirkt direkt als Multiplikator (0.5 bis 1.5) auf die Seed-Belohnung. Decay wird nicht direkt durch Pflege reduziert.",
};

export default function PlantHeroHealthPanel({
  plantHealthState,
  healthStateBonus,
  healthStats,
  isLoading = false,
  wateringCountToday = 0,
  wateringLimitPerDay = 0,
  remainingWatersToday = 0,
  isWateringPending = false,
  isFertilizerPending = false,
  activeDecayEffects = [],
  activeDecayPercent = 0,
  onWaterPlant = () => {},
  onFertilizerSlot = () => {},
  showCareActions = true,
}) {
  const { isLightUi } = useUiTheme();
  const safeHealthStats = Array.isArray(healthStats) ? healthStats : [];

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
            Gesundheitsbonus auf Scan-Events: <strong>{isLoading ? "..." : `+${healthStateBonus}`}</strong>
          </div>
        </div>

        {safeHealthStats.map((stat) => (
          <div key={stat.id} className="space-y-1">
            <div
              className={`flex items-center justify-between text-[11px] md:text-xs ${
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
            <button
              type="button"
              onClick={onWaterPlant}
              disabled={isLoading || isWateringPending || remainingWatersToday <= 0}
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
                {isLoading ? "..." : `${wateringCountToday}/${wateringLimitPerDay}`}
              </span>
            </button>

            <button
              type="button"
              onClick={onFertilizerSlot}
              disabled={isLoading || isFertilizerPending}
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
                {isLoading ? "..." : `${activeDecayEffects.length} | ${Math.round(activeDecayPercent * 100)}%`}
              </span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
