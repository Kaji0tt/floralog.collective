import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import SpeciesInfoCard from "@/components/collection/SpeciesInfoCard";

/**
 * Adaptive overlay shown when a pin or zone on the map is tapped.
 * Single scans render as a docked detail card; stacked selections expand
 * into a fullscreen scrollable view with a switching row.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   scannerDisplayName?: string,
 *   scannerLogoAssets?: object | null,
 *   discoveries?: Array<object>,
 *   players?: Array<{ scannerDisplayName: string, scannerLogoAssets: object | null, scannerAuthId?: string, discoveries: Array<object> }> | null,
 *   currentUserId?: string | null,
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
  currentUserId = null,
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
  const hasStackedDiscoveries = (activePlayer?.discoveries?.length || 0) > 1;
  const isStackedView = hasMultiplePlayers || hasStackedDiscoveries;

  if (!open) return null;

  const handlePrev = () => setActivePlayerIdx((i) => Math.max(0, i - 1));
  const handleNext = () =>
    setActivePlayerIdx((i) => Math.min(resolvedPlayers.length - 1, i + 1));

  return (
    <AnimatePresence>
      {open && (
        isStackedView ? (
          <motion.div
            key="map-pin-overlay-stacked"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`absolute inset-0 z-[1400] flex h-full w-full flex-col overflow-hidden rounded-3xl ${
              isLightUi
                ? "bg-white/95 backdrop-blur-xl"
                : "bg-[#0c0e11]/95 backdrop-blur-xl"
            }`}
          >
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

            <div className="flex-1 overflow-y-auto px-5 py-6">
              {hasMultiplePlayers && (
                <div className="mb-2 flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={safeIdx === 0}
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-25 ${
                      isLightUi
                        ? "border-stone-300/70 bg-white/80 text-stone-600"
                        : "border-[#f0e5a5]/30 bg-black/40 text-stone-300"
                    }`}
                    aria-label="Vorheriger Spieler"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex flex-1 items-end justify-center gap-2 overflow-x-auto px-1 py-1">
                    {resolvedPlayers.map((player, idx) => {
                      const isActive = idx === safeIdx;
                      return (
                        <button
                          key={player.scannerAuthId || idx}
                          type="button"
                          onClick={() => setActivePlayerIdx(idx)}
                          aria-pressed={isActive}
                          aria-label={player.scannerDisplayName}
                          className={`flex flex-shrink-0 flex-col items-center transition-all duration-200 focus:outline-none ${
                            isActive ? "opacity-100" : "opacity-40 hover:opacity-65"
                          }`}
                        >
                          <div className={`transition-all duration-200 ${isActive ? "h-16 w-16" : "h-10 w-10"}`}>
                            <CustomLogoAvatar
                              logoAssets={player.scannerLogoAssets}
                              noClip
                              className="h-full w-full"
                              fallbackText={player.scannerDisplayName?.charAt(0)?.toUpperCase() || "?"}
                              fallbackClassName={`font-bold text-white ${isActive ? "text-xl" : "text-sm"}`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={safeIdx === resolvedPlayers.length - 1}
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-25 ${
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

              <div className="mb-6 flex flex-col items-center gap-3">
                {!hasMultiplePlayers && (
                  <div className="h-24 w-24">
                    <CustomLogoAvatar
                      logoAssets={activePlayer.scannerLogoAssets}
                      noClip
                      className="h-full w-full"
                      fallbackText={activePlayer.scannerDisplayName?.charAt(0)?.toUpperCase() || "?"}
                      fallbackClassName="text-3xl font-bold text-white"
                    />
                  </div>
                )}

                <h2 className={`text-center text-lg font-bold ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
                  {activePlayer.scannerDisplayName}
                </h2>
                <p className={`text-xs ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>
                  {activePlayer.discoveries.length === 1
                    ? "1 Scan an diesem Ort"
                    : `${activePlayer.discoveries.length} Scans an diesem Ort`}
                </p>
              </div>

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
                          currentUserId={currentUserId}
                        />
                      ) : (
                        <div
                          className={`flex items-center gap-3 rounded-2xl border p-4 ${
                            isLightUi ? "border-stone-200 bg-stone-50" : "border-[#f0e5a5]/20 bg-black/30"
                          }`}
                        >
                          {disc.imageUrl ? (
                            <img
                              src={disc.imageUrl}
                              alt={disc.plantName || "Pflanze"}
                              className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
                            />
                          ) : (
                            <div
                              className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl ${
                                isLightUi ? "bg-stone-200" : "bg-stone-800"
                              }`}
                            >
                              <Leaf className={`h-6 w-6 ${isLightUi ? "text-stone-400" : "text-stone-500"}`} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className={`truncate text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
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
        ) : (
          <motion.div
            key="map-pin-overlay-compact"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-x-0 bottom-0 z-[1400] flex w-full justify-stretch px-4 pb-4 sm:px-5 sm:pb-5"
          >
            <div
              className={`relative w-full overflow-hidden rounded-[1.75rem] border shadow-[0_18px_60px_rgba(0,0,0,0.28)] ${
                isLightUi
                  ? "border-stone-200/80 bg-white/96 text-stone-900 backdrop-blur-xl"
                  : "border-[#f0e5a5]/22 bg-[#0c0e11]/94 text-stone-100 backdrop-blur-xl"
              }`}
            >
              <button
                type="button"
                onClick={onClose}
                className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  isLightUi
                    ? "border-stone-300/70 bg-white/80 text-stone-700 hover:bg-stone-100"
                    : "border-[#f0e5a5]/30 bg-black/50 text-stone-200 hover:bg-black/70"
                }`}
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex w-full flex-col gap-4 p-4 pr-14 sm:p-5 sm:pr-16">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isLightUi ? "text-emerald-700" : "text-lime-200"}`}>
                      Scan-Detail
                    </p>
                    <h2 className={`mt-1 truncate text-base font-bold sm:text-lg ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
                      {activePlayer.scannerDisplayName}
                    </h2>
                    <p className={`mt-1 text-xs ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>
                      {activePlayer.discoveries.length === 1
                        ? "1 Scan an diesem Ort"
                        : `${activePlayer.discoveries.length} Scans an diesem Ort`}
                    </p>
                  </div>
                </div>

                <div className="w-full">
                  {activePlayer.discoveries.length === 0 ? (
                    <div
                      className={`rounded-[1.5rem] border px-4 py-5 text-sm ${
                        isLightUi
                          ? "border-stone-200 bg-stone-50 text-stone-600"
                          : "border-[#f0e5a5]/20 bg-black/25 text-stone-400"
                      }`}
                    >
                      Noch keine Scans an diesem Ort sichtbar.
                    </div>
                  ) : (
                    <SpeciesInfoCard
                      plant={activePlayer.discoveries[0].plant}
                      imageUrl={activePlayer.discoveries[0].imageUrl || undefined}
                      isLightUi={isLightUi}
                      compact
                      showPrimaryImage
                      showScientificMeta
                      showNarrative={false}
                      currentUserId={currentUserId}
                    />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
    </AnimatePresence>
  );
}
