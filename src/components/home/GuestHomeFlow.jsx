import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Camera, ChevronDown, ArrowLeft, Leaf, Sparkles, Users, BookOpen, Map as MapIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  calculateDistanceMetersRaw,
  NEARBY_DISCOVERY_RADIUS_METERS,
  parseDiscoveryCoordinates,
} from "@/lib/discoveryMap";

// Hero background - the forest creature image
const HERO_BG = "https://github.com/user-attachments/assets/9acb2621-3c3d-4efc-b157-60db3671bad4";

// Seed-based pseudo-random for deterministic particle positions
const sr = (seed) => { const v = Math.sin(seed * 9301 + 49297) * 233280; return v - Math.floor(v); };

// Particles in the bright forest clearing / glow area (upper-center of the image)
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: 22 + sr(i * 7) * 56,          // 22–78% horizontal (centered around clearing)
  y: 4 + sr(i * 13) * 42,           // 4–46% vertical (in the light area above creature)
  size: 2 + sr(i * 19) * 3.5,       // 2–5.5 px
  delay: sr(i * 31) * 3.2,          // 0–3.2 s delay
  dur: 1.6 + sr(i * 43) * 2.4,      // 1.6–4 s duration
  color: [
    "rgba(253,224,71,0.95)",
    "rgba(190,242,100,0.9)",
    "rgba(255,255,180,0.85)",
    "rgba(210,250,160,0.9)",
    "rgba(255,230,80,0.8)",
  ][i % 5],
}));

const GUEST_ROBOT_PLANT_IMAGE_URL = new URL("../../../UserPlant1.png", import.meta.url).href;

const seededRandom = (seed) => { const v = Math.sin(seed) * 10000; return v - Math.floor(v); };

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

// Reusable scan CTA button (matching home.jsx style)
function ScanButton({ onClick, className = "" }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center justify-center gap-2.5 rounded-2xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 py-4 text-lg font-semibold text-white shadow-[0_8px_24px_rgba(34,197,94,0.35)] hover:brightness-110 transition-all ${className}`}
    >
      <Camera className="w-6 h-6" />
      Scan starten
    </motion.button>
  );
}

// Section fade-in wrapper for scroll animations
function FadeInSection({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: "-60px" }}
      transition={{ duration: 0.65, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function GuestHomeFlow({ allDiscoveries = [], publicCollections = [] }) {
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const section3Ref = useRef(null);

  const [guestZones, setGuestZones] = useState([]);
  const [guestLocation, setGuestLocation] = useState(null);
  const [isGeneratingGuestZones, setIsGeneratingGuestZones] = useState(false);
  const [guestZoneError, setGuestZoneError] = useState(null);
  const [showGuestZoneMap, setShowGuestZoneMap] = useState(false);
  const [showGuestVisionDialog, setShowGuestVisionDialog] = useState(false);
  const [showGuestGrowDialog, setShowGuestGrowDialog] = useState(false);
  const [section3Content, setSection3Content] = useState("collections"); // "collections" | "features"

  // Scroll-based transforms for hero CTA fade-out
  const { scrollY } = useScroll({ container: scrollContainerRef });
  const ctaOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const ctaY = useTransform(scrollY, [0, 200], [0, -32]);
  const arrowOpacity = useTransform(scrollY, [0, 120], [1, 0]);

  // Community stats
  const activeCollectorsThisWeek = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Set(
      allDiscoveries
        .filter((entry) => {
          const rawDate = entry?.created_date || entry?.discovered_date || entry?.updated_date;
          if (!rawDate) return false;
          const ts = new Date(rawDate).getTime();
          return Number.isFinite(ts) && ts >= sevenDaysAgo;
        })
        .map((entry) => entry?.auth_id || entry?.created_by_id || entry?.user || entry?.created_by)
        .filter(Boolean)
    ).size;
  }, [allDiscoveries]);

  const discoveredSpeciesCountTotal = useMemo(
    () => new Set(allDiscoveries.map((e) => e?.plant_id).filter(Boolean)).size,
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
        const d = calculateDistanceMetersRaw(guestLocation.lat, guestLocation.lng, point.lat, point.lng);
        return Number.isFinite(d) && d <= NEARBY_DISCOVERY_RADIUS_METERS;
      });
  }, [allDiscoveries, guestLocation]);

  const handleScroll = useCallback(() => {
    const el = section3Ref.current;
    if (!el || !scrollContainerRef.current) return;
    const containerScrollTop = scrollContainerRef.current.scrollTop;
    const sectionOffsetTop = el.offsetTop;
    const sectionHeight = el.offsetHeight;
    const scrollIntoSection = containerScrollTop - sectionOffsetTop;
    // Switch content at 40% through the section
    if (scrollIntoSection > sectionHeight * 0.4) {
      setSection3Content("features");
    } else {
      setSection3Content("collections");
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const requestGuestLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation wird von diesem Browser nicht unterstuetzt."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      );
    });

  const handleGuestGenerateZones = async () => {
    if (isGeneratingGuestZones) return null;
    setIsGeneratingGuestZones(true);
    setGuestZoneError(null);
    try {
      const loc = await requestGuestLocation();
      setGuestLocation(loc);
      setGuestZones(buildGuestPreviewZones(loc.lat, loc.lng));
      return loc;
    } catch (err) {
      setGuestZoneError(err?.message || "Standort konnte nicht geladen werden.");
      return null;
    } finally {
      setIsGeneratingGuestZones(false);
    }
  };

  const handleGuestExploreZones = async () => {
    const loc = guestLocation || (await handleGuestGenerateZones());
    if (loc) setShowGuestZoneMap(true);
  };

  // Features list for Section 3 part 2
  const featureItems = [
    { icon: <Camera className="w-5 h-5 text-emerald-300" />, label: "Pflanzen scannen & bestimmen" },
    { icon: <Leaf className="w-5 h-5 text-lime-300" />, label: "Eigene Robopflanze aufziehen" },
    { icon: <MapIcon className="w-5 h-5 text-sky-300" />, label: "Natur-Zonen in deiner Umgebung erkunden" },
    { icon: <BookOpen className="w-5 h-5 text-amber-300" />, label: "Sammlungen anlegen & teilen" },
    { icon: <Users className="w-5 h-5 text-violet-300" />, label: "Community-Entdeckungen entdecken" },
    { icon: <Sparkles className="w-5 h-5 text-yellow-300" />, label: "Quests & Achievements freischalten" },
  ];

  return (
    <>
      {/* Fixed full-screen background */}
      <div className="fixed inset-0 overflow-hidden -z-10">
        <img
          src={HERO_BG}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          draggable={false}
        />
        {/* Base darkening overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,10,4,0.38)_0%,rgba(0,10,4,0.18)_35%,rgba(0,10,4,0.55)_70%,rgba(0,10,4,0.82)_100%)]" />
      </div>

      {/* Particle glow effects in the forest light area */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0" aria-hidden="true">
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 ${p.size * 4}px ${p.size * 2}px ${p.color}`,
            }}
            animate={{
              opacity: [0, 0.9, 0.6, 1, 0],
              scale: [0.4, 1.2, 0.9, 1.4, 0.4],
            }}
            transition={{
              duration: p.dur,
              delay: p.delay,
              repeat: Infinity,
              repeatDelay: p.dur * 0.6,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Zone Map overlay */}
      <AnimatePresence>
        {showGuestZoneMap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80"
          >
            <MapboxZoneMap
              zones={guestZones}
              userLocation={guestLocation}
              fallbackCenter={guestLocation ?? { lat: 51.1657, lng: 10.4515 }}
              discoveryPoints={guestNearbyDiscoveryPoints}
              onTokenError={setGuestZoneError}
            />
            {guestZoneError && (
              <div className="absolute left-4 right-4 top-4 z-[1200] rounded-xl border border-red-300/50 bg-red-900/55 px-3 py-2 text-xs font-medium text-red-100">
                {guestZoneError}
              </div>
            )}
            <div className="absolute left-4 bottom-6 z-[1200]">
              <button
                onClick={() => setShowGuestZoneMap(false)}
                className="h-10 px-4 rounded-xl border border-[#f0e5a5]/45 bg-black/60 text-stone-100 hover:bg-black/75 flex items-center gap-2 text-sm font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                Zurück
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        className="fixed inset-0 overflow-y-auto z-10"
        style={{ scrollBehavior: "smooth" }}
      >
        {/* ────────────────────────────────────────────────────────
            SECTION 1 — HERO
        ──────────────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-between min-h-screen px-5 pt-16 pb-10">
          {/* App title (above creature area) */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="flex flex-col items-center text-center z-10"
          >
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)]">
              Floralog
            </h1>
            <p className="mt-2 text-lg md:text-xl font-medium text-lime-200/90 tracking-wide drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)]">
              Dein Naturbegleiter
            </p>
          </motion.div>

          {/* Spacer to push CTAs to the bottom (creature fills the middle) */}
          <div className="flex-1" />

          {/* CTAs — fade out on scroll */}
          <motion.div
            style={{ opacity: ctaOpacity, y: ctaY }}
            className="w-full max-w-sm mx-auto z-10 space-y-3"
          >
            <ScanButton onClick={() => navigate(createPageUrl("Scanner"))} />

            <button
              onClick={() => navigate("/register")}
              className="w-full rounded-xl border border-lime-200/30 bg-black/30 backdrop-blur-sm py-3 text-base font-semibold text-lime-100 hover:bg-black/45 transition-colors"
            >
              Kostenlos registrieren
            </button>

            <button
              onClick={() => navigate("/login")}
              className="w-full rounded-xl border border-stone-400/20 bg-black/20 backdrop-blur-sm py-2.5 text-sm font-medium text-stone-300/90 hover:bg-black/35 transition-colors"
            >
              Anmelden
            </button>
          </motion.div>

          {/* Down-arrow scroll indicator */}
          <motion.div
            style={{ opacity: arrowOpacity }}
            className="mt-5 flex justify-center z-10"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-7 h-7 text-stone-200/70" />
          </motion.div>
        </section>

        {/* ────────────────────────────────────────────────────────
            SECTION 2 — DISCOVER
        ──────────────────────────────────────────────────────── */}
        <section className="relative min-h-screen flex flex-col justify-center px-5 py-20">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,8,3,0.6)_0%,rgba(5,25,12,0.72)_100%)]" />
          <div className="relative z-10 max-w-lg mx-auto w-full space-y-12">
            <FadeInSection>
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.22em] text-lime-300/80">Entdecken</p>
                <h2 className="text-3xl md:text-4xl font-bold text-stone-100 leading-snug">
                  Hilf deinem Florabot durch Entdeckungen
                </h2>
                <p className="text-base text-stone-200/85 leading-relaxed">
                  Erkunde mit deinem Begleiter deine Umgebung und lernt dabei gemeinsam mehr über die Natur dieses Planeten kennen.
                </p>
              </div>
            </FadeInSection>

            <FadeInSection delay={0.15}>
              <div className="rounded-2xl border border-[#f0e5a5]/25 bg-black/30 backdrop-blur-sm p-5 space-y-4">
                <h3 className="text-xl md:text-2xl font-bold text-stone-100">
                  Entdeckt die Schätze des Alltags
                </h3>
                <div className="flex items-center justify-center py-4">
                  <img
                    src={GUEST_ROBOT_PLANT_IMAGE_URL}
                    alt="Robo-Pflanze"
                    className="max-h-44 w-auto object-contain drop-shadow-[0_0_28px_rgba(190,242,100,0.5)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate(createPageUrl("Scanner"))}
                    className="rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition-all"
                  >
                    Scan testen
                  </button>
                  <button
                    type="button"
                    onClick={handleGuestExploreZones}
                    disabled={isGeneratingGuestZones}
                    className="rounded-xl border border-[#f0e5a5]/35 bg-black/35 py-2.5 text-sm font-semibold text-stone-100 disabled:opacity-60 hover:bg-black/50 transition-colors"
                  >
                    {isGeneratingGuestZones ? "Lade..." : "Zone erkunden"}
                  </button>
                </div>
                {guestZoneError && (
                  <p className="text-xs text-red-300">{guestZoneError}</p>
                )}
              </div>
            </FadeInSection>
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────
            SECTION 3 — COMMUNITY (sticky title, content switches)
        ──────────────────────────────────────────────────────── */}
        <section
          ref={section3Ref}
          className="relative"
          style={{ minHeight: "200vh" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,6,0.7)_0%,rgba(3,12,6,0.75)_100%)]" />

          {/* Sticky title + content */}
          <div className="sticky top-0 z-10 min-h-screen flex flex-col justify-center px-5 py-16">
            <div className="max-w-lg mx-auto w-full space-y-6">
              {/* Title never fades — always visible throughout section 3 */}
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-lime-300/80 mb-3">Community</p>
                <h2 className="text-3xl md:text-4xl font-bold text-stone-100">
                  Was andere gerade entdecken
                </h2>
              </div>

              {/* Animated content block */}
              <AnimatePresence mode="wait">
                {section3Content === "collections" ? (
                  <motion.div
                    key="collections"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    {/* Community stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-[#f0e5a5]/25 bg-black/35 px-3 py-3 text-center">
                        <div className="text-[10px] uppercase tracking-wide text-stone-400">Entdecker / Woche</div>
                        <div className="text-2xl font-bold text-lime-200 mt-1">{activeCollectorsThisWeek}</div>
                      </div>
                      <div className="rounded-2xl border border-[#f0e5a5]/25 bg-black/35 px-3 py-3 text-center">
                        <div className="text-[10px] uppercase tracking-wide text-stone-400">Pflanzenarten</div>
                        <div className="text-2xl font-bold text-emerald-200 mt-1">{discoveredSpeciesCountTotal}</div>
                      </div>
                      <div className="rounded-2xl border border-[#f0e5a5]/25 bg-black/35 px-3 py-3 text-center">
                        <div className="text-[10px] uppercase tracking-wide text-stone-400">Scans gesamt</div>
                        <div className="text-2xl font-bold text-amber-200 mt-1">{totalScanCount}</div>
                      </div>
                    </div>

                    {/* Public collections */}
                    <div className="rounded-2xl border border-[#f0e5a5]/25 bg-black/30 p-4 space-y-2">
                      <p className="text-xs text-stone-400">Aktuelle Sammlungen</p>
                      <div className="space-y-2">
                        {latestCollections.length === 0 ? (
                          <>
                            <div className="rounded-xl border border-[#f0e5a5]/25 bg-black/25 px-3 py-2.5 font-semibold text-stone-100 text-sm">Achtung Giftig 🌿</div>
                            <div className="rounded-xl border border-[#f0e5a5]/25 bg-black/25 px-3 py-2.5 font-semibold text-stone-100 text-sm">Gesunde Küche 🥗</div>
                          </>
                        ) : (
                          latestCollections.map((col, idx) => (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => navigate(`${createPageUrl("Collection")}?collectionId=${col.id}`)}
                              className="w-full text-left rounded-xl border border-[#f0e5a5]/25 bg-black/25 px-3 py-2.5 hover:bg-black/45 transition-colors"
                            >
                              <span className="font-semibold text-stone-100 text-sm">
                                {col.title || (idx === 0 ? "Achtung Giftig 🌿" : "Gesunde Küche 🥗")}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                      <p className="text-[11px] text-stone-400">Lass dich inspirieren oder starte deine eigene Sammlung.</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="features"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="space-y-3"
                  >
                    <p className="text-sm text-stone-300/80">Was du mit Floralog machen kannst:</p>
                    {featureItems.map((feature, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: i * 0.07 }}
                        className="flex items-center gap-3 rounded-xl border border-[#f0e5a5]/20 bg-black/30 px-4 py-3"
                      >
                        {feature.icon}
                        <span className="text-sm font-medium text-stone-100">{feature.label}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────
            SECTION 4 — GROW TOGETHER
        ──────────────────────────────────────────────────────── */}
        <section className="relative min-h-screen flex flex-col justify-center px-5 py-20">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,14,7,0.72)_0%,rgba(2,14,7,0.78)_100%)]" />
          <div className="relative z-10 max-w-lg mx-auto w-full space-y-8">
            <FadeInSection>
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.22em] text-lime-300/80">Gemeinsam wachsen</p>
                <h2 className="text-3xl md:text-4xl font-bold text-stone-100 leading-snug">
                  Wächst zusammen mit Floralog
                </h2>
                <p className="text-base text-stone-200/85 leading-relaxed">
                  Floralog ist noch am Keimen. In dieser frühen Phase ist jede Form der Unterstützung wertvoll.
                  Mit eurem Feedback kann Floralog wachsen!
                </p>
              </div>
            </FadeInSection>

            <FadeInSection delay={0.1}>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setShowGuestVisionDialog(true)}
                  className="w-full rounded-xl border border-[#f0e5a5]/35 bg-black/35 py-3.5 text-base font-semibold text-stone-100 hover:bg-black/50 transition-colors"
                >
                  Mehr zur Vision
                </button>
                <button
                  onClick={() => setShowGuestGrowDialog(true)}
                  className="w-full rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 py-3.5 text-base font-semibold text-white hover:brightness-110 transition-all"
                >
                  Unterstützen
                </button>
              </div>
            </FadeInSection>
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────
            SECTION 5 — FINAL CTA
        ──────────────────────────────────────────────────────── */}
        <section className="relative min-h-screen flex flex-col justify-center items-center px-5 py-20">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,14,7,0.75)_0%,rgba(0,5,2,0.88)_100%)]" />
          <div className="relative z-10 max-w-sm mx-auto w-full space-y-8 text-center">
            <FadeInSection>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Los geht's</p>
                <h2 className="text-2xl md:text-3xl font-semibold text-stone-300">
                  Startet die Reise
                </h2>
              </div>
            </FadeInSection>

            <FadeInSection delay={0.1} className="w-full space-y-3">
              <ScanButton onClick={() => navigate(createPageUrl("Scanner"))} />

              <button
                onClick={() => navigate("/register")}
                className="w-full rounded-xl border border-lime-200/30 bg-black/30 backdrop-blur-sm py-3 text-base font-semibold text-lime-100 hover:bg-black/45 transition-colors"
              >
                Kostenlos registrieren
              </button>

              <button
                onClick={() => navigate("/login")}
                className="w-full rounded-xl border border-stone-400/20 bg-black/20 backdrop-blur-sm py-2.5 text-sm font-medium text-stone-300/90 hover:bg-black/35 transition-colors"
              >
                Anmelden
              </button>
            </FadeInSection>

            <FadeInSection delay={0.2}>
              <button
                onClick={() => navigate(createPageUrl("Impressum"))}
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors underline underline-offset-2"
              >
                Impressum
              </button>
            </FadeInSection>
          </div>
        </section>
      </div>

      {/* ── DIALOGS ─────────────────────────────────────────── */}

      {/* Grow / Support Dialog */}
      <Dialog open={showGuestGrowDialog} onOpenChange={setShowGuestGrowDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[82vh] overflow-y-auto rounded-3xl border border-lime-200/35 bg-black/40 backdrop-blur-xl text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-emerald-950/20 to-black/45 pointer-events-none rounded-3xl" />
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
                  onClick={() => { setShowGuestGrowDialog(false); navigate(createPageUrl("Donate")); }}
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

      {/* Vision Dialog */}
      <Dialog open={showGuestVisionDialog} onOpenChange={setShowGuestVisionDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[82vh] overflow-y-auto rounded-3xl border border-[#f0e5a5]/35 bg-black/40 backdrop-blur-xl text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-emerald-950/20 to-black/45 pointer-events-none rounded-3xl" />
          <div className="relative z-10 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-emerald-300">Mehr zur Vision</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm md:text-base text-stone-200 leading-relaxed">
              <p className="text-amber-200 font-semibold">Schau mal, was da wächst!</p>
              <p>
                Floralog nutzt die Faszination für den Bildschirm, um den Blick für die eigene Umgebung neu zu schärfen. Während das Wissen zur Natur Ihrer Heimat für frühere Generationen ganz selbstverständlich war, ist vieles von diesem Wissen mit der Zeit verloren gegangen.
              </p>
              <p>
                Heute sind wir oft von digitalen Welten umgeben und übersehen dabei die kleinen Schätze direkt vor unserer Haustür. Doch wenn wir genauer hinsehen, entdecken wir: Da ist mehr, als wir denken.
              </p>
              <p className="text-amber-200 font-semibold">Unser Spieltrieb ist der beste Lehrer</p>
              <p>
                Im Spiel lernen wir die Welt kennen. Wir probieren aus, entdecken Zusammenhänge und erschaffen unsere eigenen Geschichten.
              </p>
              <p>
                Genau hier setzt Floralog an: Es verbindet die Neugier und Motivation aus digitalen Erlebnissen mit der realen Welt vor deiner Tür.
              </p>
              <p>
                Statt trockener Theorie entsteht ein lebendiger Zugang zur Natur, getragen von Entdeckung, Fortschritt und dem Gefühl, selbst etwas aufzubauen.
              </p>
              <p className="text-amber-200 font-semibold">Wachstum, das verbindet</p>
              <p>
                Jede Entdeckung hat einen Effekt: Deine eigene, kleine Robopflanze wächst mit dir.
              </p>
              <p>
                Sie entwickelt sich weiter, reagiert auf deine Aktivität und begleitet dich auf deinen Streifzügen durch die Natur. Manchmal stellt sie Fragen, erinnert dich an vergangene Funde oder fordert dich auf, noch einmal genauer hinzusehen.
              </p>
              <p>
                So werden Spaziergänge zu kleinen Expeditionen. Und aus einzelnen Beobachtungen entsteht nach und nach ein tieferes Verständnis für die Welt um dich herum.
              </p>
              <p>
                Fast beiläufig entsteht dabei etwas, das lange gefehlt hat: Ein neuer Blick auf die eigene Umgebung und die Wertschätzung für das, was dort wächst.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
