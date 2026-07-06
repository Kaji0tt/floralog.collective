import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import SpeciesInfoCard from "@/components/collection/SpeciesInfoCard";

/**
 * Full-screen overlay shown when a player's pin or zone on the map is tapped.
 * Supports multiple players with a switching row (zone owner in primary slot,
 * others to the left and right).
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   scannerDisplayName?: string,
 *   scannerLogoAssets?: object | null,
 *   discoveries?: Array<object>,
 *   players?: Array<{ scannerDisplayName: string, scannerLogoAssets: object | null, scannerAuthId?: string, discoveries: Array<object> }> | null,
 *   isLightUi?: boolean,
 * }} props
 */
export default function MapPinDetailOverlay({
  open,
  onClose,
  scannerDisplayName = "Unbekannt",
  scannerLogoAssets = null,
  discoveries = [],
  players = null,
  isLightUi = false,
}) {
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);

  // Normalise: if players array not provided, build single-player from legacy props
  const resolvedPlayers =
    players && players.length > 0
      ? players
      : [{ scannerDisplayName, scannerLogoAssets, discoveries }];

  // Reset active index whenever a new players list arrives (new zone / pin selected)
  useEffect(() => {
    setActivePlayerIdx(0);
  }, [players]);

  const safeIdx = Math.min(activePlayerIdx, resolvedPlayers.length - 1);
  const activePlayer = resolvedPlayers[safeIdx];
  const hasMultiplePlayers = resolvedPlayers.length > 1;

  if (!open) return null;

  const handlePrev = () => setActivePlayerIdx((i) => Math.max(0, i - 1));
  const handleNext = () =>
    setActivePlayerIdx((i) => Math.min(resolvedPlayers.length - 1, i + 1));

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

            {/* ── Multi-player switcher row ── */}
            {hasMultiplePlayers && (
              <div className="flex items-center justify-center gap-1 mb-2">
                {/* Prev button */}
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={safeIdx === 0}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors disabled:opacity-25 flex-shrink-0 ${
                    isLightUi
                      ? "border-stone-300/70 bg-white/80 text-stone-600"
                      : "border-[#f0e5a5]/30 bg-black/40 text-stone-300"
                  }`}
                  aria-label="Vorheriger Spieler"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Player avatar row */}
                <div className="flex items-end justify-center gap-2 flex-1 overflow-x-auto px-1 py-1">
                  {resolvedPlayers.map((player, idx) => {
                    const isActive = idx === safeIdx;
                    return (
                      <button
                        key={player.scannerAuthId || idx}
                        type="button"
                        onClick={() => setActivePlayerIdx(idx)}
                        aria-pressed={isActive}
                        aria-label={player.scannerDisplayName}
                        className={`flex flex-col items-center flex-shrink-0 transition-all duration-200 focus:outline-none ${
                          isActive ? "opacity-100" : "opacity-40 hover:opacity-65"
                        }`}
                      >
                        <div
                          className={`transition-all duration-200 ${
                            isActive ? "w-16 h-16" : "w-10 h-10"
                          }`}
                        >
                          <CustomLogoAvatar
                            logoAssets={player.scannerLogoAssets}
                            noClip
                            className="w-full h-full"
                            fallbackText={
                              player.scannerDisplayName?.charAt(0)?.toUpperCase() || "?"
                            }
                            fallbackClassName={`font-bold text-white ${
                              isActive ? "text-xl" : "text-sm"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Next button */}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={safeIdx === resolvedPlayers.length - 1}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors disabled:opacity-25 flex-shrink-0 ${
                    isLightUi
                      ? "border-stone-300/70 bg-white/80 text-stone-600"
                      : "border-[#f0e5a5]/30 bg-black/40 text-stone-300"
                  }`}
                  aria-label="Nächster Spieler"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ── Active player header: logo (no frame, no clip) + name ── */}
            <div className="flex flex-col items-center gap-3 mb-6">
              {/* Logo only shown as large image for single-player mode;
                  multi-player already shows it in the switcher row above */}
              {!hasMultiplePlayers && (
                <div className="w-24 h-24">
                  <CustomLogoAvatar
                    logoAssets={activePlayer.scannerLogoAssets}
                    noClip
                    className="w-full h-full"
                    fallbackText={
                      activePlayer.scannerDisplayName?.charAt(0)?.toUpperCase() || "?"
                    }
                    fallbackClassName="text-3xl font-bold text-white"
                  />
                </div>
              )}

              <h2
                className={`text-lg font-bold text-center ${
                  isLightUi ? "text-stone-900" : "text-stone-100"
                }`}
              >
                {activePlayer.scannerDisplayName}
              </h2>
              <p className={`text-xs ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>
                {activePlayer.discoveries.length === 1
                  ? "1 Scan an diesem Ort"
                  : `${activePlayer.discoveries.length} Scans an diesem Ort`}
              </p>
            </div>

            {/* ── Species / discovery cards ── */}
            {activePlayer.discoveries.length === 0 ? (
              <div
                className={`rounded-2xl border p-5 text-center text-sm ${
                  isLightUi
                    ? "border-stone-200 bg-stone-50 text-stone-500"
                    : "border-[#f0e5a5]/20 bg-black/25 text-stone-400"
                }`}
              >
                Noch keine Scans an diesem Ort sichtbar.
              </div>
            ) : (
              <div className="space-y-4">
                {activePlayer.discoveries.map((disc) => (
                  <div key={disc.discoveryId || disc.plantId || Math.random()}>
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
                      <div
                        className={`rounded-2xl border p-4 flex items-center gap-3 ${
                          isLightUi
                            ? "border-stone-200 bg-stone-50"
                            : "border-[#f0e5a5]/20 bg-black/30"
                        }`}
                      >
                        {disc.imageUrl ? (
                          <img
                            src={disc.imageUrl}
                            alt={disc.plantName || "Pflanze"}
                            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isLightUi ? "bg-stone-200" : "bg-stone-800"
                            }`}
                          >
                            <Leaf
                              className={`w-6 h-6 ${
                                isLightUi ? "text-stone-400" : "text-stone-500"
                              }`}
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3
                            className={`font-semibold text-sm truncate ${
                              isLightUi ? "text-stone-800" : "text-stone-100"
                            }`}
                          >
                            {disc.plantName || "Unbekannte Pflanze"}
                          </h3>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
