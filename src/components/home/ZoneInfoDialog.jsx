import { Gift, X } from "lucide-react";

/**
 * Simple explainer overlay for the zone system, opened from ZoneDetailSheet's "Mehr Infos".
 * @param {{
 *   open: boolean,
 *   isLightUi: boolean,
 *   targetPlants?: Array<{ rewardId: string, label: string, rewardName: string, rewardImageUrl: string | null }>,
 *   onClose: () => void,
 * }} props
 */
export default function ZoneInfoDialog({ open, isLightUi, targetPlants = [], onClose }) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[1450] flex items-end justify-center bg-black/50 px-4 pb-4">
      <div
        className={`w-full max-w-md rounded-3xl border p-5 ${
          isLightUi
            ? "border-[#c8ac62]/50 bg-white/95 text-stone-800"
            : "border-[#f0e5a5]/25 bg-[#0c0e11]/95 text-stone-100"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">Wie funktionieren Zonen?</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className={`flex h-7 w-7 items-center justify-center rounded-full border ${
              isLightUi
                ? "border-stone-300/70 bg-stone-100 text-stone-700 hover:bg-white"
                : "border-[#f0e5a5]/25 bg-black/40 text-stone-200 hover:bg-black/60"
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3 text-sm leading-relaxed">
        <p>
          Anzahl <em>(Energie)</em>, Größe <em>(Datenqualität)</em> und verfügbare Re-Rolls <em>(Pflege)</em> errechnen sich aus dem <strong>Zustand deines Florabots</strong>, den du jederzeit über das Overlay, das du mit einem Klick auf deinen Florabot in Home öffnest, einsehen kannst.
        </p>

        </div>

        {targetPlants.length > 0 && (
          <div className={`mt-4 border-t pt-3 ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/15"}`}>
            <p className={`mb-3 text-sm font-medium leading-relaxed ${
              isLightUi ? "text-emerald-700" : "text-lime-300"
            }`}>
              Scanne diese Zielpflanzen in dieser Zone, um die zugehörigen Rewards freizuschalten:
            </p>
            <div className="flex gap-4">
              {targetPlants.map((targetPlant) => (
                <div key={targetPlant.rewardId} className="flex w-16 shrink-0 flex-col items-center gap-1">
                  <div className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border ${
                    isLightUi ? "border-stone-300/70 bg-stone-100" : "border-[#f0e5a5]/20 bg-black/40"
                  }`}>
                    {targetPlant.rewardImageUrl ? (
                      <img
                        src={targetPlant.rewardImageUrl}
                        alt={targetPlant.rewardName}
                        className="h-full w-full origin-center scale-[1.5] object-contain translate-y-[15%]"
                      />
                    ) : (
                      <Gift className={isLightUi ? "h-5 w-5 text-stone-500" : "h-5 w-5 text-stone-400"} />
                    )}
                  </div>
                  <span className={`w-full truncate text-center text-[10px] font-medium ${
                    isLightUi ? "text-stone-600" : "text-stone-300"
                  }`}>
                    {targetPlant.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
