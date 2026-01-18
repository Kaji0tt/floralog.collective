import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Lock, Leaf, Target } from "lucide-react";
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

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

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

export default function Achievements() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState("achievements");
  const [questFilter, setQuestFilter] = useState("all");
  const [expeditionFilter, setExpeditionFilter] = useState("active");

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.background_color) {
      setAverageColor(user.background_color);
    } else if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list('achievement_number'),
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', user?.email],
    queryFn: () => base44.entities.UserAchievement.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => base44.entities.Quest.list('quest_number'),
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests', user?.email],
    queryFn: () => base44.entities.UserQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => base44.entities.WeeklyQuest.list('quest_number'),
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ['userWeeklyQuests', user?.email],
    queryFn: () => base44.entities.UserWeeklyQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => base44.entities.MonthlyQuest.list('quest_number'),
  });

  const { data: userMonthlyQuests = [] } = useQuery({
    queryKey: ['userMonthlyQuests', user?.email],
    queryFn: () => base44.entities.UserMonthlyQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => base44.entities.CollectionQuest.list(),
  });

  const { data: userCollectionQuests = [] } = useQuery({
    queryKey: ['userCollectionQuests', user?.email],
    queryFn: () => base44.entities.UserCollectionQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ['userDiscoveries', user?.email],
    queryFn: () => base44.entities.UserPlantDiscovery.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const updateTitleMutation = useMutation({
    mutationFn: (title) => base44.auth.updateMe({ selected_title: title }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      // Re-fetch user data to ensure `user` state reflects the change immediately
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setShowTitleDialog(false);
    },
  });

  const handleSelectTitle = (achievement) => {
    setSelectedAchievement(achievement);
    setShowTitleDialog(true);
  };

  const confirmTitleSelection = () => {
    if (selectedAchievement?.title_reward) {
      updateTitleMutation.mutate(selectedAchievement.title_reward);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  const unlockedCount = achievements.filter(a => 
    userAchievements.some(ua => ua.achievement_id === a.id)
  ).length;

  const getRarityColor = (rarity) => {
    switch(rarity) {
      case "Ungewöhnlich": return "bg-green-500";
      case "Selten": return "bg-blue-500";
      case "Episch": return "bg-purple-500";
      case "Legendär": return "bg-amber-500";
      default: return "bg-gray-500";
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
    switch(rarity) {
      case "Ungewöhnlich": return 1;
      case "Selten": return 2;
      case "Episch": return 3;
      case "Legendär": return 4;
      default: return 0; // Default for unknown rarities, puts them at the beginning
    }
  };

  // Sortiere Achievements nach Rarität (niedrigste zuerst)
  const sortedAchievements = [...achievements].sort((a, b) => {
    return getRarityValue(a.rarity) - getRarityValue(b.rarity);
  });

  // Helper für aktuelle Woche/Monat
  const getWeekNumber = (date = new Date()) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const getMonthString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getCurrentWeeklyQuest = () => {
    if (!weeklyQuests || weeklyQuests.length === 0) return null;
    const sortedQuests = [...weeklyQuests].sort((a, b) => a.quest_number - b.quest_number);
    const weekString = getWeekNumber();
    const weekNumber = parseInt(weekString.split('-W')[1]);
    const index = weekNumber % sortedQuests.length;
    return sortedQuests[index];
  };

  const getCurrentMonthlyQuest = () => {
    if (!monthlyQuests || monthlyQuests.length === 0) return null;
    const sortedQuests = [...monthlyQuests].sort((a, b) => a.quest_number - b.quest_number);
    const month = new Date().getMonth() + 1;
    const index = (month - 1) % sortedQuests.length;
    return sortedQuests[index];
  };

  // Aktive Quests filtern
  const activeRegularQuests = quests.filter(q => {
    const userQuest = userQuests.find(uq => uq.quest_id === q.id);
    const isCompleted = userQuest?.completed;
    const isUnlocked = (q.unlocked_at_level || 1) <= (user?.level || 1);
    return !isCompleted && isUnlocked;
  }).map(q => {
    const userQuest = userQuests.find(uq => uq.quest_id === q.id);
    return { ...q, progress: userQuest?.progress || 0, type: 'regular' };
  });

  const currentWeeklyQuest = getCurrentWeeklyQuest();
  const currentWeeklyUserQuest = currentWeeklyQuest 
    ? userWeeklyQuests.find(uwq => uwq.weekly_quest_id === currentWeeklyQuest.id && uwq.active_week === getWeekNumber())
    : null;
  const activeWeeklyQuest = currentWeeklyQuest && !currentWeeklyUserQuest?.completed
    ? { ...currentWeeklyQuest, progress: currentWeeklyUserQuest?.progress || 0, type: 'weekly' }
    : null;

  const currentMonthlyQuest = getCurrentMonthlyQuest();
  const currentMonthlyUserQuest = currentMonthlyQuest
    ? userMonthlyQuests.find(umq => umq.monthly_quest_id === currentMonthlyQuest.id && umq.active_month === getMonthString())
    : null;
  const activeMonthlyQuest = currentMonthlyQuest && !currentMonthlyUserQuest?.completed
    ? { ...currentMonthlyQuest, progress: currentMonthlyUserQuest?.progress || 0, type: 'monthly' }
    : null;

  let activeQuests = [...activeRegularQuests];
  if (activeWeeklyQuest) activeQuests.push(activeWeeklyQuest);
  if (activeMonthlyQuest) activeQuests.push(activeMonthlyQuest);

  // Filter anwenden
  if (questFilter === 'weekly') {
    activeQuests = activeWeeklyQuest ? [activeWeeklyQuest] : [];
  } else if (questFilter === 'monthly') {
    activeQuests = activeMonthlyQuest ? [activeMonthlyQuest] : [];
  }

  return (
    <>
      {/* Fixer Hintergrund */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: averageColor 
            ? `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)`
            : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
        }}
      />
      
      {/* Scrollbarer Content */}
      <div className="min-h-screen">
        <MobileBackButton />
      
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-stone-200">
            <div className="max-w-7xl mx-auto">
              <TabsList className="grid w-full grid-cols-3 bg-white h-12 rounded-none border-0">
                <TabsTrigger value="achievements" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>{unlockedCount}/{achievements.length}</span>
                    {user.selected_title && (
                      <span className="hidden sm:inline text-[10px] opacity-70">• {user.selected_title}</span>
                    )}
                  </div>
                </TabsTrigger>
                <TabsTrigger value="quests" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Aufgaben</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="expeditions" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1">
                    <Leaf className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Expedition</span>
                  </div>
                </TabsTrigger>
              </TabsList>
              
              {activeTab === "quests" && (
                <div className="flex gap-1 p-1 border-t border-stone-200 bg-stone-50">
                  <Button
                    onClick={() => setQuestFilter("all")}
                    variant={questFilter === "all" ? "default" : "ghost"}
                    size="sm"
                    className={`flex-1 h-7 text-xs ${questFilter === "all" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                  >
                    Alle
                  </Button>
                  <Button
                    onClick={() => setQuestFilter("weekly")}
                    variant={questFilter === "weekly" ? "default" : "ghost"}
                    size="sm"
                    className={`flex-1 h-7 text-xs ${questFilter === "weekly" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                  >
                    Wöchentlich
                  </Button>
                  <Button
                    onClick={() => setQuestFilter("monthly")}
                    variant={questFilter === "monthly" ? "default" : "ghost"}
                    size="sm"
                    className={`flex-1 h-7 text-xs ${questFilter === "monthly" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                  >
                    Monatlich
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Erfolge Tab */}
          <TabsContent value="achievements" className="pt-14 px-4 pb-4">

            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedAchievements.map((achievement, index) => {
            const isUnlocked = userAchievements.some(ua => ua.achievement_id === achievement.id);
            const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
            const isCurrentTitle = user.selected_title === achievement.title_reward;

            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`border shadow-sm transition-all duration-300 ${
                  isUnlocked 
                    ? 'border-amber-300 bg-gradient-to-br from-white/90 to-amber-50/90 backdrop-blur-md hover:shadow-md' 
                    : 'border-stone-200 bg-stone-50/80 backdrop-blur-sm opacity-60'
                }`}>
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
                          {isUnlocked && (
                            <Trophy className="w-3 h-3 text-amber-500" />
                          )}
                        </div>
                        <h3 className={`text-sm font-bold mb-1 ${isUnlocked ? 'text-stone-900' : 'text-stone-500'}`}>
                          {achievement.title}
                        </h3>
                        <p className={`text-xs mb-1 ${isUnlocked ? 'text-stone-600' : 'text-stone-400'}`}>
                          {achievement.description}
                        </p>
                        
                        {achievement.title_reward && isUnlocked && (
                          <Button
                            onClick={() => handleSelectTitle(achievement)}
                            disabled={isCurrentTitle || updateTitleMutation.isPending}
                            className={`w-full text-[10px] h-6 mt-1 ${
                              isCurrentTitle 
                                ? 'bg-green-600 hover:bg-green-600' 
                                : 'bg-purple-600 hover:bg-purple-700'
                            }`}
                            size="sm"
                          >
                            {isCurrentTitle ? (
                              <>
                                <CheckCircle className="w-2 h-2 mr-1" />
                                Aktiv
                              </>
                            ) : (
                              `Titel: ${achievement.title_reward}`
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </motion.div>
              );
            })}

                {sortedAchievements.length === 0 && (
                  <Card className="border-2 border-stone-200 bg-white/80 backdrop-blur-md">
                    <CardContent className="p-12 text-center">
                      <Trophy className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-stone-900 mb-2">
                        Noch keine Erfolge verfügbar
                      </h3>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Aufgaben Tab */}
          <TabsContent value="quests" className="pt-20 px-4 pb-4">
            <div className="max-w-6xl mx-auto">

              <div className="grid md:grid-cols-2 gap-4">
                {activeQuests.map((quest, index) => {
                  const progressPercentage = quest.required_discoveries 
                    ? Math.min(100, (quest.progress / quest.required_discoveries) * 100)
                    : 0;

                  return (
                    <motion.div
                      key={quest.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={`border shadow-sm bg-white/90 backdrop-blur-md hover:shadow-md transition-all ${
                        quest.type === 'weekly' ? 'border-emerald-400 bg-gradient-to-br from-emerald-50/50 to-white' :
                        quest.type === 'monthly' ? 'border-purple-400 bg-gradient-to-br from-purple-50/50 to-white' :
                        'border-blue-200'
                      }`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              quest.type === 'weekly' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                              quest.type === 'monthly' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                              'bg-gradient-to-br from-blue-500 to-blue-600'
                            }`}>
                              <Target className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-1 flex-wrap">
                                {quest.type === 'weekly' && (
                                  <Badge className="bg-emerald-600 text-white text-[10px] px-1 py-0">
                                    📅 Wöchentlich
                                  </Badge>
                                )}
                                {quest.type === 'monthly' && (
                                  <Badge className="bg-purple-600 text-white text-[10px] px-1 py-0">
                                    📆 Monatlich
                                  </Badge>
                                )}
                                {quest.category && quest.category !== "Alle" && (
                                  <Badge className={`text-[10px] px-1 py-0 ${
                                    quest.category === "Bäume" ? "bg-green-600" :
                                    quest.category === "Sträucher" ? "bg-emerald-600" :
                                    "bg-pink-600"
                                  } text-white`}>
                                    {quest.category}
                                  </Badge>
                                )}
                              </div>
                              <h3 className="text-sm font-bold text-stone-900 mb-1">
                                {quest.title}
                              </h3>
                              <p className="text-xs text-stone-600 mb-2">
                                {quest.description}
                              </p>
                              
                              {quest.required_discoveries && (
                                <div className="space-y-1 mb-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-stone-500">Fortschritt</span>
                                    <span className="font-bold text-blue-700">
                                      {quest.progress} / {quest.required_discoveries}
                                    </span>
                                  </div>
                                  <Progress value={progressPercentage} className="h-1.5" />
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                                <span className="text-[10px] text-stone-500">Belohnung</span>
                                <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-[10px] px-1.5 py-0">
                                  +{quest.xp_reward} XP
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {activeQuests.length === 0 && (
                <div className="text-center py-20">
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                    <Target className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-stone-900 mb-2">
                      Keine aktiven Aufgaben
                    </h3>
                    <p className="text-stone-600">
                      Alle Aufgaben abgeschlossen oder noch nicht freigeschaltet!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Expeditionen Tab */}
          <TabsContent value="expeditions" className="pt-20 px-4 pb-4">
            <div className="max-w-6xl mx-auto">
              {/* Filter */}
              <div className="flex gap-1 p-1 mb-4 border border-stone-200 bg-white rounded-lg">
                <Button
                  onClick={() => setExpeditionFilter("active")}
                  variant={expeditionFilter === "active" ? "default" : "ghost"}
                  size="sm"
                  className={`flex-1 h-7 text-xs ${expeditionFilter === "active" ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                >
                  Aktiv
                </Button>
                <Button
                  onClick={() => setExpeditionFilter("completed")}
                  variant={expeditionFilter === "completed" ? "default" : "ghost"}
                  size="sm"
                  className={`flex-1 h-7 text-xs ${expeditionFilter === "completed" ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                >
                  Abgeschlossen
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {collectionQuests
                  .filter(quest => {
                    const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
                    if (expeditionFilter === "active") {
                      return quest.is_active && !userQuest?.completed;
                    } else {
                      return userQuest?.completed;
                    }
                  })
                  .map((quest, index) => {
                    const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
                    const discoveredPlants = userQuest?.discovered_plants || [];
                    const totalPlants = quest.target_plants?.length || 0;
                    const progressPercentage = totalPlants > 0 ? (discoveredPlants.length / totalPlants) * 100 : 0;

                    return (
                      <motion.div
                        key={quest.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className={`border shadow-sm bg-white/90 backdrop-blur-md hover:shadow-md transition-all ${
                          userQuest?.completed ? 'border-green-400 bg-gradient-to-br from-green-50/50 to-white' : 'border-purple-400 bg-gradient-to-br from-purple-50/50 to-white'
                        }`}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2">
                              <div className={`text-3xl flex-shrink-0 ${userQuest?.completed ? '' : ''}`}>
                                {quest.icon_emoji || '🗺️'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-1 flex-wrap">
                                  <Badge className={`text-[10px] px-1 py-0 ${
                                    quest.difficulty === 'Leicht' ? 'bg-green-600' :
                                    quest.difficulty === 'Mittel' ? 'bg-yellow-600' :
                                    quest.difficulty === 'Schwer' ? 'bg-orange-600' :
                                    'bg-red-600'
                                  } text-white`}>
                                    {quest.difficulty}
                                  </Badge>
                                  {userQuest?.completed && (
                                    <Badge className="bg-green-600 text-white text-[10px] px-1 py-0">
                                      ✓ Abgeschlossen
                                    </Badge>
                                  )}
                                </div>
                                <h3 className="text-sm font-bold text-stone-900 mb-1">
                                  {quest.title}
                                </h3>
                                <p className="text-xs text-stone-600 mb-2">
                                  {quest.description}
                                </p>
                                
                                {/* Zielpflanzen Liste */}
                                <div className="mb-2 bg-stone-50 rounded-lg p-2">
                                  <p className="text-[10px] font-semibold text-stone-700 mb-1">Zielpflanzen:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {quest.target_plants?.map((plantId, idx) => {
                                      const plant = plants.find(p => p.id === plantId || p.species_name === plantId);
                                      const isDiscovered = discoveredPlants.includes(plantId);
                                      return (
                                        <Badge 
                                          key={idx} 
                                          variant="outline" 
                                          className={`text-[10px] px-1 py-0 ${
                                            isDiscovered ? 'bg-green-100 text-green-700 border-green-400' : 'text-stone-600'
                                          }`}
                                        >
                                          {isDiscovered && '✓ '}
                                          {plant?.species_name || plantId}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Fortschritt */}
                                <div className="space-y-1 mb-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-stone-500">Fortschritt</span>
                                    <span className="font-bold text-purple-700">
                                      {discoveredPlants.length} / {totalPlants}
                                    </span>
                                  </div>
                                  <Progress value={progressPercentage} className="h-1.5" />
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                                  <span className="text-[10px] text-stone-500">Belohnung</span>
                                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-[10px] px-1.5 py-0">
                                    +{quest.xp_reward} XP
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
              </div>

              {collectionQuests.filter(quest => {
                const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
                if (expeditionFilter === "active") {
                  return quest.is_active && !userQuest?.completed;
                } else {
                  return userQuest?.completed;
                }
              }).length === 0 && (
                <div className="text-center py-20">
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                    <Leaf className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-stone-900 mb-2">
                      {expeditionFilter === "active" ? "Keine aktiven Expeditionen" : "Keine abgeschlossenen Expeditionen"}
                    </h3>
                    <p className="text-stone-600">
                      {expeditionFilter === "active" ? "Zurzeit sind keine Expeditionen verfügbar." : "Du hast noch keine Expedition abgeschlossen."}
                    </p>
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
              Möchtest du den Titel <strong className="text-purple-700">"{selectedAchievement?.title_reward}"</strong> ausrüsten?
            </p>
            <p className="text-sm text-stone-500 mb-6">
              Dieser Titel wird in deinem Profil und auf der Startseite angezeigt.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowTitleDialog(false)}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={confirmTitleSelection}
                disabled={updateTitleMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {updateTitleMutation.isPending ? 'Wird ausgerüstet...' : 'Ausrüsten'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}