import React, { useState, useEffect, useRef } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { upsertUserProfile } from "@/api/authService";
import { executeMigration } from "@/api/migrationService";
import { createUserNotification } from "@/api/notificationService";
import { supabase } from "@/api/supabaseClient";
import {
  getRobotPlantDailyZones,
  listRobotPlantShopItems,
  listRobotPlantInventory,
  listRobotPlantActiveEffects,
  getRobotPlantDailyCareStatus,
  useRobotPlantInventoryItem,
  waterRobotPlant,
} from "@/api/robotPlantService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Leaf, Plus, ShoppingBag, Users, Scroll, CheckCircle, AlertCircle, TreePine, Building2, Waves, Flower2, MapPin, ArrowLeft, RefreshCw, Map as MapIcon, Zap, Bug } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AchievementNotification from "../components/achievements/AchievementNotification";
import ScanFeedbackNotification from "../components/notifications/ScanFeedbackNotification";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getNameFontSize } from "@/lib/utils";
import { cacheLocation, getCachedLocation, LOCATION_CACHE_MAX_AGE_MS, requestCurrentLocation } from "@/lib/locationSync";
import {
  computeCareMultiplier,
  computeFirstScanOfDayMultiplier,
  computeOverallPlantHealth,
  computePlantHealthState,
} from "@/lib/robotPlantEconomy";
import { calculateDistanceMetersRaw, NEARBY_DISCOVERY_RADIUS_METERS, parseDiscoveryCoordinates } from "@/lib/discoveryMap";
import { Button } from "@/components/ui/button";
import { updateQuestProgress } from "@/components/utils/questProgress";
import Collection from "./Collection";
import SettingsFeatureRoot from "@/components/settings/SettingsFeatureRoot";
import HomeHeaderBar from "@/components/navigation/HomeHeaderBar";
import HomeBottomNavigation from "@/components/navigation/HomeBottomNavigation";
import { getNavButtonStyle } from "@/components/navigation/navButtonStyles";
import HomeBackgroundShell from "@/components/home/HomeBackgroundShell";
import GuestHomeFlow from "@/components/home/GuestHomeFlow";
import ShopFeatureRoot from "@/components/shop/ShopFeatureRoot";
import PlantHeroHealthPanel from "@/components/home/PlantHeroHealthPanel";
import AchievementsFeatureRoot from "@/components/achievements/AchievementsFeatureRoot";
import FriendsFeatureRoot from "@/components/friends/FriendsFeatureRoot";
import { TileVisualizationPanel } from "@/components/admin/TileVisualizationPanel";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";
import { useUiTheme } from "@/lib/UiThemeContext";
import { useAuth } from "@/lib/AuthContext";

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



const MULTIPLIER_SWIPE_THRESHOLD_PX = 36;
const SOCIAL_NEWS_NOTIFICATION_TYPES = [
  "gift_received",
  "collection_followed",
  "friendship_accepted",
  "friend_request_received",
  "friend_achievement",
  "scan_liked",
];

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isLightUi } = useUiTheme();
  const {
    zoneGenerationDay,
    hasCalledZoneGenerationToday,
    setZoneGenerationDayForUser,
  } = useAuth();
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
  const [zoneRerollsRemaining, setZoneRerollsRemaining] = useState(null);
  const [showHeroZoneMap, setShowHeroZoneMap] = useState(false);
  const [zoneMapError, setZoneMapError] = useState(null);
  const [isResolvingHeroMapLocation, setIsResolvingHeroMapLocation] = useState(false);
  const [hasResolvedZoneBootstrap, setHasResolvedZoneBootstrap] = useState(false);
  const [showHealthStatsPanel, setShowHealthStatsPanel] = useState(false);
  const healthStatsPanelRef = useRef(null);
  const [heroStageSizePx, setHeroStageSizePx] = useState(0);
  const [heroMapInstance, setHeroMapInstance] = useState(null);
  const [showDebugZonePanel, setShowDebugZonePanel] = useState(false);

  const [showSeedsTooltip, setShowSeedsTooltip] = useState(false);
  const [showMultiplierTooltip, setShowMultiplierTooltip] = useState(false);
  const [activeMultiplierIndex, setActiveMultiplierIndex] = useState(0);
  const multiplierTouchStartXRef = useRef(null);

  const [scanFeedback, setScanFeedback] = useState(null);
  const [activePanel, setActivePanel] = useState(null);
  const [shopOpenCategory, setShopOpenCategory] = useState("fertilizer");
  const [careActionMessage, setCareActionMessage] = useState(null);
  const [careGainFeedback, setCareGainFeedback] = useState(null);
  const [embeddedHeaderMeta, setEmbeddedHeaderMeta] = useState(null);
  const [embeddedFriendsAddDialogNonce, setEmbeddedFriendsAddDialogNonce] = useState(0);
  const [embeddedCollectionPublicPanelOpen, setEmbeddedCollectionPublicPanelOpen] = useState(false);
  const [embeddedSelectedCollectionId, setEmbeddedSelectedCollectionId] = useState("global");

  useEffect(() => {
    if (activePanel !== "collection") {
      setEmbeddedCollectionPublicPanelOpen(false);
      setEmbeddedSelectedCollectionId("global");
    }
  }, [activePanel]);

  useEffect(() => {
    if (!["achievements", "friends", "shop"].includes(activePanel)) {
      setEmbeddedHeaderMeta(null);
    }
  }, [activePanel]);

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

  const { data: pendingFriendRequests = [] } = useQuery({
    queryKey: ['pendingFriendRequests', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await Query.Friend.list();
      return allFriends.filter((friendship) =>
        friendship.request_sent_to?.toLowerCase() === user.email.toLowerCase() &&
        friendship.status === 'pending'
      );
    },
    enabled: !!user?.email,
    initialData: [],
    staleTime: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: unreadFriendsNewsCount = 0 } = useQuery({
    queryKey: ['friendsUnreadNewsCount', user?.id, user?.email],
    queryFn: async () => {
      if (!user?.email) return 0;

      const [byAuthId, byEmail] = await Promise.all([
        user?.id ? Query.UserNotification.filter({ auth_id: user.id }) : Promise.resolve([]),
        Query.UserNotification.filter({ user_email: user.email }),
      ]);

      const dedupedMap = new Map();
      [...byAuthId, ...byEmail].forEach((notification) => {
        dedupedMap.set(notification.id, notification);
      });

      return Array.from(dedupedMap.values()).filter(
        (notification) =>
          SOCIAL_NEWS_NOTIFICATION_TYPES.includes(notification.notification_type) &&
          notification.seen !== true
      ).length;
    },
    enabled: !!user?.email,
    initialData: 0,
    staleTime: 15000,
    refetchOnWindowFocus: true,
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

  const { data: scanLikes = [] } = useQuery({
    queryKey: ['scanLikesAll'],
    queryFn: () => Query.ScanLike.list('-created_date'),
    initialData: [],
    staleTime: 60 * 1000,
    enabled: !!user?.email,
    refetchOnWindowFocus: true,
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

  const { data: publicCollections = [] } = useQuery({
    queryKey: ['publicCollectionsForGuests'],
    queryFn: () => Query.Collection.list('-created_date'),
    initialData: [],
    staleTime: 60 * 1000,
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

  const {
    data: robotPlantState = null,
    isFetched: isRobotPlantStateFetched,
  } = useQuery({
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

  const { data: robotPlantShopItems = [], isFetching: isRobotPlantShopItemsFetching } = useQuery({
    queryKey: ['robotPlantShopItems'],
    queryFn: () => listRobotPlantShopItems(),
    enabled: !!user?.id,
    initialData: [],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: robotPlantInventory = [], isFetching: isRobotPlantInventoryFetching } = useQuery({
    queryKey: ['robotPlantInventory', user?.id],
    queryFn: () => listRobotPlantInventory(user?.id),
    enabled: !!user?.id,
    initialData: [],
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: robotPlantActiveEffects = [] } = useQuery({
    queryKey: ['robotPlantActiveEffects', user?.id],
    queryFn: () => listRobotPlantActiveEffects(user?.id),
    enabled: !!user?.id,
    initialData: [],
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const {
    data: robotPlantDailyCareStatus = null,
    isFetching: isRobotPlantDailyCareStatusFetching,
    refetch: refetchRobotPlantDailyCareStatus,
  } = useQuery({
    queryKey: ['robotPlantDailyCareStatus', user?.id],
    queryFn: () => getRobotPlantDailyCareStatus(user?.id),
    enabled: !!user?.id,
    initialData: null,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const useInventoryItemMutation = useMutation({
    mutationFn: ({ itemId }) => useRobotPlantInventoryItem({ itemId }),
    onSuccess: async (result) => {
      if (!result?.applied) {
        setCareActionMessage('Aktivierung fehlgeschlagen.');
        return;
      }

      setCareActionMessage('Duenger aktiviert.');
      await queryClient.invalidateQueries({ queryKey: ['robotPlantInventory'] });
      await queryClient.invalidateQueries({ queryKey: ['robotPlantActiveEffects'] });
    },
    onError: () => {
      setCareActionMessage('Aktivierung fehlgeschlagen.');
    },
  });

  const waterPlantMutation = useMutation({
    mutationFn: () => waterRobotPlant(),
    onSuccess: async (result) => {
      if (!result?.applied) {
        setCareActionMessage('Heute wurde bereits 3x gegossen.');
        setCareGainFeedback(null);
      } else {
        const careDelta = Math.max(0, Number(result?.care_delta ?? 0));
        setCareActionMessage(`Gegossen: +${result?.care_delta ?? 0} Pflege (${result?.remaining_waters_today ?? 0} uebrig)`);
        if (careDelta > 0) {
          const feedbackId = Date.now();
          setCareGainFeedback({ id: feedbackId, delta: careDelta });
          window.setTimeout(() => {
            setCareGainFeedback((prev) => (prev?.id === feedbackId ? null : prev));
          }, 1300);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['robotPlantState'] });
      await queryClient.invalidateQueries({ queryKey: ['robotPlantDailyCareStatus'] });
    },
    onError: () => {
      setCareActionMessage('Giessen fehlgeschlagen.');
    },
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
    queryClient.refetchQueries({ queryKey: ['pendingFriendRequests'] });
    queryClient.refetchQueries({ queryKey: ['friendsUnreadNewsCount'] });
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
      queryClient.refetchQueries({ queryKey: ['pendingFriendRequests'] });
      queryClient.refetchQueries({ queryKey: ['friendsUnreadNewsCount'] });
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
    if (!user?.email) return;

    const unsubscribeFriend = Query.Friend.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests'] });
      }
    });

    const unsubscribeNews = Query.UserNotification.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['friendsUnreadNewsCount'] });
      }
    });

    return () => {
      unsubscribeFriend?.();
      unsubscribeNews?.();
    };
  }, [user?.email, queryClient]);

  useEffect(() => {
    let cancelled = false;

    const warmupLiveLocation = async () => {
      try {
        const location = await requestCurrentLocation({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });

        if (!cancelled && Number.isFinite(location?.lat) && Number.isFinite(location?.lng)) {
          cacheLocation(location);
        }
      } catch {
        // Silent on app start: map open flow will show explicit error and retry if needed.
      }
    };

    warmupLiveLocation();
    const refreshIntervalId = window.setInterval(warmupLiveLocation, LOCATION_CACHE_MAX_AGE_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshIntervalId);
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
      setActivePanel("settings");
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
      console.error("? Fehler beim Update:", error);
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
    return calculateDistanceMetersRaw(lat1, lon1, lat2, lon2);
  };

  const todayKey = new Date().toISOString().slice(0, 10);
  const getDailyZoneStorageKey = (authId) => `robotPlantDailyZones:${authId}:${todayKey}`;

  const persistDailyZoneSnapshot = (authId, zones, rerollsRemainingToday) => {
    if (!authId) return;
    localStorage.setItem(
      getDailyZoneStorageKey(authId),
      JSON.stringify({ zones: Array.isArray(zones) ? zones : [], rerollsRemainingToday: rerollsRemainingToday ?? null }),
    );
  };

  const readDailyZoneSnapshot = (authId) => {
    if (!authId) return null;
    try {
      const raw = localStorage.getItem(getDailyZoneStorageKey(authId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.zones)) return null;
      return {
        zones: parsed.zones,
        rerollsRemainingToday: parsed.rerollsRemainingToday ?? null,
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const loadZoneForHero = async () => {
      if (!user?.id) {
        if (!isCancelled) {
          setHasResolvedZoneBootstrap(true);
        }
        return;
      }

      if (!isCancelled) {
        setHasResolvedZoneBootstrap(false);
      }

      if (hasCalledZoneGenerationToday) {
        const cachedSnapshot = readDailyZoneSnapshot(user.id);
        if (cachedSnapshot) {
          const zones = cachedSnapshot.zones || [];
          setHeroZones(zones);
          if (cachedSnapshot.rerollsRemainingToday !== null) {
            setZoneRerollsRemaining(cachedSnapshot.rerollsRemainingToday);
          }

          let location = getCachedLocation({ maxAgeMs: LOCATION_CACHE_MAX_AGE_MS });
          
          // Browser-Kompatibilität: Wenn Cache leer ist, Live-Standort versuchen
          if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
            try {
              location = await requestCurrentLocation({
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 0,
              });
              if (Number.isFinite(location?.lat) && Number.isFinite(location?.lng)) {
                cacheLocation(location);
              }
            } catch {
              // Standort optional für Zones-Anzeige, nur für Active Zone calc relevant
              console.log("[Home] Could not get live location for active zone calc");
              location = null;
            }
          }
          
          const inRangeZone = location && Number.isFinite(location?.lat) && Number.isFinite(location?.lng)
            ? (zones || [])
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
                .sort((a, b) => a.distanceM - b.distanceM)[0]
            : null;

          setActiveZone(inRangeZone || null);
        }

        if (!isCancelled) {
          setHasResolvedZoneBootstrap(true);
        }

        console.log("[Home] Daily initial zone call already done - using local snapshot");
        return;
      }

      let location = getCachedLocation({ maxAgeMs: LOCATION_CACHE_MAX_AGE_MS });
      console.log("[Home] Zone load: cached location =", location ? { lat: location.lat, lng: location.lng } : null);
      
      // Browser-Kompatibilität: Wenn Cache leer ist (z.B. Chrome mit neuer Session),
      // Live-Standort anfordern statt gleich abzubrechen
      if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
        console.log("[Home] Cached location empty - requesting live location for zone generation");
        setIsLoadingZone(true);
        try {
          location = await requestCurrentLocation({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
          console.log("[Home] Live location acquired:", location ? { lat: location.lat, lng: location.lng } : null);
          
          if (Number.isFinite(location?.lat) && Number.isFinite(location?.lng)) {
            cacheLocation(location);
          } else {
            throw new Error("Live location invalid");
          }
        } catch (liveLocationError) {
          console.warn("[Home] Live location request failed:", liveLocationError?.message || liveLocationError);
          setHeroZones([]);
          setActiveZone(null);
          setZoneMapError("Standort nicht verfügbar. Bitte Standortfreigabe aktivieren.");
          if (!isCancelled) {
            setHasResolvedZoneBootstrap(true);
          }
          setIsLoadingZone(false);
          return;
        }
      }

      setIsLoadingZone(true);
      setZoneMapError(null);
      try {
        console.log("[Home] Calling getRobotPlantDailyZones with location:", { lat: location.lat, lng: location.lng });
        const authDayKeyForRequest = zoneGenerationDay || todayKey;
        const daily = await getRobotPlantDailyZones({
          latitude: location.lat,
          longitude: location.lng,
          authDayKey: authDayKeyForRequest,
          mode: "initial",
        });
        console.log("[Home] Daily zones loaded:", daily?.zones?.length || 0, "zones");

        setZoneGenerationDayForUser(todayKey);
        persistDailyZoneSnapshot(user.id, daily?.zones || [], daily?.rerollsRemainingToday ?? null);

        setHeroZones(daily?.zones || []);
        if (daily?.rerollsRemainingToday !== undefined && daily?.rerollsRemainingToday !== null) {
          setZoneRerollsRemaining(daily.rerollsRemainingToday);
        }

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
        setZoneMapError(error?.message || "Zonen konnten nicht geladen werden.");
        setHeroZones([]);
        setActiveZone(null);
      } finally {
        setIsLoadingZone(false);
        if (!isCancelled) {
          setHasResolvedZoneBootstrap(true);
        }
      }
    };

    loadZoneForHero();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, hasCalledZoneGenerationToday, zoneGenerationDay, setZoneGenerationDayForUser, todayKey]);

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
    if (!showHealthStatsPanel || !user?.id) {
      return;
    }

    refetchRobotPlantDailyCareStatus();
  }, [showHealthStatsPanel, user?.id, refetchRobotPlantDailyCareStatus]);

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
  }, [showHeroZoneMap, showHealthStatsPanel]);

  const isLoadingCriticalData = isLoadingDiscoveries || isLoadingQuests || isLoadingAchievements || isLoadingFriends || isLoadingWeeklyQuests || isLoadingMonthlyQuests || isLoadingCollectionQuests;

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <GuestHomeFlow />;
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

  const isPlantHealthPending = Boolean(user?.id) && !isRobotPlantStateFetched;

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

  const inventoryByItemId = Object.fromEntries(
    robotPlantInventory.map((entry) => [entry.item_id, entry.quantity || 0])
  );

  const fertilizerItems = robotPlantShopItems.filter((item) => item.item_type === "fertilizer");
  const ownedFertilizerItems = fertilizerItems
    .map((item) => ({ ...item, ownedQuantity: inventoryByItemId[item.id] || 0 }))
    .filter((item) => item.ownedQuantity > 0)
    .sort((a, b) => Number(b.effect_value || 0) - Number(a.effect_value || 0));

  const activeDecayEffects = robotPlantActiveEffects
    .filter((effect) => effect.effect_type === "decay_reduction")
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());

  const activeDecayPercent = activeDecayEffects.reduce(
    (acc, effect) => acc + Number(effect.effect_value || 0),
    0
  );
  const activeFertilizerItemId = activeDecayEffects[0]?.item_id || null;
  const isFertilizerInventoryLoading =
    Boolean(user?.id) &&
    (isRobotPlantShopItemsFetching || isRobotPlantInventoryFetching) &&
    ownedFertilizerItems.length === 0;
  const fertilizerTitleById = Object.fromEntries(
    fertilizerItems.map((item) => [item.id, item.title || item.item_key || "Dünger"])
  );

  const wateringCountToday = Math.max(0, Number(robotPlantDailyCareStatus?.wateringCountToday ?? 0));
  const wateringLimitPerDay = Math.max(1, Number(robotPlantDailyCareStatus?.wateringLimitPerDay ?? 3));
  const remainingWatersToday = Math.max(0, Number(robotPlantDailyCareStatus?.remainingWatersToday ?? (wateringLimitPerDay - wateringCountToday)));
  const isDailyCareStatusLoading = Boolean(user?.id) && (isRobotPlantDailyCareStatusFetching || !robotPlantDailyCareStatus);

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
  const hasSocialNotifications = pendingFriendRequests.length > 0 || unreadFriendsNewsCount > 0;
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
  const resolvedPlantHealthState = isPlantHealthPending
    ? { label: "Status wird geladen", color: "#6b7280", scanEventBonus: 0 }
    : plantHealthState;
  const healthStateBonus = Number(resolvedPlantHealthState?.scanEventBonus ?? 0);
  const displayedOverallPlantHealth = isPlantHealthPending ? null : overallPlantHealth;

  const currentZoneColor = !hasResolvedZoneBootstrap
    ? "#6b7280"
    : activeZone
    ? THEME_MAP_COLORS[activeZone.theme] || "#84cc16"
    : "#6b7280";
  const cachedLocation = getCachedLocation({ maxAgeMs: LOCATION_CACHE_MAX_AGE_MS });
  const hasLiveCachedLocation = Number.isFinite(cachedLocation?.lat) && Number.isFinite(cachedLocation?.lng);
  const currentUserEmailLower = (user?.email || "").toLowerCase();
  const likedDiscoveryIdSet = new Set(
    (scanLikes || [])
      .filter((like) => like?.discovery_id && like?.liked_by?.toLowerCase() === currentUserEmailLower)
      .map((like) => like.discovery_id)
  );

  const nearbyDiscoveryPoints = hasLiveCachedLocation
    ? allDiscoveries
        .map((entry) => {
          const coords = parseDiscoveryCoordinates(entry?.discovery_location);
          if (!coords) return null;

          const plant = plants.find((candidate) => candidate.id === entry?.plant_id);

          const entryEmailUser = typeof entry?.user === "string" ? entry.user.toLowerCase() : null;
          const entryEmailCreatedBy = typeof entry?.created_by === "string" ? entry.created_by.toLowerCase() : null;
          const entryAuthId = entry?.auth_id || entry?.created_by_id || "";
          const isOwnDiscovery =
            (entryAuthId && user?.id && entryAuthId === user.id) ||
            (entryEmailUser && user?.email && entryEmailUser === user.email.toLowerCase()) ||
            (entryEmailCreatedBy && user?.email && entryEmailCreatedBy === user.email.toLowerCase());
          const discoveryUser = allUsers.find((candidate) => {
            if (candidate?.auth_id && (candidate.auth_id === entry?.auth_id || candidate.auth_id === entry?.created_by_id)) {
              return true;
            }
            if (!candidate?.user_email) return false;
            const candidateEmail = candidate.user_email.toLowerCase();
            return candidateEmail === entryEmailUser || candidateEmail === entryEmailCreatedBy;
          });

          const scannerNameFromProfile =
            discoveryUser?.display_name ||
            discoveryUser?.full_name ||
            "";
          const scannerNameFromOwnProfile = user?.display_name || user?.full_name || "";
          const scannerName = (scannerNameFromProfile || (isOwnDiscovery ? scannerNameFromOwnProfile : "") || "Unbekannt").trim();

          return {
            lat: coords.lat,
            lng: coords.lng,
            discoveryId: entry?.id || null,
            imageUrl: entry?.image_url || "",
            scannerName,
            scannerDisplayName: scannerName,
            scannerEmail: discoveryUser?.user_email || entry?.user || entry?.created_by || "",
            scannerAuthId: discoveryUser?.auth_id || entry?.auth_id || entry?.created_by_id || "",
            plantName: plant?.species_name || "Unbekannte Pflanze",
            plantId: plant?.id || entry?.plant_id || "",
            genusId: plant?.genus_id || "",
            likedByCurrentUser: likedDiscoveryIdSet.has(entry?.id),
            discoveredAt: entry?.created_date || entry?.discovered_date || entry?.updated_date || null,
          };
        })
        .filter(Boolean)
        .filter((point) => {
          const distanceM = calculateDistanceMetersRaw(
            cachedLocation.lat,
            cachedLocation.lng,
            point.lat,
            point.lng
          );
          return Number.isFinite(distanceM) && distanceM <= NEARBY_DISCOVERY_RADIUS_METERS;
        })
    : [];
  const heroMapCenter = hasLiveCachedLocation
    ? [cachedLocation.lat, cachedLocation.lng]
    : heroZones[0]
      ? [Number(heroZones[0].centerLat), Number(heroZones[0].centerLng)]
      : [51.1657, 10.4515];

  const activeZoneMeta = activeZone?.theme ? THEME_MAP_META[activeZone.theme] : null;
  const isAdminUser = user?.role === "admin";
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
      description: "Start x1.5, pro weiterem Scan in derselben Zone -0.1 (bis x1.0, kein Penalty).",
    },
    {
      id: "care",
      title: "🌿 Pflege",
      value: formatMultiplier(careMultiplier),
      description: "Direkter Einfluss aus dem Care-Wert (x0.5 bis x1.5).",
    },
    {
      id: "daily",
      title: "☀️ Tagesbonus",
      value: formatMultiplier(dailyBonusMultiplier),
      description: "Erster Scan des Tages x2, danach x1.",
    },
    {
      id: "rarity",
      title: "⭐ Rarität",
      value: "x1 bis x3",
      description: "Scanabhaengig: haeufig x1, gelegentlich x2, selten x3.",
    },
    {
      id: "novelty",
      title: "✨ Neuheit",
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

  const navItems = [
    {
      label: "Kollektion",
      icon: Leaf,
      onClick: () => {
        setActivePanel("collection");
        setShowHeroZoneMap(false);
        setShowHealthStatsPanel(false);
      },
      ...getNavButtonStyle({ palette: "green", isLightUi }),
    },
    {
      label: "Erfolge",
      icon: Scroll,
      onClick: () => {
        setActivePanel("achievements");
        setShowHeroZoneMap(false);
        setShowHealthStatsPanel(false);
      },
      showNotificationDot: hasRedeemableQuests,
      ...getNavButtonStyle({ palette: "amber", isLightUi }),
    },
    {
      label: "Social",
      icon: Users,
      onClick: () => {
        setActivePanel("friends");
        setShowHeroZoneMap(false);
        setShowHealthStatsPanel(false);
      },
      showNotificationDot: hasSocialNotifications,
      ...getNavButtonStyle({ palette: "blue", isLightUi }),
    },
    {
      label: "Shop",
      icon: ShoppingBag,
      onClick: () => {
        setShopOpenCategory("fertilizer");
        setActivePanel("shop");
        setShowHeroZoneMap(false);
        setShowHealthStatsPanel(false);
      },
      ...getNavButtonStyle({ palette: "orange", isLightUi }),
    },
  ];


  const embeddedTitle =
    activePanel === "collection" ? "Kollektionen" :
    activePanel === "settings" ? "Einstellungen" :
    activePanel === "shop" ? (embeddedHeaderMeta?.title || "Shop") :
    activePanel === "achievements" ? (embeddedHeaderMeta?.title || "Erfolge") :
    activePanel === "friends" ? (embeddedHeaderMeta?.title || "Social") :
    null;

  const embeddedSubtitle = embeddedHeaderMeta?.subtitle || null;
  const embeddedInfoLabel = embeddedHeaderMeta?.infoLabel || null;
  const shouldDockEmbeddedChipHeader = activePanel === "achievements" || activePanel === "friends" || activePanel === "shop";

  const handleRegenerateZones = async () => {
    if (isRegeneratingZones || !user?.id) return;
    if (!hasCalledZoneGenerationToday) {
      setZoneMapError("Bitte zuerst die Tageszonen initial laden.");
      return;
    }

    setIsRegeneratingZones(true);
    setZoneMapError(null);
    try {
      const location = await requestCurrentLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
        throw new Error("Standort fehlt. Bitte Standortfreigabe aktivieren.");
      }

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

      const zones = daily?.zones || [];
      setHeroZones(zones);
      if (daily?.rerollsRemainingToday !== undefined && daily?.rerollsRemainingToday !== null) {
        setZoneRerollsRemaining(daily.rerollsRemainingToday);
      }

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
      console.warn("[Home] Zone regeneration failed:", message);
      const nextRerollsRemaining = Number.isFinite(Number(error?.rerollsRemainingToday))
        ? Math.max(0, Number(error.rerollsRemainingToday))
        : (error?.rateLimited ? 0 : null);

      if (nextRerollsRemaining !== null) {
        setZoneRerollsRemaining(nextRerollsRemaining);
        persistDailyZoneSnapshot(user.id, heroZones, nextRerollsRemaining);
      }

      setZoneMapError(String(message));
    } finally {
      setIsRegeneratingZones(false);
    }
  };

  const handleOpenHeroZoneMap = async () => {
    if (isResolvingHeroMapLocation) return;

    setIsResolvingHeroMapLocation(true);
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

      // Backend fragen nach aktuellen Zonen für heute
      try {
        console.log("[Home] Polling zones from backend when opening zone map");
        const authDayKeyForRequest = zoneGenerationDay || todayKey;
        const daily = await getRobotPlantDailyZones({
          latitude: location.lat,
          longitude: location.lng,
          authDayKey: authDayKeyForRequest,
          mode: "initial",
        });

        // Zonen aktualisieren und cachen
        const updatedZones = daily?.zones || [];
        setHeroZones(updatedZones);
        if (daily?.rerollsRemainingToday !== undefined && daily?.rerollsRemainingToday !== null) {
          setZoneRerollsRemaining(daily.rerollsRemainingToday);
        }
        persistDailyZoneSnapshot(user.id, updatedZones, daily?.rerollsRemainingToday ?? null);

        // Active zone neu berechnen basierend auf aktuellem Standort
        const inRangeZone = updatedZones
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
        console.log("[Home] Zones refreshed from backend:", updatedZones.length, "zones");
      } catch (zoneError) {
        // Backend-Fehler: Mit gecachten Zonen weitermachen (kein Show-Stopper)
        console.warn("[Home] Zone polling failed, using cached zones:", zoneError?.message);
        // heroZones bleibt wie sie ist - wir zeigen trotzdem die Karte mit den gecachten Zonen
      }

      setZoneMapError(null);
      setShowHeroZoneMap(true);
      setShowHealthStatsPanel(false);
    } catch (error) {
      const deniedByUser = Number(error?.code) === 1;
      setZoneMapError(
        deniedByUser
          ? "Standortfreigabe verweigert. Ohne Live-Standort kann die Zonenkarte nicht geladen werden."
          : (error?.message || "Standort konnte nicht geladen werden.")
      );
      setShowHeroZoneMap(true);
      setShowHealthStatsPanel(false);
    } finally {
      setIsResolvingHeroMapLocation(false);
    }
  };

  const handleDiscoveryImageClick = ({ discoveryId, scannerEmail, genusId, plantId }) => {
    if (!discoveryId) return;

    const resolvedPlantId =
      plantId ||
      allDiscoveries.find((entry) => entry?.id === discoveryId)?.plant_id ||
      "";
    const resolvedGenusId =
      genusId ||
      plants.find((candidate) => candidate?.id === resolvedPlantId)?.genus_id ||
      "";
    if (!resolvedGenusId) {
      setZoneMapError("Scan konnte nicht geoeffnet werden (fehlende Genus-Zuordnung).");
      return;
    }

    const params = new URLSearchParams();
    params.set("id", resolvedGenusId);
    if (scannerEmail && scannerEmail.toLowerCase() !== (user?.email || "").toLowerCase()) {
      params.set("email", scannerEmail);
    }
    params.set("discoveryId", discoveryId);
    navigate(createPageUrl(`GenusDetail?${params.toString()}`));
  };

  const handleDiscoveryLike = async ({
    discoveryId,
    scannerAuthId,
    scannerEmail,
    plantName,
    genusId,
    nextLiked,
  }) => {
    if (!user?.email || !discoveryId) {
      setZoneMapError("Bitte einloggen, um Scans zu liken.");
      return false;
    }

    const ownEmailLower = user.email.toLowerCase();
    const existingLike = (scanLikes || []).find(
      (like) => like.discovery_id === discoveryId && like.liked_by?.toLowerCase() === ownEmailLower
    );
    const currentlyLiked = Boolean(existingLike);

    if (nextLiked === currentlyLiked) {
      return currentlyLiked;
    }

    if (nextLiked) {
      await Query.ScanLike.create({
        discovery_id: discoveryId,
        liked_by: user.email,
        liked_date: new Date().toISOString(),
        auth_id: user.id,
        created_by: user.email,
      });

      const isOwnDiscovery = scannerEmail && scannerEmail.toLowerCase() === ownEmailLower;
      if (!isOwnDiscovery) {
        const actionParams = new URLSearchParams();
        if (genusId) actionParams.set("id", genusId);
        if (scannerEmail) actionParams.set("email", scannerEmail);
        actionParams.set("discoveryId", discoveryId);

        await Promise.allSettled([
          createUserNotification({
            authId: scannerAuthId || null,
            userEmail: scannerEmail || null,
            notificationType: "scan_liked",
            title: "❤️ Neuer Like",
            message: `${user.display_name || user.full_name || user.email} gefällt dein Scan ${plantName ? `(${plantName})` : ""}.`,
            actionUrl: `GenusDetail?${actionParams.toString()}`,
            displayLocation: "banner",
            createdBy: user.email,
          }),
          scannerAuthId
            ? supabase.functions.invoke("robotPlantGrantReward", {
                body: {
                  authId: scannerAuthId,
                  userEmail: scannerEmail || null,
                  eventSource: "scan_like_received",
                  eventReference: discoveryId,
                  amount: 5,
                  metadata: {
                    source: "home_map_popup_like",
                    likedBy: user.email,
                  },
                },
              })
            : Promise.resolve(),
        ]);
      }
    } else if (existingLike?.id) {
      await Query.ScanLike.delete(existingLike.id);
    }

    await queryClient.invalidateQueries({ queryKey: ["scanLikesAll"] });
    return nextLiked;
  };

  const openShop = (category = "fertilizer") => {
    setShopOpenCategory(category);
    setActivePanel("shop");
    setShowHeroZoneMap(false);
    setShowHealthStatsPanel(false);
  };

  const handleWaterPlantClick = () => {
    setCareActionMessage(null);
    waterPlantMutation.mutate();
  };

  const handleUseFertilizerItem = (itemId) => {
    setCareActionMessage(null);
    if (!itemId) return false;

    if (activeFertilizerItemId && activeFertilizerItemId === itemId) {
      const currentLabel = fertilizerTitleById[itemId] || "Dünger";
      setCareActionMessage(`${currentLabel} ist bereits ausgerüstet.`);
      return false;
    }

    if (activeFertilizerItemId && activeFertilizerItemId !== itemId) {
      const currentLabel = fertilizerTitleById[activeFertilizerItemId] || "Dünger";
      const nextLabel = fertilizerTitleById[itemId] || "Dünger";
      const shouldReplace = window.confirm(
        `${currentLabel} ist bereits ausgerüstet - stattdessen lieber ${nextLabel} anwenden?`
      );

      if (!shouldReplace) {
        return false;
      }
    }

    useInventoryItemMutation.mutate({ itemId });
    return true;
  };

  const handleOpenFertilizerShop = () => {
    openShop("fertilizer");
    setCareActionMessage("Keine Duenger im Inventar. Kaufe zuerst im Shop.");
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
        getRgbaFromRgb={getRgbaFromRgb}
      >
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            data-ui="home-main-content-shell"
            className={`relative h-full w-full max-w-md md:max-w-3xl rounded-[2rem] overflow-hidden border ${isLightUi ? "border-white/65 shadow-[0_20px_64px_rgba(0,0,0,0.14)]" : "border-[#d7cf9c]/65 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"}`}
          >
            <div
              className="absolute inset-0"
              style={user?.background_image_url ? {
                backgroundImage: isLightUi
                  ? `linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.28) 100%), url(${user.background_image_url})`
                  : `linear-gradient(180deg, rgba(19,37,24,0.42) 0%, rgba(12,20,15,0.66) 100%), url(${user.background_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : user?.background_color ? {
                background: isLightUi
                  ? `linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.38) 100%)`
                  : `linear-gradient(180deg, ${getRgbaFromRgb(user.background_color, 0.28)} 0%, rgba(14, 22, 16, 0.74) 100%)`,
              } : {
                background: isLightUi
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.38) 100%)'
                  : 'linear-gradient(180deg, rgba(126, 171, 98, 0.45) 0%, rgba(10, 22, 15, 0.78) 100%)',
              }}
            />
            <div className={`absolute inset-0 pointer-events-none rounded-[2rem] border ${isLightUi ? "border-white/70" : "border-[#f0e5a5]/30"}`} />

            <div className={`relative z-10 h-full flex flex-col px-4 md:px-8 py-4 md:py-6 ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
              <HomeHeaderBar
                activePanel={activePanel}
                embeddedTitle={embeddedTitle}
                embeddedSubtitle={embeddedSubtitle}
                embeddedInfoLabel={embeddedInfoLabel}
                embeddedCollectionPublicPanelOpen={embeddedCollectionPublicPanelOpen}
                displayName={getDisplayName()}
                userTitle={user?.selected_title || user?.title || "Pflanzen-Entdecker"}
                onTogglePublicCollections={() => setEmbeddedCollectionPublicPanelOpen((prev) => !prev)}
                onOpenEmbeddedFriendsAddDialog={() => setEmbeddedFriendsAddDialogNonce((prev) => prev + 1)}
                onPrimaryAction={() => {
                  if (activePanel === "collection") {
                    setEmbeddedCollectionPublicPanelOpen(false);
                    setEmbeddedSelectedCollectionId("global");
                  }
                  if (activePanel !== null) {
                    setActivePanel(null);
                    return;
                  }
                  setActivePanel("settings");
                  setShowHeroZoneMap(false);
                  setShowHealthStatsPanel(false);
                }}
              />

              <div
                className={`relative flex flex-1 min-h-0 flex-col overflow-hidden ${shouldDockEmbeddedChipHeader ? "py-0" : "py-[clamp(0.5rem,1.5vh,1rem)]"}`}
                data-ui="home-content-stack"
              >
                {activePanel === "collection" ? (
                  <Collection
                    embedded
                    onRequestClose={() => {
                      setActivePanel(null);
                      setEmbeddedSelectedCollectionId("global");
                    }}
                    initialCollectionId={embeddedSelectedCollectionId}
                    onSelectedCollectionIdChange={setEmbeddedSelectedCollectionId}
                    showPublicCollectionsPanel={embeddedCollectionPublicPanelOpen}
                    onShowPublicCollectionsPanelChange={setEmbeddedCollectionPublicPanelOpen}
                  />
                ) : activePanel === "achievements" ? (
                  <AchievementsFeatureRoot
                    embedded
                    onRequestClose={() => setActivePanel(null)}
                    onHeaderMetaChange={setEmbeddedHeaderMeta}
                  />
                ) : activePanel === "friends" ? (
                  <FriendsFeatureRoot
                    embedded
                    onRequestClose={() => setActivePanel(null)}
                    onHeaderMetaChange={setEmbeddedHeaderMeta}
                    openAddFriendDialogNonce={embeddedFriendsAddDialogNonce}
                  />
                ) : activePanel === "shop" ? (
                  <ShopFeatureRoot
                    embedded
                    authId={user?.id}
                    onHeaderMetaChange={setEmbeddedHeaderMeta}
                    playerSeeds={playerSeeds}
                    initialCategory={shopOpenCategory}
                  />
                ) : activePanel === "settings" ? (
                  <SettingsFeatureRoot
                    user={user}
                    onUserUpdated={(freshUser) => setUser(freshUser)}
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
                    {isResolvingHeroMapLocation ? (
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
                            onClick={handleOpenHeroZoneMap}
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
                        discoveryPoints={nearbyDiscoveryPoints}
                        onDiscoveryImageClick={handleDiscoveryImageClick}
                        onDiscoveryLike={handleDiscoveryLike}
                        allowDiscoveryLike={!!user?.id}
                        onTokenError={(message) => setZoneMapError(message)}
                        onMapReady={setHeroMapInstance}
                      />
                    )}

                    <TileVisualizationPanel
                      map={heroMapInstance}
                      userLocation={cachedLocation}
                      authId={user?.id}
                      isAdmin={isAdminUser}
                      open={showDebugZonePanel}
                      onOpenChange={setShowDebugZonePanel}
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
                      Zonen: {heroZones.length} | Funde: {nearbyDiscoveryPoints.length}
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

                      {isAdminUser && (
                        <button
                          type="button"
                          onClick={() => setShowDebugZonePanel(true)}
                          className={`h-10 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-semibold ${
                            isLightUi
                              ? "border-amber-400/60 bg-amber-50/70 text-amber-800 hover:bg-amber-100/80"
                              : "border-amber-400/50 bg-amber-900/40 text-amber-200 hover:bg-amber-900/60"
                          } transition-colors`}
                          title="Admin: Debug Zone Overlay"
                        >
                          <Bug className="w-4 h-4" />
                          Debug-Zone
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleRegenerateZones}
                        disabled={!hasCalledZoneGenerationToday || isRegeneratingZones || isLoadingZone || (!isAdminUser && zoneRerollsRemaining === 0)}
                        className={`h-10 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-semibold disabled:opacity-60 ${
                          isLightUi
                            ? "border-[#c8ac62]/55 bg-white/60 text-stone-800 hover:bg-white/70"
                            : "border-[#f0e5a5]/45 bg-black/55 text-stone-100 hover:bg-black/70"
                        } transition-colors`}
                      >
                        {isRegeneratingZones ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {(!isAdminUser && zoneRerollsRemaining !== null) ? `Neu (${zoneRerollsRemaining})` : "Neu"}
                      </button>
                    </div>
                  </section>
                ) : (
                  <section data-ui="home-plant-hero-section" className={`flex-1 min-h-0 rounded-3xl border px-[clamp(0.75rem,2vw,1.5rem)] py-[clamp(0.75rem,2vh,1.5rem)] flex flex-col ${
                    isLightUi
                      ? "border-[#c0a860]/50 bg-white/25 backdrop-blur-sm"
                      : "border-[#f0e5a5]/25 bg-black/25 backdrop-blur-sm"
                  }`}
                  style={isLightUi ? {
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 35%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.08) 100%)'
                  } : {}}>
                  <div ref={healthStatsPanelRef} className="flex-1 min-h-0 flex items-start justify-center pt-[clamp(0.2rem,1vh,0.5rem)]">
                    <div
                      className="relative mx-auto"
                      style={{
                        width: showHealthStatsPanel
                          ? "100%"
                          : (heroStageSizePx > 0 ? `${heroStageSizePx}px` : "100%"),
                        height: showHealthStatsPanel
                          ? "100%"
                          : (heroStageSizePx > 0 ? `${heroStageSizePx}px` : "100%"),
                        maxWidth: "100%",
                        maxHeight: "100%",
                        aspectRatio: showHealthStatsPanel ? undefined : "1 / 1",
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
                            ? `linear-gradient(135deg, ${resolvedPlantHealthState.color}35 0%, ${resolvedPlantHealthState.color}15 100%)`
                            : `linear-gradient(135deg, ${resolvedPlantHealthState.color}7a 0%, ${resolvedPlantHealthState.color}4d 100%)`,
                        }}
                        aria-label="Pflanzenstatus ein- oder ausklappen"
                      >
                        <Leaf className={`w-4 h-4 ${isLightUi ? "text-stone-700" : "text-white/90"}`} />
                        <span className={`font-bold text-[11px] md:text-xs leading-none mt-0.5 ${isLightUi ? "text-stone-800" : "text-white"}`}>
                          {displayedOverallPlantHealth === null ? "..." : `${displayedOverallPlantHealth}%`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenHeroZoneMap}
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
                          {(!hasResolvedZoneBootstrap || isLoadingZone) ? "..." : activeZoneMeta?.label || "Leer"}
                        </span>
                      </button>

                      <AnimatePresence mode="wait">
                        {showHealthStatsPanel ? (
                          <PlantHeroHealthPanel
                            plantHealthState={resolvedPlantHealthState}
                            healthStateBonus={healthStateBonus}
                            healthStats={healthStats}
                            isLoading={isPlantHealthPending}
                            isDailyCareLoading={isDailyCareStatusLoading}
                            wateringCountToday={wateringCountToday}
                            wateringLimitPerDay={wateringLimitPerDay}
                            remainingWatersToday={remainingWatersToday}
                            isWateringPending={waterPlantMutation.isPending}
                            isFertilizerPending={useInventoryItemMutation.isPending}
                            isFertilizerInventoryLoading={isFertilizerInventoryLoading}
                            fertilizerInventoryItems={ownedFertilizerItems}
                            activeFertilizerItemId={activeFertilizerItemId}
                            activeDecayEffects={activeDecayEffects}
                            activeDecayPercent={activeDecayPercent}
                            careActionMessage={careActionMessage}
                            careGainFeedback={careGainFeedback}
                            onWaterPlant={handleWaterPlantClick}
                            onUseFertilizerItem={handleUseFertilizerItem}
                            onOpenFertilizerShop={handleOpenFertilizerShop}
                          />
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

                            <div className="absolute left-1/2 top-1/2 w-[82%] aspect-square -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                              {[
                                { key: "left", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" },
                                { key: "right", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2" },
                                { key: "top", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" },
                                { key: "bottom", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2" },
                              ].map((slot) => (
                                <button
                                  key={slot.key}
                                  type="button"
                                  onClick={() => openShop("accessory")}
                                  className={`pointer-events-auto absolute ${slot.className} z-[9] w-11 h-11 md:w-12 md:h-12 rounded-2xl border backdrop-blur-sm flex items-center justify-center transition-colors ${
                                    isLightUi
                                      ? "border-[#c8ac62]/55 bg-white/52 text-stone-700 hover:bg-white/68"
                                      : "border-[#f0e5a5]/45 bg-black/35 text-[#f0e5a5] hover:bg-black/50"
                                  }`}
                                  aria-label={`Accessoire Slot ${slot.key}`}
                                >
                                  <Plus className="w-5 h-5" />
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
                            <p className="text-xs text-amber-100/50 italic">🔧 Status: In Entwicklung</p>
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
                                Zustand <strong>{resolvedPlantHealthState.label}</strong> gibt aktuell <strong>+{healthStateBonus}</strong> auf alle Scan-Events.
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
                controlsScale={controlsScale}
              />
            </div>
          </motion.div>

      </HomeBackgroundShell>
    </>
  );
}


