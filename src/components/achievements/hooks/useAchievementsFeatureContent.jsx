import { useState, useEffect, useRef, useMemo } from "react";
import { Query } from "@/api/entities";
import { trackAction } from "@/api/analyticsService";
import { createUserNotification } from "@/api/notificationService";
import { buildNotificationPayload } from "@/lib/story/storyDefinition";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Leaf, Target, CheckCircle2, Gift, Users, ChevronDown, ChevronUp, ChevronLeft, Loader2, ScanSearch, BarChart2, Globe, CalendarDays, User } from "lucide-react";
import { getNavButtonStyle, NAV_COLOR_ORDER } from "@/components/navigation/navButtonStyles";
import CollectionCategoryEntryCard from "@/components/collection/CollectionCategoryEntryCard";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import MobileBackButton from "@/components/navigation/MobileBackButton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AnimatePresence } from "framer-motion";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ScanFeedbackNotification from "@/components/notifications/ScanFeedbackNotification";
import { checkAndUnlockAchievements } from "@/components/achievements/achievementChecker";
import AchievementNotification from "@/components/achievements/AchievementNotification";
import { getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";
import { updateQuestProgress } from "@/components/utils/questProgress";
import { grantRobotPlantRewardServerSide } from "@/api/robotPlantService";
import { grantWalletCurrency } from "@/api/walletService";
import { useUiTheme } from "@/lib/UiThemeContext";
import { createPageUrl } from "@/utils";
import { resolveTitleValue } from "@/lib/profileCustomizationOptions";
import { supabase } from "@/api/supabaseClient";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import { hexToFilter } from "@/lib/hexToFilter";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import { getActiveSeason } from "@/lib/seasonConfig";

/** @type {{ regular: number, weekly: number, monthly: number }} */
const DEFAULT_QUEST_SEED_REWARD_BY_TYPE = {
  regular: 500,
  weekly: 1500,
  monthly: 1000,
};

const ALLOWED_ACHIEVEMENTS_TABS = new Set(["quests", "achievements", "stats"]);

const resolveAchievementsTab = (tabValue) => (
  ALLOWED_ACHIEVEMENTS_TABS.has(tabValue) ? tabValue : "stats"
);

/**
 * @param {{ questType: string, seedReward: number | string | null | undefined }} params
 */
const resolveQuestSeedReward = ({ questType, seedReward }) => {
  const parsedReward = Number(seedReward ?? 0);
  if (Number.isFinite(parsedReward) && parsedReward > 0) {
    return Math.round(parsedReward);
  }
  if (questType === "weekly") return DEFAULT_QUEST_SEED_REWARD_BY_TYPE.weekly;
  if (questType === "monthly") return DEFAULT_QUEST_SEED_REWARD_BY_TYPE.monthly;
  return DEFAULT_QUEST_SEED_REWARD_BY_TYPE.regular;
};

/**
 * @param {any} error
 */
const isMissingRpcFunctionError = (error) => {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST203" ||
    error.code === "42883" ||
    message.includes("could not find the function") ||
    message.includes("could not choose the best candidate")
  );
};

/**
 * @param {{ reward: { amount: number, questTitle?: string | null } | null, onComplete?: () => void }} props
 */
function QuestSeedRewardNotification({ reward, onComplete }) {
  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    if (!reward?.amount || reward.amount <= 0) return undefined;

    /** @type {number | null} */
    let frameId = null;
    /** @type {number[]} */
    const timeoutIds = [];
    const finalAmount = Math.max(0, Math.round(Number(reward.amount || 0)));

    const start = performance.now();
    const durationMs = 680;

    const tick = (/** @type {number} */ now) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(finalAmount * eased);
      setDisplayAmount(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      setDisplayAmount(finalAmount);
    };

    frameId = window.requestAnimationFrame(tick);

    timeoutIds.push(
      window.setTimeout(() => {
        if (onComplete) onComplete();
      }, 1900)
    );

    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [onComplete, reward]);

  if (!reward?.amount || reward.amount <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 pointer-events-none"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.96 }}
        transition={{ type: "spring", damping: 18, stiffness: 260 }}
        className="relative w-[88%] max-w-xs overflow-hidden rounded-2xl border border-emerald-200/45 bg-black/70 px-5 py-4 text-center shadow-[0_20px_55px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-300/10 via-emerald-900/20 to-black/55" />
        <div className="relative z-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/85">Quest Belohnung</div>
          <div className="mt-2 text-4xl font-black tracking-tight text-emerald-300">+{displayAmount}</div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-stone-200/90">Seeds</div>
          {reward?.questTitle && (
            <div className="mt-2 line-clamp-1 text-[11px] text-stone-300">{reward.questTitle}</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

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
        let r = 0,g = 0,b = 0,count = 0;
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

export function useAchievementsFeatureContent({
  embedded = false,
  initialTab = null,
  onHeaderMetaChange,
  onRequestClose: _onRequestClose = null,
  onUserUpdated,
}) {
  const { isLightUi } = useUiTheme();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const normalizedInitialTab = String(initialTab || "").toLowerCase();
  const requestedSearchTab = String(searchParams.get("tab") || "").toLowerCase();
  const requestedTab = embedded ? normalizedInitialTab : requestedSearchTab;
  const [user, setUser] = useState(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState(() => resolveAchievementsTab(requestedTab));
  const [questFeedback, setQuestFeedback] = useState(null);
  const [seedRewardFeedback, setSeedRewardFeedback] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showGlobalComparisons, setShowGlobalComparisons] = useState(true);
  const [showWeeklyScore, setShowWeeklyScore] = useState(true);
  const [showPersonalStats, setShowPersonalStats] = useState(true);
  const [statsSection, setStatsSection] = useState("global");
  const [globalSubSection, setGlobalSubSection] = useState("scans");
  // Layered navigation: null = overview, "leaderboard_scope", "leaderboard", "quests", "achievements"
  const [achievementsView, setAchievementsView] = useState(() => {
    const tab = resolveAchievementsTab(String(initialTab || "").toLowerCase());
    if (tab === "quests") return "quests";
    if (tab === "achievements") return "achievements";
    return null;
  });
  const _prevAchievementsViewRef = useRef(achievementsView);
  useEffect(() => {
    if (achievementsView !== null && achievementsView !== _prevAchievementsViewRef.current) {
      trackAction(`achievements_view_${achievementsView}`, { sourcePage: "Achievements" });
    }
    _prevAchievementsViewRef.current = achievementsView;
  }, [achievementsView]);
  const [expandedHighestScanEntryKey, setExpandedHighestScanEntryKey] = useState(null);
  const [isLeaderboardRefreshing, setIsLeaderboardRefreshing] = useState(
    () => resolveAchievementsTab(requestedTab) === "stats"
  );
  const activeSeason = getActiveSeason();
  const seasonStartDate = activeSeason?.startDate || null;
  const hasActiveSeason = Boolean(seasonStartDate);
  const [statsComparisonScope, setStatsComparisonScope] = useState(() => (hasActiveSeason ? "season" : "alltime"));
  const comparisonFromDate = statsComparisonScope === "season" ? seasonStartDate : null;
  const comparisonRangeLabel = statsComparisonScope === "season"
    ? (activeSeason?.title || "Saison")
    : "All-Time";
  const comparisonDateFloor = comparisonFromDate ? new Date(`${comparisonFromDate}T00:00:00`) : null;

  useEffect(() => {
    if (!hasActiveSeason && statsComparisonScope !== "alltime") {
      setStatsComparisonScope("alltime");
    }
  }, [hasActiveSeason, statsComparisonScope]);

  useEffect(() => {
    const nextTab = resolveAchievementsTab(requestedTab);
    setActiveTab((previousTab) => (previousTab === nextTab ? previousTab : nextTab));
    if (nextTab === "stats") {
      setIsLeaderboardRefreshing(true);
    }
  }, [requestedTab]);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!ALLOWED_ACHIEVEMENTS_TABS.has(activeTab)) {
      setActiveTab("stats");
    }
  }, [activeTab]);

  // Beim Öffnen der Achievements-Seite einmalig Quest-Fortschritt aktualisieren
  useEffect(() => {
    const runQuestProgressUpdate = async () => {
      if (!user?.id) return;
      try {
        console.log('[AchievementsPage] Running updateQuestProgress for user:', user.email);
        await updateQuestProgress(user);
      } catch (error) {
        console.error('[AchievementsPage] Error while updating quest progress:', error);
      }
    };

    runQuestProgressUpdate();
  }, [user?.id]);

  // Konsumiere Quest-Feedback aus Navigation-State einmalig (analog Home/ScanFeedback)
  useEffect(() => {
    if (location.state && location.state.questFeedback) {
      setQuestFeedback(location.state.questFeedback);

      const { questFeedback: _ignored, ...restState } = location.state;
      const nextState = Object.keys(restState).length > 0 ? restState : null;

      navigate(location.pathname + location.search, {
        replace: true,
        state: nextState,
      });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (user?.background_color) {
      setAverageColor(user.background_color);
    } else if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then((color) => {
        if (color) setAverageColor(color);
      });
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

  // Beim Öffnen der Achievements-Seite einmalig Achievements prüfen
  useEffect(() => {
    const runAchievementCheck = async () => {
      if (!user) return;
      try {
        console.log('[AchievementsPage] Running checkAndUnlockAchievements for user:', user.email);
        const newlyUnlocked = await checkAndUnlockAchievements(user);
        console.log('[AchievementsPage] Newly unlocked achievements:', newlyUnlocked?.length || 0);
        if (newlyUnlocked && newlyUnlocked.length > 0) {
          setNewAchievements(newlyUnlocked);
          setCurrentAchievementIndex(0);
        }
      } catch (error) {
        console.error('[AchievementsPage] Error while checking achievements:', error);
      }
    };

    runAchievementCheck();
  }, [user]);

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => Query.Achievement.list('achievement_number'),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', user?.id],
    queryFn: () => Query.UserAchievement.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => Query.Quest.list('quest_number'),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests', user?.id],
    queryFn: () => Query.UserQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => Query.WeeklyQuest.list('quest_number'),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ['userWeeklyQuests', user?.id],
    queryFn: () => Query.UserWeeklyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => Query.MonthlyQuest.list('quest_number'),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: userMonthlyQuests = [] } = useQuery({
    queryKey: ['userMonthlyQuests', user?.id],
    queryFn: () => Query.UserMonthlyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Query.Reward.list(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
    staleTime: 10 * 60 * 1000, // 10 Minuten - ändert sich selten
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
    staleTime: 10 * 60 * 1000, // 10 Minuten - ändert sich selten
  });

  const { data: userCollectionQuests = [] } = useQuery({
    queryKey: ['userCollectionQuests', user?.id],
    queryFn: () => Query.UserCollectionQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ['userDiscoveries', user?.id],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: allDiscoveries = [], refetch: refetchAllDiscoveries } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => Query.UserPlantDiscovery.list('-discovered_date', 1500),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: allProfiles = [], refetch: refetchAllProfiles } = useQuery({
    queryKey: ['allProfilesForStats'],
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: allFriendRecords = [], refetch: refetchAllFriendRecords } = useQuery({
    queryKey: ['allFriendRecordsForStats', user?.email],
    queryFn: () => Query.Friend.list(),
    enabled: !!user?.email,
    staleTime: 15 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: allRobotPlants = [], refetch: refetchAllRobotPlants } = useQuery({
    queryKey: ['allRobotPlantsForStats'],
    queryFn: () => Query.RobotPlant.list(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
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

  const { data: globalScanLeaderboard = null, refetch: refetchGlobalScanLeaderboard } = useQuery({
    queryKey: ['globalScanLeaderboard', comparisonFromDate || 'alltime'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_global_scan_leaderboard', {
        p_from_date: comparisonFromDate,
      });
      if (error) {
        if (isMissingRpcFunctionError(error)) {
          if (comparisonFromDate) {
            console.warn('[AchievementsPage] get_global_scan_leaderboard with p_from_date unavailable, keeping seasonal fallback only.');
            return null;
          }
          const legacyCall = await supabase.rpc('get_global_scan_leaderboard');
          if (legacyCall.error) {
            console.warn('[AchievementsPage] legacy get_global_scan_leaderboard unavailable, using discovery fallback.');
            return null;
          }
          return Array.isArray(legacyCall.data) ? legacyCall.data : [];
        }
        throw error;
      }
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: highestScanResultsLeaderboard = null, refetch: refetchHighestScanResultsLeaderboard } = useQuery({
    queryKey: ['highestScanResultsLeaderboard', comparisonFromDate || 'alltime'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_highest_scan_results_leaderboard', {
        p_limit: 100,
        p_from_date: comparisonFromDate,
      });
      if (error) {
        if (isMissingRpcFunctionError(error)) {
          if (comparisonFromDate) {
            console.warn('[AchievementsPage] get_highest_scan_results_leaderboard with p_from_date unavailable.');
            return null;
          }
          const legacyCall = await supabase.rpc('get_highest_scan_results_leaderboard', {
            p_limit: 100,
          });
          if (legacyCall.error) {
            console.warn('[AchievementsPage] legacy get_highest_scan_results_leaderboard unavailable.');
            return null;
          }
          return Array.isArray(legacyCall.data) ? legacyCall.data : [];
        }
        throw error;
      }
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: weeklySeedLeaderboard = null, refetch: refetchWeeklySeedLeaderboard } = useQuery({
    // Always keyed to the current ISO week (Monday), never to the season scope.
    queryKey: ['weeklySeedLeaderboard', 'current-week'],
    queryFn: async () => {
      // Pass p_from_date: null explicitly so PostgREST always routes to the (integer, text) overload.
      const { data, error } = await supabase.rpc('get_weekly_seed_leaderboard', {
        p_limit: 100,
        p_from_date: null,
      });
      if (error) {
        console.error('[AchievementsPage] get_weekly_seed_leaderboard (weekly) error:', error.code, error.message, error);
        if (isMissingRpcFunctionError(error)) {
          console.warn('[AchievementsPage] get_weekly_seed_leaderboard unavailable (ambiguous/missing).');
          return null;
        }
        throw error;
      }
      console.debug('[AchievementsPage] weeklySeedLeaderboard rows:', data?.length ?? 0);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: seasonSeedLeaderboard = null, refetch: refetchSeasonSeedLeaderboard } = useQuery({
    // Keyed to the season start date – fetches all seed credits from that date onward.
    queryKey: ['seasonSeedLeaderboard', comparisonFromDate || 'alltime'],
    enabled: statsComparisonScope === 'season' && !!comparisonFromDate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_weekly_seed_leaderboard', {
        p_limit: 100,
        p_from_date: comparisonFromDate,
      });
      if (error) {
        console.error('[AchievementsPage] get_weekly_seed_leaderboard (season) error:', error.code, error.message, error);
        if (isMissingRpcFunctionError(error)) {
          console.warn('[AchievementsPage] get_weekly_seed_leaderboard with p_from_date unavailable (ambiguous/missing).');
          return null;
        }
        throw error;
      }
      console.debug('[AchievementsPage] seasonSeedLeaderboard rows:', data?.length ?? 0, 'from:', comparisonFromDate);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: globalScanTaxonomyHighlights = null, refetch: refetchGlobalScanTaxonomyHighlights } = useQuery({
    queryKey: ['globalScanTaxonomyHighlights', comparisonFromDate || 'alltime'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_global_scan_taxonomy_highlights', {
        p_from_date: comparisonFromDate,
      });
      if (error) {
        if (isMissingRpcFunctionError(error)) {
          if (comparisonFromDate) {
            console.warn('[AchievementsPage] get_global_scan_taxonomy_highlights with p_from_date unavailable.');
            return null;
          }
          const legacyCall = await supabase.rpc('get_global_scan_taxonomy_highlights');
          if (legacyCall.error) {
            console.warn('[AchievementsPage] legacy get_global_scan_taxonomy_highlights unavailable.');
            return null;
          }
          if (Array.isArray(legacyCall.data)) return legacyCall.data[0] || null;
          return legacyCall.data || null;
        }
        throw error;
      }
      if (Array.isArray(data)) return data[0] || null;
      return data || null;
    },
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

    // Resolve logos for all profiles
    const leaderboardLogosByEmail = useMemo(() => {
      const logosByEmail = new Map();
      (allProfiles || []).forEach((profile) => {
        const email = String(profile.user_email || "").toLowerCase();
        if (email) {
          const equippedLogos = resolveEquippedLogoAssetsWithCatalog(profile, logoAssets);
          logosByEmail.set(email, equippedLogos);
        }
      });
      return logosByEmail;
    }, [allProfiles, logoAssets]);

  // Beim Oeffnen der Statistik-Bestenliste immer harte Aktualisierung ausfuehren.
  useEffect(() => {
    if (achievementsView !== "leaderboard") return;

    let cancelled = false;

    const refreshLeaderboardData = async () => {
      setIsLeaderboardRefreshing(true);
      try {
        await Promise.all([
          refetchAllDiscoveries(),
          refetchAllProfiles(),
          refetchAllRobotPlants(),
          refetchGlobalScanLeaderboard(),
          refetchWeeklySeedLeaderboard(),
          refetchSeasonSeedLeaderboard(),
          refetchHighestScanResultsLeaderboard(),
          refetchGlobalScanTaxonomyHighlights(),
          ...(user?.email ? [refetchAllFriendRecords()] : []),
        ]);
      } catch (error) {
        console.error('[AchievementsPage] Error while refreshing leaderboard data:', error);
      } finally {
        if (!cancelled) {
          setIsLeaderboardRefreshing(false);
        }
      }
    };

    refreshLeaderboardData();

    return () => {
      cancelled = true;
    };
  }, [
    achievementsView,
    refetchAllDiscoveries,
    refetchAllProfiles,
    refetchAllRobotPlants,
    refetchGlobalScanLeaderboard,
    refetchWeeklySeedLeaderboard,
    refetchSeasonSeedLeaderboard,
    refetchGlobalScanTaxonomyHighlights,
    refetchAllFriendRecords,
    user?.email,
  ]);

  // Echtzeit-Subscriptions für UserAchievements
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = Query.UserAchievement.subscribe((event) => {
      if (event.data?.auth_id === user.id || event.data?.created_by === user.email) {
        queryClient.invalidateQueries({ queryKey: ['userAchievements'] });
      }
    });

    return unsubscribe;
  }, [user?.email]);

  // Echtzeit-Subscriptions für UserQuests
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = Query.UserQuest.subscribe((event) => {
      if (event.data?.auth_id === user.id || event.data?.created_by === user.email) {
        queryClient.invalidateQueries({ queryKey: ['userQuests'] });
      }
    });

    return unsubscribe;
  }, [user?.email]);

  // Echtzeit-Subscriptions für UserWeeklyQuests
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = Query.UserWeeklyQuest.subscribe((event) => {
      if (event.data?.auth_id === user.id || event.data?.created_by === user.email) {
        queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
      }
    });

    return unsubscribe;
  }, [user?.email]);

  // Echtzeit-Subscriptions für UserMonthlyQuests
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = Query.UserMonthlyQuest.subscribe((event) => {
      if (event.data?.auth_id === user.id || event.data?.created_by === user.email) {
        queryClient.invalidateQueries({ queryKey: ['userMonthlyQuests'] });
      }
    });

    return unsubscribe;
  }, [user?.email]);

  // Echtzeit-Subscriptions für UserCollectionQuests
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = Query.UserCollectionQuest.subscribe((event) => {
      if (event.data?.auth_id === user.id || event.data?.created_by === user.email) {
        queryClient.invalidateQueries({ queryKey: ['userCollectionQuests'] });
      }
    });

    return unsubscribe;
  }, [user?.email]);

  // Echtzeit-Subscriptions für UserPlantDiscovery
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = Query.UserPlantDiscovery.subscribe((event) => {
      if (event.data?.auth_id === user.id || event.data?.created_by === user.email || event.data?.user === user.email) {
        queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
      }
    });

    return unsubscribe;
  }, [user?.email]);

  const updateTitleMutation = useMutation({
    mutationFn: (title) => updateCurrentUserProfile({ selected_title: title }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['shopCurrentUser'] });
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (typeof onUserUpdated === "function") {
        onUserUpdated(currentUser);
      }
      setShowTitleDialog(false);
    }
  });

  // Quest Mutations
  // Insert-Guard: Insert nur einmal pro Seite
  const [hasInserted, setHasInserted] = useState(false);
  const acceptQuestMutation = useMutation({
    mutationFn: async ({ questId, questType, activeWeek, activeMonth }) => {
      if (hasInserted) {
        console.warn('[UserQuest] Insert skipped: already inserted on this page load.');
        return;
      }
      setHasInserted(true);
      const now = new Date().toISOString();
      let insertData;
      if (questType === 'regular') {
        const existing = await Query.UserQuest.filter({ auth_id: user.id, quest_id: questId });
        if (existing && existing.length > 0) {
          console.log('[UserQuest] Accept regular skipped, existing row found:', existing[0]);
          return existing[0];
        }
        insertData = {
          quest_id: questId,
          auth_id: user.id,
          created_by: user.email,
          // New status-based model
          status: 'active',
          accepted_at: now,
          // Legacy flags for backwards compatibility
          accepted: true,
          accepted_date: now
        };
        console.log('[UserQuest] Insert regular:', insertData);
        try {
          return await Query.UserQuest.create(insertData);
        } catch (err) {
          console.error('[UserQuest] Insert regular failed:', err, insertData);
          throw err;
        }
      } else if (questType === 'weekly') {
        const existing = await Query.UserWeeklyQuest.filter({ auth_id: user.id, weekly_quest_id: questId, active_week: activeWeek });
        if (existing && existing.length > 0) {
          console.log('[UserQuest] Accept weekly skipped, existing row found:', existing[0]);
          return existing[0];
        }
        insertData = {
          weekly_quest_id: questId,
          active_week: activeWeek,
          auth_id: user.id,
          created_by: user.email,
          status: 'active',
          accepted_at: now,
          accepted: true,
          accepted_date: now
        };
        console.log('[UserQuest] Insert weekly:', insertData);
        try {
          return await Query.UserWeeklyQuest.create(insertData);
        } catch (err) {
          console.error('[UserQuest] Insert weekly failed:', err, insertData);
          throw err;
        }
      } else if (questType === 'monthly') {
        const existing = await Query.UserMonthlyQuest.filter({ auth_id: user.id, monthly_quest_id: questId, active_month: activeMonth });
        if (existing && existing.length > 0) {
          console.log('[UserQuest] Accept monthly skipped, existing row found:', existing[0]);
          return existing[0];
        }
        insertData = {
          monthly_quest_id: questId,
          active_month: activeMonth,
          auth_id: user.id,
          created_by: user.email,
          status: 'active',
          accepted_at: now,
          accepted: true,
          accepted_date: now
        };
        console.log('[UserQuest] Insert monthly:', insertData);
        try {
          return await Query.UserMonthlyQuest.create(insertData);
        } catch (err) {
          console.error('[UserQuest] Insert monthly failed:', err, insertData);
          throw err;
        }
      } else if (questType === 'collection') {
        const existing = await Query.UserCollectionQuest.filter({ auth_id: user.id, collection_quest_id: questId });
        if (existing && existing.length > 0) {
          console.log('[UserQuest] Accept collection skipped, existing row found:', existing[0]);
          return existing[0];
        }
        insertData = {
          collection_quest_id: questId,
          auth_id: user.id,
          created_by: user.email,
          status: 'active',
          accepted_at: now,
          accepted: true,
          accepted_date: now
        };
        console.log('[UserQuest] Insert collection:', insertData);
        try {
          return await Query.UserCollectionQuest.create(insertData);
        } catch (err) {
          console.error('[UserQuest] Insert collection failed:', err, insertData);
          throw err;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userMonthlyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userCollectionQuests'] });
    }
  });

  const redeemQuestMutation = useMutation({
		  mutationFn: async ({ userQuestId, questType, rewardName, seedReward, isFirstQuest, questTitle }) => {
      console.log('[QuestRedeem] Starting redeem for:', questType, rewardName);
      const now = new Date().toISOString();
      const questSeedReward = resolveQuestSeedReward({ questType, seedReward });

      const currentUser = await getCurrentUser();

      // ── 1. Quest-Status als erstes auf 'redeemed' setzen ──────────────────
      // Wichtig: Status-Update VOR dem Seed-Grant, damit die Quest immer als
      // eingeloest gilt – auch wenn der Seed-Grant später fehlschlägt.
      if (questType === 'regular') {
        await Query.UserQuest.update(userQuestId, {
          redeemed: true,
          redeemed_date: now,
          status: 'redeemed'
        });
      } else if (questType === 'weekly') {
        await Query.UserWeeklyQuest.update(userQuestId, {
          redeemed: true,
          redeemed_date: now,
          status: 'redeemed'
        });
      } else if (questType === 'monthly') {
        await Query.UserMonthlyQuest.update(userQuestId, {
          redeemed: true,
          redeemed_date: now,
          status: 'redeemed'
        });
      } else if (questType === 'collection') {
        await Query.UserCollectionQuest.update(userQuestId, {
          redeemed: true,
          redeemed_date: now,
          status: 'redeemed'
        });
      }

      // ── 2. Samen gutschreiben (idempotent, Fehler blockieren nicht die UI) ─
      let grantedBalance = NaN;
      let grantedEnergy = NaN;
      let grantedDataQuality = NaN;
      let grantedCare = NaN;
      try {
        const grantResult = await grantRobotPlantRewardServerSide({
          eventSource: `quest_redeem_${questType}`,
          eventReference: `${questType}:${userQuestId}`,
          amount: questSeedReward,
          metadata: {
            quest_type: questType,
            quest_title: questTitle,
            redeemed_at: now,
            reward_source: "quest",
          },
        });
        grantedBalance = Number(grantResult?.result?.new_balance ?? grantResult?.result?.newBalance);
        grantedEnergy = Number(grantResult?.result?.new_energy ?? grantResult?.result?.newEnergy);
        grantedDataQuality = Number(grantResult?.result?.new_data_quality ?? grantResult?.result?.newDataQuality);
        grantedCare = Number(grantResult?.result?.new_care ?? grantResult?.result?.newCare);
      } catch (seedGrantError) {
        console.warn('[QuestRedeem] Seed grant failed (quest already marked redeemed):', seedGrantError?.message || seedGrantError);
      }

      if (currentUser?.id) {
        queryClient.setQueryData(['robotPlantState', currentUser.id], (previousState) => {
          const safePreviousState =
            previousState && typeof previousState === 'object'
              ? previousState
              : { auth_id: currentUser.id };

          return {
            ...safePreviousState,
            ...(Number.isFinite(grantedBalance) ? { wallet_balance: grantedBalance } : {}),
            ...(Number.isFinite(grantedEnergy) ? { energy: grantedEnergy } : {}),
            ...(Number.isFinite(grantedDataQuality) ? { data_quality: grantedDataQuality } : {}),
            ...(Number.isFinite(grantedCare) ? { care: grantedCare } : {}),
          };
        });
      }

      // ── 3. Quest-typ-spezifische Bonuses (alle im try/catch) ──────────────
      if (questType === 'weekly') {
        // Weekly quest bonus: +10 seeds on redeem (separate from the base seed reward).
        try {
          await grantRobotPlantRewardServerSide({
            eventSource: 'weekly_quest_bonus',
            eventReference: `weekly_quest_bonus:${userQuestId}`,
            amount: 10,
            metadata: {
              quest_type: 'weekly',
              quest_title: questTitle,
              redeemed_at: now,
              source: 'quest_weekly_bonus',
            },
          });
        } catch (weeklyBonusError) {
          console.warn('[QuestRedeem] Weekly seed bonus could not be granted:', weeklyBonusError?.message || weeklyBonusError);
        }
      } else if (questType === 'monthly') {
        // Monthly quest bonus: +15 sparks on redeem.
        try {
          await grantWalletCurrency({
            authId: currentUser.id,
            currencyCode: 'sparks',
            eventSource: 'monthly_quest_redeem_spark',
            eventReference: `monthly:${userQuestId}`,
            amount: 15,
            direction: 'credit',
            metadata: {
              quest_type: 'monthly',
              redeemed_at: now,
              source: 'quest_redeem',
            },
          });
        } catch (sparkError) {
          console.warn('[QuestRedeem] Monthly spark bonus could not be granted:', sparkError?.message || sparkError);
        }
      }
      
      // DIREKT den Reward freischalten (ohne Achievement-Check) – Fehler hier sollen die Einlösung nicht blockieren
      try {
        if (rewardName) {
          const reward = rewards.find(r => r.name === rewardName);
          if (reward) {
            console.log('[QuestRedeem] Unlocking reward:', reward.name, reward.display_name);
            
            // Prüfe ob User den Reward bereits hat
            const userRewards = await Query.UserReward.filter({ auth_id: currentUser.id });
            const hasReward = userRewards.some(ur => ur.reward_id === reward.id);
            
            if (!hasReward) {
              // Schalte Reward frei
              await Query.UserReward.create({
                reward_id: reward.id,
                reward_name: reward.display_name,
                auth_id: currentUser.id,
                user_email: currentUser.email,
                user_name: currentUser.display_name || currentUser.full_name || currentUser.email,
                unlocked_date: now
              });

              // Früher wurde hier eine persistente UserNotification im Banner-Stil erstellt.
              // Feedback für Rewards wird jetzt über das Quest-Feedback-Overlay gehandhabt.
            } else {
              console.log('[QuestRedeem] User already has reward:', reward.name);
            }
          }
        }
      } catch (error) {
        console.error("[QuestRedeem] Fehler beim Freischalten des Rewards:", error);
      }
      
      // Wenn das die erste Quest ist, erstelle eine Notification für Hintergrund-Personalisierung
      if (isFirstQuest) {
        try {
          await createUserNotification({
            authId: currentUser.id,
            userEmail: currentUser.email,
            notificationType: "custom",
            ...buildNotificationPayload("firstQuestCompleted"),
            actionUrl: "Profile",
            priority: "high",
            displayLocation: "modal",
            createdBy: currentUser.email,
          });
        } catch (error) {
          console.error("[QuestRedeem] Fehler beim Erstellen der Hintergrund-Notification:", error);
        }
      }

      // Setze lokales Quest-Feedback, das als zentriertes Overlay angezeigt wird
      const bonusRewardLabel = rewardName
        ? (rewards.find(r => r.name === rewardName)?.display_name || rewardName)
        : null;
      // Weekly quests get an extra +10 seed bonus on top of the base seed reward.
      const weeklyBonusSeeds = questType === 'weekly' ? 10 : 0;
      const totalSeedReward = questSeedReward + weeklyBonusSeeds;
      const seedRewardLabel = weeklyBonusSeeds > 0
        ? `${questSeedReward} + ${weeklyBonusSeeds} Samen`
        : `${questSeedReward} Samen`;
      const rewardLabel = bonusRewardLabel ? `${seedRewardLabel} + ${bonusRewardLabel}` : seedRewardLabel;

      navigate(location.pathname + location.search, {
        state: {
          ...(location.state || {}),
          questFeedback: {
            type: "questCompleted",
            questTitle,
            rewardName: rewardLabel,
            seedReward: totalSeedReward,
          },
        },
      });
      
      console.log('[QuestRedeem] Finished successfully');
      return "Quest abgeschlossen!";
    },
    onSuccess: async (reward) => {
      queryClient.invalidateQueries({ queryKey: ['userQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userMonthlyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userCollectionQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userAchievements'] });
      queryClient.invalidateQueries({ queryKey: ['robotPlantState'] });
      queryClient.invalidateQueries({ queryKey: ['userWallet'] });

      // User neu laden
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    }
  });

  const handleSelectTitle = (achievement, reward) => {
    setSelectedAchievement({ ...achievement, selectedReward: reward });
    setShowTitleDialog(true);
  };

  const confirmTitleSelection = () => {
    const normalizedTitle = resolveTitleValue(
      selectedAchievement?.selectedReward?.value,
      selectedAchievement?.selectedReward?.display_name
    );
    if (normalizedTitle) {
      updateTitleMutation.mutate(normalizedTitle);
    }
  };

  const unlockedCount = achievements.filter((a) =>
    userAchievements.some((ua) => ua.achievement_id === a.id)
  ).length;

  useEffect(() => {
    if (!embedded || typeof onHeaderMetaChange !== "function") return;
    const titleMap = {
      null: "Erfolge",
      leaderboard_scope: "Rangliste",
      leaderboard: statsComparisonScope === "season" ? `Rangliste · ${activeSeason?.title || "Saison"}` : "Rangliste · All-Time",
      quests: "Aufgaben",
      achievements: "Vergleiche",
    };
    const backHandler = achievementsView !== null
      ? () => {
          if (achievementsView === "leaderboard") {
            setAchievementsView("leaderboard_scope");
          } else {
            setAchievementsView(null);
          }
        }
      : null;
    onHeaderMetaChange({
      title: titleMap[achievementsView] ?? "Erfolge",
      subtitle: achievementsView === "leaderboard" ? "Scan-Insights und globaler Vergleich" : "Dein Fortschritt im Überblick",
      backHandler,
    });
  }, [
    embedded,
    onHeaderMetaChange,
    achievementsView,
    statsComparisonScope,
    activeSeason,
  ]);

  if (!user) {
    return (
      <div className={embedded ? "flex h-full min-h-0 items-center justify-center bg-transparent" : "flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50"}>
        <Leaf className={`w-12 h-12 animate-spin ${embedded ? (isLightUi ? "text-emerald-700" : "text-[#f0e5a5]") : "text-green-600"}`} />
      </div>);

  }

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case "Ungewöhnlich":return "bg-green-500";
      case "Selten":return "bg-blue-500";
      case "Episch":return "bg-purple-500";
      case "Legendär":return "bg-amber-500";
      default:return "bg-gray-500";
    }
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
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 100;
  };

  // Overlay für Quest-/Reward-Feedback (ScanFeedback-Style)
  const renderQuestFeedbackOverlay = () => (
    <AnimatePresence>
      {questFeedback && (
        <ScanFeedbackNotification
          feedback={questFeedback}
          shareSnapshotBackgroundImageUrl={user?.background_image_url || null}
          shareSnapshotBackgroundColor={user?.background_color || null}
          onComplete={() => {
            const seedReward = Math.max(0, Number(questFeedback?.seedReward ?? 0));
            if (questFeedback?.type === "questCompleted" && seedReward > 0) {
              window.setTimeout(() => {
                setSeedRewardFeedback({
                  amount: Math.round(seedReward),
                  questTitle: questFeedback?.questTitle || null,
                });
              }, 180);
            }
            setQuestFeedback(null);
          }}
        />
      )}
    </AnimatePresence>
  );

  const renderSeedRewardOverlay = () => (
    <AnimatePresence>
      {seedRewardFeedback && (
        <QuestSeedRewardNotification
          reward={seedRewardFeedback}
          onComplete={() => setSeedRewardFeedback(null)}
        />
      )}
    </AnimatePresence>
  );

  // Rarität-Wert für Sortierung
  const getRarityValue = (rarity) => {
    switch (rarity) {
      case "Ungewöhnlich":return 1;
      case "Selten":return 2;
      case "Episch":return 3;
      case "Legendär":return 4;
      default:return 0; // Default for unknown rarities, puts them at the beginning
    }
  };

  // Sortiere Achievements: zuerst freigeschaltet, danach gesperrt.
  // Innerhalb der Gruppen bleibt die Reihenfolge nach Rarität und Achievement-Nummer stabil.
  const sortedAchievements = [...achievements].sort((a, b) => {
    const aUnlocked = userAchievements.some((ua) => ua.achievement_id === a.id);
    const bUnlocked = userAchievements.some((ua) => ua.achievement_id === b.id);

    if (aUnlocked !== bUnlocked) {
      return aUnlocked ? -1 : 1;
    }

    const rarityDelta = getRarityValue(a.rarity) - getRarityValue(b.rarity);
    if (rarityDelta !== 0) {
      return rarityDelta;
    }

    return Number(a.achievement_number || 0) - Number(b.achievement_number || 0);
  });

  const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);

  const currentMonthlyQuest = getCurrentMonthlyQuest(monthlyQuests);

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

  const isRedeemedStatus = (uq) => {
    if (!uq) return false;
    if (uq.status) {
      return uq.status === 'redeemed';
    }
    return !!uq.redeemed;
  };

  // Reguläre Quests (angenommen & nicht eingelöst)
  const activeRegularQuests = quests.
  filter((q) => {
    const userQuest = userQuests.find((uq) => uq.quest_id === q.id);
    return isActiveOrCompleted(userQuest) && !(userQuest?.status === 'redeemed' || userQuest?.redeemed);
  }).
  map((q) => {
    const userQuest = userQuests.find((uq) => uq.quest_id === q.id);
    const reward = rewards.find(r => r.name === q.reward_name);
    const seedReward = resolveQuestSeedReward({ questType: 'regular', seedReward: q.seed_reward });
    const rewardDisplayName = reward?.display_name ? `${seedReward} Samen + ${reward.display_name}` : `${seedReward} Samen`;
    return {
      ...q,
      userQuestId: userQuest?.id,
      progress: userQuest?.progress || 0,
      isCompleted: isCompletedStatus(userQuest),
      type: 'regular',
      seedReward,
      rewardDisplayName,
      rewardData: reward,
      canRedeem: isCompletedStatus(userQuest) && !isRedeemedStatus(userQuest)
    };
  });

  // Abgeschlossene & eingelöste reguläre Quests (Historie)
  const completedRegularQuests = quests.
  filter((q) => {
    const userQuest = userQuests.find((uq) => uq.quest_id === q.id);
    return isCompletedStatus(userQuest) && isRedeemedStatus(userQuest);
  }).
  map((q) => {
    const userQuest = userQuests.find((uq) => uq.quest_id === q.id);
    const reward = rewards.find(r => r.name === q.reward_name);
    const seedReward = resolveQuestSeedReward({ questType: 'regular', seedReward: q.seed_reward });
    const rewardDisplayName = reward?.display_name ? `${seedReward} Samen + ${reward.display_name}` : `${seedReward} Samen`;
    return {
      ...q,
      userQuestId: userQuest?.id,
      progress: userQuest?.progress || q.required_discoveries || 0,
      isCompleted: true,
      type: 'regular',
      seedReward,
      rewardDisplayName,
      rewardData: reward,
      canRedeem: false,
      completedAt: userQuest?.redeemed_date || userQuest?.completed_date
    };
  });

  // Wöchentliche Quest
  // Priorisierung: abgeschlossen-aber-nicht-eingeloest (beliebige Woche) > aktuell aktive Woche
  const redeemableWeeklyUserQuest = userWeeklyQuests.find(
    (uwq) => isCompletedStatus(uwq) && !isRedeemedStatus(uwq)
  ) ?? null;
  const currentWeeklyUserQuest = redeemableWeeklyUserQuest
    ? redeemableWeeklyUserQuest
    : currentWeeklyQuest
      ? userWeeklyQuests.find((uwq) => uwq.weekly_quest_id === currentWeeklyQuest.id)
      : null;
  // Wenn eine aeltere abgeschlossene Quest angezeigt wird, brauchen wir auch die Quest-Details dazu
  const displayedWeeklyQuest = redeemableWeeklyUserQuest
    ? (weeklyQuests.find((wq) => wq.id === redeemableWeeklyUserQuest.weekly_quest_id) ?? currentWeeklyQuest)
    : currentWeeklyQuest;
  const weeklyReward = displayedWeeklyQuest ? rewards.find(r => r.name === displayedWeeklyQuest.reward_name) : null;
  const weeklySeedReward = displayedWeeklyQuest
    ? resolveQuestSeedReward({ questType: 'weekly', seedReward: displayedWeeklyQuest.seed_reward })
    : resolveQuestSeedReward({ questType: 'weekly', seedReward: null });
  const weeklyRewardDisplayName = weeklyReward?.display_name ? `${weeklySeedReward} Samen + ${weeklyReward.display_name}` : `${weeklySeedReward} Samen`;
  const activeWeeklyQuest = displayedWeeklyQuest && currentWeeklyUserQuest && isActiveOrCompleted(currentWeeklyUserQuest) && !(currentWeeklyUserQuest.status === 'redeemed' || currentWeeklyUserQuest.redeemed) ?
  {
    ...displayedWeeklyQuest,
    userQuestId: currentWeeklyUserQuest.id,
    progress: currentWeeklyUserQuest.progress || 0,
    isCompleted: isCompletedStatus(currentWeeklyUserQuest),
    type: 'weekly',
    seedReward: weeklySeedReward,
    rewardDisplayName: weeklyRewardDisplayName,
    rewardData: weeklyReward,
    canRedeem: isCompletedStatus(currentWeeklyUserQuest) && !isRedeemedStatus(currentWeeklyUserQuest)
  } :
  null;
  // Monatliche Quest
  const currentMonthlyUserQuest = currentMonthlyQuest ?
  userMonthlyQuests.find((umq) => umq.monthly_quest_id === currentMonthlyQuest.id) :
  null;
  const monthlyReward = currentMonthlyQuest ? rewards.find(r => r.name === currentMonthlyQuest.reward_name) : null;
  const monthlySeedReward = currentMonthlyQuest
    ? resolveQuestSeedReward({ questType: 'monthly', seedReward: currentMonthlyQuest.seed_reward })
    : resolveQuestSeedReward({ questType: 'monthly', seedReward: null });
  const monthlyRewardDisplayName = monthlyReward?.display_name ? `${monthlySeedReward} Samen + ${monthlyReward.display_name}` : `${monthlySeedReward} Samen`;
  const activeMonthlyQuest = currentMonthlyQuest && currentMonthlyUserQuest && isActiveOrCompleted(currentMonthlyUserQuest) && !(currentMonthlyUserQuest.status === 'redeemed' || currentMonthlyUserQuest.redeemed) ?
  {
    ...currentMonthlyQuest,
    userQuestId: currentMonthlyUserQuest.id,
    progress: currentMonthlyUserQuest.progress || 0,
    isCompleted: isCompletedStatus(currentMonthlyUserQuest),
    type: 'monthly',
    seedReward: monthlySeedReward,
    rewardDisplayName: monthlyRewardDisplayName,
    rewardData: monthlyReward,
    canRedeem: isCompletedStatus(currentMonthlyUserQuest) && !isRedeemedStatus(currentMonthlyUserQuest)
  } :
  null;
  // Abgeschlossene & eingelöste wöchentliche Quests (Historie)
  const completedWeeklyQuests = weeklyQuests.flatMap((quest) => {
    const reward = rewards.find(r => r.name === quest.reward_name);
    const seedReward = resolveQuestSeedReward({ questType: 'weekly', seedReward: quest.seed_reward });
    const rewardDisplayName = reward?.display_name ? `${seedReward} Samen + ${reward.display_name}` : `${seedReward} Samen`;
    const relatedUserQuests = userWeeklyQuests.filter((uwq) =>
      uwq.weekly_quest_id === quest.id &&
      isCompletedStatus(uwq) &&
      isRedeemedStatus(uwq)
    );

    return relatedUserQuests.map((uwq) => ({
      ...quest,
      userQuestId: uwq.id,
      progress: uwq.progress || 0,
      required_discoveries: quest.required_discoveries || 0,
      isCompleted: true,
      type: 'weekly',
      seedReward,
      rewardDisplayName,
      rewardData: reward,
      canRedeem: false,
      completedAt: uwq.redeemed_date || uwq.completed_date,
      active_week: uwq.active_week
    }));
  });

  // Abgeschlossene & eingelöste monatliche Quests (Historie)
  const completedMonthlyQuests = monthlyQuests.flatMap((quest) => {
    const reward = rewards.find(r => r.name === quest.reward_name);
    const seedReward = resolveQuestSeedReward({ questType: 'monthly', seedReward: quest.seed_reward });
    const rewardDisplayName = reward?.display_name ? `${seedReward} Samen + ${reward.display_name}` : `${seedReward} Samen`;
    const relatedUserQuests = userMonthlyQuests.filter((umq) =>
      umq.monthly_quest_id === quest.id &&
      isCompletedStatus(umq) &&
      isRedeemedStatus(umq)
    );

    return relatedUserQuests.map((umq) => ({
      ...quest,
      userQuestId: umq.id,
      progress: umq.progress || 0,
      required_discoveries: quest.required_discoveries || 0,
      isCompleted: true,
      type: 'monthly',
      seedReward,
      rewardDisplayName,
      rewardData: reward,
      canRedeem: false,
      completedAt: umq.redeemed_date || umq.completed_date,
      active_month: umq.active_month
    }));
  });

  // Zeige alle relevanten Quest-Typen gesammelt ohne Unterkategorie
  const activeQuests = [
    ...activeRegularQuests,
    ...(activeWeeklyQuest ? [activeWeeklyQuest] : []),
    ...(activeMonthlyQuest ? [activeMonthlyQuest] : []),
  ];
  const completedQuests = [
    ...completedRegularQuests,
    ...completedWeeklyQuests,
    ...completedMonthlyQuests,
  ];

  // Sortiere abgeschlossene Quests nach Abschlussdatum (neueste zuerst)
  completedQuests.sort((a, b) => {
    if (!a.completedAt || !b.completedAt) return 0;
    return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
  });

  const hasAnyQuestData = activeQuests.length > 0 || completedQuests.length > 0;

  // Prüfe ob es einlösbare Quests gibt
  const hasRedeemableQuests = activeQuests.some((q) => q.isCompleted);
  const showQuestNotification = hasRedeemableQuests;

  const buildNaturaDbSlug = (name) =>
    String(name || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  const NATURADB_BASE = "https://www.naturadb.de/pflanzen/";

  const buildQuestNaturaDbUrl = (speciesName) => {
    if (!speciesName) return null;
    const plant = plants.find((p) => p.species_name === speciesName);
    if (!plant) return null;
    if (plant.naturadb_url) return plant.naturadb_url;
    if (!plant.scientific_name) return null;
    const slug = buildNaturaDbSlug(plant.scientific_name);
    return slug ? `${NATURADB_BASE}${slug}/` : null;
  };

  const buildQuestGenusNaturaDbUrl = (genusName) => {
    if (!genusName) return null;
    const genus = (genera || []).find((g) => g.genus_name === genusName);
    if (!genus?.scientific_genus) return null;
    const slug = buildNaturaDbSlug(genus.scientific_genus);
    return slug ? `https://www.naturadb.de/suche/?q=${encodeURIComponent(genus.scientific_genus)}` : null;
  };

  const renderQuestTargetBadges = (quest) => {
    if (!quest) return null;
    if (!quest.target_species_name && !quest.target_genus_name) return null;
    const speciesUrl = buildQuestNaturaDbUrl(quest.target_species_name);
    const genusUrl = !quest.target_species_name ? buildQuestGenusNaturaDbUrl(quest.target_genus_name) : null;
    const badgeBase = `inline-flex items-center gap-0.5 border-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${questTargetBadgeClass}`;
    return (
      <div className="flex flex-wrap gap-1.5 mb-2">
        {quest.target_species_name && (
          speciesUrl ? (
            <a href={speciesUrl} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`${badgeBase} hover:opacity-80 transition-opacity cursor-pointer`}>
              🎯 Ziel: {quest.target_species_name} 🔗
            </a>
          ) : (
            <Badge variant="outline" className={`border-2 ${questTargetBadgeClass} font-bold`}>
              🎯 Ziel: {quest.target_species_name}
            </Badge>
          )
        )}
        {quest.target_genus_name && !quest.target_species_name && (
          genusUrl ? (
            <a href={genusUrl} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`${badgeBase} hover:opacity-80 transition-opacity cursor-pointer`}>
              🎯 Ziel: {quest.target_genus_name} 🔗
            </a>
          ) : (
            <Badge variant="outline" className={`border-2 ${questTargetBadgeClass} font-bold`}>
              🎯 Ziel: {quest.target_genus_name}
            </Badge>
          )
        )}
      </div>
    );
  };

  const ownEmailLower = user?.email?.toLowerCase() || "";
  const ownAuthId = user?.id || null;

  const discoveryDate = (entry) => {
    const raw = entry?.discovered_date;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const isInComparisonRange = (entry) => {
    const parsed = discoveryDate(entry);
    if (!parsed) return false;
    if (!comparisonDateFloor) return true;
    return parsed >= comparisonDateFloor;
  };

  const monthKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  const nowDate = new Date();
  const currentMonthKey = monthKey(nowDate);
  const previousMonthDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
  const previousMonthKey = monthKey(previousMonthDate);

  const ownDiscoveriesList = (userDiscoveries || []).filter((entry) => isInComparisonRange(entry));
  const filteredAllDiscoveries = (allDiscoveries || []).filter((entry) => isInComparisonRange(entry));
  const totalScans = ownDiscoveriesList.length;

  const speciesCountMap = new Map();
  const genusCountMap = new Map();
  const scanMonthCountMap = new Map();
  const activeDaysSet = new Set();

  ownDiscoveriesList.forEach((entry) => {
    const plant = plants.find((plantItem) => plantItem.id === entry.plant_id);
    if (plant?.species_name) {
      speciesCountMap.set(plant.species_name, (speciesCountMap.get(plant.species_name) || 0) + 1);
    }
    if (plant) {
      const genus = genera.find(
        (genusItem) =>
          genusItem.category === plant.genus_category &&
          genusItem.category_dex_number === plant.genus_number
      );
      if (genus?.genus_name) {
        genusCountMap.set(genus.genus_name, (genusCountMap.get(genus.genus_name) || 0) + 1);
      }
    }

    const parsed = discoveryDate(entry);
    if (parsed) {
      scanMonthCountMap.set(monthKey(parsed), (scanMonthCountMap.get(monthKey(parsed)) || 0) + 1);
      activeDaysSet.add(parsed.toISOString().slice(0, 10));
    }
  });

  const topSpeciesEntry = Array.from(speciesCountMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;
  const topGenusEntry = Array.from(genusCountMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;
  const currentMonthScans = scanMonthCountMap.get(currentMonthKey) || 0;
  const previousMonthScans = scanMonthCountMap.get(previousMonthKey) || 0;
  const monthTrendDelta = currentMonthScans - previousMonthScans;

  const acceptedFriendEmailsLower = new Set();
  (allFriendRecords || []).forEach((record) => {
    if (record.status !== "accepted") return;
    const sentBy = record.request_sent_by?.toLowerCase();
    const sentTo = record.request_sent_to?.toLowerCase();
    if (!sentBy || !sentTo || !ownEmailLower) return;

    if (sentBy === ownEmailLower) {
      acceptedFriendEmailsLower.add(sentTo);
    }
    if (sentTo === ownEmailLower) {
      acceptedFriendEmailsLower.add(sentBy);
    }
  });

  const profileByEmail = new Map(
    (allProfiles || [])
      .filter((profile) => !!profile.user_email)
      .map((profile) => [profile.user_email.toLowerCase(), profile])
  );

  const socialEmailSet = new Set([ownEmailLower, ...Array.from(acceptedFriendEmailsLower)]);
  const socialScanCounts = new Map();

  filteredAllDiscoveries.forEach((entry) => {
    const email = (entry.user || entry.created_by || entry.user_email || "").toLowerCase();
    const entryAuth = entry.auth_id || null;
    const isOwnByAuth = !!ownAuthId && !!entryAuth && ownAuthId === entryAuth;
    const isOwnByEmail = !!ownEmailLower && ownEmailLower === email;

    let participantKey = "";
    if (isOwnByAuth || isOwnByEmail) {
      participantKey = ownEmailLower;
    } else if (socialEmailSet.has(email)) {
      participantKey = email;
    }

    if (!participantKey || !discoveryDate(entry)) return;
    socialScanCounts.set(participantKey, (socialScanCounts.get(participantKey) || 0) + 1);
  });

  const socialRanking = Array.from(socialScanCounts.entries())
    .map(([email, scans]) => {
      const profile = profileByEmail.get(email);
      return {
        email,
        scans,
        name:
          profile?.display_name ||
          profile?.full_name ||
          (email === ownEmailLower ? (user?.display_name || user?.full_name || user?.email) : email),
      };
    })
    .sort((a, b) => b.scans - a.scans);

  const ownRank = socialRanking.findIndex((entry) => entry.email === ownEmailLower) + 1;

  // Globales Scan-Ranking: alle Nutzer aus allDiscoveries (nicht nur Freunde)
  const globalScanCounts = new Map();
  filteredAllDiscoveries.forEach((entry) => {
    const email = (entry.user || entry.created_by || entry.user_email || "").toLowerCase();
    const entryAuth = entry.auth_id || null;
    const isOwnByAuth = !!ownAuthId && !!entryAuth && ownAuthId === entryAuth;
    const isOwnByEmail = !!ownEmailLower && ownEmailLower === email;

    let participantKey = "";
    if (isOwnByAuth || isOwnByEmail) {
      participantKey = ownEmailLower;
    } else if (email) {
      participantKey = email;
    }

    if (!participantKey || !discoveryDate(entry)) return;
    globalScanCounts.set(participantKey, (globalScanCounts.get(participantKey) || 0) + 1);
  });

  const globalScanRanking = Array.from(globalScanCounts.entries())
    .map(([email, scans]) => {
      const profile = profileByEmail.get(email);
      return {
        email,
        scans,
        name:
          profile?.display_name ||
          profile?.full_name ||
          (email === ownEmailLower ? (user?.display_name || user?.full_name || user?.email) : email),
      };
    })
    .sort((a, b) => b.scans - a.scans);

  const rpcGlobalScanRanking = (globalScanLeaderboard || [])
    .map((entry) => {
      const email = String(entry?.user_email || '').trim().toLowerCase();
      const entryAuthId = entry?.auth_id || null;
      const isOwnByAuth = !!ownAuthId && !!entryAuthId && ownAuthId === entryAuthId;
      const isOwnByEmail = !!ownEmailLower && !!email && ownEmailLower === email;
      const participantEmail = isOwnByAuth ? ownEmailLower : email;

      return {
        email: participantEmail,
        scans: Number(entry?.scan_count ?? 0),
        name:
          entry?.display_name ||
          entry?.full_name ||
          (isOwnByAuth || isOwnByEmail
            ? (user?.display_name || user?.full_name || user?.email)
            : (participantEmail || 'Unbekannt')),
      };
    })
    .filter((entry) => !!entry.email && Number(entry.scans) > 0)
    .sort((a, b) => b.scans - a.scans);

  const effectiveGlobalScanRanking = rpcGlobalScanRanking.length > 0 ? rpcGlobalScanRanking : globalScanRanking;

  const ownGlobalScanRank = effectiveGlobalScanRanking.findIndex((entry) => entry.email === ownEmailLower) + 1;

  const plantById = new Map((plants || []).map((plant) => [plant.id, plant]));
  const genusNameByKey = new Map(
    (genera || []).map((genus) => [`${genus.category}:${genus.category_dex_number}`, genus.genus_name])
  );

  const globalSpeciesCountMap = new Map();
  const globalGenusCountMap = new Map();

  filteredAllDiscoveries.forEach((entry) => {
    const plant = plantById.get(entry.plant_id);
    if (!plant) return;

    if (plant.species_name) {
      globalSpeciesCountMap.set(plant.species_name, (globalSpeciesCountMap.get(plant.species_name) || 0) + 1);
    }

    const genusKey = `${plant.genus_category}:${plant.genus_number}`;
    const genusName = genusNameByKey.get(genusKey);
    if (genusName) {
      globalGenusCountMap.set(genusName, (globalGenusCountMap.get(genusName) || 0) + 1);
    }
  });

  const fallbackGlobalTopSpeciesEntry =
    Array.from(globalSpeciesCountMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;
  const fallbackGlobalTopGenusEntry =
    Array.from(globalGenusCountMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;

  const globalTopSpeciesName =
    String(globalScanTaxonomyHighlights?.top_species_name || '').trim() || fallbackGlobalTopSpeciesEntry?.[0] || null;
  const globalTopSpeciesCount =
    Number(globalScanTaxonomyHighlights?.top_species_count ?? 0) > 0
      ? Number(globalScanTaxonomyHighlights.top_species_count)
      : Number(fallbackGlobalTopSpeciesEntry?.[1] ?? 0);
  const globalTopGenusName =
    String(globalScanTaxonomyHighlights?.top_genus_name || '').trim() || fallbackGlobalTopGenusEntry?.[0] || null;
  const globalTopGenusCount =
    Number(globalScanTaxonomyHighlights?.top_genus_count ?? 0) > 0
      ? Number(globalScanTaxonomyHighlights.top_genus_count)
      : Number(fallbackGlobalTopGenusEntry?.[1] ?? 0);

  const highestScanResultsRanking = (highestScanResultsLeaderboard || [])
    .map((entry) => {
      const email = String(entry?.user_email || "").trim().toLowerCase();
      const entryAuthId = entry?.auth_id || null;
      const isOwnByAuth = !!ownAuthId && !!entryAuthId && ownAuthId === entryAuthId;
      const isOwnByEmail = !!ownEmailLower && !!email && ownEmailLower === email;
      const participantEmail = isOwnByAuth ? ownEmailLower : email;
      const profile = participantEmail ? profileByEmail.get(participantEmail) : null;
      const parsedAwardedAt = entry?.awarded_at ? new Date(entry.awarded_at) : null;
      const hasValidAwardedAt = !!parsedAwardedAt && !Number.isNaN(parsedAwardedAt.getTime());
      const parseMultiplier = (value) => {
        const parsedValue = Number(value);
        return Number.isFinite(parsedValue) ? parsedValue : null;
      };
      const scanDetailKey = `${entryAuthId || participantEmail || 'unknown'}:${entry?.event_reference || ''}:${entry?.awarded_at || ''}`;

      return {
        authId: entryAuthId,
        email: participantEmail,
        rewardAmount: Math.max(0, Number(entry?.reward_amount ?? 0)),
        eventSource: String(entry?.event_source || ""),
        eventReference: String(entry?.event_reference || ""),
        awardedAt: entry?.awarded_at || null,
        formattedAwardedAt: hasValidAwardedAt ? format(parsedAwardedAt, "dd.MM.yyyy", { locale: de }) : null,
        scanStatus: String(entry?.scan_status || '').trim() || String(entry?.event_source || ''),
        plantSpeciesName: String(entry?.plant_species_name || '').trim() || null,
        plantCommonName: String(entry?.plant_common_name || '').trim() || null,
        zoneMultiplier: parseMultiplier(entry?.zone_multiplier),
        rarityMultiplier: parseMultiplier(entry?.rarity_multiplier),
        noveltyMultiplier: parseMultiplier(entry?.novelty_multiplier),
        careMultiplier: parseMultiplier(entry?.care_multiplier),
        streakMultiplier: parseMultiplier(entry?.streak_multiplier),
        firstScanOfDayMultiplier: parseMultiplier(entry?.first_scan_of_day_multiplier),
        tileClaimMultiplier: parseMultiplier(entry?.tile_claim_multiplier),
        preTileClaimReward: Math.max(0, Number(entry?.pre_tile_claim_reward ?? 0)),
        detailKey: scanDetailKey,
        name:
          profile?.display_name ||
          profile?.full_name ||
          entry?.display_name ||
          entry?.full_name ||
          (isOwnByAuth || isOwnByEmail
            ? (user?.display_name || user?.full_name || user?.email)
            : (participantEmail || "Unbekannt")),
      };
    })
    .filter((entry) => Number(entry.rewardAmount) > 0)
    .sort((a, b) => {
      if (b.rewardAmount !== a.rewardAmount) return b.rewardAmount - a.rewardAmount;
      return String(b.awardedAt || "").localeCompare(String(a.awardedAt || ""));
    });

  const ownHighestScanResultRank = highestScanResultsRanking.findIndex((entry) => entry.email === ownEmailLower) + 1;
  const ownHighestScanResultEntry = ownHighestScanResultRank > 0 ? highestScanResultsRanking[ownHighestScanResultRank - 1] : null;

  const resolveScanEventLabel = (eventSource) => {
    if (eventSource === "new_global_scan") return "Neuer Global-Scan";
    if (eventSource === "new_scan") return "Neuer Scan";
    return "Scan";
  };

  const resolveScanStatusLabel = (scanStatus) => {
    const normalized = String(scanStatus || "").trim().toLowerCase();
    if (normalized === "new_global_scan") return "Global neu";
    if (normalized === "new_scan") return "Neu fuer dich";
    if (normalized === "scan") return "Wiederholungs-Scan";
    return normalized || "Unbekannt";
  };

  const formatMultiplierValue = (value) => {
    if (!Number.isFinite(value)) return null;
    return `x${Number(value).toFixed(2)}`;
  };

  const getMultiplierChips = (entry) => {
    const candidates = [
      ["Zone", entry.zoneMultiplier],
      ["Seltenheit", entry.rarityMultiplier],
      ["Neuheit", entry.noveltyMultiplier],
      ["Pflege", entry.careMultiplier],
      ["Streak", entry.streakMultiplier],
      ["Erster Scan/Tag", entry.firstScanOfDayMultiplier],
      ["Tile", entry.tileClaimMultiplier],
    ];

    return candidates
      .map(([label, value]) => {
        const formattedValue = formatMultiplierValue(value);
        if (!formattedValue) return null;
        return `${label} ${formattedValue}`;
      })
      .filter(Boolean);
  };

  const emailByAuthIdFromDiscoveries = new Map();
  filteredAllDiscoveries.forEach((entry) => {
    const authId = entry?.auth_id || null;
    const email = String(entry?.user || entry?.created_by || entry?.user_email || "").trim().toLowerCase();
    if (!authId || !email || emailByAuthIdFromDiscoveries.has(authId)) return;
    emailByAuthIdFromDiscoveries.set(authId, email);
  });

  // Globales Samenstand-Ranking: alle Spieler nach wallet_balance
  const profileByAuthId = new Map(
    (allProfiles || [])
      .filter((profile) => !!profile.auth_id)
      .map((profile) => [profile.auth_id, profile])
  );

  const alltimeSeedRanking = (allRobotPlants || [])
    .filter((rp) => !!rp.auth_id && Number(rp.wallet_balance) > 0)
    .map((rp) => {
      const profile = profileByAuthId.get(rp.auth_id);
      const isOwn = Boolean(ownAuthId && rp.auth_id === ownAuthId);
      const resolvedEmail =
        (profile?.user_email && String(profile.user_email).toLowerCase()) ||
        emailByAuthIdFromDiscoveries.get(rp.auth_id) ||
        (isOwn && user?.email ? String(user.email).toLowerCase() : null) ||
        null;
      return {
        authId: rp.auth_id,
        email: resolvedEmail,
        seeds: Number(rp.wallet_balance ?? 0),
        isOwn,
        name:
          profile?.display_name ||
          profile?.full_name ||
          (isOwn ? (user?.display_name || user?.full_name || user?.email) : (profile?.user_email || "")),
      };
    })
    .sort((a, b) => b.seeds - a.seeds);

  // In season scope use the dedicated season query (p_from_date = season start);
  // fall back to weeklySeedLeaderboard only when the season query hasn't loaded yet.
  const rawSeasonSeedSource = (statsComparisonScope === 'season' && comparisonFromDate)
    ? (seasonSeedLeaderboard ?? weeklySeedLeaderboard)
    : weeklySeedLeaderboard;

  const seasonSeedRanking = (rawSeasonSeedSource || [])
    .map((entry) => {
      const email = String(entry?.user_email || '').trim().toLowerCase();
      const entryAuthId = entry?.auth_id || null;
      const isOwnByAuth = !!ownAuthId && !!entryAuthId && ownAuthId === entryAuthId;
      const isOwnByEmail = !!ownEmailLower && !!email && ownEmailLower === email;
      const participantEmail = isOwnByAuth ? ownEmailLower : email;
      const profile = participantEmail ? profileByEmail.get(participantEmail) : null;

      return {
        authId: entryAuthId,
        email: participantEmail,
        seeds: Math.max(0, Number(entry?.weekly_seed_total ?? 0)),
        isOwn: isOwnByAuth || isOwnByEmail,
        name:
          profile?.display_name ||
          profile?.full_name ||
          entry?.display_name ||
          entry?.full_name ||
          (isOwnByAuth || isOwnByEmail
            ? (user?.display_name || user?.full_name || user?.email)
            : (participantEmail || 'Unbekannt')),
      };
    })
    .filter((entry) => Number(entry.seeds) > 0)
    .sort((a, b) => b.seeds - a.seeds);

  const globalSeedRanking = statsComparisonScope === "season" ? seasonSeedRanking : alltimeSeedRanking;
  const ownSeedRank = globalSeedRanking.findIndex((entry) => entry.isOwn) + 1;
  const ownSeeds = globalSeedRanking.find((entry) => entry.isOwn)?.seeds ?? 0;

  // "Diese Woche" always uses the ISO-week window – never the season scope.
  const progressSeedRanking = (weeklySeedLeaderboard || [])
    .map((entry) => {
      const email = String(entry?.user_email || '').trim().toLowerCase();
      const entryAuthId = entry?.auth_id || null;
      const isOwnByAuth = !!ownAuthId && !!entryAuthId && ownAuthId === entryAuthId;
      const isOwnByEmail = !!ownEmailLower && !!email && ownEmailLower === email;
      const participantEmail = isOwnByAuth ? ownEmailLower : email;
      const profile = participantEmail ? profileByEmail.get(participantEmail) : null;
      return {
        authId: entryAuthId,
        email: participantEmail,
        seeds: Math.max(0, Number(entry?.weekly_seed_total ?? 0)),
        isOwn: isOwnByAuth || isOwnByEmail,
        name:
          profile?.display_name ||
          profile?.full_name ||
          entry?.display_name ||
          entry?.full_name ||
          (isOwnByAuth || isOwnByEmail
            ? (user?.display_name || user?.full_name || user?.email)
            : (participantEmail || 'Unbekannt')),
      };
    })
    .filter((entry) => Number(entry.seeds) > 0)
    .sort((a, b) => b.seeds - a.seeds);
  const ownWeeklySeedRank = progressSeedRanking.findIndex((entry) => entry.isOwn) + 1;
  const ownWeeklySeedEntry = ownWeeklySeedRank > 0 ? progressSeedRanking[ownWeeklySeedRank - 1] : null;

  const navigateToPublicProfile = (email) => {
    const emailValue = String(email || "").trim();
    if (!emailValue) return;

    if (user?.email && emailValue.toLowerCase() === user.email.toLowerCase()) {
      navigate(createPageUrl("Home"));
      return;
    }

    navigate(createPageUrl(`FriendProfile?email=${encodeURIComponent(emailValue)}`));
  };

  const moduleChips = [
    {
      id: "stats",
      title: "Statistik",
      active: totalScans,
      total: totalScans,
    },
    {
      id: "quests",
      title: "Aufgaben",
      active: activeQuests.length,
      total: activeQuests.length + completedQuests.length,
    },
    {
      id: "achievements",
      title: "Erfolge",
      active: unlockedCount,
      total: achievements.length,
    },
  ];

  const tabsHeaderClass = embedded
    ? `sticky top-0 z-40 backdrop-blur-sm border-b ${isLightUi ? "bg-white/70 border-[#b99a48]/30" : "bg-black/20 border-[#f0e5a5]/20"}`
    : "fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-stone-200";

  const achievementsContentClass = embedded ? "mt-0 pb-20 flex-1 min-h-0 overflow-y-auto" : "pt-36 px-4 pb-4";
  const statsContentClass = embedded ? "mt-0 pb-20 flex-1 min-h-0 overflow-y-auto" : "pt-36 px-4 pb-4";
  const questsContentClass = embedded ? "mt-0 pb-20 flex-1 min-h-0 overflow-y-auto overflow-x-hidden" : "pt-44 px-4 pb-4 overflow-x-hidden";
  const listTopFadePx = 12;
  const listBottomFadePx = 18;
  const embeddedContentMaskStyle = embedded ? {
    WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
    maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
  } : undefined;

  const questCardSurfaceClass = isLightUi ? "bg-white/95" : "bg-[#171a17]/88";
  const questBorderClass = (quest) => {
    if (quest.type === "weekly") return isLightUi ? "border-emerald-600/65" : "border-emerald-300/70";
    if (quest.type === "monthly") return isLightUi ? "border-purple-600/65" : "border-purple-300/70";
    return isLightUi ? "border-stone-300/80" : "border-[#f0e5a5]/35";
  };
  const questTitleClass = isLightUi ? "text-stone-900" : "text-stone-100";
  const questBodyClass = isLightUi ? "text-stone-600" : "text-stone-300/90";
  const questMetaClass = isLightUi ? "text-stone-500" : "text-stone-300/80";
    const questIconClass = (quest) => {
      if (quest.isCompleted) return isLightUi ? "bg-gradient-to-br from-green-500 to-green-600" : "bg-gradient-to-br from-green-800 to-green-900";
      if (quest.type === "weekly") return isLightUi ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-emerald-800 to-emerald-900";
      if (quest.type === "monthly") return isLightUi ? "bg-gradient-to-br from-purple-500 to-purple-600" : "bg-gradient-to-br from-purple-800 to-purple-900";
      if (quest.type === "collection") return isLightUi ? "bg-gradient-to-br from-indigo-500 to-indigo-600" : "bg-gradient-to-br from-indigo-800 to-indigo-900";
      return isLightUi ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-gradient-to-br from-blue-800 to-blue-900";
    };
    const questCompletedBadgeClass = isLightUi ? "bg-green-600 text-white" : "bg-green-900/80 text-green-200";
    const questWeeklyBadgeClass = isLightUi ? "bg-emerald-600 text-white" : "bg-emerald-900/80 text-emerald-200";
    const questMonthlyBadgeClass = isLightUi ? "bg-purple-600 text-white" : "bg-purple-900/80 text-purple-200";
    const questCollectionBadgeClass = isLightUi ? "bg-indigo-600 text-white" : "bg-indigo-900/80 text-indigo-200";
    const questCategoryBadgeClass = (category) => {
      if (isLightUi) return category === "Bäume" ? "bg-green-600 text-white" : category === "Sträucher" ? "bg-emerald-600 text-white" : "bg-pink-600 text-white";
      return category === "Bäume" ? "bg-green-900/80 text-green-200" : category === "Sträucher" ? "bg-emerald-900/80 text-emerald-200" : "bg-pink-900/80 text-pink-200";
    };
    const questProgressTextClass = isLightUi ? "text-blue-700" : "text-blue-300";
    const questRewardBlockClass = isLightUi ? "text-amber-700 bg-amber-50" : "text-amber-300 bg-amber-900/30";
    const questRedeemBtnClass = isLightUi ? "bg-green-600 hover:bg-green-700" : "bg-green-800 hover:bg-green-900";
    const questTargetBadgeClass = isLightUi ? "border-emerald-500 text-emerald-700" : "border-emerald-700/60 text-emerald-400";
    const achievementUnlockedCardClass = isLightUi
    ? "border-amber-300 bg-gradient-to-br from-white/90 to-amber-50/90 backdrop-blur-md hover:shadow-md"
    : "border-[#f0e5a5]/40 bg-gradient-to-br from-[#2d2418]/90 via-[#1c1710]/88 to-[#12100b]/92 backdrop-blur-md hover:shadow-[0_8px_20px_rgba(0,0,0,0.35)]";
  const achievementLockedCardClass = isLightUi
    ? "border-stone-200 bg-stone-50/80 backdrop-blur-sm opacity-60"
    : "border-[#f0e5a5]/25 bg-black/35 backdrop-blur-sm opacity-70";
  const achievementTitleClass = isLightUi ? "text-stone-900" : "text-stone-100";
  const achievementMutedTextClass = isLightUi ? "text-stone-600" : "text-stone-300/90";
  const achievementLockedTitleClass = isLightUi ? "text-stone-500" : "text-stone-400/75";
  const achievementLockedMutedTextClass = isLightUi ? "text-stone-400" : "text-stone-500/75";
  const achievementRewardClass = isLightUi
    ? "bg-amber-50 text-amber-700"
    : "bg-amber-400/10 text-amber-200";
  const achievementLockedRewardClass = isLightUi
    ? "bg-stone-100 text-stone-400"
    : "bg-stone-700/35 text-stone-400";
  const statsLabelClass = isLightUi ? "text-stone-500" : "text-stone-300/80";
  const statsTitleClass = isLightUi ? "text-stone-900" : "text-stone-100";
  const statsBodyClass = isLightUi ? "text-stone-500" : "text-stone-300/80";
  const rankingHighlightClass = isLightUi
    ? "border-emerald-300 bg-emerald-50"
    : "border-emerald-300/55 bg-emerald-500/15";
  const rankingDefaultClass = isLightUi
    ? "border-stone-200 bg-stone-50"
    : "border-[#f0e5a5]/25 bg-stone-900/30";
  const rankingDefaultBadgeClass = isLightUi ? "bg-stone-800 text-white" : "bg-stone-700 text-stone-50 border border-stone-500/60";
  const leaderboardAvatarContainerClass = "w-7 h-7 flex-shrink-0 rounded-full overflow-hidden border border-stone-300/50";
  const leaderboardNameButtonClass = "p-0 m-0 min-w-0 border-0 bg-transparent text-left text-[15px] font-semibold truncate";
  const leaderboardNameTextClass = "min-w-0 text-[15px] font-semibold truncate";
  const statsPanelClass = isLightUi
    ? "w-full flex flex-col gap-4"
    : "w-full flex flex-col gap-4 border border-[#f0e5a5]/20 bg-black/45 backdrop-blur-md p-1 sm:p-4";

  // ── Leaderboard row renderer (shared across all leaderboard sub-sections) ──
  const renderLeaderboardRow = ({ entry, rank, isOwn, badge, sub, accentColor = "emerald", onRowClick, isExpanded, expandDetail }) => {
    const logo = leaderboardLogosByEmail.get(entry.email);
    const profile = entry.email ? profileByEmail.get(entry.email) : null;
    const botName = profile?.bot_name ? String(profile.bot_name).trim() : null;
    const medalMap = { 1: "🥇", 2: "🥈", 3: "🥉" };
    const medalEmoji = medalMap[rank];
    const accentMap = {
      indigo: isLightUi ? "bg-indigo-600 text-white" : "bg-indigo-700 text-white border border-indigo-400/50",
      amber:  isLightUi ? "bg-amber-600 text-white"  : "bg-amber-700 text-white border border-amber-400/50",
      lime:   isLightUi ? "bg-lime-600 text-white"   : "bg-lime-700 text-white border border-lime-400/50",
      fuchsia:isLightUi ? "bg-fuchsia-600 text-white": "bg-fuchsia-700 text-white border border-fuchsia-400/50",
      emerald:isLightUi ? "bg-emerald-600 text-white": "bg-emerald-700 text-white border border-emerald-400/50",
    };
    const badgeClass = isOwn ? (accentMap[accentColor] || accentMap.emerald) : rankingDefaultBadgeClass;
    const rowBase = `rounded-xl border px-3 py-2.5 transition-colors ${
      isOwn ? rankingHighlightClass : rankingDefaultClass
    }${onRowClick ? " cursor-pointer" : ""}`;
    return (
      <div key={`row-${entry.authId || entry.email || rank}`}>
        <div
          className={`flex items-center gap-2.5 ${rowBase}`}
          onClick={onRowClick}
          role={onRowClick ? "button" : undefined}
        >
          {/* Rank medal */}
          <div className="w-7 flex-shrink-0 flex items-center justify-center">
            {medalEmoji
              ? <span className="text-lg leading-none">{medalEmoji}</span>
              : <span className={`text-xs font-bold ${isOwn ? (isLightUi ? "text-emerald-700" : "text-emerald-300") : statsBodyClass}`}>#{rank}</span>
            }
          </div>
          {/* Avatar */}
          <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden border-2 border-stone-300/40">
            <CustomLogoAvatar
              logoAssets={logo}
              className="w-full h-full"
              tooltipText={entry.name || entry.email || "Unbekannt"}
              fallbackText={entry.name?.charAt(0)?.toUpperCase() || "?"}
              fallbackClassName="text-[11px] font-bold text-white"
            />
          </div>
          {/* Name + bot name */}
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigateToPublicProfile(entry.email); }}
              disabled={!entry.email}
              className={`block w-full text-left text-[15px] font-semibold truncate p-0 m-0 border-0 bg-transparent ${statsTitleClass} ${entry.email ? "cursor-pointer" : "cursor-default"}`}
            >
              {entry.name || entry.email || "Unbekannt"}
            </button>
            {botName
              ? <p className={`text-[11px] truncate ${statsBodyClass}`}>🤖 {botName}</p>
              : sub
                ? <p className={`text-[11px] truncate ${statsBodyClass}`}>{sub}</p>
                : null
            }
          </div>
          {/* Score */}
          <Badge className={`flex-shrink-0 text-xs font-bold whitespace-nowrap ${badgeClass}`}>{badge}</Badge>
        </div>
        {/* Expand panel (for highest scan results) */}
        {isExpanded && expandDetail && (
          <div className={`mt-0.5 rounded-b-xl border-x border-b px-3 py-2 text-xs ${isLightUi ? "border-stone-200 bg-white/80" : "border-[#f0e5a5]/20 bg-black/30"}`}>
            {expandDetail}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {embedded && isLightUi === false && (
        <style>{`
          [data-embedded-module="achievements"][data-theme="dark"] .bg-white,
          [data-embedded-module="achievements"][data-theme="dark"] .bg-white\/80,
          [data-embedded-module="achievements"][data-theme="dark"] .bg-white\/90,
          [data-embedded-module="achievements"][data-theme="dark"] .bg-stone-50,
          [data-embedded-module="achievements"][data-theme="dark"] .bg-stone-50\/80 {
            background-color: rgba(20, 20, 20, 0.62) !important;
          }
          [data-embedded-module="achievements"][data-theme="dark"] .text-stone-900 {
            color: rgb(245 245 244) !important;
          }
          [data-embedded-module="achievements"][data-theme="dark"] .text-stone-700,
          [data-embedded-module="achievements"][data-theme="dark"] .text-stone-600,
          [data-embedded-module="achievements"][data-theme="dark"] .text-stone-500 {
            color: rgb(214 211 209) !important;
          }
          [data-embedded-module="achievements"][data-theme="dark"] .border-stone-200,
          [data-embedded-module="achievements"][data-theme="dark"] .border-stone-300 {
            border-color: rgba(240, 229, 165, 0.28) !important;
          }
        `}</style>
      )}

      {renderQuestFeedbackOverlay()}
      {renderSeedRewardOverlay()}
      {/* Overlay für frisch freigeschaltete Achievements (analog Scanner / Friends) */}
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
      {!embedded && (
        <div
          className="fixed inset-0 -z-10"
          style={{
            background: averageColor ?
            `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)` :
            'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
          }}
        />
      )}

      
      {/* Scrollbarer Content */}
      <div
        data-embedded-module="achievements"
        data-theme={isLightUi ? "light" : "dark"}
        className={embedded ? "h-full min-h-0 overflow-hidden" : "min-h-screen"}
      >
        {!embedded && <MobileBackButton />}
      
      <div className={embedded ? "w-full h-full min-h-0 flex flex-col" : "w-full"}>

        {/* ── ROOT OVERVIEW ── */}
        {achievementsView === null && (
          <div className={achievementsContentClass} style={embeddedContentMaskStyle}>
            {!embedded && (
              <div className="px-1 pt-3 pb-4">
                <h1 className="text-xl sm:text-2xl font-bold text-stone-900">Erfolge</h1>
                <p className="text-xs text-stone-600 mt-0.5">Bestenlisten, Aufgaben und Errungenschaften</p>
              </div>
            )}
            <div className="space-y-3" style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>
              <CollectionCategoryEntryCard
                title="Rangliste"
                info={`${totalScans} eigene Scans · Rang ${ownGlobalScanRank > 0 ? `#${ownGlobalScanRank}` : "ausstehend"}`}
                icon={BarChart2}
                accent="season"
                showChevron
                onClick={() => setAchievementsView("leaderboard_scope")}
              />
              <CollectionCategoryEntryCard
                title="Aufgaben"
                description={activeQuests.length > 0 ? `${activeQuests.length} aktive Quest${activeQuests.length !== 1 ? "s" : ""}` : "Aktive und abgeschlossene Quests"}
                info={hasRedeemableQuests ? "⚡ Quests können jetzt eingelöst werden!" : `${completedQuests.length} abgeschlossen`}
                icon={Target}
                accent="themes"
                showChevron
                onClick={() => setAchievementsView("quests")}
              />
              <CollectionCategoryEntryCard
                title="Vergleiche"
                description={`${unlockedCount} von ${achievements.length} Erfolgen freigeschaltet`}
                info="Erfolge, Titel und Belohnungen"
                icon={Trophy}
                accent="browse"
                showChevron
                onClick={() => setAchievementsView("achievements")}
              />
            </div>
          </div>
        )}

        {/* ── RANGLISTE: SCOPE PICKER ── */}
        {achievementsView === "leaderboard_scope" && (
          <div className={achievementsContentClass} style={embeddedContentMaskStyle}>
            <div className="space-y-3" style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>
              {hasActiveSeason && (
                <CollectionCategoryEntryCard
                  title={activeSeason?.title || "Saison"}
                  description={`Rangliste seit ${activeSeason?.startDate ? new Date(activeSeason.startDate + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "Saisonstart"}`}
                  info="Saison-Scans, Samen und wöchentlicher Score"
                  icon={Leaf}
                  accent="season"
                  showChevron
                  onClick={() => { setStatsComparisonScope("season"); setAchievementsView("leaderboard"); setIsLeaderboardRefreshing(true); }}
                />
              )}
              <CollectionCategoryEntryCard
                title="All-Time"
                description="Gesamtrangliste seit Beginn – alle Scans, Samen und Rekorde aller Zeiten"
                icon={BarChart2}
                accent="browse"
                showChevron
                onClick={() => { setStatsComparisonScope("alltime"); setAchievementsView("leaderboard"); setIsLeaderboardRefreshing(true); }}
              />
            </div>
          </div>
        )}

        {/* ── VERGLEICHE (Achievements) ── */}
        {achievementsView === "achievements" && (
          <div className={achievementsContentClass} style={embeddedContentMaskStyle}>

            <div className="max-w-6xl mx-auto" style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedAchievements.map((achievement, index) => {
                    const isUnlocked = userAchievements.some((ua) => ua.achievement_id === achievement.id);

                    // Lade den zugehörigen Reward
                    const achievementReward = achievement.reward_name ? rewards.find(r => r.name === achievement.reward_name) : null;
                    const rewardTitleValue = resolveTitleValue(achievementReward?.value, achievementReward?.display_name);
                    const isCurrentTitle = achievementReward?.type === 'title' && resolveTitleValue(user?.selected_title) === rewardTitleValue;

                    return (
                      <motion.div
                        key={achievement.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}>

                <Card className={`border shadow-sm transition-all duration-300 ${
                  isUnlocked
                  ? achievementUnlockedCardClass
                  : achievementLockedCardClass}`
                  }>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-30'} flex-shrink-0`}>
                        {achievement.icon_emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <Badge className={`${getRarityColor(achievement.rarity)} text-white font-semibold text-[10px] px-1 py-0`}>
                            {achievement.rarity}
                          </Badge>
                          {isUnlocked &&
                                  <Trophy className="w-3 h-3 text-amber-500" />
                                  }
                        </div>
                        <h3 className={`text-sm font-bold mb-1 ${isUnlocked ? achievementTitleClass : achievementLockedTitleClass}`}>
                          {achievement.title}
                        </h3>
                        <p className={`text-xs mb-1 ${isUnlocked ? achievementMutedTextClass : achievementLockedMutedTextClass}`}>
                          {achievement.description}
                        </p>

                        {achievementReward && (
                          <div className={`flex items-center gap-1 text-xs mt-2 px-2 py-1 rounded-lg ${
                            isUnlocked ? achievementRewardClass : achievementLockedRewardClass
                          }`}>
                            <Gift className="w-3 h-3" />
                            <span className="font-semibold">{achievementReward.display_name}</span>
                          </div>
                        )}
                        
                        {achievementReward && achievementReward.type === 'title' && isUnlocked &&
                                <Button
                                  onClick={() => handleSelectTitle(achievement, achievementReward)}
                                  disabled={isCurrentTitle || updateTitleMutation.isPending}
                                  className={`w-full text-[10px] h-6 mt-1 ${
                                  isCurrentTitle ?
                                  'bg-green-600 hover:bg-green-600' :
                                  'bg-purple-600 hover:bg-purple-700'}`
                                  }
                                  size="sm">

                            {isCurrentTitle ?
                                  <>
                                <CheckCircle className="w-2 h-2 mr-1" />
                                Aktiv
                              </> :

                                  `Titel: ${rewardTitleValue}`
                                  }
                          </Button>
                                }
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </motion.div>);

                  })}

                {sortedAchievements.length === 0 &&
                  <Card className={`border-2 backdrop-blur-md ${
                    isLightUi
                      ? "border-stone-200 bg-white/80"
                      : "border-[#f0e5a5]/25 bg-black/35"
                  }`}>
                    <CardContent className="p-12 text-center">
                      <Trophy className={`w-16 h-16 mx-auto mb-4 ${isLightUi ? "text-stone-400" : "text-stone-500"}`} />
                      <h3 className={`text-xl font-bold mb-2 ${statsTitleClass}`}>
                        Noch keine Erfolge verfügbar
                      </h3>
                    </CardContent>
                  </Card>
                  }
              </div>
            </div>
          </div>
        )}

        {/* ── RANGLISTE CONTENT ── */}
        {achievementsView === "leaderboard" && (
          <div className={statsContentClass} style={embeddedContentMaskStyle}>
            <div className={statsPanelClass} style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>

              {/* ── Section Navigation ── */}
              {(() => {
                const STATS_TABS = [
                  { id: "global",  label: "Global",       icon: Globe,        palette: NAV_COLOR_ORDER[0] },
                  { id: "weekly",  label: "Diese Woche",  icon: CalendarDays, palette: NAV_COLOR_ORDER[1] },
                  { id: "me",      label: "Ich",          icon: User,         palette: NAV_COLOR_ORDER[2] },
                ];
                return (
                  <div className="grid grid-cols-3 gap-2">
                    {STATS_TABS.map(({ id, label, icon: Icon, palette }) => {
                      const isActive = statsSection === id;
                      const { gradientClass, shadowStyle } = getNavButtonStyle({ palette, isLightUi, isActive });
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setStatsSection(id)}
                          className={`relative rounded-2xl border border-[#f0e5a5]/45 ${gradientClass} hover:brightness-105 active:translate-y-px transition-all flex flex-col items-center justify-center gap-1 backdrop-blur-[2px] ${isActive ? "" : "opacity-65"}`}
                          style={{ boxShadow: shadowStyle, height: "2.9rem" }}
                          aria-pressed={isActive}
                        >
                          <Icon className="text-white" style={{ width: "1.1rem", height: "1.1rem" }} />
                          <span className="text-white font-semibold" style={{ fontSize: "0.65rem", lineHeight: 1 }}>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ══════════════════════════════════════════
                  GLOBAL LEADERBOARDS
              ══════════════════════════════════════════ */}
              {statsSection === "global" && (
              <section className="space-y-3">

                {/* Global Sub-Navigation */}
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  {[
                    { id: "scans", icon: <ScanSearch className="w-3.5 h-3.5 flex-shrink-0" />, label: "Scans" },
                    { id: "seeds", icon: <span className="leading-none">🌱</span>, label: "Samen" },
                    { id: "best", icon: <Trophy className="w-3.5 h-3.5 flex-shrink-0" />, label: "Bestes Ergebnis" },
                  ].map(({ id, icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setGlobalSubSection(id)}
                      className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        globalSubSection === id
                          ? isLightUi ? "bg-stone-800 text-white border-stone-800" : "bg-stone-100/15 text-stone-50 border-stone-100/30"
                          : isLightUi ? "bg-white text-stone-500 border-stone-200" : "bg-black/25 text-stone-400 border-[#f0e5a5]/15"
                      }`}
                    >
                      {icon}<span>{label}</span>
                    </button>
                  ))}
                </div>

                {isLeaderboardRefreshing ? (
                  <div className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-8 ${isLightUi ? "border-stone-200 bg-stone-50" : "border-[#f0e5a5]/20 bg-black/20"}`}>
                    <Loader2 className={`w-4 h-4 animate-spin ${statsBodyClass}`} />
                    <span className={`text-sm ${statsBodyClass}`}>Bestenliste wird aktualisiert…</span>
                  </div>
                ) : (
                  <>
                    {/* SCANS sub-section */}
                    {globalSubSection === "scans" && (() => {
                      const ranking = effectiveGlobalScanRanking;
                      const top10 = ranking.slice(0, 10);
                      const ownInTop = top10.some((e) => e.email === ownEmailLower);
                      const ownEntry = !ownInTop && ownGlobalScanRank > 0 ? ranking[ownGlobalScanRank - 1] : null;
                      return (
                        <div className="space-y-1">
                          <p className={`text-[11px] uppercase tracking-wide font-medium mb-1.5 ${statsLabelClass}`}>
                            Scan-Bestenliste ({comparisonRangeLabel}) — Dein Rang: {ownGlobalScanRank > 0 ? `#${ownGlobalScanRank} / ${ranking.length}` : "–"}
                          </p>
                          {ranking.length === 0 && <p className={`text-sm ${statsBodyClass}`}>Noch keine Daten.</p>}
                          {top10.map((entry, i) => renderLeaderboardRow({ entry, rank: i + 1, isOwn: entry.email === ownEmailLower, badge: `${entry.scans}×`, accentColor: "indigo" }))}
                          {ownEntry && (<><p className={`text-xs text-center my-0.5 ${statsBodyClass}`}>…</p>{renderLeaderboardRow({ entry: ownEntry, rank: ownGlobalScanRank, isOwn: true, badge: `${ownEntry.scans}×`, accentColor: "indigo" })}</>)}
                        </div>
                      );
                    })()}

                    {/* SEEDS sub-section */}
                    {globalSubSection === "seeds" && (() => {
                      const ranking = globalSeedRanking;
                      const top10 = ranking.slice(0, 10);
                      const ownInTop = top10.some((e) => e.isOwn);
                      const ownEntry = !ownInTop && ownSeedRank > 0 ? ranking[ownSeedRank - 1] : null;
                      return (
                        <div className="space-y-1">
                          <p className={`text-[11px] uppercase tracking-wide font-medium mb-1.5 ${statsLabelClass}`}>
                            Samen-Bestenliste ({comparisonRangeLabel}) — Dein Rang: {ownSeedRank > 0 ? `#${ownSeedRank} / ${ranking.length}` : "–"}
                          </p>
                          {ranking.length === 0 && <p className={`text-sm ${statsBodyClass}`}>Noch keine Daten.</p>}
                          {top10.map((entry, i) => renderLeaderboardRow({ entry, rank: i + 1, isOwn: entry.isOwn, badge: `${entry.seeds.toLocaleString()} 🌱`, accentColor: "amber" }))}
                          {ownEntry && (<><p className={`text-xs text-center my-0.5 ${statsBodyClass}`}>…</p>{renderLeaderboardRow({ entry: ownEntry, rank: ownSeedRank, isOwn: true, badge: `${ownEntry.seeds.toLocaleString()} 🌱`, accentColor: "amber" })}</>)}
                        </div>
                      );
                    })()}

                    {/* BEST sub-section */}
                    {globalSubSection === "best" && (() => {
                      const ranking = highestScanResultsRanking;
                      const top10 = ranking.slice(0, 10);
                      const ownInTop = top10.some((e) => e.email === ownEmailLower);
                      const ownEntry = !ownInTop && ownHighestScanResultRank > 0 ? ranking[ownHighestScanResultRank - 1] : null;
                      const makeExpandDetail = (entry) => {
                        const chips = getMultiplierChips(entry);
                        return (
                          <>
                            <div className={`font-semibold ${statsTitleClass}`}>
                              Pflanze: {entry.plantSpeciesName || "Unbekannte Pflanze"}{entry.plantCommonName ? ` (${entry.plantCommonName})` : ""}
                            </div>
                            <div className={`mt-0.5 ${statsBodyClass}`}>
                              Status: {resolveScanStatusLabel(entry.scanStatus)}{entry.formattedAwardedAt ? ` · ${entry.formattedAwardedAt}` : ""}
                            </div>
                            {chips.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {chips.map((chip) => (
                                  <Badge key={chip} className={isLightUi ? "bg-fuchsia-100 text-fuchsia-800 text-[10px]" : "bg-fuchsia-500/20 text-fuchsia-100 border border-fuchsia-300/40 text-[10px]"}>{chip}</Badge>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      };
                      return (
                        <div className="space-y-1">
                          <p className={`text-[11px] uppercase tracking-wide font-medium mb-1.5 ${statsLabelClass}`}>
                            Höchste Scan-Ergebnisse ({comparisonRangeLabel}) — Dein Rang: {ownHighestScanResultRank > 0 ? `#${ownHighestScanResultRank} / ${ranking.length}` : "–"}
                          </p>
                          {ranking.length === 0 && <p className={`text-sm ${statsBodyClass}`}>Noch keine Daten.</p>}
                          {top10.map((entry, i) => renderLeaderboardRow({
                            entry, rank: i + 1, isOwn: entry.email === ownEmailLower,
                            badge: entry.rewardAmount.toLocaleString(),
                            sub: [resolveScanEventLabel(entry.eventSource), entry.formattedAwardedAt].filter(Boolean).join(" · "),
                            accentColor: "fuchsia",
                            onRowClick: () => setExpandedHighestScanEntryKey((prev) => prev === entry.detailKey ? null : entry.detailKey),
                            isExpanded: expandedHighestScanEntryKey === entry.detailKey,
                            expandDetail: makeExpandDetail(entry),
                          }))}
                          {ownEntry && (<><p className={`text-xs text-center my-0.5 ${statsBodyClass}`}>…</p>{renderLeaderboardRow({
                            entry: ownEntry, rank: ownHighestScanResultRank, isOwn: true,
                            badge: ownEntry.rewardAmount.toLocaleString(),
                            sub: [resolveScanEventLabel(ownEntry.eventSource), ownEntry.formattedAwardedAt].filter(Boolean).join(" · "),
                            accentColor: "fuchsia",
                            onRowClick: () => setExpandedHighestScanEntryKey((prev) => prev === ownEntry.detailKey ? null : ownEntry.detailKey),
                            isExpanded: expandedHighestScanEntryKey === ownEntry.detailKey,
                            expandDetail: makeExpandDetail(ownEntry),
                          })}</>)}
                        </div>
                      );
                    })()}

                    {/* Taxonomy highlights strip */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {[
                        { label: "Global häufigster Scan", value: globalTopSpeciesName || "—", sub: globalTopSpeciesCount > 0 ? `${globalTopSpeciesCount}× global` : "", color: isLightUi ? "text-blue-700" : "text-blue-300" },
                        { label: "Top Genus global", value: globalTopGenusName || "—", sub: globalTopGenusCount > 0 ? `${globalTopGenusCount}× global` : "", color: isLightUi ? "text-purple-700" : "text-purple-300" },
                      ].map(({ label, value, sub, color }) => (
                        <div key={label} className={`rounded-xl border p-3 ${isLightUi ? "bg-white border-stone-200" : "bg-black/30 border-[#f0e5a5]/18"}`}>
                          <p className={`text-[10px] uppercase tracking-wide font-medium ${statsLabelClass}`}>{label}</p>
                          <p className={`text-sm font-bold mt-0.5 truncate ${color}`}>{value}</p>
                          {sub && <p className={`text-[10px] mt-0.5 ${statsBodyClass}`}>{sub}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
              )}

              {/* ══════════════════════════════════════════
                  WEEKLY LEADERBOARD
              ══════════════════════════════════════════ */}
              {statsSection === "weekly" && (
              <section className="space-y-3">
                <div className={`rounded-xl border px-3 py-2.5 ${isLightUi ? "border-lime-200 bg-lime-50" : "border-lime-300/30 bg-lime-500/8"}`}>
                  <p className={`text-[11px] ${isLightUi ? "text-lime-700" : "text-lime-300"}`}>Dein Rang (Mo–So)</p>
                  <p className={`text-xl font-bold ${isLightUi ? "text-lime-900" : "text-lime-100"}`}>
                    {ownWeeklySeedRank > 0 ? `#${ownWeeklySeedRank} von ${progressSeedRanking.length}` : "Noch kein Rang"}
                  </p>
                  {ownWeeklySeedEntry && (
                    <p className={`text-xs mt-0.5 ${isLightUi ? "text-lime-700" : "text-lime-300"}`}>
                      +{ownWeeklySeedEntry.seeds.toLocaleString()} Samen diese Woche
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className={`text-[11px] uppercase tracking-wide font-medium mb-1.5 ${statsLabelClass}`}>Meiste Samen (diese Woche)</p>
                  {isLeaderboardRefreshing ? (
                    <div className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-8 ${isLightUi ? "border-stone-200 bg-stone-50" : "border-[#f0e5a5]/20 bg-black/20"}`}>
                      <Loader2 className={`w-4 h-4 animate-spin ${statsBodyClass}`} />
                      <span className={`text-sm ${statsBodyClass}`}>Wird geladen…</span>
                    </div>
                  ) : (() => {
                    const ranking = progressSeedRanking;
                    const top10 = ranking.slice(0, 10);
                    const ownInTop = top10.some((e) => e.isOwn);
                    const ownEntry = !ownInTop && ownWeeklySeedRank > 0 ? ranking[ownWeeklySeedRank - 1] : null;
                    return (
                      <>
                        {ranking.length === 0 && <p className={`text-sm ${statsBodyClass}`}>Diese Woche noch keine Daten.</p>}
                        {top10.map((entry, i) => renderLeaderboardRow({ entry, rank: i + 1, isOwn: entry.isOwn, badge: `+${entry.seeds.toLocaleString()} 🌱`, accentColor: "lime" }))}
                        {ownEntry && (<><p className={`text-xs text-center my-0.5 ${statsBodyClass}`}>…</p>{renderLeaderboardRow({ entry: ownEntry, rank: ownWeeklySeedRank, isOwn: true, badge: `+${ownEntry.seeds.toLocaleString()} 🌱`, accentColor: "lime" })}</>)}
                      </>
                    );
                  })()}
                </div>
              </section>
              )}

              {/* ══════════════════════════════════════════
                  PERSONAL STATS
              ══════════════════════════════════════════ */}
              {statsSection === "me" && (
              <section className="space-y-3">
                {/* Stat grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: statsComparisonScope === "season" ? "Scans (Saison)" : "Scans gesamt", value: String(totalScans), sub: `${activeDaysSet.size} aktive Tage`, color: isLightUi ? "text-emerald-700" : "text-emerald-300", big: true },
                    { label: statsComparisonScope === "season" ? "Saison-Trend" : "Monats-Trend", value: String(currentMonthScans), sub: `${monthTrendDelta >= 0 ? "+" : ""}${monthTrendDelta} vs. Vormonat`, color: monthTrendDelta >= 0 ? (isLightUi ? "text-emerald-700" : "text-emerald-300") : (isLightUi ? "text-rose-700" : "text-rose-300"), big: true },
                    { label: "Häufigster Scan", value: topSpeciesEntry?.[0] || "—", sub: topSpeciesEntry ? `${topSpeciesEntry[1]}× gescannt` : "", color: isLightUi ? "text-blue-700" : "text-blue-300", big: false },
                    { label: "Top Genus", value: topGenusEntry?.[0] || "—", sub: topGenusEntry ? `${topGenusEntry[1]}× gescannt` : "", color: isLightUi ? "text-purple-700" : "text-purple-300", big: false },
                  ].map(({ label, value, sub, color, big }) => (
                    <div key={label} className={`rounded-xl border p-3 ${isLightUi ? "bg-white border-stone-200" : "bg-black/30 border-[#f0e5a5]/18"}`}>
                      <p className={`text-[10px] uppercase tracking-wide font-medium ${statsLabelClass}`}>{label}</p>
                      <p className={`${big ? "text-2xl" : "text-sm"} font-bold mt-0.5 truncate ${color}`}>{value}</p>
                      {sub && <p className={`text-[10px] mt-0.5 ${statsBodyClass}`}>{sub}</p>}
                    </div>
                  ))}
                </div>

                {/* Own rankings summary */}
                <div className={`rounded-xl border p-3 space-y-2.5 ${isLightUi ? "bg-white border-stone-200" : "bg-black/30 border-[#f0e5a5]/18"}`}>
                  <p className={`text-[11px] uppercase tracking-wide font-medium ${statsLabelClass}`}>Deine globalen Ränge</p>
                  {[
                    { label: "Scan-Rang", rank: ownGlobalScanRank, total: effectiveGlobalScanRanking.length, sub: null, color: isLightUi ? "text-indigo-700" : "text-indigo-300" },
                    { label: "Samen-Rang", rank: ownSeedRank, total: globalSeedRanking.length, sub: ownSeeds > 0 ? `${ownSeeds.toLocaleString()} 🌱` : null, color: isLightUi ? "text-amber-700" : "text-amber-300" },
                    { label: "Wochen-Rang", rank: ownWeeklySeedRank, total: progressSeedRanking.length, sub: ownWeeklySeedEntry ? `+${ownWeeklySeedEntry.seeds.toLocaleString()} 🌱 diese Woche` : null, color: isLightUi ? "text-lime-700" : "text-lime-300" },
                  ].map(({ label, rank, total, sub, color }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${statsBodyClass}`}>{label}</span>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${color}`}>{rank > 0 ? `#${rank} / ${total}` : "–"}</span>
                        {sub && <p className={`text-[10px] ${statsBodyClass}`}>{sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              )}

            </div>
          </div>
        )}

        {/* ── AUFGABEN ── */}
        {achievementsView === "quests" && (
          <div className={questsContentClass} style={embeddedContentMaskStyle}>
            <div className="space-y-3" style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>

              {/* ── Active Quests ── */}
              {activeQuests.map((quest, index) => {
                const rawProgress = quest.progress || 0;
                const target = quest.required_discoveries || 0;
                const displayProgress = target > 0 ? Math.min(rawProgress, target) : rawProgress;
                const progressPercentage = target > 0 ? Math.min(100, (rawProgress / target) * 100) : 0;

                const accentMap = {
                  weekly:     { tint: "rgba(101,166,132,0.36)", border: "rgba(158,223,189,0.30)", iconBg: "bg-emerald-300/16 border-white/20 text-emerald-100" },
                  monthly:    { tint: "rgba(251,191,36,0.34)",  border: "rgba(251,191,36,0.30)",  iconBg: "bg-amber-300/16 border-white/20 text-amber-100" },
                  collection: { tint: "rgba(104,134,189,0.34)", border: "rgba(167,190,237,0.30)", iconBg: "bg-blue-300/16 border-white/20 text-blue-100" },
                  regular:    { tint: "rgba(146,181,93,0.38)",  border: "rgba(199,224,151,0.30)", iconBg: "bg-lime-300/16 border-white/20 text-lime-100" },
                };
                const accent = accentMap[quest.type] || accentMap.regular;

                const typeLabel = quest.type === "weekly" ? "📅 Wöchentlich"
                  : quest.type === "monthly" ? "📆 Monatlich"
                  : quest.type === "collection" ? `🗺️ ${quest.icon_emoji || "Sammlung"}`
                  : null;

                const QuestIcon = quest.isCompleted ? CheckCircle2 : Target;

                return (
                  <motion.div
                    key={quest.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div
                      className="relative w-full rounded-[1.35rem] border shadow-[0_16px_42px_rgba(0,0,0,0.34)] overflow-hidden"
                      style={{
                        background: `linear-gradient(145deg, ${accent.tint} 0%, rgba(10,13,19,0.86) 58%, rgba(7,10,16,0.94) 100%)`,
                        borderColor: accent.border,
                      }}
                    >
                      <div className="absolute inset-0 pointer-events-none rounded-[1.35rem] bg-gradient-to-br from-white/14 via-transparent to-black/38" />
                      <div className="relative p-4 flex items-start gap-3">
                        {/* Icon */}
                        <div className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 backdrop-blur-sm ${accent.iconBg}`}>
                          {quest.type === "collection"
                            ? <span className="text-lg leading-none">{quest.icon_emoji || "🗺️"}</span>
                            : <QuestIcon className="w-5 h-5" />
                          }
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          {/* Type + category chips */}
                          <div className="flex flex-wrap gap-1 mb-1">
                            {quest.isCompleted && (
                              <span className="inline-flex items-center rounded-full border border-white/25 bg-black/26 text-white/84 px-2 py-0.5 text-[10px] font-medium">✓ Abgeschlossen</span>
                            )}
                            {typeLabel && (
                              <span className="inline-flex items-center rounded-full border border-white/25 bg-black/26 text-white/84 px-2 py-0.5 text-[10px] font-medium">{typeLabel}</span>
                            )}
                            {quest.category && quest.category !== "Alle" && (
                              <span className="inline-flex items-center rounded-full border border-white/25 bg-black/26 text-white/84 px-2 py-0.5 text-[10px] font-medium">{quest.category}</span>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className="text-lg font-semibold text-white leading-tight tracking-[0.01em]">{quest.title}</h3>

                          {/* Description */}
                          <p className="text-sm text-white/80 mt-0.5 line-clamp-2 leading-snug">{quest.description}</p>

                          {/* Target badge */}
                          {(quest.target_species_name || quest.target_genus_name) && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {quest.target_species_name && (() => {
                                const url = buildQuestNaturaDbUrl(quest.target_species_name);
                                return url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-0.5 rounded-full border-2 border-white/40 bg-black/25 text-white/95 px-2 py-0.5 text-[10px] font-bold hover:bg-black/40 transition-colors cursor-pointer">
                                    🎯 {quest.target_species_name} 🔗
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border-2 border-white/35 bg-black/20 text-white/90 px-2 py-0.5 text-[10px] font-bold">🎯 {quest.target_species_name}</span>
                                );
                              })()}
                              {quest.target_genus_name && !quest.target_species_name && (() => {
                                const url = buildQuestGenusNaturaDbUrl(quest.target_genus_name);
                                return url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-0.5 rounded-full border-2 border-white/40 bg-black/25 text-white/95 px-2 py-0.5 text-[10px] font-bold hover:bg-black/40 transition-colors cursor-pointer">
                                    🎯 {quest.target_genus_name} 🔗
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border-2 border-white/35 bg-black/20 text-white/90 px-2 py-0.5 text-[10px] font-bold">🎯 {quest.target_genus_name}</span>
                                );
                              })()}
                            </div>
                          )}

                          {/* Progress */}
                          {quest.required_discoveries && (
                            <div className="mt-2.5 space-y-1">
                              <div className="flex justify-between text-[11px] text-white/70">
                                <span>Fortschritt</span>
                                <span className="font-semibold text-white/90">{displayProgress} / {quest.required_discoveries}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                                <div className="h-full rounded-full bg-white/70 transition-all" style={{ width: `${progressPercentage}%` }} />
                              </div>
                            </div>
                          )}

                          {/* Reward + redeem */}
                          {quest.isCompleted && (
                            <div className="mt-3 pt-2.5 border-t border-white/15">
                              <div className="flex items-center gap-2">
                                {quest.rewardDisplayName && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-white/80 min-w-0 flex-1">
                                    <Gift className="w-3 h-3 flex-shrink-0 text-white/60" />
                                    <span className="truncate font-medium">{quest.rewardDisplayName}</span>
                                  </div>
                                )}
                                {quest.canRedeem ? (
                                  <Button
                                    onClick={() => {
                                      const allCompleted = [...userQuests, ...userWeeklyQuests, ...userMonthlyQuests, ...userCollectionQuests].filter((q) => q.redeemed);
                                      redeemQuestMutation.mutate({
                                        userQuestId: quest.userQuestId,
                                        questType: quest.type,
                                        rewardName: quest.rewardData?.name,
                                        seedReward: quest.seedReward,
                                        isFirstQuest: allCompleted.length === 0,
                                        questTitle: quest.title,
                                      });
                                    }}
                                    disabled={redeemQuestMutation.isPending}
                                    size="sm"
                                    className="shrink-0 h-7 px-3 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/35 backdrop-blur-sm font-semibold"
                                  >
                                    Einlösen
                                  </Button>
                                ) : (
                                  <span className="text-[11px] italic text-white/50">Bereits eingelöst</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* ── Completed Quests ── */}
              {completedQuests.length > 0 && (
                <>
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left px-1"
                    onClick={() => setShowCompleted((prev) => !prev)}
                  >
                    <span className="text-sm font-semibold text-white/80">Abgeschlossene Aufgaben ({completedQuests.length})</span>
                    <span className="text-xs text-white/60">{showCompleted ? "▾" : "▸"}</span>
                  </button>

                  {showCompleted && completedQuests.map((quest, index) => {
                    const accentMap = {
                      weekly:     { tint: "rgba(101,166,132,0.18)", border: "rgba(158,223,189,0.18)", iconBg: "bg-emerald-300/10 border-white/15 text-emerald-100/60" },
                      monthly:    { tint: "rgba(251,191,36,0.16)",  border: "rgba(251,191,36,0.18)",  iconBg: "bg-amber-300/10 border-white/15 text-amber-100/60" },
                      collection: { tint: "rgba(104,134,189,0.16)", border: "rgba(167,190,237,0.18)", iconBg: "bg-blue-300/10 border-white/15 text-blue-100/60" },
                      regular:    { tint: "rgba(146,181,93,0.18)",  border: "rgba(199,224,151,0.18)", iconBg: "bg-lime-300/10 border-white/15 text-lime-100/60" },
                    };
                    const accent = accentMap[quest.type] || accentMap.regular;
                    const typeLabel = quest.type === "weekly" ? "📅 Wöchentlich"
                      : quest.type === "monthly" ? "📆 Monatlich"
                      : quest.type === "collection" ? `🗺️ Sammlung`
                      : null;

                    return (
                      <motion.div
                        key={`${quest.type}-${quest.userQuestId || quest.id}-${index}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <div
                          className="relative w-full rounded-[1.35rem] border overflow-hidden opacity-60"
                          style={{
                            background: `linear-gradient(145deg, ${accent.tint} 0%, rgba(10,13,19,0.80) 58%, rgba(7,10,16,0.88) 100%)`,
                            borderColor: accent.border,
                          }}
                        >
                          <div className="absolute inset-0 pointer-events-none rounded-[1.35rem] bg-gradient-to-br from-white/8 via-transparent to-black/30" />
                          <div className="relative p-4 flex items-start gap-3">
                            <div className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${accent.iconBg}`}>
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap gap-1 mb-1">
                                <span className="inline-flex items-center rounded-full border border-white/20 bg-black/20 text-white/70 px-2 py-0.5 text-[10px] font-medium">✓ Abgeschlossen</span>
                                {typeLabel && (
                                  <span className="inline-flex items-center rounded-full border border-white/20 bg-black/20 text-white/70 px-2 py-0.5 text-[10px] font-medium">{typeLabel}</span>
                                )}
                              </div>
                              <h3 className="text-base font-semibold text-white/80 leading-tight">{quest.title}</h3>
                              <div className="flex items-center gap-2 mt-2">
                                {quest.rewardDisplayName && (
                                  <div className="flex items-center gap-1 text-[11px] text-white/60 min-w-0 flex-1">
                                    <Gift className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{quest.rewardDisplayName}</span>
                                  </div>
                                )}
                                {quest.completedAt && (
                                  <span className="text-[11px] text-white/50 shrink-0">
                                    {format(new Date(quest.completedAt), "dd.MM.yy", { locale: de })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </>
              )}

              {!hasAnyQuestData && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                    <Target className="w-8 h-8 text-white/50" />
                  </div>
                  <p className="text-white/60 text-sm">Keine aktiven Aufgaben</p>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* Title Selection Dialog */}
      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent className={!isLightUi ? "bg-[#1a1d1a] border-[#f0e5a5]/20" : ""}>
          <DialogHeader>
            <DialogTitle className={!isLightUi ? "text-stone-100" : ""}>Titel ausrüsten</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className={`mb-4 ${!isLightUi ? "text-stone-300" : "text-stone-700"}`}>
              Möchtest du den Titel <strong className={!isLightUi ? "text-purple-300" : "text-purple-700"}>"{resolveTitleValue(selectedAchievement?.selectedReward?.value, selectedAchievement?.selectedReward?.display_name)}"</strong> ausrüsten?
            </p>
            <p className={`text-sm mb-6 ${!isLightUi ? "text-stone-400" : "text-stone-500"}`}>
              Dieser Titel wird in deinem Profil und auf der Startseite angezeigt.
            </p>
            <div className="flex gap-3">
              <Button
                  variant="outline"
                  onClick={() => setShowTitleDialog(false)}
                  className={`flex-1 ${!isLightUi ? "border-stone-600 text-stone-300 hover:bg-stone-800" : ""}`}>

                Abbrechen
              </Button>
              <Button
                  onClick={confirmTitleSelection}
                  disabled={updateTitleMutation.isPending}
                  className="flex-1 bg-purple-600 hover:bg-purple-700">

                {updateTitleMutation.isPending ? 'Wird ausgerüstet...' : 'Ausrüsten'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>);

}
