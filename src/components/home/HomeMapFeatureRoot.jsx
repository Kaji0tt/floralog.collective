import { Building2, ChevronDown, Droplet, Home as HomeIcon, Leaf, Loader2, RefreshCw, Sprout } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";
import MapPinDetailOverlay from "@/components/map/MapPinDetailOverlay";
import { calculateDistanceMetersRaw } from "@/lib/discoveryMap";
import { computeZoneMultiplierFromScanCount } from "@/lib/robotPlantEconomy";

const TILE_HALF_SIZE_M = 50;
const ZONE_SCAN_TARGET = 5;

const ZONE_THEME_META = {
  forest: { label: "Waldzone", summaryLabel: "Forest", order: 2, icon: Leaf, iconClass: "text-emerald-300" },
  urban: { label: "Urban Zone", summaryLabel: "Urban", order: 3, icon: Building2, iconClass: "text-amber-200" },
  water: { label: "Wasserzone", summaryLabel: "Water", order: 1, icon: Droplet, iconClass: "text-sky-300" },
  meadow: { label: "Wiesenzone", summaryLabel: "Meadow", order: 4, icon: Sprout, iconClass: "text-lime-300" },
};

const formatDistanceMeters = (value) => {
  if (!Number.isFinite(value)) return "—";
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} km`;
};

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
  onClose = null,
  authId,
  onRegenerateZones,
  canRegenerateZones,
  isRegeneratingZones,
  zoneRerollsRemaining,
  allDiscoveryPoints = [],
  discoveryMarkerScale = 0.8,
  plants = [],
  rewards = [],
  userRewards = [],
}) {
  const [pinOverlayData, setPinOverlayData] = useState(null);
  const [mapTimeFilter, setMapTimeFilter] = useState("all-time");
  const [isZoneOverviewExpanded, setIsZoneOverviewExpanded] = useState(false);

  const zoneRewardProgressByTheme = useMemo(() => {
    const unlockedRewardIds = new Set(
      (Array.isArray(userRewards) ? userRewards : [])
        .map((entry) => String(entry?.reward_id || "").trim())
        .filter(Boolean)
    );
    const progressByTheme = new Map();

    (Array.isArray(rewards) ? rewards : []).forEach((reward) => {
      const rawTheme = String(reward?.requires_zone_theme || "").trim().toLowerCase();
      const themeKey = rawTheme === "forerst" ? "forest" : rawTheme;
      const rewardId = String(reward?.id || "").trim();
      if (!rewardId || !ZONE_THEME_META[themeKey]) return;

      const current = progressByTheme.get(themeKey) || { unlocked: 0, total: 0 };
      current.total += 1;
      if (unlockedRewardIds.has(rewardId)) {
        current.unlocked += 1;
      }
      progressByTheme.set(themeKey, current);
    });

    return progressByTheme;
  }, [rewards, userRewards]);

  const zoneListItems = useMemo(() => {
    const centerLat = Number(cachedLocation?.lat ?? heroMapCenter?.[0]);
    const centerLng = Number(cachedLocation?.lng ?? heroMapCenter?.[1]);

    return (Array.isArray(heroZones) ? heroZones : [])
      .map((zone, index) => {
        const zoneLat = Number(zone?.centerLat ?? zone?.center_lat);
        const zoneLng = Number(zone?.centerLng ?? zone?.center_lng);
        const themeKey = String(zone?.theme || zone?.zoneTheme || "meadow").trim().toLowerCase();
        const themeMeta = ZONE_THEME_META[themeKey] || ZONE_THEME_META.meadow;
        const zoneTitle = String(zone?.title || zone?.zoneTitle || zone?.name || themeMeta.label).trim();
        const scansToday = Number(zone?.scansToday ?? zone?.scans_today ?? zone?.scanCountToday ?? zone?.scan_count_today ?? 0);
        const scanProgress = Number.isFinite(scansToday) ? Math.max(0, Math.min(ZONE_SCAN_TARGET, scansToday)) : 0;
        const zoneMultiplier = computeZoneMultiplierFromScanCount(scanProgress);
        const rewardProgress = zoneRewardProgressByTheme.get(themeKey) || { unlocked: 0, total: 0 };
        const accessoryUnlocked = Math.max(0, Number(rewardProgress.unlocked) || 0);
        const accessoryTotal = Math.max(0, Number(rewardProgress.total) || 0);
        const distanceM = Number.isFinite(zoneLat) && Number.isFinite(zoneLng) && Number.isFinite(centerLat) && Number.isFinite(centerLng)
          ? calculateDistanceMetersRaw(centerLat, centerLng, zoneLat, zoneLng)
          : null;

        return {
          key: String(zone?.zoneKey || zone?.id || `${themeKey}-${index}`),
          title: zoneTitle,
          themeLabel: themeMeta.label,
          summaryLabel: themeMeta.summaryLabel,
          themeKey,
          zoneMultiplier,
          distanceLabel: formatDistanceMeters(distanceM),
          scanLabel: `${scanProgress}/${ZONE_SCAN_TARGET}`,
          scanProgressCount: scanProgress,
          accessoryLabel: `${Math.max(0, accessoryUnlocked)}/${accessoryTotal}`,
          accessoryUnlockedCount: Math.max(0, accessoryUnlocked),
          accessoryTotalCount: accessoryTotal,
          isActive: Boolean(zone?.isActive ?? zone?.is_active),
          sourceZone: zone,
          themeIcon: themeMeta.icon,
          themeIconClass: themeMeta.iconClass,
        };
      })
      .slice(0, 6);
  }, [cachedLocation?.lat, cachedLocation?.lng, heroMapCenter, heroZones, zoneRewardProgressByTheme]);

  const zoneThemeSummaries = useMemo(() => {
    const summaryMap = new Map();

    const activeThemeKeys = new Set(zoneListItems.map((zone) => zone.themeKey));

    activeThemeKeys.forEach((themeKey) => {
      const meta = ZONE_THEME_META[themeKey] || ZONE_THEME_META.meadow;
      const rewardProgress = zoneRewardProgressByTheme.get(themeKey) || { unlocked: 0, total: 0 };
      summaryMap.set(themeKey, {
        key: themeKey,
        label: meta.summaryLabel,
        order: Number(meta.order || 99),
        unlocked: Math.max(0, Number(rewardProgress.unlocked) || 0),
        total: Math.max(0, Number(rewardProgress.total) || 0),
        icon: meta.icon,
        iconClass: meta.iconClass,
      });
    });

    return [...summaryMap.values()]
      .sort((a, b) => a.order - b.order)
      .map((entry) => ({
        ...entry,
        unlocked: Math.max(0, Math.min(entry.total, entry.unlocked)),
      }));
  }, [zoneListItems, zoneRewardProgressByTheme]);

  const zoneThemeSummaryColumns = useMemo(() => {
    const columns = [];
    for (let index = 0; index < zoneThemeSummaries.length; index += 2) {
      columns.push(zoneThemeSummaries.slice(index, index + 2));
    }
    return columns;
  }, [zoneThemeSummaries]);

  const openZoneSelection = useCallback(
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

  // ── Zone click handler ────────────────────────────────────────────────────
  const handleZoneSelect = useCallback(
    (zoneSelection) => {
      openZoneSelection(zoneSelection);
    },
    [openZoneSelection]
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
      className={`relative flex flex-1 min-h-0 flex-col rounded-3xl border overflow-hidden ${
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
        <div className="flex min-h-0 flex-1 flex-col">
          <div className={`relative flex-1 min-h-0 overflow-hidden rounded-t-none rounded-b-none border-b transition-[min-height,flex-basis] duration-300 ${
            isLightUi
              ? "border-[#c0a860]/40"
              : "border-[#f0e5a5]/18"
          }`}>
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

            <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 z-[1100] ${
              isLightUi
                ? "bg-gradient-to-b from-white/20 to-transparent"
                : "bg-gradient-to-b from-black/60 to-transparent"
            }`} />

            <div className="absolute left-4 right-4 top-4 z-[1200] flex items-center justify-end gap-2">
              <div className="relative">
                <select
                  value={mapTimeFilter}
                  onChange={(e) => setMapTimeFilter(e.target.value)}
                  className={`appearance-none cursor-pointer rounded-xl border py-1.5 pl-3 pr-7 text-[11px] md:text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-lime-300/50 ${
                    isLightUi
                      ? "border-[#c8ac62]/50 bg-white/85 text-stone-800"
                      : "border-[#f0e5a5]/35 bg-black/65 text-stone-100"
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
                className={`h-8 px-3 rounded-xl border flex items-center gap-1.5 text-[11px] md:text-xs font-semibold disabled:opacity-60 whitespace-nowrap transition-colors ${
                  isLightUi
                    ? "border-[#c8ac62]/55 bg-white/90 text-stone-800 hover:bg-white"
                    : "border-[#f0e5a5]/45 bg-black/72 text-stone-100 hover:bg-black/85"
                }`}
              >
                {isRegeneratingZones ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Neu
              </button>

              <div className={`h-8 px-3 rounded-xl border flex items-center text-[11px] md:text-xs font-semibold whitespace-nowrap ${
                isLightUi
                  ? "border-[#c8ac62]/50 bg-white/85 text-stone-800"
                  : "border-[#f0e5a5]/35 bg-black/72 text-stone-100"
              }`}>
                Re-Rolls: {rerollsRemainingDisplay}
              </div>

              {typeof onClose === "function" && (
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex h-8 items-center justify-center rounded-xl border px-3 transition-colors ${
                    isLightUi
                      ? "border-[#c8ac62]/55 bg-white/90 text-stone-800 hover:bg-white"
                      : "border-[#f0e5a5]/35 bg-black/72 text-stone-100 hover:bg-black/85"
                  }`}
                  aria-label="Zur Home-Ansicht"
                  title="Zur Home-Ansicht"
                >
                  <HomeIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {(zoneMapError || tileClaimError) && (
              <div className={`absolute left-4 right-4 top-16 z-[1200] rounded-xl border px-3 py-2 text-[11px] md:text-xs font-medium ${
                isLightUi
                  ? "border-red-400/40 bg-red-100/90 text-red-800"
                  : "border-red-300/50 bg-red-950/80 text-red-100"
              }`}>
                {zoneMapError || `Tile-Claims konnten nicht geladen werden: ${tileClaimError}`}
              </div>
            )}
          </div>

          {!pinOverlayData && (
            <div className={`shrink-0 border-t px-4 py-2.5 sm:px-5 sm:py-3 transition-[opacity] duration-300 ${
              isLightUi
                ? "border-[#c0a860]/25 bg-[#f5f1e6] text-stone-900"
                : "border-[#f0e5a5]/14 bg-[#10140f] text-stone-100"
            }`}>
              <div className="flex items-center justify-between gap-3 pb-2.5">
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${isLightUi ? "text-emerald-700" : "text-lime-200"}`}>
                    Umgebungskarte
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsZoneOverviewExpanded((prev) => !prev)}
                  aria-pressed={isZoneOverviewExpanded}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                    isLightUi
                      ? "border-stone-300/70 bg-white/80 text-stone-700 hover:bg-white"
                      : "border-[#f0e5a5]/18 bg-black/35 text-stone-200 hover:bg-black/55"
                  }`}
                >
                  {zoneListItems.length} Zonen
                </button>
              </div>

              <div className="pr-1">
                {zoneListItems.length === 0 ? (
                  <div className={`rounded-[1.15rem] border px-4 py-3 text-sm ${
                    isLightUi
                      ? "border-stone-200 bg-white/75 text-stone-600"
                      : "border-[#f0e5a5]/12 bg-black/25 text-stone-400"
                  }`}>
                    Noch keine aktiven Zonen verfügbar.
                  </div>
                ) : !isZoneOverviewExpanded ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {zoneThemeSummaryColumns.map((column, columnIndex) => (
                      <div key={`zone-summary-column-${columnIndex}`} className="flex min-w-0 flex-col gap-1.5">
                        {column.map((theme) => (
                          <button
                            key={theme.key}
                            type="button"
                            onClick={() => setIsZoneOverviewExpanded(true)}
                            className="flex min-w-0 items-center gap-2 text-left"
                          >
                            <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center ${theme.iconClass || (isLightUi ? "text-stone-700" : "text-stone-200")}`}>
                              {theme.icon ? <theme.icon className="h-3.5 w-3.5" /> : null}
                            </span>
                            <span className={`min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
                              {theme.label}
                            </span>
                            <span className={`shrink-0 text-[10px] font-semibold tabular-nums ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                              {theme.unlocked}/{theme.total}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto overflow-y-visible pb-1 pr-1 snap-x snap-mandatory">
                    {zoneListItems.map((zone) => (
                      <button
                        key={zone.key}
                        type="button"
                        onClick={() => openZoneSelection({
                          centerLat: Number(zone.sourceZone?.centerLat ?? zone.sourceZone?.center_lat),
                          centerLng: Number(zone.sourceZone?.centerLng ?? zone.sourceZone?.center_lng),
                          radiusM: Number(zone.sourceZone?.radiusM ?? zone.sourceZone?.radius_m ?? 0),
                          themeLabel: zone.themeLabel,
                        })}
                        className={`relative w-32 shrink-0 snap-start rounded-[1.15rem] border px-3 py-2.5 text-left transition-transform duration-150 hover:-translate-y-0.5 ${
                          zone.isActive
                            ? isLightUi
                              ? "border-emerald-500/35 bg-emerald-500/10"
                              : "border-emerald-300/30 bg-emerald-500/10"
                            : isLightUi
                              ? "border-stone-200 bg-white/85"
                              : "border-[#f0e5a5]/14 bg-black/25"
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <span className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center ${zone.themeIconClass || (isLightUi ? "text-stone-700" : "text-stone-200")}`}>
                            {zone.themeIcon ? <zone.themeIcon className="h-3.5 w-3.5" /> : null}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>
                              {zone.themeLabel}
                            </div>
                            <div className={`mt-0.5 w-full text-right text-[9px] font-semibold uppercase tracking-[0.14em] tabular-nums ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
                              {zone.distanceLabel}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 grid gap-1.5">
                          <div className={`flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>
                            <span>Scans</span>
                            <span className="tabular-nums">{zone.scanLabel}</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {Array.from({ length: ZONE_SCAN_TARGET }).map((_, stepIndex) => {
                              const isFilled = stepIndex < zone.scanProgressCount;
                              return (
                                <span
                                  key={`${zone.key}-scan-step-${stepIndex}`}
                                  className={`h-2.5 rounded-full border ${isFilled
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

                        <div className={`mt-2 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>
                          <span>Multiplikator</span>
                          <span className={`tabular-nums ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                            x{zone.zoneMultiplier.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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