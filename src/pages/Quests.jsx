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
import { awardXP, getTitleForLevel, getXPProgressInLevel } from "../components/utils/xpSystem"; // Import updated utility functions
import MobileBackButton from "../components/navigation/MobileBackButton";

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

  // Helfer: Welcher Tag der Woche (0 = Sonntag, 1 = Montag, ...)
  const getDayOfWeek = () => new Date().getDay();
  
  // Helfer: Welche Woche im Jahr
  const getWeekNumber = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
  };

  const discoveredPlants = userDiscoveries.length;
  const discoveredGenera = genera.filter(g => {
    const genusPlants = plants.filter(p => p.genus_id === g.id);
    return genusPlants.some(p => userDiscoveries.some(d => d.plant_id === p.id));
  }).length;
  const completedQuests = userQuests.filter(uq => uq.completed).length;

  const calculateQuestProgress = (quest) => {
    if (!quest.required_discoveries) return 0;
    
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
        // Update user's XP/Level/Title
        await updateUserMutation.mutateAsync({
          xp: newXP,
          level: newLevel,
          title: newTitle
        });
        
        // Fetch the freshest user data after updates, for PublicProfile and Achievements
        const freshUser = await base44.auth.me();
        
        // Update PublicProfile
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

  // Standard Quests
  const standardQuests = quests.filter(q => !q.quest_type || q.quest_type === 'standard');
  
  // Tägliche Quests (alle daily quests sind immer aktiv)
  const dailyQuests = quests.filter(q => q.quest_type === 'daily');
  const activeDailyQuest = dailyQuests.length > 0 ? dailyQuests[0] : null;

  // Wöchentliche Quests (basierend auf day_of_week)
  const weeklyQuests = quests.filter(q => q.quest_type === 'weekly');
  const activeWeeklyQuest = weeklyQuests.find(q => {
    const dayIndex = getDayOfWeek();
    return q.day_of_week === dayIndex;
  });

  // Event Quests
  const eventQuests = quests.filter(q => q.quest_type === 'event');

  // Alle speziellen Quests (täglich, wöchentlich, event) - Priorität: Daily > Weekly > Event
  const specialQuests = [activeDailyQuest, activeWeeklyQuest, ...eventQuests].filter(Boolean);

  // Kombiniere Spezielle + Standard Quests für verfügbare (Spezielle zuerst!)
  const availableQuests = [...specialQuests, ...standardQuests].filter(q => 
    isQuestUnlocked(q) &&
    !userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  );

  const lockedQuests = standardQuests.filter(q => 
    !isQuestUnlocked(q) &&
    !userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  );

  const completedQuestList = quests.filter(q =>
    userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  );

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
            {availableQuests.map((quest, index) => {
              const progress = calculateQuestProgress(quest);
              const isCompleted = progress >= quest.required_discoveries;
              const progressPercentage = (progress / quest.required_discoveries) * 100;
              
              const questTypeColors = {
                daily: 'border-green-400 bg-green-50',
                weekly: 'border-blue-400 bg-blue-50',
                event: 'border-purple-400 bg-purple-50',
                standard: 'border-stone-200 bg-white'
              };
              const borderColor = questTypeColors[quest.quest_type || 'standard'];

              return (
                <motion.div
                  key={quest.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`border-2 ${borderColor} hover:border-green-300 hover:shadow-lg transition-all`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            {quest.quest_type === 'daily' && (
                              <Badge className="bg-green-600 text-white font-bold">
                                📅 Täglich
                              </Badge>
                            )}
                            {quest.quest_type === 'weekly' && (
                              <Badge className="bg-blue-600 text-white font-bold">
                                📆 Wöchentlich
                              </Badge>
                            )}
                            {quest.quest_type === 'event' && (
                              <Badge className="bg-purple-600 text-white font-bold">
                                ⭐ Event
                              </Badge>
                            )}
                            {(!quest.quest_type || quest.quest_type === 'standard') && (
                              <Badge className="bg-stone-800 text-white font-bold">
                                #{quest.quest_number}
                              </Badge>
                            )}
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
                          <p className="text-stone-600">{quest.description}</p>
                        </div>
                        <div className="flex flex-col items-center gap-2 ml-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-sm">+{quest.xp_reward}</span>
                          </div>
                          <span className="text-xs font-semibold text-stone-600">XP</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-stone-700">
                            {quest.requirement}
                          </span>
                          <span className="text-sm font-bold text-green-700">
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