import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import HomeBackgroundShell from "@/components/home/HomeBackgroundShell";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  calculateDistanceMetersRaw,
  NEARBY_DISCOVERY_RADIUS_METERS,
  parseDiscoveryCoordinates,
} from "@/lib/discoveryMap";

const GUEST_SECTION_COUNT = 5;
const GUEST_ROBOT_PLANT_IMAGE_URL = new URL("../../../UserPlant1.png", import.meta.url).href;

const seededRandom = (seed) => {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
};

const buildGuestPreviewZones = (latitude, longitude) => {
  const themes = ["forest", "urban", "water", "meadow"];
  const daySeed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));

  return themes.map((theme, index) => {
    const baseSeed = daySeed + index * 97 + Math.round(latitude * 1000) + Math.round(longitude * 1000);
    const distanceM = 180 + Math.round(seededRandom(baseSeed) * 340);
    const bearing = seededRandom(baseSeed + 11) * Math.PI * 2;
    const radiusM = 90 + Math.round(seededRandom(baseSeed + 29) * 180);
    const latOffset = (distanceM * Math.cos(bearing)) / 111320;
    const lngOffset = (distanceM * Math.sin(bearing)) / (111320 * Math.cos((latitude * Math.PI) / 180));

    return {
      id: `guest-zone-${index}`,
      zoneKey: `guest-zone-${index}`,
      theme,
      radiusM,
      centerLat: latitude + latOffset,
      centerLng: longitude + lngOffset,
      zone_bonus_multiplier: 1.5,
    };
  });
};

export default function GuestHomeFlow({ allDiscoveries = [], publicCollections = [] }) {
  const navigate = useNavigate();
  const guestScrollRef = useRef(null);
  const [, setGuestSectionIndex] = useState(0);
  const [guestZones, setGuestZones] = useState([]);
  const [guestLocation, setGuestLocation] = useState(null);
  const [isGeneratingGuestZones, setIsGeneratingGuestZones] = useState(false);
  const [guestZoneError, setGuestZoneError] = useState(null);
  const [showGuestZoneMap, setShowGuestZoneMap] = useState(false);
  const [showGuestVisionDialog, setShowGuestVisionDialog] = useState(false);
  const [showGuestGrowDialog, setShowGuestGrowDialog] = useState(false);

  const activeCollectorsThisWeek = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Set(
      allDiscoveries
        .filter((entry) => {
          const rawDate = entry?.created_date || entry?.discovered_date || entry?.updated_date;
          if (!rawDate) return false;
          const timestamp = new Date(rawDate).getTime();
          return Number.isFinite(timestamp) && timestamp >= sevenDaysAgo;
        })
        .map((entry) => entry?.auth_id || entry?.created_by_id || entry?.user || entry?.created_by)
        .filter(Boolean)
    ).size;
  }, [allDiscoveries]);

  const discoveredSpeciesCountTotal = useMemo(
    () => new Set(allDiscoveries.map((entry) => entry?.plant_id).filter(Boolean)).size,
    [allDiscoveries]
  );

  const totalScanCount = allDiscoveries.length;
  const latestCollections = publicCollections.slice(0, 2);

  const guestNearbyDiscoveryPoints = useMemo(() => {
    if (!guestLocation) return [];

    return allDiscoveries
    .map((entry) => {
        const coords = parseDiscoveryCoordinates(entry?.discovery_location);
        if (!coords) return null;

        return {
          lat: coords.lat,
          lng: coords.lng,
          discoveryId: entry?.id || null,
          imageUrl: entry?.image_url || "",
          scannerName: entry?.user || entry?.created_by || "Unbekannt",
          discoveredAt: entry?.created_date || entry?.discovered_date || entry?.updated_date || null,
        };
      })
      .filter(Boolean)
      .filter((point) => {
        const distanceM = calculateDistanceMetersRaw(
          guestLocation.lat,
          guestLocation.lng,
          point.lat,
          point.lng
        );
        return Number.isFinite(distanceM) && distanceM <= NEARBY_DISCOVERY_RADIUS_METERS;
      });
  }, [allDiscoveries, guestLocation]);

  const handleGuestScroll = (event) => {
    const container = event.currentTarget;
    if (!container || container.clientHeight <= 0) return;
    const nextIndex = Math.round(container.scrollTop / container.clientHeight);
    setGuestSectionIndex(Math.max(0, Math.min(GUEST_SECTION_COUNT - 1, nextIndex)));
  };

  const requestGuestLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation wird von diesem Browser nicht unterstuetzt."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => reject(error),
        {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 60000,
        }
      );
    });
  };

  const handleGuestGenerateZones = async () => {
    if (isGeneratingGuestZones) return null;

    setIsGeneratingGuestZones(true);
    setGuestZoneError(null);
    try {
      const nextLocation = await requestGuestLocation();
      setGuestLocation(nextLocation);
      setGuestZones(buildGuestPreviewZones(nextLocation.lat, nextLocation.lng));
      return nextLocation;
    } catch (error) {
      const message = error?.message || "Standort konnte nicht geladen werden.";
      setGuestZoneError(message);
      return null;
    } finally {
      setIsGeneratingGuestZones(false);
    }
  };

  const handleGuestExploreZones = async () => {
    let locationForMap = guestLocation;
    if (!locationForMap) {
      locationForMap = await handleGuestGenerateZones();
    }

    if (locationForMap) {
      setShowGuestZoneMap(true);
    }
  };

  return (
    <HomeBackgroundShell user={null} isLightUi={false} getRgbaFromRgb={() => null}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        data-ui="home-main-content-shell-guest"
        className="relative h-full w-full max-w-md md:max-w-3xl rounded-[2rem] overflow-hidden border border-[#d7cf9c]/65 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(126,171,98,0.45)_0%,rgba(10,22,15,0.78)_100%)]" />
        <div className="absolute inset-0 pointer-events-none rounded-[2rem] border border-[#f0e5a5]/30" />

        <div className="relative z-10 h-full flex flex-col px-4 md:px-8 py-4 md:py-6 text-stone-100">
          <div className="rounded-2xl border border-[#f0e5a5]/30 bg-black/25 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-lime-200/80">Floralog</p>
            <h1 className="text-lg font-semibold text-stone-100">Dein Naturbegleiter.</h1>
          </div>

          {showGuestZoneMap ? (
            <section className="mt-3 relative flex-1 min-h-0 rounded-3xl border overflow-hidden border-[#f0e5a5]/25 bg-black/25 backdrop-blur-sm">
              <MapboxZoneMap
                zones={guestZones}
                userLocation={guestLocation}
                fallbackCenter={guestLocation ? { lat: guestLocation.lat, lng: guestLocation.lng } : { lat: 51.1657, lng: 10.4515 }}
                discoveryPoints={guestNearbyDiscoveryPoints}
                onTokenError={setGuestZoneError}
              />

              <div className="absolute left-4 top-4 z-[1200] rounded-xl border border-[#f0e5a5]/35 bg-black/55 px-3 py-1.5 text-[11px] md:text-xs font-semibold text-stone-100">
                Funde im Umkreis (2km): {guestNearbyDiscoveryPoints.length}
              </div>

              {guestZoneError && (
                <div className="absolute left-4 right-4 top-16 z-[1200] rounded-xl border border-red-300/50 bg-red-900/55 px-3 py-2 text-[11px] md:text-xs font-medium text-red-100">
                  {guestZoneError}
                </div>
              )}

              <div className="absolute left-4 right-4 bottom-4 z-[1200] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuestZoneMap(false)}
                  className="h-10 px-3 rounded-xl border border-[#f0e5a5]/45 bg-black/55 text-stone-100 hover:bg-black/70 transition-colors flex items-center gap-2 text-xs md:text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Zurueck
                </button>
              </div>
            </section>
          ) : (
            <div
              ref={guestScrollRef}
              onScroll={handleGuestScroll}
              className="relative flex flex-1 min-h-0 flex-col overflow-y-auto snap-y snap-mandatory scroll-smooth mt-3 rounded-3xl border border-[#f0e5a5]/25 bg-black/20 backdrop-blur-sm"
              data-ui="home-content-stack"
            >
              <section className="relative h-full min-h-full snap-start p-5 md:p-7 flex flex-col justify-between gap-5 overflow-y-auto pr-2">
                <div className="space-y-4">
                  <p className="text-xs md:text-sm uppercase tracking-[0.18em] text-amber-200/75">Einstieg</p>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight text-stone-100">Natur neu entdecken.</h2>
                  <p className="text-sm md:text-base text-stone-200/90 max-w-xl">
                    Scanne Pflanzen in deiner Umgebung. Entdecke Schaetze im Alltag und zuechte dir einen eigenen Natur-Begleiter.
                  </p>
                  <div className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-900/35 px-3 py-1.5 text-xs md:text-sm text-emerald-100">
                    Starte jetzt - halte deinen ersten Fund fest.
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => navigate("/register")}
                    className="w-full rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 py-3 font-semibold text-white hover:brightness-110"
                  >
                    Kostenlos starten
                  </button>
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full rounded-xl border border-[#f0e5a5]/35 bg-black/35 py-3 font-semibold text-stone-100 hover:bg-black/50"
                  >
                    Anmelden
                  </button>
                </div>
              </section>

              <section className="relative h-full min-h-full snap-start p-5 md:p-7 flex flex-col gap-4 overflow-y-auto pr-2">
                <p className="text-xs md:text-sm uppercase tracking-[0.18em] text-amber-200/75">Core Loop</p>
                <h3 className="text-2xl md:text-3xl font-bold text-stone-100">Jede Entdeckung laesst deine Pflanze wachsen.</h3>
                <p className="text-sm md:text-base text-stone-200/90">
                  Scanne Pflanzen in deiner Umgebung und verwandle die Natur in Fortschritt. Deine Robopflanze entwickelt sich mit jedem Fund weiter. Und wer weiss - vielleicht wartet hinter der ein oder anderen Pflanze ja ein wahrer Schatz.
                </p>

                <div className="rounded-2xl border border-[#f0e5a5]/30 bg-black/30 p-4 flex items-center justify-center min-h-[220px]">
                  <img src={GUEST_ROBOT_PLANT_IMAGE_URL} alt="Robo-Pflanze" className="max-h-60 w-auto object-contain drop-shadow-[0_0_24px_rgba(190,242,100,0.45)]" />
                </div>

                {guestZoneError && (
                  <div className="rounded-xl border border-red-300/45 bg-red-900/40 px-3 py-2 text-xs md:text-sm text-red-100">
                    {guestZoneError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigate("/Scanner")} className="rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 py-3 font-semibold text-white hover:brightness-110">
                    Scan testen
                  </button>
                  <button type="button" onClick={handleGuestExploreZones} disabled={isGeneratingGuestZones} className="rounded-xl border border-[#f0e5a5]/35 bg-black/35 py-3 font-semibold text-stone-100 disabled:opacity-60 hover:bg-black/50">
                    {isGeneratingGuestZones ? "Lade Zone..." : "Zone erkunden"}
                  </button>
                </div>
              </section>

              <section className="relative h-full min-h-full snap-start p-5 md:p-7 flex flex-col justify-between gap-4 overflow-y-auto pr-2">
                <div className="space-y-4">
                  <p className="text-xs md:text-sm uppercase tracking-[0.18em] text-amber-200/75">Vision</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-stone-100">Die Natur aus den Augen verloren?</h3>
                  <p className="text-sm md:text-base text-stone-200/90">
                    Die Natur ist uns wichtig. Aber wir schauen mehr auf Bildschirme als ins Gruen. Im Alltag uebersehen wir viele kleine Schaetze, ohne es zu wissen. Spielerisch nutzt Floralog die Faszination des Bildschirms, um den Blick fuer das Alltaegliche in Heimat und Natur wieder zu schaerfen.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button onClick={() => setShowGuestVisionDialog(true)} className="rounded-xl border border-[#f0e5a5]/35 bg-black/35 py-3 font-semibold text-stone-100 hover:bg-black/50">
                    Erfahre mehr zur Vision
                  </button>
                  <button onClick={() => setShowGuestGrowDialog(true)} className="rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 py-3 font-semibold text-white hover:brightness-110">
                    Hilf Floralog beim Wachsen
                  </button>
                </div>
              </section>

              <section className="relative h-full min-h-full snap-start p-5 md:p-7 flex flex-col gap-4 overflow-y-auto pr-2">
                <p className="text-xs md:text-sm uppercase tracking-[0.18em] text-amber-200/75">Community</p>
                <h3 className="text-2xl md:text-3xl font-bold text-stone-100">Werde Teil der ersten Entdecker</h3>
                <p className="text-sm md:text-base text-stone-200/90">Floralog steht am Anfang - und genau jetzt kannst du mitgestalten, was daraus wird.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-[#f0e5a5]/30 bg-black/35 px-4 py-4">
                    <div className="text-xs uppercase tracking-wide text-stone-300">Entdecker diese Woche</div>
                    <div className="text-3xl font-bold text-lime-200 mt-1">{activeCollectorsThisWeek}</div>
                  </div>
                  <div className="rounded-2xl border border-[#f0e5a5]/30 bg-black/35 px-4 py-4">
                    <div className="text-xs uppercase tracking-wide text-stone-300">Gefundene Pflanzen</div>
                    <div className="text-3xl font-bold text-emerald-200 mt-1">{discoveredSpeciesCountTotal}</div>
                  </div>
                  <div className="rounded-2xl border border-[#f0e5a5]/30 bg-black/35 px-4 py-4">
                    <div className="text-xs uppercase tracking-wide text-stone-300">Scans insgesamt</div>
                    <div className="text-3xl font-bold text-amber-200 mt-1">{totalScanCount}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#f0e5a5]/30 bg-black/35 p-4 space-y-3">
                  <h4 className="text-lg font-semibold text-stone-100">Was andere gerade entdecken</h4>
                  <div className="grid gap-2">
                    {latestCollections.length === 0 ? (
                      <>
                        <div className="rounded-xl border border-[#f0e5a5]/30 bg-black/25 px-3 py-2 font-semibold text-stone-100">Achtung Giftig 🌿</div>
                        <div className="rounded-xl border border-[#f0e5a5]/30 bg-black/25 px-3 py-2 font-semibold text-stone-100">Gesunde Kueche 🥗</div>
                      </>
                    ) : (
                      latestCollections.map((collection, index) => (
                        <button
                          key={collection.id}
                          type="button"
                          onClick={() => navigate(`${createPageUrl("Collection")}?collectionId=${collection.id}`)}
                          className="w-full text-left rounded-xl border border-[#f0e5a5]/30 bg-black/25 px-3 py-2 hover:bg-black/45"
                        >
                          <div className="font-semibold text-stone-100">{collection.title || (index === 0 ? "Achtung Giftig 🌿" : "Gesunde Kueche 🥗")}</div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="text-xs text-stone-300">Lass dich inspirieren oder starte deine eigene Sammlung.</div>
                </div>
              </section>

              <section className="relative h-full min-h-full snap-start p-5 md:p-7 flex flex-col justify-between gap-5 overflow-y-auto pr-2">
                <div className="space-y-4">
                  <p className="text-xs md:text-sm uppercase tracking-[0.18em] text-amber-200/75">Call to Action</p>
                  <h3 className="text-3xl md:text-4xl font-bold text-stone-100 leading-tight">Mach deinen naechsten Spaziergang zur Entdeckung</h3>
                  <p className="text-sm md:text-base text-stone-200/90">Teste den Scan direkt. Wenn du weitermachen willst, speichere deine Funde und lass deine Pflanze wachsen.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button onClick={() => navigate("/Scanner")} className="rounded-xl border border-[#f0e5a5]/35 bg-black/35 py-3 font-semibold text-stone-100 hover:bg-black/50">Scan testen</button>
                  <button onClick={() => navigate("/register")} className="rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 py-3 font-semibold text-white hover:brightness-110">Kostenlos registrieren</button>
                  <button onClick={() => navigate("/login")} className="rounded-xl border border-[#f0e5a5]/35 bg-black/35 py-3 font-semibold text-stone-100 hover:bg-black/50">Anmelden</button>
                </div>
              </section>
            </div>
          )}
        </div>

        <Dialog open={showGuestGrowDialog} onOpenChange={setShowGuestGrowDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[82vh] overflow-y-auto rounded-3xl border border-lime-200/35 bg-black/40 backdrop-blur-xl text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-emerald-950/20 to-black/45 pointer-events-none" />
            <div className="absolute inset-0 border border-lime-200/25 rounded-3xl pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <DialogHeader>
                <DialogTitle className="text-lime-300">Hilf Floralog beim Wachsen</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm md:text-base text-stone-200 leading-relaxed">
                <p className="text-xs uppercase tracking-widest text-lime-300/80">🌱 Für Entdecker, Lernende &amp; Neugierige</p>
                <p className="text-amber-200 font-semibold">Werde Teil von Floralog von Anfang an</p>

                <p>
                  Floralog lebt von Menschen, die ihre Umgebung neu entdecken wollen.
                  Du kannst uns schon jetzt unterstützen – ganz einfach, indem du spielst, Pflanzen scannst und uns Feedback gibst.
                </p>
                <p>
                  Jede Entdeckung hilft, das System besser zu machen.
                  Jede Rückmeldung fließt direkt in die Weiterentwicklung ein.
                </p>
                <p>So wächst Floralog Schritt für Schritt – gemeinsam mit dir.</p>

                <p className="text-stone-300 text-xs md:text-sm">
                  <span className="font-medium text-stone-200">Optional (finanziell):</span> Wenn du die Idee darüber hinaus unterstützen möchtest, kannst du Floralog auch finanziell helfen:{" "}
                  <button
                    onClick={() => {
                      setShowGuestGrowDialog(false);
                      navigate(createPageUrl("Donate"));
                    }}
                    className="underline underline-offset-2 text-lime-300 hover:text-lime-200"
                  >
                    mit einer Spende
                  </button>
                  {" "}oder einem Founder's Pack <span className="text-stone-500">(yet to come)</span>.
                </p>

                <hr className="border-lime-200/20 my-1" />

                <p className="text-xs uppercase tracking-widest text-lime-300/80">🤝 Für Partner, Unternehmen &amp; Unterstützer</p>
                <p className="text-amber-200 font-semibold">Wachsen Sie mit Floralog</p>

                <p>
                  Floralog verbindet digitale Interaktion mit realer Natur und schafft einen neuen Zugang zu Pflanzen, Wissen und Umgebung.
                </p>
                <p>Mit steigender Nutzung entstehen laufende Kosten – unter anderem für:</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li>Pflanzenidentifikation</li>
                  <li>Generierung von Inhalten</li>
                  <li>Karten- und Infrastrukturdienste</li>
                </ul>
                <p className="text-stone-300">
                  Unser Ansatz ist bewusst skalierend ("Pay as you go"):{" "}
                  <span className="text-stone-100">Floralog wächst mit seiner Community.</span>
                </p>
                <p>Wir suchen Partner, die diesen Weg begleiten möchten – z.{"\u202f"}B. aus den Bereichen:</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li>Pflanzenhandel</li>
                  <li>Bildung</li>
                  <li>Nachhaltigkeit</li>
                  <li>Umwelt &amp; Forschung</li>
                </ul>
                <p className="text-stone-300">
                  Interesse an einer Zusammenarbeit oder Förderung?{" "}
                  <span className="text-stone-100">Wir freuen uns über Ihre Nachricht.</span>
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showGuestVisionDialog} onOpenChange={setShowGuestVisionDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[82vh] overflow-y-auto rounded-3xl border border-[#f0e5a5]/35 bg-black/40 backdrop-blur-xl text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-emerald-950/20 to-black/45 pointer-events-none" />
            <div className="absolute inset-0 border border-[#f0e5a5]/25 rounded-3xl pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <DialogHeader>
                <DialogTitle className="text-emerald-300">Mehr zur Vision</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm md:text-base text-stone-200 leading-relaxed">
                <p className="text-amber-200 font-semibold">Schau mal, was da waechst!</p>

                <p>
                  Floralog nutzt die Faszination fuer den Bildschirm, um den Blick fuer die eigene Umgebung neu zu schaerfen. Waehrend das Wissen zur Natur Ihrer Heimat fuer fruehere Generationen ganz selbstverstaendlich war, ist vieles von diesem Wissen mit der Zeit verloren gegangen.
                </p>

                <p>
                  Heute sind wir oft von digitalen Welten umgeben und uebersehen dabei die kleinen Schaetze direkt vor unserer Haustuer. Doch wenn wir genauer hinsehen, entdecken wir: Da ist mehr, als wir denken.
                </p>

                <p className="text-amber-200 font-semibold">Unser Spieltrieb ist der beste Lehrer</p>

                <p>
                  Im Spiel lernen wir die Welt kennen. Wir probieren aus, entdecken Zusammenhaenge und erschaffen unsere eigenen Geschichten.
                </p>

                <p>
                  Genau hier setzt Floralog an: Es verbindet die Neugier und Motivation aus digitalen Erlebnissen mit der realen Welt vor deiner Tuer.
                </p>

                <p>
                  Statt trockener Theorie entsteht ein lebendiger Zugang zur Natur, getragen von Entdeckung, Fortschritt und dem Gefuehl, selbst etwas aufzubauen.
                </p>

                <p className="text-amber-200 font-semibold">Wachstum, das verbindet</p>

                <p>
                  Jede Entdeckung hat einen Effekt: Deine eigene, kleine Robopflanze waechst mit dir.
                </p>

                <p>
                  Sie entwickelt sich weiter, reagiert auf deine Aktivitaet und begleitet dich auf deinen Streifzuegen durch die Natur. Manchmal stellt sie Fragen, erinnert dich an vergangene Funde oder fordert dich auf, noch einmal genauer hinzusehen.
                </p>

                <p>
                  So werden Spaziergaenge zu kleinen Expeditionen. Und aus einzelnen Beobachtungen entsteht nach und nach ein tieferes Verstaendnis fuer die Welt um dich herum.
                </p>

                <p>
                  Fast beilaufig entsteht dabei etwas, das lange gefehlt hat: Ein neuer Blick auf die eigene Umgebung und die Wertschaetzung fuer das, was dort waechst.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </HomeBackgroundShell>
  );
}