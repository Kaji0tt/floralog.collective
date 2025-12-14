import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, BookOpen, Target, Users, Camera, Loader2, Image as ImageIcon, Map, Heart } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import AchievementNotification from "../components/achievements/AchievementNotification";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { getXPProgressInLevel } from "../components/utils/xpSystem";
import { Input } from "@/components/ui/input";
import { Edit2, CheckCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
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

  const favoritePlant = user?.favorite_plant_id 
    ? plants.find(p => p.id === user.favorite_plant_id)
    : null;

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
  }, []);

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      const freshUser = await base44.auth.me();
      setUser(freshUser);
      setEditedName(freshUser.display_name || freshUser.full_name);
      setIsEditingName(false);
      queryClient.invalidateQueries({ queryKey: ['user'] });
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

  useEffect(() => {
    if (user && user.email) {
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
    
    if (!trimmedName) {
      alert("Bitte gib einen Namen ein.");
      return;
    }
    
    const currentDisplayName = user.display_name || user.full_name;
    if (trimmedName === currentDisplayName) {
      setIsEditingName(false);
      return;
    }

    try {
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
    const color = await getAverageColor(imageUrl);
    if (color) {
      setAverageColor(color);
    }
  };

  const handleRemoveBackground = async () => {
    await updateUserMutation.mutateAsync({ background_image_url: null });
    setShowBackgroundSelector(false);
    setAverageColor(null);
  };

  const handleSetColor = async (color) => {
    await updateUserMutation.mutateAsync({ background_color: color });
    setShowColorPicker(false);
    setAverageColor(color);
  };

  const handleRemoveColor = async () => {
    await updateUserMutation.mutateAsync({ background_color: null });
    setShowColorPicker(false);
    setAverageColor(null);
  };

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

  useEffect(() => {
    if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) {
          setAverageColor(color);
        }
      });
    } else if (user?.background_color) {
      setAverageColor(user.background_color);
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

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

  const discoveredGenera = genera.filter(g => {
    const genusPlants = plants.filter(p => 
      p.genus_category === g.category && p.genus_number === g.category_dex_number
    );
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

  const getDisplayName = () => user.display_name || user.full_name;

  const getRgbaFromRgb = (rgbString, opacity) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
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

  return (
    <>
      <style>{`
        :root {
          --profile-bg-color: ${averageColor || 'rgb(250, 250, 249)'};
          --profile-bg-color-light: ${averageColor ? getLighterColor(averageColor) : 'rgb(255, 255, 255)'};
          --profile-bg-color-mid: ${averageColor ? averageColor : 'rgb(236, 253, 245)'};
          --profile-bg-color-dark: ${averageColor ? getDarkerColor(averageColor) : 'rgb(220, 252, 231)'};
          --profile-border-color: ${averageColor ? getRgbaFromRgb(averageColor, 0.4) : 'rgb(134, 239, 172)'};
        }
      `}</style>
      <div 
        className="h-screen min-w-full p-4 md:p-8 fixed inset-0 overflow-auto" 
        style={{
          background: averageColor 
            ? `linear-gradient(135deg, var(--profile-bg-color-light) 0%, var(--profile-bg-color-mid) 50%, var(--profile-bg-color-dark) 100%)`
            : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
        }}
      >
      
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

        <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hintergrundfarbe auswählen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={handleRemoveColor}
                className="w-full"
              >
                Farbe entfernen
              </Button>
              <div className="grid grid-cols-4 gap-3">
                {[
                  'rgb(59, 130, 246)', // Blue
                  'rgb(16, 185, 129)', // Green
                  'rgb(245, 158, 11)', // Amber
                  'rgb(239, 68, 68)', // Red
                  'rgb(168, 85, 247)', // Purple
                  'rgb(236, 72, 153)', // Pink
                  'rgb(20, 184, 166)', // Teal
                  'rgb(251, 146, 60)', // Orange
                  'rgb(34, 197, 94)', // Lime
                  'rgb(99, 102, 241)', // Indigo
                  'rgb(217, 70, 239)', // Fuchsia
                  'rgb(6, 182, 212)', // Cyan
                ].map((color) => (
                  <button
                    key={color}
                    onClick={() => handleSetColor(color)}
                    className="aspect-square rounded-lg border-2 border-stone-200 hover:border-stone-400 transition-colors hover:scale-110"
                    style={{ backgroundColor: color }}
                  />
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
          <Card 
            className="mb-6 shadow-xl bg-white overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow"
            style={{
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
            }}
            onClick={() => navigate(createPageUrl("Profile"))}
          >
            <CardContent 
              className="p-6 md:p-8 relative"
              style={user?.background_image_url ? {
                backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.4) 100%), url(${user.background_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : user?.background_color ? {
                background: `linear-gradient(135deg, ${user.background_color.replace('rgb', 'rgba').replace(')', ', 0.6)')} 0%, ${user.background_color.replace('rgb', 'rgba').replace(')', ', 1)')} 100%)`
              } : {}}
            >
              {user?.role === 'admin' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBackgroundSelector(true);
                  }}
                  className="absolute top-4 right-4 w-10 h-10 bg-stone-200/80 hover:bg-stone-300/80 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-10"
                >
                  <ImageIcon className="w-5 h-5 text-stone-700" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(true);
                  }}
                  className="absolute top-4 right-4 w-10 h-10 bg-stone-200/80 hover:bg-stone-300/80 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-10"
                >
                  <ImageIcon className="w-5 h-5 text-stone-700" />
                </button>
              )}

              <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
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
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute -top-2 -right-2 px-3 py-1 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-xl backdrop-blur-sm border-2 border-white/80 hover:scale-110 transition-transform cursor-pointer"
                      >
                        <span className="text-white font-bold text-sm">LV {currentLevel}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-stone-800">Level {currentLevel}</span>
                          <span className="text-sm font-bold text-stone-800">{xpProgress.current} / {xpProgress.needed} XP</span>
                        </div>
                        <Progress value={xpProgress.percentage} className="h-2" />
                        <p className="text-xs text-stone-600">{xpProgress.percentage.toFixed(1)}% bis Level {currentLevel + 1}</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

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
                    <div className="mb-2">
                      <h1 className="text-3xl md:text-4xl font-bold text-stone-900" key={getDisplayName()}>
                        {getDisplayName()}
                      </h1>
                    </div>
                  )}

                  <div className="mb-3">
                    <span className="text-base font-semibold text-stone-700">
                      {user.selected_title || user.title || getTitleForLevel(currentLevel)}
                    </span>
                    </div>

                    {favoritePlant && (() => {
                      const genus = genera.find(g => 
                        g.category === favoritePlant.genus_category && 
                        g.category_dex_number === favoritePlant.genus_number
                      );
                      return genus ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(createPageUrl(`GenusDetail?id=${genus.id}`));
                          }}
                          className="mt-3 flex items-center gap-2 p-2 bg-white/40 rounded-lg border border-white/30 hover:bg-white/60 transition-colors w-full"
                        >
                          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-stone-900">{favoritePlant.species_name}</p>
                            <p className="text-xs italic text-stone-600">{favoritePlant.scientific_name}</p>
                          </div>
                        </button>
                      ) : null;
                    })()}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {statButtons.map((stat, index) => (
                  <motion.button
                    key={stat.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      stat.onClick();
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white/60 backdrop-blur-md rounded-xl p-3 md:p-4 hover:shadow-lg transition-all duration-300 group"
                    style={{
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: averageColor ? 'var(--profile-border-color)' : stat.borderColor.replace('border-', '').replace('-200', '')
                    }}
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
          <Card 
            className="mb-6 shadow-lg bg-white/80 backdrop-blur-md"
            style={{
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-around gap-4">
                <button
                  onClick={() => navigate(createPageUrl("Scanner"))}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
                    style={{
                      background: averageColor 
                        ? `linear-gradient(135deg, var(--profile-bg-color) 0%, var(--profile-bg-color-dark) 100%)`
                        : 'linear-gradient(135deg, rgb(34, 197, 94), rgb(22, 163, 74))'
                    }}
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-semibold text-stone-900">Scannen</span>
                </button>

                <button
                  onClick={() => navigate(createPageUrl("Map"))}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
                    style={{
                      background: averageColor 
                        ? `linear-gradient(135deg, var(--profile-bg-color) 0%, var(--profile-bg-color-dark) 100%)`
                        : 'linear-gradient(135deg, rgb(34, 197, 94), rgb(22, 163, 74))'
                    }}
                  >
                    <Map className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-semibold text-stone-900">Karte</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-6 pb-6"
        >
          <div className="flex justify-center gap-6 text-sm">
            <button
              onClick={() => navigate(createPageUrl("Donate"))}
              className="hover:opacity-80 transition-all font-medium px-2 py-1 rounded backdrop-blur-sm"
              style={{ 
                color: averageColor ? getLighterColor(getLighterColor(averageColor)) : 'rgb(120, 113, 108)',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              Spenden
            </button>
            <span 
              className="opacity-60"
              style={{ 
                color: averageColor ? getLighterColor(averageColor) : 'rgb(120, 113, 108)'
              }}
            >
              •
            </span>
            <button
              onClick={() => navigate(createPageUrl("Impressum"))}
              className="hover:opacity-80 transition-all font-medium px-2 py-1 rounded backdrop-blur-sm"
              style={{ 
                color: averageColor ? getLighterColor(getLighterColor(averageColor)) : 'rgb(120, 113, 108)',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              Impressum
            </button>
          </div>
        </motion.div>
      </div>
      </div>
    </>
  );
}