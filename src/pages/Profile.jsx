import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, BookOpen, Target, Users, Camera, Loader2, LogOut, Mail, Key, AlertCircle, Edit2, CheckCircle, X, RotateCcw, Star, Image as ImageIcon } from "lucide-react"; // Added Star icon
import { motion, AnimatePresence } from "framer-motion";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import AchievementNotification from "../components/achievements/AchievementNotification";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getXPProgressInLevel } from "../components/utils/xpSystem";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);
  const [averageColor, setAverageColor] = useState(null);

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
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await base44.entities.Friend.list();
      
      // Freunde: wo ich ENTWEDER Sender ODER Empfänger bin, UND status=accepted
      return allFriends.filter(f => 
        (f.request_sent_by?.toLowerCase() === user.email.toLowerCase() || 
         f.request_sent_to?.toLowerCase() === user.email.toLowerCase()) && 
        f.status === 'accepted'
      );
    },
    enabled: !!user?.email,
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements'],
    queryFn: () => base44.entities.UserAchievement.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  // Fetch all achievements to get title_rewards
  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list(),
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setEditedName(currentUser?.display_name || currentUser?.full_name || "");
      
      if (currentUser && !currentUser.level) {
        await base44.auth.updateMe({
          level: 1,
          xp: 0,
          title: "Pflanzen-Anfänger"
        });
      }
    };
    loadUser();
  }, [refreshKey]);

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: async (data, variables) => {
      console.log("✅ Update erfolgreich!");
      console.log("📦 Gesendete Daten:", variables);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const freshUser = await base44.auth.me();
      console.log("👤 Frischer User:", freshUser);
      console.log("📝 Neuer Display Name:", freshUser.display_name);
      
      setUser(freshUser);
      setEditedName(freshUser.display_name || freshUser.full_name);
      setIsEditingName(false);
      setRefreshKey(prev => prev + 1);
      
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['userAchievements'] });
      
      // Update PublicProfile für Freunde!
      await updatePublicProfile(freshUser);
    },
    onError: (error) => {
      console.error("❌ Fehler beim Update:", error);
      alert(`Fehler beim Speichern: ${error.message}`);
      setIsEditingName(false);
    }
  });

  const updatePublicProfile = async (userData) => {
    try {
      // Suche existierendes PublicProfile
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

  // Beim ersten Laden und bei Änderungen an relevanten Benutzerdaten: Erstelle/Update PublicProfile
  useEffect(() => {
    if (user && user.email) { // Ensure user and user.email exist
      updatePublicProfile(user);
    }
  }, [user?.level, user?.xp, user?.display_name, user?.avatar_url, user?.selected_title, user?.email]);


  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await updateUserMutation.mutateAsync({ avatar_url: file_url });
    } catch (error) {
      console.error("Fehler beim Hochladen:", error);
      alert(`Fehler beim Hochladen: ${error.message}`);
    }
    setUploadingImage(false);
  };

  const handleSaveName = async () => {
    const trimmedName = editedName.trim();
    
    console.log("💾 Versuche Display Name zu speichern...");
    console.log("📋 Aktueller Display Name:", user.display_name || user.full_name);
    console.log("📝 Neuer Display Name:", trimmedName);
    
    if (!trimmedName) {
      alert("Bitte gib einen Namen ein.");
      return;
    }
    
    const currentDisplayName = user.display_name || user.full_name;
    if (trimmedName === currentDisplayName) {
      console.log("⚠️ Name unverändert");
      setIsEditingName(false);
      return;
    }

    try {
      console.log("🚀 Sende Update...");
      await updateUserMutation.mutateAsync({ display_name: trimmedName });
      alert("✅ Name erfolgreich geändert!");
    } catch (error) {
      console.error("❌ Fehler beim Speichern:", error);
      alert(`Fehler: ${error.message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(user.display_name || user.full_name);
    setIsEditingName(false);
  };

  const handleSetBackground = async (imageUrl) => {
    await updateUserMutation.mutateAsync({ background_image_url: imageUrl });
    setShowBackgroundSelector(false);
  };

  const handleRemoveBackground = async () => {
    await updateUserMutation.mutateAsync({ background_image_url: null });
    setShowBackgroundSelector(false);
    setAverageColor(null);
  };

  const getAverageColor = (imageUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Kleinere Größe für schnellere Berechnung
          const size = 50;
          canvas.width = size;
          canvas.height = size;
          
          ctx.drawImage(img, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          
          let r = 0, g = 0, b = 0, count = 0;
          
          // Sample nur einen Teil der Pixel für bessere Performance
          for (let i = 0; i < data.length; i += 16) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          
          console.log('Durchschnittsfarbe berechnet:', `rgb(${r}, ${g}, ${b})`);
          resolve(`rgb(${r}, ${g}, ${b})`);
        } catch (error) {
          console.error('Fehler beim Berechnen der Farbe:', error);
          resolve(null);
        }
      };
      
      img.onerror = (error) => {
        console.error('Fehler beim Laden des Bildes:', error);
        resolve(null);
      };
      
      img.src = imageUrl;
    });
  };

  useEffect(() => {
    if (user?.background_image_url) {
      console.log('Berechne Farbe für:', user.background_image_url);
      getAverageColor(user.background_image_url).then(color => {
        if (color) {
          console.log('Setze Hintergrundfarbe:', color);
          setAverageColor(color);
        }
      });
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  const currentLevel = user.level || 1;
  const currentXP = user.xp || 0;
  const xpProgress = getXPProgressInLevel(currentXP, currentLevel);

  const discoveredPlants = userDiscoveries.length;
  const discoveredGenera = genera.filter(g => {
    const genusPlants = plants.filter(p => p.genus_id === g.id);
    return genusPlants.some(p => userDiscoveries.some(d => d.plant_id === p.id));
  }).length;
  const availableQuests = quests.filter(q => 
    (q.unlocked_at_level || 1) <= currentLevel &&
    !userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  ).length;

  const getTitleForLevel = (level) => {
    if (level >= 20) return "Pflanzen-Meister 🌳";
    if (level >= 15) return "Natur-Experte 🌿";
    if (level >= 10) return "Flora-Kenner 🍃";
    if (level >= 5) return "Pflanzen-Forscher 🔍";
    return "Pflanzen-Anfänger 🌱";
  };

  const statButtons = [
    {
      icon: BookOpen,
      label: "Gattungen",
      value: discoveredGenera,
      color: "from-green-500 to-green-600",
      textColor: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
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
      onClick: () => navigate(createPageUrl("Achievements"))
    },
    {
      icon: Target,
      label: "Aufgaben",
      value: availableQuests,
      color: "from-blue-500 to-blue-600",
      textColor: "text-blue-700",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
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
      onClick: () => navigate(createPageUrl("Friends"))
    }
  ];

  // Hilfsfunktion für Anzeigename
  const getDisplayName = () => user.display_name || user.full_name;

  const mainBackgroundStyle = averageColor 
    ? { background: `linear-gradient(135deg, ${averageColor} 0%, ${averageColor}dd 50%, ${averageColor}bb 100%)` }
    : { background: 'linear-gradient(135deg, rgb(250, 250, 249) 0%, rgb(236, 253, 245) 100%)' };

  console.log('Aktueller averageColor State:', averageColor);
  console.log('Style wird angewendet:', mainBackgroundStyle);

  return (
    <div 
      className="min-h-screen p-4 md:p-8" 
      style={mainBackgroundStyle}
      key={`${refreshKey}-${averageColor}`}
    >
      <MobileBackButton />
      
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

      <div className="max-w-4xl mx-auto">
        {/* Background Selector Dialog */}
        <Dialog open={showBackgroundSelector} onOpenChange={setShowBackgroundSelector}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Hintergrund auswählen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={handleRemoveBackground}
                className="w-full"
              >
                Hintergrund entfernen
              </Button>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {userDiscoveries
                  .filter(d => d.image_url)
                  .map((discovery) => (
                    <button
                      key={discovery.id}
                      onClick={() => handleSetBackground(discovery.image_url)}
                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-stone-200 hover:border-green-500 transition-colors group"
                    >
                      <img
                        src={discovery.image_url}
                        alt="Scan"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </button>
                  ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-6 border-2 border-green-200 shadow-xl bg-white overflow-hidden">
            <CardContent 
              className="p-6 md:p-8 relative"
              style={user?.background_image_url ? {
                backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2)), url(${user.background_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}}
            >
              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowBackgroundSelector(true)}
                  className="absolute top-4 right-4 w-10 h-10 bg-stone-200/80 hover:bg-stone-300/80 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-10"
                >
                  <ImageIcon className="w-5 h-5 text-stone-700" />
                </button>
              )}
              <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
                {/* Profilbild mit Level Badge */}
                <div className="relative group flex-shrink-0">
                  <div className="w-28 h-28 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden ring-4 ring-white/50 backdrop-blur-sm">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                    ) : (
                      <img src={LOGO_URL} alt="PlantDex" className="w-14 h-14 object-contain" />
                    )}
                  </div>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    disabled={uploadingImage}
                    aria-label="Profilbild hochladen"
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <Camera className="w-8 h-8 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  
                  <div className="absolute -top-2 -right-2 px-3 py-1 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-xl backdrop-blur-sm border-2 border-white/80">
                    <span className="text-white font-bold text-sm">LV {currentLevel}</span>
                  </div>
                </div>

                {/* Name, Titel und XP Balken - Fusioniert */}
                <div className="flex-1 w-full bg-white/40 backdrop-blur-md rounded-xl p-5 border-2 border-white/30 shadow-lg">
                  {isEditingName ? (
                    <div className="mb-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="text-2xl font-bold border-2 border-green-300 bg-white/60 backdrop-blur-sm"
                          placeholder="Dein Name"
                          maxLength={50}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                        />
                        <Button
                          onClick={handleSaveName}
                          disabled={updateUserMutation.isPending || !editedName.trim()}
                          size="icon"
                          className="bg-green-600 hover:bg-green-700 flex-shrink-0"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          disabled={updateUserMutation.isPending}
                          size="icon"
                          variant="outline"
                          className="flex-shrink-0 bg-white/60 backdrop-blur-sm"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-3xl md:text-4xl font-bold text-stone-900" key={getDisplayName()}>
                        {getDisplayName()}
                      </h1>
                      <Button
                        onClick={() => setIsEditingName(true)}
                        size="icon"
                        variant="ghost"
                        className="text-stone-700 hover:text-stone-900 hover:bg-white/30"
                      >
                        <Edit2 className="w-5 h-5" />
                      </Button>
                    </div>
                  )}

                  <div className="mb-3">
                    <span className="text-base font-semibold text-stone-700">
                      {user.selected_title || user.title || getTitleForLevel(currentLevel)}
                    </span>
                  </div>

                  {/* XP Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-stone-800">Level {currentLevel}</span>
                      <span className="text-sm font-bold text-stone-800">{xpProgress.current} / {xpProgress.needed} XP</span>
                    </div>
                    <div className="relative h-3 bg-stone-300/50 rounded-full overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${xpProgress.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {statButtons.map((stat, index) => (
                  <motion.button
                    key={stat.label}
                    onClick={stat.onClick}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`bg-white/60 backdrop-blur-md ${stat.borderColor} border-2 rounded-xl p-3 md:p-4 hover:shadow-lg transition-all duration-300 group`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br ${stat.color} rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                        <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                      <div className="text-2xl md:text-3xl font-bold text-stone-700">{stat.value}</div>
                      <div className="text-xs font-semibold text-stone-600 hidden sm:block">{stat.label}</div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Card className="border-2 border-stone-200 shadow-lg bg-white">
            <CardHeader className="border-b border-stone-200">
              <CardTitle className="flex items-center gap-2">
                <Key className="w-6 h-6 text-stone-600" />
                Einstellungen
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Titel auswählen */}
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
                        {/* Standard-Titel */}
                        <SelectItem value={`level-${currentLevel}`}>
                          <span className="font-semibold">{getTitleForLevel(currentLevel)}</span>
                        </SelectItem>

                        {/* Achievement-Titel */}
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