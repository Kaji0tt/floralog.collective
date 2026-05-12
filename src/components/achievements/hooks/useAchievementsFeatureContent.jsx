import { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { createUserNotification } from "@/api/notificationService";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Leaf, Target, CheckCircle2, Gift, Users } from "lucide-react";
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
import { useUiTheme } from "@/lib/UiThemeContext";
import { createPageUrl } from "@/utils";
import { resolveTitleValue } from "@/lib/profileCustomizationOptions";
import { supabase } from "@/api/supabaseClient";

/** @type {{ regular: number, weekly: number, monthly: number }} */
const DEFAULT_QUEST_SEED_REWARD_BY_TYPE = {
  regular: 500,
  weekly: 1500,
  monthly: 1000,
};

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
    error.code === "42883" ||
    message.includes("could not find the function")
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
  onHeaderMetaChange,
  onRequestClose: _onRequestClose = null,
  onUserUpdated,
}) {
  const { isLightUi } = useUiTheme();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "stats");
  const [questFeedback, setQuestFeedback] = useState(null);
  const [seedRewardFeedback, setSeedRewardFeedback] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  useEffect(() => {
    const allowedTabs = new Set(["quests", "achievements", "stats"]);
    if (!allowedTabs.has(activeTab)) {
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
    staleTime: 10 * 60 * 1000, // 10 Minuten - statische Daten
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', user?.id],
    queryFn: () => Query.UserAchievement.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => Query.Quest.list('quest_number'),
    staleTime: 10 * 60 * 1000, // 10 Minuten - statische Daten
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests', user?.id],
    queryFn: () => Query.UserQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => Query.WeeklyQuest.list('quest_number'),
    staleTime: 10 * 60 * 1000, // 10 Minuten
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ['userWeeklyQuests', user?.id],
    queryFn: () => Query.UserWeeklyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => Query.MonthlyQuest.list('quest_number'),
    staleTime: 10 * 60 * 1000, // 10 Minuten
  });

  const { data: userMonthlyQuests = [] } = useQuery({
    queryKey: ['userMonthlyQuests', user?.id],
    queryFn: () => Query.UserMonthlyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Query.Reward.list(),
    staleTime: 10 * 60 * 1000, // 10 Minuten - statische Daten
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
    enabled: !!user?.id
  });

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ['userDiscoveries', user?.id],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => Query.UserPlantDiscovery.list('-created_date', 1500),
    staleTime: 60 * 1000,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['allProfilesForStats'],
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 60 * 1000,
  });

  const { data: allFriendRecords = [] } = useQuery({
    queryKey: ['allFriendRecordsForStats', user?.email],
    queryFn: () => Query.Friend.list(),
    enabled: !!user?.email,
    staleTime: 15 * 1000,
  });

  const { data: allRobotPlants = [] } = useQuery({
    queryKey: ['allRobotPlantsForStats'],
    queryFn: () => Query.RobotPlant.list(),
    staleTime: 60 * 1000,
  });

  const { data: globalScanLeaderboard = null } = useQuery({
    queryKey: ['globalScanLeaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_global_scan_leaderboard');
      if (error) {
        if (isMissingRpcFunctionError(error)) {
          console.warn('[AchievementsPage] get_global_scan_leaderboard not available yet, using discovery fallback.');
          return null;
        }
        throw error;
      }
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
  });

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

      const grantedBalance = Number(grantResult?.result?.new_balance ?? grantResult?.result?.newBalance);
      const grantedEnergy = Number(grantResult?.result?.new_energy ?? grantResult?.result?.newEnergy);
      const grantedDataQuality = Number(
        grantResult?.result?.new_data_quality ?? grantResult?.result?.newDataQuality
      );
      const grantedCare = Number(grantResult?.result?.new_care ?? grantResult?.result?.newCare);

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

      // Quest einlösen – verwende nur vorhandene Legacy-Felder (redeemed, redeemed_date)
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
            title: "🎨 Personalisiere dein Profil!",
            message: "Du hast deine erste Quest gemeistert! Zeit, dein Profil zu verschönern.",
            description: "Tippe auf dein Profilbild auf der Startseite und wähle einen Hintergrund aus.",
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
      const seedRewardLabel = `${questSeedReward} Samen`;
      const rewardLabel = bonusRewardLabel ? `${seedRewardLabel} + ${bonusRewardLabel}` : seedRewardLabel;

      navigate(location.pathname + location.search, {
        state: {
          ...(location.state || {}),
          questFeedback: {
            type: "questCompleted",
            questTitle,
            rewardName: rewardLabel,
            seedReward: questSeedReward,
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

    onHeaderMetaChange({
      title: activeTab === "quests" ? "Aufgaben" : activeTab === "achievements" ? "Erfolge" : "Statistik",
      subtitle: activeTab === "stats" ? "Deine Scan-Insights und Vergleich mit Freunden" : "Dein Fortschritt im Ueberblick",
    });
  }, [
    embedded,
    onHeaderMetaChange,
    activeTab,
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
  const currentWeeklyUserQuest = currentWeeklyQuest ?
  userWeeklyQuests.find((uwq) => uwq.weekly_quest_id === currentWeeklyQuest.id) :
  null;
  const weeklyReward = currentWeeklyQuest ? rewards.find(r => r.name === currentWeeklyQuest.reward_name) : null;
  const weeklySeedReward = currentWeeklyQuest
    ? resolveQuestSeedReward({ questType: 'weekly', seedReward: currentWeeklyQuest.seed_reward })
    : resolveQuestSeedReward({ questType: 'weekly', seedReward: null });
  const weeklyRewardDisplayName = weeklyReward?.display_name ? `${weeklySeedReward} Samen + ${weeklyReward.display_name}` : `${weeklySeedReward} Samen`;
  const activeWeeklyQuest = currentWeeklyQuest && currentWeeklyUserQuest && isActiveOrCompleted(currentWeeklyUserQuest) && !(currentWeeklyUserQuest.status === 'redeemed' || currentWeeklyUserQuest.redeemed) ?
  {
    ...currentWeeklyQuest,
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

  const renderQuestTargetBadges = (quest) => {
    if (!quest) return null;
    if (!quest.target_species_name && !quest.target_genus_name) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mb-2">
        {quest.target_species_name && (
            <Badge variant="outline" className={`border-2 ${questTargetBadgeClass} font-bold`}>
            🎯 Ziel: {quest.target_species_name}
          </Badge>
        )}
        {quest.target_genus_name && !quest.target_species_name && (
            <Badge variant="outline" className={`border-2 ${questTargetBadgeClass} font-bold`}>
            🎯 Ziel: {quest.target_genus_name}
          </Badge>
        )}
      </div>
    );
  };

  const ownEmailLower = user?.email?.toLowerCase() || "";
  const ownAuthId = user?.id || null;

  const discoveryDate = (entry) => {
    const raw = entry?.created_date || entry?.discovered_date || entry?.updated_date;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const monthKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  const nowDate = new Date();
  const currentMonthKey = monthKey(nowDate);
  const previousMonthDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
  const previousMonthKey = monthKey(previousMonthDate);

  const ownDiscoveriesList = (userDiscoveries || []).filter((entry) => !!discoveryDate(entry));
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

  (allDiscoveries || []).forEach((entry) => {
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
  (allDiscoveries || []).forEach((entry) => {
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

  const emailByAuthIdFromDiscoveries = new Map();
  (allDiscoveries || []).forEach((entry) => {
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

  const globalSeedRanking = (allRobotPlants || [])
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

  const ownSeedRank = globalSeedRanking.findIndex((entry) => entry.isOwn) + 1;
  const ownSeeds = globalSeedRanking.find((entry) => entry.isOwn)?.seeds ?? 0;

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

  const achievementsContentClass = embedded ? "mt-0 px-4 pb-20 flex-1 min-h-0 overflow-y-auto" : "pt-36 px-4 pb-4";
  const statsContentClass = embedded ? "mt-0 px-4 pb-20 flex-1 min-h-0 overflow-y-auto" : "pt-36 px-4 pb-4";
  const questsContentClass = embedded ? "mt-0 px-4 pb-20 flex-1 min-h-0 overflow-y-auto overflow-x-hidden" : "pt-44 px-4 pb-4 overflow-x-hidden";
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
  const statsCardBaseClass = isLightUi
    ? "border bg-white/90 backdrop-blur-sm"
    : "border bg-black/35 backdrop-blur-sm";
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className={embedded ? "w-full h-full min-h-0 flex flex-col" : "w-full"}>
          <div className={`${tabsHeaderClass} ${embedded ? "shrink-0" : ""}`}>
            <div className="max-w-7xl mx-auto">
              {!embedded && (
                <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-stone-900 truncate">
                      {activeTab === "quests" ? "Aufgaben" : activeTab === "achievements" ? "Erfolge" : "Statistik"}
                    </h1>
                    <p className="text-xs text-stone-600 truncate">
                      {activeTab === "stats" ? "Deine Scan-Insights und Vergleich mit Freunden" : "Dein Fortschritt im Ueberblick"}
                    </p>
                  </div>
                  <Badge className="bg-stone-800 text-white text-[10px] px-2 py-1 shrink-0">
                    {activeTab === "quests" ? `${activeQuests.length} aktiv` : activeTab === "achievements" ? `${unlockedCount}/${achievements.length}` : `${totalScans} Scans`}
                  </Badge>
                </div>
              )}
              <div className={`w-full px-2 py-2 ${embedded ? "bg-transparent" : "bg-white"}`}>
                <div className="grid grid-cols-3 gap-2 min-w-0">
                  {moduleChips.map((chip) => {
                    const isPrimary = activeTab === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setActiveTab(chip.id)}
                        className={
                          "relative flex items-center justify-center gap-2 px-2 py-1.5 rounded-full border text-[11px] whitespace-nowrap transition-colors min-w-0 " +
                          (isPrimary
                            ? (isLightUi
                              ? "bg-white/90 text-[#8f6b22] shadow-sm"
                              : "bg-black/55 text-[#f7f0c1] shadow-sm")
                            : (isLightUi
                              ? "bg-white/55 text-stone-700 hover:bg-white/75"
                              : "bg-black/35 text-stone-200 hover:bg-black/50"))
                        }
                        style={{
                          borderColor: isPrimary
                            ? (isLightUi ? "rgba(200,172,98,0.70)" : "rgba(240,229,165,0.75)")
                            : (isLightUi ? "rgba(200,172,98,0.35)" : "rgba(255,255,255,0.3)"),
                        }}
                      >
                        <span className="font-medium truncate">{chip.title}</span>
                        {chip.id === "quests" && showQuestNotification && (
                          <span
                            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border border-white/80"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              
            </div>
          </div>

          {/* Erfolge Tab */}
          <TabsContent value="achievements" className={achievementsContentClass} style={embeddedContentMaskStyle}>

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
          </TabsContent>

          <TabsContent value="stats" className={statsContentClass} style={embeddedContentMaskStyle}>
            <div className="max-w-6xl mx-auto space-y-4" style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className={`${statsCardBaseClass} ${isLightUi ? "border-amber-200" : "border-amber-300/35"}`}>
                  <CardContent className="p-4">
                    <p className={`text-xs uppercase tracking-wide ${statsLabelClass}`}>Samen insgesamt</p>
                    <p className={`text-2xl font-bold mt-1 ${isLightUi ? "text-amber-700" : "text-amber-300"}`}>{ownSeeds.toLocaleString()}</p>
                    <p className={`text-xs mt-1 ${statsBodyClass}`}>Aktueller Samenstand</p>
                  </CardContent>
                </Card>

                <Card className={`${statsCardBaseClass} ${isLightUi ? "border-emerald-200" : "border-emerald-300/35"}`}>
                  <CardContent className="p-4">
                    <p className={`text-xs uppercase tracking-wide ${statsLabelClass}`}>Scans insgesamt</p>
                    <p className={`text-2xl font-bold mt-1 ${isLightUi ? "text-emerald-700" : "text-emerald-300"}`}>{totalScans}</p>
                    <p className={`text-xs mt-1 ${statsBodyClass}`}>{activeDaysSet.size} aktive Tage</p>
                  </CardContent>
                </Card>

                <Card className={`${statsCardBaseClass} ${isLightUi ? "border-blue-200" : "border-blue-300/35"}`}>
                  <CardContent className="p-4">
                    <p className={`text-xs uppercase tracking-wide ${statsLabelClass}`}>Haeufigster Scan</p>
                    <p className={`text-sm font-bold mt-1 truncate ${statsTitleClass}`}>{topSpeciesEntry?.[0] || "Noch keine Daten"}</p>
                    <p className={`text-xs mt-1 ${isLightUi ? "text-blue-700" : "text-blue-300"}`}>{topSpeciesEntry ? `${topSpeciesEntry[1]}x gescannt` : "Scanne mehr Pflanzen"}</p>
                  </CardContent>
                </Card>

                <Card className={`${statsCardBaseClass} ${isLightUi ? "border-purple-200" : "border-purple-300/35"}`}>
                  <CardContent className="p-4">
                    <p className={`text-xs uppercase tracking-wide ${statsLabelClass}`}>Top-Genus</p>
                    <p className={`text-sm font-bold mt-1 truncate ${statsTitleClass}`}>{topGenusEntry?.[0] || "Noch keine Daten"}</p>
                    <p className={`text-xs mt-1 ${isLightUi ? "text-purple-700" : "text-purple-300"}`}>{topGenusEntry ? `${topGenusEntry[1]}x gescannt` : "Scanne mehr Pflanzen"}</p>
                  </CardContent>
                </Card>

                <Card className={`${statsCardBaseClass} ${isLightUi ? "border-amber-200" : "border-amber-300/35"}`}>
                  <CardContent className="p-4">
                    <p className={`text-xs uppercase tracking-wide ${statsLabelClass}`}>Monats-Trend</p>
                    <p className={`text-2xl font-bold mt-1 ${statsTitleClass}`}>{currentMonthScans}</p>
                    <p className={`text-xs mt-1 ${monthTrendDelta >= 0 ? (isLightUi ? "text-emerald-700" : "text-emerald-300") : (isLightUi ? "text-rose-700" : "text-rose-300")}`}>
                      {monthTrendDelta >= 0 ? "+" : ""}{monthTrendDelta} vs. letzter Monat
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Card className={`${statsCardBaseClass} ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/25"}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className={`text-base flex items-center gap-2 ${statsTitleClass}`}>
                      <Users className={`w-4 h-4 ${isLightUi ? "text-indigo-600" : "text-indigo-300"}`} />
                      Scan-Vergleich (Global)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className={`rounded-lg border px-3 py-2 ${isLightUi ? "border-indigo-200 bg-indigo-50" : "border-indigo-300/40 bg-indigo-500/10"}`}>
                      <p className={`text-xs ${isLightUi ? "text-indigo-700" : "text-indigo-200"}`}>Dein globaler Rang</p>
                      <p className={`text-lg font-bold ${isLightUi ? "text-indigo-900" : "text-indigo-100"}`}>
                        {ownGlobalScanRank > 0 ? `#${ownGlobalScanRank} von ${effectiveGlobalScanRanking.length}` : "Noch kein Rang"}
                      </p>
                    </div>

                    {effectiveGlobalScanRanking.length === 0 && (
                      <p className={`text-sm ${statsBodyClass}`}>Noch keine Vergleichsdaten verfügbar.</p>
                    )}

                    {/* Top 5 + eigener Eintrag falls außerhalb */}
                    {(() => {
                      const top5 = effectiveGlobalScanRanking.slice(0, 5);
                      const ownInTop5 = top5.some((e) => e.email === ownEmailLower);
                      const ownEntry = !ownInTop5 && ownGlobalScanRank > 0 ? effectiveGlobalScanRanking[ownGlobalScanRank - 1] : null;
                      return (
                        <>
                          {top5.map((entry, index) => (
                            <div
                              key={entry.email}
                              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${entry.email === ownEmailLower ? rankingHighlightClass : rankingDefaultClass}`}
                            >
                              <button
                                type="button"
                                onClick={() => navigateToPublicProfile(entry.email)}
                                className={`p-0 m-0 bg-transparent border-0 text-sm font-semibold truncate text-left ${statsTitleClass}`}
                              >
                                #{index + 1} {entry.name}
                              </button>
                              <Badge className={entry.email === ownEmailLower ? (isLightUi ? "bg-emerald-600 text-white" : "bg-emerald-700 text-white border border-emerald-400/60") : rankingDefaultBadgeClass}>{entry.scans}x</Badge>
                            </div>
                          ))}
                          {ownEntry && (
                            <>
                              <p className={`text-xs text-center ${statsBodyClass}`}>…</p>
                              <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${rankingHighlightClass}`}>
                                <button
                                  type="button"
                                  onClick={() => navigateToPublicProfile(ownEntry.email)}
                                  className={`p-0 m-0 bg-transparent border-0 text-sm font-semibold truncate text-left ${statsTitleClass}`}
                                >
                                  #{ownGlobalScanRank} {ownEntry.name}
                                </button>
                                <Badge className={isLightUi ? "bg-emerald-600 text-white" : "bg-emerald-700 text-white border border-emerald-400/60"}>{ownEntry.scans}x</Badge>
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card className={`${statsCardBaseClass} ${isLightUi ? "border-amber-200" : "border-amber-300/30"}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className={`text-base flex items-center gap-2 ${statsTitleClass}`}>
                      <span className={isLightUi ? "text-amber-600" : "text-amber-300"}>🌱</span>
                      Samenstand-Vergleich (Global)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className={`rounded-lg border px-3 py-2 ${isLightUi ? "border-amber-200 bg-amber-50" : "border-amber-300/40 bg-amber-500/10"}`}>
                      <p className={`text-xs ${isLightUi ? "text-amber-700" : "text-amber-200"}`}>Dein globaler Rang</p>
                      <p className={`text-lg font-bold ${isLightUi ? "text-amber-900" : "text-amber-100"}`}>
                        {ownSeedRank > 0 ? `#${ownSeedRank} von ${globalSeedRanking.length}` : "Noch kein Rang"}
                      </p>
                      {ownSeedRank > 0 && (
                        <p className={`text-xs mt-0.5 ${isLightUi ? "text-amber-700" : "text-amber-300"}`}>{ownSeeds.toLocaleString()} Samen</p>
                      )}
                    </div>

                    {globalSeedRanking.length === 0 && (
                      <p className={`text-sm ${statsBodyClass}`}>Noch keine Vergleichsdaten verfügbar.</p>
                    )}

                    {/* Top 5 + eigener Eintrag falls außerhalb */}
                    {(() => {
                      const top5 = globalSeedRanking.slice(0, 5);
                      const ownInTop5 = top5.some((e) => e.isOwn);
                      const ownEntry = !ownInTop5 && ownSeedRank > 0 ? globalSeedRanking[ownSeedRank - 1] : null;
                      return (
                        <>
                          {top5.map((entry, index) => (
                            <div
                              key={entry.authId}
                              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${entry.isOwn ? rankingHighlightClass : rankingDefaultClass}`}
                            >
                              <button
                                type="button"
                                onClick={() => navigateToPublicProfile(entry.email)}
                                disabled={!entry.email}
                                className={`p-0 m-0 bg-transparent border-0 text-sm font-semibold truncate text-left ${entry.email ? "cursor-pointer" : "cursor-default"} ${statsTitleClass}`}
                              >
                                #{index + 1} {entry.name}
                              </button>
                              <Badge className={entry.isOwn ? (isLightUi ? "bg-amber-600 text-white" : "bg-amber-700 text-white border border-amber-400/60") : rankingDefaultBadgeClass}>{entry.seeds.toLocaleString()} 🌱</Badge>
                            </div>
                          ))}
                          {ownEntry && (
                            <>
                              <p className={`text-xs text-center ${statsBodyClass}`}>…</p>
                              <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${rankingHighlightClass}`}>
                                <button
                                  type="button"
                                  onClick={() => navigateToPublicProfile(ownEntry.email)}
                                  disabled={!ownEntry.email}
                                  className={`p-0 m-0 bg-transparent border-0 text-sm font-semibold truncate text-left ${ownEntry.email ? "cursor-pointer" : "cursor-default"} ${statsTitleClass}`}
                                >
                                  #{ownSeedRank} {ownEntry.name}
                                </button>
                                <Badge className={isLightUi ? "bg-amber-600 text-white" : "bg-amber-700 text-white border border-amber-400/60"}>{ownEntry.seeds.toLocaleString()} 🌱</Badge>
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Aufgaben Tab */}
          <TabsContent value="quests" className={questsContentClass} style={embeddedContentMaskStyle}>
            <div className={`max-w-6xl mx-auto ${embedded ? "space-y-6" : "space-y-4"}`} style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>
                  {activeQuests.length > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {activeQuests.map((quest, index) => {
                        const rawProgress = quest.progress || 0;
                        const target = quest.required_discoveries || 0;
                        const displayProgress = target > 0 ? Math.min(rawProgress, target) : rawProgress;
                        const progressPercentage = target > 0 ? Math.min(100, (rawProgress / target) * 100) : 0;

                        return (
                          <motion.div
                            key={quest.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="min-w-0"
                          >
                            <Card className={`relative w-full min-w-0 overflow-hidden border-2 shadow-sm backdrop-blur-sm hover:shadow-md transition-all ${questCardSurfaceClass} ${questBorderClass(quest)}`}>
                              <div className="absolute inset-0 bg-black/35 pointer-events-none" />
                              <CardContent className="relative z-10 p-3">
                                <div className="flex items-start gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${questIconClass(quest)}`}>
                                    {quest.isCompleted ? <CheckCircle2 className="w-4 h-4 text-white" /> : quest.type === "collection" ? <span className="text-sm">{quest.icon_emoji || "🗺️"}</span> : <Target className="w-4 h-4 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                                        {quest.isCompleted && <Badge className={`${questCompletedBadgeClass} text-[10px] px-1 py-0`}>✓ Abgeschlossen</Badge>}
                                        {quest.type === "weekly" && <Badge className={`${questWeeklyBadgeClass} text-[10px] px-1 py-0`}>📅 Wöchentlich</Badge>}
                                        {quest.type === "monthly" && <Badge className={`${questMonthlyBadgeClass} text-[10px] px-1 py-0`}>📆 Monatlich</Badge>}
                                        {quest.type === "collection" && <Badge className={`${questCollectionBadgeClass} text-[10px] px-1 py-0`}>🗺️ Sammlung</Badge>}
                                      {quest.category && quest.category !== "Alle" && (
                                          <Badge className={`text-[10px] px-1 py-0 ${questCategoryBadgeClass(quest.category)}`}>
                                          {quest.category}
                                        </Badge>
                                      )}
                                    </div>
                                    <h3 className={`text-sm font-bold mb-1 ${questTitleClass}`}>{quest.title}</h3>
                                    <div className="mb-2 max-h-16 overflow-y-auto pr-1">
                                      <p className={`text-xs ${questBodyClass}`}>{quest.description}</p>
                                    </div>
                                    {renderQuestTargetBadges(quest)}

                                    {quest.required_discoveries && (
                                      <div className="space-y-1 mb-2">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className={questMetaClass}>Fortschritt</span>
                                            <span className={`font-bold ${questProgressTextClass}`}>{displayProgress} / {quest.required_discoveries}</span>
                                        </div>
                                        <Progress value={progressPercentage} className="h-1.5" />
                                      </div>
                                    )}

                                    {quest.isCompleted && (
                                      <div className={`space-y-1 pt-1.5 border-t ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/25"}`}>
                                        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                                          {quest.rewardDisplayName && (
                                            <div className={`min-w-0 w-full sm:flex-1 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${questRewardBlockClass}`}>
                                              <Gift className="w-3 h-3 flex-shrink-0" />
                                              <span className="truncate font-semibold">{quest.rewardDisplayName}</span>
                                            </div>
                                          )}
                                          {quest.canRedeem ? (
                                            <Button
                                              onClick={() => {
                                                const allCompletedQuests = [...userQuests, ...userWeeklyQuests, ...userMonthlyQuests, ...userCollectionQuests].filter((q) => q.redeemed);
                                                const isFirstQuest = allCompletedQuests.length === 0;

                                                redeemQuestMutation.mutate({
                                                  userQuestId: quest.userQuestId,
                                                  questType: quest.type,
                                                  rewardName: quest.rewardData?.name,
                                                  seedReward: quest.seedReward,
                                                  isFirstQuest,
                                                  questTitle: quest.title,
                                                });
                                              }}
                                              disabled={redeemQuestMutation.isPending}
                                              size="sm"
                                              className={`h-6 w-full sm:w-auto shrink-0 px-2 text-[11px] ${questRedeemBtnClass}`}
                                            >
                                              Einlösen
                                            </Button>
                                          ) : (
                                            <span className={`text-[11px] italic ${questMetaClass}`}>Bereits eingelöst</span>
                                          )}
                                        </div>
                                        {quest.completedAt && (
                                          <span className={`block text-[11px] ${questMetaClass}`}>
                                            Abgeschlossen am {format(new Date(quest.completedAt), "dd.MM.yyyy", { locale: de })}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {completedQuests.length > 0 && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => setShowCompleted((prev) => !prev)}
                        style={{
                          color: averageColor && isColorDark(averageColor) ? "rgb(250, 250, 249)" : "rgb(28, 25, 23)",
                        }}
                      >
                        <h3 className="text-sm font-semibold">Abgeschlossene Aufgaben</h3>
                        <span className="text-xs opacity-80">{showCompleted ? "▾" : "▸"}</span>
                      </button>

                      {showCompleted && (
                        <div className="grid md:grid-cols-2 gap-4 min-w-0">
                          {completedQuests.map((quest, index) => {
                            const rawProgress = quest.progress || 0;
                            const target = quest.required_discoveries || 0;
                            const displayProgress = target > 0 ? Math.min(rawProgress, target) : rawProgress;
                            const progressPercentage = target > 0 ? Math.min(100, (rawProgress / target) * 100) : 0;

                            return (
                              <motion.div
                                key={`${quest.type}-${quest.userQuestId || quest.id}-${index}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="min-w-0"
                              >
                                <Card className={`relative w-full min-w-0 overflow-hidden border-2 shadow-sm backdrop-blur-sm transition-all opacity-70 ${questCardSurfaceClass} ${questBorderClass(quest)}`}>
                                  <div className="absolute inset-0 bg-black/35 pointer-events-none" />
                                  <CardContent className="relative z-10 p-3">
                                    <div className="flex items-start gap-2">
                                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-stone-400">
                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                                          <Badge className="bg-stone-500 text-white text-[10px] px-1 py-0">✓ Abgeschlossen</Badge>
                                            {quest.type === "weekly" && <Badge className={`${questWeeklyBadgeClass} text-[10px] px-1 py-0`}>📅 Wöchentlich</Badge>}
                                            {quest.type === "monthly" && <Badge className={`${questMonthlyBadgeClass} text-[10px] px-1 py-0`}>📆 Monatlich</Badge>}
                                            {quest.type === "collection" && <Badge className={`${questCollectionBadgeClass} text-[10px] px-1 py-0`}>🗺️ Sammlung</Badge>}
                                          {quest.category && quest.category !== "Alle" && (
                                              <Badge className={`text-[10px] px-1 py-0 ${questCategoryBadgeClass(quest.category)}`}>
                                              {quest.category}
                                            </Badge>
                                          )}
                                        </div>
                                        <h3 className={`text-sm font-bold mb-1 ${questTitleClass}`}>{quest.title}</h3>
                                        <div className="mb-2 max-h-16 overflow-y-auto pr-1">
                                          <p className={`text-xs ${questBodyClass}`}>{quest.description}</p>
                                        </div>
                                        {renderQuestTargetBadges(quest)}

                                        {quest.required_discoveries && (
                                          <div className="space-y-1 mb-2">
                                            <div className="flex items-center justify-between text-xs">
                                              <span className={questMetaClass}>Fortschritt</span>
                                                <span className={`font-bold ${questProgressTextClass}`}>{displayProgress} / {quest.required_discoveries}</span>
                                            </div>
                                            <Progress value={progressPercentage} className="h-1.5" />
                                          </div>
                                        )}

                                        <div className={`space-y-1 pt-1.5 border-t ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/25"}`}>
                                          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                                            {quest.rewardDisplayName && (
                                              <div className={`min-w-0 w-full sm:flex-1 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${questRewardBlockClass}`}>
                                                <Gift className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate font-semibold">{quest.rewardDisplayName}</span>
                                              </div>
                                            )}
                                            <span className={`text-[11px] italic ${questMetaClass}`}>Bereits eingelöst</span>
                                          </div>
                                          {quest.completedAt && (
                                            <span className={`block text-[11px] ${questMetaClass}`}>
                                              Abgeschlossen am {format(new Date(quest.completedAt), "dd.MM.yyyy", { locale: de })}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {!hasAnyQuestData && (
                    <div className="text-center py-20">
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                        <Target className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-stone-900 mb-2">Keine aktiven Aufgaben</h3>
                        <p className="text-stone-600">Alle Aufgaben bereits eingelöst!</p>
                      </div>
                    </div>
                  )}

            </div>
          </TabsContent>
        </Tabs>
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

