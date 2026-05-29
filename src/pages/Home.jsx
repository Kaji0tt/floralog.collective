import { useState, useEffect, useMemo, useRef } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { upsertUserProfile } from "@/api/authService";
import { executeMigration } from "@/api/migrationService";
import { createUserNotification } from "@/api/notificationService";
import { supabase } from "@/api/supabaseClient";
import { connectViaReferral } from "@/api/friendService";
import {
  getRobotPlantDailyZones,
  listRobotPlantShopItems,
  listRobotPlantInventory,
  listRobotPlantActiveEffects,
  getRobotPlantDailyCareStatus,
  useRobotPlantInventoryItem as activateRobotPlantInventoryItem,
  waterRobotPlant,
} from "@/api/robotPlantService";
import { claimDailyLoginSparks, getUserWallet } from "@/api/walletService";
import {
  ensureUserStoryRow,
  getUserStory,
  mergeSeenMilestoneIds,
  updateUserStory,
} from "@/api/storyService";
import { getOpenPlantQuiz, submitPlantQuizAnswer } from "@/api/plantQuizService";
import { getTileClaims } from "@/api/tileClaimService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Leaf, Users, Scroll, CheckCircle, AlertCircle, TreePine, Building2, Waves, Flower2, MapPin, Zap, Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AchievementNotification from "../components/achievements/AchievementNotification";
import ScanFeedbackNotification from "../components/notifications/ScanFeedbackNotification";
import ScanZoneUnlockNotification from "../components/notifications/ScanZoneUnlockNotification";
import QuizFeedbackNotification from "../components/notifications/QuizFeedbackNotification";
import DailyLoginSparkNotification from "../components/notifications/DailyLoginSparkNotification";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
import HomeOtaGate from "@/components/home/HomeOtaGate";
import HomeMapFeatureRoot from "@/components/home/HomeMapFeatureRoot.jsx";

import ShopFeatureRoot from "@/components/shop/ShopFeatureRoot";
import PlantHeroHealthPanel from "@/components/home/PlantHeroHealthPanel";
import PlantQuizDialog from "@/components/home/PlantQuizDialog";
import AchievementsFeatureRoot from "@/components/achievements/AchievementsFeatureRoot";
import FriendsFeatureRoot from "@/components/friends/FriendsFeatureRoot";
import { LockedTooltip } from "@/components/ui/locked-tooltip";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";
import { useUiTheme } from "@/lib/UiThemeContext";
import { useAuth } from "@/lib/AuthContext";
import { resolveReferralEmail } from "@/lib/referralCode";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import { resolveTitleValue } from "@/lib/profileCustomizationOptions";
import { hexToFilter } from "@/lib/hexToFilter";
import FlorabotIntroOverlay from "@/components/florabot/FlorabotIntroOverlay";
import FlorabotMilestoneOverlay from "@/components/florabot/FlorabotMilestoneOverlay";
import FlorabotContextBubble from "@/components/florabot/FlorabotContextBubble";
import { STORY_PROGRESS_CONDITIONS, pickRandomPhaseAmbientComment } from "@/lib/story/storyDefinition";
import { getSeenMilestoneIds, getNextUnseenMilestone, markMilestoneSeen, FLORABOT_MILESTONES } from "@/lib/florabotMilestones";
import { sendPartnerRequest } from "@/api/friendService";

const THEME_MAP_COLORS = {
  forest: "#007a3f",
  urban: "#8d755c",
  water: "#2b6cb0",
  meadow: "#84cc16",
};

const THEME_MAP_META = {
  forest: { label: "Forest", Icon: TreePine, color: "#007a3f" },
  urban: { label: "Urban", Icon: Building2, color: "#5a544d" },
  water: { label: "Water", Icon: Waves, color: "#2b6cb0" },
  meadow: { label: "Meadow", Icon: Flower2, color: "#84cc16" },
};

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";
const DISCOVERY_MARKER_SCALE_STORAGE_KEY = "home.discoveryMarkerScale";
const DISCOVERY_MARKER_SCALE_MIN = 0.5;
const DISCOVERY_MARKER_SCALE_MAX = 1.0;
const DISCOVERY_MARKER_SCALE_DEFAULT = 0.8;

const clampDiscoveryMarkerScale = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DISCOVERY_MARKER_SCALE_DEFAULT;
  return Math.min(DISCOVERY_MARKER_SCALE_MAX, Math.max(DISCOVERY_MARKER_SCALE_MIN, numeric));
};
const SOCIAL_NEWS_NOTIFICATION_TYPES = [
  "gift_received",
  "collection_followed",
  "friendship_accepted",
  "friend_request_received",
  "friend_achievement",
  "scan_liked",
];

function HomeContent() {
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
  const botName = user?.bot_name || null;
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
  const [zoneMapError, setZoneMapError] = useState(null);
  const [isResolvingHeroMapLocation, setIsResolvingHeroMapLocation] = useState(false);
  const [hasResolvedZoneBootstrap, setHasResolvedZoneBootstrap] = useState(false);
  const [showHealthStatsPanel, setShowHealthStatsPanel] = useState(false);
  const [showWeeklyQuestTooltip, setShowWeeklyQuestTooltip] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [showPlantQuizDialog, setShowPlantQuizDialog] = useState(false);
  const [plantQuizResult, setPlantQuizResult] = useState(null);
  const [weeklyQuestSeen, setWeeklyQuestSeen] = useState(() => {
    try { return localStorage.getItem('weeklyQuestSeen') || ''; } catch { return ''; }
  });
  const healthStatsPanelRef = useRef(null);
  const [heroStageSizePx, setHeroStageSizePx] = useState(0);
  const [heroMapInstance, setHeroMapInstance] = useState(null);
  const [showDebugZonePanel, setShowDebugZonePanel] = useState(false);
  const [showFlorabotIntro, setShowFlorabotIntro] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState(null);
  const [florabotContextBubble, setFlorabotContextBubble] = useState(null);
  const [userStory, setUserStory] = useState(/** @type {any} */ (null));
  const [storyCreatedThisSession, setStoryCreatedThisSession] = useState(false);

  const [scanFeedback, setScanFeedback] = useState(null);
  const [showScanFeedback, setShowScanFeedback] = useState(false);
  const [scanZoneUnlockQueue, setScanZoneUnlockQueue] = useState([]);
  const [showScanZoneUnlock, setShowScanZoneUnlock] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [showQuizFeedback, setShowQuizFeedback] = useState(false);
  const scanFeedbackCooldownRef = useRef(false);
  const blockNavigationFeedbackRef = useRef(false);
  const ambientCommentLockRef = useRef(false);

  // Cooldown-Schutz: scanFeedback kann nach Schließen für 1 Sekunde nicht erneut gesetzt werden
  const safeSetScanFeedback = (value) => {
    if ((scanFeedbackCooldownRef.current || blockNavigationFeedbackRef.current) && value) {
      // Während Cooldown oder Block kein neues Feedback zulassen
      return;
    }
    setScanFeedback(value);
  };
  const [activePanel, setActivePanel] = useState(null);
  const [shopOpenCategory, setShopOpenCategory] = useState("accessories");
  const [careActionMessage, setCareActionMessage] = useState(null);
  const [careGainFeedback, setCareGainFeedback] = useState(null);
  const [dailySparkClaimFeedback, setDailySparkClaimFeedback] = useState(null);
  const [showAmberPurchaseModal, setShowAmberPurchaseModal] = useState(false);
  const [embeddedHeaderMeta, setEmbeddedHeaderMeta] = useState(null);
  const [embeddedFriendsAddDialogNonce, setEmbeddedFriendsAddDialogNonce] = useState(0);
  const [embeddedCollectionPublicPanelOpen, setEmbeddedCollectionPublicPanelOpen] = useState(false);
  const [embeddedSelectedCollectionId, setEmbeddedSelectedCollectionId] = useState("global");
  const [isMapDiscoveryDataLoading, setIsMapDiscoveryDataLoading] = useState(false);
  const [discoveryMarkerScale, setDiscoveryMarkerScale] = useState(() => {
    try {
      const stored = localStorage.getItem(DISCOVERY_MARKER_SCALE_STORAGE_KEY);
      return clampDiscoveryMarkerScale(stored ?? DISCOVERY_MARKER_SCALE_DEFAULT);
    } catch {
      return DISCOVERY_MARKER_SCALE_DEFAULT;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DISCOVERY_MARKER_SCALE_STORAGE_KEY, String(discoveryMarkerScale));
    } catch {
      // localStorage may be unavailable in private contexts.
    }
  }, [discoveryMarkerScale]);

  useEffect(() => {
    if (activePanel !== "collection") {
      setEmbeddedCollectionPublicPanelOpen(false);
      setEmbeddedSelectedCollectionId("global");
    }
  }, [activePanel]);

  useEffect(() => {
    if (!activePanel || !["achievements", "friends", "shop"].includes(activePanel)) {
      setEmbeddedHeaderMeta(null);
    }
  }, [activePanel]);

  // Ensure UserStory exists and derive intro visibility from DB state.
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const bootstrapStoryState = async () => {
      try {
        const existingStory = await getUserStory(user.id);

        let nextStory = existingStory;
        let createdNow = false;

        if (!nextStory) {
          nextStory = await ensureUserStoryRow({ authId: user.id, storyVersion: "v1" });
          createdNow = true;
        }

        if (cancelled) return;

        setUserStory(nextStory || null);
        setStoryCreatedThisSession(createdNow);

        if (nextStory) {
          setShowFlorabotIntro(nextStory.intro_seen !== true);
          return;
        }
      } catch (error) {
        const errorMessage = String(error?.message || error || "unknown_error");
        console.warn("[Home] UserStory bootstrap failed, fallback to local intro state:", errorMessage);
      }

      if (cancelled) return;

      const key = `florabot_intro_seen_v1:${user.id}`;
      try {
        setShowFlorabotIntro(!localStorage.getItem(key));
      } catch {
        setShowFlorabotIntro(true);
      }
    };

    bootstrapStoryState();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Florabot Context-Bubble: zeige Panel-Hinweis wenn Nutzer in relevantes Feature navigiert
  useEffect(() => {
    if (!user?.id || !activePanel) return;
    const bubbleKey = (panel) => `florabot_ctx_bubble_v1:${user.id}:${panel}`;
    const milestone = FLORABOT_MILESTONES.find(
      (m) => m.contextBubble?.panel === activePanel
    );
    if (!milestone?.contextBubble) return;
    // Nur anzeigen wenn das Milestone bereits gesehen wurde und die Bubble noch nicht
    try {
      const seenMilestones = new Set(
        Array.isArray(userStory?.seen_milestone_ids)
          ? userStory.seen_milestone_ids
          : Array.from(getSeenMilestoneIds(user.id))
      );
      if (!seenMilestones.has(milestone.id)) return;

      const seenContextKeys = new Set(
        Array.isArray(userStory?.seen_context_bubble_keys)
          ? userStory.seen_context_bubble_keys
          : []
      );

      if (seenContextKeys.has(activePanel)) return;
      if (localStorage.getItem(bubbleKey(activePanel))) return;
      setFlorabotContextBubble({ panel: activePanel, message: milestone.contextBubble.message });
    } catch { /* ignore */ }
  }, [activePanel, user?.id, userStory]);

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

  const { data: logoAssets = [] } = useQuery({
    queryKey: ["logoAssets"],
    queryFn: () => Query.LogoAsset.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const equippedLogoAssets = useMemo(
    () => resolveEquippedLogoAssetsWithCatalog(user || {}, logoAssets),
    [user, logoAssets]
  );


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

  const { data: allReferrals = [] } = useQuery({
    queryKey: ['referralsForStoryUnlock', user?.email],
    queryFn: () => Query.Referral.list(),
    enabled: !!user?.email,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: friends = [], isLoading: isLoadingFriends } = useQuery({
    queryKey: ['friends', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await Query.Friend.list();
      return allFriends.filter(f => 
        (f.request_sent_by?.toLowerCase() === user.email.toLowerCase() || 
         f.request_sent_to?.toLowerCase() === user.email.toLowerCase()) && 
        ['accepted', 'partner'].includes(String(f.status || '').toLowerCase())
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
        ['pending', 'partner_pending'].includes(String(friendship.status || '').toLowerCase())
      );
    },
    enabled: !!user?.email,
    initialData: [],
    staleTime: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: partnerPendingRelations = [] } = useQuery({
    queryKey: ['partnerPendingRelations', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await Query.Friend.list();
      return allFriends.filter((friendship) =>
        ['partner_pending'].includes(String(friendship.status || '').toLowerCase()) &&
        (
          friendship.request_sent_by?.toLowerCase() === user.email.toLowerCase() ||
          friendship.request_sent_to?.toLowerCase() === user.email.toLowerCase()
        )
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

  const {
    data: allDiscoveries = [],
    isLoading: isLoadingAllDiscoveries,
    refetch: refetchAllDiscoveries,
  } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => Query.UserPlantDiscovery.list('-created_date'),
    initialData: [],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: scanLikes = [] } = useQuery({
    queryKey: ['scanLikesAll'],
    queryFn: () => Query.ScanLike.list('-created_date'),
    initialData: [],
    staleTime: 60 * 1000,
    enabled: !!user?.email,
    refetchOnWindowFocus: true,
  });

  const {
    data: allUsers = [],
    isLoading: isLoadingAllUsers,
    refetch: refetchAllUsers,
  } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => Query.PublicProfile.list(),
    initialData: [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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

  const {
    data: userWallet = null,
  } = useQuery({
    queryKey: ['userWallet', user?.id],
    queryFn: () => getUserWallet(user?.id),
    enabled: !!user?.id,
    initialData: null,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const {
    data: openPlantQuiz = null,
    isFetching: isOpenPlantQuizFetching,
    refetch: refetchOpenPlantQuiz,
  } = useQuery({
    queryKey: ['openPlantQuiz', user?.id],
    queryFn: () => getOpenPlantQuiz(user?.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user?.id) return;
    refetchOpenPlantQuiz();
  }, [user?.id, refetchOpenPlantQuiz]);

  const {
    data: robotPlantShopItems = [],
    isPending: isRobotPlantShopItemsPending,
    isFetching: isRobotPlantShopItemsFetching,
  } = useQuery({
    queryKey: ['robotPlantShopItems', user?.id],
    queryFn: () => listRobotPlantShopItems(),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const {
    data: robotPlantInventory = [],
    isPending: isRobotPlantInventoryPending,
    isFetching: isRobotPlantInventoryFetching,
  } = useQuery({
    queryKey: ['robotPlantInventory', user?.id],
    queryFn: () => listRobotPlantInventory(user?.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: robotPlantActiveEffects = [] } = useQuery({
    queryKey: ['robotPlantActiveEffects', user?.id],
    queryFn: () => listRobotPlantActiveEffects(user?.id),
    enabled: !!user?.id,
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
    mutationFn: ({ itemId }) => activateRobotPlantInventoryItem({ itemId }),
    onSuccess: async (result) => {
      if (!result?.applied) {
        const errorCode = String(result?.error_code || "");
        if (errorCode === "inventory_empty") {
          setCareActionMessage('Dieser Dünger ist im Inventar nicht mehr verfügbar.');
          await queryClient.invalidateQueries({ queryKey: ['robotPlantInventory'] });
          return;
        }
        if (errorCode === "item_not_found") {
          setCareActionMessage('Dünger konnte nicht gefunden werden.');
          return;
        }
        if (errorCode === "item_has_no_effect") {
          setCareActionMessage('Dieses Item hat keinen aktivierbaren Effekt.');
          return;
        }
        setCareActionMessage('Aktivierung fehlgeschlagen.');
        return;
      }

      setCareActionMessage('Duenger aktiviert.');
      await queryClient.invalidateQueries({ queryKey: ['robotPlantInventory'] });
      await queryClient.invalidateQueries({ queryKey: ['robotPlantActiveEffects'] });
    },
    onError: (error) => {
      const rawMessage = String(error?.message || '').trim();
      setCareActionMessage(rawMessage ? `Aktivierung fehlgeschlagen: ${rawMessage}` : 'Aktivierung fehlgeschlagen.');
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

  const submitPlantQuizMutation = useMutation({
    mutationFn: ({ quizId, selectedPlantId }) => submitPlantQuizAnswer({ quizId, selectedPlantId }),
    onSuccess: async (result, variables) => {
      const payload = {
        ...result,
        quizId: variables?.quizId || null,
        selectedPlantId: variables?.selectedPlantId || null,
        selectedPlantLabel: variables?.selectedPlantLabel || "",
      };

      setQuizFeedback(payload);
      setShowQuizFeedback(true);

      if (!result?.resolved) {
        setPlantQuizResult(result || null);
      } else {
        setShowPlantQuizDialog(false);
        setPlantQuizResult(null);
      }

      if (result?.resolved) {
        await queryClient.invalidateQueries({ queryKey: ['openPlantQuiz', user?.id] });
        await queryClient.invalidateQueries({ queryKey: ['robotPlantState'] });
      }
    },
    onError: (error) => {
      const message = String(error?.message || '').trim() || 'Antwort konnte nicht verarbeitet werden.';
      const errorPayload = { success: false, correct: false, resolved: false, attemptsRemaining: null, error: message };
      setPlantQuizResult(errorPayload);
      setQuizFeedback(errorPayload);
      setShowQuizFeedback(true);
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
    queryClient.refetchQueries({ queryKey: ['explorerDiscoveries'] });
    queryClient.refetchQueries({ queryKey: ['robotPlantState'] });
    queryClient.refetchQueries({ queryKey: ['userWallet'] });
    
    // NICHT mehr hier - Rewards werden nur beim Scannen/Quest-Completion geprüft
  };

  useEffect(() => {
    loadUserData();

    // Subscription für User-Updates
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
      queryClient.refetchQueries({ queryKey: ['explorerDiscoveries'] });
      queryClient.refetchQueries({ queryKey: ['robotPlantState'] });
      queryClient.refetchQueries({ queryKey: ['userWallet'] });
    };

    window.addEventListener('userUpdated', handleUserUpdate);
    
    return () => {
      unsubscribe();
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, []);

  // Referral-Code aus localStorage verarbeiten, sobald User eingeloggt ist (einmalig)
  useEffect(() => {
    if (!user?.email) return;
    const referralCode = localStorage.getItem('referral_code');
    if (!referralCode) return;

    const referrerEmail = resolveReferralEmail(referralCode);
    // Sofort löschen, um doppelte Verarbeitung zu verhindern
    localStorage.removeItem('referral_code');

    if (!referrerEmail) return;

    if (referrerEmail.toLowerCase() === user.email.toLowerCase()) return;

    (async () => {
      try {
        // Erstellt/aktualisiert Referral inkl. Account-Referenz und verbindet beide Accounts.
        await connectViaReferral(referrerEmail);
        queryClient.invalidateQueries({ queryKey: ['referralsForStoryUnlock', referrerEmail] });
        queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests'] });
      } catch (_e) {
        // Duplikat oder bereits bestehende Verknüpfung ignorieren
      }
    })();
  }, [user?.email, queryClient]);

  useEffect(() => {
    if (!user?.email) return;

    const unsubscribeReferral = Query.Referral.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['referralsForStoryUnlock', user.email] });
      }
    });

    return () => {
      unsubscribeReferral?.();
    };
  }, [user?.email, queryClient]);

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

  useEffect(() => {
    let isCancelled = false;

    const claimDailySparks = async () => {
      if (!user?.id) return;

      try {
        const claimResult = await claimDailyLoginSparks({
          metadata: {
            source: 'home_open',
            user_email: user?.email || null,
          },
        });

        if (isCancelled || !claimResult?.applied) {
          return;
        }

        const award = Math.max(0, Number(claimResult?.awarded_amount ?? 0));
        const streakDays = Math.max(0, Number(claimResult?.streak_days ?? 0));
        if (award <= 0) {
          return;
        }

        setDailySparkClaimFeedback({
          awardedAmount: award,
          streakDays,
          sparksBalance: Math.max(0, Number(claimResult?.sparks_balance ?? 0)),
        });
        await queryClient.invalidateQueries({ queryKey: ['userWallet'] });
      } catch (error) {
        console.warn('[Home] Daily spark claim failed:', error?.message || error);
      }
    };

    claimDailySparks();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, user?.email, queryClient]);

  // Consume transient navigation state exactly once per navigation
  useEffect(() => {
    if (!location.state) return;

    const hasScanFeedback = Boolean(location.state.scanFeedback);
    const navigationUnlocks = Array.isArray(location.state.scanZoneUnlocks)
      ? location.state.scanZoneUnlocks
      : [];
    const hasScanZoneUnlocks = navigationUnlocks.length > 0;
    const shouldOpenSettings = Boolean(location.state.openSettings);

    if (!hasScanFeedback && !hasScanZoneUnlocks && !shouldOpenSettings) return;

    if (hasScanFeedback && !blockNavigationFeedbackRef.current) {
      safeSetScanFeedback(location.state.scanFeedback);
      setShowScanFeedback(true);
      if (hasScanZoneUnlocks) {
        setScanZoneUnlockQueue(navigationUnlocks);
      }
    } else if (hasScanZoneUnlocks) {
      setScanZoneUnlockQueue(navigationUnlocks);
      setShowScanZoneUnlock(true);
    }

    if (shouldOpenSettings) {
      setActivePanel("settings");
      setShowHealthStatsPanel(false);
    }

    const {
      scanFeedback: _ignoredFeedback,
      scanZoneUnlocks: _ignoredScanZoneUnlocks,
      openSettings: _ignoredOpenSettings,
      ...restState
    } = location.state;
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

  useEffect(() => {
    let isCancelled = false;

    const loadMapDiscoveryData = async () => {
      if (activePanel !== "map") return;

      const liveCachedLocation = getCachedLocation({ maxAgeMs: LOCATION_CACHE_MAX_AGE_MS });
      const hasLiveLocation = Number.isFinite(liveCachedLocation?.lat) && Number.isFinite(liveCachedLocation?.lng);
      if (!hasLiveLocation) return;

      setIsMapDiscoveryDataLoading(true);
      try {
        await Promise.all([
          refetchAllDiscoveries(),
          refetchAllUsers(),
        ]);
      } finally {
        if (!isCancelled) {
          setIsMapDiscoveryDataLoading(false);
        }
      }
    };

    loadMapDiscoveryData();

    return () => {
      isCancelled = true;
    };
  }, [activePanel, refetchAllDiscoveries, refetchAllUsers]);


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
        selected_face_asset: userData.selected_face_asset,
        selected_plant_asset: userData.selected_plant_asset,
        selected_border_asset: userData.selected_border_asset,
        selected_border_color: userData.selected_border_color,
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
  }, [activePanel, showHealthStatsPanel]);

  const cachedLocation = getCachedLocation({ maxAgeMs: LOCATION_CACHE_MAX_AGE_MS });
  const hasLiveCachedLocation = Number.isFinite(cachedLocation?.lat) && Number.isFinite(cachedLocation?.lng);
  const fallbackClaimCenterLat = Number(heroZones?.[0]?.centerLat);
  const fallbackClaimCenterLng = Number(heroZones?.[0]?.centerLng);
  const claimsCenterLat = hasLiveCachedLocation ? Number(cachedLocation?.lat) : fallbackClaimCenterLat;
  const claimsCenterLng = hasLiveCachedLocation ? Number(cachedLocation?.lng) : fallbackClaimCenterLng;

  const {
    data: claimedTiles = [],
    error: tileClaimsError,
    isLoading: isTileClaimsLoading,
    isFetching: isTileClaimsFetching,
    isFetched: isTileClaimsFetched,
  } = useQuery({
    queryKey: ["tileClaims", user?.id, claimsCenterLat, claimsCenterLng],
    queryFn: () =>
      getTileClaims({
        latitude: claimsCenterLat,
        longitude: claimsCenterLng,
        radiusM: NEARBY_DISCOVERY_RADIUS_METERS,
      }),
    enabled:
      !!user?.id &&
      activePanel === "map" &&
      Number.isFinite(claimsCenterLat) &&
      Number.isFinite(claimsCenterLng),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const isClaimsPendingForMap =
    activePanel === "map" &&
    !tileClaimsError &&
    (isTileClaimsLoading || isTileClaimsFetching || !isTileClaimsFetched);

  const claimedTilesWithLogos = useMemo(() => {
    if (!Array.isArray(claimedTiles) || claimedTiles.length === 0) {
      return [];
    }

    return claimedTiles.map((claim) => {
      const ownerAuthId = String(claim?.ownerAuthId || "");
      const ownerProfile = allUsers.find((profile) => String(profile?.auth_id || "") === ownerAuthId) || null;
      const ownerLogoAssets = ownerProfile
        ? resolveEquippedLogoAssetsWithCatalog(ownerProfile, logoAssets)
        : null;

      return {
        ...claim,
        ownerLogoBorderUrl: ownerLogoAssets?.border?.imageUrl || "",
        ownerLogoPlantUrl: ownerLogoAssets?.plant?.imageUrl || "",
        ownerLogoFaceUrl: ownerLogoAssets?.face?.imageUrl || "",
      };
    });
  }, [claimedTiles, allUsers, logoAssets]);

  const isLoadingCriticalData = isLoadingDiscoveries || isLoadingQuests || isLoadingAchievements || isLoadingFriends || isLoadingWeeklyQuests || isLoadingMonthlyQuests || isLoadingCollectionQuests;

  // Computed here (before conditional returns) so the useEffect below can reference it
  const playerSeeds = Math.max(
    0,
    Number(robotPlantState?.wallet_balance ?? robotPlantState?.walletBalance ?? 0)
  );

  const referralPhase6UnlockCount = useMemo(() => {
    if (!user?.email || !Array.isArray(allReferrals)) return 0;
    const userEmailLower = String(user.email || "").trim().toLowerCase();

    return allReferrals.filter((referral) => {
      const referrerEmail = String(referral?.referrer_email || "").trim().toLowerCase();
      const status = String(referral?.status || "").trim().toLowerCase();
      const referredAuthId = String(referral?.auth_id || "").trim();
      return referrerEmail === userEmailLower && status === "completed" && Boolean(referredAuthId);
    }).length;
  }, [allReferrals, user?.email]);

  const shouldForcePhase6ByReferral = playerSeeds >= 40000 && referralPhase6UnlockCount > 0;
  const storySeedProgress = shouldForcePhase6ByReferral ? Math.max(playerSeeds, 50000) : playerSeeds;
  const isShopUnlocked = playerSeeds >= 5000;
  const isPartnerFunctionUnlocked = storySeedProgress >= 50000;
  const currentPartnerRelation = friends.find((friend) => String(friend?.status || '').toLowerCase() === 'partner') || null;
  const partnerCandidates = friends.filter((friend) => String(friend?.status || '').toLowerCase() === 'accepted');
  const resolvePublicProfileLabel = (email) => {
    if (!email) return null;
    const profile = allUsers.find((entry) => entry?.user_email?.toLowerCase() === String(email).toLowerCase());
    return profile?.display_name || profile?.full_name || profile?.user_email || email;
  };

  useEffect(() => {
    if (!user?.id || !userStory || !shouldForcePhase6ByReferral) return;

    const currentConditionState =
      userStory?.condition_state && typeof userStory.condition_state === "object"
        ? userStory.condition_state
        : {};

    if (currentConditionState?.phase6_unlocked_by_referral === true) return;

    updateUserStory(user.id, {
      condition_state: {
        ...currentConditionState,
        phase6_unlocked_by_referral: true,
        phase6_referral_unlocked_at: new Date().toISOString(),
      },
      seed_progress_at_last_eval: Math.max(playerSeeds, 50000),
      last_story_eval_at: new Date().toISOString(),
    })
      .then((nextStory) => {
        if (nextStory) setUserStory(nextStory);
      })
      .catch((error) => {
        console.warn("[Home] Could not persist referral phase 6 unlock state:", error?.message || error);
      });
  }, [playerSeeds, shouldForcePhase6ByReferral, user?.id, userStory]);

  // Florabot-Meilensteine prüfen wenn Wallet geladen
  // Must be declared before any conditional returns to satisfy React hook rules
  useEffect(() => {
    if (!user?.id || !isRobotPlantStateFetched) return;
    if (activeMilestone) return;

    const introSeen = userStory
      ? userStory.intro_seen === true
      : (() => {
          try {
            return !!localStorage.getItem(`florabot_intro_seen_v1:${user.id}`);
          } catch {
            return false;
          }
        })();

    if (!introSeen) return;

    let seenIds = new Set(
      Array.isArray(userStory?.seen_milestone_ids)
        ? userStory.seen_milestone_ids
        : Array.from(getSeenMilestoneIds(user.id))
    );

    // New UserStory rows for existing users should not replay historic milestones.
    if (storyCreatedThisSession) {
      const reachedMilestoneIds = FLORABOT_MILESTONES
        .filter((milestone) => playerSeeds >= milestone.threshold)
        .map((milestone) => milestone.id);

      if (reachedMilestoneIds.length > 0) {
        const mergedSeenIds = mergeSeenMilestoneIds(Array.from(seenIds), reachedMilestoneIds);
        seenIds = new Set(mergedSeenIds);

        updateUserStory(user.id, {
          seen_milestone_ids: mergedSeenIds,
          seed_progress_at_last_eval: playerSeeds,
          last_story_eval_at: new Date().toISOString(),
        })
          .then((nextStory) => {
            if (nextStory) setUserStory(nextStory);
          })
          .catch((error) => {
            console.warn("[Home] Could not persist skipped milestone backlog:", error?.message || error);
          });
      }

      setStoryCreatedThisSession(false);
    }

    const next = getNextUnseenMilestone(playerSeeds, seenIds);
    if (next) setActiveMilestone(next);
  }, [
    playerSeeds,
    user?.id,
    isRobotPlantStateFetched,
    activeMilestone,
    userStory,
    storyCreatedThisSession,
  ]);

  // Ambient comments: random, rate-limited comments when entering Home
  useEffect(() => {
    if (!user?.id || !userStory) return;
    const rules = STORY_PROGRESS_CONDITIONS?.ambientCommentRules;
    if (!rules) return;
    // Prevent concurrent pulls of ambient comments
    if (ambientCommentLockRef.current) return;

    // Do not show if a higher-priority overlay is active
    const blocked = showFlorabotIntro || activeMilestone || florabotContextBubble || showQuizFeedback || showScanFeedback || showScanZoneUnlock;
    if (blocked) return;

    try {
      const lastAt = userStory?.last_ambient_comment_at ? new Date(userStory.last_ambient_comment_at) : null;
      const minutesSince = lastAt ? (Date.now() - lastAt.getTime()) / (1000 * 60) : Infinity;
      if (minutesSince < (rules.cooldownMinutes || 15)) return;

      const todayCount = Number(userStory?.ambient_comment_count || 0);
      if (todayCount >= (rules.maxPerDay || 6)) return;

      if (Math.random() >= (rules.chanceOnHomeEnter || 0.3)) return;

      const exclude = Array.isArray(userStory?.seen_ambient_comment_ids) ? userStory.seen_ambient_comment_ids : [];
      const { comment } = pickRandomPhaseAmbientComment(storySeedProgress, exclude);
      if (!comment) return;

      // Mark that we've pulled an ambient comment so another cannot be pulled concurrently
      ambientCommentLockRef.current = true;
      setFlorabotContextBubble({ panel: 'home', message: comment });
      // Open the Plant Health panel so the comment is rendered there
      setShowHealthStatsPanel(true);

      // Persist ambient comment meta in UserStory
      if (user?.id) {
        const nextSeen = Array.from(new Set([...(userStory?.seen_ambient_comment_ids || []), comment]));
        updateUserStory(user.id, {
          last_ambient_comment_at: new Date().toISOString(),
          ambient_comment_count: (Number(userStory?.ambient_comment_count || 0) + 1),
          seen_ambient_comment_ids: nextSeen,
        })
          .then((nextStory) => {
            if (nextStory) setUserStory(nextStory);
          })
          .catch((error) => {
            console.warn("[Home] Could not persist ambient comment state:", error?.message || error);
          });
      }
    } catch (e) {
      // swallow errors to avoid breaking Home
      console.warn('[Home] ambient comment check failed', e?.message || e);
    }
  }, [user?.id, userStory, storySeedProgress, showFlorabotIntro, activeMilestone, florabotContextBubble, showQuizFeedback, showScanFeedback, showScanZoneUnlock]);

  // If the Plant Health panel is closed while a 'home' context bubble is active,
  // treat that as dismissing the bubble: persist seen state and release locks.
  useEffect(() => {
    if (showHealthStatsPanel) return;
    if (!florabotContextBubble || florabotContextBubble.panel !== 'home') return;
    if (!user?.id) {
      setFlorabotContextBubble(null);
      if (ambientCommentLockRef.current) ambientCommentLockRef.current = false;
      return;
    }

    try {
      try {
        localStorage.setItem(`florabot_ctx_bubble_v1:${user?.id}:${florabotContextBubble.panel}`, "1");
      } catch {}

      const currentContextKeys = Array.isArray(userStory?.seen_context_bubble_keys)
        ? userStory.seen_context_bubble_keys
        : [];
      const mergedContextKeys = Array.from(new Set([...
        currentContextKeys,
        florabotContextBubble.panel,
      ]));

      if (user?.id && florabotContextBubble?.panel) {
        updateUserStory(user.id, {
          seen_context_bubble_keys: mergedContextKeys,
        })
          .then((nextStory) => {
            if (nextStory) setUserStory(nextStory);
          })
          .catch((error) => {
            console.warn("[Home] Could not persist context bubble seen state:", error?.message || error);
          });
      }
    } finally {
      setFlorabotContextBubble(null);
      if (ambientCommentLockRef.current) ambientCommentLockRef.current = false;
    }
  }, [showHealthStatsPanel, florabotContextBubble, user?.id, userStory]);

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

  const playerSparks = Math.max(
    0,
    Number(userWallet?.sparks_balance ?? 0)
  );
  const playerAmber = Math.max(
    0,
    Number(userWallet?.amber_balance ?? 0)
  );
  const playerClaimedTiles = Math.max(
    0,
    Number(robotPlantState?.claimed_tiles_count ?? robotPlantState?.claimedTilesCount ?? 0)
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

  const countRemainingUtcDaySwitches = (expiresAtIso) => {
    const expiryMs = new Date(expiresAtIso || 0).getTime();
    if (!Number.isFinite(expiryMs)) return 0;

    const now = new Date();
    const nextUtcMidnightMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    );

    // Effect can only influence decay on daily rollover; if it ends before next rollover, it contributes 0 days.
    if (expiryMs <= nextUtcMidnightMs) {
      return 0;
    }

    return Math.floor((expiryMs - nextUtcMidnightMs) / (24 * 60 * 60 * 1000)) + 1;
  };

  const decayEffectsWithDaySwitches = activeDecayEffects.map((effect) => ({
    ...effect,
    remainingDaySwitches: countRemainingUtcDaySwitches(effect?.expires_at),
  }));

  const effectiveDecayEffects = decayEffectsWithDaySwitches.filter(
    (effect) => Number(effect.remainingDaySwitches || 0) > 0
  );

  const activeDecayPercent = effectiveDecayEffects.reduce(
    (acc, effect) => acc + Number(effect.effect_value || 0),
    0
  );
  const activeFertilizerItemId = effectiveDecayEffects[0]?.item_id || null;
  const activeFertilizerRemainingDays = effectiveDecayEffects.reduce(
    (maxValue, effect) => Math.max(maxValue, Number(effect.remainingDaySwitches || 0)),
    0
  );
  const isFertilizerInventoryLoading =
    Boolean(user?.id) &&
    (isRobotPlantShopItemsPending ||
      isRobotPlantShopItemsFetching ||
      isRobotPlantInventoryPending ||
      isRobotPlantInventoryFetching);
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
  const quizAvailable = Boolean(openPlantQuiz?.id);

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

  const pulseEnabled = user?.plant_pulse_enabled !== false;
  const pulseHealth = isPlantHealthPending ? 0 : (overallPlantHealth ?? 0);
  const showPulse = pulseEnabled && pulseHealth > 0;
  const pulseInnerOpacity = showPulse ? Math.round((pulseHealth / 100) * 0xaa).toString(16).padStart(2, '0') : '00';
  const pulseOuterOpacity = showPulse ? Math.round((pulseHealth / 100) * 0x55).toString(16).padStart(2, '0') : '00';
  const pulseDuration = showPulse ? (2.4 - (pulseHealth / 100) * 1.2).toFixed(2) + 's' : '2s';

  const currentZoneColor = !hasResolvedZoneBootstrap
    ? "#6b7280"
    : activeZone
    ? THEME_MAP_COLORS[activeZone.theme] || "#84cc16"
    : "#6b7280";
  const currentUserEmailLower = (user?.email || "").toLowerCase();

  const isMapDataPending = isMapDiscoveryDataLoading || isLoadingAllDiscoveries || isLoadingAllUsers;
  const likedDiscoveryIdSet = new Set(
    (scanLikes || [])
      .filter((like) => like?.discovery_id && like?.liked_by?.toLowerCase() === currentUserEmailLower)
      .map((like) => like.discovery_id)
  );

  const allDiscoveryPoints = allDiscoveries
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
      const discoveryLogoAssets = discoveryUser
        ? resolveEquippedLogoAssetsWithCatalog(discoveryUser, logoAssets)
        : (isOwnDiscovery ? equippedLogoAssets : null);

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
        scannerLogoBorderUrl: discoveryLogoAssets?.border?.imageUrl || "",
        scannerLogoPlantUrl: discoveryLogoAssets?.plant?.imageUrl || "",
        scannerLogoFaceUrl: discoveryLogoAssets?.face?.imageUrl || "",
        scannerLogoBorderColor: discoveryLogoAssets?.borderColor || "",
      };
    })
    .filter(Boolean);

  const nearbyDiscoveryPoints = hasLiveCachedLocation
    ? allDiscoveryPoints.filter((point) => {
        const distanceM = calculateDistanceMetersRaw(
          cachedLocation.lat,
          cachedLocation.lng,
          point.lat,
          point.lng
        );
        return Number.isFinite(distanceM) && distanceM <= NEARBY_DISCOVERY_RADIUS_METERS;
      })
    : [];

  const friendEmailSet = new Set(
    friends.flatMap((f) => {
      const userEmailLower = (user?.email || "").toLowerCase();
      const emails = [];
      if (f.request_sent_by && f.request_sent_by.toLowerCase() !== userEmailLower)
        emails.push(f.request_sent_by.toLowerCase());
      if (f.request_sent_to && f.request_sent_to.toLowerCase() !== userEmailLower)
        emails.push(f.request_sent_to.toLowerCase());
      return emails;
    })
  );
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
  const claimedTileMultiplier = 1 + playerClaimedTiles * 0.1;
  const knownNextScanMultiplier =
    streakMultiplier * zoneMultiplier * careMultiplier * dailyBonusMultiplier * claimedTileMultiplier;
  const noveltyMinMultiplier = 0.2;
  const noveltyMaxMultiplier = 1;
  const rarityMinMultiplier = 1;
  const rarityMaxMultiplier = 3;
  const nextScanMinMultiplier =
    knownNextScanMultiplier * noveltyMinMultiplier * rarityMinMultiplier;
  const nextScanMaxMultiplier =
    knownNextScanMultiplier * noveltyMaxMultiplier * rarityMaxMultiplier;
  const securedNextScanMultiplier = nextScanMinMultiplier;
  const nextScanMinReward = Math.round((10 + healthStateBonus) * nextScanMinMultiplier);
  const nextScanMaxReward = Math.round((50 + healthStateBonus) * nextScanMaxMultiplier);

  const formatMultiplier = (value) => {
    const safeValue = Number.isFinite(value) ? value : 1;
    return `x${safeValue.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}`;
  };

  const navItems = [
    {
      label: "Kollektion",
      icon: Leaf,
      onClick: () => {
        setActivePanel("collection");
        setShowHealthStatsPanel(false);
      },
      ...getNavButtonStyle({ palette: "green", isLightUi }),
    },
    {
      label: "Erfolge",
      icon: Scroll,
      onClick: () => {
        setActivePanel("achievements");
        setShowHealthStatsPanel(false);
      },
      showNotificationDot: hasRedeemableQuests,
      ...getNavButtonStyle({ palette: "amber", isLightUi }),
    },
    {
      label: "Karte",
      icon: MapPin,
      onClick: () => {
        handleOpenHeroZoneMap();
        setShowHealthStatsPanel(false);
      },
      ...getNavButtonStyle({ palette: "blue", isLightUi }),
    },
    {
      label: "Social",
      icon: Users,
      onClick: () => {
        setActivePanel("friends");
        setShowHealthStatsPanel(false);
      },
      showNotificationDot: hasSocialNotifications,
      ...getNavButtonStyle({ palette: "purple", isLightUi }),
    },
  ];


  const embeddedTitle =
    activePanel === "collection" ? "Kollektionen" :
    activePanel === "map" ? "Karte" :
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
      setActivePanel("map");
      setShowHealthStatsPanel(false);
    } catch (error) {
      const deniedByUser = Number(error?.code) === 1;
      setZoneMapError(
        deniedByUser
          ? "Standortfreigabe verweigert. Ohne Live-Standort kann die Zonenkarte nicht geladen werden."
          : (error?.message || "Standort konnte nicht geladen werden.")
      );
      setActivePanel("map");
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
            title: "🤖 Florabot meldet: Datenpunkt bestätigt!",
            message: `${user.display_name || user.full_name || user.email} hat deinen Fund${plantName ? ` (${plantName})` : ""} markiert. Diese Daten fließen in meine Datenbank ein!`,
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

  const openShop = (category = "accessories") => {
    if (!isShopUnlocked) {
      window.alert("Der Shop wird ab 5.000 Samen freigeschaltet.");
      return false;
    }

    setShopOpenCategory(category);
    setActivePanel("shop");
    setShowHealthStatsPanel(false);
    return true;
  };

  const handleWaterPlantClick = () => {
    setCareActionMessage(null);
    waterPlantMutation.mutate();
  };

  const handleUseFertilizerItem = async (itemId) => {
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

    try {
      const result = await useInventoryItemMutation.mutateAsync({ itemId });
      return Boolean(result?.applied);
    } catch {
      return false;
    }
  };

  const handleOpenFertilizerShop = () => {
    const opened = openShop("backgrounds");
    if (opened) {
      setCareActionMessage("Der Shop zeigt aktuell freigeschaltete Profil-Anpassungen.");
    }
  };

  const handleRequestPartner = async (partnerEmail) => {
    if (!isPartnerFunctionUnlocked) {
      window.alert("Die Partner-Funktion wird ab 50.000 Samen oder mit Phase 6 freigeschaltet.");
      return false;
    }

    if (!partnerEmail) return false;

    try {
      await sendPartnerRequest(partnerEmail);
      queryClient.invalidateQueries({ queryKey: ['friends', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['partnerPendingRelations', user?.email] });
      window.alert(`Partner-Anfrage an ${partnerEmail} gesendet.`);
      return true;
    } catch (error) {
      window.alert(error?.message || "Partner-Anfrage konnte nicht gesendet werden.");
      return false;
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
        {scanFeedback && showScanFeedback && (
          <ScanFeedbackNotification
            feedback={scanFeedback}
            shareSnapshotBackgroundImageUrl={user?.background_image_url || null}
            shareSnapshotBackgroundColor={user?.background_color || null}
            onComplete={() => {
              setShowScanFeedback(false);
              setScanFeedback(null);
              scanFeedbackCooldownRef.current = true;
              blockNavigationFeedbackRef.current = true;
              if (scanZoneUnlockQueue.length > 0) {
                setTimeout(() => {
                  setShowScanZoneUnlock(true);
                }, 280);
              }
              setTimeout(() => {
                scanFeedbackCooldownRef.current = false;
                blockNavigationFeedbackRef.current = false;
              }, 1000); // 1 Sekunde Block
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScanZoneUnlock && scanZoneUnlockQueue.length > 0 && (
          <ScanZoneUnlockNotification
            unlock={scanZoneUnlockQueue[0]}
            remainingCount={Math.max(0, scanZoneUnlockQueue.length - 1)}
            onComplete={() => {
              setScanZoneUnlockQueue((prevQueue) => {
                const nextQueue = prevQueue.slice(1);
                if (nextQueue.length === 0) {
                  setShowScanZoneUnlock(false);
                }
                return nextQueue;
              });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quizFeedback && showQuizFeedback && (
          <QuizFeedbackNotification
            feedback={quizFeedback}
            onComplete={() => {
              setShowQuizFeedback(false);
              setQuizFeedback(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dailySparkClaimFeedback && (
          <DailyLoginSparkNotification
            feedback={dailySparkClaimFeedback}
            onComplete={() => setDailySparkClaimFeedback(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFlorabotIntro && (
          <FlorabotIntroOverlay
            profile={user}
            onDismiss={() => {
              try { localStorage.setItem(`florabot_intro_seen_v1:${user?.id}`, "1"); } catch {}

              if (user?.id) {
                updateUserStory(user.id, {
                  intro_seen: true,
                  intro_seen_at: new Date().toISOString(),
                })
                  .then((nextStory) => {
                    if (nextStory) setUserStory(nextStory);
                  })
                  .catch((error) => {
                    console.warn("[Home] Could not persist intro_seen:", error?.message || error);
                  });
              }

              setShowFlorabotIntro(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeMilestone && !showFlorabotIntro && (
          <FlorabotMilestoneOverlay
            milestone={activeMilestone}
            profile={user}
            onDismiss={(milestoneId) => {
              markMilestoneSeen(user?.id, milestoneId);

              if (user?.id) {
                const nextSeenIds = mergeSeenMilestoneIds(
                  Array.isArray(userStory?.seen_milestone_ids) ? userStory.seen_milestone_ids : [],
                  [milestoneId]
                );

                updateUserStory(user.id, {
                  seen_milestone_ids: nextSeenIds,
                  seed_progress_at_last_eval: playerSeeds,
                  last_story_eval_at: new Date().toISOString(),
                })
                  .then((nextStory) => {
                    if (nextStory) setUserStory(nextStory);
                  })
                  .catch((error) => {
                    console.warn("[Home] Could not persist milestone seen state:", error?.message || error);
                  });
              }

              setActiveMilestone(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {florabotContextBubble && florabotContextBubble.panel !== 'home' && !activeMilestone && !showFlorabotIntro && (
          <FlorabotContextBubble
            message={florabotContextBubble.message}
            profile={user}
            onDismiss={() => {
              try {
                localStorage.setItem(
                  `florabot_ctx_bubble_v1:${user?.id}:${florabotContextBubble.panel}`,
                  "1"
                );
              } catch {}

              if (user?.id && florabotContextBubble?.panel) {
                const currentContextKeys = Array.isArray(userStory?.seen_context_bubble_keys)
                  ? userStory.seen_context_bubble_keys
                  : [];
                const mergedContextKeys = Array.from(new Set([
                  ...currentContextKeys,
                  florabotContextBubble.panel,
                ]));

                updateUserStory(user.id, {
                  seen_context_bubble_keys: mergedContextKeys,
                })
                  .then((nextStory) => {
                    if (nextStory) setUserStory(nextStory);
                  })
                  .catch((error) => {
                    console.warn("[Home] Could not persist context bubble seen state:", error?.message || error);
                  });
              }

              const wasHomeBubble = florabotContextBubble?.panel === 'home';
              setFlorabotContextBubble(null);
              // Release ambient comment lock if this was the ambient/home bubble
              if (ambientCommentLockRef.current && wasHomeBubble) {
                ambientCommentLockRef.current = false;
              }
            }}
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

      <PlantQuizDialog
        open={showPlantQuizDialog}
        quiz={openPlantQuiz}
        isSubmitting={submitPlantQuizMutation.isPending}
        result={plantQuizResult}
        onResetResult={() => setPlantQuizResult(null)}
        onClose={() => {
          setShowPlantQuizDialog(false);
          setPlantQuizResult(null);
        }}
        onSubmit={({ quizId, selectedPlantId, selectedPlantLabel }) => {
          if (!quizId || !selectedPlantId) return;
          submitPlantQuizMutation.mutate({
            quizId,
            selectedPlantId,
            selectedPlantLabel,
          });
        }}
      />

      <Dialog open={showAmberPurchaseModal} onOpenChange={setShowAmberPurchaseModal}>
        <DialogContent className={`sm:max-w-lg ${isLightUi ? "bg-white" : "bg-[#141714] border-[#f0e5a5]/30"}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center w-5 h-5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} aria-hidden="true">🔸</span>
              Bernstein kaufen (Vorbereitung)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className={`text-sm ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
              Aktueller Kontostand: <span className="font-semibold">{playerAmber} Bernstein</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { amount: 120, price: '2,99 EUR' },
                { amount: 350, price: '6,99 EUR' },
                { amount: 900, price: '14,99 EUR' },
              ].map((pack) => (
                <button
                  key={pack.amount}
                  type="button"
                  disabled
                  className={`rounded-2xl border px-3 py-3 text-left opacity-70 cursor-not-allowed ${isLightUi ? "border-[#c8ac62]/40 bg-white/70" : "border-[#f0e5a5]/25 bg-black/30"}`}
                >
                  <div className="text-sm font-semibold">{pack.amount} Bernstein</div>
                  <div className={`text-xs mt-1 ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>{pack.price}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["Apple Pay", "Google Pay", "PayPal", "Kreditkarte"].map((method) => (
                <button
                  key={method}
                  type="button"
                  disabled
                  className={`h-10 rounded-xl border text-xs font-medium opacity-65 cursor-not-allowed ${isLightUi ? "border-[#c8ac62]/35 bg-white/70 text-stone-700" : "border-[#f0e5a5]/20 bg-black/35 text-stone-200"}`}
                >
                  {method}
                </button>
              ))}
            </div>

            <div className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${isLightUi ? "border-amber-300/60 bg-amber-50 text-amber-900" : "border-amber-300/35 bg-amber-900/20 text-amber-100"}`}>
              Die Bezahlfunktionen sind noch nicht aktiv. Dieses Modal bereitet nur die spaetere Echtgeld-Integration vor.
            </div>
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
                userTitle={resolveTitleValue(user?.selected_title, user?.title) || "Pflanzen-Entdecker"}
                onTogglePublicCollections={() => setEmbeddedCollectionPublicPanelOpen((prev) => !prev)}
                onOpenEmbeddedFriendsAddDialog={() => setEmbeddedFriendsAddDialogNonce((prev) => prev + 1)}
                onOpenAmberPurchase={() => setShowAmberPurchaseModal(true)}
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
                    onUserUpdated={(freshUser) => setUser(freshUser)}
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
                    currentUser={user}
                    onHeaderMetaChange={setEmbeddedHeaderMeta}
                    onUserUpdated={(freshUser) => setUser(freshUser)}
                    initialCategory={shopOpenCategory}
                  />
                ) : activePanel === "settings" ? (
                  <SettingsFeatureRoot
                    user={user}
                    onUserUpdated={(freshUser) => setUser(freshUser)}
                    discoveryMarkerScale={discoveryMarkerScale}
                    onDiscoveryMarkerScaleChange={(nextValue) => setDiscoveryMarkerScale(clampDiscoveryMarkerScale(nextValue))}
                  />
                ) : activePanel === "map" ? (
                  <HomeMapFeatureRoot
                    isLightUi={isLightUi}
                    isResolvingLocation={isResolvingHeroMapLocation}
                    isLoadingDiscoveries={isMapDataPending}
                    isLoadingClaims={isClaimsPendingForMap}
                    hasLiveCachedLocation={hasLiveCachedLocation}
                    zoneMapError={zoneMapError}
                    tileClaimError={tileClaimsError ? String(tileClaimsError?.message || tileClaimsError) : null}
                    onRequestLocation={handleOpenHeroZoneMap}
                    heroZones={heroZones}
                    nearbyDiscoveryPoints={nearbyDiscoveryPoints}
                    claimedTiles={claimedTilesWithLogos}
                    cachedLocation={cachedLocation}
                    heroMapCenter={heroMapCenter}
                    onDiscoveryImageClick={handleDiscoveryImageClick}
                    onDiscoveryLike={handleDiscoveryLike}
                    allowDiscoveryLike={!!user?.id}
                    onTokenError={(message) => setZoneMapError(message)}
                    onMapReady={setHeroMapInstance}
                    heroMapInstance={heroMapInstance}
                    authId={user?.id}
                    isAdminUser={isAdminUser}
                    showDebugZonePanel={showDebugZonePanel}
                    onDebugZonePanelChange={setShowDebugZonePanel}
                    onClose={() => setActivePanel(null)}
                    onRegenerateZones={handleRegenerateZones}
                    canRegenerateZones={hasCalledZoneGenerationToday && !isLoadingZone && (isAdminUser || zoneRerollsRemaining !== 0)}
                    isRegeneratingZones={isRegeneratingZones}
                    zoneRerollsRemaining={zoneRerollsRemaining}
                    allDiscoveryPoints={allDiscoveryPoints}
                    friendEmailSet={friendEmailSet}
                    discoveryMarkerScale={discoveryMarkerScale}
                  />
                ) : (
                  <section data-ui="home-plant-hero-section" className="flex-1 min-h-0 rounded-3xl px-[clamp(0.75rem,2vw,1.5rem)] py-[clamp(0.75rem,2vh,1.5rem)] flex flex-col bg-transparent">
                  <div
                    className={`w-full rounded-2xl border backdrop-blur-sm px-[clamp(0.625rem,2vw,0.875rem)] relative ${
                      isLightUi ? "border-[#c8ac62]/45" : "border-[#f0e5a5]/45"
                    }`}
                    style={{
                      height: `${(2.4 * controlsScale).toFixed(2)}rem`,
                      background: isLightUi
                        ? `linear-gradient(90deg, ${resolvedPlantHealthState.color}2e 0%, rgba(255,255,255,0.44) 50%, ${resolvedPlantHealthState.color}24 100%)`
                        : `linear-gradient(90deg, ${resolvedPlantHealthState.color}66 0%, rgba(0,0,0,0.30) 50%, ${resolvedPlantHealthState.color}4a 100%)`,
                    }}
                  >
                    <div className={`h-full w-full grid grid-cols-3 divide-x ${isLightUi ? "divide-[#c8ac62]/35" : "divide-[#f0e5a5]/30"}`}>
                      {/* status columns */}
                      <LockedTooltip
                        unstyled
                        content={(
                          <div
                            className={`rounded-2xl border backdrop-blur-sm p-3.5 shadow-xl ${
                              isLightUi
                                ? "border-amber-400/60 bg-white/88"
                                : "border-amber-300/40 bg-black/75"
                            }`}
                          >
                            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                              isLightUi ? "text-amber-600" : "text-amber-400/80"
                            }`}>
                              Pflanzengesundheit
                            </p>
                            <p className={`font-bold text-sm leading-tight mb-2 ${
                              isLightUi ? "text-amber-800" : "text-amber-300"
                            }`}>
                              {resolvedPlantHealthState.label}
                            </p>
                            <p className={`text-xs leading-snug ${
                              isLightUi ? "text-stone-700" : "text-white/80"
                            }`}>
                              Eine hohe Pflanzengesundheit verbessert deinen Scan-Fortschritt: sie beeinflusst Zonen, Multiplikatoren, taegliche Gewinne und Pflege-Boni.
                            </p>
                          </div>
                        )}
                      >
                        <button
                          type="button"
                          className={`flex items-center justify-center gap-1.5 min-w-0 px-2 text-xs md:text-sm font-semibold transition-colors ${isLightUi ? "text-stone-700 hover:text-stone-800" : "text-white/95 hover:text-white"}`}
                          aria-label="Pflanzengesundheit Info"
                        >
                          <Leaf className="w-4 h-4 shrink-0 text-emerald-500" />
                          <span className="truncate">{resolvedPlantHealthState.label}</span>
                        </button>
                      </LockedTooltip>
                      <LockedTooltip
                        unstyled
                        content={(
                          <div
                            className={`rounded-2xl border backdrop-blur-sm p-3.5 shadow-xl ${
                              isLightUi
                                ? "border-amber-400/60 bg-white/88"
                                : "border-amber-300/40 bg-black/75"
                            }`}
                          >
                            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                              isLightUi ? "text-amber-600" : "text-amber-400/80"
                            }`}>
                              Scan-Zone & Geclaimte Tiles
                            </p>
                            <p className={`font-bold text-sm leading-tight mb-2 ${
                              isLightUi ? "text-amber-800" : "text-amber-300"
                            }`}>
                              {(!hasResolvedZoneBootstrap || isLoadingZone) ? "Wird geladen…" : activeZoneMeta?.label || "Keine Zone"} · {playerClaimedTiles} Tiles
                            </p>
                            <p className={`text-xs leading-snug mb-2 ${
                              isLightUi ? "text-stone-700" : "text-white/80"
                            }`}>
                              {activeZone
                                ? `Du befindest dich in einer aktiven ${activeZoneMeta?.label || ""}-Zone. Scans hier erhalten einen Zonen-Bonus.`
                                : "Du befindest dich aktuell in keiner aktiven Scan-Zone. Begib dich in eine Zone, um einen Bonus-Multiplikator zu erhalten."}
                            </p>
                            <p className={`text-xs leading-snug ${
                              isLightUi ? "text-stone-700" : "text-white/80"
                            }`}>
                              Jede geclaimte Tile erhöht deinen Scan-Multiplikator um +10%. Aktueller Bonus: x{(1 + playerClaimedTiles * 0.1).toFixed(1)}.
                            </p>
                          </div>
                        )}
                      >
                        <button
                          type="button"
                          className={`flex items-center justify-center gap-1.5 min-w-0 w-full h-full px-2 text-xs md:text-sm font-semibold transition-colors ${isLightUi ? "text-stone-700 hover:text-stone-800" : "text-white/95 hover:text-white"}`}
                          aria-label="Scan-Zone Info"
                        >
                          <MapPin className="w-4 h-4 shrink-0" style={{ color: currentZoneColor }} />
                          <span className="truncate">{(!hasResolvedZoneBootstrap || isLoadingZone) ? "..." : playerClaimedTiles}</span>
                        </button>
                      </LockedTooltip>
                      <LockedTooltip
                        unstyled
                        content={(
                          <div
                            className={`rounded-2xl border backdrop-blur-sm p-3.5 shadow-xl ${
                              isLightUi
                                ? "border-amber-400/60 bg-white/88"
                                : "border-amber-300/40 bg-black/75"
                            }`}
                          >
                            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                              isLightUi ? "text-amber-600" : "text-amber-400/80"
                            }`}>
                              Scan-Multiplikator
                            </p>
                            <p className={`font-bold text-sm leading-tight mb-2 ${
                              isLightUi ? "text-amber-800" : "text-amber-300"
                            }`}>
                              {formatMultiplier(securedNextScanMultiplier)}
                            </p>
                            <p className={`text-xs leading-snug ${
                              isLightUi ? "text-stone-700" : "text-white/80"
                            }`}>
                              Mindestens gesichert aus Streak ({formatMultiplier(streakMultiplier)}), Zone ({formatMultiplier(zoneMultiplier)}), Pflege ({formatMultiplier(careMultiplier)}), Tagesbonus ({formatMultiplier(dailyBonusMultiplier)}), Tiles ({formatMultiplier(claimedTileMultiplier)}) und dem konservativen Scan-Minimum.
                            </p>
                          </div>
                        )}
                      >
                        <button
                          type="button"
                          className={`flex items-center justify-center gap-1.5 min-w-0 w-full h-full px-2 text-xs md:text-sm font-semibold transition-colors ${isLightUi ? "text-stone-700 hover:text-stone-800" : "text-white/95 hover:text-white"}`}
                          aria-label="Scan-Multiplikator Info"
                        >
                          <Camera className={`w-4 h-4 shrink-0 ${isLightUi ? "text-amber-700" : "text-amber-300"}`} />
                          <span className="truncate">{formatMultiplier(securedNextScanMultiplier)}</span>
                        </button>
                      </LockedTooltip>
                    </div>

                    {/* botName removed here; rendered inside inner hero container per request */}

                  </div>


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
                      {!showHealthStatsPanel && (() => {
                        const monthlyReady = activeMonthlyQuest?.isCompleted;
                        const weeklyReady = activeWeeklyQuest?.isCompleted;
                        const regularReady = activeRegularQuests.some(q => q.isCompleted);
                        const anyReady = monthlyReady || weeklyReady || regularReady;

                        const questUnseen = currentWeeklyQuest && weeklyQuestSeen !== String(currentWeeklyQuest.id);

                        const borderClass = quizAvailable
                          ? isLightUi ? "border-orange-500/80" : "border-orange-300/70"
                          : monthlyReady
                            ? isLightUi ? "border-purple-500/70" : "border-purple-400/60"
                            : weeklyReady
                              ? isLightUi ? "border-emerald-500/70" : "border-emerald-400/60"
                              : regularReady
                                ? isLightUi ? "border-stone-400/70" : "border-white/50"
                                : questUnseen
                                  ? isLightUi ? "border-amber-400/60" : "border-amber-300/50"
                                  : isLightUi ? "border-[#c8ac62]/40" : "border-[#f0e5a5]/25";

                        const bgStyle = quizAvailable
                          ? isLightUi
                            ? "linear-gradient(135deg, rgba(249,115,22,0.34) 0%, rgba(239,68,68,0.18) 100%)"
                            : "linear-gradient(135deg, rgba(249,115,22,0.56) 0%, rgba(239,68,68,0.36) 100%)"
                          : monthlyReady
                            ? isLightUi
                              ? "linear-gradient(135deg, rgba(168,85,247,0.30) 0%, rgba(168,85,247,0.12) 100%)"
                              : "linear-gradient(135deg, rgba(168,85,247,0.52) 0%, rgba(168,85,247,0.30) 100%)"
                            : weeklyReady
                              ? isLightUi
                                ? "linear-gradient(135deg, rgba(16,185,129,0.30) 0%, rgba(16,185,129,0.12) 100%)"
                                : "linear-gradient(135deg, rgba(16,185,129,0.52) 0%, rgba(16,185,129,0.30) 100%)"
                              : regularReady
                                ? isLightUi
                                  ? "linear-gradient(135deg, rgba(200,200,200,0.38) 0%, rgba(200,200,200,0.16) 100%)"
                                  : "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 100%)"
                                : questUnseen
                                  ? isLightUi
                                    ? "linear-gradient(135deg, rgba(234,179,8,0.28) 0%, rgba(234,179,8,0.10) 100%)"
                                    : "linear-gradient(135deg, rgba(234,179,8,0.48) 0%, rgba(234,179,8,0.28) 100%)"
                                  : isLightUi
                                    ? "linear-gradient(135deg, rgba(107,114,128,0.22) 0%, rgba(107,114,128,0.08) 100%)"
                                    : "linear-gradient(135deg, rgba(107,114,128,0.38) 0%, rgba(107,114,128,0.18) 100%)";

                        const iconColor = quizAvailable
                          ? isLightUi ? "text-orange-700" : "text-orange-200"
                          : monthlyReady
                            ? isLightUi ? "text-purple-700" : "text-purple-300"
                            : weeklyReady
                              ? isLightUi ? "text-emerald-700" : "text-emerald-300"
                              : regularReady
                                ? isLightUi ? "text-stone-600" : "text-white"
                                : questUnseen
                                  ? isLightUi ? "text-amber-700" : "text-amber-300"
                                  : isLightUi ? "text-stone-500" : "text-stone-400";

                        return (
                          <button
                            type="button"
                            onClick={async () => {
                              if (quizAvailable) {
                                setShowPlantQuizDialog(true);
                                setPlantQuizResult(null);
                                return;
                              }

                              // Force-refresh quiz state on click so login-time cache races
                              // cannot hide an existing open quiz.
                              if (user?.id) {
                                const refreshed = await refetchOpenPlantQuiz();
                                if (refreshed?.data?.id) {
                                  setShowPlantQuizDialog(true);
                                  setPlantQuizResult(null);
                                  return;
                                }
                              }

                              if (anyReady) {
                                setActivePanel("achievements");
                                setShowHealthStatsPanel(false);
                              } else {
                                setShowWeeklyQuestTooltip((prev) => !prev);
                                if (currentWeeklyQuest?.id) {
                                  const key = String(currentWeeklyQuest.id);
                                  setWeeklyQuestSeen(key);
                                  try { localStorage.setItem('weeklyQuestSeen', key); } catch {}
                                }
                              }
                            }}
                            className={`absolute left-0 md:left-2 top-5 md:top-6 z-10 w-[4.4rem] h-[3.6rem] md:w-[4.9rem] md:h-[3.9rem] rounded-2xl border backdrop-blur-sm flex flex-col items-center justify-center ${borderClass}`}
                            style={{ background: bgStyle }}
                            aria-label={quizAvailable ? "Quiz öffnen" : (anyReady ? "Quest abgeben" : "Wochenquest anzeigen")}
                            disabled={isOpenPlantQuizFetching}
                          >
                            <span className={`text-[1.35rem] font-black leading-none ${iconColor}`}>
                              {quizAvailable ? "!" : (anyReady ? "?" : "!")}
                            </span>
                            <span className={`font-semibold text-[10px] md:text-[11px] leading-none mt-0.5 ${isLightUi ? "text-stone-800" : "text-white"}`}>{quizAvailable ? "Quiz" : "Quest"}</span>
                          </button>
                        );
                      })()}

                      {showWeeklyQuestTooltip && (
                        <>
                          <div
                            className="absolute inset-0 z-[19]"
                            onClick={() => setShowWeeklyQuestTooltip(false)}
                          />
                          <div
                            className={`absolute left-0 z-[21] right-0 rounded-2xl border backdrop-blur-sm p-3.5 shadow-xl overflow-y-auto ${
                              isLightUi
                                ? "border-amber-400/60 bg-white/88"
                                : "border-amber-300/40 bg-black/75"
                            }`}
                            style={{
                              top: "calc(1.25rem + 3.6rem + 0.5rem)",
                              maxHeight: isNavVisible
                                ? "calc(100vh - 11rem)"
                                : "calc(100vh - 7rem)",
                            }}
                          >
                            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                              isLightUi ? "text-amber-600" : "text-amber-400/80"
                            }`}>
                              Pflanze der Woche:
                            </p>
                            <p className={`font-bold text-sm leading-tight mb-2 ${
                              isLightUi ? "text-amber-800" : "text-amber-300"
                            }`}>
                              {currentWeeklyQuest
                                ? (currentWeeklyQuest.target_species_name || currentWeeklyQuest.target_genus_name || currentWeeklyQuest.title)
                                : "Keine Wochenquest"}
                            </p>
                            {currentWeeklyQuest?.description && (
                              <p className={`text-xs leading-snug ${
                                isLightUi ? "text-stone-700" : "text-white/80"
                              }`}>
                                {currentWeeklyQuest.description}
                              </p>
                            )}
                          </div>
                        </>
                      )}

                    {!showHealthStatsPanel && (
                      <button
                        type="button"
                        onClick={() => openShop("accessories")}
                        disabled={!isShopUnlocked}
                        aria-label="Profil anpassen"
                        className={`absolute right-0 md:right-2 top-5 md:top-6 z-10 w-[4.4rem] h-[3.6rem] md:w-[4.9rem] md:h-[3.9rem] rounded-2xl border backdrop-blur-sm flex flex-col items-center justify-center ${
                          isLightUi
                            ? "border-[#c8ac62]/60"
                            : "border-[#f0e5a5]/40"
                        }`}
                        style={{
                          background: isLightUi
                            ? "linear-gradient(135deg, rgba(107,114,128,0.28) 0%, rgba(107,114,128,0.12) 100%)"
                            : "linear-gradient(135deg, rgba(107,114,128,0.48) 0%, rgba(107,114,128,0.30) 100%)",
                          opacity: isShopUnlocked ? 1 : 0.72,
                        }}
                      >
                        <Palette className={`w-4 h-4 ${isLightUi ? "text-stone-700" : "text-white/90"}`} />
                        <span className={`font-semibold text-[11px] md:text-xs leading-none mt-0.5 ${isLightUi ? "text-stone-800" : "text-white"}`}>
                          Anpassen
                        </span>
                      </button>
                    )}

                    <div className={`absolute inset-0 w-full rounded-2xl px-3 py-3 space-y-2.5 max-h-[calc(100vh-7rem)] overflow-y-scroll hide-scrollbar pointer-events-auto z-[15] ${
                      isLightUi ? "text-stone-700" : "text-stone-100"
                    }`}>
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
                            activeFertilizerRemainingDays={activeFertilizerRemainingDays}
                            activeDecayEffects={activeDecayEffects}
                            activeDecayPercent={activeDecayPercent}
                            careActionMessage={careActionMessage}
                            careGainFeedback={careGainFeedback}
                            onWaterPlant={handleWaterPlantClick}
                            onUseFertilizerItem={handleUseFertilizerItem}
                            onOpenFertilizerShop={handleOpenFertilizerShop}
                            currentPartnerLabel={currentPartnerRelation ? resolvePublicProfileLabel(currentPartnerRelation.request_sent_by?.toLowerCase() === (user?.email || '').toLowerCase() ? currentPartnerRelation.request_sent_to : currentPartnerRelation.request_sent_by) : null}
                            partnerCandidates={partnerCandidates.map((friend) => {
                              const email = friend.request_sent_by?.toLowerCase() === (user?.email || '').toLowerCase() ? friend.request_sent_to : friend.request_sent_by;
                              return {
                                email,
                                name: resolvePublicProfileLabel(email),
                                title: 'Partner',
                              };
                            })}
                            isPartnerFeatureUnlocked={isPartnerFunctionUnlocked}
                            isPartnerPending={partnerPendingRelations.length > 0}
                            onRequestPartner={handleRequestPartner}
                            contextBubbleMessage={florabotContextBubble?.panel === 'home' ? florabotContextBubble?.message : null}
                            contextBubbleProfile={user}
                            onContextBubbleDismiss={() => setShowHealthStatsPanel(false)}
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
                            {showPulse && (
                              <div
                                className="absolute left-1/2 top-1/2 w-[75%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl animate-pulse pointer-events-none"
                                style={{
                                  background: `radial-gradient(circle, ${resolvedPlantHealthState.color}${pulseInnerOpacity} 0%, ${resolvedPlantHealthState.color}${pulseOuterOpacity} 46%, transparent 74%)`,
                                  animationDuration: pulseDuration,
                                }}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => setShowHealthStatsPanel(true)}
                              className="absolute left-1/2 top-1/2 w-[82%] aspect-square -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                              aria-label="Pflanzenstatus-Panel öffnen"
                            >
                              <div className="relative w-full h-full p-[10%] drop-shadow-[0_0_24px_rgba(190,242,100,0.6)]">
                                {(equippedLogoAssets.border?.imageUrl || equippedLogoAssets.plant?.imageUrl || equippedLogoAssets.face?.imageUrl) && (
                                  <div className="absolute left-1/2 top-1/2 h-[56%] w-[56%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35" />
                                )}
                                {equippedLogoAssets.border?.imageUrl && (
                                  <img
                                    src={equippedLogoAssets.border.imageUrl}
                                    alt="Logo Rahmen"
                                    className="absolute inset-0 w-full h-full object-contain"
                                    style={equippedLogoAssets.borderColor
                                      ? { filter: `brightness(0) saturate(100%) ${hexToFilter(equippedLogoAssets.borderColor)}` }
                                      : undefined}
                                  />
                                )}
                                {equippedLogoAssets.plant?.imageUrl && (
                                  <img
                                    src={equippedLogoAssets.plant.imageUrl}
                                    alt="Logo Pflanze"
                                    className="absolute inset-0 w-full h-full object-contain"
                                  />
                                )}
                                {equippedLogoAssets.face?.imageUrl && (
                                  <img
                                    src={equippedLogoAssets.face.imageUrl}
                                    alt="Logo Gesicht"
                                    className="absolute inset-0 w-full h-full object-contain"
                                  />
                                )}
                              </div>
                            </button>



                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>

                    {botName && !showHealthStatsPanel && (
                      <div className="absolute left-1/2 transform -translate-x-1/2 z-30 pointer-events-none" style={{ bottom: 0 }}>
                        <div className={`px-3 py-1 rounded-full border ${isLightUi ? "bg-white/80 text-stone-800 border-[#c8ac62]/45" : "bg-black/50 text-white/90 border-[#f0e5a5]/30"}`}>
                          <span className="font-semibold text-sm truncate max-w-[12rem] block text-center">{botName}</span>
                        </div>
                      </div>
                    )}

                    </div>
                  </div>

                  <div
                    className={`mt-[clamp(0.375rem,1vh,0.75rem)] w-full grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center text-xs md:text-sm font-semibold rounded-xl border ${
                      isLightUi
                        ? "text-stone-700 border-[#c8ac62]/35 bg-white/50"
                        : "text-white/95 border-[#f0e5a5]/20 bg-black/35"
                    }`}
                  >
                    <LockedTooltip
                      unstyled
                      content={(
                        <div
                          className={`rounded-2xl border backdrop-blur-sm p-3.5 shadow-xl ${
                            isLightUi
                              ? "border-amber-400/60 bg-white/88"
                              : "border-amber-300/40 bg-black/75"
                          }`}
                        >
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                            isLightUi ? "text-amber-600" : "text-amber-400/80"
                          }`}>
                            Währung
                          </p>
                          <p className={`font-bold text-sm leading-tight mb-2 ${
                            isLightUi ? "text-amber-800" : "text-amber-300"
                          }`}>
                            Samen
                          </p>
                          <p className={`text-xs leading-snug ${
                            isLightUi ? "text-stone-700" : "text-white/80"
                          }`}>
                            Zeigt deinen Spielfortschritt und schaltet neue Funktionen und Inhalte frei.
                          </p>
                        </div>
                      )}
                    >
                      <button
                        type="button"
                        className="inline-flex w-full min-w-0 items-center justify-center py-2.5"
                        aria-label="Samen anzeigen"
                      >
                        <span className="inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap text-center">
                          <span>{playerSeeds}</span>
                          <Leaf className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                        </span>
                      </button>
                    </LockedTooltip>

                    <span className={`flex items-center justify-center px-1 ${isLightUi ? "text-stone-400/70" : "text-white/35"}`}>|</span>

                    <LockedTooltip
                      unstyled
                      content={(
                        <div
                          className={`rounded-2xl border backdrop-blur-sm p-3.5 shadow-xl ${
                            isLightUi
                              ? "border-amber-400/60 bg-white/88"
                              : "border-amber-300/40 bg-black/75"
                          }`}
                        >
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                            isLightUi ? "text-amber-600" : "text-amber-400/80"
                          }`}>
                            Währung
                          </p>
                          <p className={`font-bold text-sm leading-tight mb-2 ${
                            isLightUi ? "text-amber-800" : "text-amber-300"
                          }`}>
                            Funken
                          </p>
                          <p className={`text-xs leading-snug ${
                            isLightUi ? "text-stone-700" : "text-white/80"
                          }`}>
                            Verdient durch Login, dem abschließen der Monats-Quest und neuen Scans in Geo-Zonen. Wird benötigt zum Freischalten von Anpassungen.
                          </p>
                        </div>
                      )}
                    >
                      <button
                        type="button"
                        className="inline-flex w-full min-w-0 items-center justify-center py-2.5"
                        aria-label="Funken anzeigen"
                      >
                        <span className="inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap text-center">
                          <span>{playerSparks}</span>
                          <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        </span>
                      </button>
                    </LockedTooltip>

                    <span className={`flex items-center justify-center px-1 ${isLightUi ? "text-stone-400/70" : "text-white/35"}`}>|</span>

                    <LockedTooltip
                      unstyled
                      content={(
                        <div
                          className={`rounded-2xl border backdrop-blur-sm p-3.5 shadow-xl ${
                            isLightUi
                              ? "border-amber-400/60 bg-white/88"
                              : "border-amber-300/40 bg-black/75"
                          }`}
                        >
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                            isLightUi ? "text-amber-600" : "text-amber-400/80"
                          }`}>
                            Währung
                          </p>
                          <p className={`font-bold text-sm leading-tight mb-2 ${
                            isLightUi ? "text-amber-800" : "text-amber-300"
                          }`}>
                            Bernstein
                          </p>
                          <p className={`text-xs leading-snug ${
                            isLightUi ? "text-stone-700" : "text-white/80"
                          }`}>
                            Premiumwährung für besondere Anpassungen. Kann im Shop erworben und zukünftig durch besondere Aktionen verdient werden.
                          </p>
                        </div>
                      )}
                    >
                      <button
                        type="button"
                        className="inline-flex w-full min-w-0 items-center justify-center py-2.5"
                        aria-label="Bernstein anzeigen"
                      >
                        <span className="inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap text-center">
                          <span>{playerAmber}</span>
                          <span className="inline-flex items-center justify-center w-3.5 h-3.5 shrink-0 text-orange-500" aria-hidden="true">🔸</span>
                        </span>
                      </button>
                    </LockedTooltip>
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
                isNavVisible={isNavVisible}
                onNavVisibleChange={setIsNavVisible}
              />
            </div>
          </motion.div>

      </HomeBackgroundShell>
    </>
  );
}

export default function Home() {
  return (
    <HomeOtaGate>
      <HomeContent />
    </HomeOtaGate>
  );
}


