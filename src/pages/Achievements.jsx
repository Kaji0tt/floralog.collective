
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Achievements() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list('achievement_number'),
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', user?.email],
    queryFn: () => base44.entities.UserAchievement.filter({ created_by: user?.email }),
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
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-4">
              Deine Erfolge 🏆
            </h1>
            <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-xl shadow-sm border border-stone-200">
              <Trophy className="w-6 h-6 text-amber-600" />
              <div className="text-left">
                <div className="text-2xl font-bold text-amber-600">{unlockedCount} / {achievements.length}</div>
                <div className="text-sm font-medium text-stone-600">Erfolge freigeschaltet</div>
              </div>
            </div>
            {user.selected_title && (
              <div className="mt-4">
                <Badge className="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-base px-4 py-2">
                  ⭐ Aktueller Titel: {user.selected_title}
                </Badge>
              </div>
            )}
          </div>
        </motion.div>

        {/* Achievements Grid */}
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
                <Card className={`border-2 shadow-md transition-all duration-300 ${
                  isUnlocked 
                    ? 'border-amber-300 bg-gradient-to-br from-white to-amber-50 hover:shadow-xl' 
                    : 'border-stone-200 bg-stone-50 opacity-60'
                }`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`text-4xl ${isUnlocked ? '' : 'grayscale opacity-30'}`}>
                            {achievement.icon_emoji}
                          </div>
                          <div>
                            <Badge className={`${getRarityColor(achievement.rarity)} text-white font-semibold text-xs`}>
                              {achievement.rarity}
                            </Badge>
                          </div>
                        </div>
                        <CardTitle className={`text-xl mb-2 ${isUnlocked ? 'text-stone-900' : 'text-stone-500'}`}>
                          {achievement.title}
                        </CardTitle>
                        <p className={`text-sm ${isUnlocked ? 'text-stone-600' : 'text-stone-400'}`}>
                          {achievement.description}
                        </p>
                      </div>
                      {isUnlocked ? (
                        <div className="ml-3 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
                          <Trophy className="w-6 h-6 text-white" />
                        </div>
                      ) : (
                        <div className="ml-3 w-10 h-10 bg-stone-300 rounded-full flex items-center justify-center">
                          <Lock className="w-5 h-5 text-stone-500" />
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className={isUnlocked ? 'text-stone-700 font-semibold' : 'text-stone-500'}>
                          {achievement.requirement}
                        </span>
                      </div>
                      
                      {achievement.title_reward && (
                        <div className="pt-2 border-t border-stone-200">
                          <p className="text-xs text-purple-700 font-semibold mb-2">
                            ⭐ Titel-Belohnung: "{achievement.title_reward}"
                          </p>
                          {isUnlocked && (
                            <Button
                              onClick={() => handleSelectTitle(achievement)}
                              disabled={isCurrentTitle || updateTitleMutation.isPending}
                              className={`w-full text-xs ${
                                isCurrentTitle 
                                  ? 'bg-green-600 hover:bg-green-600' 
                                  : 'bg-purple-600 hover:bg-purple-700'
                              }`}
                              size="sm"
                            >
                              {isCurrentTitle ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Aktiver Titel
                                </>
                              ) : (
                                'Titel ausrüsten'
                              )}
                            </Button>
                          )}
                        </div>
                      )}

                      {isUnlocked && userAchievement && (
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
  );
}
