import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getXPProgressInLevel, awardXP } from "../components/utils/xpSystem";
import QuestCompletionAnimation from "../components/quests/QuestCompletionAnimation";
import AchievementNotification from "../components/achievements/AchievementNotification";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, BookOpen, Trophy, Target, Users, ChevronRight, MapPin, Sparkles, Gift } from "lucide-react";
import { 
  getCurrentDailyQuest, 
  getCurrentWeeklyQuest, 
  isDailyQuestCompletedToday, 
  isWeeklyQuestCompletedThisWeek,
  getOrCreateActiveDailyQuest,
  getOrCreateActiveWeeklyQuest,
  getTodayString,
  getWeekNumber
} from "../components/quests/QuestRotationHelper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [completedQuestXP, setCompletedQuestXP] = useState(0);
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const queryClient = useQueryClient();

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list()
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list()
  });

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ['userDiscoveries'],
    queryFn: async () => {
      if (!user?.email) return [];
      const discoveries = await base44.entities.UserPlantDiscovery.list();
      return discoveries.filter((d) => d.user === user.email || d.created_by === user.email);
    },
    enabled: !!user?.email
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => base44.entities.Quest.list('quest_number')
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests'],
    queryFn: () => base44.entities.UserQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements'],
    queryFn: () => base44.entities.UserAchievement.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list()
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await base44.entities.Friend.list();
      return allFriends.filter((f) =>
        (f.request_sent_by?.toLowerCase() === user.email.toLowerCase() ||
         f.request_sent_to?.toLowerCase() === user.email.toLowerCase()) &&
        f.status === 'accepted'
      );
    },
    enabled: !!user?.email
  });

  const { data: sharedScans = [] } = useQuery({
    queryKey: ['sharedScans'],
    queryFn: async () => {
      if (!user?.email) return [];
      const scans = await base44.entities.SharedScan.list();
      return scans.filter(s => s.shared_to === user.email && !s.viewed);
    },
    enabled: !!user?.email
  });

  const { data: dailyQuests = [] } = useQuery({
    queryKey: ['dailyQuests'],
    queryFn: () => base44.entities.DailyQuest.list('quest_number'),
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => base44.entities.WeeklyQuest.list('quest_number'),
  });

  const { data: userDailyQuests = [] } = useQuery({
    queryKey: ['userDailyQuests'],
    queryFn: () => base44.entities.UserDailyQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ['userWeeklyQuests'],
    queryFn: () => base44.entities.UserWeeklyQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    },
    onError: (error) => console.error("Fehler beim Aktualisieren des Benutzers:", error),
  });

  const completeQuestMutation = useMutation({
    mutationFn: async (questId) => {
      const existingUserQuest = userQuests.find(uq => uq.quest_id === questId);
      if (existingUserQuest) {
        return base44.entities.UserQuest.update(existingUserQuest.id, {
          completed: true,
          completed_date: new Date().toISOString()
        });
      } else {
        return base44.entities.UserQuest.create({
          quest_id: questId,
          completed: true,
          completed_date: new Date().toISOString(),
          created_by: user?.email
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuests'] });
    },
    onError: (error) => console.error("Fehler beim Abschließen der Aufgabe:", error),
  });

  const completeDailyQuestMutation = useMutation({
    mutationFn: async (questId) => {
      return base44.entities.UserDailyQuest.create({
        daily_quest_id: questId,
        completed_date: getTodayString(),
        created_by: user?.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDailyQuests'] });
    },
  });

  const completeWeeklyQuestMutation = useMutation({
    mutationFn: async (questId) => {
      return base44.entities.UserWeeklyQuest.create({
        weekly_quest_id: questId,
        completed_week: getWeekNumber(),
        created_by: user?.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
    },
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const updatePublicProfile = async (userData) => {
    if (!userData?.email) return;

    try {
      const profiles = await base44.entities.PublicProfile.list();
      const existingProfile = profiles.find((p) => p.user_email?.toLowerCase() === userData.email.toLowerCase());

      const profileData = {
        user_email: userData.email,
        display_name: userData.display_name || userData.full_name,
        full_name: userData.full_name,
        level: userData.level || 1,
        xp: userData.xp || 0,
        title: userData.title,
        selected_title: userData.selected_title,
        avatar_url: userData.avatar_url
      };

      if (existingProfile) {
        await base44.entities.PublicProfile.update(existingProfile.id, profileData);
      } else {
        await base44.entities.PublicProfile.create(profileData);
      }
    } catch (error) {
      console.error("PublicProfile Erstellung/Update fehlgeschlagen:", error);
    }
  };

  useEffect(() => {
    if (user) {
      updatePublicProfile(user);
    }
  }, [user?.email, user?.level, user?.xp, user?.display_name, user?.full_name, user?.title, user?.selected_title, user?.avatar_url]);

  const handleCompleteQuest = async (quest) => {
    if (!user) return;

    const progress = calculateQuestProgress(quest);
    const isCompleted = progress >= quest.required_discoveries;
    const alreadyCompleted = userQuests.some(uq => uq.quest_id === quest.id && uq.completed);

    if (isCompleted && !alreadyCompleted) {
      try {
        await completeQuestMutation.mutateAsync(quest.id);
        
        const currentXP = user.xp || 0;
        const result = awardXP(currentXP, quest.xp_reward);

        setCompletedQuestXP(quest.xp_reward);
        setShowCompletionAnimation(true);

        await updateUserMutation.mutateAsync({
          xp: result.xp,
          level: result.level,
          title: result.title
        });
        
        const freshUser = await base44.auth.me();
        setUser(freshUser);
        
        await updatePublicProfile(freshUser);

        const newlyUnlocked = await checkAndUnlockAchievements(freshUser);
        if (newlyUnlocked.length > 0) {
          setNewAchievements(newlyUnlocked);
          setCurrentAchievementIndex(0);
        }
      } catch (error) {
        console.error("Fehler beim Abschließen der Aufgabe:", error);
      }
    }
  };

  const handleQuestClick = (quest) => {
    const progress = calculateQuestProgress(quest);
    const isCompleted = progress >= quest.required_discoveries;
    const alreadyCompleted = userQuests.some(uq => uq.quest_id === quest.id && uq.completed);

    if (isCompleted && !alreadyCompleted) {
      handleCompleteQuest(quest);
    } else {
      navigate(createPageUrl("Quests"));
    }
  };

  const handleDailyQuestClick = (quest) => {
    if (!activeDailyUserQuest) {
      navigate(createPageUrl("Quests"));
      return;
    }

    const progress = activeDailyUserQuest.progress || 0;
    const isCompleted = progress >= quest.required_discoveries;
    const alreadyCompletedToday = activeDailyUserQuest.completed === true;

    if (isCompleted && !alreadyCompletedToday) {
      handleCompleteDailyQuest(quest);
    } else {
      navigate(createPageUrl("Quests"));
    }
  };

  const handleWeeklyQuestClick = (quest) => {
    if (!activeWeeklyUserQuest) {
      navigate(createPageUrl("Quests"));
      return;
    }

    const progress = activeWeeklyUserQuest.progress || 0;
    const isCompleted = progress >= quest.required_discoveries;
    const alreadyCompletedThisWeek = activeWeeklyUserQuest.completed === true;

    if (isCompleted && !alreadyCompletedThisWeek) {
      handleCompleteWeeklyQuest(quest);
    } else {
      navigate(createPageUrl("Quests"));
    }
  };

  const handleCompleteDailyQuest = async (quest) => {
    if (!user || !activeDailyUserQuest || activeDailyUserQuest.completed) return;

    try {
      await base44.entities.UserDailyQuest.update(activeDailyUserQuest.id, {
        completed: true,
        completed_date: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['userDailyQuests'] });
      
      const currentXP = user.xp || 0;
      const result = awardXP(currentXP, quest.xp_reward);

      setCompletedQuestXP(quest.xp_reward);
      setShowCompletionAnimation(true);

      await updateUserMutation.mutateAsync({
        xp: result.xp,
        level: result.level,
        title: result.title
      });
      
      const freshUser = await base44.auth.me();
      setUser(freshUser);
      await updatePublicProfile(freshUser);

      const newlyUnlocked = await checkAndUnlockAchievements(freshUser);
      if (newlyUnlocked.length > 0) {
        setNewAchievements(newlyUnlocked);
        setCurrentAchievementIndex(0);
      }
    } catch (error) {
      console.error("Fehler:", error);
    }
  };

  const handleCompleteWeeklyQuest = async (quest) => {
    if (!user || !activeWeeklyUserQuest || activeWeeklyUserQuest.completed) return;

    try {
      await base44.entities.UserWeeklyQuest.update(activeWeeklyUserQuest.id, {
        completed: true,
        completed_date: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
      
      const currentXP = user.xp || 0;
      const result = awardXP(currentXP, quest.xp_reward);

      setCompletedQuestXP(quest.xp_reward);
      setShowCompletionAnimation(true);

      await updateUserMutation.mutateAsync({
        xp: result.xp,
        level: result.level,
        title: result.title
      });
      
      const freshUser = await base44.auth.me();
      setUser(freshUser);
      await updatePublicProfile(freshUser);

      const newlyUnlocked = await checkAndUnlockAchievements(freshUser);
      if (newlyUnlocked.length > 0) {
        setNewAchievements(newlyUnlocked);
        setCurrentAchievementIndex(0);
      }
    } catch (error) {
      console.error("Fehler:", error);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  const totalGenera = genera.length;
  const discoveredGenera = genera.filter((g) => {
    const genusPlants = plants.filter((p) => p.genus_id === g.id);
    return genusPlants.some((p) => userDiscoveries.some((d) => d.plant_id === p.id));
  }).length;
  const progressPercentage = totalGenera > 0 ? discoveredGenera / totalGenera * 100 : 0;

  const totalAchievements = achievements.length;
  const achievementProgressPercentage = totalAchievements > 0 ? userAchievements.length / totalAchievements * 100 : 0;

  const categoryStats = {
    "Bäume": genera.filter((g) => g.category === "Bäume"),
    "Sträucher": genera.filter((g) => g.category === "Sträucher"),
    "Blumen": genera.filter((g) => g.category === "Blumen")
  };

  const currentLevel = user.level || 1;
  const currentXP = user.xp || 0;
  const xpProgress = getXPProgressInLevel(currentXP, currentLevel);

  const calculateQuestProgress = (quest) => {
    if (!quest || !quest.required_discoveries || quest.required_discoveries === 0) return 0;

    if (quest.category === "Alle") {
      return Math.min(discoveredGenera, quest.required_discoveries);
    } else {
      const categoryGenera = genera.filter((g) => g.category === quest.category);
      const discoveredInCategory = categoryGenera.filter((g) => {
        const genusPlants = plants.filter((p) => p.genus_id === g.id);
        return genusPlants.some((p) => userDiscoveries.some((d) => d.plant_id === p.id));
      }).length;
      return Math.min(discoveredInCategory, quest.required_discoveries);
    }
  };

  const allActiveQuests = quests.filter((q) =>
    (q.unlocked_at_level || 1) <= currentLevel &&
    !userQuests.some((uq) => uq.quest_id === q.id && uq.completed)
  );

  const activeQuests = allActiveQuests.map((q) => ({
    ...q,
    progress: calculateQuestProgress(q),
    type: 'personal'
  })).slice(0, 3);

  const currentDailyQuest = getCurrentDailyQuest(dailyQuests);
  const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);

  const activeDailyUserQuest = currentDailyQuest 
    ? userDailyQuests.find(udq => udq.daily_quest_id === currentDailyQuest.id && udq.active_date === getTodayString())
    : null;
  
  const activeWeeklyUserQuest = currentWeeklyQuest 
    ? userWeeklyQuests.find(uwq => uwq.weekly_quest_id === currentWeeklyQuest.id && uwq.active_week === getWeekNumber())
    : null;

  // Auto-create daily/weekly quests on load
  useEffect(() => {
    const initializeQuests = async () => {
      const today = getTodayString();
      const currentWeek = getWeekNumber();
      
      const existingDaily = userDailyQuests.find(udq => udq.daily_quest_id === currentDailyQuest?.id && udq.active_date === today);
      const existingWeekly = userWeeklyQuests.find(uwq => uwq.weekly_quest_id === currentWeeklyQuest?.id && uwq.active_week === currentWeek);
      
      if (user?.email && currentDailyQuest && !existingDaily) {
        try {
          await getOrCreateActiveDailyQuest(base44, currentDailyQuest, userDailyQuests, user.email);
          queryClient.invalidateQueries({ queryKey: ['userDailyQuests'] });
        } catch (error) {
          console.error("Error initializing daily quest:", error);
        }
      }
      if (user?.email && currentWeeklyQuest && !existingWeekly) {
        try {
          await getOrCreateActiveWeeklyQuest(base44, currentWeeklyQuest, userWeeklyQuests, user.email);
          queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
        } catch (error) {
          console.error("Error initializing weekly quest:", error);
        }
      }
    };
    initializeQuests();
  }, [user?.email, currentDailyQuest?.id, currentWeeklyQuest?.id, userDailyQuests.length, userWeeklyQuests.length]);

  const displayQuests = [];

  if (currentDailyQuest) {
    const progress = activeDailyUserQuest?.progress || 0;
    const alreadyCompletedToday = activeDailyUserQuest?.completed === true;
    displayQuests.push({
      ...currentDailyQuest,
      progress,
      type: 'daily',
      completedToday: alreadyCompletedToday
    });
  }

  if (currentWeeklyQuest) {
    const progress = activeWeeklyUserQuest?.progress || 0;
    const alreadyCompletedThisWeek = activeWeeklyUserQuest?.completed === true;
    displayQuests.push({
      ...currentWeeklyQuest,
      progress,
      type: 'weekly',
      completedThisWeek: alreadyCompletedThisWeek
    });
  }

  displayQuests.push(...activeQuests);

  const statButtons = [
    {
      icon: BookOpen,
      label: "Gattungen",
      value: discoveredGenera,
      color: "from-green-500 to-green-600",
      textColor: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      progressBg: "bg-green-100",
      progressText: "text-green-800",
      progressPercentage: Math.round(progressPercentage),
      showProgress: true,
      onClick: () => navigate(createPageUrl("Collection"))
    },
    {
      icon: Trophy,
      label: "Erfolge",
      value: userAchievements.length,
      color: "from-amber-500 to-amber-600",
      textColor: "text-amber-700",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      progressBg: "bg-amber-100",
      progressText: "text-amber-800",
      progressPercentage: Math.round(achievementProgressPercentage),
      showProgress: true,
      onClick: () => navigate(createPageUrl("Achievements"))
    },
    {
      icon: Target,
      label: "Aufgaben",
      value: allActiveQuests.length,
      color: "from-blue-500 to-blue-600",
      textColor: "text-blue-700",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      showProgress: false,
      onClick: () => navigate(createPageUrl("Quests"))
    },
    {
      icon: Users,
      label: "Freunde",
      value: friends.length,
      color: "from-purple-500 to-purple-600",
      textColor: "text-purple-700",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      showProgress: false,
      notificationCount: sharedScans.length,
      onClick: () => navigate(createPageUrl("Friends"))
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <AnimatePresence>
        {showCompletionAnimation && (
          <QuestCompletionAnimation 
            xpReward={completedQuestXP}
            onComplete={() => setShowCompletionAnimation(false)}
          />
        )}
      </AnimatePresence>

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

      {/* Geteilte Scans Benachrichtigung */}
      {sharedScans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto mb-6"
        >
          <button
            onClick={() => {
              if (sharedScans.length > 0) {
                navigate(createPageUrl(`ViewSharedScan?id=${sharedScans[0].id}`));
              }
            }}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-lg">
                  {sharedScans.length} {sharedScans.length === 1 ? 'Neuer geteilter Scan' : 'Neue geteilte Scans'}!
                </h3>
                <p className="text-purple-100 text-sm">Tippe hier, um ihn anzusehen und +25 XP zu erhalten</p>
              </div>
              <ChevronRight className="w-6 h-6 flex-shrink-0" />
            </div>
          </button>
        </motion.div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="md:hidden min-h-[calc(100vh-2rem)] flex flex-col gap-4 pb-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-shrink-0">

            <Card
              className="border-2 border-green-200 shadow-lg bg-white overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => navigate(createPageUrl("Profile"))}>

              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                      {user.avatar_url ?
                        <img src={user.avatar_url} alt="Profil" className="w-full h-full object-cover" /> :
                        <img src={LOGO_URL} alt="PlantDex" className="w-8 h-8 object-contain" />
                      }
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                      <span className="text-white font-bold text-xs">{currentLevel}</span>
                    </div>
                  </div>
                  <div className="flex-1 text-white min-w-0">
                    <h2 className="text-lg font-bold mb-1 truncate">Willkommen, {user.display_name || user.full_name}!</h2>
                    <p className="text-green-100 text-sm font-semibold truncate">
                      {user.selected_title || user.title || "Pflanzen-Anfänger"}
                    </p>
                  </div>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white">Level {currentLevel}</span>
                    <span className="text-xs font-semibold text-white">{xpProgress.current} / {xpProgress.needed} XP</span>
                  </div>
                  <Progress value={xpProgress.percentage} className="h-2 bg-white/30" />
                </div>
              </div>

              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {statButtons.map((stat) =>
                    <button
                      key={stat.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        stat.onClick();
                      }}
                      className={`${stat.bgColor} ${stat.borderColor} border-2 rounded-xl p-3 hover:shadow-lg transition-all duration-300 group text-left relative`}>

                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 bg-gradient-to-br ${stat.color} rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                          <stat.icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className={`text-xl font-bold ${stat.textColor}`}>{stat.value}</div>
                          <div className="text-xs text-stone-600 font-semibold">{stat.label}</div>
                        </div>
                      </div>
                      {stat.showProgress &&
                        <div className={`${stat.progressBg} rounded px-2 py-1`}>
                          <div className={`text-xs font-semibold ${stat.progressText}`}>
                            {stat.progressPercentage}% komplett
                          </div>
                        </div>
                      }
                      {stat.notificationCount > 0 && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-xs">{stat.notificationCount}</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(categoryStats).map(([category, categoryGenera]) => {
                    const discovered = categoryGenera.filter((g) => {
                      const genusPlants = plants.filter((p) => p.genus_id === g.id);
                      return genusPlants.some((p) => userDiscoveries.some((d) => d.plant_id === p.id));
                    }).length;
                    const icon = category === "Bäume" ? "🌳" : category === "Sträucher" ? "🌿" : "🌸";
                    return (
                      <div key={category} className="bg-stone-50 rounded-lg p-2 border border-stone-200 text-center">
                        <div className="text-lg mb-1">{icon}</div>
                        <div className="text-base font-bold text-green-700">{discovered}/{categoryGenera.length}</div>
                        <div className="text-xs text-stone-600 font-semibold truncate">{category}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex-1 flex flex-col gap-4 justify-center min-h-0">

            <button
              onClick={() => navigate(createPageUrl("Scanner"))}
              className="flex-1 min-h-[150px] group relative overflow-hidden rounded-xl bg-gradient-to-br from-green-600 to-green-700 p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300">

              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Camera className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-1">Pflanze scannen</h3>
                  <p className="text-green-100 text-sm">Neue Entdeckung machen 🌿</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(createPageUrl("Map"))}
              className="flex-1 min-h-[150px] group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300">

              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <MapPin className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-1">Karte öffnen</h3>
                  <p className="text-blue-100 text-sm">Fundorte erkunden 🗺️</p>
                </div>
              </div>
            </button>
          </motion.div>
        </div>

        <div className="hidden md:block space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}>

            <Card className="border-2 border-green-200 shadow-lg bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                      {user.avatar_url ?
                        <img src={user.avatar_url} alt="Profil" className="w-full h-full object-cover" /> :
                        <img src={LOGO_URL} alt="PlantDex" className="w-12 h-12 object-contain" />
                      }
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                      <span className="text-white font-bold text-sm">{currentLevel}</span>
                    </div>
                  </div>
                  <div className="flex-1 text-white min-w-0">
                    <h2 className="text-2xl font-bold mb-1 truncate">Willkommen, {user.display_name || user.full_name}!</h2>
                    <p className="text-green-100 text-base font-semibold truncate">
                      {user.selected_title || user.title || "Pflanzen-Anfänger"}
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate(createPageUrl("Profile"))}
                    size="sm"
                    className="bg-white text-green-700 hover:bg-green-50">

                    Profil
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">Level {currentLevel}</span>
                    <span className="text-sm font-semibold text-white">{xpProgress.current} / {xpProgress.needed} XP</span>
                  </div>
                  <Progress value={xpProgress.percentage} className="h-2 bg-white/30" />
                </div>
              </div>

              <CardContent className="p-6">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {statButtons.map((stat) =>
                    <button
                      key={stat.label}
                      onClick={stat.onClick}
                      className={`${stat.bgColor} ${stat.borderColor} border-2 rounded-xl p-3 hover:shadow-lg transition-all duration-300 group text-left relative`}>

                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 bg-gradient-to-br ${stat.color} rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                          <stat.icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</div>
                          <div className="text-xs text-stone-600 font-semibold">{stat.label}</div>
                        </div>
                      </div>
                      {stat.showProgress &&
                        <div className={`${stat.progressBg} rounded px-2 py-1`}>
                          <div className={`text-xs font-semibold ${stat.progressText}`}>
                            {stat.progressPercentage}% komplett
                          </div>
                        </div>
                      }
                      {stat.notificationCount > 0 && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-xs">{stat.notificationCount}</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(categoryStats).map(([category, categoryGenera]) => {
                    const discovered = categoryGenera.filter((g) => {
                      const genusPlants = plants.filter((p) => p.genus_id === g.id);
                      return genusPlants.some((p) => userDiscoveries.some((d) => d.plant_id === p.id));
                    }).length;
                    const icon = category === "Bäume" ? "🌳" : category === "Sträucher" ? "🌿" : "🌸";
                    return (
                      <div key={category} className="bg-stone-50 rounded-lg p-2 border border-stone-200 text-center">
                        <div className="text-lg mb-1">{icon}</div>
                        <div className="text-lg font-bold text-green-700">{discovered}/{categoryGenera.length}</div>
                        <div className="text-xs text-stone-600 font-semibold truncate">{category}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}>

            <button
              onClick={() => navigate(createPageUrl("Scanner"))}
              className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-br from-green-600 to-green-700 p-8 text-white shadow-lg hover:shadow-2xl transition-all duration-300">

              <div className="flex items-center justify-center gap-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Camera className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-left">
                  <h3 className="text-2xl font-bold mb-1">Pflanze scannen</h3>
                  <p className="text-green-100 text-base">Neue Entdeckung machen 🌿</p>
                </div>
              </div>
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}>

            <Card className="border-2 border-stone-200 shadow-lg bg-white">
              <CardHeader className="border-b border-stone-200 p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Target className="w-5 h-5 text-green-600" />
                    Aktuelle Aufgaben
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(createPageUrl("Quests"))}>

                    Alle
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {displayQuests.length === 0 ?
                  <div className="text-center py-6 text-stone-500">
                    <Target className="w-10 h-10 mx-auto mb-2 text-stone-400" />
                    <p className="text-sm">Keine aktiven Aufgaben. Scanne Pflanzen!</p>
                  </div> :

                  <div className="space-y-3">
                    {displayQuests.map((quest, index) => {
                      const progressPercentage = quest.progress / quest.required_discoveries * 100;
                      const isCompleted = quest.progress >= quest.required_discoveries;
                      
                      let borderColor = 'border-stone-200';
                      let badgeColor = 'bg-stone-800';
                      let badgeText = `#${quest.quest_number}`;
                      let onClickHandler = () => handleQuestClick(quest);
                      let completedBadge = null;

                      if (quest.type === 'daily') {
                        borderColor = quest.completedToday ? 'border-green-400 bg-green-50' : 'border-emerald-400';
                        badgeColor = 'bg-emerald-600';
                        badgeText = '📅 Täglich';
                        onClickHandler = () => handleDailyQuestClick(quest);
                        if (quest.completedToday) {
                          completedBadge = <Badge className="bg-green-600 text-white text-xs">Heute erledigt</Badge>;
                        }
                      } else if (quest.type === 'weekly') {
                        borderColor = quest.completedThisWeek ? 'border-green-400 bg-green-50' : 'border-blue-400';
                        badgeColor = 'bg-blue-600';
                        badgeText = '📆 Wöchentlich';
                        onClickHandler = () => handleWeeklyQuestClick(quest);
                        if (quest.completedThisWeek) {
                          completedBadge = <Badge className="bg-green-600 text-white text-xs">Diese Woche erledigt</Badge>;
                        }
                      }

                      return (
                        <motion.div
                          key={quest.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}>

                          <button
                            onClick={onClickHandler}
                            className="w-full text-left"
                            disabled={completeQuestMutation.isPending || completeDailyQuestMutation.isPending || completeWeeklyQuestMutation.isPending}>

                            <Card className={`border-2 ${borderColor} hover:border-green-300 transition-colors`}>
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <Badge className={`${badgeColor} text-white font-bold text-xs`}>
                                        {badgeText}
                                      </Badge>
                                      {completedBadge}
                                      {isCompleted && !completedBadge &&
                                        <Badge className="bg-green-600 text-white text-xs">
                                          <Sparkles className="w-3 h-3 mr-1" />
                                          Bereit!
                                        </Badge>
                                      }
                                    </div>
                                    <h4 className="font-bold text-base text-stone-900 mb-1 truncate">{quest.title}</h4>
                                    <p className="text-xs text-stone-600 mb-2 line-clamp-2">{quest.description}</p>
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-stone-700 truncate">
                                          {quest.requirement}
                                        </span>
                                        <span className="text-xs font-bold text-green-700 ml-2">
                                          {quest.progress} / {quest.required_discoveries}
                                        </span>
                                      </div>
                                      <Progress value={progressPercentage} className="h-1.5 bg-stone-200" />
                                    </div>
                                  </div>
                                  <div className="text-center flex-shrink-0">
                                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-md">
                                      <span className="text-white font-bold text-xs">+{quest.xp_reward}</span>
                                    </div>
                                    <span className="text-[10px] text-stone-600 font-semibold mt-1 block">XP</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                }
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="md:hidden mt-6">

          <Card className="bg-transparent border-0 shadow-none">
            <CardContent className="p-0">
              {displayQuests.length === 0 ?
                <div className="text-center text-stone-500 py-6 bg-white rounded-lg border-2 border-stone-200">
                  <Target className="w-10 mx-auto mb-2 text-stone-400" />
                  <p className="text-sm">Keine aktiven Aufgaben. Scanne Pflanzen!</p>
                </div> :

                <div className="relative">
                  {displayQuests.length >= 1 &&
                    <>
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                        <ChevronRight className="w-6 h-6 text-stone-400 rotate-180" />
                      </div>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                        <ChevronRight className="w-6 h-6 text-stone-400" />
                      </div>
                    </>
                  }

                  <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-2 scrollbar-hide">
                    {displayQuests.map((quest, index) => {
                      const progressPercentage = quest.progress / quest.required_discoveries * 100;
                      const isCompleted = quest.progress >= quest.required_discoveries;

                      let borderColor = 'border-stone-200';
                      let badgeColor = 'bg-stone-800';
                      let badgeText = `#${quest.quest_number}`;
                      let onClickHandler = () => handleQuestClick(quest);
                      let completedBadge = null;

                      if (quest.type === 'daily') {
                        borderColor = quest.completedToday ? 'border-green-400 bg-green-50' : 'border-emerald-400';
                        badgeColor = 'bg-emerald-600';
                        badgeText = '📅 Täglich';
                        onClickHandler = () => handleDailyQuestClick(quest);
                        if (quest.completedToday) {
                          completedBadge = <Badge className="bg-green-600 text-white text-xs">Heute erledigt</Badge>;
                        }
                      } else if (quest.type === 'weekly') {
                        borderColor = quest.completedThisWeek ? 'border-green-400 bg-green-50' : 'border-blue-400';
                        badgeColor = 'bg-blue-600';
                        badgeText = '📆 Wöchentlich';
                        onClickHandler = () => handleWeeklyQuestClick(quest);
                        if (quest.completedThisWeek) {
                          completedBadge = <Badge className="bg-green-600 text-white text-xs">Diese Woche erledigt</Badge>;
                        }
                      }

                      return (
                        <motion.div
                          key={quest.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="py-2 snap-center flex-shrink-0 w-[calc(100vw-2rem)]">

                          <button
                            onClick={onClickHandler}
                            className="w-full text-left"
                            disabled={completeQuestMutation.isPending || completeDailyQuestMutation.isPending || completeWeeklyQuestMutation.isPending}>

                            <Card className={`border-2 ${borderColor} shadow-lg bg-white hover:border-green-300 transition-colors`}>
                              <CardContent className="px-6 py-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <Badge className={`${badgeColor} text-white font-bold text-xs`}>
                                        {badgeText}
                                      </Badge>
                                      {completedBadge}
                                      {isCompleted && !completedBadge &&
                                        <Badge className="bg-green-600 text-white text-xs">
                                          <Sparkles className="w-3 h-3 mr-1" />
                                          Bereit!
                                        </Badge>
                                      }
                                    </div>
                                    <h4 className="font-bold text-base text-stone-900 mb-2">{quest.title}</h4>
                                    <p className="text-sm text-stone-600 mb-3">{quest.description}</p>
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-stone-700">
                                          {quest.requirement}
                                        </span>
                                        <span className="text-sm font-bold text-green-700 ml-2">
                                          {quest.progress} / {quest.required_discoveries}
                                        </span>
                                      </div>
                                      <Progress value={progressPercentage} className="h-2 bg-stone-200" />
                                    </div>
                                  </div>
                                  <div className="text-center flex-shrink-0">
                                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-md">
                                      <span className="text-white font-bold text-sm">+{quest.xp_reward}</span>
                                    </div>
                                    <span className="text-[10px] text-stone-600 font-semibold mt-1 block">XP</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              }
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex justify-center gap-6 pt-6 pb-2">

          <button
            onClick={() => navigate(createPageUrl("Donate"))}
            className="flex items-center gap-2 text-stone-600 hover:text-red-600 transition-colors font-medium text-sm">

            <span>❤️ Spenden</span>
          </button>
          <button
            onClick={() => navigate(createPageUrl("Feedback"))}
            className="flex items-center gap-2 text-stone-600 hover:text-blue-600 transition-colors font-medium text-sm">

            <span>Feedback</span>
          </button>
          <button
            onClick={() => navigate(createPageUrl("Impressum"))}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors font-medium text-sm">

            <span>Impressum</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}