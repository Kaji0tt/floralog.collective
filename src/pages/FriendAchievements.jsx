
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import MobileBackButton from "../components/navigation/MobileBackButton";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function FriendAchievements() {
  const navigate = useNavigate();
  const [friendUser, setFriendUser] = useState(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get('email');

  useEffect(() => {
    const loadFriendUser = async () => {
      // Versuche PublicProfile zu laden
      const profiles = await base44.entities.PublicProfile.list();
      const profile = profiles.find(p => p.user_email?.toLowerCase() === friendEmail?.toLowerCase());
      
      if (profile) {
        setFriendUser(profile);
      } else {
        // Fallback, if no public profile is found
        setFriendUser({
          email: friendEmail,
          full_name: friendEmail, // Use email as fallback for name
          display_name: friendEmail, // Use email as fallback for display name
          level: 1, // Default level
          avatar_url: LOGO_URL, // Default avatar
          selected_title: "Unbekannter Freund" // Default title
        });
      }
    };
    if (friendEmail) {
      loadFriendUser();
    }
  }, [friendEmail]);

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list('achievement_number'),
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', friendEmail],
    queryFn: async () => {
      const achievements = await base44.entities.UserAchievement.list();
      // Nutze created_by für Achievements (das ist korrekt)
      return achievements.filter(ua => ua.created_by === friendEmail);
    },
    enabled: !!friendEmail,
  });

  if (!friendUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  const getRarityColor = (rarity) => {
    switch(rarity) {
      case "Ungewöhnlich": return "bg-green-500";
      case "Selten": return "bg-blue-500";
      case "Episch": return "bg-purple-500";
      case "Legendär": return "bg-amber-500";
      default: return "bg-gray-500";
    }
  };

  // Sortiere Achievements nach Rarität (niedrigste zuerst)
  const getRarityValue = (rarity) => {
    switch(rarity) {
      case "Ungewöhnlich": return 1;
      case "Selten": return 2;
      case "Episch": return 3;
      case "Legendär": return 4;
      default: return 0;
    }
  };

  const sortedAchievements = [...achievements].sort((a, b) => {
    return getRarityValue(a.rarity) - getRarityValue(b.rarity);
  });

  const unlockedAchievements = sortedAchievements.filter(a => 
    userAchievements.some(ua => ua.achievement_id === a.id)
  );
  const lockedAchievements = sortedAchievements.filter(a => 
    !userAchievements.some(ua => ua.achievement_id === a.id)
  );

  const unlockedCount = unlockedAchievements.length;
  const totalAchievements = achievements.length;
  // const achievementProgressPercentage = totalAchievements > 0 ? (unlockedCount / totalAchievements) * 100 : 0; // Not used in current render

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton backUrl={createPageUrl(`FriendProfile?email=${friendEmail}`)} />
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-col items-center relative mb-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopiedMessage(true);
                setTimeout(() => setCopiedMessage(false), 2000);
              }}
              className="flex items-center justify-center gap-4 p-2 rounded-lg hover:bg-stone-100 transition-colors duration-200 cursor-pointer"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                {friendUser.avatar_url ? (
                  <img src={friendUser.avatar_url} alt={friendUser.display_name || friendUser.full_name} className="w-full h-full object-cover" />
                ) : (
                  <img src={LOGO_URL} alt="PlantDex" className="w-8 h-8 object-contain" />
                )}
              </div>
              <div className="text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-stone-900">
                  {friendUser.display_name || friendUser.full_name}'s Erfolge
                </h1>
                <p className="text-lg text-stone-600">
                  Level {friendUser.level || 1} • {friendUser.selected_title || friendUser.title || "Pflanzen-Anfänger"}
                </p>
              </div>
            </button>
            {copiedMessage && (
              <Badge className="mt-2 bg-green-500 text-white shadow-sm">
                Link kopiert!
              </Badge>
            )}
          </div>
          
          <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-xl shadow-sm border border-amber-200">
            <Trophy className="w-6 h-6 text-amber-600" />
            <div className="text-left">
              <div className="text-2xl font-bold text-amber-600">{unlockedCount} / {totalAchievements}</div>
              <div className="text-sm font-medium text-stone-600">Erfolge freigeschaltet</div>
            </div>
          </div>
        </div>

        {/* Achievements Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Freigeschaltete Achievements */}
          {unlockedAchievements.map((achievement, index) => {
            const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
            
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-2 border-amber-300 bg-gradient-to-br from-white to-amber-50 shadow-md hover:shadow-xl transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-4xl">{achievement.icon_emoji}</div>
                          <div>
                            <Badge className={`${getRarityColor(achievement.rarity)} text-white font-semibold text-xs`}>
                              {achievement.rarity}
                            </Badge>
                          </div>
                        </div>
                        <CardTitle className="text-xl mb-2 text-stone-900">
                          {achievement.title}
                        </CardTitle>
                        <p className="text-sm text-stone-600">
                          {achievement.description}
                        </p>
                      </div>
                      <div className="ml-3 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
                        <Trophy className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-stone-700 font-semibold">
                          {achievement.requirement}
                        </span>
                      </div>
                      
                      {achievement.title_reward && (
                        <div className="pt-2 border-t border-stone-200">
                          <p className="text-xs text-purple-700 font-semibold">
                            ⭐ Titel: "{achievement.title_reward}"
                          </p>
                        </div>
                      )}

                      {userAchievement && (
                        <div className="pt-2 border-t border-stone-200">
                          <p className="text-xs text-stone-500">
                            Freigeschaltet am {format(new Date(userAchievement.unlocked_date), "d. MMMM yyyy", { locale: de })}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {/* Gesperrte Achievements */}
          {lockedAchievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (unlockedAchievements.length + index) * 0.05 }}
            >
              <Card className="border-2 border-stone-200 bg-stone-50 opacity-60 shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-4xl grayscale opacity-30">{achievement.icon_emoji}</div>
                        <div>
                          <Badge className="bg-stone-400 text-white font-semibold text-xs">
                            {achievement.rarity}
                          </Badge>
                        </div>
                      </div>
                      <CardTitle className="text-xl mb-2 text-stone-500">
                        {achievement.title}
                      </CardTitle>
                      <p className="text-sm text-stone-400">
                        {achievement.description}
                      </p>
                    </div>
                    <div className="ml-3 w-10 h-10 bg-stone-300 rounded-full flex items-center justify-center">
                      <Lock className="w-5 h-5 text-stone-500" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-stone-500 font-semibold">
                        {achievement.requirement}
                      </span>
                    </div>
                    
                    {achievement.title_reward && (
                      <div className="pt-2 border-t border-stone-200">
                        <p className="text-xs text-stone-400 font-semibold">
                          ⭐ Titel: "{achievement.title_reward}"
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {sortedAchievements.length === 0 && (
          <Card className="border-2 border-stone-200 bg-white">
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
  );
}
