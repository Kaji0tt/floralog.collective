import React, { useEffect, useMemo, useState } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";
import { parseDiscoveryCoordinates } from "@/lib/discoveryMap";
import { AlertCircle, Loader2, MapPin, Navigation } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";

const DEFAULT_CENTER = { lat: 51.1657, lng: 10.4515 };

export default function Map() {
  const [user, setUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapError, setMapError] = useState(null);

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

  const discoveryPoints = useMemo(
    () => allDiscoveries.map((entry) => parseDiscoveryCoordinates(entry?.discovery_location)).filter(Boolean),
    [allDiscoveries]
  );

  const mapCenter = userLocation || DEFAULT_CENTER;
  const title = user?.display_name || user?.full_name || "Floralog Karte";

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setMapError("Geolocation wird von diesem Browser nicht unterstuetzt.");
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setMapError(null);
        setGettingLocation(false);
      },
      (error) => {
        setMapError(error?.message || "Standort konnte nicht geladen werden.");
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 60000,
      }
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.14),_transparent_38%),linear-gradient(180deg,_#122015_0%,_#0a120d_100%)] text-stone-100">
      <div className="relative min-h-screen overflow-hidden px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-[#d7cf9c]/35 bg-black/25 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="border-b border-[#f0e5a5]/20 bg-black/20 px-5 py-4 md:px-6 md:py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.22em] text-lime-300/80">Mapbox</p>
                <h1 className="text-2xl font-semibold text-stone-100">{title}</h1>
                <p className="text-sm text-stone-300">Aktuelle Entdeckungen werden als Mapbox-Punkte gerendert. Die Kartenansicht nutzt jetzt nur noch die gemeinsame Mapbox-Komponente.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl border border-[#f0e5a5]/25 bg-black/25 px-3 py-2 text-xs font-medium text-stone-200">
                  Funde: {discoveryPoints.length}
                </div>
                <Button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  className="rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 text-white hover:brightness-110"
                >
                  {gettingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                  Standort zentrieren
                </Button>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-[70vh]">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <div className="flex items-center gap-3 rounded-2xl border border-[#f0e5a5]/25 bg-black/35 px-4 py-3 text-sm text-stone-200">
                  <Loader2 className="h-5 w-5 animate-spin text-lime-300" />
                  Karte wird geladen...
                </div>
              </div>
            ) : (
              <MapboxZoneMap
                zones={[]}
                userLocation={userLocation}
                fallbackCenter={mapCenter}
                discoveryPoints={discoveryPoints}
                onTokenError={setMapError}
                className="h-full w-full"
              />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />

            <div className="absolute left-4 top-4 z-[1200] flex flex-col gap-2 md:left-6 md:top-6">
              <div className="rounded-xl border border-[#f0e5a5]/30 bg-black/55 px-3 py-2 text-xs font-semibold text-stone-100 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-lime-300" />
                  <span>Zentrum: {userLocation ? "Dein Standort" : "Deutschland"}</span>
                </div>
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
