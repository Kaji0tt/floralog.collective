import React, { useState, useEffect, useRef } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { upsertUserProfile } from "@/api/authService";
import { executeMigration } from "@/api/migrationService";
import { getRobotPlantDailyZones } from "@/api/robotPlantService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Leaf, Plus, ShoppingBag, Users, Scroll, CheckCircle, AlertCircle, TreePine, Building2, Waves, Flower2, MapPin, ArrowLeft, RefreshCw, Map as MapIcon, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";
import AchievementNotification from "../components/achievements/AchievementNotification";
import ScanFeedbackNotification from "../components/notifications/ScanFeedbackNotification";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getNameFontSize } from "@/lib/utils";
import { getCachedLocation } from "@/lib/locationSync";
import {
  computeCareMultiplier,
  computeFirstScanOfDayMultiplier,
  computeOverallPlantHealth,
  computePlantHealthState,
} from "@/lib/robotPlantEconomy";
import { Button } from "@/components/ui/button";
import { updateQuestProgress } from "@/components/utils/questProgress";
import Collection from "./Collection";
import SettingsPanel from "@/components/settings/SettingsPanel";
import HomeHeaderBar from "@/components/navigation/HomeHeaderBar";
import HomeBottomNavigation from "@/components/navigation/HomeBottomNavigation";
import HomeBackgroundShell from "@/components/home/HomeBackgroundShell";
import AchievementsFeatureRoot from "@/components/achievements/AchievementsFeatureRoot";
import FriendsFeatureRoot from "@/components/friends/FriendsFeatureRoot";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import { getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";
import "mapbox-gl/dist/mapbox-gl.css";

const THEME_MAP_COLORS = {
  forest: "#007a3f",
  urban: "#8d755c",
  water: "#2b6cb0",
  meadow: "#84cc16",
};

const THEME_MAP_META = {
  forest: { label: "Forest", Icon: TreePine, color: "#007a3f" },
  urban: { label: "Urban", Icon: Building2, color: "#8d755c" },
  water: { label: "Water", Icon: Waves, color: "#2b6cb0" },
  meadow: { label: "Meadow", Icon: Flower2, color: "#84cc16" },
};

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

const HEALTH_TOOLTIP_TEXT = {
  energy: "Energie bestimmt Zonenanzahl, taegliche Rerolls, Zonengroesse und den taeglichen Energiegewinn aus gelaufener Scan-Distanz.",
  "data-quality": "Datenqualitaet steigt nur bei Scans innerhalb einer aktiven Zone.",
  care: "Pflege wirkt direkt als Multiplikator (0.5 bis 1.5). Ab 90% boosten Gains doppelt.",
};

const MULTIPLIER_SWIPE_THRESHOLD_PX = 36;

/**
 * @param {{ lat: number; lng: number; radiusM: number; points?: number }} params
 */
const toCirclePolygon = (params) => {
  const { lat, lng, radiusM, points = 48 } = params;
  const earthRadiusM = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const angularDistance = radiusM / earthRadiusM;
  const coordinates = [];

  for (let i = 0; i <= points; i += 1) {
    const bearing = (2 * Math.PI * i) / points;
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const pointLng =
      (lng * Math.PI) / 180 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pointLat)
      );

    coordinates.push([
      (pointLng * 180) / Math.PI,
      (pointLat * 180) / Math.PI,
    ]);
  }

  return coordinates;
};

/**
 * @param {{
 *   zones?: Array<{ centerLat: number | string; centerLng: number | string; radiusM?: number | string; theme?: string; zoneKey?: string; id?: string; bonusMultiplier?: number | string; zoneBonusMultiplier?: number | string; zone_bonus_multiplier?: number | string }>;
 *   userLocation?: { lat?: number; lng?: number } | null;
 *   fallbackCenter?: { lat?: number; lng?: number } | null;
 *   onTokenError?: (message: string) => void;
 * }} props
 */
function HeroZoneMap3D(props) {
  const mapContainerRef = useRef(null);
  /** @type {React.MutableRefObject<mapboxgl.Map | null>} */
  const mapRef = useRef(null);
  const zones = Array.isArray(props?.zones) ? props.zones : [];
  const userLocation = props?.userLocation || null;
  const fallbackCenter = props?.fallbackCenter || null;
  const onTokenError = typeof props?.onTokenError === "function" ? props.onTokenError : null;

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    if (!MAPBOX_ACCESS_TOKEN) {
      onTokenError?.("Mapbox Token fehlt. Setze VITE_MAPBOX_ACCESS_TOKEN in .env.local.");
      return;
    }

    const userLng = Number(userLocation?.lng);
    const userLat = Number(userLocation?.lat);

    const initialLng = Number.isFinite(userLng)
      ? userLng
      : Number(fallbackCenter?.lng);
    const initialLat = Number.isFinite(userLat)
      ? userLat
      : Number(fallbackCenter?.lat);

    if (!Number.isFinite(initialLng) || !Number.isFinite(initialLat)) {
      onTokenError?.("Karte konnte nicht initialisiert werden (fehlender Startpunkt).");
      return;
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/standard",
      config: {
        basemap: {
          theme: "default",
          show3dObjects: true,
        },
      },
      center: [initialLng, initialLat],
      zoom: 13,
      pitch: 58,
      bearing: -18,
      antialias: true,
    });

    mapRef.current = map;

    map.on("error", (event) => {
      const status = /** @type {any} */ (event)?.error?.status;
      if (status === 401 || status === 403) {
        onTokenError?.("Mapbox Zugriff verweigert. Bitte Token und Allowed URLs pruefen.");
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [fallbackCenter?.lat, fallbackCenter?.lng, onTokenError, userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateMapData = () => {
      const userLng = Number(userLocation?.lng);
      const userLat = Number(userLocation?.lat);

      const targetLng = Number.isFinite(userLng)
        ? userLng
        : Number(fallbackCenter?.lng);
      const targetLat = Number.isFinite(userLat)
        ? userLat
        : Number(fallbackCenter?.lat);

      if (Number.isFinite(targetLng) && Number.isFinite(targetLat)) {
        map.easeTo({ center: [targetLng, targetLat], zoom: 13, pitch: 58, bearing: -18, duration: 600 });
      }

      const zoneFeatures = zones
        .map((zone) => {
          const lat = Number(zone.centerLat);
          const lng = Number(zone.centerLng);
          const radiusM = Number(zone.radiusM || 0);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || radiusM <= 0) {
            return null;
          }

          const theme = typeof zone.theme === "string" ? zone.theme : "meadow";
          const color = THEME_MAP_COLORS[/** @type {"forest"|"urban"|"water"|"meadow"} */ (theme)] || "#84cc16";
          const themeLabel = THEME_MAP_META[/** @type {"forest"|"urban"|"water"|"meadow"} */ (theme)]?.label || theme;
          const zoneMultiplierCandidate = Number(
            zone.bonusMultiplier ?? zone.zoneBonusMultiplier ?? zone.zone_bonus_multiplier ?? 1.5
          );
          const zoneMultiplier = Number.isFinite(zoneMultiplierCandidate) ? zoneMultiplierCandidate : 1.5;

          return {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [toCirclePolygon({ lat, lng, radiusM })],
            },
            properties: {
              id: zone.zoneKey || zone.id || `${lat}-${lng}`,
              color,
              theme,
              themeLabel,
              radiusM,
              zoneMultiplier,
            },
          };
        })
        .filter(Boolean);

      const zoneGeoJson = /** @type {any} */ ({
        type: "FeatureCollection",
        features: zoneFeatures,
      });

      const zoneSource = /** @type {any} */ (map.getSource("hero-zones"));
      if (zoneSource) {
        zoneSource.setData(zoneGeoJson);
      } else {
        map.addSource("hero-zones", {
          type: "geojson",
          data: /** @type {any} */ (zoneGeoJson),
        });

        map.addLayer({
          id: "hero-zones-fill",
          type: "fill",
          source: "hero-zones",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.22,
          },
        });

        map.addLayer({
          id: "hero-zones-line",
          type: "line",
          source: "hero-zones",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2,
            "line-opacity": 0.9,
          },
        });

        map.on("click", "hero-zones-fill", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties || {};
          const themeLabel = props.themeLabel || props.theme || "Zone";
          const color = props.color || "#84cc16";
          const radiusDisplay = props.radiusM ? `${Math.round(props.radiusM)} m` : "";
          const zoneMultiplier = Number(props.zoneMultiplier || 1.5);

          const popupHtml = `
            <div style="font-family:sans-serif;min-width:170px;max-width:220px;padding:4px 2px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;"></span>
                <strong style="font-size:14px;color:#fde68a;">${themeLabel} Zone</strong>
              </div>
              <div style="font-size:12px;color:#d6d3d1;line-height:1.5;">
                <div style="margin-bottom:4px;">
                  <span style="color:#86efac;font-weight:600;">Multiplikator:</span> x${zoneMultiplier.toFixed(2)}
                </div>
                <div style="margin-bottom:4px;color:#a8a29e;">
                  Startet bei x1.50 und sinkt pro weiterem Scan in dieser Zone.
                </div>
                ${radiusDisplay ? `<div style="color:#a8a29e;">Radius: ${radiusDisplay}</div>` : ""}
              </div>
            </div>
          `;

          new mapboxgl.Popup({ closeButton: true, maxWidth: "240px", className: "hero-zone-popup" })
            .setLngLat(e.lngLat)
            .setHTML(popupHtml)
            .addTo(map);
        });

        map.on("mouseenter", "hero-zones-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "hero-zones-fill", () => {
          map.getCanvas().style.cursor = "";
        });
      }

      const userGeoJson = /** @type {any} */ ({
        type: "FeatureCollection",
        features: Number.isFinite(userLng) && Number.isFinite(userLat)
          ? [{
            type: "Feature",
            geometry: { type: "Point", coordinates: [userLng, userLat] },
            properties: {},
          }]
          : [],
      });

      const userSource = /** @type {any} */ (map.getSource("hero-user"));
      if (userSource) {
        userSource.setData(userGeoJson);
      } else {
        map.addSource("hero-user", {
          type: "geojson",
          data: /** @type {any} */ (userGeoJson),
        });
        map.addLayer({
          id: "hero-user-point",
          type: "circle",
          source: "hero-user",
          paint: {
            "circle-radius": 6,
            "circle-color": "#38bdf8",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#111827",
          },
        });
      }
    };

    if (map.isStyleLoaded()) {
      updateMapData();
    } else {
      map.once("style.load", updateMapData);
    }
  }, [fallbackCenter?.lat, fallbackCenter?.lng, userLocation?.lat, userLocation?.lng, zones]);

  return <div ref={mapContainerRef} className="h-full w-full z-0" />;
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [averageColor, setAverageColor] = useState(null);

  const [showScannerHighlight, setShowScannerHighlight] = useState(false);
  const [heroZones, setHeroZones] = useState([]);
  const [activeZone, setActiveZone] = useState(null);
  const [isLoadingZone, setIsLoadingZone] = useState(false);
  const [isRegeneratingZones, setIsRegeneratingZones] = useState(false);
  const [showHeroZoneMap, setShowHeroZoneMap] = useState(false);
  const [zoneMapError, setZoneMapError] = useState(null);
  const [showHealthStatsPanel, setShowHealthStatsPanel] = useState(false);
  const healthStatsPanelRef = useRef(null);
  const [heroStageSizePx, setHeroStageSizePx] = useState(0);

  const [showSeedsTooltip, setShowSeedsTooltip] = useState(false);
  const [showMultiplierTooltip, setShowMultiplierTooltip] = useState(false);
  const [activeMultiplierIndex, setActiveMultiplierIndex] = useState(0);
  const multiplierTouchStartXRef = useRef(null);

  const [scanFeedback, setScanFeedback] = useState(null);
  const [showEmbeddedCollection, setShowEmbeddedCollection] = useState(false);
  const [showEmbeddedSettings, setShowEmbeddedSettings] = useState(false);
  const [showEmbeddedAchievements, setShowEmbeddedAchievements] = useState(false);
  const [showEmbeddedFriends, setShowEmbeddedFriends] = useState(false);
  const [embeddedHeaderMeta, setEmbeddedHeaderMeta] = useState(null);
  const [embeddedFriendsAddDialogNonce, setEmbeddedFriendsAddDialogNonce] = useState(0);
  const [embeddedCollectionPublicPanelOpen, setEmbeddedCollectionPublicPanelOpen] = useState(false);
  const [embeddedSelectedCollectionId, setEmbeddedSelectedCollectionId] = useState("global");

  useEffect(() => {
    if (!showEmbeddedCollection) {
      setEmbeddedCollectionPublicPanelOpen(false);
      setEmbeddedSelectedCollectionId("global");
    }
  }, [showEmbeddedCollection]);

  useEffect(() => {
    if (!showEmbeddedAchievements && !showEmbeddedFriends) {
      setEmbeddedHeaderMeta(null);
    }
  }, [showEmbeddedAchievements, showEmbeddedFriends]);
  const [uiTheme, setUiTheme] = useState(() => {
    const stored = localStorage.getItem("home-ui-theme");
    return stored === "light" ? "light" : "dark";
  });

  // Migration states
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationSteps, setMigrationSteps] = useState([]);
  const [migrationError, setMigrationError] = useState(null);

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userDiscoveries = [], isLoading: isLoadingDiscoveries } = useQuery({
    queryKey: ['userDiscoveries', user?.id],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Lieblingsscan-/Lieblingspflanzen-Anzeige wurde aus dem Spiel entfernt

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => Query.Quest.list('quest_number'),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userQuests = [], isLoading: isLoadingQuests } = useQuery({
    queryKey: ['userQuests', user?.id],
    queryFn: async () => {
      try {
        return await Query.UserQuest.filter({ auth_id: user?.id });
      } catch (e) {
        // Fehler wird nur einmal angezeigt, kein Retry
        return [];
      }
    },
    enabled: !!user?.id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: friends = [], isLoading: isLoadingFriends } = useQuery({
    queryKey: ['friends', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await Query.Friend.list();
      return allFriends.filter(f => 
        (f.request_sent_by?.toLowerCase() === user.email.toLowerCase() || 
         f.request_sent_to?.toLowerCase() === user.email.toLowerCase()) && 
        f.status === 'accepted'
      );
    },
    enabled: !!user?.email,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: userAchievements = [], isLoading: isLoadingAchievements } = useQuery({
    queryKey: ['userAchievements', user?.id],
    queryFn: () => Query.UserAchievement.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => Query.WeeklyQuest.list('quest_number'),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userWeeklyQuests = [], isLoading: isLoadingWeeklyQuests } = useQuery({
    queryKey: ['userWeeklyQuests', user?.id],
    queryFn: () => Query.UserWeeklyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => Query.MonthlyQuest.list('quest_number'),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userMonthlyQuests = [], isLoading: isLoadingMonthlyQuests } = useQuery({
    queryKey: ['userMonthlyQuests', user?.id],
    queryFn: () => Query.UserMonthlyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => Query.CollectionQuest.list(),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userCollectionQuests = [], isLoading: isLoadingCollectionQuests } = useQuery({
    queryKey: ['userCollectionQuests', user?.id],
    queryFn: () => Query.UserCollectionQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => Query.UserPlantDiscovery.list('-created_date'),
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const users = await Query.PublicProfile.list();
      return users.filter(u => u.weekly_tracking !== false);
    },
    initialData: [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: backgroundNotifications = [] } = useQuery({
    queryKey: ['backgroundNotifications', user?.id],
    queryFn: () => Query.UserNotification.filter({ 
      auth_id: user?.id,
      notification_type: "custom",
      seen: false
    }),
    enabled: !!user?.id,
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: robotPlantState = null } = useQuery({
    queryKey: ['robotPlantState', user?.id],
    queryFn: async () => {
      const rows = await Query.RobotPlant.filter({ auth_id: user?.id });
      return rows?.[0] || null;
    },
    enabled: !!user?.id,
    initialData: null,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });



  const loadUserData = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    setIsLoadingUser(false);
    // Refetch alle Queries um Stats sofort zu aktualisieren
    queryClient.refetchQueries({ queryKey: ['userDiscoveries'] });
    queryClient.refetchQueries({ queryKey: ['plants'] });
    queryClient.refetchQueries({ queryKey: ['genera'] });
    queryClient.refetchQueries({ queryKey: ['friends'] });
    queryClient.refetchQueries({ queryKey: ['allDiscoveries'] });
    queryClient.refetchQueries({ queryKey: ['robotPlantState'] });
    
    // NICHT mehr hier - Rewards werden nur beim Scannen/Quest-Completion geprüft
  };

  useEffect(() => {
    loadUserData();

    // Subscription für User-Updates (z.B. aus WelcomeNameDialog)
    const unsubscribe = Query.PublicProfile.subscribe((event) => {
      if (event.type === 'update') {
        loadUserData();
      }
    });

    // Custom Event Listener für User-Updates vom Layout
    const handleUserUpdate = (event) => {
      const updatedUser = event.detail;
      setUser(updatedUser);
      // Refetch alle Queries um Stats sofort zu aktualisieren
      queryClient.refetchQueries({ queryKey: ['userDiscoveries'] });
      queryClient.refetchQueries({ queryKey: ['plants'] });
      queryClient.refetchQueries({ queryKey: ['genera'] });
      queryClient.refetchQueries({ queryKey: ['friends'] });
      queryClient.refetchQueries({ queryKey: ['allDiscoveries'] });
      queryClient.refetchQueries({ queryKey: ['robotPlantState'] });
    };

    window.addEventListener('userUpdated', handleUserUpdate);
    
    return () => {
      unsubscribe();
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("home-ui-theme", uiTheme);
  }, [uiTheme]);

  // Beim Öffnen der Home-Seite einmalig Quest-Fortschritt aktualisieren
  useEffect(() => {
    const runQuestProgressUpdate = async () => {
      if (!user?.id) return;
      try {
        console.log('[HomePage] Running updateQuestProgress for user:', user.email);
        await updateQuestProgress(user);
      } catch (error) {
        console.error('[HomePage] Error while updating quest progress:', error);
      }
    };

    runQuestProgressUpdate();
  }, [user?.id]);

  // Consume transient navigation state exactly once per navigation
  useEffect(() => {
    if (!location.state) return;

    const hasScanFeedback = Boolean(location.state.scanFeedback);
    const shouldOpenSettings = Boolean(location.state.openSettings);

    if (!hasScanFeedback && !shouldOpenSettings) return;

    if (hasScanFeedback) {
      setScanFeedback(location.state.scanFeedback);
    }

    if (shouldOpenSettings) {
      setShowEmbeddedSettings(true);
      setShowEmbeddedCollection(false);
      setShowEmbeddedAchievements(false);
      setShowEmbeddedFriends(false);
      setShowHeroZoneMap(false);
      setShowHealthStatsPanel(false);
    }

    const { scanFeedback: _ignoredFeedback, openSettings: _ignoredOpenSettings, ...restState } = location.state;
    const nextState = Object.keys(restState).length > 0 ? restState : null;

    navigate(location.pathname + location.search, {
      replace: true,
      state: nextState,
    });
  }, [location, navigate]);

  // Auto-execute migration if pending (user came from SetPassword page)
  useEffect(() => {
    const migrationPending = localStorage.getItem('migration_pending');
    
    // Check if we should run migration
    if (migrationPending === 'true' && user) {
      console.log('[Home] Migration pending detected - starting automatic migration...');
      
      // IMMEDIATELY clear flag to prevent loop
      localStorage.removeItem('migration_pending');
      
      setIsMigrating(true);
      setMigrationSteps([]);
      setMigrationError(null);

      executeMigration((progress) => {
        console.log(`[Home] Migration progress: ${progress.completed}/${progress.total} - ${progress.step.name}`);
        setMigrationSteps(prev => [...prev, progress.step]);
      })
        .then(() => {
          console.log('[Home] Migration completed successfully!');
          setIsMigrating(false);
          // Refetch all user data after successful migration
          loadUserData();
        })
        .catch((err) => {
          console.error('[Home] Migration failed:', err);
          setMigrationError(err.message || 'Migration fehlgeschlagen');
          setIsMigrating(false);
        });
    }
  }, [user]); // Only depend on user, not isMigrating!

  // Prüfe ob Scanner-Highlight angezeigt werden soll
  useEffect(() => {
    if (!user || isLoadingDiscoveries) return;
    const hasDisplayName = user.display_name;
    const hasNoScans = userDiscoveries.length === 0;
    const shouldHighlight = hasDisplayName && hasNoScans;
    setShowScannerHighlight(shouldHighlight);
  }, [user?.display_name, userDiscoveries, isLoadingDiscoveries]);


  const updateUserMutation = useMutation({
    mutationFn: (data) => updateCurrentUserProfile(data),
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      const freshUser = await getCurrentUser();
      setUser(freshUser);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      await updatePublicProfile(freshUser);
    },
    onError: (error) => {
      console.error("❌ Fehler beim Update:", error);
      alert(`Fehler beim Speichern: ${error.message}`);
    }
  });

  const updatePublicProfile = async (userData) => {
    try {
      const profileData = {
        user_email: userData.email,
        display_name: userData.display_name || userData.full_name,
        full_name: userData.full_name,
        title: userData.title,
        selected_title: userData.selected_title,
        background_image_url: userData.background_image_url,
        background_color: userData.background_color
      };

      await upsertUserProfile(userData.id, profileData);
    } catch (error) {
      console.error("Fehler beim PublicProfile Update:", error);
    }
  };

  // PublicProfile wird nur bei expliziten Updates aktualisiert (nicht automatisch)

  const getAverageColor = (imageUrl) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const size = 50;
          canvas.width = size;
          canvas.height = size;
          
          ctx.drawImage(img, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          
          let r = 0, g = 0, b = 0, count = 0;
          
          for (let i = 0; i < data.length; i += 16) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          
          resolve(`rgb(${r}, ${g}, ${b})`);
        } catch (error) {
          resolve(null);
        }
      };
      
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  };

  useEffect(() => {
    if (user?.background_color) {
      setAverageColor(user.background_color);
    } else if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) {
          setAverageColor(color);
        }
      });
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

  const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    const loadZoneForHero = async () => {
      if (!user?.id) return;
      const location = getCachedLocation();
      if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
        setHeroZones([]);
        setActiveZone(null);
        return;
      }

      setIsLoadingZone(true);
      setZoneMapError(null);
      try {
        const daily = await getRobotPlantDailyZones({
          latitude: location.lat,
          longitude: location.lng,
        });

        setHeroZones(daily?.zones || []);

        const inRangeZone = (daily?.zones || [])
          .map((zone) => {
            const dist = calculateDistanceMeters(
              location.lat,
              location.lng,
              Number(zone.centerLat),
              Number(zone.centerLng)
            );
            return { ...zone, distanceM: dist };
          })
          .filter((zone) => Number.isFinite(zone.distanceM) && zone.distanceM <= Number(zone.radiusM || 0))
          .sort((a, b) => a.distanceM - b.distanceM)[0];

        setActiveZone(inRangeZone || null);
      } catch (error) {
        console.warn("[Home] Konnte aktive Zone nicht laden:", error?.message || error);
        setZoneMapError("Zonen konnten nicht geladen werden.");
        setHeroZones([]);
        setActiveZone(null);
      } finally {
        setIsLoadingZone(false);
      }
    };

    loadZoneForHero();
  }, [user?.id]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (healthStatsPanelRef.current && !healthStatsPanelRef.current.contains(event.target)) {
        setShowHealthStatsPanel(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showHealthStatsPanel]);

  useEffect(() => {
    const panel = healthStatsPanelRef.current;
    if (!panel) return;

    const updateHeroStageSize = () => {
      const bounds = panel.getBoundingClientRect();
      const nextSize = Math.floor(Math.min(bounds.width, bounds.height));
      if (!Number.isFinite(nextSize) || nextSize <= 0) return;
      setHeroStageSizePx((prev) => (prev === nextSize ? prev : nextSize));
    };

    updateHeroStageSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateHeroStageSize);
      observer.observe(panel);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateHeroStageSize);
    return () => window.removeEventListener("resize", updateHeroStageSize);
  }, [showHeroZoneMap]);

  const isLoadingCriticalData = isLoadingDiscoveries || isLoadingQuests || isLoadingAchievements || isLoadingFriends || isLoadingWeeklyQuests || isLoadingMonthlyQuests || isLoadingCollectionQuests;

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-6 text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
          <Leaf className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-stone-800 mb-2">Willkommen bei Floralog</h1>
        <p className="text-stone-500 mb-8 max-w-sm">
          Entdecke, identifiziere und sammle Pflanzen in deiner Umgebung. Melde dich an oder erstelle ein kostenloses Konto, um loszulegen.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-colors"
          >
            Anmelden
          </button>
          <button
            onClick={() => navigate('/register')}
            className="w-full border-2 border-green-600 text-green-700 hover:bg-green-50 font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Kostenlos registrieren
          </button>
          <button
            onClick={() => navigate('/Scanner')}
            className="w-full text-stone-500 hover:text-stone-700 text-sm py-2 transition-colors"
          >
            Als Gast Pflanze scannen
          </button>
        </div>
      </div>
    );
  }

  const discoveredGenera = genera.filter(g => {
    const genusPlants = plants.filter(p => 
      p.genus_category === g.category && p.genus_number === g.category_dex_number
    );
    return genusPlants.some(p => userDiscoveries.some(d => d.plant_id === p.id));
  }).length;

  const playerSeeds = Math.max(
    0,
    Number(robotPlantState?.wallet_balance ?? robotPlantState?.walletBalance ?? 0)
  );

  const energyValue = Math.max(
    0,
    Math.min(100, Number(robotPlantState?.energy ?? robotPlantState?.energy_value ?? 0))
  );
  const dataQualityValue = Math.max(
    0,
    Math.min(
      100,
      Number(robotPlantState?.dataQuality ?? robotPlantState?.data_quality ?? robotPlantState?.data_quality_value ?? 0)
    )
  );
  const careValue = Math.max(
    0,
    Math.min(100, Number(robotPlantState?.care ?? robotPlantState?.care_value ?? 0))
  );

  const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);
  const currentMonthlyQuest = getCurrentMonthlyQuest(monthlyQuests);

  // Quest Status berechnen
  const isActiveOrCompleted = (uq) => {
    if (!uq) return false;
    if (uq.status) {
      return uq.status === 'active' || uq.status === 'completed';
    }
    return uq.accepted && !uq.redeemed;
  };

  const isCompletedStatus = (uq) => {
    if (!uq) return false;
    if (uq.status) {
      return uq.status === 'completed' || uq.status === 'redeemed';
    }
    return !!uq.completed;
  };

  const activeRegularQuests = quests
    .filter(q => {
      const userQuest = userQuests.find(uq => uq.quest_id === q.id);
      return isActiveOrCompleted(userQuest) && !(userQuest?.status === 'redeemed' || userQuest?.redeemed);
    })
    .map(q => {
      const userQuest = userQuests.find(uq => uq.quest_id === q.id);
      return { ...q, isCompleted: isCompletedStatus(userQuest) };
    });

  const availableRegularQuests = quests.filter(q => {
    const userQuest = userQuests.find(uq => uq.quest_id === q.id);
    let prerequisiteMet = true;
    if (q.prerequisite_quest_number) {
      const prerequisiteQuest = quests.find(pq => pq.quest_number === q.prerequisite_quest_number);
      if (prerequisiteQuest) {
        const prerequisiteUserQuest = userQuests.find(uq => uq.quest_id === prerequisiteQuest.id);
        prerequisiteMet = prerequisiteUserQuest?.status
          ? (prerequisiteUserQuest.status === 'redeemed')
          : (prerequisiteUserQuest?.redeemed || false);
      }
    }
    const hasUserQuest = !!userQuest;
    const isAccepted = userQuest?.accepted || !!userQuest?.status;
    return (!hasUserQuest || !isAccepted) && prerequisiteMet;
  });

  const currentWeeklyUserQuest = currentWeeklyQuest ? 
    userWeeklyQuests.find(uwq => uwq.weekly_quest_id === currentWeeklyQuest.id) : null;
  const activeWeeklyQuest = currentWeeklyQuest && currentWeeklyUserQuest && isActiveOrCompleted(currentWeeklyUserQuest) && !(currentWeeklyUserQuest.status === 'redeemed' || currentWeeklyUserQuest.redeemed) ?
    { ...currentWeeklyQuest, isCompleted: currentWeeklyUserQuest.completed || false } : null;
  const availableWeeklyQuest = currentWeeklyQuest && !currentWeeklyUserQuest;

  const currentMonthlyUserQuest = currentMonthlyQuest ?
    userMonthlyQuests.find(umq => umq.monthly_quest_id === currentMonthlyQuest.id) : null;
  const activeMonthlyQuest = currentMonthlyQuest && currentMonthlyUserQuest && isActiveOrCompleted(currentMonthlyUserQuest) && !(currentMonthlyUserQuest.status === 'redeemed' || currentMonthlyUserQuest.redeemed) ?
    { ...currentMonthlyQuest, isCompleted: currentMonthlyUserQuest.completed || false } : null;
  const availableMonthlyQuest = currentMonthlyQuest && !currentMonthlyUserQuest;

  const activeCollectionQuests = collectionQuests
    .filter(quest => {
      const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
      return quest.is_active && isActiveOrCompleted(userQuest) && !(userQuest?.status === 'redeemed' || userQuest?.redeemed);
    })
    .map(quest => {
      const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
      return { ...quest, isCompleted: userQuest?.completed || false };
    });

  const availableCollectionQuests = collectionQuests.filter(quest => {
    const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
    return quest.is_active && !userQuest?.accepted;
  });

  const hasRedeemableQuests = [...activeRegularQuests, ...activeCollectionQuests].some(q => q.isCompleted) ||
    (activeWeeklyQuest?.isCompleted) || (activeMonthlyQuest?.isCompleted);
  const hasNewQuests = availableRegularQuests.length > 0 || availableCollectionQuests.length > 0 ||
    availableWeeklyQuest || availableMonthlyQuest;

  const weeklyParticipantsCount = (() => {
    if (!currentWeeklyQuest || allDiscoveries.length === 0 || allUsers.length === 0) return 0;
    
    const participatingUsers = new Set();
    
    allDiscoveries.forEach(d => {
      const discoveryUser = allUsers.find(u => u.user_email === d.user || u.user_email === d.created_by);
      if (!discoveryUser) return;

      const plant = plants.find(p => p.id === d.plant_id);
      if (!plant) return;

      let matches = false;
      
      if (currentWeeklyQuest.target_species_name) {
        matches = plant.species_name === currentWeeklyQuest.target_species_name;
      } else if (currentWeeklyQuest.target_genus_name) {
        const genus = genera.find(g => 
          g.category === plant.genus_category && 
          g.category_dex_number === plant.genus_number
        );
        matches = genus?.genus_name === currentWeeklyQuest.target_genus_name;
      } else if (currentWeeklyQuest.category && currentWeeklyQuest.category !== "Alle") {
        matches = plant.genus_category === currentWeeklyQuest.category;
      } else {
        matches = true;
      }
      
      if (matches) {
        participatingUsers.add(discoveryUser.user_email);
      }
    });
    
    return participatingUsers.size;
  })();



  const activeQuestsCount = activeRegularQuests.length + 
    (activeWeeklyQuest ? 1 : 0) + 
    (activeMonthlyQuest ? 1 : 0) + 
    activeCollectionQuests.length;

  const getDisplayName = () => user.display_name || user.full_name;

  const getRgbaFromRgb = (rgbString, opacity) => {
    if (!rgbString) return null;
    // Fallback: Wenn opacity ungültig ist, auf 1 setzen
    const safeOpacity = (typeof opacity === 'number' && opacity >= 0 && opacity <= 1) ? opacity : 1;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${safeOpacity})`;
  };

  const getLighterColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.min(255, Math.floor(parseInt(match[1]) * 1.4));
    const g = Math.min(255, Math.floor(parseInt(match[2]) * 1.4));
    const b = Math.min(255, Math.floor(parseInt(match[3]) * 1.4));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getDarkerColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.floor(parseInt(match[1]) * 0.6);
    const g = Math.floor(parseInt(match[2]) * 0.6);
    const b = Math.floor(parseInt(match[3]) * 0.6);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const isColorDark = (rgbString) => {
    if (!rgbString) return false;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return false;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    // Berechne Helligkeit (0-255) - Werte unter 100 gelten als dunkel
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 100;
  };

  const safeEnergy = Math.max(0, Math.min(100, energyValue));
  const safeDataQuality = Math.max(0, Math.min(100, dataQualityValue));
  const safeCare = Math.max(0, Math.min(100, careValue));

  const overallPlantHealth = computeOverallPlantHealth({
    energyValue: safeEnergy,
    dataQualityValue: safeDataQuality,
    careValue: safeCare,
  });

  const plantHealthState = computePlantHealthState({
    overallPlantHealth,
    energyValue: safeEnergy,
    dataQualityValue: safeDataQuality,
    careValue: safeCare,
  });
  const healthStateBonus = Number(plantHealthState?.scanEventBonus ?? 0);

  const currentZoneColor = activeZone
    ? THEME_MAP_COLORS[activeZone.theme] || "#84cc16"
    : "#6b7280";
  const cachedLocation = getCachedLocation();
  const heroMapCenter = Number.isFinite(cachedLocation?.lat) && Number.isFinite(cachedLocation?.lng)
    ? [cachedLocation.lat, cachedLocation.lng]
    : heroZones[0]
      ? [Number(heroZones[0].centerLat), Number(heroZones[0].centerLng)]
      : [51.1657, 10.4515];

  const activeZoneMeta = activeZone?.theme ? THEME_MAP_META[activeZone.theme] : null;
  const ZoneIcon = activeZoneMeta?.Icon || MapPin;
  const healthStats = [
    { id: "energy", label: "Energie", value: Math.round(safeEnergy), color: "#10b981" },
    { id: "data-quality", label: "Daten", value: Math.round(safeDataQuality), color: "#06b6d4" },
    { id: "care", label: "Pflege", value: Math.round(safeCare), color: "#f59e0b" },
  ];
  const controlsScale = heroStageSizePx > 0
    ? Math.max(0.86, Math.min(1.18, heroStageSizePx / 250))
    : 1;

  const streakDays = Math.max(
    0,
    Number(robotPlantState?.streakDays ?? robotPlantState?.streak_days ?? 0)
  );
  const streakMultiplier = Math.max(1, Math.min(7, streakDays <= 1 ? 1 : streakDays));

  const zoneMultiplierCandidate = Number(
    activeZone?.bonusMultiplier ?? activeZone?.zoneBonusMultiplier ?? activeZone?.zone_bonus_multiplier ?? 1.5
  );
  const zoneMultiplier = Number.isFinite(zoneMultiplierCandidate) && zoneMultiplierCandidate > 0
    ? zoneMultiplierCandidate
    : 1.5;

  const careMultiplier = computeCareMultiplier(safeCare);

  const hasScanToday = userDiscoveries.some((discovery) => {
    const rawDate = discovery?.created_date || discovery?.discovered_date || discovery?.updated_date;
    if (!rawDate) return false;
    const scanDate = new Date(rawDate);
    if (Number.isNaN(scanDate.getTime())) return false;
    const now = new Date();
    return (
      scanDate.getFullYear() === now.getFullYear() &&
      scanDate.getMonth() === now.getMonth() &&
      scanDate.getDate() === now.getDate()
    );
  });
  const dailyBonusMultiplier = computeFirstScanOfDayMultiplier(!hasScanToday);
  const knownNextScanMultiplier =
    streakMultiplier * zoneMultiplier * careMultiplier * dailyBonusMultiplier;
  const noveltyMinMultiplier = 0.2;
  const noveltyMaxMultiplier = 1;
  const rarityMinMultiplier = 1;
  const rarityMaxMultiplier = 3;
  const nextScanMinMultiplier =
    knownNextScanMultiplier * noveltyMinMultiplier * rarityMinMultiplier;
  const nextScanMaxMultiplier =
    knownNextScanMultiplier * noveltyMaxMultiplier * rarityMaxMultiplier;
  const nextScanMinReward = Math.round((10 + healthStateBonus) * nextScanMinMultiplier);
  const nextScanMaxReward = Math.round((50 + healthStateBonus) * nextScanMaxMultiplier);

  const formatMultiplier = (value) => {
    const safeValue = Number.isFinite(value) ? value : 1;
    return `x${safeValue.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}`;
  };

  const multiplierItems = [
    {
      id: "streak",
      title: "🔥 Streak",
      value: formatMultiplier(streakMultiplier),
      description: "Basierend auf deiner Scan-Serie (x1 bis x7).",
    },
    {
      id: "zone",
      title: "📍 Zone",
      value: formatMultiplier(zoneMultiplier),
      description: "Start x1.5, pro weiterem Scan in derselben Zone -0.2 (bis x0.5).",
    },
    {
      id: "care",
      title: "💚 Pflege",
      value: formatMultiplier(careMultiplier),
      description: "Direkter Einfluss aus dem Care-Wert (x0.5 bis x1.5).",
    },
    {
      id: "daily",
      title: "🌅 Tagesbonus",
      value: formatMultiplier(dailyBonusMultiplier),
      description: "Erster Scan des Tages x2, danach x1.",
    },
    {
      id: "rarity",
      title: "⭐ Raritaet",
      value: "x1 bis x3",
      description: "Scanabhaengig: haeufig x1, gelegentlich x2, selten x3.",
    },
    {
      id: "novelty",
      title: "📉 Neuheit",
      value: "x1 bis x0.2",
      description: "Scanabhaengig: sinkt pro Duplikat derselben Pflanze.",
    },
  ];

  const activeMultiplierItem =
    multiplierItems[activeMultiplierIndex] ?? multiplierItems[0];

  const handleMultiplierTooltipOpenChange = (nextOpen) => {
    setShowMultiplierTooltip(nextOpen);
    if (nextOpen) {
      setActiveMultiplierIndex(0);
      multiplierTouchStartXRef.current = null;
    }
  };

  const showPreviousMultiplier = () => {
    setActiveMultiplierIndex((prevIndex) => {
      if (!multiplierItems.length) return 0;
      return (prevIndex - 1 + multiplierItems.length) % multiplierItems.length;
    });
  };

  const showNextMultiplier = () => {
    setActiveMultiplierIndex((prevIndex) => {
      if (!multiplierItems.length) return 0;
      return (prevIndex + 1) % multiplierItems.length;
    });
  };

  const handleMultiplierTouchStart = (event) => {
    if (!event.changedTouches?.length) return;
    multiplierTouchStartXRef.current = event.changedTouches[0].clientX;
  };

  const handleMultiplierTouchEnd = (event) => {
    if (!event.changedTouches?.length) return;
    const startX = multiplierTouchStartXRef.current;
    multiplierTouchStartXRef.current = null;
    if (!Number.isFinite(startX)) return;

    const endX = event.changedTouches[0].clientX;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < MULTIPLIER_SWIPE_THRESHOLD_PX) return;

    if (deltaX < 0) {
      showNextMultiplier();
      return;
    }

    showPreviousMultiplier();
  };

  const isLightUi = uiTheme === "light";

  const navItems = [
    {
      label: "Kollektion",
      icon: Leaf,
      onClick: () => {
        setShowEmbeddedCollection(true);
        setShowEmbeddedSettings(false);
        setShowEmbeddedAchievements(false);
        setShowEmbeddedFriends(false);
        setEmbeddedHeaderMeta(null);
        setEmbeddedCollectionPublicPanelOpen(false);
        setEmbeddedSelectedCollectionId("global");
        setShowHeroZoneMap(false);
        setShowHealthStatsPanel(false);
      },
      gradientClass: isLightUi
        ? "bg-gradient-to-b from-[#f8f1cf]/95 via-[#efe3b3]/95 to-[#e4d591]/95"
        : "bg-gradient-to-b from-[#2b4a3a]/78 via-[#1a2f25]/92 to-[#0b1713]/96",
      shadowStyle: isLightUi
        ? "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -12px 18px rgba(133,105,40,0.22), 0 8px 16px rgba(133,105,40,0.24)"
        : "inset 0 1px 0 rgba(214,255,230,0.2), inset 0 -12px 18px rgba(0,0,0,0.46), 0 8px 16px rgba(0,0,0,0.32)",
    },
    {
      label: "Erfolge",
      icon: Scroll,
      onClick: () => {
        setShowEmbeddedCollection(false);
        setShowEmbeddedSettings(false);
        setShowEmbeddedAchievements(true);
        setShowEmbeddedFriends(false);
        setEmbeddedHeaderMeta(null);
        setEmbeddedCollectionPublicPanelOpen(false);
        setEmbeddedSelectedCollectionId("global");
        setShowHeroZoneMap(false);
        setShowHealthStatsPanel(false);
      },
      gradientClass: isLightUi
        ? "bg-gradient-to-b from-[#f9e8c7]/95 via-[#f1d8a1]/95 to-[#e7c47d]/95"
        : "bg-gradient-to-b from-[#4f3d2b]/78 via-[#2f2118]/92 to-[#16100c]/96",
      shadowStyle: isLightUi
        ? "inset 0 1px 0 rgba(255,255,255,0.86), inset 0 -12px 18px rgba(157,94,34,0.22), 0 8px 16px rgba(157,94,34,0.24)"
        : "inset 0 1px 0 rgba(255,236,205,0.18), inset 0 -12px 18px rgba(0,0,0,0.48), 0 8px 16px rgba(0,0,0,0.32)",
    },
    {
      label: "Social",
      icon: Users,
      onClick: () => {
        setShowEmbeddedCollection(false);
        setShowEmbeddedSettings(false);
        setShowEmbeddedAchievements(false);
        setShowEmbeddedFriends(true);
        setEmbeddedHeaderMeta(null);
        setEmbeddedCollectionPublicPanelOpen(false);
        setEmbeddedSelectedCollectionId("global");
        setShowHeroZoneMap(false);
        setShowHealthStatsPanel(false);
      },
      gradientClass: isLightUi
        ? "bg-gradient-to-b from-[#e3edf8]/95 via-[#cfe1f4]/95 to-[#bad3ec]/95"
        : "bg-gradient-to-b from-[#29435a]/78 via-[#172a3f]/92 to-[#0c151f]/96",
      shadowStyle: isLightUi
        ? "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -12px 18px rgba(42,90,146,0.16), 0 8px 16px rgba(42,90,146,0.2)"
        : "inset 0 1px 0 rgba(210,235,255,0.18), inset 0 -12px 18px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.34)",
    },
    {
      label: "Shop",
      icon: ShoppingBag,
      onClick: () => navigate(createPageUrl("Shop")),
      gradientClass: isLightUi
        ? "bg-gradient-to-b from-[#f7e3d1]/95 via-[#efcfb0]/95 to-[#e7b98c]/95"
        : "bg-gradient-to-b from-[#5a3823]/78 via-[#3a2316]/92 to-[#1b1009]/96",
      shadowStyle: isLightUi
        ? "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -12px 18px rgba(122,74,37,0.22), 0 8px 16px rgba(122,74,37,0.22)"
        : "inset 0 1px 0 rgba(255,224,188,0.18), inset 0 -12px 18px rgba(0,0,0,0.48), 0 8px 16px rgba(0,0,0,0.34)",
    },
  ];

  const hasEmbeddedView =
    showEmbeddedCollection ||
    showEmbeddedSettings ||
    showEmbeddedAchievements ||
    showEmbeddedFriends;

  const embeddedTitle = showEmbeddedCollection
    ? "Kollektionen"
    : showEmbeddedSettings
      ? "Einstellungen"
      : showEmbeddedAchievements
        ? (embeddedHeaderMeta?.title || "Erfolge")
        : showEmbeddedFriends
          ? (embeddedHeaderMeta?.title || "Social")
          : null;

  const embeddedSubtitle = embeddedHeaderMeta?.subtitle || null;
  const embeddedInfoLabel = embeddedHeaderMeta?.infoLabel || null;
  const shouldDockEmbeddedChipHeader = showEmbeddedAchievements || showEmbeddedFriends;

  const handleRegenerateZones = async () => {
    if (isRegeneratingZones || !user?.id) return;

    const location = getCachedLocation();
    if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
      setZoneMapError("Standort fehlt. Bitte Standortfreigabe aktivieren.");
      return;
    }

    setIsRegeneratingZones(true);
    setZoneMapError(null);
    try {
      const daily = await getRobotPlantDailyZones({
        latitude: location.lat,
        longitude: location.lng,
        forceRegenerate: true,
      });

      const zones = daily?.zones || [];
      setHeroZones(zones);

      const inRangeZone = zones
        .map((zone) => {
          const dist = calculateDistanceMeters(
            location.lat,
            location.lng,
            Number(zone.centerLat),
            Number(zone.centerLng)
          );
          return { ...zone, distanceM: dist };
        })
        .filter((zone) => Number.isFinite(zone.distanceM) && zone.distanceM <= Number(zone.radiusM || 0))
        .sort((a, b) => a.distanceM - b.distanceM)[0];

      setActiveZone(inRangeZone || null);
    } catch (error) {
      const message = error?.message || "Zonen konnten nicht neu generiert werden.";
      setZoneMapError(String(message));
    } finally {
      setIsRegeneratingZones(false);
    }
  };

  return (
    <>
      <style>{`
        @media (max-height: 760px) {
          .home-tight-vh-label {
            display: none;
          }
        }
      `}</style>

      <AnimatePresence>
        {newAchievements.length > 0 && currentAchievementIndex < newAchievements.length && (
          <AchievementNotification
            achievement={newAchievements[currentAchievementIndex]}
            onComplete={() => {
              if (currentAchievementIndex < newAchievements.length - 1) {
                setCurrentAchievementIndex(currentAchievementIndex + 1);
              } else {
                setNewAchievements([]);
                setCurrentAchievementIndex(0);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scanFeedback && (
          <ScanFeedbackNotification
            feedback={scanFeedback}
            onComplete={() => setScanFeedback(null)}
          />
        )}
      </AnimatePresence>

      <Dialog open={isMigrating} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-green-600" />
              Migration läuft...
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Deine Daten werden migriert. Dies kann einen Moment dauern.
            </p>

            {migrationError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Migration fehlgeschlagen</p>
                    <p className="text-sm text-red-700 mt-1">{migrationError}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {migrationSteps.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initialisierung...</span>
                  </div>
                ) : (
                  migrationSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-green-800 animate-in fade-in duration-300">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>{step.name}</span>
                      {step.updated !== undefined && <span className="text-gray-500">({step.updated})</span>}
                    </div>
                  ))
                )}
              </div>
            )}

            {migrationError && (
              <Button
                onClick={() => {
                  setIsMigrating(false);
                  setMigrationError(null);
                  localStorage.removeItem('migration_pending');
                }}
                variant="outline"
                className="w-full"
              >
                Schließen
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <HomeBackgroundShell
        user={user}
        isLightUi={isLightUi}
        getRgbaFromRgb={getRgbaFromRgb}
      >
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            data-ui="home-main-content-shell"
            className={`relative h-full w-full max-w-md md:max-w-3xl rounded-[2rem] overflow-hidden border ${isLightUi ? "border-[#dfc98b]/75 shadow-[0_20px_64px_rgba(160,125,45,0.22)]" : "border-[#d7cf9c]/65 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"}`}
          >
            <div
              className="absolute inset-0"
              style={user?.background_image_url ? {
                backgroundImage: isLightUi
                  ? `linear-gradient(180deg, rgba(255,246,210,0.65) 0%, rgba(244,230,181,0.75) 100%), url(${user.background_image_url})`
                  : `linear-gradient(180deg, rgba(19,37,24,0.42) 0%, rgba(12,20,15,0.66) 100%), url(${user.background_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : user?.background_color ? {
                background: isLightUi
                  ? `linear-gradient(180deg, ${getRgbaFromRgb(user.background_color, 0.25)} 0%, rgba(255, 249, 225, 0.9) 100%)`
                  : `linear-gradient(180deg, ${getRgbaFromRgb(user.background_color, 0.28)} 0%, rgba(14, 22, 16, 0.74) 100%)`,
              } : {
                background: isLightUi
                  ? 'linear-gradient(180deg, rgba(255, 248, 221, 0.92) 0%, rgba(243, 229, 183, 0.9) 100%)'
                  : 'linear-gradient(180deg, rgba(126, 171, 98, 0.45) 0%, rgba(10, 22, 15, 0.78) 100%)',
              }}
            />
            <div className={`absolute inset-0 pointer-events-none rounded-[2rem] border ${isLightUi ? "border-[#f4e6b7]/85" : "border-[#f0e5a5]/30"}`} />

            <div className={`relative z-10 h-full flex flex-col px-4 md:px-8 py-4 md:py-6 ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
              <HomeHeaderBar
                isLightUi={isLightUi}
                embeddedTitle={embeddedTitle}
                embeddedSubtitle={embeddedSubtitle}
                embeddedInfoLabel={embeddedInfoLabel}
                hasEmbeddedView={hasEmbeddedView}
                showEmbeddedCollection={showEmbeddedCollection}
                showEmbeddedFriends={showEmbeddedFriends}
                showEmbeddedSettings={showEmbeddedSettings}
                embeddedCollectionPublicPanelOpen={embeddedCollectionPublicPanelOpen}
                displayName={getDisplayName()}
                displayNameFontSize={getNameFontSize(getDisplayName())}
                userTitle={user?.selected_title || user?.title || "Pflanzen-Entdecker"}
                onTogglePublicCollections={() => setEmbeddedCollectionPublicPanelOpen((prev) => !prev)}
                onOpenEmbeddedFriendsAddDialog={() => setEmbeddedFriendsAddDialogNonce((prev) => prev + 1)}
                onPrimaryAction={() => {
                  if (showEmbeddedCollection) {
                    setShowEmbeddedCollection(false);
                    setEmbeddedCollectionPublicPanelOpen(false);
                    setEmbeddedSelectedCollectionId("global");
                    return;
                  }
                  if (showEmbeddedSettings) {
                    setShowEmbeddedSettings(false);
                    return;
                  }
                  if (showEmbeddedAchievements) {
                    setShowEmbeddedAchievements(false);
                    return;
                  }
                  if (showEmbeddedFriends) {
                    setShowEmbeddedFriends(false);
                    return;
                  }
                  setShowEmbeddedSettings(true);
                  setShowHeroZoneMap(false);
                  setShowHealthStatsPanel(false);
                }}
              />

              <div
                className={`relative flex flex-1 min-h-0 flex-col overflow-hidden ${shouldDockEmbeddedChipHeader ? "py-0" : "py-[clamp(0.5rem,1.5vh,1rem)]"}`}
                data-ui="home-content-stack"
              >
                {showEmbeddedCollection ? (
                  <Collection
                    embedded
                    onRequestClose={() => {
                      setShowEmbeddedCollection(false);
                      setEmbeddedSelectedCollectionId("global");
                    }}
                    uiTheme={uiTheme}
                    initialCollectionId={embeddedSelectedCollectionId}
                    onSelectedCollectionIdChange={setEmbeddedSelectedCollectionId}
                    showPublicCollectionsPanel={embeddedCollectionPublicPanelOpen}
                    onShowPublicCollectionsPanelChange={setEmbeddedCollectionPublicPanelOpen}
                  />
                ) : showEmbeddedAchievements ? (
                  <AchievementsFeatureRoot
                    embedded
                    isLightUi={isLightUi}
                    onRequestClose={() => setShowEmbeddedAchievements(false)}
                    onHeaderMetaChange={setEmbeddedHeaderMeta}
                  />
                ) : showEmbeddedFriends ? (
                  <FriendsFeatureRoot
                    embedded
                    isLightUi={isLightUi}
                    onRequestClose={() => setShowEmbeddedFriends(false)}
                    onHeaderMetaChange={setEmbeddedHeaderMeta}
                    openAddFriendDialogNonce={embeddedFriendsAddDialogNonce}
                  />
                ) : showEmbeddedSettings ? (
                  <SettingsPanel
                    user={user}
                    onUserUpdated={(freshUser) => setUser(freshUser)}
                    uiTheme={uiTheme}
                    onUiThemeChange={setUiTheme}
                  />
                ) : showHeroZoneMap ? (
                  <section className={`relative flex-1 min-h-0 rounded-3xl border overflow-hidden ${
                    isLightUi
                      ? "border-[#c0a860]/50 backdrop-blur-xl"
                      : "border-[#f0e5a5]/25 bg-black/25 backdrop-blur-sm"
                  }`}
                  style={isLightUi ? {
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.05) 100%)'
                  } : {}}>
                    <HeroZoneMap3D
                      zones={heroZones}
                      userLocation={cachedLocation}
                      fallbackCenter={{ lat: heroMapCenter[0], lng: heroMapCenter[1] }}
                      onTokenError={(message) => setZoneMapError(message)}
                    />

                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 z-[1100] ${
                      isLightUi
                        ? "bg-gradient-to-b from-white/20 to-transparent"
                        : "bg-gradient-to-b from-black/60 to-transparent"
                    }`} />

                    <div className={`absolute left-4 top-4 z-[1200] rounded-xl border backdrop-blur-sm px-3 py-1.5 text-[11px] md:text-xs font-semibold flex items-center gap-1.5 ${
                      isLightUi
                        ? "border-[#c8ac62]/50 bg-white/55 text-stone-800"
                        : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
                    }`}>
                      <MapIcon className="w-3.5 h-3.5" />
                      Zonen: {heroZones.length}
                    </div>

                    {zoneMapError && (
                      <div className={`absolute left-4 right-4 top-16 z-[1200] rounded-xl border backdrop-blur-sm px-3 py-2 text-[11px] md:text-xs font-medium ${
                        isLightUi
                          ? "border-red-400/40 bg-red-200/65 text-red-800"
                          : "border-red-300/50 bg-red-900/55 text-red-100"
                      }`}>
                        {zoneMapError}
                      </div>
                    )}

                    <div className="absolute left-4 right-4 bottom-4 z-[1200] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowHeroZoneMap(false)}
                        className={`h-10 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-semibold ${
                          isLightUi
                            ? "border-[#c8ac62]/55 bg-white/60 text-stone-800 hover:bg-white/70"
                            : "border-[#f0e5a5]/45 bg-black/55 text-stone-100 hover:bg-black/70"
                        } transition-colors`}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Zurück
                      </button>

                      <button
                        type="button"
                        onClick={handleRegenerateZones}
                        disabled={isRegeneratingZones || isLoadingZone}
                        className={`h-10 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-semibold disabled:opacity-60 ${
                          isLightUi
                            ? "border-[#c8ac62]/55 bg-white/60 text-stone-800 hover:bg-white/70"
                            : "border-[#f0e5a5]/45 bg-black/55 text-stone-100 hover:bg-black/70"
                        } transition-colors`}
                      >
                        {isRegeneratingZones ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Neu
                      </button>
                    </div>
                  </section>
                ) : (
                  <section data-ui="home-plant-hero-section" className={`flex-1 min-h-0 rounded-3xl border px-[clamp(0.75rem,2vw,1.5rem)] py-[clamp(0.75rem,2vh,1.5rem)] flex flex-col ${
                    isLightUi
                      ? "border-[#c0a860]/50 backdrop-blur-xl"
                      : "border-[#f0e5a5]/25 bg-black/25 backdrop-blur-sm"
                  }`}
                  style={isLightUi ? {
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 35%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.1) 100%)'
                  } : {}}>
                  <div ref={healthStatsPanelRef} className="flex-1 min-h-0 flex items-center justify-center">
                    <div
                      className="relative mx-auto"
                      style={{
                        width: heroStageSizePx > 0 ? `${heroStageSizePx}px` : "100%",
                        height: heroStageSizePx > 0 ? `${heroStageSizePx}px` : "100%",
                        maxWidth: "100%",
                        maxHeight: "100%",
                        aspectRatio: "1 / 1",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setShowHealthStatsPanel((prev) => !prev)}
                        className={`absolute left-0 md:left-2 top-5 md:top-6 z-10 w-[4.4rem] h-[3.6rem] md:w-[4.9rem] md:h-[3.9rem] rounded-2xl border backdrop-blur-sm flex flex-col items-center justify-center ${
                          isLightUi
                            ? "border-[#c8ac62]/60"
                            : "border-[#f0e5a5]/40"
                        }`}
                        style={{
                          background: isLightUi
                            ? `linear-gradient(135deg, ${plantHealthState.color}35 0%, ${plantHealthState.color}15 100%)`
                            : `linear-gradient(135deg, ${plantHealthState.color}7a 0%, ${plantHealthState.color}4d 100%)`,
                        }}
                        aria-label="Pflanzenstatus ein- oder ausklappen"
                      >
                        <Leaf className={`w-4 h-4 ${isLightUi ? "text-stone-700" : "text-white/90"}`} />
                        <span className={`font-bold text-[11px] md:text-xs leading-none mt-0.5 ${isLightUi ? "text-stone-800" : "text-white"}`}>{overallPlantHealth}%</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeroZoneMap(true);
                          setShowHealthStatsPanel(false);
                        }}
                        aria-label="Zonenkarte in Plant-Hero öffnen"
                        className={`absolute right-0 md:right-2 top-5 md:top-6 z-10 w-[4.4rem] h-[3.6rem] md:w-[4.9rem] md:h-[3.9rem] rounded-2xl border backdrop-blur-sm flex flex-col items-center justify-center ${
                          isLightUi
                            ? "border-[#c8ac62]/60"
                            : "border-[#f0e5a5]/40"
                        }`}
                        style={{
                          background: isLightUi
                            ? `linear-gradient(135deg, ${currentZoneColor}35 0%, ${currentZoneColor}15 100%)`
                            : `linear-gradient(135deg, ${currentZoneColor}7a 0%, ${currentZoneColor}4d 100%)`,
                        }}
                      >
                        <ZoneIcon className={`w-4 h-4 ${isLightUi ? "text-stone-700" : "text-white/90"}`} />
                        <span className={`font-semibold text-[11px] md:text-xs leading-none mt-0.5 truncate max-w-[85%] ${isLightUi ? "text-stone-800" : "text-white"}`}>
                          {isLoadingZone ? "..." : activeZoneMeta?.label || "Leer"}
                        </span>
                      </button>

                      <AnimatePresence mode="wait">
                        {showHealthStatsPanel ? (
                          <motion.div
                            key="hero-stats"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.16, ease: "easeOut" }}
                            className="absolute inset-0 px-0 pt-[5.5rem] md:pt-[5.8rem] flex flex-col justify-start"
                          >
                            <div className="space-y-2.5 w-full">
                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] md:text-xs text-stone-100/90">
                                <div className="font-semibold uppercase tracking-wide text-stone-50">
                                  {plantHealthState.label}
                                </div>
                                <div className="text-stone-200/80">
                                  Gesundheitsbonus auf Scan-Events: <strong>+{healthStateBonus}</strong>
                                </div>
                              </div>
                              {healthStats.map((stat) => (
                                <div key={stat.id} className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] md:text-xs text-stone-100/90">
                                    <LockedTooltip
                                      content={
                                        <span className="text-xs leading-relaxed">{HEALTH_TOOLTIP_TEXT[stat.id] || "Wert der Robopflanze"}</span>
                                      }
                                    >
                                      <button
                                        type="button"
                                        className="font-semibold uppercase tracking-wide underline decoration-dotted underline-offset-2"
                                        aria-label={`${stat.label} Info`}
                                      >
                                        {stat.label}
                                      </button>
                                    </LockedTooltip>
                                    <span className="font-bold">{stat.value}%</span>
                                  </div>
                                  <div className="h-2 rounded-full overflow-hidden bg-black/35 border border-black/25">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${stat.value}%`,
                                        background: `linear-gradient(90deg, ${stat.color} 0%, rgba(255,255,255,0.78) 100%)`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="hero-plant"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.16, ease: "easeOut" }}
                            className="absolute inset-0"
                          >
                            <div
                              className={`absolute left-1/2 top-1/2 w-[82%] -translate-x-1/2 -translate-y-1/2 aspect-square rounded-full border backdrop-blur-sm shadow-[inset_0_0_30px_rgba(190,242,100,0.15)] ${
                                isLightUi
                                  ? "border-[#b8d4a8]/55 bg-gradient-to-b from-emerald-50/75 to-emerald-100/45"
                                  : "border-[#f0e5a5]/35 bg-gradient-to-b from-emerald-100/25 to-emerald-900/45"
                              }`}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Leaf className={`w-20 h-20 md:w-24 md:h-24 drop-shadow-[0_0_24px_rgba(190,242,100,0.6)] ${
                                isLightUi
                                  ? "text-emerald-600"
                                  : "text-lime-200"
                              }`} />
                            </div>

                            <div className="absolute left-1/2 top-1/2 w-[82%] aspect-square -translate-x-1/2 -translate-y-1/2">
                              {[
                                'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
                                'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
                                'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
                                'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2',
                              ].map((position, index) => (
                                <button
                                  key={`slot-${index}`}
                                  type="button"
                                  className={`absolute ${position} w-12 h-12 md:w-14 md:h-14 rounded-2xl border backdrop-blur-sm flex items-center justify-center transition-colors ${
                                    isLightUi
                                      ? "border-[#c8ac62]/55 bg-white/50 text-stone-700 hover:bg-white/65"
                                      : "border-[#f0e5a5]/45 bg-black/35 text-[#f0e5a5] hover:bg-black/50"
                                  }`}
                                  aria-label={`Plus Slot ${index + 1}`}
                                >
                                  <Plus className="w-6 h-6" />
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  </div>

                  <div
                    className={`mt-[clamp(0.5rem,1.2vh,1rem)] w-full rounded-2xl border backdrop-blur-sm px-[clamp(0.625rem,2vw,0.875rem)] ${
                      isLightUi
                        ? "border-[#c8ac62]/45 bg-gradient-to-r from-emerald-100/50 via-white/40 to-emerald-100/50"
                        : "border-[#f0e5a5]/45 bg-gradient-to-r from-emerald-900/45 via-black/30 to-emerald-900/45"
                    }`}
                    style={{ height: `${(2.4 * controlsScale).toFixed(2)}rem` }}
                  >
                    <div className={`h-full w-full flex items-center justify-between text-xs md:text-sm font-semibold ${
                      isLightUi ? "text-stone-700" : ""
                    }`}>
                      <Popover open={showSeedsTooltip} onOpenChange={setShowSeedsTooltip}>
                        <PopoverTrigger asChild>
                          <div className={`flex items-center gap-1.5 min-w-0 cursor-pointer transition-colors ${
                            isLightUi
                              ? "text-stone-700 hover:text-stone-800"
                              : "text-lime-100/95 hover:text-lime-100"
                          }`}>
                            <Leaf className={`w-4 h-4 ${isLightUi ? "text-emerald-600" : "text-lime-200"}`} />
                            <span className="truncate">{playerSeeds}</span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 bg-emerald-950/95 border-amber-600/40 text-amber-50/90">
                          <div className="space-y-2">
                            <h3 className="font-semibold text-lime-200">Samen</h3>
                            <p className="text-xs text-amber-50/70">
                              Werden verwendet um neue Items zu freischalten, welche die Pflanzepflege erleichtern. Voraussichtlich werden auch Cosmetics verfügbar sein. Die genaue Verwendung wird noch definiert.
                            </p>
                            <p className="text-xs text-amber-100/50 italic">💡 Status: In Entwicklung</p>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover open={showMultiplierTooltip} onOpenChange={handleMultiplierTooltipOpenChange}>
                        <PopoverTrigger asChild>
                          <div className={`flex items-center gap-1.5 min-w-0 cursor-pointer transition-colors ${
                            isLightUi
                              ? "text-stone-700 hover:text-stone-800"
                              : "text-amber-100/95 hover:text-amber-100"
                          }`}>
                            <div className={`h-5 w-px ${isLightUi ? "bg-[#c8ac62]/40" : "bg-[#f0e5a5]/35"}`} />
                            <Zap className={`w-4 h-4 ${isLightUi ? "text-amber-700" : "text-amber-300"}`} />
                            <span className="truncate">
                              Nächster Scan {formatMultiplier(knownNextScanMultiplier)}
                            </span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 bg-emerald-950/95 border-amber-600/40 text-amber-50/90">
                          <div className="space-y-3">
                            <h3 className="font-semibold text-amber-300">Multiplikatoren</h3>
                            <div
                              className="rounded-lg border border-amber-600/30 bg-black/20 p-3 text-xs space-y-2"
                              onTouchStart={handleMultiplierTouchStart}
                              onTouchEnd={handleMultiplierTouchEnd}
                            >
                              <div className="text-amber-300 font-semibold">
                                {activeMultiplierItem.title}: <strong>{activeMultiplierItem.value}</strong>
                              </div>
                              <div className="text-amber-50/80 min-h-[2.5rem]">
                                {activeMultiplierItem.description}
                              </div>
                              <div className="flex items-center justify-center gap-2 pt-0.5">
                                {multiplierItems.map((item, index) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setActiveMultiplierIndex(index)}
                                    aria-label={`Multiplikator ${index + 1} von ${multiplierItems.length} anzeigen`}
                                    className={
                                      "h-2.5 w-2.5 rounded-full transition-colors " +
                                      (index === activeMultiplierIndex
                                        ? "bg-amber-300"
                                        : "bg-amber-100/35 hover:bg-amber-100/60")
                                    }
                                  />
                                ))}
                              </div>
                              <div className="text-[11px] text-amber-50/55 text-center">
                                Wische nach links/rechts oder tippe auf die Punkte.
                              </div>
                            </div>
                            <div className="rounded-lg border border-amber-600/25 bg-black/20 p-2.5 text-xs space-y-1">
                              <div className="text-amber-300 font-semibold">Aktuell bekannter Gesamtfaktor</div>
                              <div className="text-amber-50/90">
                                {formatMultiplier(streakMultiplier)} × {formatMultiplier(zoneMultiplier)} × {formatMultiplier(careMultiplier)} × {formatMultiplier(dailyBonusMultiplier)} = <strong>{formatMultiplier(knownNextScanMultiplier)}</strong>
                              </div>
                              <div className="text-amber-50/70">
                                Zustand <strong>{plantHealthState.label}</strong> gibt aktuell <strong>+{healthStateBonus}</strong> auf alle Scan-Events.
                              </div>
                              <div className="text-amber-50/65">
                                Mit Neuheit und Raritaet liegt der Bereich bei <strong>{formatMultiplier(nextScanMinMultiplier)}</strong> bis <strong>{formatMultiplier(nextScanMaxMultiplier)}</strong> (~{nextScanMinReward}-{nextScanMaxReward} Seeds).
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <motion.button
                    onClick={() => navigate(createPageUrl('Scanner'))}
                    className={`mt-[clamp(0.625rem,1.6vh,1.25rem)] w-full rounded-2xl border flex items-center justify-center font-semibold tracking-wide transition-shadow ${
                      isLightUi
                        ? "border-emerald-400/50 bg-gradient-to-r from-emerald-500/85 via-emerald-400/75 to-emerald-500/85 text-white shadow-[0_8px_24px_rgba(34,197,94,0.2)] hover:shadow-[0_12px_32px_rgba(34,197,94,0.35)]"
                        : "border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 text-white shadow-[0_8px_24px_rgba(34,197,94,0.3)]"
                    }`}
                    style={{
                      height: `${(3.35 * controlsScale).toFixed(2)}rem`,
                      gap: `${(0.56 * controlsScale).toFixed(2)}rem`,
                      fontSize: `${(1.15 * controlsScale).toFixed(2)}rem`,
                    }}
                    animate={showScannerHighlight ? { scale: [1, 1.02, 1] } : {}}
                    transition={showScannerHighlight ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : {}}
                  >
                    <Camera
                      style={{
                        width: `${(1.45 * controlsScale).toFixed(2)}rem`,
                        height: `${(1.45 * controlsScale).toFixed(2)}rem`,
                      }}
                    />
                    Scannen
                  </motion.button>
                  </section>
                )}
              </div>

              <HomeBottomNavigation
                navItems={navItems}
                isLightUi={isLightUi}
                controlsScale={controlsScale}
              />
            </div>
          </motion.div>

      </HomeBackgroundShell>
    </>
  );
}
