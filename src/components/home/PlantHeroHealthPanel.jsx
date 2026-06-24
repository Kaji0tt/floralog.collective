import { useEffect } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import { useUiTheme } from "@/lib/UiThemeContext";

const HEALTH_TOOLTIP_TEXT = {
  de: {
    status:
      "Der Pflanzenstatus ist der Gesamtzustand aus Energie, Datenqualitaet und Pflege. Er beeinflusst, wie stabil und lohnend dein taeglicher Fortschritt ist.",
    watering:
      "Giessen erhoeht Pflege. Tippe auf den Giessen-Button, solange taegliche Versuche verfuegbar sind. Mehr Pflege verbessert Multiplikatoren und Belohnungen.",
    stat: {
      energy:
        "Energie bekommst du vor allem durch gelaufene Scan-Distanz. Mehr Energie vergroessert deine Zone und verbessert den taeglichen Energiegewinn.",
      "data-quality":
        "Datenqualitaet bekommst du durch Scans innerhalb aktiver Zonen. Mehr Datenqualitaet erhoeht die Anzahl deiner taeglichen Zonen.",
      care:
        "Pflege bekommst du durch Giessen und zusaetzliche Interaktionen. Mehr Pflege verbessert Belohnungs-Multiplikatoren und taegliche Zone-Rerolls.",
    },
  },
  en: {
    status:
      "Plant status is your overall state from Energy, Data Quality, and Care. It affects how stable and rewarding your daily progress is.",
    watering:
      "Watering increases Care. Tap the watering button while daily attempts are available. More Care improves multipliers and rewards.",
    stat: {
      energy:
        "You gain Energy mainly from scanned walking distance. More Energy expands your zone and improves daily energy gain.",
      "data-quality":
        "You gain Data Quality by scanning within active zones. Higher Data Quality increases your daily zone count.",
      care:
        "You gain Care through watering and additional interactions. Higher Care improves reward multipliers and daily zone rerolls.",
    },
  },
};

const normalizeLanguageCode = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace("_", "-");
};

const resolveTooltipLanguage = (...values) => {
  for (const rawValue of values) {
    const language = normalizeLanguageCode(rawValue);
    if (!language) continue;
    if (language.startsWith("en")) return "en";
    if (language.startsWith("de")) return "de";
  }
  return "de";
};

export default function PlantHeroHealthPanel({
  contextBubbleMessage = null,
  contextBubbleProfile = null,
  onContextBubbleDismiss = () => {},
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
  const tooltipLanguage = resolveTooltipLanguage(
    contextBubbleProfile?.app_language,
    contextBubbleProfile?.preferred_language,
    contextBubbleProfile?.language,
    contextBubbleProfile?.locale,
    typeof navigator !== "undefined" ? navigator.language : ""
  );
  const tooltipText = HEALTH_TOOLTIP_TEXT[tooltipLanguage] || HEALTH_TOOLTIP_TEXT.de;
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
      className="relative w-full h-full px-0 flex flex-col justify-start pointer-events-none"
    >
      <div
        className={(() => {
          const base = "w-full rounded-2xl px-3 py-3 space-y-2.5 max-h-[calc(100vh-7rem)] overflow-y-auto hide-scrollbar pointer-events-auto z-[15]";
          if (contextBubbleMessage) {
            // When showing the centered context bubble, avoid the large translucent panel
            return `${base} bg-transparent border-transparent text-stone-100`;
          }
          return `${base} rounded-2xl border backdrop-blur-md ${isLightUi ? "border-[#c8ac62]/45 bg-white/48 text-stone-700" : "border-[#f0e5a5]/35 bg-black/38 text-stone-100"}`;
        })()}
      >
        {/* If a context bubble message is provided, render that instead of the health content */}
        {contextBubbleMessage ? (
          <div className="h-full" />
        ) : (
          <>
            <div className="text-[11px] md:text-xs">
              <LockedTooltip
                contentClassName={isLightUi ? "" : "text-white/90"}
                content={<span className="text-xs leading-relaxed">{tooltipText.status}</span>}
              >
                <button
                  type="button"
                  className={`font-semibold uppercase tracking-wide ${
                    isLightUi ? "text-stone-800" : "text-stone-50"
                  }`}
                  aria-label="Pflanzenstatus Info"
                >
                  {plantHealthState.label}
                </button>
              </LockedTooltip>
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
                    {tooltipText.stat[stat.id] || tooltipText.status}
                  </span>
                }
              >
                <button
                  type="button"
                  className="font-semibold uppercase tracking-wide"
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
            <LockedTooltip
              contentClassName={isLightUi ? "" : "text-white/90"}
              content={<span className="text-xs leading-relaxed">{tooltipText.watering}</span>}
            >
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
            </LockedTooltip>
          </div>
        )}

        {!!careActionMessage && (
          <div className={`text-[10px] md:text-[11px] ${isLightUi ? "text-stone-700/90" : "text-stone-200/90"}`}>
            {careActionMessage}
          </div>
        )}
        </>)
      }
      </div>
    </motion.div>
  );
}
