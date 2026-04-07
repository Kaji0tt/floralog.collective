import React, { useState, useEffect, useRef } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { upsertUserProfile } from "@/api/authService";
import { executeMigration } from "@/api/migrationService";
import { getRobotPlantDailyZones } from "@/api/robotPlantService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Leaf, Settings, Plus, ShoppingBag, Users, Scroll, CheckCircle, AlertCircle, TreePine, Building2, Waves, Flower2, Minus, ArrowLeft, RefreshCw, Map as MapIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import AchievementNotification from "../components/achievements/AchievementNotification";
import ScanFeedbackNotification from "../components/notifications/ScanFeedbackNotification";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getNameFontSize } from "@/lib/utils";
import { getCachedLocation } from "@/lib/locationSync";
import { Button } from "@/components/ui/button";
import { updateQuestProgress } from "@/components/utils/questProgress";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getWeekNumber, getMonthString, getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";
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
 *   zones?: Array<{ centerLat: number | string; centerLng: number | string; radiusM?: number | string; theme?: string; zoneKey?: string; id?: string }>;
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
          return {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [toCirclePolygon({ lat, lng, radiusM })],
            },
            properties: {
              id: zone.zoneKey || zone.id || `${lat}-${lng}`,
              color,
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

  return <div ref={mapContainerRef} className="absolute inset-0 z-0" />;
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

  const [scanFeedback, setScanFeedback] = useState(null);

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

  // Consume scan feedback from navigation state exactly once per navigation
  useEffect(() => {
    if (location.state && location.state.scanFeedback) {
      // Show feedback from navigation state
      setScanFeedback(location.state.scanFeedback);

      // Remove scanFeedback from history state so it won't re-trigger
      const { scanFeedback: _ignored, ...restState } = location.state;
      const nextState = Object.keys(restState).length > 0 ? restState : null;

      navigate(location.pathname + location.search, {
        replace: true,
        state: nextState,
      });
    }
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
        setHeroZones([]);
        setActiveZone(null);
        setZoneMapError("Zonen konnten nicht geladen werden.");
      } finally {
        setIsLoadingZone(false);
      }
    };

    loadZoneForHero();
  }, [user?.id]);

  useEffect(() => {
    if (!showHealthStatsPanel) return;

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

  const overallPlantHealth =
    safeEnergy <= 0 || safeDataQuality <= 0 || safeCare <= 0
      ? 0
      : Math.round(
          3 /
            (1 / safeEnergy + 1 / safeDataQuality + 1 / safeCare)
        );

  const plantHealthState =
    overallPlantHealth < 25
      ? { label: "Kritisch", color: "#dc2626" }
      : overallPlantHealth < 45
        ? { label: "Schwach", color: "#f97316" }
        : overallPlantHealth < 70
          ? { label: "Stabil", color: "#f59e0b" }
          : { label: "Vital", color: "#22c55e" };

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
  const ZoneIcon = activeZoneMeta?.Icon || Minus;
  const healthStats = [
    { id: "energy", label: "Energie", value: Math.round(safeEnergy), color: "#10b981" },
    { id: "data-quality", label: "Daten", value: Math.round(safeDataQuality), color: "#06b6d4" },
    { id: "care", label: "Pflege", value: Math.round(safeCare), color: "#f59e0b" },
  ];

  const navItems = [
    { label: "Kollektion", icon: Leaf, onClick: () => navigate(createPageUrl("Collection")) },
    { label: "Quests", icon: Scroll, onClick: () => navigate(createPageUrl("Quests")) },
    { label: "Social", icon: Users, onClick: () => navigate(createPageUrl("Friends")) },
    { label: "Shop", icon: ShoppingBag, onClick: () => navigate(createPageUrl("Shop")) },
  ];

  const footerTextColor = averageColor
    ? (isColorDark(averageColor) ? "rgba(245,245,244,0.96)" : "rgba(28,25,23,0.88)")
    : "rgba(245,245,244,0.92)";
  const footerTextShadow = averageColor && isColorDark(averageColor)
    ? "0 2px 8px rgba(0,0,0,0.7)"
    : "0 1px 5px rgba(255,255,255,0.35)";

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

      <div className="fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={user?.background_image_url ? {
            backgroundImage: `url(${user.background_image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : user?.background_color ? {
            background: `linear-gradient(160deg, ${getRgbaFromRgb(user.background_color, 1)} 0%, ${getRgbaFromRgb(user.background_color, 0.55)} 100%)`,
          } : {
            background: 'radial-gradient(circle at top, rgb(167, 243, 208) 0%, rgb(22, 101, 52) 60%, rgb(10, 30, 18) 100%)',
          }}
        />
        <div className="absolute inset-0 backdrop-blur-3xl" />

        <div className="relative z-10 h-full w-full p-3 md:p-6 flex items-start justify-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            data-ui="home-main-content-shell"
            className="relative h-[calc(100%-3.25rem)] md:h-[calc(100%-3.6rem)] w-full max-w-md md:max-w-3xl rounded-[2rem] overflow-hidden border border-[#d7cf9c]/65 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
          >
            <div
              className="absolute inset-0"
              style={user?.background_image_url ? {
                backgroundImage: `linear-gradient(180deg, rgba(19,37,24,0.42) 0%, rgba(12,20,15,0.66) 100%), url(${user.background_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : user?.background_color ? {
                background: `linear-gradient(180deg, ${getRgbaFromRgb(user.background_color, 0.28)} 0%, rgba(14, 22, 16, 0.74) 100%)`,
              } : {
                background: 'linear-gradient(180deg, rgba(126, 171, 98, 0.45) 0%, rgba(10, 22, 15, 0.78) 100%)',
              }}
            />
            <div className="absolute inset-0 border border-[#f0e5a5]/30 pointer-events-none rounded-[2rem]" />

            <div className="relative z-10 h-full flex flex-col px-4 md:px-8 py-4 md:py-6 text-stone-100">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#f0e5a5]/20">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <h1
                      className="font-bold leading-tight truncate"
                      style={{ fontSize: getNameFontSize(getDisplayName()) }}
                      title={getDisplayName()}
                    >
                      {getDisplayName()}
                    </h1>
                    <p className="text-stone-200/85 text-base md:text-lg whitespace-nowrap truncate">
                      {user.selected_title || user.title || 'Pflanzen-Entdecker'}
                    </p>
                  </div>
                  <div className="hidden mt-1 h-8 items-center gap-1" aria-hidden="true">
                    <span className="w-8 h-8 rounded-full border border-white/25 bg-white/10" />
                    <span className="w-8 h-8 rounded-full border border-white/25 bg-white/10" />
                    <span className="w-8 h-8 rounded-full border border-white/25 bg-white/10" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(createPageUrl('Profile'))}
                  className="w-11 h-11 rounded-full border border-[#f0e5a5]/35 bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/45 transition-colors"
                  aria-label="Einstellungen"
                >
                  <Settings className="w-5 h-5 text-[#f0e5a5]" />
                </button>
              </div>

              <div className="flex-1 min-h-0 py-4">
                {showHeroZoneMap ? (
                  <section className="relative h-full rounded-3xl border border-[#f0e5a5]/25 bg-black/25 backdrop-blur-sm overflow-hidden">
                    <HeroZoneMap3D
                      zones={heroZones}
                      userLocation={cachedLocation}
                      fallbackCenter={{ lat: heroMapCenter[0], lng: heroMapCenter[1] }}
                      onTokenError={(message) => setZoneMapError(message)}
                    />

                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 z-[1100] bg-gradient-to-b from-black/60 to-transparent" />

                    <div className="absolute left-4 top-4 z-[1200] rounded-xl border border-[#f0e5a5]/35 bg-black/55 backdrop-blur-sm px-3 py-1.5 text-[11px] md:text-xs font-semibold text-stone-100 flex items-center gap-1.5">
                      <MapIcon className="w-3.5 h-3.5" />
                      Zonen: {heroZones.length}
                    </div>

                    {zoneMapError && (
                      <div className="absolute left-4 right-4 top-16 z-[1200] rounded-xl border border-red-300/50 bg-red-900/55 backdrop-blur-sm px-3 py-2 text-[11px] md:text-xs font-medium text-red-100">
                        {zoneMapError}
                      </div>
                    )}

                    <div className="absolute left-4 right-4 bottom-4 z-[1200] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowHeroZoneMap(false)}
                        className="h-10 px-3 rounded-xl border border-[#f0e5a5]/45 bg-black/55 backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-semibold text-stone-100"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Zurück
                      </button>

                      <button
                        type="button"
                        onClick={handleRegenerateZones}
                        disabled={isRegeneratingZones || isLoadingZone}
                        className="h-10 px-3 rounded-xl border border-[#f0e5a5]/45 bg-black/55 backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-semibold text-stone-100 disabled:opacity-60"
                      >
                        {isRegeneratingZones ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Neu
                      </button>
                    </div>
                  </section>
                ) : (
                  <div className="h-full flex flex-col justify-between">
                    <section data-ui="home-plant-hero-section" className="rounded-3xl border border-[#f0e5a5]/25 bg-black/25 backdrop-blur-sm px-4 py-5 md:px-6 md:py-6">
                  <div ref={healthStatsPanelRef} className="mb-3">
                    <div className="relative mx-auto w-[16rem] h-[16rem] md:w-[19rem] md:h-[19rem]">
                      <button
                        type="button"
                        onClick={() => setShowHealthStatsPanel((prev) => !prev)}
                        className="absolute left-0 md:left-2 top-5 md:top-6 z-10 w-[4.4rem] h-[3.6rem] md:w-[4.9rem] md:h-[3.9rem] rounded-2xl border border-[#f0e5a5]/40 backdrop-blur-sm flex flex-col items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${plantHealthState.color}7a 0%, ${plantHealthState.color}4d 100%)`,
                        }}
                        aria-label="Pflanzenstatus ein- oder ausklappen"
                      >
                        <Leaf className="w-4 h-4 text-white/90" />
                        <span className="font-bold text-white text-[11px] md:text-xs leading-none mt-0.5">{overallPlantHealth}%</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeroZoneMap(true);
                          setShowHealthStatsPanel(false);
                        }}
                        aria-label="Zonenkarte in Plant-Hero öffnen"
                        className="absolute right-0 md:right-2 top-5 md:top-6 z-10 w-[4.4rem] h-[3.6rem] md:w-[4.9rem] md:h-[3.9rem] rounded-2xl border border-[#f0e5a5]/40 backdrop-blur-sm flex flex-col items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${currentZoneColor}7a 0%, ${currentZoneColor}4d 100%)`,
                        }}
                      >
                        <ZoneIcon className="w-4 h-4 text-white/90" />
                        <span className="font-semibold text-white text-[11px] md:text-xs leading-none mt-0.5 truncate max-w-[85%]">
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
                            className="absolute inset-7 rounded-3xl border border-[#f0e5a5]/35 bg-black/35 backdrop-blur-sm px-4 py-4 md:px-5 md:py-5 flex flex-col justify-center"
                          >
                            <div className="mb-2 text-center text-[11px] md:text-xs text-stone-200/90 font-semibold uppercase tracking-[0.08em]">
                              Plant Health • {plantHealthState.label}
                            </div>
                            <div className="space-y-2.5">
                              {healthStats.map((stat) => (
                                <div key={stat.id} className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] md:text-xs text-stone-100/90">
                                    <span className="font-semibold uppercase tracking-wide">{stat.label}</span>
                                    <span className="font-bold">{stat.value}%</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-black/35 border border-white/10 overflow-hidden">
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
                            <div className="absolute inset-7 rounded-full border border-[#f0e5a5]/35 bg-gradient-to-b from-emerald-100/25 to-emerald-900/45 backdrop-blur-sm shadow-[inset_0_0_30px_rgba(190,242,100,0.15)]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Leaf className="w-20 h-20 md:w-24 md:h-24 text-lime-200 drop-shadow-[0_0_24px_rgba(190,242,100,0.6)]" />
                            </div>

                            {[
                              'left-0 top-1/2 -translate-y-1/2',
                              'right-0 top-1/2 -translate-y-1/2',
                              'left-1/2 top-0 -translate-x-1/2',
                              'left-1/2 bottom-0 -translate-x-1/2',
                            ].map((position, index) => (
                              <button
                                key={`slot-${index}`}
                                type="button"
                                className={`absolute ${position} w-12 h-12 md:w-14 md:h-14 rounded-2xl border border-[#f0e5a5]/45 bg-black/35 backdrop-blur-sm flex items-center justify-center text-[#f0e5a5] hover:bg-black/50 transition-colors`}
                                aria-label={`Plus Slot ${index + 1}`}
                              >
                                <Plus className="w-6 h-6" />
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  </div>

                  <div className="mt-4 w-full h-10 rounded-2xl border border-[#f0e5a5]/45 bg-emerald-700/30 backdrop-blur-sm flex items-center justify-center text-xs md:text-sm font-semibold text-lime-100/90">
                    Samen {playerSeeds}
                  </div>

                  <motion.button
                    onClick={() => navigate(createPageUrl('Scanner'))}
                    className="mt-5 w-full h-14 md:h-16 rounded-2xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 flex items-center justify-center gap-3 text-lg md:text-2xl font-semibold tracking-wide shadow-[0_8px_24px_rgba(34,197,94,0.3)]"
                    animate={showScannerHighlight ? { scale: [1, 1.02, 1] } : {}}
                    transition={showScannerHighlight ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : {}}
                  >
                    <Camera className="w-6 h-6 md:w-7 md:h-7" />
                    Scannen
                  </motion.button>
                  </section>

                  <div className="mt-4">
                    <div className="grid grid-cols-4 gap-2 md:gap-3">
                      {navItems.map((item) => (
                        <button
                          key={item.label}
                          onClick={item.onClick}
                          className="rounded-2xl border border-[#d7cf9c]/65 bg-black/35 hover:bg-black/50 transition-colors py-3 md:py-4 flex flex-col items-center gap-1"
                        >
                          <item.icon className="w-5 h-5 md:w-6 md:h-6 text-lime-100" />
                          <span className="home-tight-vh-label text-xs md:text-sm font-semibold">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>
          </motion.div>

          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex justify-center gap-3 text-sm font-medium"
            style={{ color: footerTextColor, textShadow: footerTextShadow }}
          >
            <button onClick={() => navigate(createPageUrl('Donate'))} className="hover:opacity-80 transition-opacity">Spenden</button>
            <span className="opacity-70">•</span>
            <button onClick={() => navigate(createPageUrl('Impressum'))} className="hover:opacity-80 transition-opacity">Impressum</button>
            <span className="opacity-70">•</span>
            <button onClick={() => navigate(createPageUrl('News'))} className="hover:opacity-80 transition-opacity">News</button>
          </div>
        </div>
      </div>
    </>
  );
}
