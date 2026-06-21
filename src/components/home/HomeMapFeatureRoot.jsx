import { Bug, Loader2, Map as MapIcon, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useState } from "react";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";
import MapPinDetailOverlay from "@/components/map/MapPinDetailOverlay";
import { TileVisualizationPanel } from "@/components/admin/TileVisualizationPanel";

export default function HomeMapFeatureRoot({
  isLightUi,
  isResolvingLocation,
  isLoadingDiscoveries,
  isLoadingClaims,
  hasLiveCachedLocation,
  zoneMapError,
  tileClaimError,
  onRequestLocation,
  heroZones,
  nearbyDiscoveryPoints,
  claimedTiles,
  cachedLocation,
  heroMapCenter,
  onDiscoveryImageClick,
  onDiscoveryLike,
  allowDiscoveryLike,
  onTokenError,
  onMapReady,
  heroMapInstance,
  authId,
  isAdminUser,
  showDebugZonePanel,
  onDebugZonePanelChange,
  onClose,
  onRegenerateZones,
  canRegenerateZones,
  isRegeneratingZones,
  zoneRerollsRemaining,
  allDiscoveryPoints = [],
  friendEmailSet = new Set(),
  discoveryMarkerScale = 0.8,
  plants = [],
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pinOverlayData, setPinOverlayData] = useState(null);

  const handlePinSelect = useCallback(({ point, properties, mergedCount, mergedDiscoveryIds }) => {
    // Build logo assets from the point data
    const scannerLogoAssets = (point?.scannerLogoBorderUrl || point?.scannerLogoPlantUrl || point?.scannerLogoFaceUrl)
      ? {
          border: point.scannerLogoBorderUrl ? { imageUrl: point.scannerLogoBorderUrl } : undefined,
          plant: point.scannerLogoPlantUrl ? { imageUrl: point.scannerLogoPlantUrl } : undefined,
          face: point.scannerLogoFaceUrl ? { imageUrl: point.scannerLogoFaceUrl } : undefined,
          borderColor: point.scannerLogoBorderColor || null,
        }
      : null;

    // Resolve discoveries for the selected pin
    const discoveryIds = mergedDiscoveryIds || [properties?.discoveryId].filter(Boolean);
    const resolvedDiscoveries = discoveryIds.map((id) => {
      const matchingPoint = allDiscoveryPoints.find((dp) => dp.discoveryId === id);
      const plantObj = matchingPoint?.plantId
        ? plants.find((p) => p.id === matchingPoint.plantId) || null
        : null;
      return {
        discoveryId: id,
        imageUrl: matchingPoint?.imageUrl || "",
        plantName: matchingPoint?.plantName || properties?.plantName || "Unbekannte Pflanze",
        plantId: matchingPoint?.plantId || "",
        plant: plantObj,
      };
    });

    setPinOverlayData({
      scannerDisplayName: properties?.scannerDisplayName || point?.scannerDisplayName || "Unbekannt",
      scannerLogoAssets,
      discoveries: resolvedDiscoveries,
    });
  }, [allDiscoveryPoints, plants]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const displayedDiscoveryPoints = trimmedQuery
    ? allDiscoveryPoints.filter((point) => {
        const nameMatch = point.scannerName.toLowerCase().includes(trimmedQuery);
        const isFriend = friendEmailSet.has(point.scannerEmail.toLowerCase());
        const plantMatch = point.plantName.toLowerCase().includes(trimmedQuery);
        return (nameMatch && isFriend) || plantMatch;
      })
    : nearbyDiscoveryPoints;
  return (
    <section
      className={`relative flex-1 min-h-0 rounded-3xl border overflow-hidden ${
        isLightUi
          ? "border-[#c0a860]/50 backdrop-blur-xl"
          : "border-[#f0e5a5]/25 bg-black/25 backdrop-blur-sm"
      }`}
      style={isLightUi ? {
        background: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.05) 100%)",
      } : undefined}
    >
      {isResolvingLocation ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className={`rounded-2xl border px-4 py-3 text-sm flex items-center gap-2 ${
            isLightUi
              ? "border-[#c8ac62]/50 bg-white/70 text-stone-800"
              : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
          }`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Live-Standort wird geladen...
          </div>
        </div>
      ) : isLoadingDiscoveries ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className={`rounded-2xl border px-4 py-3 text-sm flex items-center gap-2 ${
            isLightUi
              ? "border-[#c8ac62]/50 bg-white/70 text-stone-800"
              : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
          }`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Lokale Funde werden geladen...
          </div>
        </div>
      ) : isLoadingClaims ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className={`rounded-2xl border px-4 py-3 text-sm flex items-center gap-2 ${
            isLightUi
              ? "border-[#c8ac62]/50 bg-white/70 text-stone-800"
              : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
          }`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Claims werden geladen...
          </div>
        </div>
      ) : !hasLiveCachedLocation ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className={`max-w-md rounded-2xl border p-5 text-center ${
            isLightUi
              ? "border-red-400/45 bg-red-100/75 text-red-800"
              : "border-red-300/45 bg-red-950/55 text-red-100"
          }`}>
            <h3 className="text-base font-semibold mb-2">Zonenkarte nicht verfuegbar</h3>
            <p className="text-sm mb-4">
              {zoneMapError || "Ohne Live-Standort kann die Zonenkarte nicht geladen werden."}
            </p>
            <button
              type="button"
              onClick={onRequestLocation}
              className={`h-10 px-4 rounded-xl border text-sm font-semibold ${
                isLightUi
                  ? "border-red-500/50 bg-white/70 text-red-800 hover:bg-white"
                  : "border-red-300/45 bg-red-900/45 text-red-100 hover:bg-red-900/60"
              }`}
            >
              Standort erneut anfragen
            </button>
          </div>
        </div>
      ) : (
        <MapboxZoneMap
          zones={heroZones}
          userLocation={cachedLocation}
          fallbackCenter={{ lat: heroMapCenter[0], lng: heroMapCenter[1] }}
          discoveryPoints={displayedDiscoveryPoints}
          claimedTiles={claimedTiles}
          currentAuthId={authId}
          isLightUi={isLightUi}
          onDiscoveryImageClick={onDiscoveryImageClick}
          onDiscoveryLike={onDiscoveryLike}
          onPinSelect={handlePinSelect}
          allowDiscoveryLike={allowDiscoveryLike}
          discoveryMarkerScale={discoveryMarkerScale}
          hideClaimLogos={!!trimmedQuery}
          onTokenError={onTokenError}
          onMapReady={onMapReady}
        />
      )}

      <TileVisualizationPanel
        map={heroMapInstance}
        userLocation={cachedLocation}
        authId={authId}
        isAdmin={isAdminUser}
        open={showDebugZonePanel}
        onOpenChange={onDebugZonePanelChange}
      />

      <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 z-[1100] ${
        isLightUi
          ? "bg-gradient-to-b from-white/20 to-transparent"
          : "bg-gradient-to-b from-black/60 to-transparent"
      }`} />

      {/* Top bar: stats chip */}
      <div className="absolute left-4 right-4 top-4 z-[1200] flex items-center justify-between gap-2">
        <div className={`rounded-xl border backdrop-blur-sm px-3 py-1.5 text-[11px] md:text-xs font-semibold flex items-center gap-1.5 ${
          isLightUi
            ? "border-[#c8ac62]/50 bg-white/55 text-stone-800"
            : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
        }`}>
          <MapIcon className="w-3.5 h-3.5" />
          {trimmedQuery
            ? `Funde: ${displayedDiscoveryPoints.length}`
            : `Zonen: ${heroZones.length} | Funde: ${nearbyDiscoveryPoints.length} | Claims: ${claimedTiles?.length || 0}`}
        </div>
      </div>

      {/* Debug button for admins, below the top bar */}
      {isAdminUser && (
        <button
          type="button"
          onClick={() => onDebugZonePanelChange(true)}
          className={`absolute left-4 top-14 z-[1200] h-8 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-1.5 text-[11px] md:text-xs font-semibold ${
            isLightUi
              ? "border-amber-400/60 bg-amber-50/70 text-amber-800 hover:bg-amber-100/80"
              : "border-amber-400/50 bg-amber-900/40 text-amber-200 hover:bg-amber-900/60"
          } transition-colors`}
          title="Admin: Debug Zone Overlay"
        >
          <Bug className="w-3.5 h-3.5" />
          Debug-Zone
        </button>
      )}

      {(zoneMapError || tileClaimError) && (
        <div className={`absolute left-4 right-4 z-[1200] rounded-xl border backdrop-blur-sm px-3 py-2 text-[11px] md:text-xs font-medium ${
          isAdminUser ? "top-24" : "top-16"
        } ${
          isLightUi
            ? "border-red-400/40 bg-red-200/65 text-red-800"
            : "border-red-300/50 bg-red-900/55 text-red-100"
        }`}>
          {zoneMapError || `Tile-Claims konnten nicht geladen werden: ${tileClaimError}`}
        </div>
      )}

      {/* Bottom search bar + Neu button */}
      <div className="absolute left-4 right-4 bottom-4 z-[1200] flex items-end gap-2">
        <div className="relative flex-1 min-w-0">
          {trimmedQuery && (
            <p className={`absolute bottom-full mb-1 left-0 right-0 text-[10px] text-center ${
              isLightUi ? "text-stone-600" : "text-stone-400"
            }`}>
              {displayedDiscoveryPoints.length === 0
                ? "Keine Ergebnisse"
                : `${displayedDiscoveryPoints.length} Fund${displayedDiscoveryPoints.length === 1 ? "" : "e"} gefunden (deutschlandweit)`}
            </p>
          )}
          <div className={`flex items-center gap-2 h-10 rounded-xl border backdrop-blur-sm px-3 ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/70 text-stone-800"
              : "border-[#f0e5a5]/45 bg-black/60 text-stone-100"
          }`}>
            <Search className="w-3.5 h-3.5 shrink-0 opacity-60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Freund oder Pflanzenname suchen…"
              className={`flex-1 min-w-0 bg-transparent text-xs md:text-sm outline-none placeholder:opacity-50 ${
                isLightUi ? "placeholder:text-stone-600" : "placeholder:text-stone-400"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Suche löschen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRegenerateZones}
          disabled={!canRegenerateZones || isRegeneratingZones}
          className={`h-10 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-1.5 text-[11px] md:text-xs font-semibold disabled:opacity-60 whitespace-nowrap ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/60 text-stone-800 hover:bg-white/70"
              : "border-[#f0e5a5]/45 bg-black/55 text-stone-100 hover:bg-black/70"
          } transition-colors`}
        >
          {isRegeneratingZones ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {zoneRerollsRemaining !== null && !isAdminUser ? `Neu (${zoneRerollsRemaining})` : "Neu"}
        </button>
      </div>

      {/* Pin detail overlay */}
      <MapPinDetailOverlay
        open={!!pinOverlayData}
        onClose={() => setPinOverlayData(null)}
        scannerDisplayName={pinOverlayData?.scannerDisplayName || "Unbekannt"}
        scannerLogoAssets={pinOverlayData?.scannerLogoAssets || null}
        discoveries={pinOverlayData?.discoveries || []}
        isLightUi={isLightUi}
      />
    </section>
  );
}