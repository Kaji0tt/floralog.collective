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
  isLightUi,
  onHeaderMetaChange,
  onRequestClose: _onRequestClose = null,
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "quests");
  const [questFeedback, setQuestFeedback] = useState(null);
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
      setActiveTab("quests");
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
      // Re-fetch user data to ensure `user` state reflects the change immediately
      const currentUser = await getCurrentUser();
      setUser(currentUser);
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
		  mutationFn: async ({ userQuestId, questType, rewardName, isFirstQuest, questTitle }) => {
      console.log('[QuestRedeem] Starting redeem for:', questType, rewardName);
      const now = new Date().toISOString();

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

      const currentUser = await getCurrentUser();
      
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
      const rewardLabel = rewardName
        ? (rewards.find(r => r.name === rewardName)?.display_name || rewardName)
        : null;

      navigate(location.pathname + location.search, {
        state: {
          ...(location.state || {}),
          questFeedback: {
            type: "questCompleted",
            questTitle,
            rewardName: rewardLabel,
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
    if (selectedAchievement?.selectedReward?.value) {
      updateTitleMutation.mutate(selectedAchievement.selectedReward.value);
    }
  };

  const unlockedCount = achievements.filter((a) =>
    userAchievements.some((ua) => ua.achievement_id === a.id)
  ).length;

  useEffect(() => {
    if (!embedded || typeof onHeaderMetaChange !== "function") return;

    const infoLabel = activeTab === "quests"
      ? `${userQuests.length + userWeeklyQuests.length + userMonthlyQuests.length} Quests`
      : activeTab === "achievements"
        ? `${unlockedCount}/${achievements.length} Erfolge`
        : `${userDiscoveries.length} Scans`;

    onHeaderMetaChange({
      title: activeTab === "quests" ? "Aufgaben" : activeTab === "achievements" ? "Erfolge" : "Statistik",
      subtitle: activeTab === "stats" ? "Deine Scan-Insights und Vergleich mit Freunden" : "Dein Fortschritt im Ueberblick",
      infoLabel,
    });
  }, [
    embedded,
    onHeaderMetaChange,
    activeTab,
    userQuests.length,
    userWeeklyQuests.length,
    userMonthlyQuests.length,
    unlockedCount,
    achievements.length,
    userDiscoveries.length,
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
          onComplete={() => setQuestFeedback(null)}
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
    return {
      ...q,
      userQuestId: userQuest?.id,
      progress: userQuest?.progress || 0,
      isCompleted: isCompletedStatus(userQuest),
      type: 'regular',
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
    return {
      ...q,
      userQuestId: userQuest?.id,
      progress: userQuest?.progress || q.required_discoveries || 0,
      isCompleted: true,
      type: 'regular',
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
  const activeWeeklyQuest = currentWeeklyQuest && currentWeeklyUserQuest && isActiveOrCompleted(currentWeeklyUserQuest) && !(currentWeeklyUserQuest.status === 'redeemed' || currentWeeklyUserQuest.redeemed) ?
  {
    ...currentWeeklyQuest,
    userQuestId: currentWeeklyUserQuest.id,
    progress: currentWeeklyUserQuest.progress || 0,
    isCompleted: isCompletedStatus(currentWeeklyUserQuest),
    type: 'weekly',
    rewardData: weeklyReward,
    canRedeem: isCompletedStatus(currentWeeklyUserQuest) && !isRedeemedStatus(currentWeeklyUserQuest)
  } :
  null;
  // Monatliche Quest
  const currentMonthlyUserQuest = currentMonthlyQuest ?
  userMonthlyQuests.find((umq) => umq.monthly_quest_id === currentMonthlyQuest.id) :
  null;
  const monthlyReward = currentMonthlyQuest ? rewards.find(r => r.name === currentMonthlyQuest.reward_name) : null;
  const activeMonthlyQuest = currentMonthlyQuest && currentMonthlyUserQuest && isActiveOrCompleted(currentMonthlyUserQuest) && !(currentMonthlyUserQuest.status === 'redeemed' || currentMonthlyUserQuest.redeemed) ?
  {
    ...currentMonthlyQuest,
    userQuestId: currentMonthlyUserQuest.id,
    progress: currentMonthlyUserQuest.progress || 0,
    isCompleted: isCompletedStatus(currentMonthlyUserQuest),
    type: 'monthly',
    rewardData: monthlyReward,
    canRedeem: isCompletedStatus(currentMonthlyUserQuest) && !isRedeemedStatus(currentMonthlyUserQuest)
  } :
  null;
  // Abgeschlossene & eingelöste wöchentliche Quests (Historie)
  const completedWeeklyQuests = weeklyQuests.flatMap((quest) => {
    const reward = rewards.find(r => r.name === quest.reward_name);
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
      rewardData: reward,
      canRedeem: false,
      completedAt: uwq.redeemed_date || uwq.completed_date,
      active_week: uwq.active_week
    }));
  });

  // Abgeschlossene & eingelöste monatliche Quests (Historie)
  const completedMonthlyQuests = monthlyQuests.flatMap((quest) => {
    const reward = rewards.find(r => r.name === quest.reward_name);
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

  const moduleChips = [
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
    {
      id: "stats",
      title: "Statistik",
      active: totalScans,
      total: totalScans,
    },
  ];

  const tabsHeaderClass = embedded
    ? `sticky top-0 z-40 backdrop-blur-sm border-b ${isLightUi ? "bg-white/70 border-[#b99a48]/30" : "bg-black/20 border-[#f0e5a5]/20"}`
    : "fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-stone-200";

  const achievementsContentClass = embedded ? "mt-0 px-4 pb-20 flex-1 min-h-0 overflow-y-auto" : "pt-36 px-4 pb-4";
  const statsContentClass = embedded ? "mt-0 px-4 pb-20 flex-1 min-h-0 overflow-y-auto" : "pt-36 px-4 pb-4";
  const questsContentClass = embedded ? "mt-0 px-4 pb-20 flex-1 min-h-0 overflow-y-auto" : "pt-44 px-4 pb-4";
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
                          "flex items-center justify-center gap-2 px-2 py-1.5 rounded-full border text-[11px] whitespace-nowrap transition-colors min-w-0 " +
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
                          <span className="w-2 h-2 rounded-full bg-red-500 border border-white/70" />
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
                    const isCurrentTitle = achievementReward?.type === 'title' && user.selected_title === achievementReward.value;

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

                                  `Titel: ${achievementReward.value}`
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
                <Card className={`${statsCardBaseClass} ${isLightUi ? "border-emerald-200" : "border-emerald-300/35"}`}>
                  <CardContent className="p-4">
                    <p className={`text-xs uppercase tracking-wide ${statsLabelClass}`}>Gesamt-Scans</p>
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
                      Social Vergleich (Scans)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className={`rounded-lg border px-3 py-2 ${isLightUi ? "border-indigo-200 bg-indigo-50" : "border-indigo-300/40 bg-indigo-500/10"}`}>
                      <p className={`text-xs ${isLightUi ? "text-indigo-700" : "text-indigo-200"}`}>Dein Rang</p>
                      <p className={`text-lg font-bold ${isLightUi ? "text-indigo-900" : "text-indigo-100"}`}>
                        {ownRank > 0 ? `#${ownRank} von ${socialRanking.length}` : "Noch kein Rang"}
                      </p>
                    </div>

                    {socialRanking.length === 0 && (
                      <p className={`text-sm ${statsBodyClass}`}>Noch keine Vergleichsdaten verfuegbar.</p>
                    )}

                    {socialRanking.slice(0, 5).map((entry, index) => (
                      <div
                        key={entry.email}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 ${entry.email === ownEmailLower ? rankingHighlightClass : rankingDefaultClass}`}
                      >
                        <p className={`text-sm font-semibold truncate ${statsTitleClass}`}>#{index + 1} {entry.name}</p>
                        <Badge className={entry.email === ownEmailLower ? (isLightUi ? "bg-emerald-600 text-white" : "bg-emerald-700 text-white border border-emerald-400/60") : rankingDefaultBadgeClass}>{entry.scans}x</Badge>
                      </div>
                    ))}
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
                          >
                            <Card className={`relative overflow-hidden border-2 shadow-sm backdrop-blur-sm hover:shadow-md transition-all ${questCardSurfaceClass} ${questBorderClass(quest)}`}>
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
                                    <p className={`text-xs mb-2 ${questBodyClass}`}>{quest.description}</p>
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
                                      <div className={`space-y-2 pt-2 border-t ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/25"}`}>
                                        {quest.rewardData && (
                                            <div className={`flex items-center gap-1 text-xs ${questRewardBlockClass} rounded-lg px-2 py-1`}>
                                            <Gift className="w-3 h-3" />
                                            <span className="font-semibold">{quest.rewardData.display_name}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                          {quest.completedAt && <span className={`text-[11px] ${questMetaClass}`}>Abgeschlossen am {format(new Date(quest.completedAt), "dd.MM.yyyy", { locale: de })}</span>}
                                          <div className="flex justify-end flex-1">
                                            {quest.canRedeem ? (
                                              <Button
                                                onClick={() => {
                                                  const allCompletedQuests = [...userQuests, ...userWeeklyQuests, ...userMonthlyQuests, ...userCollectionQuests].filter((q) => q.redeemed);
                                                  const isFirstQuest = allCompletedQuests.length === 0;

                                                  redeemQuestMutation.mutate({
                                                    userQuestId: quest.userQuestId,
                                                    questType: quest.type,
                                                    rewardName: quest.rewardData?.name,
                                                    isFirstQuest,
                                                    questTitle: quest.title,
                                                  });
                                                }}
                                                disabled={redeemQuestMutation.isPending}
                                                size="sm"
                                                  className={`h-7 text-xs ${questRedeemBtnClass}`}
                                              >
                                                Einlösen
                                              </Button>
                                            ) : (
                                              <span className={`text-[11px] italic ${questMetaClass}`}>Bereits eingelöst</span>
                                            )}
                                          </div>
                                        </div>
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
                        <div className="grid md:grid-cols-2 gap-4">
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
                              >
                                <Card className={`relative overflow-hidden border-2 shadow-sm backdrop-blur-sm transition-all opacity-70 ${questCardSurfaceClass} ${questBorderClass(quest)}`}>
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
                                        <p className={`text-xs mb-2 ${questBodyClass}`}>{quest.description}</p>
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

                                        <div className={`space-y-1 pt-2 border-t ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/25"}`}>
                                          {quest.rewardData && (
                                              <div className={`flex items-center gap-1 text-xs ${questRewardBlockClass} rounded-lg px-2 py-1`}>
                                              <Gift className="w-3 h-3" />
                                              <span className="font-semibold">{quest.rewardData.display_name}</span>
                                            </div>
                                          )}
                                          <div className="flex items-center justify-between">
                                            {quest.completedAt && <span className={`text-[11px] ${questMetaClass}`}>Abgeschlossen am {format(new Date(quest.completedAt), "dd.MM.yyyy", { locale: de })}</span>}
                                            <span className={`text-[11px] italic ${questMetaClass}`}>Bereits eingelöst</span>
                                          </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Titel ausrüsten</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-stone-700 mb-4">
              Möchtest du den Titel <strong className="text-purple-700">"{selectedAchievement?.selectedReward?.value}"</strong> ausrüsten?
            </p>
            <p className="text-sm text-stone-500 mb-6">
              Dieser Titel wird in deinem Profil und auf der Startseite angezeigt.
            </p>
            <div className="flex gap-3">
              <Button
                  variant="outline"
                  onClick={() => setShowTitleDialog(false)}
                  className="flex-1">

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

