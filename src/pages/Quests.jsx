import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Target, Award, Loader2, CheckCircle2, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QuestCompletionAnimation from "../components/quests/QuestCompletionAnimation";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import AchievementNotification from "../components/achievements/AchievementNotification";
import { awardXP, getTitleForLevel, getXPProgressInLevel } from "../components/utils/xpSystem";
import MobileBackButton from "../components/navigation/MobileBackButton";
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

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Quests() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [completedQuestXP, setCompletedQuestXP] = useState(0);
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("active");

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ['userDiscoveries'],
    queryFn: () => base44.entities.UserPlantDiscovery.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => base44.entities.Quest.list('quest_number'),
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests'],
    queryFn: () => base44.entities.UserQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => base44.entities.Friend.filter({ created_by: user?.email }),
    enabled: !!user?.email,
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

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['me'] }); // Invalidate 'me' query to refetch user data
      const currentUser = await base44.auth.me(); // Re-fetch user data to update local state
      setUser(currentUser);
    },
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

  const updatePublicProfile = async (userData) => {
    try {
      const profiles = await base44.entities.PublicProfile.list();
      const existingProfile = profiles.find(p => p.user_email?.toLowerCase() === userData.email?.toLowerCase());

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
      console.error("PublicProfile Update Fehler:", error);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  const currentLevel = user.level || 1;
  const currentXP = user.xp || 0;

  const discoveredPlants = userDiscoveries.length;
  const discoveredGenera = genera.filter(g => {
    const genusPlants = plants.filter(p => p.genus_id === g.id);
    return genusPlants.some(p => userDiscoveries.some(d => d.plant_id === p.id));
  }).length;
  const completedQuests = userQuests.filter(uq => uq.completed).length;

  const calculateQuestProgress = (quest) => {
    if (!quest || !quest.required_discoveries || quest.required_discoveries === 0) return 0;
    
    if (quest.category === "Alle") {
      return Math.min(discoveredGenera, quest.required_discoveries);
    } else {
      const categoryGenera = genera.filter(g => g.category === quest.category);
      const discoveredInCategory = categoryGenera.filter(g => {
        const genusPlants = plants.filter(p => p.genus_id === g.id);
        return genusPlants.some(p => userDiscoveries.some(d => d.plant_id === p.id));
      }).length;
      return Math.min(discoveredInCategory, quest.required_discoveries);
    }
  };

  const handleCompleteQuest = async (quest) => {
    const progress = calculateQuestProgress(quest);
    const isCompleted = progress >= quest.required_discoveries;
    const alreadyCompleted = userQuests.some(uq => uq.quest_id === quest.id && uq.completed);

    if (isCompleted && !alreadyCompleted) {
      await completeQuestMutation.mutateAsync(quest.id);
      
      const currentXP = user.xp || 0;
      const { newXP, newLevel, newTitle } = awardXP(currentXP, quest.xp_reward);

      setCompletedQuestXP(quest.xp_reward);
      setShowCompletionAnimation(true);

      setTimeout(async () => {
        await updateUserMutation.mutateAsync({
          xp: newXP,
          level: newLevel,
          title: newTitle
        });
        
        const freshUser = await base44.auth.me();
        await updatePublicProfile(freshUser);

        const newlyUnlocked = await checkAndUnlockAchievements(freshUser);
        if (newlyUnlocked.length > 0) {
          setNewAchievements(newlyUnlocked);
          setCurrentAchievementIndex(0);
        }
      }, 500);
    }
  };

  const handleCompleteDailyQuest = async (quest) => {
    if (!activeDailyUserQuest || activeDailyUserQuest.completed) return;

    if (isDailyCompleted) {
      await base44.entities.UserDailyQuest.update(activeDailyUserQuest.id, {
        completed: true,
        completed_date: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['userDailyQuests'] });
      
      const currentXP = user.xp || 0;
      const { newXP, newLevel, newTitle } = awardXP(currentXP, quest.xp_reward);

      setCompletedQuestXP(quest.xp_reward);
      setShowCompletionAnimation(true);

      setTimeout(async () => {
        await updateUserMutation.mutateAsync({
          xp: newXP,
          level: newLevel,
          title: newTitle
        });
        
        const freshUser = await base44.auth.me();
        await updatePublicProfile(freshUser);

        const newlyUnlocked = await checkAndUnlockAchievements(freshUser);
        if (newlyUnlocked.length > 0) {
          setNewAchievements(newlyUnlocked);
          setCurrentAchievementIndex(0);
        }
      }, 500);
    }
  };

  const handleCompleteWeeklyQuest = async (quest) => {
    if (!activeWeeklyUserQuest || activeWeeklyUserQuest.completed) return;

    if (isWeeklyCompleted) {
      await base44.entities.UserWeeklyQuest.update(activeWeeklyUserQuest.id, {
        completed: true,
        completed_date: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
      
      const currentXP = user.xp || 0;
      const { newXP, newLevel, newTitle } = awardXP(currentXP, quest.xp_reward);

      setCompletedQuestXP(quest.xp_reward);
      setShowCompletionAnimation(true);

      setTimeout(async () => {
        await updateUserMutation.mutateAsync({
          xp: newXP,
          level: newLevel,
          title: newTitle
        });
        
        const freshUser = await base44.auth.me();
        await updatePublicProfile(freshUser);

        const newlyUnlocked = await checkAndUnlockAchievements(freshUser);
        if (newlyUnlocked.length > 0) {
          setNewAchievements(newlyUnlocked);
          setCurrentAchievementIndex(0);
        }
      }, 500);
    }
  };

  // Prüfe ob Prerequisites erfüllt sind
  const isQuestUnlocked = (quest) => {
    // Level-Voraussetzung
    if ((quest.unlocked_at_level || 1) > currentLevel) {
      return false;
    }
    
    // Prerequisite-Quest Voraussetzung (jetzt mit quest_number statt ID)
    if (quest.prerequisite_quest_number) {
      const prerequisiteQuest = quests.find(q => q.quest_number === quest.prerequisite_quest_number);
      if (prerequisiteQuest) {
        const prerequisiteCompleted = userQuests.some(
          uq => uq.quest_id === prerequisiteQuest.id && uq.completed
        );
        if (!prerequisiteCompleted) {
          return false;
        }
      }
    }
    
    return true;
  };

  const availableQuests = quests.filter(q => 
    isQuestUnlocked(q) &&
    !userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  );

  const lockedQuests = quests.filter(q => 
    !isQuestUnlocked(q) &&
    !userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  );

  const completedQuestList = quests.filter(q =>
    userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  );

  const currentDailyQuest = getCurrentDailyQuest(dailyQuests);
  const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);

  // Finde UserQuest-Eintrag, falls vorhanden, ansonsten null
  const activeDailyUserQuest = currentDailyQuest 
    ? userDailyQuests.find(udq => udq.daily_quest_id === currentDailyQuest.id && udq.active_date === getTodayString())
    : null;
  
  const activeWeeklyUserQuest = currentWeeklyQuest 
    ? userWeeklyQuests.find(uwq => uwq.weekly_quest_id === currentWeeklyQuest.id && uwq.active_week === getWeekNumber())
    : null;

  const dailyProgress = activeDailyUserQuest?.progress || 0;
  const weeklyProgress = activeWeeklyUserQuest?.progress || 0;

  const isDailyCompleted = currentDailyQuest && currentDailyQuest.required_discoveries > 0 && dailyProgress >= currentDailyQuest.required_discoveries;
  const isWeeklyCompleted = currentWeeklyQuest && currentWeeklyQuest.required_discoveries > 0 && weeklyProgress >= currentWeeklyQuest.required_discoveries;

  const isDailyAlreadyCompletedToday = activeDailyUserQuest?.completed === true;
  const isWeeklyAlreadyCompletedThisWeek = activeWeeklyUserQuest?.completed === true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      {/* Quest Completion Animation */}
      <AnimatePresence>
        {showCompletionAnimation && (
          <QuestCompletionAnimation 
            xpReward={completedQuestXP}
            onComplete={() => setShowCompletionAnimation(false)}
          />
        )}
      </AnimatePresence>

      {/* Achievement Notifications */}
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

      <div className="max-w-6xl mx-auto">

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white border border-stone-200 p-1 mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold">
              Übersicht
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold">
              Aktiv ({availableQuests.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold">
              Fertig ({completedQuestList.length})
            </TabsTrigger>
          </TabsList>

          {/* Übersicht */}
          <TabsContent value="overview" className="space-y-4">
            <Card className="border-2 border-stone-200 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-6 h-6 text-green-600" />
                  Deine Mission
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setActiveTab("active")}
                    className="bg-green-50 rounded-lg p-4 border border-green-200 hover:border-green-400 hover:shadow-lg transition-all cursor-pointer text-left"
                  >
                    <div className="text-3xl font-bold text-green-700 mb-1">{availableQuests.length}</div>
                    <div className="text-sm font-semibold text-stone-600">Verfügbare Aufgaben</div>
                  </button>
                  <button
                    onClick={() => setActiveTab("completed")}
                    className="bg-amber-50 rounded-lg p-4 border border-amber-200 hover:border-amber-400 hover:shadow-lg transition-all cursor-pointer text-left"
                  >
                    <div className="text-3xl font-bold text-amber-700 mb-1">{completedQuestList.length}</div>
                    <div className="text-sm font-semibold text-stone-600">Abgeschlossen</div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aktive Aufgaben */}
          <TabsContent value="active" className="space-y-4">
            {/* Tägliche Quest */}
            {currentDailyQuest && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className={`border-2 ${isDailyAlreadyCompletedToday ? 'border-green-400 bg-green-50' : 'border-emerald-400'} hover:shadow-lg transition-all bg-white`}>
                  <CardHeader className="relative">
                    <div className="absolute top-4 right-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex flex-col items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-sm">+{currentDailyQuest.xp_reward}</span>
                        <span className="text-white text-[9px] font-semibold">XP</span>
                      </div>
                    </div>
                    <div className="pr-20">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-emerald-600 text-white font-bold">
                          📅 Täglich
                        </Badge>
                        {isDailyAlreadyCompletedToday && (
                          <Badge className="bg-green-600 text-white">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Heute erledigt
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl text-stone-900 mb-2">{currentDailyQuest.title}</CardTitle>
                    </div>
                    <p className="text-stone-600">{currentDailyQuest.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-stone-700">
                          {currentDailyQuest.requirement}
                        </span>
                        <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">
                          {dailyProgress} / {currentDailyQuest.required_discoveries}
                        </span>
                      </div>
                      <Progress value={(dailyProgress / currentDailyQuest.required_discoveries) * 100} className="h-2 bg-stone-200" />
                      
                      {currentDailyQuest.target_species_name && (
                        <p className="text-xs text-amber-700 font-semibold mt-2">
                          🎯 Spezifische Art: {currentDailyQuest.target_species_name}
                        </p>
                      )}
                      {currentDailyQuest.target_genus_name && !currentDailyQuest.target_species_name && (
                        <p className="text-xs text-amber-700 font-semibold mt-2">
                          🎯 Spezifische Gattung: {currentDailyQuest.target_genus_name}
                        </p>
                      )}
                    </div>
                    
                    {isDailyCompleted && !isDailyAlreadyCompletedToday && (
                      <Button
                        onClick={() => handleCompleteDailyQuest(currentDailyQuest)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3"
                        disabled={completeDailyQuestMutation.isPending}
                      >
                        {completeDailyQuestMutation.isPending ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Trophy className="w-5 h-5 mr-2" />
                        )}
                        Tägliche Aufgabe abschließen!
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Wöchentliche Quest */}
            {currentWeeklyQuest && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card className={`border-2 ${isWeeklyAlreadyCompletedThisWeek ? 'border-green-400 bg-green-50' : 'border-blue-400'} hover:shadow-lg transition-all bg-white`}>
                  <CardHeader className="relative">
                    <div className="absolute top-4 right-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex flex-col items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-sm">+{currentWeeklyQuest.xp_reward}</span>
                        <span className="text-white text-[9px] font-semibold">XP</span>
                      </div>
                    </div>
                    <div className="pr-20">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-blue-600 text-white font-bold">
                          📆 Wöchentlich
                        </Badge>
                        {isWeeklyAlreadyCompletedThisWeek && (
                          <Badge className="bg-green-600 text-white">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Diese Woche erledigt
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl text-stone-900 mb-2">{currentWeeklyQuest.title}</CardTitle>
                    </div>
                    <p className="text-stone-600">{currentWeeklyQuest.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-stone-700">
                          {currentWeeklyQuest.requirement}
                        </span>
                        <span className="text-sm font-bold text-blue-700 whitespace-nowrap">
                          {weeklyProgress} / {currentWeeklyQuest.required_discoveries}
                        </span>
                      </div>
                      <Progress value={(weeklyProgress / currentWeeklyQuest.required_discoveries) * 100} className="h-2 bg-stone-200" />
                      
                      {currentWeeklyQuest.target_species_name && (
                        <p className="text-xs text-amber-700 font-semibold mt-2">
                          🎯 Spezifische Art: {currentWeeklyQuest.target_species_name}
                        </p>
                      )}
                      {currentWeeklyQuest.target_genus_name && !currentWeeklyQuest.target_species_name && (
                        <p className="text-xs text-amber-700 font-semibold mt-2">
                          🎯 Spezifische Gattung: {currentWeeklyQuest.target_genus_name}
                        </p>
                      )}
                    </div>
                    
                    {isWeeklyCompleted && !isWeeklyAlreadyCompletedThisWeek && (
                      <Button
                        onClick={() => handleCompleteWeeklyQuest(currentWeeklyQuest)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3"
                        disabled={completeWeeklyQuestMutation.isPending}
                      >
                        {completeWeeklyQuestMutation.isPending ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Trophy className="w-5 h-5 mr-2" />
                        )}
                        Wöchentliche Aufgabe abschließen!
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {availableQuests.map((quest, index) => {
              const progress = calculateQuestProgress(quest);
              const isCompleted = progress >= quest.required_discoveries;
              const progressPercentage = (progress / quest.required_discoveries) * 100;

              return (
                <motion.div
                  key={quest.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-2 border-stone-200 hover:border-green-300 hover:shadow-lg transition-all bg-white">
                    <CardHeader className="relative">
                      <div className="absolute top-4 right-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex flex-col items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-sm">+{quest.xp_reward}</span>
                          <span className="text-white text-[9px] font-semibold">XP</span>
                        </div>
                      </div>
                      <div className="pr-20">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className="bg-stone-800 text-white font-bold">
                            #{quest.quest_number}
                          </Badge>
                          <Badge className={`${
                            quest.difficulty === "Leicht" ? "bg-green-500" :
                            quest.difficulty === "Mittel" ? "bg-yellow-500" : "bg-red-500"
                          } text-white font-semibold`}>
                            {quest.difficulty}
                          </Badge>
                          {quest.category !== "Alle" && (
                            <Badge variant="outline" className="border-2 border-stone-300 font-semibold">
                              {quest.category}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-xl text-stone-900 mb-2">{quest.title}</CardTitle>
                      </div>
                      <p className="text-stone-600">{quest.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-stone-700">
                            {quest.requirement}
                          </span>
                          <span className="text-sm font-bold text-green-700 whitespace-nowrap">
                            {progress} / {quest.required_discoveries}
                          </span>
                        </div>
                        <Progress value={progressPercentage} className="h-2 bg-stone-200" />
                      </div>
                      
                      {isCompleted && (
                        <Button
                          onClick={() => handleCompleteQuest(quest)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                          disabled={completeQuestMutation.isPending}
                        >
                          {completeQuestMutation.isPending ? (
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          ) : (
                            <Trophy className="w-5 h-5 mr-2" />
                          )}
                          Aufgabe abschließen!
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
            {availableQuests.length === 0 && (
              <Card className="border-2 border-stone-200 bg-white">
                <CardContent className="p-12 text-center">
                  <Target className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-stone-900 mb-2">
                    Alle Aufgaben erledigt!
                  </h3>
                  <p className="text-stone-600">
                    {lockedQuests.length > 0 
                      ? "Schließe Aufgaben ab, um weitere freizuschalten!"
                      : "Du hast alle verfügbaren Aufgaben abgeschlossen!"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Abgeschlossene Aufgaben */}
          <TabsContent value="completed" className="space-y-4">
            {completedQuestList.length === 0 ? (
              <Card className="border-2 border-stone-200 bg-white">
                <CardContent className="p-12 text-center">
                  <Award className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-stone-900 mb-2">
                    Noch keine Aufgaben abgeschlossen
                  </h3>
                  <p className="text-stone-600">
                    Erfülle Aufgaben, um XP zu sammeln und aufzusteigen!
                  </p>
                </CardContent>
              </Card>
            ) : (
              completedQuestList.map((quest, index) => (
                <motion.div
                  key={quest.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-2 border-green-300 bg-green-50">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className="bg-green-600 text-white font-bold">
                              #{quest.quest_number}
                            </Badge>
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                          </div>
                          <CardTitle className="text-xl text-stone-900 mb-2">{quest.title}</CardTitle>
                          <p className="text-stone-600">{quest.description}</p>
                        </div>
                        <Badge className="bg-amber-500 text-white font-bold px-3 py-1">
                          +{quest.xp_reward} XP
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* Gesperrte Aufgaben - This tab is still rendered but not directly navigatable from the main tabs menu */}
          <TabsContent value="locked" className="space-y-4">
            {lockedQuests.length === 0 ? (
              <Card className="border-2 border-stone-200 bg-white">
                <CardContent className="p-12 text-center">
                  <Lock className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-stone-900 mb-2">
                    Keine gesperrten Aufgaben
                  </h3>
                  <p className="text-stone-600">
                    Du hast Zugriff auf alle Aufgaben!
                  </p>
                </CardContent>
              </Card>
            ) : (
              lockedQuests.map((quest, index) => (
                <motion.div
                  key={quest.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-2 border-stone-200 bg-stone-50 opacity-60">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className="bg-stone-500 text-white font-bold">
                              #{quest.quest_number}
                            </Badge>
                            <Badge className="bg-red-500 text-white font-semibold">
                              {(quest.unlocked_at_level || 1) > currentLevel
                                ? `Level ${quest.unlocked_at_level}`
                                : quest.prerequisite_quest_number
                                  ? `Nach: #${quest.prerequisite_quest_number}`
                                  : 'Gesperrt'
                              }
                            </Badge>
                            <Lock className="w-5 h-5 text-stone-400" />
                          </div>
                          <CardTitle className="text-xl text-stone-700 mb-2">{quest.title}</CardTitle>
                          <p className="text-stone-500">{quest.description}</p>
                        </div>
                        <div className="w-16 h-16 bg-stone-300 rounded-full flex items-center justify-center ml-4">
                          <span className="text-white font-bold text-sm">+{quest.xp_reward}</span>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}