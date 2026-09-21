import { CheckCircle2, Leaf, Share2, X } from "lucide-react";
import GoldGradientCard from "@/components/home/GoldGradientCard";

// Matches the zone circle colors drawn on the map (THEME_MAP_COLORS in MapboxZoneMap.jsx) so the
// corner badge is recognizable as "this zone's theme" at a glance.
const ZONE_BADGE_THEME_STYLE = {
  forest: "border-emerald-300/45 bg-emerald-500/25",
  urban: "border-amber-300/45 bg-amber-500/25",
  water: "border-sky-300/45 bg-sky-500/25",
  meadow: "border-lime-300/45 bg-lime-500/25",
};

/**
 * Bottom-sheet zone detail card shown after tapping a zone (list or map circle).
 * @param {{
 *   zone: object,
 *   isLightUi: boolean,
 *   onClose: () => void,
 *   onOpenScans: () => void,
 *   onShare: () => void,
 * }} props
 */
export default function ZoneDetailSheet({ zone, isLightUi, onClose, onOpenScans, onShare }) {
  if (!zone) return null;

  const targetPlants = Array.isArray(zone.targetPlants) ? zone.targetPlants : [];
  const ThemeIcon = zone.themeIcon;
  const previewBorderGradient = isLightUi
    ? "linear-gradient(to bottom right, #e8d9a8, #c8ac62, rgba(143,107,34,0.7))"
    : "linear-gradient(to bottom right, #f0e5a5, rgba(200,172,98,0.85), #8f6b22)";
  // Same ring-mask technique as the gold border, tinted to each button's own color instead of gold.
  const scansBorderGradient = isLightUi
    ? "linear-gradient(to bottom right, #a7f3d0, #059669, rgba(4,120,87,0.75))"
    : "linear-gradient(to bottom right, #a7f3d0, #10b981, rgba(6,78,59,0.85))";
  const shareBorderGradient = isLightUi
    ? "linear-gradient(to bottom right, #fde68a, #d97706, rgba(146,64,14,0.75))"
    : "linear-gradient(to bottom right, #fde68a, #f59e0b, rgba(120,53,15,0.85))";

  return (
    <div className="pointer-events-auto relative shrink-0 px-3 pb-3 pt-2 transition-[opacity] duration-300 sm:px-4">
      <GoldGradientCard tinted={true} contentClassName="relative overflow-hidden">
      <div
        className="absolute inset-0 rounded-3xl backdrop-blur-lg backdrop-saturate-250"
        style={{ background: "rgba(28, 23, 4, 0.59)", boxShadow: "inset 0 2px 22px rgba(0,0,0,0.55)" }}
      />
      <div className="relative flex items-stretch gap-3 px-4 py-3 sm:px-5">
        {/* Left column: preview image, full row height */}
        <div className="relative w-24 shrink-0 overflow-hidden rounded-2xl sm:w-28">
          {zone.themeImage ? (
            <img src={zone.themeImage} alt={zone.themeLabel} className="h-full w-full object-cover" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${isLightUi ? "bg-stone-200" : "bg-black/40"}`}>
              <Leaf className={isLightUi ? "text-stone-500" : "text-stone-400"} />
            </div>
          )}
          {ThemeIcon && (
            <span className={`absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border ${
              ZONE_BADGE_THEME_STYLE[zone.themeKey] || "border-black/30 bg-black/60"
            } ${zone.themeIconClass || "text-stone-100"}`}>
              <ThemeIcon className="h-3.5 w-3.5" />
            </span>
          )}
          <div
            aria-hidden="true"
            className="gold-gradient-border-mask"
            style={{ background: previewBorderGradient }}
          />
        </div>

        {/* Middle column: title, scan progress, multiplier - stacked in reading order, no forced spacing */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
          <h3 className="truncate text-base font-bold leading-tight">{zone.title}</h3>

          <div className="grid gap-1">
            <div className={`flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isLightUi ? "text-stone-500" : "text-stone-400"
            }`}>
              <span>Scans</span>
              <span className="tabular-nums">{zone.scanLabel}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 5 }).map((_, stepIndex) => {
                const isFilled = stepIndex < zone.scanProgressCount;
                return (
                  <span
                    key={`${zone.key}-detail-scan-step-${stepIndex}`}
                    className={`h-2 rounded-full border ${isFilled
                      ? isLightUi
                        ? "border-emerald-500/35 bg-emerald-500/85"
                        : "border-emerald-300/30 bg-emerald-400/85"
                      : isLightUi
                        ? "border-stone-300/70 bg-stone-200/70"
                        : "border-[#f0e5a5]/12 bg-black/25"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className={`flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] ${
            isLightUi ? "text-stone-500" : "text-stone-400"
          }`}>
            <span>Multiplikator</span>
            <span className={`tabular-nums ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
              x{Number(zone.zoneMultiplier || 1).toFixed(2)}
            </span>
          </div>

          {targetPlants.length > 0 && (
            <div className="flex gap-3">
              {targetPlants.map((targetPlant) => (
                <div key={targetPlant.rewardId} className="flex w-14 shrink-0 flex-col items-center gap-1">
                  <div className={`relative h-10 w-10 overflow-hidden rounded-full border ${
                    isLightUi ? "border-stone-300/70" : "border-[#f0e5a5]/20"
                  }`}>
                    {targetPlant.rewardImageUrl ? (
                      <img
                        src={targetPlant.rewardImageUrl}
                        alt={targetPlant.rewardName || targetPlant.label}
                        className="h-full w-full origin-center scale-[1.5] object-contain translate-y-[15%]"
                      />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center ${
                        isLightUi ? "bg-stone-200 text-stone-500" : "bg-black/40 text-stone-400"
                      }`}>
                        <span className="text-xs font-bold">?</span>
                      </div>
                    )}
                    {targetPlant.unlocked && (
                      <>
                        <div className="absolute inset-0 bg-black/45" />
                        <span className="absolute inset-0 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                      </>
                    )}
                  </div>
                  <span className={`w-full truncate text-center text-[9px] font-medium ${
                    isLightUi ? "text-stone-600" : "text-stone-300"
                  }`}>
                    {targetPlant.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: distance + close aligned with the title row, actions stacked below */}
        <div className="flex w-20 shrink-0 flex-col gap-1.5 py-0.5 sm:w-24">
          <div className="flex items-center justify-end gap-2">
            <span className={`text-right text-[10px] font-semibold uppercase tracking-[0.1em] tabular-nums ${
              isLightUi ? "text-stone-600" : "text-stone-300"
            }`}>
              {zone.distanceLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                isLightUi
                  ? "border-stone-300/70 bg-white/80 text-stone-700 hover:bg-white"
                  : "border-[#f0e5a5]/25 bg-black/40 text-stone-200 hover:bg-black/60"
              }`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onOpenScans}
              className={`relative rounded-xl px-2 py-1.5 text-[11px] font-semibold leading-tight transition-colors ${
                isLightUi
                  ? "bg-white/70 text-emerald-800 hover:bg-white/90"
                  : "bg-black/35 text-emerald-100 hover:bg-black/55"
              }`}
            >
              Scans
              <span aria-hidden="true" className="gold-gradient-border-mask" style={{ background: scansBorderGradient }} />
            </button>
            <button
              type="button"
              onClick={onShare}
              className={`relative flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold leading-tight transition-colors ${
                isLightUi
                  ? "bg-white/70 text-amber-800 hover:bg-white/90"
                  : "bg-black/35 text-amber-100 hover:bg-black/55"
              }`}
            >
              <Share2 className="h-3 w-3" />
              Teilen
              <span aria-hidden="true" className="gold-gradient-border-mask" style={{ background: shareBorderGradient }} />
            </button>
          </div>
        </div>
      </div>
      </GoldGradientCard>
    </div>
  );
}

