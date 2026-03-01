import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Lock, Leaf, Target, CheckCircle2, XCircle, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AnimatePresence } from "framer-motion";
import { getWeekNumber, getMonthString, getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";

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

export default function Achievements() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState("quests");
  const [questFilter, setQuestFilter] = useState("exploration");

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

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

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => Query.CollectionQuest.list(),
    staleTime: 5 * 60 * 1000, // 5 Minuten
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
          mutationFn: async ({ userQuestId, questType, rewardName, isFirstQuest }) => {
      console.log('[QuestRedeem] Starting redeem for:', questType, rewardName);
      const now = new Date().toISOString();

      // Quest einlösen
      if (questType === 'regular') {
        await Query.UserQuest.update(userQuestId, {
          redeemed: true,
          redeemed_date: now,
          status: 'redeemed',
          redeemed_at: now
        });
      } else if (questType === 'weekly') {
        await Query.UserWeeklyQuest.update(userQuestId, {
          redeemed: true,
          redeemed_date: now,
          status: 'redeemed',
          redeemed_at: now
        });
      } else if (questType === 'monthly') {
        await Query.UserMonthlyQuest.update(userQuestId, {
          redeemed: true,
          redeemed_date: now,
          status: 'redeemed',
          redeemed_at: now
        });
      } else if (questType === 'collection') {
        await Query.UserCollectionQuest.update(userQuestId, {
          redeemed: true,
          redeemed_date: now,
          status: 'redeemed',
          redeemed_at: now
        });
      }

      const currentUser = await getCurrentUser();
      
      // DIREKT den Reward freischalten (ohne Achievement-Check)
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

            // Erstelle Notification für den Reward
            const rewardTypeMap = {
              "background": "Hintergrund",
              "title": "Titel",
              "animated_border": "Rahmen",
              "item": "Gegenstand"
            };
            const rewardTypeGerman = rewardTypeMap[reward.type] || "Belohnung";

            await Query.UserNotification.create({
              auth_id: currentUser.id,
              user_email: currentUser.email,
              notification_type: "custom",
              title: `🎁 Neuer ${rewardTypeGerman}!`,
              message: `Du hast ${reward.display_name} freigeschaltet!`,
              priority: "medium",
              display_location: "banner",
              seen: false
            });
          } else {
            console.log('[QuestRedeem] User already has reward:', reward.name);
          }
        }
      }
      
      // Wenn das die erste Quest ist, erstelle eine Notification für Hintergrund-Personalisierung
      if (isFirstQuest) {
        try {
          await Query.UserNotification.create({
            auth_id: currentUser.id,
            user_email: currentUser.email,
            notification_type: "custom",
            title: "🎨 Personalisiere dein Profil!",
            message: "Du hast deine erste Quest gemeistert! Zeit, dein Profil zu verschönern.",
            description: "Tippe auf dein Profilbild auf der Startseite und wähle einen Hintergrund aus.",
            action_url: "Profile",
            priority: "high",
            display_location: "modal",
            seen: false
          });
        } catch (error) {
          console.error("[QuestRedeem] Fehler beim Erstellen der Hintergrund-Notification:", error);
        }
      }
      
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>);

  }

  const unlockedCount = achievements.filter((a) =>
  userAchievements.some((ua) => ua.achievement_id === a.id)
  ).length;

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

  // Sortiere Achievements nach Rarität (niedrigste zuerst)
  const sortedAchievements = [...achievements].sort((a, b) => {
    return getRarityValue(a.rarity) - getRarityValue(b.rarity);
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
      rewardData: reward
    };
  });

  // Verfügbare (nicht angenommene) reguläre Quests
  const availableRegularQuests = quests.
  filter((q) => {
    const userQuest = userQuests.find((uq) => uq.quest_id === q.id);

    // Prüfe Voraussetzung
    let prerequisiteMet = true;
    if (q.prerequisite_quest_number) {
      const prerequisiteQuest = quests.find((pq) => pq.quest_number === q.prerequisite_quest_number);
      if (prerequisiteQuest) {
        const prerequisiteUserQuest = userQuests.find((uq) => uq.quest_id === prerequisiteQuest.id);
        prerequisiteMet = prerequisiteUserQuest?.status
          ? (prerequisiteUserQuest.status === 'redeemed')
          : (prerequisiteUserQuest?.redeemed || false);
      }
    }

    const hasUserQuest = !!userQuest;
    const isAccepted = userQuest?.accepted || !!userQuest?.status;

    return !hasUserQuest || !isAccepted && prerequisiteMet;
  }).
  map((q) => {
    const reward = rewards.find(r => r.name === q.reward_name);
    return {
      ...q,
      type: 'regular',
      available: true,
      rewardData: reward
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
    rewardData: weeklyReward
  } :
  null;
  const availableWeeklyQuest = currentWeeklyQuest && !currentWeeklyUserQuest ?
  { ...currentWeeklyQuest, type: 'weekly', available: true, rewardData: weeklyReward } :
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
    rewardData: monthlyReward
  } :
  null;
  const availableMonthlyQuest = currentMonthlyQuest && !currentMonthlyUserQuest ?
  { ...currentMonthlyQuest, type: 'monthly', available: true, rewardData: monthlyReward } :
  null;

  // Sammlungs-Quests
  const activeCollectionQuests = collectionQuests.
  filter((quest) => {
    const userQuest = userCollectionQuests.find((ucq) => ucq.collection_quest_id === quest.id);
    return quest.is_active && isActiveOrCompleted(userQuest) && !(userQuest?.status === 'redeemed' || userQuest?.redeemed);
  }).
  map((quest) => {
    const userQuest = userCollectionQuests.find((ucq) => ucq.collection_quest_id === quest.id);
    const discoveredPlants = userQuest?.discovered_plants || [];
    return {
      ...quest,
      userQuestId: userQuest?.id,
      progress: discoveredPlants.length,
      required_discoveries: quest.target_plants?.length || 0,
      isCompleted: userQuest?.completed || false,
      type: 'collection'
    };
  });

  const availableCollectionQuests = collectionQuests.
  filter((quest) => {
    const userQuest = userCollectionQuests.find((ucq) => ucq.collection_quest_id === quest.id);
    return quest.is_active && !userQuest?.accepted;
  }).
  map((quest) => ({
    ...quest,
    required_discoveries: quest.target_plants?.length || 0,
    type: 'collection',
    available: true
  }));

  // Quests zusammenstellen basierend auf Filter
  let activeQuests = [];
  let availableQuests = [];

  if (questFilter === 'exploration') {
    activeQuests = [...activeRegularQuests, ...activeCollectionQuests];
    availableQuests = [...availableRegularQuests, ...availableCollectionQuests];
  } else if (questFilter === 'weekly') {
    if (activeWeeklyQuest) activeQuests.push(activeWeeklyQuest);
    if (availableWeeklyQuest) availableQuests.push(availableWeeklyQuest);
  } else if (questFilter === 'monthly') {
    if (activeMonthlyQuest) activeQuests.push(activeMonthlyQuest);
    if (availableMonthlyQuest) availableQuests.push(availableMonthlyQuest);
  }

  // Prüfe ob es einlösbare Quests gibt (für alle Filter)
  const allActiveQuests = [...activeRegularQuests, ...activeCollectionQuests];
  if (activeWeeklyQuest) allActiveQuests.push(activeWeeklyQuest);
  if (activeMonthlyQuest) allActiveQuests.push(activeMonthlyQuest);
  
  const hasRedeemableQuests = allActiveQuests.some(q => q.isCompleted);
  const showQuestNotification = hasRedeemableQuests;

  return (
    <>
      {/* Fixer Hintergrund */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: averageColor ?
          `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)` :
          'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
        }} />

      
      {/* Scrollbarer Content */}
      <div className="min-h-screen">
        <MobileBackButton />
      
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-stone-200">
            <div className="max-w-7xl mx-auto">
              <TabsList className="grid w-full grid-cols-2 bg-white h-12 rounded-none border-0">
                <TabsTrigger value="quests" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm relative">
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Aufgaben</span>
                  </div>
                  {showQuestNotification && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="achievements" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Erfolge</span>
                    {user.selected_title &&
                      <span className="hidden sm:inline text-[10px] opacity-70">• {user.selected_title}</span>
                      }
                  </div>
                </TabsTrigger>
              </TabsList>
              
              {activeTab === "quests" &&
                <div className="flex gap-1 p-1 border-t border-stone-200 bg-stone-50">
                  <Button
                    onClick={() => setQuestFilter("exploration")}
                    variant={questFilter === "exploration" ? "default" : "ghost"}
                    size="sm"
                    className={`flex-1 h-7 text-xs relative ${questFilter === "exploration" ? "bg-blue-600 hover:bg-blue-700" : ""}`}>
                    Erkundung
                    {(activeRegularQuests.some(q => q.isCompleted) || activeCollectionQuests.some(q => q.isCompleted)) && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full border border-white" />
                      </div>
                    )}
                  </Button>
                  <Button
                    onClick={() => setQuestFilter("weekly")}
                    variant={questFilter === "weekly" ? "default" : "ghost"}
                    size="sm"
                    className={`flex-1 h-7 text-xs relative ${questFilter === "weekly" ? "bg-blue-600 hover:bg-blue-700" : ""}`}>
                    Wöchentlich
                    {activeWeeklyQuest?.isCompleted && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full border border-white" />
                      </div>
                    )}
                  </Button>
                  <Button
                    onClick={() => setQuestFilter("monthly")}
                    variant={questFilter === "monthly" ? "default" : "ghost"}
                    size="sm"
                    className={`flex-1 h-7 text-xs relative ${questFilter === "monthly" ? "bg-blue-600 hover:bg-blue-700" : ""}`}>
                    Monatlich
                    {activeMonthlyQuest?.isCompleted && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full border border-white" />
                      </div>
                    )}
                  </Button>
                </div>
                }
            </div>
          </div>

          {/* Erfolge Tab */}
          <TabsContent value="achievements" className="pt-14 px-4 pb-4">

            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedAchievements.map((achievement, index) => {
                    const isUnlocked = userAchievements.some((ua) => ua.achievement_id === achievement.id);
                    const userAchievement = userAchievements.find((ua) => ua.achievement_id === achievement.id);
                    
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
                        isUnlocked ?
                        'border-amber-300 bg-gradient-to-br from-white/90 to-amber-50/90 backdrop-blur-md hover:shadow-md' :
                        'border-stone-200 bg-stone-50/80 backdrop-blur-sm opacity-60'}`
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
                        <h3 className={`text-sm font-bold mb-1 ${isUnlocked ? 'text-stone-900' : 'text-stone-500'}`}>
                          {achievement.title}
                        </h3>
                        <p className={`text-xs mb-1 ${isUnlocked ? 'text-stone-600' : 'text-stone-400'}`}>
                          {achievement.description}
                        </p>

                        {achievementReward && (
                          <div className={`flex items-center gap-1 text-xs mt-2 px-2 py-1 rounded-lg ${
                            isUnlocked ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-400'
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
                  <Card className="border-2 border-stone-200 bg-white/80 backdrop-blur-md">
                    <CardContent className="p-12 text-center">
                      <Trophy className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-stone-900 mb-2">
                        Noch keine Erfolge verfügbar
                      </h3>
                    </CardContent>
                  </Card>
                  }
              </div>
            </div>
          </TabsContent>

          {/* Aufgaben Tab */}
          <TabsContent value="quests" className="pt-20 px-4 pb-4">
            <div className="max-w-6xl mx-auto space-y-6">

              {/* Aktive Quests */}
              {activeQuests.length > 0 &&

                <div className="grid md:grid-cols-2 gap-4">
                    {activeQuests.map((quest, index) => {
                    const progressPercentage = quest.required_discoveries ?
                    Math.min(100, quest.progress / quest.required_discoveries * 100) :
                    0;

                    return (
                      <motion.div
                        key={quest.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}>

                          <Card className={`border shadow-sm bg-white/90 backdrop-blur-md hover:shadow-md transition-all ${
                        quest.isCompleted ?
                        'border-green-400 bg-gradient-to-br from-green-50/50 to-white' :
                        quest.type === 'weekly' ? 'border-emerald-400 bg-gradient-to-br from-emerald-50/50 to-white' :
                        quest.type === 'monthly' ? 'border-purple-400 bg-gradient-to-br from-purple-50/50 to-white' :
                        quest.type === 'collection' ? 'border-indigo-400 bg-gradient-to-br from-indigo-50/50 to-white' :
                        'border-blue-200'}`
                        }>
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              quest.isCompleted ? 'bg-gradient-to-br from-green-500 to-green-600' :
                              quest.type === 'weekly' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                              quest.type === 'monthly' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                              quest.type === 'collection' ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' :
                              'bg-gradient-to-br from-blue-500 to-blue-600'}`
                              }>
                                  {quest.isCompleted ?
                                <CheckCircle2 className="w-4 h-4 text-white" /> :
                                quest.type === 'collection' ?
                                <span className="text-sm">{quest.icon_emoji || '🗺️'}</span> :

                                <Target className="w-4 h-4 text-white" />
                                }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                                    {quest.isCompleted &&
                                  <Badge className="bg-green-600 text-white text-[10px] px-1 py-0">
                                        ✓ Abgeschlossen
                                      </Badge>
                                  }
                                    {quest.type === 'weekly' &&
                                  <Badge className="bg-emerald-600 text-white text-[10px] px-1 py-0">
                                        📅 Wöchentlich
                                      </Badge>
                                  }
                                    {quest.type === 'monthly' &&
                                  <Badge className="bg-purple-600 text-white text-[10px] px-1 py-0">
                                        📆 Monatlich
                                      </Badge>
                                  }
                                    {quest.type === 'collection' &&
                                  <Badge className="bg-indigo-600 text-white text-[10px] px-1 py-0">
                                        🗺️ Sammlung
                                      </Badge>
                                  }
                                    {quest.category && quest.category !== "Alle" &&
                                  <Badge className={`text-[10px] px-1 py-0 ${
                                  quest.category === "Bäume" ? "bg-green-600" :
                                  quest.category === "Sträucher" ? "bg-emerald-600" :
                                  "bg-pink-600"} text-white`
                                  }>
                                        {quest.category}
                                      </Badge>
                                  }
                                  </div>
                                  <h3 className="text-sm font-bold text-stone-900 mb-1">
                                    {quest.title}
                                  </h3>
                                  <p className="text-xs text-stone-600 mb-2">
                                    {quest.description}
                                  </p>
                                  
                                  {quest.required_discoveries &&
                                <div className="space-y-1 mb-2">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-stone-500">Fortschritt</span>
                                        <span className="font-bold text-blue-700">
                                          {quest.progress} / {quest.required_discoveries}
                                        </span>
                                      </div>
                                      <Progress value={progressPercentage} className="h-1.5" />
                                    </div>
                                }

                                  {quest.isCompleted &&
                                  <div className="space-y-2 pt-2 border-t border-stone-200">
                                      {quest.rewardData && (
                                        <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                                          <Gift className="w-3 h-3" />
                                          <span className="font-semibold">{quest.rewardData.display_name}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-end">
                                        <Button
                                      onClick={() => {
                                        // Prüfe ob das die erste Quest ist
                                        const allCompletedQuests = [...userQuests, ...userWeeklyQuests, ...userMonthlyQuests, ...userCollectionQuests].filter(q => q.redeemed);
                                        const isFirstQuest = allCompletedQuests.length === 0;

                                        redeemQuestMutation.mutate({
                                          userQuestId: quest.userQuestId,
                                          questType: quest.type,
                                          rewardName: quest.rewardData?.name,
                                          isFirstQuest: isFirstQuest
                                        });
                                      }}
                                      disabled={redeemQuestMutation.isPending}
                                      size="sm"
                                      className="h-7 text-xs bg-green-600 hover:bg-green-700">

                                          Einlösen
                                        </Button>
                                      </div>
                                    </div>
                                  }
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>);

                  })}
                  </div>

                }

              {activeQuests.length === 0 &&
                <div className="text-center py-20">
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                    <Target className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-stone-900 mb-2">
                      Keine aktiven Aufgaben
                    </h3>
                    <p className="text-stone-600">
                      Alle Aufgaben bereits eingelöst!
                    </p>
                  </div>
                </div>
                }
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

