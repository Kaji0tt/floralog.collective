import { Building2, CircleHelp, Droplet, EyeOff, Leaf, Loader2, RefreshCw, Sprout, User, Users, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";
import MapPinDetailOverlay from "@/components/map/MapPinDetailOverlay";
import ZoneDetailSheet from "@/components/home/ZoneDetailSheet";
import ZoneInfoDialog from "@/components/home/ZoneInfoDialog";
import GoldGradientCard from "@/components/home/GoldGradientCard";
import { calculateDistanceMetersRaw } from "@/lib/discoveryMap";
import { computeZoneMultiplierFromScanCount } from "@/lib/robotPlantEconomy";
import { createZoneSharedInvite } from "@/api/zoneSharedInviteService";
import { createUserNotification } from "@/api/notificationService";

const AREA_HALF_SIZE_M = 50;
const ZONE_SCAN_TARGET = 5;

const ZONE_THEME_META = {
  forest: { label: "Waldzone", summaryLabel: "Forest", order: 2, icon: Leaf, iconClass: "text-emerald-300" },
  urban: { label: "Urban Zone", summaryLabel: "Urban", order: 3, icon: Building2, iconClass: "text-amber-200" },
  water: { label: "Wasserzone", summaryLabel: "Water", order: 1, icon: Droplet, iconClass: "text-sky-300" },
  meadow: { label: "Wiesenzone", summaryLabel: "Meadow", order: 4, icon: Sprout, iconClass: "text-lime-300" },
};

const ZONE_THEME_IMAGES = {
  forest: "/bg_forest.png",
  urban: "/bg_urban.png",
  water: "/bg_water.png",
  meadow: "/bg_flowers.png",
};

const PIN_VISIBILITY_MODES = [
  { value: "none", label: "Keine", icon: <EyeOff className="h-3.5 w-3.5" /> },
  { value: "mine", label: "Meine", icon: <User className="h-3.5 w-3.5" /> },
  { value: "friends", label: "Freunde", icon: <Users className="h-3.5 w-3.5" /> },
];

const formatDistanceMeters = (value) => {
  if (!Number.isFinite(value)) return "—";
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} km`;
};

// Reward.image_url is only an optional notification preview; the actual accessory art lives in
// LogoAsset (matched by asset_id === reward.value), same catalog used to render equipped logos.
const resolveRewardCatalogImageUrl = (reward, logoAssetCatalog) => {
  const rewardValue = String(reward?.value || "").trim();
  const catalogMatch = rewardValue
    ? (Array.isArray(logoAssetCatalog) ? logoAssetCatalog : []).find(
        (asset) => String(asset?.asset_id || "").trim() === rewardValue
      )
    : null;
  return catalogMatch?.public_url || reward?.image_url || null;
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
  areaClaimError,
  onRequestLocation,
  heroZones,
  nearbyDiscoveryPoints,
  claimedAreas,
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
  rewards = [],
  userRewards = [],
  genera = [],
  logoAssetCatalog = [],
  friendEmails = [],
  friendOptions = [],
  preselectedFriendAuthId = null,
  senderDisplayName = "",
}) {
  const [pinOverlayData, setPinOverlayData] = useState(null);
  const [pinVisibilityMode, setPinVisibilityMode] = useState("friends");
  const [isZoneOverviewExpanded, setIsZoneOverviewExpanded] = useState(false);
  const [selectedZoneForDetail, setSelectedZoneForDetail] = useState(null);
  const [isZoneInfoOpen, setIsZoneInfoOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isSendingShare, setIsSendingShare] = useState(false);

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

  const zoneTargetPlantsByTheme = useMemo(() => {
    const unlockedRewardIds = new Set(
      (Array.isArray(userRewards) ? userRewards : [])
        .map((entry) => String(entry?.reward_id || "").trim())
        .filter(Boolean)
    );
    const map = new Map();

    (Array.isArray(rewards) ? rewards : []).forEach((reward) => {
      const rawTheme = String(reward?.requires_zone_theme || "").trim().toLowerCase();
      const themeKey = rawTheme === "forerst" ? "forest" : rawTheme;
      if (!ZONE_THEME_META[themeKey]) return;

      const speciesId = String(reward?.requires_plant_species_id || "").trim();
      const genusId = String(reward?.requires_plant_genus_id || "").trim();
      if (!speciesId && !genusId) return;

      const rewardId = String(reward?.id || "").trim();
      if (!rewardId) return;

      const matchingPlant = speciesId ? (plants || []).find((p) => p.id === speciesId) : null;
      const matchingGenus = !speciesId && genusId ? (genera || []).find((g) => g.id === genusId) : null;
      const label = matchingPlant?.species_name || matchingGenus?.genus_name || reward?.display_name || "Zielpflanze";
      const isUnlocked = unlockedRewardIds.has(rewardId);

      // Preview uses the player's own scan of the species/genus even before the reward itself is unlocked.
      const ownDiscovery = (allDiscoveryPoints || []).find((p) => {
        if (String(p?.scannerAuthId || "") !== String(authId || "")) return false;
        return speciesId
          ? p.plantId === speciesId
          : (plants || []).some((pl) => pl.id === p.plantId && pl.genus_id === genusId);
      });

      const current = map.get(themeKey) || [];
      current.push({
        rewardId,
        label,
        unlocked: isUnlocked,
        hasDiscovery: Boolean(ownDiscovery),
        imageUrl: ownDiscovery?.imageUrl || null,
        rewardName: reward?.display_name || label,
        rewardImageUrl: resolveRewardCatalogImageUrl(reward, logoAssetCatalog),
      });
      map.set(themeKey, current);
    });

    return map;
  }, [rewards, userRewards, plants, genera, allDiscoveryPoints, authId, logoAssetCatalog]);

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
        const configuredZoneMultiplier = Number(
          zone?.bonusMultiplier ?? zone?.zoneBonusMultiplier ?? zone?.zone_bonus_multiplier
        );
        const zoneMultiplier = Number.isFinite(configuredZoneMultiplier) && configuredZoneMultiplier > 0
          ? configuredZoneMultiplier
          : computeZoneMultiplierFromScanCount(scanProgress);
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
          themeImage: ZONE_THEME_IMAGES[themeKey] || null,
          targetPlants: zoneTargetPlantsByTheme.get(themeKey) || [],
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
  }, [cachedLocation?.lat, cachedLocation?.lng, heroMapCenter, heroZones, zoneRewardProgressByTheme, zoneTargetPlantsByTheme]);

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
  // Map-circle clicks only carry raw geometry, so match back to the enriched list item for the detail sheet.
  const handleZoneSelect = useCallback(
    ({ zoneId, centerLat, centerLng, radiusM, themeLabel }) => {
      const matchingZone = zoneListItems.find((zone) => zone.key === String(zoneId));
      if (matchingZone) {
        setSelectedZoneForDetail(matchingZone);
        return;
      }
      openZoneSelection({ centerLat, centerLng, radiusM, themeLabel });
    },
    [zoneListItems, openZoneSelection]
  );

  const handleOpenScansForSelectedZone = useCallback(() => {
    if (!selectedZoneForDetail) return;
    const sourceZone = selectedZoneForDetail.sourceZone || {};
    openZoneSelection({
      centerLat: Number(sourceZone.centerLat ?? sourceZone.center_lat),
      centerLng: Number(sourceZone.centerLng ?? sourceZone.center_lng),
      radiusM: Number(sourceZone.radiusM ?? sourceZone.radius_m ?? 0),
      themeLabel: selectedZoneForDetail.themeLabel,
    });
  }, [selectedZoneForDetail, openZoneSelection]);

  const handleOpenMoreInfoForSelectedZone = useCallback(() => {
    if (!selectedZoneForDetail) return;
    setIsZoneInfoOpen(true);
  }, [selectedZoneForDetail]);

  const handleShareSelectedZone = useCallback(async (friend) => {
    if (!selectedZoneForDetail?.sourceZone?.id || !friend?.authId) return;
    setIsSendingShare(true);
    try {
      const invite = await createZoneSharedInvite({
        recipientAuthId: friend.authId,
        sourceZoneId: selectedZoneForDetail.sourceZone.id,
      });
      const senderName = String(senderDisplayName || "Ein Freund").trim() || "Ein Freund";
      await createUserNotification({
        authId: friend.authId,
        userEmail: friend.email,
        notificationType: "zone_shared_invite",
        title: "🌱 Zoneneinladung",
        message: `${senderName} möchte eine ${selectedZoneForDetail.themeLabel}zone, ${selectedZoneForDetail.distanceLabel} entfernt, mit dir teilen. Möchtest du die Einladung annehmen? Wenn ihr es schafft, in den nächsten 30 Minuten jeweils 5 Entdeckungen in dieser Zone zu machen, könnt ihr beide je 3 Areas aus der Zone erobern und ihr bekommt extra Samen!`,
        description: JSON.stringify({ inviteId: invite?.id }),
        actionUrl: "Friends?tab=news",
        priority: "high",
        displayLocation: "banner",
        createdBy: authId || "system",
      });
      setIsShareDialogOpen(false);
      alert(`Einladung an ${friend.name} gesendet.`);
    } catch (error) {
      alert(error.message || "Die Zoneneinladung konnte nicht gesendet werden.");
    } finally {
      setIsSendingShare(false);
    }
  }, [selectedZoneForDetail, authId, senderDisplayName]);

  // ── Claim area click handler ──────────────────────────────────────────────
  const handleClaimSelect = useCallback(
    ({ areaX, areaY, ownerAuthId }) => {
      const claim = claimedAreas.find(
        (c) => Number(c.areaX) === areaX && Number(c.areaY) === areaY
      );
      if (!claim) return;

      const centerLat = Number(claim.centerLat);
      const centerLng = Number(claim.centerLng);
      if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return;

      const latMpd = 111320;
      const lngMpd = Math.abs(111320 * Math.cos((centerLat * Math.PI) / 180)) || 1e-6;

      const pointsInArea = allDiscoveryPoints.filter((p) => {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
        const dx = Math.abs((p.lng - centerLng) * lngMpd);
        const dy = Math.abs((p.lat - centerLat) * latMpd);
        return dx <= AREA_HALF_SIZE_M && dy <= AREA_HALF_SIZE_M;
      });

      let players = groupPointsByPlayer(pointsInArea, ownerAuthId, plants);

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
    [allDiscoveryPoints, claimedAreas, plants]
  );

  const friendEmailSetLower = useMemo(
    () => new Set((Array.isArray(friendEmails) ? friendEmails : []).map((email) => String(email || "").toLowerCase())),
    [friendEmails]
  );

  const applyPinVisibilityFilter = (points) => {
    if (pinVisibilityMode === "none") return [];
    const isOwnPoint = (p) => String(p?.scannerAuthId || "") === String(authId || "");
    if (pinVisibilityMode === "mine") return points.filter(isOwnPoint);
    // "friends": mine + friends' pins only — strangers never render as map pins,
    // they remain visible via the zone/claim list view (which uses unfiltered allDiscoveryPoints).
    const isFriendPoint = (p) => friendEmailSetLower.has(String(p?.scannerEmail || "").toLowerCase());
    return points.filter((p) => isOwnPoint(p) || isFriendPoint(p));
  };

  const activePinVisibilityMode = PIN_VISIBILITY_MODES.find((mode) => mode.value === pinVisibilityMode) || PIN_VISIBILITY_MODES[0];

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

  const displayedDiscoveryPoints = applyPinVisibilityFilter(nearbyDiscoveryPoints);
  const rerollsRemainingDisplay = Number.isFinite(Number(zoneRerollsRemaining))
    ? Math.max(0, Number(zoneRerollsRemaining))
    : "...";

  // Centers the map on the selected zone's origin area instead of the player's live position.
  const selectedZoneFocusCenter = useMemo(() => {
    const sourceZone = selectedZoneForDetail?.sourceZone;
    const lat = Number(sourceZone?.centerLat ?? sourceZone?.center_lat);
    const lng = Number(sourceZone?.centerLng ?? sourceZone?.center_lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [selectedZoneForDetail]);

  // Same shiny ring used by GoldGradientCard, reused directly on the zone chip/cards below.
  const goldBorderGradient = isLightUi
    ? "linear-gradient(to bottom right, #e8d9a8, #c8ac62, rgba(143,107,34,0.7))"
    : "linear-gradient(to bottom right, #f0e5a5, rgba(200,172,98,0.85), #8f6b22)";

  return (
    <GoldGradientCard
      as="section"
      tinted={false}
      className="relative flex flex-1 min-h-0 flex-col overflow-hidden"
      contentClassName="flex flex-1 min-h-0 flex-col overflow-hidden"
      style={{ clipPath: "inset(0 round 1.5rem)" }}
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
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 overflow-hidden">
            <MapboxZoneMap
              zones={heroZones}
              userLocation={cachedLocation}
              fallbackCenter={{ lat: heroMapCenter[0], lng: heroMapCenter[1] }}
              focusCenter={selectedZoneFocusCenter}
              discoveryPoints={displayedDiscoveryPoints}
              claimedAreas={claimedAreas}
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
          </div>

          <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 z-[1100] ${
            isLightUi
              ? "bg-gradient-to-b from-white/20 to-transparent"
              : "bg-gradient-to-b from-black/60 to-transparent"
          }`} />

          <div className="absolute left-4 right-4 top-4 z-[1200] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                const currentIdx = PIN_VISIBILITY_MODES.findIndex((mode) => mode.value === pinVisibilityMode);
                const nextMode = PIN_VISIBILITY_MODES[(currentIdx + 1) % PIN_VISIBILITY_MODES.length];
                setPinVisibilityMode(nextMode.value);
              }}
              title="Sichtbarkeit fremder Pins umschalten"
              className={`h-8 px-3 rounded-xl border flex items-center gap-1.5 text-[11px] md:text-xs font-semibold whitespace-nowrap transition-colors ${
                isLightUi
                  ? "border-[#c8ac62]/55 bg-white/90 text-stone-800 hover:bg-white"
                  : "border-[#f0e5a5]/45 bg-black/72 text-stone-100 hover:bg-black/85"
              }`}
            >
              {activePinVisibilityMode.icon}
              {activePinVisibilityMode.label}
            </button>

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
              Neu ({rerollsRemainingDisplay})
            </button>

            <button
              type="button"
              onClick={handleOpenMoreInfoForSelectedZone}
              disabled={!selectedZoneForDetail}
              aria-label="Mehr Infos zur ausgewählten Zone"
              title="Mehr Infos zur ausgewählten Zone"
              className={`flex h-8 w-8 items-center justify-center rounded-xl border text-[11px] md:text-xs font-semibold transition-colors ${
                selectedZoneForDetail
                  ? isLightUi
                    ? "border-[#c8ac62]/55 bg-white/90 text-stone-800 hover:bg-white"
                    : "border-[#f0e5a5]/45 bg-black/72 text-stone-100 hover:bg-black/85"
                  : isLightUi
                    ? "border-[#c8ac62]/35 bg-white/70 text-stone-400"
                    : "border-[#f0e5a5]/25 bg-black/55 text-stone-500"
              } ${selectedZoneForDetail ? "" : "cursor-not-allowed opacity-60"}`}
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
          </div>

          {(zoneMapError || areaClaimError) && (
            <div className={`absolute left-4 right-4 top-16 z-[1200] rounded-xl border px-3 py-2 text-[11px] md:text-xs font-medium ${
              isLightUi
                ? "border-red-400/40 bg-red-100/90 text-red-800"
                : "border-red-300/50 bg-red-950/80 text-red-100"
            }`}>
              {zoneMapError || `Area-Claims konnten nicht geladen werden: ${areaClaimError}`}
            </div>
          )}

          {/* Floating cards over the full-bleed map - padding here stays transparent so the map keeps rendering underneath. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1300]">
            {!pinOverlayData && selectedZoneForDetail && (
              <ZoneDetailSheet
                zone={selectedZoneForDetail}
                isLightUi={isLightUi}
                onClose={() => setSelectedZoneForDetail(null)}
                onOpenScans={handleOpenScansForSelectedZone}
                onShare={() => setIsShareDialogOpen(true)}
              />
            )}

            {!pinOverlayData && !selectedZoneForDetail && (
              <div className="pointer-events-auto px-3 pb-3 pt-2">
                <GoldGradientCard tinted={false} contentClassName="relative overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-3xl backdrop-blur-2xl backdrop-saturate-150"
                    style={{ background: "rgba(24,24,28,0.5)", boxShadow: "inset 0 2px 22px rgba(0,0,0,0.6)" }}
                  />
                  <div className="relative px-4 py-2.5 text-stone-100 sm:px-5 sm:py-3">
                    <div className="flex items-center justify-between gap-3 pb-2.5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-lime-200">
                          Umgebungskarte
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsZoneOverviewExpanded((prev) => !prev)}
                        aria-pressed={isZoneOverviewExpanded}
                        className="relative rounded-full border border-transparent bg-black/35 px-3 py-1 text-[11px] font-semibold text-stone-200 transition-colors hover:bg-black/55"
                      >
                        {zoneListItems.length} Zonen
                        <span aria-hidden="true" className="gold-gradient-border-mask-thin" style={{ background: goldBorderGradient }} />
                      </button>
                    </div>

                    <div className="pr-1">
                      {zoneListItems.length === 0 ? (
                        <div className="rounded-[1.15rem] border border-[#f0e5a5]/12 bg-black/25 px-4 py-3 text-sm text-stone-400">
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
                                  <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center ${theme.iconClass || "text-stone-200"}`}>
                                    {theme.icon ? <theme.icon className="h-3.5 w-3.5" /> : null}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-300">
                                    {theme.label}
                                  </span>
                                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-stone-200">
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
                              onClick={() => setSelectedZoneForDetail(zone)}
                              className={`relative w-32 shrink-0 snap-start rounded-[1.15rem] border border-transparent px-3 py-2.5 text-left transition-transform duration-150 hover:-translate-y-0.5 ${
                                zone.isActive ? "bg-emerald-500/10" : "bg-black/25"
                              }`}
                            >
                              <span aria-hidden="true" className="gold-gradient-border-mask" style={{ background: goldBorderGradient }} />
                              <div className="flex min-w-0 items-start gap-2">
                                <span className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center ${zone.themeIconClass || "text-stone-200"}`}>
                                  {zone.themeIcon ? <zone.themeIcon className="h-3.5 w-3.5" /> : null}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                                    {zone.themeLabel}
                                  </div>
                                  <div className="mt-0.5 w-full text-right text-[9px] font-semibold uppercase tracking-[0.14em] tabular-nums text-stone-300">
                                    {zone.distanceLabel}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-2 grid gap-1.5">
                                <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
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
                                          ? "border-emerald-300/30 bg-emerald-400/85"
                                          : "border-[#f0e5a5]/12 bg-black/25"
                                        }`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="mt-2 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                                <span>Multiplikator</span>
                                <span className="tabular-nums text-stone-200">
                                  x {zone.zoneMultiplier.toFixed(1).replace(".", ",")}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </GoldGradientCard>
              </div>
            )}
          </div>
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
        currentUserId={authId || null}
        isLightUi={isLightUi}
      />

      <ZoneInfoDialog
        open={isZoneInfoOpen}
        isLightUi={isLightUi}
        targetPlants={selectedZoneForDetail?.targetPlants || []}
        onClose={() => setIsZoneInfoOpen(false)}
      />

      {isShareDialogOpen && selectedZoneForDetail && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/60 px-4" onClick={() => setIsShareDialogOpen(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border p-4 shadow-2xl ${isLightUi ? "border-stone-200 bg-white text-stone-900" : "border-[#f0e5a5]/30 bg-[#1b1914] text-stone-100"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Zone teilen</h3>
              <button type="button" onClick={() => setIsShareDialogOpen(false)} aria-label="Schließen">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className={`mb-4 text-sm ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
              Wähle einen befreundeten Spieler für {selectedZoneForDetail.title}.
            </p>
            <div className="grid gap-2">
              {(friendOptions.filter((friend) => !preselectedFriendAuthId || friend.authId === preselectedFriendAuthId).length === 0) ? (
                <p className="text-sm text-stone-400">Du hast noch keine geeigneten Freunde.</p>
              ) : friendOptions.filter((friend) => !preselectedFriendAuthId || friend.authId === preselectedFriendAuthId).map((friend) => (
                <button
                  key={friend.authId}
                  type="button"
                  disabled={isSendingShare}
                  onClick={() => handleShareSelectedZone(friend)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${isLightUi ? "border-stone-200 hover:bg-stone-50" : "border-[#f0e5a5]/20 hover:bg-white/10"}`}
                >
                  <span>{friend.name}</span>
                  <span className="text-xs text-emerald-400">Teilen</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </GoldGradientCard>
  );
}