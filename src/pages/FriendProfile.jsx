
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getXPProgressInLevel } from "../components/utils/xpSystem";
import MobileBackButton from "../components/navigation/MobileBackButton"; // Added import
import { BookOpen, Trophy, Target, Users, Star, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function FriendProfile() {
  const navigate = useNavigate();
  const [friendUser, setFriendUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get('email');

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    loadCurrentUser();
  }, []);

  // Lade Friend-Record um Grunddaten zu bekommen
  const { data: friendRecord } = useQuery({
    queryKey: ['friendRecord', friendEmail, currentUser?.email],
    queryFn: async () => {
      if (!friendEmail || !currentUser?.email) return null;
      const allFriends = await base44.entities.Friend.list();
      
      // Finde den Friend-Eintrag zwischen mir und dem Freund
      return allFriends.find(f =>
        ((f.request_sent_by?.toLowerCase() === currentUser.email?.toLowerCase() && 
          f.request_sent_to?.toLowerCase() === friendEmail?.toLowerCase()) ||
         (f.request_sent_by?.toLowerCase() === friendEmail?.toLowerCase() && 
          f.request_sent_to?.toLowerCase() === currentUser.email?.toLowerCase())) &&
        f.status === 'accepted'
      );
    },
    enabled: !!friendEmail && !!currentUser?.email,
  });

  // Lade PublicProfile (jeder kann das sehen!)
  const { data: publicProfile } = useQuery({
    queryKey: ['publicProfile', friendEmail],
    queryFn: async () => {
      if (!friendEmail) return null;
      const profiles = await base44.entities.PublicProfile.list();
      return profiles.find(p => p.user_email?.toLowerCase() === friendEmail.toLowerCase());
    },
    enabled: !!friendEmail,
  });

  // Setze friendUser aus den verfügbaren Daten
  useEffect(() => {
    if (!friendEmail) {
      setFriendUser(null); 
      return;
    }

    if (publicProfile) {
      // Nutze PublicProfile Daten, wenn verfügbar
      setFriendUser(publicProfile);
    } else if (friendRecord) {
      // Fallback auf Friend-Record, wenn kein PublicProfile aber anerkannter Freund
      setFriendUser({
        email: friendEmail,
        full_name: friendRecord.friend_name || friendEmail,
        display_name: friendRecord.friend_name || friendEmail,
        level: 1,
        xp: 0,
        title: "Pflanzen-Anfänger",
        selected_title: null,
        avatar_url: null
      });
    } else {
        // If there's an email but no accepted friend record AND no public profile,
        // it means they are not accepted friends and don't have a public profile.
        // Set a minimal user to avoid a permanent loading state or error,
        // but note that most dependent queries will fail or be empty.
        setFriendUser({
            email: friendEmail,
            full_name: friendEmail,
            display_name: friendEmail,
            level: 1, 
            xp: 0, 
            title: "Unbekannter", 
            selected_title: null, 
            avatar_url: null 
        });
    }
  }, [publicProfile, friendRecord, friendEmail]);

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => base44.entities.Quest.list('quest_number'),
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests', friendEmail],
    queryFn: () => base44.entities.UserQuest.filter({ created_by: friendEmail }),
    enabled: !!friendEmail,
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', friendEmail],
    queryFn: () => base44.entities.UserAchievement.filter({ created_by: friendEmail }),
    enabled: !!friendEmail,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list('achievement_number'),
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', friendEmail],
    queryFn: async () => {
      if (!friendEmail) return [];
      const allFriends = await base44.entities.Friend.list();
      
      // Freunde in beide Richtungen
      return allFriends.filter(f => 
        (f.created_by === friendEmail || f.friend_email === friendEmail) && 
        f.status === 'accepted'
      );
    },
    enabled: !!friendEmail,
  });

  const { data: friendDiscoveries = [] } = useQuery({
    queryKey: ['friendDiscoveries', friendEmail],
    queryFn: async () => {
      const discoveries = await base44.entities.UserPlantDiscovery.list();
      // Nutze das neue "user" Feld (mit Fallback auf created_by für alte Einträge)
      return discoveries.filter(d => d.user === friendEmail || d.created_by === friendEmail);
    },
    enabled: !!friendEmail,
  });

  if (!friendUser || !currentUser) { // Updated loading condition
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  const friendPlantIds = friendDiscoveries.map(d => d.plant_id);
  const friendPlants = plants.filter(p => friendPlantIds.includes(p.id));
  
  const totalGenera = genera.length;
  const discoveredGenera = genera.filter(g => {
    const genusPlants = friendPlants.filter(p => p.genus_id === g.id);
    return genusPlants.length > 0;
  }).length;
  const progressPercentage = totalGenera > 0 ? (discoveredGenera / totalGenera) * 100 : 0;

  const totalAchievements = achievements.length;
  const achievementProgressPercentage = totalAchievements > 0 ? (userAchievements.length / totalAchievements) * 100 : 0;

  const categoryStats = {
    "Bäume": genera.filter(g => g.category === "Bäume"),
    "Sträucher": genera.filter(g => g.category === "Sträucher"),
    "Blumen": genera.filter(g => g.category === "Blumen")
  };

  const currentLevel = friendUser.level || 1;
  const currentXP = friendUser.xp || 0;
  const xpProgress = getXPProgressInLevel(currentXP, currentLevel);

  const calculateQuestProgress = (quest) => {
    if (!quest.required_discoveries) return 0;
    
    if (quest.category === "Alle") {
      return Math.min(discoveredGenera, quest.required_discoveries);
    } else {
      const categoryGenera = genera.filter(g => g.category === quest.category);
      const discoveredInCategory = categoryGenera.filter(g => {
        const genusPlants = friendPlants.filter(p => p.genus_id === g.id);
        return genusPlants.length > 0;
      }).length;
      return Math.min(discoveredInCategory, quest.required_discoveries);
    }
  };

  const allActiveQuests = quests.filter(q => 
    (q.unlocked_at_level || 1) <= currentLevel &&
    !userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  );

  const activeQuquests = allActiveQuests.map(q => ({
    ...q,
    progress: calculateQuestProgress(q),
    type: 'personal'
  })).slice(0, 3);

  const displayQuests = activeQuquests;

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
      onClick: () => navigate(createPageUrl(`FriendCollection?email=${friendEmail}`))
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
      onClick: () => navigate(createPageUrl(`FriendAchievements?email=${friendEmail}`))
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
      onClick: null // No navigation for quests directly
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
      onClick: () => navigate(createPageUrl(`FriendFriendsList?email=${friendEmail}`))
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton backUrl={createPageUrl("Friends")} />
      
      <div className="max-w-6xl mx-auto">
        {/* Back Button - nur Desktop */}
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Friends"))}
          className="mb-6 bg-white hover:bg-stone-50 text-stone-900 font-semibold shadow-sm border border-stone-200 hidden md:inline-flex"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zu Freunden
        </Button>

        {/* Desktop & Mobile: Einheitliches Layout */}
        <div className="space-y-6">
          {/* 1. Profilübersicht */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="border-2 border-green-200 shadow-lg bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 md:p-6">
                <div className="flex items-center gap-3 md:gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                      {friendUser.avatar_url ? (
                        <img src={friendUser.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                      ) : (
                        <img src={LOGO_URL} alt="PlantDex" className="w-8 h-8 md:w-12 md:h-12 object-contain" />
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 md:w-8 md:h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                      <span className="text-white font-bold text-xs md:text-sm">{currentLevel}</span>
                    </div>
                  </div>
                  <div className="flex-1 text-white min-w-0">
                    <h2 className="text-lg md:text-2xl font-bold mb-1 truncate">{friendUser.display_name || friendUser.full_name}</h2>
                    <p className="text-green-100 text-sm md:text-base font-semibold truncate">
                      {friendUser.selected_title || friendUser.title || "Pflanzen-Anfänger"}
                    </p>
                  </div>
                </div>

                {/* Level Progress */}
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs md:text-sm font-semibold text-white">Level {currentLevel}</span>
                    <span className="text-xs md:text-sm font-semibold text-white">{xpProgress.current} / {xpProgress.needed} XP</span>
                  </div>
                  <Progress value={xpProgress.percentage} className="h-2 bg-white/30" />
                </div>
              </div>

              <CardContent className="p-4 md:p-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {statButtons.map((stat, index) => (
                    <button
                      key={stat.label}
                      onClick={stat.onClick}
                      disabled={!stat.onClick} // Disable if onClick is null
                      className={`${stat.bgColor} ${stat.borderColor} border-2 rounded-xl p-3 md:p-4 hover:shadow-lg transition-all duration-300 group text-left ${
                        !stat.onClick ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                        <div className={`w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br ${stat.color} rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform flex-shrink-0`}>
                          <stat.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className={`text-xl md:text-2xl font-bold ${stat.textColor}`}>{stat.value}</div>
                          <div className="text-xs font-semibold text-stone-600">{stat.label}</div>
                        </div>
                      </div>
                      {stat.showProgress && (
                        <div className={`${stat.progressBg} rounded px-2 py-1 mt-2`}>
                          <div className={`text-xs font-semibold ${stat.progressText}`}>
                            {stat.progressPercentage}% komplett
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Kategorie-Stats */}
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {Object.entries(categoryStats).map(([category, categoryGenera]) => {
                    const discovered = categoryGenera.filter(g => {
                      const genusPlants = friendPlants.filter(p => p.genus_id === g.id);
                      return genusPlants.length > 0;
                    }).length;
                    const icon = category === "Bäume" ? "🌳" : category === "Sträucher" ? "🌿" : "🌸";
                    return (
                      <div key={category} className="bg-stone-50 rounded-lg p-2 md:p-3 border border-stone-200 text-center">
                        <div className="text-lg md:text-2xl mb-1">{icon}</div>
                        <div className="text-base md:text-lg font-bold text-green-700">{discovered}/{categoryGenera.length}</div>
                        <div className="text-xs font-semibold text-stone-600 truncate">{category}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 2. PlantDex Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <button
              onClick={() => navigate(createPageUrl(`FriendCollection?email=${friendEmail}`))}
              className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-br from-green-600 to-green-700 p-6 md:p-8 text-white shadow-lg hover:shadow-2xl transition-all duration-300"
            >
              <div className="flex items-center justify-center gap-3 md:gap-4">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <BookOpen className="w-7 h-7 md:w-8 md:h-8 text-green-600" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl md:text-2xl font-bold mb-1">PlantDex ansehen</h3>
                  <p className="text-green-100 text-sm md:text-base">Sammlung erkunden 🌿</p>
                </div>
              </div>
            </button>
          </motion.div>

          {/* 3. Aufgaben */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <Card className="border-2 border-stone-200 shadow-lg bg-white">
              <CardHeader className="border-b border-stone-200 p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Target className="w-5 h-5 text-green-600" />
                    Aktuelle Aufgaben
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {displayQuests.length === 0 ? (
                  <div className="text-center py-6 text-stone-500">
                    <Target className="w-10 h-10 mx-auto mb-2 text-stone-400" />
                    <p className="text-sm">Keine aktiven Aufgaben</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayQuests.map((quest, index) => {
                      const progressPercentage = (quest.progress / quest.required_discoveries) * 100;
                      const isCompleted = quest.progress >= quest.required_discoveries;

                      return (
                        <motion.div
                          key={quest.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Card className="border-2 border-stone-200">
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    {quest.category !== "Alle" && (
                                      <Badge variant="outline" className="border-stone-300 text-xs">
                                        {quest.category}
                                      </Badge>
                                    )}
                                    {isCompleted && (
                                      <Badge className="bg-green-600 text-white text-xs">
                                        <Star className="w-3 h-3 mr-1" />
                                        Bereit!
                                      </Badge>
                                    )}
                                  </div>
                                  <h4 className="font-bold text-sm md:text-base text-stone-900 mb-1 truncate">{quest.title}</h4>
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
                                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-md">
                                    <span className="text-white font-bold text-xs">+{quest.xp_reward}</span>
                                  </div>
                                  <span className="text-[10px] text-stone-600 font-semibold mt-1 block">XP</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
