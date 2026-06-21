import React from "react";
import { X, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import SpeciesInfoCard from "@/components/collection/SpeciesInfoCard";

/**
 * Full-screen overlay shown when a player's pin on the map is tapped.
 * Displays the player's custom logo, name, and SpeciesInfoCard(s) for
 * the discovery (or all discoveries if the pin represents a merged zone).
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   scannerDisplayName: string,
 *   scannerLogoAssets: { border?: { imageUrl?: string }, plant?: { imageUrl?: string }, face?: { imageUrl?: string }, borderColor?: string | null } | null,
 *   discoveries: Array<{ discoveryId: string, imageUrl?: string, plantName?: string, plant?: object | null }>,
 *   isLightUi?: boolean,
 * }} props
 */
export default function MapPinDetailOverlay({
  open,
  onClose,
  scannerDisplayName = "Unbekannt",
  scannerLogoAssets = null,
  discoveries = [],
  isLightUi = false,
}) {
  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="map-pin-overlay"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={`absolute inset-0 z-[1400] flex flex-col overflow-hidden rounded-3xl ${
            isLightUi
              ? "bg-white/95 backdrop-blur-xl"
              : "bg-[#0c0e11]/95 backdrop-blur-xl"
          }`}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className={`absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              isLightUi
                ? "border-stone-300/70 bg-white/80 text-stone-700 hover:bg-stone-100"
                : "border-[#f0e5a5]/30 bg-black/50 text-stone-200 hover:bg-black/70"
            }`}
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {/* Player header: logo + name */}
            <div className="flex flex-col items-center gap-3 mb-6">
              <div className={`w-20 h-20 rounded-full overflow-hidden border-2 ${
                isLightUi ? "border-stone-300 bg-stone-100" : "border-[#f0e5a5]/40 bg-black/40"
              }`}>
                <CustomLogoAvatar
                  logoAssets={scannerLogoAssets}
                  className="w-full h-full"
                  fallbackText={scannerDisplayName.charAt(0).toUpperCase()}
                  fallbackClassName="text-2xl font-bold text-white"
                />
              </div>
              <h2 className={`text-lg font-bold text-center ${
                isLightUi ? "text-stone-900" : "text-stone-100"
              }`}>
                {scannerDisplayName}
              </h2>
              <p className={`text-xs ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>
                {discoveries.length === 1
                  ? "1 Scan an diesem Ort"
                  : `${discoveries.length} Scans an diesem Ort`}
              </p>
            </div>

            {/* Species cards */}
            <div className="space-y-4">
              {discoveries.map((disc) => (
                <div key={disc.discoveryId || disc.plantId}>
                  {disc.plant ? (
                    <SpeciesInfoCard
                      plant={disc.plant}
                      imageUrl={disc.imageUrl || undefined}
                      isLightUi={isLightUi}
                      compact
                      showPrimaryImage
                      showScientificMeta
                      showNarrative={false}
                    />
                  ) : (
                    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
                      isLightUi
                        ? "border-stone-200 bg-stone-50"
                        : "border-[#f0e5a5]/20 bg-black/30"
                    }`}>
                      {disc.imageUrl ? (
                        <img
                          src={disc.imageUrl}
                          alt={disc.plantName || "Pflanze"}
                          className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isLightUi ? "bg-stone-200" : "bg-stone-800"
                        }`}>
                          <Leaf className={`w-6 h-6 ${isLightUi ? "text-stone-400" : "text-stone-500"}`} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className={`font-semibold text-sm truncate ${
                          isLightUi ? "text-stone-800" : "text-stone-100"
                        }`}>
                          {disc.plantName || "Unbekannte Pflanze"}
                        </h3>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
