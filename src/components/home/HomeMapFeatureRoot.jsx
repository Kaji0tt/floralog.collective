import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";
import MapPinDetailOverlay from "@/components/map/MapPinDetailOverlay";
import { calculateDistanceMetersRaw } from "@/lib/discoveryMap";

const TILE_HALF_SIZE_M = 50;

const buildLogoAssetsFromPoint = (point) => {
  const borderUrl = String(point?.scannerLogoBorderUrl || "").trim();
  const plantUrl = String(point?.scannerLogoPlantUrl || "").trim();
  const faceUrl = String(point?.scannerLogoFaceUrl || "").trim();
  if (!borderUrl && !plantUrl && !faceUrl) return null;
  return {
    border: borderUrl ? { imageUrl: borderUrl } : undefined,
    plant: plantUrl ? { imageUrl: plantUrl } : undefined,
    face: faceUrl ? { imageUrl: faceUrl } : undefined,
    borderColor: String(point?.scannerLogoBorderColor || "").trim() || null,
  };
};

const groupPointsByPlayer = (points, primaryAuthId, plants) => {
  const playerMap = new Map();
  points.forEach((p) => {
    const key = String(p?.scannerAuthId || p?.scannerEmail || "unknown");
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        scannerAuthId: p.scannerAuthId || "",
        scannerDisplayName: p.scannerDisplayName || p.scannerName || "Unbekannt",
        scannerLogoAssets: buildLogoAssetsFromPoint(p),
        discoveries: [],
      });
    }
    const player = playerMap.get(key);
    const plantObj = p.plantId ? (plants || []).find((pl) => pl.id === p.plantId) || null : null;
    player.discoveries.push({
      discoveryId: p.discoveryId || "",
      imageUrl: p.imageUrl || "",
      plantName: p.plantName || "Unbekannte Pflanze",
      plantId: p.plantId || "",
      plant: plantObj,
    });
  });

  const playerList = [...playerMap.values()];
  // Put the primary (zone owner / current user) first
  const primaryIdx = playerList.findIndex((pl) => pl.scannerAuthId === primaryAuthId);
  if (primaryIdx > 0) {
    const [primary] = playerList.splice(primaryIdx, 1);
    playerList.unshift(primary);
  }
  return playerList;
};

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
  authId,
  onRegenerateZones,
  canRegenerateZones,
  isRegeneratingZones,
  zoneRerollsRemaining,
  allDiscoveryPoints = [],
  discoveryMarkerScale = 0.8,
  plants = [],
}) {
  const [pinOverlayData, setPinOverlayData] = useState(null);
  const [mapTimeFilter, setMapTimeFilter] = useState("all-time");

  // ── Zone click handler ────────────────────────────────────────────────────
  const handleZoneSelect = useCallback(
    ({ centerLat, centerLng, radiusM, themeLabel }) => {
      if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !(radiusM > 0)) return;

      const pointsInZone = allDiscoveryPoints.filter((p) => {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
        const dist = calculateDistanceMetersRaw(p.lat, p.lng, centerLat, centerLng);
        return Number.isFinite(dist) && dist <= radiusM;
      });

      const players = groupPointsByPlayer(pointsInZone, authId, plants);

      // If no scans visible at all, still open with empty state so the user sees context
      if (players.length === 0) {
        setPinOverlayData({
          players: [{
            scannerAuthId: authId || "",
            scannerDisplayName: "Zone: " + (themeLabel || "Unbekannt"),
            scannerLogoAssets: null,
            discoveries: [],
          }],
        });
        return;
      }

      setPinOverlayData({ players });
    },
    [allDiscoveryPoints, plants, authId]
  );

  // ── Claim tile click handler ──────────────────────────────────────────────
  const handleClaimSelect = useCallback(
    ({ tileX, tileY, ownerAuthId }) => {
      const claim = claimedTiles.find(
        (c) => Number(c.tileX) === tileX && Number(c.tileY) === tileY
      );
      if (!claim) return;

      const centerLat = Number(claim.centerLat);
      const centerLng = Number(claim.centerLng);
      if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return;

      const latMpd = 111320;
      const lngMpd = Math.abs(111320 * Math.cos((centerLat * Math.PI) / 180)) || 1e-6;

      const pointsInTile = allDiscoveryPoints.filter((p) => {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
        const dx = Math.abs((p.lng - centerLng) * lngMpd);
        const dy = Math.abs((p.lat - centerLat) * latMpd);
        return dx <= TILE_HALF_SIZE_M && dy <= TILE_HALF_SIZE_M;
      });

      let players = groupPointsByPlayer(pointsInTile, ownerAuthId, plants);

      // Ensure the claim owner is always represented (even if their scans are outside current view)
      if (players.length === 0 || players[0].scannerAuthId !== ownerAuthId) {
        const borderUrl = String(claim.ownerLogoBorderUrl || "").trim();
        const plantUrl = String(claim.ownerLogoPlantUrl || "").trim();
        const faceUrl = String(claim.ownerLogoFaceUrl || "").trim();
        const ownerLogoAssets =
          borderUrl || plantUrl || faceUrl
            ? {
                border: borderUrl ? { imageUrl: borderUrl } : undefined,
                plant: plantUrl ? { imageUrl: plantUrl } : undefined,
                face: faceUrl ? { imageUrl: faceUrl } : undefined,
                borderColor: String(claim.ownerBorderColor || "").trim() || null,
              }
            : null;
        const ownerEntry = {
          scannerAuthId: ownerAuthId,
          scannerDisplayName: claim.ownerName || "Unbekannt",
          scannerLogoAssets: ownerLogoAssets,
          discoveries: [],
        };
        players = [ownerEntry, ...players.filter((pl) => pl.scannerAuthId !== ownerAuthId)];
      }

      setPinOverlayData({ players });
    },
    [allDiscoveryPoints, claimedTiles, plants]
  );

  const SOMMER_2026_CUTOFF = "2026-06-21";

  const applyTimeFilter = (points) => {
    if (mapTimeFilter === "all-time") return points;
    if (mapTimeFilter === "sommer2026") {
      return points.filter((p) => {
        const d = p.discoveredAt;
        return d && d >= SOMMER_2026_CUTOFF;
      });
    }
    // legacy: scans before 21.06.2026
    return points.filter((p) => {
      const d = p.discoveredAt;
      return !d || d < SOMMER_2026_CUTOFF;
    });
  };

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

  const displayedDiscoveryPoints = applyTimeFilter(nearbyDiscoveryPoints);
  const rerollsRemainingDisplay = Number.isFinite(Number(zoneRerollsRemaining))
    ? Math.max(0, Number(zoneRerollsRemaining))
    : "...";
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
          onZoneSelect={handleZoneSelect}
          onClaimSelect={handleClaimSelect}
          allowDiscoveryLike={allowDiscoveryLike}
          discoveryMarkerScale={discoveryMarkerScale}
          onTokenError={onTokenError}
          onMapReady={onMapReady}
        />
      )}

      <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 z-[1100] ${
        isLightUi
          ? "bg-gradient-to-b from-white/20 to-transparent"
          : "bg-gradient-to-b from-black/60 to-transparent"
      }`} />

      {/* Top bar: time filter + regeneration actions */}
      <div className="absolute left-4 right-4 top-4 z-[1200] flex items-center justify-end gap-2">
        <div className="relative">
          <select
            value={mapTimeFilter}
            onChange={(e) => setMapTimeFilter(e.target.value)}
            className={`appearance-none cursor-pointer rounded-xl border backdrop-blur-sm py-1.5 pl-3 pr-7 text-[11px] md:text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-lime-300/50 ${
              isLightUi
                ? "border-[#c8ac62]/50 bg-white/55 text-stone-800"
                : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
            }`}
          >
            <option value="all-time">All Time</option>
            <option value="sommer2026">Sommer 2026</option>
            <option value="legacy">Legacy</option>
          </select>
          <ChevronDown className={`pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 ${
            isLightUi ? "text-stone-600" : "text-stone-300"
          }`} />
        </div>

        <button
          type="button"
          onClick={onRegenerateZones}
          disabled={!canRegenerateZones || isRegeneratingZones}
          className={`h-8 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-1.5 text-[11px] md:text-xs font-semibold disabled:opacity-60 whitespace-nowrap ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/60 text-stone-800 hover:bg-white/70"
              : "border-[#f0e5a5]/45 bg-black/55 text-stone-100 hover:bg-black/70"
          } transition-colors`}
        >
          {isRegeneratingZones ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Neu
        </button>

        <div className={`h-8 px-3 rounded-xl border backdrop-blur-sm flex items-center text-[11px] md:text-xs font-semibold whitespace-nowrap ${
          isLightUi
            ? "border-[#c8ac62]/50 bg-white/55 text-stone-800"
            : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
        }`}>
          Re-Rolls: {rerollsRemainingDisplay}
        </div>
      </div>

      {(zoneMapError || tileClaimError) && (
        <div className={`absolute left-4 right-4 top-16 z-[1200] rounded-xl border backdrop-blur-sm px-3 py-2 text-[11px] md:text-xs font-medium ${
          isLightUi
            ? "border-red-400/40 bg-red-200/65 text-red-800"
            : "border-red-300/50 bg-red-900/55 text-red-100"
        }`}>
          {zoneMapError || `Tile-Claims konnten nicht geladen werden: ${tileClaimError}`}
        </div>
      )}

      {/* Pin detail overlay */}
      <MapPinDetailOverlay
        open={!!pinOverlayData}
        onClose={() => setPinOverlayData(null)}
        scannerDisplayName={pinOverlayData?.scannerDisplayName || "Unbekannt"}
        scannerLogoAssets={pinOverlayData?.scannerLogoAssets || null}
        discoveries={pinOverlayData?.discoveries || []}
        players={pinOverlayData?.players || null}
        isLightUi={isLightUi}
      />
    </section>
  );
}