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
import { trackAction } from "@/api/analyticsService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Leaf, Sprout, Users, Scroll, CheckCircle, AlertCircle, TreePine, Building2, Waves, Flower2, MapPin, Smartphone, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AchievementNotification from "../components/achievements/AchievementNotification";
import ScanFeedbackNotification from "../components/notifications/ScanFeedbackNotification";
import ScanZoneUnlockNotification from "../components/notifications/ScanZoneUnlockNotification";
import RandomRewardNotification from "../components/notifications/RandomRewardNotification";
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
import GoldGradientCard from "@/components/home/GoldGradientCard";
import HomeCollectionStripes from "@/components/home/HomeCollectionStripes";
import HomeMilestoneOverlayToggle from "@/components/home/HomeMilestoneOverlayToggle";
import HomeHeroSideNav from "@/components/home/HomeHeroSideNav";
import HomeProfileBadgesPanel from "@/components/home/HomeProfileBadgesPanel";
import RewardCardWrapper from "@/components/home/RewardCardWrapper";
import HomeEventStripe from "@/components/home/HomeEventStripe";
import HomeScanInfoRow from "@/components/home/HomeScanInfoRow";
import HomeCurrencyInfoRow from "@/components/home/HomeCurrencyInfoRow";
import PlantHeroHealthPanel from "@/components/home/PlantHeroHealthPanel";
import GreenCareBubble from "@/components/home/GreenCareBubble";
import GuestHomeFlow from "@/components/home/GuestHomeFlow";
import BugReportDialog from "@/components/home/BugReportDialog";
import ServerNewsDialog from "@/components/home/ServerNewsDialog";
import HomeOtaGate from "@/components/home/HomeOtaGate";
import HomeMapFeatureRoot from "@/components/home/HomeMapFeatureRoot.jsx";
import ShopCategoryVerticalCarousel from "@/components/home/ShopCategoryVerticalCarousel";
import AmberPurchaseDialog from "@/components/home/AmberPurchaseDialog";

import ShopFeatureRoot from "@/components/shop/ShopFeatureRoot";
import PlantQuizDialog from "@/components/home/PlantQuizDialog";
import AchievementsFeatureRoot from "@/components/achievements/AchievementsFeatureRoot";
import FriendsFeatureRoot from "@/components/friends/FriendsFeatureRoot";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCurrentWeeklyQuest, getCurrentMonthlyQuest, getWeekNumber } from "@/components/quests/QuestRotationHelper";
import { useUiTheme } from "@/lib/UiThemeContext";
import { useAuth } from "@/lib/AuthContext";
import { resolveReferralEmail } from "@/lib/referralCode";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import { resolveTitleValue } from "@/lib/profileCustomizationOptions";
import {
  buildSelectedProfileBadges,
  evaluateProfileBadges,
  PROFILE_BADGE_MAX_SELECTED,
} from "@/lib/profileBadges";
import { getProfileBadgeIconComponent } from "@/lib/profileBadgeIcons";
import { resolveOwnedUniqueBadges } from "@/lib/profileUniqueBadges";
import { getRarityLevelFromLabel } from "@/lib/plantRarity";
import FlorabotIntroOverlay from "@/components/florabot/FlorabotIntroOverlay";
import FlorabotMilestoneOverlay from "@/components/florabot/FlorabotMilestoneOverlay";
import { getActiveSeason } from "@/lib/seasonConfig";
import FlorabotContextBubble from "@/components/florabot/FlorabotContextBubble";
import {
  pickRandomPhaseAmbientComment,
  interpolatePercentVariables,
  buildStoryProfileVariables,
  buildNotificationPayload,
} from "@/lib/story/storyDefinition";
import { getSeenMilestoneIds, getNextUnseenMilestone, markMilestoneSeen, FLORABOT_MILESTONES } from "@/lib/florabotMilestones";

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
const PORTAL_CARE_DEBUG_PREFIX = "[PortalCareDebug]";
const SOCIAL_NEWS_NOTIFICATION_TYPES = [
  "gift_received",
  "collection_followed",
  "friendship_accepted",
  "friend_request_received",
  "friend_achievement",
  "scan_liked",
];

const hashSeedToIndex = (seed, length) => {
  if (!length || length <= 0) return 0;
  const source = String(seed || "seed");
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
};

const getCompassDirectionLabel = (bearingDegrees) => {
  if (!Number.isFinite(bearingDegrees)) return "";
  const normalized = ((bearingDegrees % 360) + 360) % 360;
  const directions = [
    { arrow: "↑", label: "N" },
    { arrow: "↗", label: "NO" },
    { arrow: "→", label: "O" },
    { arrow: "↘", label: "SO" },
    { arrow: "↓", label: "S" },
    { arrow: "↙", label: "SW" },
    { arrow: "←", label: "W" },
    { arrow: "↖", label: "NW" },
  ];
  const index = Math.round(normalized / 45) % directions.length;
  const selected = directions[index] || null;
  return selected ? `${selected.arrow} ${selected.label}` : "";
};

const calculateBearingDegrees = (lat1, lon1, lat2, lon2) => {
  const toRadians = (value) => (Number(value) * Math.PI) / 180;
  const toDegrees = (value) => (value * 180) / Math.PI;

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const deltaLonRad = toRadians(Number(lon2) - Number(lon1));

  const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);
  const bearing = toDegrees(Math.atan2(y, x));

  return ((bearing % 360) + 360) % 360;
};

const buildMilestoneScopeKey = (seasonId) => {
  const normalizedSeasonId = String(seasonId || "").trim();
  return normalizedSeasonId ? `season:${normalizedSeasonId}` : "alltime";
};

const buildScopedMilestoneId = (scopeKey, milestoneId) => {
  const normalizedMilestoneId = String(milestoneId || "").trim();
  if (!normalizedMilestoneId) return "";
  return `${scopeKey}:${normalizedMilestoneId}`;
};

const extractScopeMilestoneIds = (seenIds, scopeKey) => {
  const prefix = `${scopeKey}:`;
  const scopedIds = new Set();

  (Array.isArray(seenIds) ? seenIds : []).forEach((entry) => {
    const value = String(entry || "").trim();
    if (!value || !value.startsWith(prefix)) return;
    const rawMilestoneId = value.slice(prefix.length).trim();
    if (rawMilestoneId) scopedIds.add(rawMilestoneId);
  });

  return scopedIds;
};

const DESKTOP_BROWSER_MEDIA_QUERY = "(hover: hover) and (pointer: fine)";

const readDesktopBrowser = () => {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") {
    return window.innerWidth >= 900;
  }
  return window.matchMedia(DESKTOP_BROWSER_MEDIA_QUERY).matches;
};

const useDesktopBrowser = () => {
  const [isDesktopBrowser, setIsDesktopBrowser] = useState(() => readDesktopBrowser());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia(DESKTOP_BROWSER_MEDIA_QUERY);
    const onChange = () => setIsDesktopBrowser(mql.matches);

    onChange();

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return isDesktopBrowser;
};

function HomeDesktopLanding() {
  const { isLightUi } = useUiTheme();

  const featureRows = [
    {
      icon: Camera,
      title: "Kamera-Scan",
      text: "Die Kernstrecke startet am Smartphone mit Kamera und Live-Erkennung.",
    },
    {
      icon: MapPin,
      title: "Standort-Zonen",
      text: "Floralog arbeitet mit Standortdaten und lokalen Discovery-Zonen.",
    },
    {
      icon: Leaf,
      title: "Touch-first Pflege",
      text: "Die Pflege- und Scan-Interaktionen sind auf mobile Bedienung optimiert.",
    },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        className={`absolute inset-0 ${isLightUi
          ? "bg-[radial-gradient(circle_at_top,_rgba(236,252,203,0.96)_0%,_rgba(246,241,224,0.96)_46%,_rgba(255,253,245,1)_100%)]"
          : "bg-[radial-gradient(circle_at_top,_rgba(41,75,54,0.96)_0%,_rgba(13,18,15,0.96)_50%,_rgba(4,7,5,1)_100%)]"
        }`}
      />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        className={`absolute -left-24 top-8 h-72 w-72 rounded-full blur-3xl ${isLightUi ? "bg-emerald-300/30" : "bg-emerald-500/18"}`}
      />
      <div
        className={`absolute right-[-5rem] top-1/3 h-80 w-80 rounded-full blur-3xl ${isLightUi ? "bg-amber-200/35" : "bg-amber-400/14"}`}
      />
      <div
        className={`absolute bottom-[-8rem] left-1/3 h-96 w-96 rounded-full blur-3xl ${isLightUi ? "bg-lime-200/30" : "bg-lime-500/10"}`}
      />

      <div
        className="relative z-10 flex h-full w-full items-center justify-center px-4 py-6"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className={`w-full max-w-5xl overflow-hidden rounded-[2rem] border shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl ${isLightUi ? "border-white/80 bg-white/78 text-stone-800" : "border-[#e8ddb0]/24 bg-[#0f1410]/72 text-stone-100"}`}
        >
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${isLightUi ? "border-emerald-500/20 bg-emerald-50 text-emerald-700" : "border-emerald-300/20 bg-emerald-500/10 text-emerald-200"}`}>
                <Sparkles className="h-3.5 w-3.5" />
                Desktop erkannt
              </div>

              <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Danke für dein Interesse
              </h1>

              <p className={`mt-4 max-w-xl text-base leading-7 sm:text-lg ${isLightUi ? "text-stone-700" : "text-stone-300"}`}>
                Florialog ist aktuell ausschließlich für mobile Geräte ausgelegt. Die App lebt von Kamera, Standort und den schnellen Touch-Interaktionen auf dem Smartphone.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {[
                  "Mobile only",
                  "Kamera",
                  "Standort",
                  "Touch-first",
                ].map((label) => (
                  <span
                    key={label}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${isLightUi ? "border-emerald-500/15 bg-emerald-50 text-emerald-800" : "border-emerald-300/18 bg-emerald-500/10 text-emerald-100"}`}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className={`mt-8 rounded-2xl border px-4 py-4 text-sm leading-6 ${isLightUi ? "border-amber-400/30 bg-amber-50/80 text-amber-900" : "border-amber-300/20 bg-amber-500/10 text-amber-100"}`}>
                Bitte öffne Florialog auf deinem Smartphone, um die vollständige App-Erfahrung zu nutzen.
              </div>
            </div>

            <div className={`relative border-t lg:border-t-0 lg:border-l ${isLightUi ? "border-white/60 bg-gradient-to-b from-emerald-50/90 to-white/70" : "border-white/10 bg-gradient-to-b from-white/5 to-black/20"}`}>
              <div
                className="absolute inset-0 opacity-55"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 18% 18%, rgba(16,185,129,0.24) 0, transparent 28%), radial-gradient(circle at 82% 26%, rgba(245,158,11,0.16) 0, transparent 24%), radial-gradient(circle at 50% 82%, rgba(34,197,94,0.16) 0, transparent 30%)",
                }}
              />

              <div className="relative flex h-full flex-col justify-between gap-6 p-6 sm:p-8">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border shadow-inner">
                  <Smartphone className={`h-11 w-11 ${isLightUi ? "text-emerald-600" : "text-emerald-300"}`} />
                </div>

                <div className="grid gap-3">
                  {featureRows.map((row, index) => {
                    const Icon = row.icon;
                    return (
                      <motion.div
                        key={row.title}
                        initial={{ opacity: 0, x: 14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.45, delay: 0.08 * index, ease: "easeOut" }}
                        className={`rounded-2xl border px-4 py-4 ${isLightUi ? "border-white/70 bg-white/78 shadow-[0_12px_34px_rgba(16,24,16,0.08)]" : "border-white/10 bg-white/5 shadow-[0_12px_34px_rgba(0,0,0,0.16)]"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isLightUi ? "bg-emerald-50 text-emerald-600" : "bg-emerald-500/15 text-emerald-200"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{row.title}</div>
                            <div className={`mt-1 text-sm leading-6 ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
                              {row.text}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className={`rounded-2xl border px-4 py-4 text-sm leading-6 ${isLightUi ? "border-emerald-500/15 bg-emerald-50/80 text-emerald-900" : "border-emerald-300/14 bg-emerald-500/10 text-emerald-100"}`}>
                  Vielen Dank für dein Interesse an Florialog. Wir freuen uns, dich über die mobile Version wiederzusehen.
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

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
  // "Anpassen" content-stack view: opened via HomeHeroSideNav's palette button, renders the
  // flat/draft ShopFeatureRoot in place of badges/reward-cards while staying in the hero section.
  const [showShopStack, setShowShopStack] = useState(false);
  const [shopStackDraftOverrides, setShopStackDraftOverrides] = useState(null);
  const [shopStackHasUnsavedChanges, setShopStackHasUnsavedChanges] = useState(false);
  const [shopStackActiveCategory, setShopStackActiveCategory] = useState("backgrounds");
  const [shopStackSaveNonce, setShopStackSaveNonce] = useState(0);
  const [showWeeklyQuestTooltip, setShowWeeklyQuestTooltip] = useState(false);
  const [showPlantQuizDialog, setShowPlantQuizDialog] = useState(false);
  const [plantQuizResult, setPlantQuizResult] = useState(null);
  const [weeklyQuestSeen, setWeeklyQuestSeen] = useState(() => {
    try { return localStorage.getItem('weeklyQuestSeen') || ''; } catch { return ''; }
  });
  const healthStatsPanelRef = useRef(null);
  const eventStripeContainerRef = useRef(null);
  const [eventStripeHeightPx, setEventStripeHeightPx] = useState(null);
  const [heroStageSizePx, setHeroStageSizePx] = useState(0);
  const [heroMapInstance, setHeroMapInstance] = useState(null);
  const [bugReportDialogOpen, setBugReportDialogOpen] = useState(false);
  const [serverNewsDialogOpen, setServerNewsDialogOpen] = useState(false);
  const [showFlorabotIntro, setShowFlorabotIntro] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState(null);
  const [isMilestoneOverlayToggled, setIsMilestoneOverlayToggled] = useState(false);
  const [careBubble, setCareBubble] = useState(/** @type {{x:number,y:number,key:number}|null} */ (null));
  const [isHomeOverlayShopOpen, setIsHomeOverlayShopOpen] = useState(false);
  const [homeOverlayInitialShopCategory, setHomeOverlayInitialShopCategory] = useState("root");
  const [homeOverlayInitialShopOpen, setHomeOverlayInitialShopOpen] = useState(false);
  const [homeOverlayAmbientMessage, setHomeOverlayAmbientMessage] = useState("");
  const homeOverlayAmbientCooldownUntilRef = useRef(0);
  const [florabotContextBubble, setFlorabotContextBubble] = useState(null);
  const [userStory, setUserStory] = useState(/** @type {any} */ (null));
  const [storyCreatedThisSession, setStoryCreatedThisSession] = useState(false);
  const introDismissedThisSessionRef = useRef(false);
  const dismissedMilestoneIdsRef = useRef(new Set());

  const [scanFeedback, setScanFeedback] = useState(null);
  const [showScanFeedback, setShowScanFeedback] = useState(false);
  const [scanZoneUnlockQueue, setScanZoneUnlockQueue] = useState([]);
  const [showScanZoneUnlock, setShowScanZoneUnlock] = useState(false);
  const [randomRewardQueue, setRandomRewardQueue] = useState([]);
  const [showRandomReward, setShowRandomReward] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [showQuizFeedback, setShowQuizFeedback] = useState(false);
  const scanFeedbackCooldownRef = useRef(false);
  const blockNavigationFeedbackRef = useRef(false);

  // Cooldown-Schutz: scanFeedback kann nach Schließen für 1 Sekunde nicht erneut gesetzt werden
  const safeSetScanFeedback = (value) => {
    if ((scanFeedbackCooldownRef.current || blockNavigationFeedbackRef.current) && value) {
      // Während Cooldown oder Block kein neues Feedback zulassen
      return;
    }
    setScanFeedback(value);
  };
  const [activePanel, setActivePanel] = useState(null);
  const [shopOpenCategory, setShopOpenCategory] = useState("root");
  const [careActionMessage, setCareActionMessage] = useState(null);
  const [careGainFeedback, setCareGainFeedback] = useState(null);
  const [dailySparkClaimFeedback, setDailySparkClaimFeedback] = useState(null);
  const [showAmberPurchaseModal, setShowAmberPurchaseModal] = useState(false);
  const [embeddedHeaderMeta, setEmbeddedHeaderMeta] = useState(null);
  const [embeddedFriendsAddDialogNonce, setEmbeddedFriendsAddDialogNonce] = useState(0);
  const [embeddedCollectionPublicPanelOpen, setEmbeddedCollectionPublicPanelOpen] = useState(false);
  const [embeddedSelectedCollectionId, setEmbeddedSelectedCollectionId] = useState("global");
  const [embeddedCollectionEntryCategory, setEmbeddedCollectionEntryCategory] = useState(null);
  const [isMapDiscoveryDataLoading, setIsMapDiscoveryDataLoading] = useState(false);
  const [discoveryMarkerScale, setDiscoveryMarkerScale] = useState(() => {
    try {
      const stored = localStorage.getItem(DISCOVERY_MARKER_SCALE_STORAGE_KEY);
      return clampDiscoveryMarkerScale(stored ?? DISCOVERY_MARKER_SCALE_DEFAULT);
    } catch {
      return DISCOVERY_MARKER_SCALE_DEFAULT;
    }
  });
  const activeSeason = getActiveSeason();
  const seasonStartDate = activeSeason?.startDate || null;
  const milestoneScopeKey = buildMilestoneScopeKey(activeSeason?.id);
  const persistedStorySeenMilestoneIds = Array.isArray(userStory?.seen_milestone_ids)
    ? userStory.seen_milestone_ids
    : [];
  const localSeenMilestoneIds = useMemo(
    () => (user?.id ? Array.from(getSeenMilestoneIds(user.id, milestoneScopeKey)) : []),
    [user?.id, milestoneScopeKey, persistedStorySeenMilestoneIds]
  );
  const mergedSeenMilestoneIds = useMemo(
    () => mergeSeenMilestoneIds(persistedStorySeenMilestoneIds, localSeenMilestoneIds),
    [persistedStorySeenMilestoneIds, localSeenMilestoneIds]
  );
  const seenMilestonesInScope = useMemo(
    () => extractScopeMilestoneIds(mergedSeenMilestoneIds, milestoneScopeKey),
    [mergedSeenMilestoneIds, milestoneScopeKey]
  );

  useEffect(() => {
    introDismissedThisSessionRef.current = false;
    dismissedMilestoneIdsRef.current = new Set();
  }, [user?.id]);

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
      setEmbeddedCollectionEntryCategory(null);
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
          setShowFlorabotIntro(
            introDismissedThisSessionRef.current ? false : nextStory.intro_seen !== true
          );
          return;
        }
      } catch (error) {
        const errorMessage = String(error?.message || error || "unknown_error");
        console.warn("[Home] UserStory bootstrap failed, fallback to local intro state:", errorMessage);
      }

      if (cancelled) return;

      const key = `florabot_intro_seen_v1:${user.id}`;
      try {
        const shouldShowIntro = !localStorage.getItem(key);
        setShowFlorabotIntro(introDismissedThisSessionRef.current ? false : shouldShowIntro);
      } catch {
        setShowFlorabotIntro(introDismissedThisSessionRef.current ? false : true);
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
      if (!seenMilestonesInScope.has(milestone.id)) return;

      const seenContextKeys = new Set(
        Array.isArray(userStory?.seen_context_bubble_keys)
          ? userStory.seen_context_bubble_keys
          : []
      );

      if (seenContextKeys.has(activePanel)) return;
      if (localStorage.getItem(bubbleKey(activePanel))) return;
      setFlorabotContextBubble({ panel: activePanel, message: milestone.contextBubble.message });
    } catch { /* ignore */ }
  }, [activePanel, user?.id, userStory, seenMilestonesInScope]);

  // Florabot Context-Bubble: Health-Panel (separater State, nicht über activePanel)
  useEffect(() => {
    if (!user?.id || !showHealthStatsPanel) return;
    const panelKey = "health";
    const bubbleKey = `florabot_ctx_bubble_v1:${user.id}:${panelKey}`;
    const milestone = FLORABOT_MILESTONES.find(
      (m) => m.contextBubble?.panel === panelKey
    );
    if (!milestone?.contextBubble) return;
    try {
      if (!seenMilestonesInScope.has(milestone.id)) return;

      const seenContextKeys = new Set(
        Array.isArray(userStory?.seen_context_bubble_keys)
          ? userStory.seen_context_bubble_keys
          : []
      );

      if (seenContextKeys.has(panelKey)) return;
      if (localStorage.getItem(bubbleKey)) return;
      setFlorabotContextBubble({ panel: panelKey, message: milestone.contextBubble.message });
    } catch { /* ignore */ }
  }, [showHealthStatsPanel, user?.id, userStory, seenMilestonesInScope]);

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

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => Query.Achievement.list('achievement_number'),
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
    queryFn: () => Query.UserPlantDiscovery.list('-discovered_date'),
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

  const { data: allRobotPlants = [] } = useQuery({
    queryKey: ['homeAllRobotPlants'],
    queryFn: () => Query.RobotPlant.list(),
    enabled: !!user?.id,
    initialData: [],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['homeRewardsCatalog'],
    queryFn: () => Query.Reward.list(),
    initialData: [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: userRewards = [] } = useQuery({
    queryKey: ['homeUserRewards', user?.id],
    queryFn: () => Query.UserReward.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    initialData: [],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: ownedUniqueBadgeIds = [] } = useQuery({
    queryKey: ['homeUniqueBadges', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unique_badges')
        .select('badge_id')
        .eq('auth_id', user?.id);
      if (error) {
        console.warn('[Home] unique_badges query failed:', error?.message || error);
        return [];
      }
      return (data || []).map((row) => row.badge_id);
    },
    enabled: !!user?.id,
    initialData: [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: highestScanResultsLeaderboard = [] } = useQuery({
    queryKey: ['homeHighestScanResultsLeaderboard', seasonStartDate || 'alltime'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_highest_scan_results_leaderboard', {
        p_limit: 100,
        p_from_date: seasonStartDate,
      });
      if (error) {
        console.warn('[Home] get_highest_scan_results_leaderboard unavailable:', error?.message || error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.email,
    initialData: [],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: seasonSeedLeaderboard = [] } = useQuery({
    queryKey: ['homeSeasonSeedLeaderboard', seasonStartDate || 'alltime'],
    queryFn: async () => {
      if (!seasonStartDate) return [];
      const { data, error } = await supabase.rpc('get_weekly_seed_leaderboard', {
        p_limit: 500,
        p_from_date: seasonStartDate,
      });
      if (error) {
        console.warn('[Home] get_weekly_seed_leaderboard unavailable:', error?.message || error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.id && !!seasonStartDate,
    initialData: [],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
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
    isPending: isRobotPlantDailyCareStatusPending,
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
    mutationFn: async () => {
      console.log(`${PORTAL_CARE_DEBUG_PREFIX} water mutation start`);
      const mutationResult = await waterRobotPlant();
      console.log(`${PORTAL_CARE_DEBUG_PREFIX} water mutation response`, mutationResult);
      return mutationResult;
    },
    onSuccess: async (result) => {
      console.log(`${PORTAL_CARE_DEBUG_PREFIX} water mutation success`, result);
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
    onError: (error) => {
      console.log(`${PORTAL_CARE_DEBUG_PREFIX} water mutation error`, {
        message: String(error?.message || "unknown_error"),
        error,
      });
      setCareActionMessage('Giessen fehlgeschlagen.');
    },
    onSettled: () => {
      console.log(`${PORTAL_CARE_DEBUG_PREFIX} water mutation settled`);
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
    const referrerEmailFromCode = referralCode ? resolveReferralEmail(referralCode) : null;

    // Robuste Quelle: beim Signup wurde der Werber dauerhaft in user_metadata.referred_by
    // gebunden. Dieser Wert überlebt E-Mail-Bestätigung, Geräte-/Browser-Wechsel und App-Installation.
    const referrerEmailFromMetadata = String(user?.user_metadata?.referred_by || '').trim() || null;

    // localStorage sofort löschen, um doppelte Verarbeitung zu verhindern
    if (referralCode) localStorage.removeItem('referral_code');

    const hasLocalReferrer = Boolean(
      referrerEmailFromCode && referrerEmailFromCode.toLowerCase() !== user.email.toLowerCase()
    );
    const hasMetadataReferrer = Boolean(
      referrerEmailFromMetadata && referrerEmailFromMetadata.toLowerCase() !== user.email.toLowerCase()
    );

    if (!hasLocalReferrer && !hasMetadataReferrer) return;

    // Einmal pro User die serverseitige Verknüpfung anstoßen. Der Edge-Endpunkt ist
    // idempotent; das Flag verhindert nur unnötige Aufrufe bei jedem Login.
    const connectedFlagKey = `referral_connected:${user.email.toLowerCase()}`;
    if (!hasLocalReferrer && localStorage.getItem(connectedFlagKey) === '1') return;

    (async () => {
      try {
        // Bei vorhandenem localStorage-Code diesen mitgeben, sonst löst das Backend
        // den Werber aus user_metadata.referred_by auf.
        await connectViaReferral(hasLocalReferrer ? referrerEmailFromCode : null);
        try { localStorage.setItem(connectedFlagKey, '1'); } catch (_storageError) { /* ignore */ }
        const invalidateEmail = hasLocalReferrer ? referrerEmailFromCode : referrerEmailFromMetadata;
        if (invalidateEmail) {
          queryClient.invalidateQueries({ queryKey: ['referralsForStoryUnlock', invalidateEmail] });
        }
        queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests'] });
        queryClient.invalidateQueries({ queryKey: ['myReferrals'] });
      } catch (_e) {
        // Duplikat oder bereits bestehende Verknüpfung ignorieren
      }
    })();
  }, [user?.email, user?.user_metadata?.referred_by, queryClient]);

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
    const navigationRandomRewards = Array.isArray(location.state.randomRewards)
      ? location.state.randomRewards.filter(Boolean)
      : [];
    const hasScanZoneUnlocks = navigationUnlocks.length > 0;
    const hasRandomRewards = navigationRandomRewards.length > 0;
    const shouldOpenSettings = Boolean(location.state.openSettings);
    const shouldOpenCollection = Boolean(location.state.openCollection);
    const openCollectionId = location.state.collectionId || "global";

    if (!hasScanFeedback && !hasScanZoneUnlocks && !hasRandomRewards && !shouldOpenSettings && !shouldOpenCollection) return;

    if (hasScanFeedback && !blockNavigationFeedbackRef.current) {
      safeSetScanFeedback(location.state.scanFeedback);
      setShowScanFeedback(true);
      if (hasScanZoneUnlocks) {
        setScanZoneUnlockQueue(navigationUnlocks);
        queryClient.invalidateQueries({ queryKey: ["userRewards"] });
      }
      if (hasRandomRewards) {
        setRandomRewardQueue(navigationRandomRewards);
      }
    } else if (hasScanZoneUnlocks) {
      setScanZoneUnlockQueue(navigationUnlocks);
      queryClient.invalidateQueries({ queryKey: ["userRewards"] });
      setShowScanZoneUnlock(true);
      if (hasRandomRewards) {
        setRandomRewardQueue(navigationRandomRewards);
      }
    } else if (hasRandomRewards) {
      setRandomRewardQueue(navigationRandomRewards);
      setShowRandomReward(true);
    }

    if (shouldOpenSettings) {
      setActivePanel("settings");
      setShowHealthStatsPanel(false);
    }

    if (shouldOpenCollection) {
      setEmbeddedSelectedCollectionId(openCollectionId);
      setActivePanel("collection");
      setShowHealthStatsPanel(false);
    }

    const {
      scanFeedback: _ignoredFeedback,
      scanZoneUnlocks: _ignoredScanZoneUnlocks,
      randomRewards: _ignoredRandomRewards,
      openSettings: _ignoredOpenSettings,
      openCollection: _ignoredOpenCollection,
      collectionId: _ignoredCollectionId,
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
        selected_profile_effect: userData.selected_profile_effect,
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
    if (activePanel !== null || showHealthStatsPanel) {
      setShowShopStack(false);
      setShopStackHasUnsavedChanges(false);
    }
  }, [activePanel, showHealthStatsPanel]);

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
  }, []);

  // Reward card gets capped to the Event-Stripe's rendered height; any height this frees up
  // in the hero column is credited to the Florabot logo (HomeCollectionStripes grows via flex-1).
  useEffect(() => {
    const node = eventStripeContainerRef.current;
    if (!node) {
      setEventStripeHeightPx(null);
      return undefined;
    }

    const updateEventStripeHeight = () => {
      const nextHeight = node.getBoundingClientRect().height;
      setEventStripeHeightPx((prev) => (Number.isFinite(nextHeight) && nextHeight > 0 && prev !== nextHeight ? nextHeight : prev));
    };

    updateEventStripeHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateEventStripeHeight);
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateEventStripeHeight);
    return () => window.removeEventListener("resize", updateEventStripeHeight);
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
  // playerSeeds: Uses seasonal seeds when available, falls back to all-time
  const allTimeSeeds = Math.max(
    0,
    Number(robotPlantState?.wallet_balance ?? robotPlantState?.walletBalance ?? 0)
  );
  const ownSeasonSeedProgress = useMemo(() => {
    if (!seasonStartDate || !user?.id) return null;
    const ownEntry = (seasonSeedLeaderboard || []).find(
      (entry) => String(entry?.auth_id || "") === String(user.id)
    );
    return Math.max(0, Number(ownEntry?.weekly_seed_total ?? 0));
  }, [seasonStartDate, seasonSeedLeaderboard, user?.id]);
  const playerSeeds = seasonStartDate
    ? Math.max(0, Number(ownSeasonSeedProgress ?? 0))
    : allTimeSeeds;

  const referralPhase6UnlockCount = useMemo(() => {
    if (!user?.email || !Array.isArray(allReferrals)) return 0;
    const userEmailLower = String(user.email || "").trim().toLowerCase();

    return allReferrals.filter((referral) => {
      const referrerAuthId = String(referral?.referrer_auth_id || "").trim();
      const referrerEmail = String(referral?.referrer_email || "").trim().toLowerCase();
      const status = String(referral?.status || "").trim().toLowerCase();
      const referredAuthId = String(referral?.auth_id || "").trim();
      const isReferrer = (referrerAuthId && referrerAuthId === String(user.id)) ||
        referrerEmail === userEmailLower;
      return isReferrer && status === "completed" && Boolean(referredAuthId);
    }).length;
  }, [allReferrals, user?.email]);

  const shouldForcePhase6ByReferral = playerSeeds >= 40000 && referralPhase6UnlockCount > 0;
  const storySeedProgress = shouldForcePhase6ByReferral ? Math.max(playerSeeds, 50000) : playerSeeds;
  const questUnlockThreshold = FLORABOT_MILESTONES.find((milestone) => milestone.navHighlight === "quests")?.threshold ?? 1000;
  const isQuestButtonUnlocked = playerSeeds >= questUnlockThreshold;
  const isShopUnlocked = playerSeeds >= 5000;
  const resolvePublicProfileLabel = (email) => {
    if (!email) return null;
    const profile = allUsers.find((entry) => entry?.user_email?.toLowerCase() === String(email).toLowerCase());
    return profile?.display_name || profile?.full_name || null;
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

    let seenIds = new Set(seenMilestonesInScope);

    // New UserStory rows for existing users should not replay historic milestones.
    if (storyCreatedThisSession) {
      const reachedMilestoneIds = FLORABOT_MILESTONES
        .filter((milestone) => playerSeeds >= milestone.threshold)
        .map((milestone) => buildScopedMilestoneId(milestoneScopeKey, milestone.id))
        .filter(Boolean);

      if (reachedMilestoneIds.length > 0) {
        const mergedScopedSeenIds = mergeSeenMilestoneIds(mergedSeenMilestoneIds, reachedMilestoneIds);
        seenIds = extractScopeMilestoneIds(mergedScopedSeenIds, milestoneScopeKey);

        updateUserStory(user.id, {
          seen_milestone_ids: mergedScopedSeenIds,
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
    if (next && dismissedMilestoneIdsRef.current.has(next.id)) return;
    if (next) setActiveMilestone(next);
  }, [
    playerSeeds,
    user?.id,
    isRobotPlantStateFetched,
    activeMilestone,
    userStory,
    storyCreatedThisSession,
    seenMilestonesInScope,
    mergedSeenMilestoneIds,
    milestoneScopeKey,
  ]);

  const toggleMilestonePreview = useMemo(() => {
    if (activeMilestone) return activeMilestone;
    const reachedMilestones = FLORABOT_MILESTONES.filter(
      (milestone) => playerSeeds >= milestone.threshold
    );
    if (reachedMilestones.length > 0) return reachedMilestones[reachedMilestones.length - 1];
    return FLORABOT_MILESTONES[0] || null;
  }, [activeMilestone, playerSeeds]);

  useEffect(() => {
    if (showFlorabotIntro || activeMilestone) {
      setIsMilestoneOverlayToggled(false);
      setIsHomeOverlayShopOpen(false);
      setHomeOverlayAmbientMessage("");
    }
  }, [showFlorabotIntro, activeMilestone]);

  useEffect(() => {
    if (!isMilestoneOverlayToggled) {
      setIsHomeOverlayShopOpen(false);
    }
  }, [isMilestoneOverlayToggled]);

  const dismissFlorabotContextBubble = () => {
    if (!florabotContextBubble) return;

    try {
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
    } finally {
      setFlorabotContextBubble(null);
    }
  };

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

  const ownEmailLower = String(user?.email || "").trim().toLowerCase();

  const rewardsList = Array.isArray(rewards) ? rewards : [];
  const userRewardsList = Array.isArray(userRewards) ? userRewards : [];
  const highestScanResultsRows = Array.isArray(highestScanResultsLeaderboard)
    ? highestScanResultsLeaderboard
    : [];
  const allUsersList = Array.isArray(allUsers) ? allUsers : [];
  const userDiscoveriesList = Array.isArray(userDiscoveries) ? userDiscoveries : [];
  const allDiscoveriesList = Array.isArray(allDiscoveries) ? allDiscoveries : [];

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
  // Only treat the first fetch as loading; background refetches should not disable care taps.
  const isDailyCareStatusLoading = Boolean(user?.id) && isRobotPlantDailyCareStatusPending;

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

  const redeemableWeeklyUserQuest = userWeeklyQuests.find(
    (uwq) => (uwq.status === 'completed' || uwq.completed) && uwq.status !== 'redeemed' && !uwq.redeemed
  ) ?? null;
  const currentWeeklyUserQuest = redeemableWeeklyUserQuest
    ? redeemableWeeklyUserQuest
    : currentWeeklyQuest
      ? userWeeklyQuests.find(uwq => uwq.weekly_quest_id === currentWeeklyQuest.id)
      : null;
  const displayedWeeklyQuest = redeemableWeeklyUserQuest
    ? (weeklyQuests.find(wq => wq.id === redeemableWeeklyUserQuest.weekly_quest_id) ?? currentWeeklyQuest)
    : currentWeeklyQuest;
  const activeWeeklyQuest = displayedWeeklyQuest && currentWeeklyUserQuest && isActiveOrCompleted(currentWeeklyUserQuest) && !(currentWeeklyUserQuest.status === 'redeemed' || currentWeeklyUserQuest.redeemed) ?
    { ...displayedWeeklyQuest, isCompleted: currentWeeklyUserQuest.completed || isCompletedStatus(currentWeeklyUserQuest) } : null;
  const availableWeeklyQuest = currentWeeklyQuest && !currentWeeklyUserQuest;

  const currentMonthlyUserQuest = currentMonthlyQuest ?
    userMonthlyQuests.find(umq => umq.monthly_quest_id === currentMonthlyQuest.id) : null;
  const activeMonthlyQuest = currentMonthlyQuest && currentMonthlyUserQuest && isActiveOrCompleted(currentMonthlyUserQuest) && !(currentMonthlyUserQuest.status === 'redeemed' || currentMonthlyUserQuest.redeemed) ?
    { ...currentMonthlyQuest, isCompleted: currentMonthlyUserQuest.completed || false } : null;
  const availableMonthlyQuest = currentMonthlyQuest && !currentMonthlyUserQuest;

  // Zeitlich begrenzte Events/Aufgaben (Wochen-/Monatsquest, später Community Events),
  // gerendert im rotierenden HomeEventStripe.
  const homeEventStripeItems = [];
  if (displayedWeeklyQuest) {
    const weeklyQuestTargetLabel = displayedWeeklyQuest.target_species_name
      || displayedWeeklyQuest.target_genus_name
      || displayedWeeklyQuest.title;
    homeEventStripeItems.push({
      id: `weekly-quest-${displayedWeeklyQuest.id}`,
      kind: "weekly",
      title: weeklyQuestTargetLabel,
      description: displayedWeeklyQuest.description,
      progressCurrent: Number(currentWeeklyUserQuest?.progress || 0),
      progressTarget: Number(displayedWeeklyQuest.required_discoveries || 0),
      isCompleted: activeWeeklyQuest?.isCompleted || false,
      isAvailable: Boolean(availableWeeklyQuest),
      onClick: () => {
        trackAction("home_event_stripe_weekly", { sourcePage: "Home" });
        setActivePanel("achievements");
      },
    });
  }
  if (currentMonthlyQuest) {
    homeEventStripeItems.push({
      id: `monthly-quest-${currentMonthlyQuest.id}`,
      kind: "monthly",
      title: currentMonthlyQuest.title,
      description: currentMonthlyQuest.description,
      progressCurrent: Number(currentMonthlyUserQuest?.progress || 0),
      progressTarget: Number(currentMonthlyQuest.required_discoveries || 0),
      isCompleted: activeMonthlyQuest?.isCompleted || false,
      isAvailable: Boolean(availableMonthlyQuest),
      onClick: () => {
        trackAction("home_event_stripe_monthly", { sourcePage: "Home" });
        setActivePanel("achievements");
      },
    });
  }

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
  const displayName = getDisplayName() || "Spieler";
  const resolvedUserTitle = resolveTitleValue(user?.selected_title, user?.title) || "Pflanzen-Entdecker";
  // Live-preview profile: while the "Anpassen" content-stack is open, staged (not-yet-saved) shop
  // selections are merged over the real user so the Custom Logo/background reflect them immediately.
  const effectiveUser = showShopStack && shopStackDraftOverrides
    ? { ...user, ...shopStackDraftOverrides }
    : user;

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
  const currentUserEmailLower = ownEmailLower;

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
      const plantRarity = plant?.rarity || plant?.aiData?.rarity || "";
      const rarityScore = getRarityLevelFromLabel(plantRarity);

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
        plantRarity,
        rarityScore,
        plantId: plant?.id || entry?.plant_id || "",
        genusId: plant?.genus_id || "",
        likedByCurrentUser: likedDiscoveryIdSet.has(entry?.id),
        discoveredAt: entry?.discovered_date || null,
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

  const discoveredPlantIdSet = new Set(
    (userDiscoveries || []).map((entry) => entry?.plant_id).filter(Boolean)
  );

  const ownDiscoveryIdSet = new Set(
    (userDiscoveries || []).map((entry) => entry?.id).filter(Boolean)
  );

  const userDiscoveriesSortedByTime = [...(userDiscoveries || [])].sort((a, b) => {
    const dateA = new Date(a?.discovered_date || 0).getTime();
    const dateB = new Date(b?.discovered_date || 0).getTime();
    return dateA - dateB;
  });

  const totalWalkedMetersBetweenScans = userDiscoveriesSortedByTime.reduce(
    (sum, discovery, index, arr) => {
      if (index === 0) return sum;
      const prevCoords = parseDiscoveryCoordinates(arr[index - 1]?.discovery_location);
      const currCoords = parseDiscoveryCoordinates(discovery?.discovery_location);
      if (!prevCoords || !currCoords) return sum;

      const distanceMeters = calculateDistanceMetersRaw(
        prevCoords.lat,
        prevCoords.lng,
        currCoords.lat,
        currCoords.lng
      );

      if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return sum;
      return sum + distanceMeters;
    },
    0
  );

  const totalWalkedKilometers = totalWalkedMetersBetweenScans / 1000;

  const receivedLikesCount = (scanLikes || []).reduce((count, likeEntry) => {
    if (!ownDiscoveryIdSet.has(likeEntry?.discovery_id)) return count;
    return count + 1;
  }, 0);

  const unlockedRewardIds = new Set(
    userRewardsList
      .map((entry) => String(entry?.reward_id || "").trim())
      .filter(Boolean)
  );
  const unlockedZoneAccessoryCount = rewardsList.reduce((count, reward) => {
    const rewardType = String(reward?.type || reward?.reward_type || reward?.kind || "").trim().toLowerCase();
    const rewardId = String(reward?.id || "").trim();
    if (!rewardId || !unlockedRewardIds.has(rewardId)) return count;
    if (rewardType !== 'logo_accessory' && rewardType !== 'accessory') return count;
    if (!String(reward?.requires_zone_theme || "").trim()) return count;
    return count + 1;
  }, 0);

  const completedWeeklyQuestCount = (userWeeklyQuests || []).reduce(
    (count, entry) => count + (isCompletedStatus(entry) ? 1 : 0),
    0,
  );

  const completedMonthlyQuestCount = (userMonthlyQuests || []).reduce(
    (count, entry) => count + (isCompletedStatus(entry) ? 1 : 0),
    0,
  );

  const plantsByGenusKey = (plants || []).reduce((acc, plant) => {
    const key = `${plant?.genus_category || ""}::${plant?.genus_number || ""}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(plant);
    return acc;
  }, {});

  const getDiscoveryTimestamp = (discovery) => {
    const raw = discovery?.discovered_date;
    const parsed = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const currentIsoWeek = getWeekNumber();
  const isDiscoveryInCurrentWeek = (discoveredAtValue) => {
    if (!discoveredAtValue) return false;
    const discoveredAtDate = new Date(discoveredAtValue);
    if (!Number.isFinite(discoveredAtDate.getTime())) return false;
    return getWeekNumber(discoveredAtDate) === currentIsoWeek;
  };
  const milestonePreviewDayKey = new Date().toISOString().slice(0, 10);

  const publicProfilesByAuthId = new Map(
    allUsersList
      .filter((profile) => profile?.public_profile !== false && !!profile?.auth_id)
      .map((profile) => [profile.auth_id, profile])
  );

  const publicProfileEmailSet = new Set(
    allUsersList
      .filter((profile) => profile?.public_profile !== false && typeof profile?.user_email === "string")
      .map((profile) => profile.user_email.toLowerCase())
  );

  const nearCompleteGenera = (genera || [])
    .map((genus) => {
      const key = `${genus?.category || ""}::${genus?.category_dex_number || ""}`;
      const genusPlants = plantsByGenusKey[key] || [];
      const total = genusPlants.length;
      if (total <= 0) return null;

      const discovered = genusPlants.reduce(
        (count, plant) => count + (discoveredPlantIdSet.has(plant?.id) ? 1 : 0),
        0
      );
      const remaining = Math.max(0, total - discovered);
      const genusPlantIds = new Set(genusPlants.map((plant) => plant?.id).filter(Boolean));
      const genusDiscoveries = userDiscoveriesList.filter(
        (discovery) => genusPlantIds.has(discovery?.plant_id) && discovery?.image_url
      );

      const publicOtherUserGenusDiscoveries = allDiscoveriesList.filter((discovery) => {
        if (!genusPlantIds.has(discovery?.plant_id) || !discovery?.image_url) return false;

        const ownerAuthId = String(discovery?.auth_id || discovery?.created_by_id || "");
        const ownerEmail = String(discovery?.user || discovery?.created_by || "").toLowerCase();
        const isOwnByAuth = Boolean(ownerAuthId && user?.id && ownerAuthId === user.id);
        const isOwnByEmail = Boolean(ownerEmail && user?.email && ownerEmail === user.email.toLowerCase());
        if (isOwnByAuth || isOwnByEmail) return false;

        if (ownerAuthId && publicProfilesByAuthId.has(ownerAuthId)) return true;
        if (ownerEmail && publicProfileEmailSet.has(ownerEmail)) return true;
        return false;
      });

      const randomPublicDiscovery =
        publicOtherUserGenusDiscoveries.length > 0
          ? publicOtherUserGenusDiscoveries[
              hashSeedToIndex(
                `${genus?.id || genus?.genus_name || "genus"}:${user?.id || "anon"}:${milestonePreviewDayKey}`,
                publicOtherUserGenusDiscoveries.length
              )
            ]
          : null;

      const ownFallbackDiscovery =
        genusDiscoveries.find((discovery) => discovery?.is_front_image) ||
        genusDiscoveries.find((discovery) => discovery?.is_species_front_image) ||
        [...genusDiscoveries].sort((a, b) => getDiscoveryTimestamp(b) - getDiscoveryTimestamp(a))[0] ||
        null;

      const ownFallbackPreviewImageUrl = ownFallbackDiscovery?.image_url || "";

      const previewImageUrl =
        randomPublicDiscovery?.image_url ||
        ownFallbackPreviewImageUrl;

      const previewDiscovery = randomPublicDiscovery || ownFallbackDiscovery;

      return {
        id: genus?.id,
        genusName: genus?.genus_name || "Genus",
        discovered,
        total,
        remaining,
        previewImageUrl,
        previewDiscoveryId: previewDiscovery?.id || "",
        previewPlantId: previewDiscovery?.plant_id || "",
        previewScannerEmail: previewDiscovery?.user || previewDiscovery?.created_by || "",
      };
    })
    .filter((entry) => entry && entry.discovered >= 3 && entry.remaining > 0)
    .sort((a, b) => {
      if (a.remaining !== b.remaining) return a.remaining - b.remaining;
      return b.discovered - a.discovered;
    })
    .slice(0, 2);

  const nearbyRareDiscovery = hasLiveCachedLocation
    ? nearbyDiscoveryPoints
        .map((point) => ({
          ...point,
          distanceMeters: calculateDistanceMetersRaw(cachedLocation.lat, cachedLocation.lng, point.lat, point.lng),
        }))
        .filter(
          (point) =>
            Number(point?.rarityScore || 0) >= 4 &&
            isDiscoveryInCurrentWeek(point?.discoveredAt)
        )
        .sort((a, b) => {
          if ((b.rarityScore || 0) !== (a.rarityScore || 0)) {
            return (b.rarityScore || 0) - (a.rarityScore || 0);
          }
          return (a.distanceMeters || Number.POSITIVE_INFINITY) - (b.distanceMeters || Number.POSITIVE_INFINITY);
        })[0] || null
    : null;

  const profileByAuthId = new Map(
    (allUsers || [])
      .filter((profile) => !!profile?.auth_id)
      .map((profile) => [profile.auth_id, profile])
  );

  const alltimeGlobalSeedRanking = (allRobotPlants || [])
    .filter((entry) => !!entry?.auth_id)
    .map((entry) => {
      const seeds = Math.max(0, Number(entry?.wallet_balance ?? entry?.walletBalance ?? 0));
      const profile = profileByAuthId.get(entry.auth_id);
      return {
        authId: entry.auth_id,
        seeds,
        isOwn: Boolean(user?.id && entry.auth_id === user.id),
        name: profile?.display_name || profile?.full_name || profile?.user_email || "Spieler",
      };
    })
    .sort((a, b) => b.seeds - a.seeds);

  const seasonGlobalSeedRanking = (seasonSeedLeaderboard || [])
    .map((entry) => {
      const authId = entry?.auth_id || null;
      const profile = authId ? profileByAuthId.get(authId) : null;
      return {
        authId,
        seeds: Math.max(0, Number(entry?.weekly_seed_total ?? 0)),
        isOwn: Boolean(user?.id && authId && authId === user.id),
        name:
          profile?.display_name ||
          profile?.full_name ||
          entry?.display_name ||
          entry?.full_name ||
          profile?.user_email ||
          "Spieler",
      };
    })
    .filter((entry) => Number(entry.seeds) > 0)
    .sort((a, b) => b.seeds - a.seeds);

  const globalSeedRanking = seasonStartDate ? seasonGlobalSeedRanking : alltimeGlobalSeedRanking;

  const ownSeedRankIndex = globalSeedRanking.findIndex((entry) => entry.isOwn);
  const ownSeedRank = ownSeedRankIndex >= 0 ? ownSeedRankIndex + 1 : 0;
  const nextSeedRankTarget = ownSeedRank > 1 ? globalSeedRanking[ownSeedRank - 2] : null;
  const ownSeasonSeedTotal = ownSeedRank > 0 ? Math.max(0, Number(globalSeedRanking[ownSeedRankIndex]?.seeds ?? 0)) : 0;
  const seedMetricValue = seasonStartDate ? ownSeasonSeedTotal : playerSeeds;
  const seedsToNextRank = nextSeedRankTarget
    ? Math.max(0, Math.floor(nextSeedRankTarget.seeds - seedMetricValue + 1))
    : 0;

  const highestScanResultsRanking = highestScanResultsRows
    .map((entry) => ({
      email: String(entry?.public_profile_email || entry?.user_email || entry?.profile_email || entry?.email || "").toLowerCase(),
      rewardAmount: Math.max(0, Number(entry?.reward_amount ?? 0)),
      awardedAtMs: new Date(entry?.awarded_at || entry?.created_at || 0).getTime(),
    }))
    .filter((entry) => Boolean(entry.email) && Number(entry.rewardAmount) > 0)
    .sort((a, b) => {
      if (b.rewardAmount !== a.rewardAmount) return b.rewardAmount - a.rewardAmount;
      return (b.awardedAtMs || 0) - (a.awardedAtMs || 0);
    });

  const ownHighestScanRankIndex = highestScanResultsRanking.findIndex((entry) => entry.email === ownEmailLower);
  const ownHighestScanRank = ownHighestScanRankIndex >= 0 ? ownHighestScanRankIndex + 1 : 0;
  const ownHighestScanRewardSeeds = ownHighestScanRank > 0
    ? Math.round(highestScanResultsRanking[ownHighestScanRankIndex]?.rewardAmount || 0)
    : 0;

  const rarestDiscoveredPlantScore = userDiscoveriesList.reduce((maxScore, discovery) => {
    const plant = plants.find((candidate) => candidate?.id === discovery?.plant_id);
    const rarityLabel = plant?.rarity || plant?.aiData?.rarity || "";
    return Math.max(maxScore, getRarityLevelFromLabel(rarityLabel));
  }, 0);

  const profileCreatedAtRaw = user?.created_date || user?.created_at || user?.updated_date || null;
  const profileCreatedAtMs = profileCreatedAtRaw ? new Date(profileCreatedAtRaw).getTime() : 0;
  const memberSinceDays = Number.isFinite(profileCreatedAtMs) && profileCreatedAtMs > 0
    ? Math.max(0, Math.floor((Date.now() - profileCreatedAtMs) / (24 * 60 * 60 * 1000)))
    : 0;

  const homeMilestoneFeed = [];

  if (nearCompleteGenera.length > 0) {
    nearCompleteGenera.forEach((entry) => {
      homeMilestoneFeed.push({
        id: `genus-${entry.id}`,
        title: `${entry.genusName}: ${entry.discovered}/${entry.total}`,
        detail: entry.remaining === 1 ? "Dir fehlt nur noch 1 Art." : `Dir fehlen nur noch ${entry.remaining} Arten.`,
        actionType: "open_genus",
        genusId: entry.id,
        genusName: entry.genusName,
        previewImageUrl: entry.previewImageUrl || "",
        previewDiscoveryId: entry.previewDiscoveryId || "",
        previewPlantId: entry.previewPlantId || "",
        previewScannerEmail: entry.previewScannerEmail || "",
      });
    });
  }

  if (nearbyRareDiscovery) {
    const distanceKm = (Number(nearbyRareDiscovery.distanceMeters || 0) / 1000).toFixed(1);
    homeMilestoneFeed.push({
      id: `rare-${nearbyRareDiscovery.discoveryId || `${nearbyRareDiscovery.lat}-${nearbyRareDiscovery.lng}`}`,
      title: `Raritaet in ${distanceKm} km: ${nearbyRareDiscovery.plantName}`,
      detail: ` ${nearbyRareDiscovery.plantRarity || "eine seltene Art"} gefunden. Entdeckt von ${nearbyRareDiscovery.scannerDisplayName || "einem Spieler"}.`,
      actionType: "open_map",
    });
  }

  if (ownSeedRank > 1 && nextSeedRankTarget) {
    homeMilestoneFeed.push({
      id: "seed-rank-gap",
      title: `Globaler Rank #${ownSeedRank} -> #${ownSeedRank - 1}`,
      detail: `Noch ${seedsToNextRank} Samen bis du ${nextSeedRankTarget.name || "Unbekannt"} erreichst.`,
      actionType: "open_achievements",
    });
  } else if (ownSeedRank === 1) {
    homeMilestoneFeed.push({
      id: "seed-rank-top",
      title: "Globales Samen-Ranking",
      detail: "Du führst aktuell das Ranking an. Halte den Vorsprung!",
      actionType: "open_achievements",
    });
  }

  if (currentWeeklyQuest) {
    const weeklyProgress = Number(currentWeeklyUserQuest?.progress || 0);
    homeMilestoneFeed.push({
      id: `weekly-quest-${currentWeeklyQuest.id}`,
      kind: "quest",
      title: "Wöchentliche Quest",
      actionType: "open_achievements_quests",
      payload: {
        questType: "weekly",
        title: currentWeeklyQuest.title,
        description: currentWeeklyQuest.description,
        required_discoveries: currentWeeklyQuest.required_discoveries,
        progress: weeklyProgress,
        isCompleted: activeWeeklyQuest?.isCompleted || false,
        target_species_name: currentWeeklyQuest.target_species_name || null,
        target_genus_name: currentWeeklyQuest.target_genus_name || null,
      },
    });
  }

  if (currentMonthlyQuest) {
    const monthlyProgress = Number(currentMonthlyUserQuest?.progress || 0);
    homeMilestoneFeed.push({
      id: `monthly-quest-${currentMonthlyQuest.id}`,
      kind: "quest",
      title: "Monatliche Quest",
      actionType: "open_achievements_quests",
      payload: {
        questType: "monthly",
        title: currentMonthlyQuest.title,
        description: currentMonthlyQuest.description,
        required_discoveries: currentMonthlyQuest.required_discoveries,
        progress: monthlyProgress,
        isCompleted: activeMonthlyQuest?.isCompleted || false,
        target_species_name: currentMonthlyQuest.target_species_name || null,
        target_genus_name: currentMonthlyQuest.target_genus_name || null,
      },
    });
  }

  if (homeMilestoneFeed.length === 0) {
    homeMilestoneFeed.push({
      id: "fallback-collections",
      title: "Sammelfortschritt starten",
      detail: "Folge einer Kollektion und setze einen Favoriten, damit dein Feed personalisiert wird.",
      actionType: "open_collections",
    });
  }

  const heroMapCenter = hasLiveCachedLocation
    ? [cachedLocation.lat, cachedLocation.lng]
    : heroZones[0]
      ? [Number(heroZones[0].centerLat), Number(heroZones[0].centerLng)]
      : [51.1657, 10.4515];

  const activeZoneMeta = activeZone?.theme ? THEME_MAP_META[activeZone.theme] : null;
  const nearestZoneInfo = hasLiveCachedLocation && Array.isArray(heroZones) && heroZones.length > 0
    ? heroZones
        .map((zone) => {
          const centerLat = Number(zone?.centerLat);
          const centerLng = Number(zone?.centerLng);
          if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return null;

          const distanceMeters = calculateDistanceMetersRaw(cachedLocation.lat, cachedLocation.lng, centerLat, centerLng);
          if (!Number.isFinite(distanceMeters)) return null;

          const bearingDegrees = calculateBearingDegrees(cachedLocation.lat, cachedLocation.lng, centerLat, centerLng);
          return {
            zone,
            distanceMeters,
            directionLabel: getCompassDirectionLabel(bearingDegrees),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null
    : null;

  const isZoneLoading = !hasResolvedZoneBootstrap || isLoadingZone;

  const zoneHintText = isZoneLoading || !hasResolvedZoneBootstrap
    ? "Zone wird geladen"
    : activeZoneMeta?.label
      ? `Aktiv: ${activeZoneMeta.label}`
      : nearestZoneInfo
        ? `Naechste: ${(nearestZoneInfo.distanceMeters / 1000).toFixed(1)} km ${nearestZoneInfo.directionLabel ? `(${nearestZoneInfo.directionLabel})` : ""}`
        : "Keine Zone aktiv";
  const nearestZoneDirectionIcon = nearestZoneInfo?.directionLabel
    ? String(nearestZoneInfo.directionLabel).trim().split(/\s+/)[0]
    : "";
  const nearestZoneDistanceKm = nearestZoneInfo && Number.isFinite(nearestZoneInfo.distanceMeters)
    ? Number((nearestZoneInfo.distanceMeters / 1000).toFixed(1))
    : null;
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
  const highestPlantStatusValue = Math.max(
    0,
    Number.isFinite(Number(displayedOverallPlantHealth))
      ? Number(displayedOverallPlantHealth)
      : Math.max(safeEnergy, safeDataQuality, safeCare),
  );
  const profileBadgeMetrics = {
    total_distance_between_scans_km: totalWalkedKilometers,
    total_scans: userDiscoveries.length,
    global_seed_rank: ownSeedRank,
    received_likes_count: receivedLikesCount,
    total_seeds: seedMetricValue,
    claimed_tiles: playerClaimedTiles,
    highest_scan_result: ownHighestScanRewardSeeds,
    highest_plant_status: highestPlantStatusValue,
    rarest_plant_score: rarestDiscoveredPlantScore,
    weekly_quests_completed: completedWeeklyQuestCount,
    monthly_quests_completed: completedMonthlyQuestCount,
    daily_streak_days: streakDays,
    member_since_days: memberSinceDays,
    zone_unlocked_plant_accessories: unlockedZoneAccessoryCount,
    season_seeds: playerSeeds,
    alltime_seeds: allTimeSeeds,
  };
  const evaluatedProfileBadges = evaluateProfileBadges(profileBadgeMetrics);
  const ownedUniqueBadges = resolveOwnedUniqueBadges(ownedUniqueBadgeIds);
  const selectedProfileBadges = buildSelectedProfileBadges(
    user?.selected_badge_ids,
    evaluatedProfileBadges,
    PROFILE_BADGE_MAX_SELECTED,
    ownedUniqueBadges,
  ).map((badge) => ({
    ...badge,
    Icon: getProfileBadgeIconComponent(badge.iconKey),
  }));
  const streakMultiplier = Math.max(1, Math.min(7, streakDays <= 1 ? 1 : streakDays));

  const zoneMultiplierCandidate = Number(
    activeZone?.bonusMultiplier ?? activeZone?.zoneBonusMultiplier ?? activeZone?.zone_bonus_multiplier ?? 1.5
  );
  const zoneMultiplier = Number.isFinite(zoneMultiplierCandidate) && zoneMultiplierCandidate > 0
    ? zoneMultiplierCandidate
    : 1.5;

  const careMultiplier = computeCareMultiplier(safeCare);

  const hasScanToday = userDiscoveries.some((discovery) => {
    const rawDate = discovery?.discovered_date;
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
  const homeContextBubbleMessage =
    florabotContextBubble?.panel === "home" && !activeMilestone && !showFlorabotIntro
      ? florabotContextBubble?.message
      : null;
  const homeHealthContextBubbleMessage =
    florabotContextBubble?.panel === "health" && !activeMilestone && !showFlorabotIntro
      ? florabotContextBubble?.message
      : null;
  const playerSeedsDisplay = Math.max(0, Math.round(Number(seedMetricValue) || 0)).toLocaleString("de-DE");
  const conqueredZonesDisplay = Math.max(0, Math.round(Number(playerClaimedTiles) || 0)).toLocaleString("de-DE");
  const healthSeedBonusDisplay = Math.max(0, Math.round(Number(healthStateBonus) || 0));

  const formatMultiplier = (value) => {
    const safeValue = Number.isFinite(value) ? value : 1;
    return `x${safeValue.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}`;
  };


  const navItems = [
    {
      label: "Map",
      icon: MapPin,
      onClick: () => {
        trackAction("bottomnav_map", { sourcePage: "Home" });
        handleOpenHeroZoneMap();
        setShowHealthStatsPanel(false);
      },
      isActive: activePanel === "map",
      ...getNavButtonStyle({ palette: "blue", isLightUi }),
    },
    {
      label: "Aufgaben",
      icon: Scroll,
      onClick: () => {
        trackAction("bottomnav_achievements", { sourcePage: "Home" });
        setActivePanel("achievements");
        setShowHealthStatsPanel(false);
      },
      showNotificationDot: hasRedeemableQuests,
      isActive: activePanel === "achievements",
      ...getNavButtonStyle({ palette: "amber", isLightUi }),
    },
    {
      label: "Sammlung",
      icon: Leaf,
      onClick: () => {
        trackAction("bottomnav_collection", { sourcePage: "Home" });
        setActivePanel("collection");
        setEmbeddedCollectionEntryCategory(null);
        setShowHealthStatsPanel(false);
      },
      isActive: activePanel === "collection",
      ...getNavButtonStyle({ palette: "green", isLightUi }),
    },
    {
      label: "Log",
      icon: Users,
      onClick: () => {
        trackAction("bottomnav_social", { sourcePage: "Home" });
        setActivePanel("friends");
        setShowHealthStatsPanel(false);
      },
      showNotificationDot: hasSocialNotifications,
      isActive: activePanel === "friends",
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
            ...buildNotificationPayload("scanLiked", {
              likerName: user.display_name || user.full_name || user.email,
              plantNameOptional: plantName || "",
            }),
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

  const openShop = (category = "root") => {
    if (!isShopUnlocked) {
      window.alert("Der Shop wird ab 5.000 Samen freigeschaltet.");
      return false;
    }

    setShopOpenCategory(category);
    setActivePanel("shop");
    setShowHealthStatsPanel(false);
    return true;
  };

  const openShopStack = () => {
    if (showShopStack) {
      setShowShopStack(false);
      setShopStackDraftOverrides(null);
      setShopStackHasUnsavedChanges(false);
      return true;
    }

    if (!isShopUnlocked) {
      window.alert("Der Shop wird ab 5.000 Samen freigeschaltet.");
      return false;
    }

    setShowHealthStatsPanel(false);
    setShowShopStack(true);
    return true;
  };

  /** Returns a random viewport position for the care bubble that avoids the floating logo overlay. */
  const pickCareBubblePosition = () => {
    if (typeof window === "undefined") return null;
    const margin = 72;
    const bSize = 52;
    const bRadius = bSize / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clearance = 24; // px clearance around excluded rects

    // Collect rects to avoid (floating logo copy + original logo button)
    const excludeRects = [];
    if (typeof document !== "undefined") {
      const floatingLogo = document.querySelector('[data-floating-logo-overlay="true"]');
      if (floatingLogo) {
        const r = floatingLogo.getBoundingClientRect();
        if (r.width > 0) excludeRects.push(r);
      }
      // Also avoid the original logo trigger button in HomeCollectionStripes
      const originalLogo = document.querySelector('[data-logo-click-target="true"]');
      if (originalLogo) {
        const r = originalLogo.getBoundingClientRect();
        if (r.width > 0) excludeRects.push(r);
      }
    }

    const overlaps = (cx, cy) =>
      excludeRects.some((r) => {
        const ex = r.left - clearance - bRadius;
        const ey = r.top - clearance - bRadius;
        const ew = r.width + (clearance + bRadius) * 2;
        const eh = r.height + (clearance + bRadius) * 2;
        return cx > ex && cx < ex + ew && cy > ey && cy < ey + eh;
      });

    for (let attempt = 0; attempt < 20; attempt++) {
      const bx = margin + Math.random() * Math.max(0, vw - margin * 2 - bSize);
      const by = vh * 0.32 + Math.random() * (vh * 0.38);
      const cx = bx + bRadius;
      const cy = by + bRadius;
      if (!overlaps(cx, cy)) return { x: cx, y: cy };
    }

    // Fallback: no exclusion
    const bx = margin + Math.random() * Math.max(0, vw - margin * 2 - bSize);
    const by = vh * 0.32 + Math.random() * (vh * 0.38);
    return { x: bx + bRadius, y: by + bRadius };
  };

  const handleWaterPlantClick = () => {
    console.log(`${PORTAL_CARE_DEBUG_PREFIX} handleWaterPlantClick`, {
      mutationPending: waterPlantMutation.isPending,
      wateringCountToday,
      wateringLimitPerDay,
      remainingWatersToday,
      isDailyCareStatusLoading,
    });
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

  return (
    <>
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
              } else if (randomRewardQueue.length > 0) {
                setTimeout(() => {
                  setShowRandomReward(true);
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
                  if (randomRewardQueue.length > 0) {
                    setTimeout(() => setShowRandomReward(true), 280);
                  }
                }
                return nextQueue;
              });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRandomReward && randomRewardQueue.length > 0 && (
          <RandomRewardNotification
            reward={randomRewardQueue[0]}
            remainingCount={Math.max(0, randomRewardQueue.length - 1)}
            onComplete={() => {
              setRandomRewardQueue((prevQueue) => {
                const nextQueue = prevQueue.slice(1);
                if (nextQueue.length === 0) {
                  setShowRandomReward(false);
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
            logoAssets={logoAssets}
            onDismiss={() => {
              introDismissedThisSessionRef.current = true;
              setShowFlorabotIntro(false);
              setActivePanel(null);
              setShowHealthStatsPanel(false);

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
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeMilestone && !showFlorabotIntro && (
          <FlorabotMilestoneOverlay
            milestone={activeMilestone}
            profile={user}
            logoAssets={logoAssets}
            onDismiss={(milestoneId) => {
              const normalizedMilestoneId = String(milestoneId || "").trim();
              if (normalizedMilestoneId) {
                dismissedMilestoneIdsRef.current.add(normalizedMilestoneId);
              }

              const scopedMilestoneId = buildScopedMilestoneId(milestoneScopeKey, milestoneId);
              if (!scopedMilestoneId) {
                setActiveMilestone(null);
                setActivePanel(null);
                setShowHealthStatsPanel(false);
                return;
              }
              markMilestoneSeen(user?.id, scopedMilestoneId, milestoneScopeKey);

              if (user?.id) {
                const nextSeenIds = mergeSeenMilestoneIds(
                  mergedSeenMilestoneIds,
                  [scopedMilestoneId]
                );

                setUserStory((previousStory) => ({
                  ...(previousStory || {}),
                  seen_milestone_ids: nextSeenIds,
                }));

                updateUserStory(user.id, {
                  seen_milestone_ids: nextSeenIds,
                  seed_progress_at_last_eval: storySeedProgress,
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
              setActivePanel(null);
              setShowHealthStatsPanel(false);
            }}
          />
        )}
      </AnimatePresence>

      <HomeMilestoneOverlayToggle
        isOpen={Boolean(isMilestoneOverlayToggled && !showFlorabotIntro && !activeMilestone)}
        milestone={toggleMilestonePreview}
        profile={user}
        authId={user?.id}
        currentUser={user}
        badgeMetrics={profileBadgeMetrics}
        initialShopCategory={homeOverlayInitialShopCategory}
        initialShopOpen={homeOverlayInitialShopOpen}
        logoAssets={logoAssets}
        playerSparks={playerSparks}
        playerAmber={playerAmber}
        plantHealthState={resolvedPlantHealthState}
        healthStats={healthStats}
        ambientMessage={homeOverlayAmbientMessage}
        quizAvailable={quizAvailable}
        onQuizClick={() => setShowPlantQuizDialog(true)}
        wateringCountToday={wateringCountToday}
        wateringLimitPerDay={wateringLimitPerDay}
        remainingWatersToday={remainingWatersToday}
        isDailyCareLoading={isDailyCareStatusLoading}
        isWateringPending={waterPlantMutation.isPending}
        onWaterPlant={handleWaterPlantClick}
        onSpawnBubble={() => {
          if (wateringCountToday >= wateringLimitPerDay) return;
          if (careBubble) return;
          const pos = pickCareBubblePosition();
          if (pos) setCareBubble({ ...pos, key: Date.now() });
        }}
        onCustomize={(isCustomizeOpen) => {
          setIsHomeOverlayShopOpen(Boolean(isCustomizeOpen));
        }}
        onUserUpdated={(freshUser) => setUser(freshUser)}
        onClose={() => {
          setIsHomeOverlayShopOpen(false);
          setIsMilestoneOverlayToggled(false);
          setHomeOverlayInitialShopOpen(false);
          setHomeOverlayInitialShopCategory("root");
        }}
      />

      <GreenCareBubble
        key={careBubble?.key ?? 0}
        isActive={Boolean(careBubble)}
        position={careBubble ?? { x: 0, y: 0 }}
        onBurst={handleWaterPlantClick}
        onDismiss={() => setCareBubble(null)}
      />

      <AnimatePresence>
        {florabotContextBubble && florabotContextBubble.panel !== 'home' && !activeMilestone && !showFlorabotIntro && (
          <FlorabotContextBubble
            message={florabotContextBubble.message}
            profile={user}
            logoAssets={logoAssets}
            onDismiss={dismissFlorabotContextBubble}
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

      <AmberPurchaseDialog
        open={showAmberPurchaseModal}
        onOpenChange={setShowAmberPurchaseModal}
        currentBalance={playerAmber}
        isLightUi={isLightUi}
        onPurchased={() => queryClient.invalidateQueries({ queryKey: ["userWallet", user?.id] })}
      />

      <HomeBackgroundShell
        user={effectiveUser}
        getRgbaFromRgb={getRgbaFromRgb}
      >
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            data-ui="home-main-content-shell"
            className={`relative h-full w-full ${activePanel === null ? "overflow-visible" : "overflow-hidden"}`}
          >
            <div className={`relative z-10 h-full flex flex-col ${activePanel === "map" ? "px-0 py-0" : "px-2 md:px-4 py-4 md:py-6"} ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
              {activePanel === null && (
                <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex max-w-[65%] flex-col md:inset-x-8 md:top-6">
                  {showShopStack ? (
                    <>
                      <h1
                        className="-m-3 truncate p-3 font-bold leading-tight text-2xl md:text-3xl [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_10px_rgba(0,0,0,0.75),0_0_20px_rgba(0,0,0,0.55)]"
                      >
                        Anpassen
                      </h1>
                      <div className="-mx-3 -mt-2.5 p-3">
                        <ShopCategoryVerticalCarousel
                          activeKey={shopStackActiveCategory}
                          onSelect={setShopStackActiveCategory}
                          isLightUi={isLightUi}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <h1
                        className="-m-3 truncate p-3 font-bold leading-tight text-2xl md:text-3xl [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_10px_rgba(0,0,0,0.75),0_0_20px_rgba(0,0,0,0.55)]"
                        title={`${displayName || ""}, ${resolvedUserTitle}`}
                      >
                        {displayName}, {resolvedUserTitle}
                      </h1>
                      <p className={`-mx-3 -mb-3 -mt-2.5 truncate p-3 text-sm md:text-base [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.7)] ${isLightUi ? "text-stone-700/90" : "text-stone-200/85"}`}>
                        und {botName || "Florabot"}
                      </p>
                      <div className={`-mx-3 -mt-3 flex items-center gap-1.5 p-3 text-sm md:text-base font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.7)] ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
                        <Sprout className={`h-4 w-4 shrink-0 ${isLightUi ? "text-emerald-600" : "text-emerald-400"}`} aria-hidden="true" />
                        <span>{playerSeedsDisplay}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <HomeHeaderBar
                hidden={activePanel === "map" || activePanel === null}
                activePanel={activePanel}
                embeddedTitle={embeddedTitle}
                embeddedSubtitle={embeddedSubtitle}
                embeddedInfoLabel={embeddedInfoLabel}
                embeddedCollectionCanGoBack={activePanel === "collection" && embeddedCollectionEntryCategory !== null}
                displayName={displayName}
                userTitle={resolvedUserTitle}
                onEmbeddedCollectionBack={() => {
                  setEmbeddedCollectionEntryCategory(null);
                  setEmbeddedCollectionPublicPanelOpen(false);
                  setEmbeddedSelectedCollectionId("global");
                }}
                onEmbeddedAchievementsBack={embeddedHeaderMeta?.backHandler ?? null}
                onOpenEmbeddedFriendsAddDialog={() => setEmbeddedFriendsAddDialogNonce((prev) => prev + 1)}
                onOpenAmberPurchase={() => setShowAmberPurchaseModal(true)}
                onPrimaryAction={() => {
                  if (activePanel === "collection") {
                    setEmbeddedCollectionPublicPanelOpen(false);
                    setEmbeddedSelectedCollectionId("global");
                    setEmbeddedCollectionEntryCategory(null);
                  }
                  if (activePanel !== null) {
                    trackAction("home_panel_return", { sourcePage: "Home", metadata: { closedPanel: activePanel } });
                    setActivePanel(null);
                    return;
                  }
                  trackAction("home_settings_open", { sourcePage: "Home" });
                  setActivePanel("settings");
                  setShowHealthStatsPanel(false);
                }}
              />

              <BugReportDialog
                open={bugReportDialogOpen}
                onOpenChange={setBugReportDialogOpen}
                user={user}
                displayName={getDisplayName()}
              />

              <ServerNewsDialog
                open={serverNewsDialogOpen}
                onOpenChange={setServerNewsDialogOpen}
                user={user}
              />

              <div
                className={`relative flex flex-1 min-h-0 flex-col ${activePanel === null ? "overflow-visible" : "overflow-hidden"} ${activePanel === "map" ? "py-0" : (shouldDockEmbeddedChipHeader ? "py-0" : "py-[clamp(0.5rem,1.5vh,1rem)]")}`}
                data-ui="home-content-stack"
              >
                {activePanel === "collection" ? (
                  <Collection
                    embedded
                    onRequestClose={() => {
                      setActivePanel(null);
                      setEmbeddedSelectedCollectionId("global");
                      setEmbeddedCollectionEntryCategory(null);
                    }}
                    initialCollectionId={embeddedSelectedCollectionId}
                    onSelectedCollectionIdChange={setEmbeddedSelectedCollectionId}
                    entryCategory={embeddedCollectionEntryCategory}
                    onEntryCategoryChange={setEmbeddedCollectionEntryCategory}
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
                    badgeMetrics={profileBadgeMetrics}
                    ownedUniqueBadgeIds={ownedUniqueBadgeIds}
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
                    onClose={() => setActivePanel(null)}
                    onRegenerateZones={handleRegenerateZones}
                    canRegenerateZones={hasCalledZoneGenerationToday && !isLoadingZone && (isAdminUser || zoneRerollsRemaining !== 0)}
                    isRegeneratingZones={isRegeneratingZones}
                    zoneRerollsRemaining={zoneRerollsRemaining}
                    allDiscoveryPoints={allDiscoveryPoints}
                    discoveryMarkerScale={discoveryMarkerScale}
                    plants={plants}
                    rewards={rewards}
                    userRewards={userRewards}
                    genera={genera}
                    logoAssetCatalog={logoAssets}
                  />
                ) : (
                  <section data-ui="home-plant-hero-section" className="relative flex-1 min-h-0 rounded-3xl px-[clamp(0.25rem,1vw,0.75rem)] pt-[clamp(0.1rem,0vh,0.5rem)] pb-[clamp(0.12rem,0.35vh,0.28rem)] flex flex-col gap-2 bg-transparent">
                    <HomeHeroSideNav
                      isLightUi={isLightUi}
                      playerSeeds={playerSeeds}
                      playerSparks={playerSparks}
                      playerAmber={playerAmber}
                      user={effectiveUser}
                      isHealthViewActive={showHealthStatsPanel}
                      onToggleHealthView={() => setShowHealthStatsPanel((prev) => !prev)}
                      onOpenSettings={() => {
                        trackAction("home_settings_open", { sourcePage: "Home" });
                        setActivePanel("settings");
                      }}
                      onOpenBugReport={() => setBugReportDialogOpen(true)}
                      onOpenServerNews={() => setServerNewsDialogOpen(true)}
                      onOpenAmberPurchase={() => setShowAmberPurchaseModal(true)}
                      onOpenCustomize={() => openShopStack()}
                    />
                    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
                      <HomeCollectionStripes
                      className={showHealthStatsPanel ? "flex-[0.4] min-h-[12.5rem]" : "flex-1 min-h-0"}
                      isHealthView={showHealthStatsPanel}
                      isLightUi={isLightUi}
                      profile={effectiveUser}
                      logoAssets={logoAssets}
                      elevateLogo={Boolean(isMilestoneOverlayToggled && !showFlorabotIntro && !activeMilestone && !isHomeOverlayShopOpen)}
                      onBadgeClick={() => {
                        trackAction("home_badge_customize_open", { sourcePage: "Home" });
                        setHomeOverlayInitialShopCategory("badges");
                        setHomeOverlayInitialShopOpen(true);
                        setIsMilestoneOverlayToggled(true);
                        setIsHomeOverlayShopOpen(true);
                      }}
                      onLogoClick={() => {
                        if (toggleMilestonePreview) {
                          const now = Date.now();
                          const isAmbientCooldownActive = now < homeOverlayAmbientCooldownUntilRef.current;

                          if (!isAmbientCooldownActive) {
                            const { comment } = pickRandomPhaseAmbientComment(storySeedProgress, []);
                            const resolvedAmbientComment = comment
                              ? interpolatePercentVariables(comment, buildStoryProfileVariables(user || {}))
                              : "";
                            const nextAmbientComment = resolvedAmbientComment || comment || "";
                            setHomeOverlayAmbientMessage(nextAmbientComment);
                            if (nextAmbientComment) {
                              homeOverlayAmbientCooldownUntilRef.current = now + (5 * 60 * 1000);
                            }
                          } else {
                            setHomeOverlayAmbientMessage("");
                          }

                          trackAction("home_logo_overlay_open", { sourcePage: "Home" });
                          setHomeOverlayInitialShopCategory("root");
                          setHomeOverlayInitialShopOpen(false);
                          setIsMilestoneOverlayToggled(true);
                          setIsHomeOverlayShopOpen(false);

                          // Spawn a floating care bubble only if daily care is still available
                          if (wateringCountToday < wateringLimitPerDay) {
                            const pos = pickCareBubblePosition();
                            if (pos) setCareBubble({ ...pos, key: Date.now() });
                          }
                        }
                      }}
                      zoneHintText={zoneHintText}
                      nearestZoneDirectionIcon={nearestZoneDirectionIcon}
                      nearestZoneDistanceKm={nearestZoneDistanceKm}
                      securedMultiplier={securedNextScanMultiplier}
                      />
                    {showShopStack ? (
                      <GoldGradientCard
                        blur
                        className="mt-3 flex-1 min-h-0 overflow-hidden"
                        contentClassName="flex min-h-0 flex-col"
                      >
                        <ShopFeatureRoot
                          embedded
                          flatMode
                          draftMode
                          authId={user?.id}
                          currentUser={user}
                          badgeMetrics={profileBadgeMetrics}
                          ownedUniqueBadgeIds={ownedUniqueBadgeIds}
                          onUserUpdated={(freshUser) => setUser(freshUser)}
                          saveNonce={shopStackSaveNonce}
                          activeFlatCategoryKey={shopStackActiveCategory}
                          onFlatCategoryKeyChange={setShopStackActiveCategory}
                          onDraftPreviewChange={setShopStackDraftOverrides}
                          onUnsavedChange={setShopStackHasUnsavedChanges}
                          onSaveComplete={(success) => {
                            if (success) {
                              setShowShopStack(false);
                              setShopStackDraftOverrides(null);
                              setShopStackHasUnsavedChanges(false);
                            }
                          }}
                        />
                      </GoldGradientCard>
                    ) : showHealthStatsPanel ? (
                      <div ref={healthStatsPanelRef} className="flex-1 min-h-0">
                        <PlantHeroHealthPanel
                          contextBubbleMessage={homeHealthContextBubbleMessage}
                          contextBubbleProfile={user}
                          onContextBubbleDismiss={dismissFlorabotContextBubble}
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
                          fertilizerInventoryItems={fertilizerItems}
                          activeFertilizerItemId={activeFertilizerItemId}
                          activeFertilizerRemainingDays={activeFertilizerRemainingDays}
                          activeDecayPercent={activeDecayPercent}
                          careActionMessage={careActionMessage}
                          careGainFeedback={careGainFeedback}
                          onWaterPlant={handleWaterPlantClick}
                          onUseFertilizerItem={handleUseFertilizerItem}
                          onOpenFertilizerShop={handleOpenFertilizerShop}
                        />
                      </div>
                    ) : (
                      <div
                        className="relative z-10 flex flex-initial flex-col gap-2"
                      >
                        <HomeProfileBadgesPanel
                          isLightUi={isLightUi}
                          selectedProfileBadges={selectedProfileBadges}
                          playerSeeds={playerSeeds}
                        />
                        <div
                          className="w-full"
                          style={eventStripeHeightPx ? { maxHeight: `${eventStripeHeightPx}px` } : undefined}
                        >
                          <RewardCardWrapper
                            className="h-full"
                            rewards={rewards}
                            userRewards={userRewards}
                            isLightUi={isLightUi}
                            completedWeeklyQuestCount={completedWeeklyQuestCount}
                            completedMonthlyQuestCount={completedMonthlyQuestCount}
                            quests={quests}
                            weeklyQuests={weeklyQuests}
                            monthlyQuests={monthlyQuests}
                            achievements={achievements}
                            genera={genera}
                            plants={plants}
                          />
                        </div>
                      </div>
                    )}
                    </div>
                  </section>
                )}
              </div>

              <div className={`${activePanel === null ? "pt-0" : "pt-[clamp(0.35rem,0.9vh,0.7rem)]"} pb-[clamp(0.15rem,0.5vh,0.35rem)] flex shrink-0 flex-col`}>
                {activePanel === null && !showHealthStatsPanel && !showShopStack ? (
                  <div ref={eventStripeContainerRef} className="mb-[clamp(0.35rem,0.8vh,0.55rem)]">
                    <HomeEventStripe isLightUi={isLightUi} events={homeEventStripeItems} />
                  </div>
                ) : null}
                {activePanel === null ? (
                  showShopStack ? (
                    <HomeCurrencyInfoRow
                      className="mb-[clamp(0.35rem,0.8vh,0.55rem)]"
                      isLightUi={isLightUi}
                      playerSparks={playerSparks}
                      playerAmber={playerAmber}
                      onOpenAmberPurchase={() => setShowAmberPurchaseModal(true)}
                    />
                  ) : (
                    <HomeScanInfoRow
                      className="mb-[clamp(0.35rem,0.8vh,0.55rem)]"
                      isLightUi={isLightUi}
                      conqueredZonesDisplay={conqueredZonesDisplay}
                      zoneMultiplier={zoneMultiplier}
                      careMultiplier={careMultiplier}
                      activityBonusDisplay={healthSeedBonusDisplay}
                    />
                  )
                ) : null}
                <HomeBottomNavigation
                  navItems={navItems}
                  controlsScale={controlsScale}
                  centerContext={activePanel === null && !showShopStack ? "inside" : "outside"}
                  highlightCenterAction={activePanel === null && !showShopStack && showScannerHighlight}
                  onCenterAction={() => {
                    if (activePanel === null) {
                      if (showShopStack) {
                        if (shopStackHasUnsavedChanges) {
                          trackAction("home_shop_stack_save", { sourcePage: "Home" });
                          setShopStackSaveNonce((prev) => prev + 1);
                        } else {
                          setShowShopStack(false);
                          setShopStackDraftOverrides(null);
                          setShopStackHasUnsavedChanges(false);
                        }
                        return;
                      }
                      trackAction("home_scan_click", { sourcePage: "Home" });
                      navigate(createPageUrl('Scanner'));
                      return;
                    }

                    trackAction("bottomnav_home", { sourcePage: "Home", metadata: { closedPanel: activePanel } });
                    setActivePanel(null);
                  }}
                />
              </div>
            </div>
          </motion.div>

      </HomeBackgroundShell>
    </>
  );
}

export default function Home() {
  const isDesktopBrowser = useDesktopBrowser();

  if (isDesktopBrowser) {
    return <HomeDesktopLanding />;
  }

  return (
    <HomeOtaGate>
      <HomeContent />
    </HomeOtaGate>
  );
}
