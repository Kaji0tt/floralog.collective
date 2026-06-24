import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery } from "@tanstack/react-query";
import { getTileClaims } from "@/api/tileClaimService";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";
import { parseDiscoveryCoordinates } from "@/lib/discoveryMap";
import { cacheLocation, getCachedLocation, requestCurrentLocation } from "@/lib/locationSync";
import { getRobotPlantDailyZones } from "@/api/robotPlantService";
import { useAuth } from "@/lib/AuthContext";
import { AlertCircle, ChevronDown, Loader2, Navigation, RefreshCw } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";

const AnyMapboxZoneMap = /** @type {any} */ (MapboxZoneMap);

export default function Map() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);

  const urlLat = parseFloat(searchParams.get("lat") ?? "");
  const urlLng = parseFloat(searchParams.get("lng") ?? "");
  const urlCenter = Number.isFinite(urlLat) && Number.isFinite(urlLng) ? { lat: urlLat, lng: urlLng } : null;

  const [userLocation, setUserLocation] = useState({ lat: null, lng: null });
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapError, setMapError] = useState("");
  const [locationReady, setLocationReady] = useState(false);
  const [claimsCenterLat, setClaimsCenterLat] = useState(null);
  const [claimsCenterLng, setClaimsCenterLng] = useState(null);
  const [mapTimeFilter, setMapTimeFilter] = useState("all-time");
  const [heroZones, setHeroZones] = useState([]);
  const [zoneRerollsRemaining, setZoneRerollsRemaining] = useState(null);
  const [isLoadingZone, setIsLoadingZone] = useState(false);
  const [isRegeneratingZones, setIsRegeneratingZones] = useState(false);

  const SOMMER_2026_CUTOFF = "2026-06-21";
  const todayKey = new Date().toISOString().slice(0, 10);
  const getDailyZoneStorageKey = (uid) => `robotPlantDailyZones:${uid}:${todayKey}`;

  const persistDailyZoneSnapshot = (uid, zones, rerollsRemainingToday) => {
    if (!uid) return;
    localStorage.setItem(
      getDailyZoneStorageKey(uid),
      JSON.stringify({ zones: Array.isArray(zones) ? zones : [], rerollsRemainingToday: rerollsRemainingToday ?? null }),
    );
  };

  const readDailyZoneSnapshot = (uid) => {
    if (!uid) return null;
    try {
      const raw = localStorage.getItem(getDailyZoneStorageKey(uid));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.zones)) return null;
      return { zones: parsed.zones, rerollsRemainingToday: parsed.rerollsRemainingToday ?? null };
    } catch {
      return null;
    }
  };

  const { zoneGenerationDay, hasCalledZoneGenerationToday, setZoneGenerationDayForUser } = useAuth();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };

    loadUser();
  }, []);

  const { data: allDiscoveries = [], isLoading } = useQuery({
    queryKey: ["mapDiscoveries"],
    queryFn: () => Query.UserPlantDiscovery.list("-created_date", 500),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const filteredDiscoveries = useMemo(() => {
    if (mapTimeFilter === "all-time") return allDiscoveries;
    if (mapTimeFilter === "sommer2026") {
      return allDiscoveries.filter((d) => {
        const date = d.created_date || d.discovered_date;
        return date && date >= SOMMER_2026_CUTOFF;
      });
    }
    // legacy: scans before 21.06.2026
    return allDiscoveries.filter((d) => {
      const date = d.created_date || d.discovered_date;
      return !date || date < SOMMER_2026_CUTOFF;
    });
  }, [allDiscoveries, mapTimeFilter, SOMMER_2026_CUTOFF]);

  const discoveryPoints = useMemo(
    () => filteredDiscoveries.map((entry) => parseDiscoveryCoordinates(entry?.discovery_location)).filter(Boolean),
    [filteredDiscoveries]
  );

  const { data: claimedTiles = [], error: tileClaimsError, isLoading: isTileClaimsLoading } = useQuery({
    queryKey: ["tileClaims", claimsCenterLat, claimsCenterLng],
    queryFn: () =>
      getTileClaims({
        latitude: claimsCenterLat,
        longitude: claimsCenterLng,
        radiusM: 1500,
      }),
    enabled:
      locationReady &&
      Number.isFinite(claimsCenterLat) &&
      Number.isFinite(claimsCenterLng),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const liveLat = Number(userLocation?.lat);
  const liveLng = Number(userLocation?.lng);
  const hasUserLocation = Number.isFinite(liveLat) && Number.isFinite(liveLng);
  const mapCenter = hasUserLocation ? { lat: liveLat, lng: liveLng } : null;

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      setMapError("Geolocation wird von diesem Browser nicht unterstuetzt.");
      setLocationReady(false);
      return;
    }

    setGettingLocation(true);
    try {
      const location = await requestCurrentLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
        throw new Error("Standort konnte nicht geladen werden.");
      }

      cacheLocation(location);

      setUserLocation({
        lat: location.lat,
        lng: location.lng,
      });
      setClaimsCenterLat(location.lat);
      setClaimsCenterLng(location.lng);
      setMapError("");
      setLocationReady(true);
    } catch (caughtError) {
      const deniedByUser =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "code" in caughtError &&
        Number(caughtError.code) === 1;
      const fallbackMessage = "Standort konnte nicht geladen werden.";
      const explicitMessage =
        caughtError instanceof Error
          ? caughtError.message
          : (typeof caughtError === "object" && caughtError !== null && "message" in caughtError
              ? String(caughtError.message)
              : fallbackMessage);
      setMapError(
        deniedByUser
          ? "Standortfreigabe verweigert. Ohne Live-Standort kann die Karte nicht geladen werden."
          : (explicitMessage || fallbackMessage)
      );
      setLocationReady(false);
    } finally {
      setGettingLocation(false);
    }
  };

  useEffect(() => {
    handleGetLocation();
  }, []);

  // Zone loading
  useEffect(() => {
    let isCancelled = false;
    if (!user?.id) return;

    const loadZones = async () => {
      // Try cached snapshot first
      if (hasCalledZoneGenerationToday) {
        const snapshot = readDailyZoneSnapshot(user.id);
        if (snapshot) {
          if (!isCancelled) {
            setHeroZones(snapshot.zones);
            if (snapshot.rerollsRemainingToday !== null) setZoneRerollsRemaining(snapshot.rerollsRemainingToday);
          }
          return;
        }
      }

      // Wait for location before calling the API
      const location = getCachedLocation({ maxAgeMs: 5 * 60 * 1000 }) ||
        (userLocation?.lat && userLocation?.lng ? { lat: userLocation.lat, lng: userLocation.lng } : null);
      if (!location) return;

      if (!isCancelled) setIsLoadingZone(true);
      try {
        const authDayKeyForRequest = zoneGenerationDay || todayKey;
        const daily = await getRobotPlantDailyZones({
          latitude: location.lat,
          longitude: location.lng,
          authDayKey: authDayKeyForRequest,
          mode: "initial",
        });
        if (isCancelled) return;
        setZoneGenerationDayForUser(todayKey);
        persistDailyZoneSnapshot(user.id, daily?.zones || [], daily?.rerollsRemainingToday ?? null);
        setHeroZones(daily?.zones || []);
        if (daily?.rerollsRemainingToday != null) setZoneRerollsRemaining(daily.rerollsRemainingToday);
      } catch (err) {
        if (!isCancelled) console.warn("[Map] Zone load failed:", err?.message);
      } finally {
        if (!isCancelled) setIsLoadingZone(false);
      }
    };

    loadZones();
    return () => { isCancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, locationReady, hasCalledZoneGenerationToday]);

  const handleRegenerateZones = async () => {
    if (isRegeneratingZones || !user?.id || !hasCalledZoneGenerationToday) return;
    setIsRegeneratingZones(true);
    try {
      const location = await requestCurrentLocation({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) throw new Error("Standort fehlt.");
      cacheLocation(location);
      const authDayKeyForRequest = zoneGenerationDay || todayKey;
      const daily = await getRobotPlantDailyZones({
        latitude: location.lat,
        longitude: location.lng,
        forceRegenerate: true,
        authDayKey: authDayKeyForRequest,
        mode: "reroll",
      });
      setZoneGenerationDayForUser(todayKey);
      persistDailyZoneSnapshot(user.id, daily?.zones || [], daily?.rerollsRemainingToday ?? null);
      setHeroZones(daily?.zones || []);
      if (daily?.rerollsRemainingToday != null) setZoneRerollsRemaining(daily.rerollsRemainingToday);
    } catch (err) {
      console.warn("[Map] Reroll failed:", err?.message);
      const nextRemaining = Number.isFinite(Number(err?.rerollsRemainingToday))
        ? Math.max(0, Number(err.rerollsRemainingToday))
        : (err?.rateLimited ? 0 : null);
      if (nextRemaining !== null) {
        setZoneRerollsRemaining(nextRemaining);
        persistDailyZoneSnapshot(user.id, heroZones, nextRemaining);
      }
    } finally {
      setIsRegeneratingZones(false);
    }
  };

  const canReroll = hasCalledZoneGenerationToday && !isLoadingZone && zoneRerollsRemaining !== 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.14),_transparent_38%),linear-gradient(180deg,_#122015_0%,_#0a120d_100%)] text-stone-100">
      <div className="relative min-h-screen overflow-hidden px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[#d7cf9c]/35 bg-black/25 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="relative min-h-[calc(100vh-2rem)]">
            {gettingLocation ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <div className="flex items-center gap-3 rounded-2xl border border-[#f0e5a5]/25 bg-black/35 px-4 py-3 text-sm text-stone-200">
                  <Loader2 className="h-5 w-5 animate-spin text-lime-300" />
                  Live-Standort wird abgefragt...
                </div>
              </div>
            ) : !locationReady ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 px-4">
                <div className="max-w-md rounded-2xl border border-red-300/35 bg-red-950/45 p-5 text-center text-red-50 backdrop-blur-sm">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-red-200/40 bg-red-900/45">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <h2 className="mb-2 text-base font-semibold">Karte nicht verfuegbar</h2>
                  <p className="mb-4 text-sm text-red-100/95">
                    {mapError || "Ohne Live-Standort kann die Karte nicht geladen werden."}
                  </p>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={gettingLocation}
                    className="rounded-xl border border-red-200/35 bg-red-700/80 text-white hover:brightness-110"
                  >
                    {gettingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                    Standort erneut anfragen
                  </button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <div className="flex items-center gap-3 rounded-2xl border border-[#f0e5a5]/25 bg-black/35 px-4 py-3 text-sm text-stone-200">
                  <Loader2 className="h-5 w-5 animate-spin text-lime-300" />
                  Karte wird geladen...
                </div>
              </div>
            ) : (
              <AnyMapboxZoneMap
                zones={heroZones}
                userLocation={hasUserLocation ? mapCenter : null}
                fallbackCenter={mapCenter}
                discoveryPoints={discoveryPoints}
                claimedTiles={claimedTiles}
                currentAuthId={user?.id || null}
                className="h-full w-full"
              />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />

            <div className="absolute left-4 top-4 z-[1200] flex flex-col gap-2 md:left-6 md:top-6">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={mapTimeFilter}
                    onChange={(e) => setMapTimeFilter(e.target.value)}
                    className="appearance-none cursor-pointer rounded-xl border border-[#f0e5a5]/30 bg-black/55 py-2 pl-3 pr-8 text-xs font-semibold text-stone-100 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-lime-300/50"
                  >
                    <option value="all-time">All Time</option>
                    <option value="sommer2026">Sommer 2026</option>
                    <option value="legacy">Legacy</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-300" />
                </div>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  className="flex items-center justify-center rounded-xl border border-[#f0e5a5]/30 bg-black/55 p-2 text-stone-100 backdrop-blur-sm hover:bg-black/70 disabled:opacity-60"
                  title="Standort zentrieren"
                >
                  {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateZones}
                  disabled={!canReroll || isRegeneratingZones}
                  className="relative flex items-center gap-1.5 rounded-xl border border-[#f0e5a5]/30 bg-black/55 py-2 pl-2.5 pr-3 text-xs font-semibold text-stone-100 backdrop-blur-sm hover:bg-black/70 disabled:opacity-50"
                  title="Zonen neu würfeln"
                >
                  {isRegeneratingZones
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                  <span>Neu</span>
                  {zoneRerollsRemaining !== null && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#f0e5a5]/50 bg-emerald-700/90 px-1 text-[10px] font-bold text-white">
                      {zoneRerollsRemaining}
                    </span>
                  )}
                </button>
              </div>

              {mapError && (
                <div className="max-w-sm rounded-xl border border-red-300/40 bg-red-950/65 px-3 py-2 text-xs text-red-100 backdrop-blur-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{mapError}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <MobileBackButton />
      </div>
    </div>
  );
}
