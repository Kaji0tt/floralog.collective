import { useEffect } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import { useUiTheme } from "@/lib/UiThemeContext";
import PartnerSelectionPopover from "@/components/home/PartnerSelectionPopover";
import FlorabotLogo from "@/components/florabot/FlorabotLogo";

const HEALTH_TOOLTIP_TEXT = {
  energy:
    "Energie bestimmt die Zonengroesse und den taeglichen Energiegewinn aus gelaufener Scan-Distanz. Niedrige Werte holen schneller auf: unter 50% gibt es 3x Zuwachs, unter 75% 2x, ab 75% 1x. Der taegliche Decay basiert auf der Gesamtgesundheit vor Decay (floor(Overall/10), mindestens 1).",
  "data-quality":
    "Datenqualitaet bestimmt die Anzahl der taeglichen Zonen (mindestens 1, maximal 8) und steigt nur bei Scans innerhalb einer aktiven Zone. Niedrige Werte holen schneller auf: unter 50% gibt es 3x Zuwachs, unter 75% 2x, ab 75% 1x. Ausserhalb aktiver Zonen gibt es +0.",
  care: "Pflege wirkt direkt als Multiplikator (1.0 bis 2.0) auf die Seed-Belohnung und bestimmt die taeglichen Zone-Rerolls (0/1/2/4 bei >=80/>=90/>=100). Niedrige Werte holen schneller auf: unter 50% gibt es 3x Zuwachs, unter 75% 2x, ab 75% 1x. Likes geben weiterhin zusaetzlich bis zu +1 (max. 5x pro Tag).",
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
  currentPartnerLabel = null,
  partnerCandidates = [],
  isPartnerFeatureUnlocked = false,
  isPartnerPending = false,
  careActionMessage = null,
  careGainFeedback = null,
  onWaterPlant = () => {},
  onUseFertilizerItem = () => {},
  onOpenFertilizerShop = () => {},
  onRequestPartner = () => {},
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
      className="relative w-full h-full px-0 flex flex-col justify-start pointer-events-none"
    >
      <div
        className={`w-full rounded-2xl border px-3 py-3 space-y-2.5 max-h-[calc(100vh-7rem)] overflow-y-auto hide-scrollbar backdrop-blur-md pointer-events-auto z-[15] ${
          isLightUi
            ? "border-[#c8ac62]/45 bg-white/48 text-stone-700"
            : "border-[#f0e5a5]/35 bg-black/38 text-stone-100"
        }`}
          >
        {/* If a context bubble message is provided, render that instead of the health content */}
        {contextBubbleMessage ? (
          <>
            <div className="text-sm md:text-base leading-snug">
              <div className={`font-semibold ${isLightUi ? 'text-stone-800' : 'text-stone-50'}`}>
                Florabot
              </div>
              <div className={isLightUi ? 'text-stone-700/90' : 'text-stone-200/85'}>
                {contextBubbleMessage}
              </div>
            </div>

            {/* Centered overlay bubble (visually matches FlorabotContextBubble) */}
            <motion.div
              className="fixed inset-0 z-[190] flex items-center justify-center pointer-events-none px-4"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div
                className={`pointer-events-auto flex items-start gap-3 max-w-[420px] w-full rounded-2xl px-4 py-3 border shadow-xl ${
                  isLightUi ? 'bg-white/92 border-stone-200/70' : 'bg-[#1a1f18]/95 border-white/10'
                }`}
                style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
              >
                <FlorabotLogo profile={contextBubbleProfile} sizeClass="w-12 h-12 shrink-0 mt-0.5" padding="p-[6%]" />
                <p className={`flex-1 text-sm leading-relaxed ${isLightUi ? 'text-stone-700' : 'text-stone-200'}`}>
                  {contextBubbleMessage}
                </p>
                <button
                  type="button"
                  onClick={onContextBubbleDismiss}
                  aria-label="Schließen"
                  className={`shrink-0 mt-0.5 p-1 rounded-full transition-colors ${
                    isLightUi ? 'text-stone-400 hover:text-stone-600 hover:bg-stone-100' : 'text-stone-500 hover:text-stone-300 hover:bg-white/8'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>
                </button>
              </div>
            </motion.div>
          </>
        ) : (
          <>
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

            <PartnerSelectionPopover
              candidates={partnerCandidates}
              currentPartnerLabel={currentPartnerLabel}
              isUnlocked={isPartnerFeatureUnlocked}
              isPending={isPartnerPending}
              isLoading={isLoading}
              isLightUi={isLightUi}
              emptyText={isPartnerFeatureUnlocked ? "Noch keine Partner verfügbar." : "Partner-Funktion gesperrt."}
              emptyActionLabel={isPartnerFeatureUnlocked ? "Werde zuerst mit jemandem befreundet." : ""}
              onRequestPartner={onRequestPartner}
            >
              <button
                type="button"
                disabled={!isPartnerFeatureUnlocked || isPartnerPending}
                className={`h-14 rounded-xl border flex flex-col items-center justify-center disabled:opacity-60 ${
                  isLightUi
                    ? "border-[#c8ac62]/55 bg-white/60 text-stone-800"
                    : "border-[#f0e5a5]/45 bg-black/40 text-stone-100"
                }`}
              >
                <span className="text-[11px] md:text-xs font-semibold leading-none">
                  Partner
                </span>
                <span className="text-[10px] md:text-[11px] mt-1 leading-none opacity-90">
                  {currentPartnerLabel || (isPartnerFeatureUnlocked ? "Wählen" : "Gesperrt")}
                </span>
              </button>
            </PartnerSelectionPopover>
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
