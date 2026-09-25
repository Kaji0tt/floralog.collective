import { X } from "lucide-react";

/**
 * Simple explainer overlay for the zone system.
 * @param {{
 *   open: boolean,
 *   isLightUi: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function ZoneInfoDialog({ open, isLightUi, onClose }) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[1450] flex items-end justify-center bg-black/50 px-4 pb-4">
      <div
        className={`flex h-[min(70dvh,32rem)] max-h-[calc(100%-1rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border p-5 ${
          isLightUi
            ? "border-[#c8ac62]/50 bg-white/95 text-stone-800"
            : "border-[#f0e5a5]/25 bg-[#0c0e11]/95 text-stone-100"
        }`}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 text-sm leading-relaxed">
          <p>
            Anzahl <em>(Energie)</em>, Größe <em>(Datenqualität)</em> und verfügbare Re-Rolls <em>(Pflege)</em> errechnen sich aus dem <strong>Zustand deines Florabots</strong>, den du jederzeit über das Overlay, das du mit einem Klick auf deinen Florabot in Home öffnest, einsehen kannst.
          </p>

          <div className={`border-t pt-3 ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/15"}`}>
            <p className={`text-sm font-medium leading-relaxed ${
              isLightUi ? "text-emerald-700" : "text-lime-300"
            }`}>
              Jede Zone hat eigene Zielpflanzen, die du scannen kannst, um Anpassungen für deinen Florabot freizuschalten. Tippe eine Zone an und prüfe ihre Zielpflanzen. Jage ein Accessoire, das dir gefällt!
            </p>
          </div>

          <div className={`border-t pt-3 ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/15"}`}>
            <h4 className="font-semibold">Knospen</h4>
            <p className={isLightUi ? "text-stone-700" : "text-stone-300"}>
              Beim Abschließen einer Geozone erhältst du Knospen mit zufälligen Belohnungen. Zusätzlich werden dir zufällig 1 bis 3 Areas gutgeschrieben, die jeweils einen Samen bringen.
            </p>
          </div>

          <div className={`border-t pt-3 ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/15"}`}>
            <h4 className="font-semibold">Zonen teilen</h4>
            <p className={isLightUi ? "text-stone-700" : "text-stone-300"}>
              Teile Zonen mit Freunden: Nach erfolgreichem Abschluss erhaltet ihr garantiert 3 Samen oder Zugriff auf besondere Belohnungen in den Knospen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
