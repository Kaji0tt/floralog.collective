import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Mail, Key, AlertCircle, RotateCcw, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements'],
    queryFn: () => base44.entities.UserAchievement.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list(),
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
      const freshUser = await base44.auth.me();
      setUser(freshUser);
      await updatePublicProfile(freshUser);
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
      console.error("Fehler beim PublicProfile Update:", error);
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

  const getTitleForLevel = (level) => {
    if (level >= 20) return "Pflanzen-Meister 🌳";
    if (level >= 15) return "Natur-Experte 🌿";
    if (level >= 10) return "Flora-Kenner 🍃";
    if (level >= 5) return "Pflanzen-Forscher 🔍";
    return "Pflanzen-Anfänger 🌱";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-2 border-stone-200 shadow-lg bg-white">
            <CardHeader className="border-b border-stone-200">
              <CardTitle className="flex items-center gap-2">
                <Key className="w-6 h-6 text-stone-600" />
                Einstellungen
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-stone-900 mb-1">Titel auswählen</h3>
                    <p className="text-sm text-stone-600 mb-3">
                      Wähle einen deiner freigeschalteten Titel aus
                    </p>
                    
                    <Select
                      value={user.selected_title || `level-${currentLevel}`}
                      onValueChange={(value) => {
                        if (value.startsWith('level-')) {
                          updateUserMutation.mutate({ selected_title: null });
                        } else {
                          updateUserMutation.mutate({ selected_title: value });
                        }
                      }}
                      disabled={updateUserMutation.isPending}
                    >
                      <SelectTrigger className="w-full border-2 border-purple-300 bg-white h-12">
                        <SelectValue>
                          <span className="font-semibold">
                            {user.selected_title || getTitleForLevel(currentLevel)}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={`level-${currentLevel}`}>
                          <span className="font-semibold">{getTitleForLevel(currentLevel)}</span>
                        </SelectItem>

                        {userAchievements
                          .map(ua => {
                            const achievement = achievements.find(a => a.id === ua.achievement_id);
                            return achievement?.title_reward ? achievement : null;
                          })
                          .filter(a => a !== null)
                          .map((achievement) => (
                            <SelectItem key={achievement.id} value={achievement.title_reward}>
                              <span className="font-semibold">{achievement.title_reward}</span>
                            </SelectItem>
                          ))}

                        {userAchievements.filter(ua => {
                          const achievement = achievements.find(a => a.id === ua.achievement_id);
                          return achievement?.title_reward;
                        }).length === 0 && (
                          <div className="p-3 text-center text-sm text-stone-500">
                            Keine Erfolgs-Titel freigeschaltet
                          </div>
                        )}
                      </SelectContent>
                    </Select>

                    {userAchievements.filter(ua => {
                      const achievement = achievements.find(a => a.id === ua.achievement_id);
                      return achievement?.title_reward;
                    }).length === 0 && (
                      <p className="text-xs text-stone-600 mt-2">
                        💡 Schalte Erfolge frei, um mehr Titel zu erhalten!
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-stone-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-600">E-Mail Adresse</p>
                    <p className="text-base font-medium text-stone-900">{user.email}</p>
                  </div>
                </div>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-900">
                  Passwort und E-Mail werden über dein base44-Konto verwaltet.
                </AlertDescription>
              </Alert>

              <div className="pt-4 border-t border-stone-200">
                <Button
                  onClick={() => navigate(createPageUrl("ResetAccount"))}
                  variant="outline"
                  className="w-full border-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 font-semibold mb-3"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Account zurücksetzen
                </Button>

                <Button
                  onClick={() => base44.auth.logout()}
                  variant="outline"
                  className="w-full border-2 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 font-semibold"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Abmelden
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}