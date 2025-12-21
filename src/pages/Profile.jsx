import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, BookOpen, Target, Users, Camera, Loader2, LogOut, Mail, Key, AlertCircle, RotateCcw, Star, Image as ImageIcon, Edit2, CheckCircle, X, Heart, Map as MapIcon, Leaf, ChevronDown, ChevronUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

// Vorgefertigte Hintergrundbilder mit vorberechneten Durchschnittsfarben
const PRESET_BACKGROUNDS = [
  { url: "https://blauzahn.eu/PlantDex/BackGround4.jpg", color: "rgb(89, 107, 68)" },
  { url: "https://blauzahn.eu/PlantDex/BackGround1.png", color: "rgb(118, 142, 98)" },
  { url: "https://blauzahn.eu/PlantDex/BackGround2.png", color: "rgb(95, 118, 82)" },
  { url: "https://blauzahn.eu/PlantDex/Donor.png", color: "rgb(11, 28, 25)" }, // oder einfach nur { url: "..." }
  { url: "https://blauzahn.eu/PlantDex/Colors.png", color: "rgba(134, 94, 94, 1)" },
  { url: "https://blauzahn.eu/PlantDex/Urban.png", color: "rgb(108, 101, 62)" },
  { url: "https://blauzahn.eu/PlantDex/Plains.png", color: "rgb(181, 191, 94)" },
  {url: "https://blauzahn.eu/PlantDex/EpicRare.png", color: "rgb(31, 35, 21)"}
];


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
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);
  const [averageColor, setAverageColor] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({
    colors: false,
    presets: false,
    scans: false
  });

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
        avatar_url: userData.avatar_url,
        background_image_url: userData.background_image_url,
        background_color: userData.background_color,
        favorite_plant_id: userData.favorite_plant_id
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
  }, [user?.level, user?.xp, user?.display_name, user?.avatar_url, user?.selected_title, user?.email, user?.background_image_url, user?.background_color, user?.favorite_plant_id]);

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

  const handleSetBackground = async (imageUrl, precomputedColor = null) => {
    console.log("🎨 handleSetBackground called with imageUrl:", imageUrl);
    console.log("🎨 Precomputed color:", precomputedColor);
    
    let color = precomputedColor;
    if (!color) {
      color = await getAverageColor(imageUrl);
      console.log("🎨 getAverageColor returned:", color);
    }
    
    await updateUserMutation.mutateAsync({ 
      background_image_url: imageUrl, 
      background_color: color 
    });
    console.log("✅ User mutation successful, background_image_url set to:", imageUrl);
    setShowBackgroundSelector(false);
    if (color) {
      console.log("✅ Setting averageColor state to:", color);
      setAverageColor(color);
    } else {
      console.warn("⚠️ No color was calculated, averageColor not set");
    }
  };

  const handleRemoveBackground = async () => {
    await updateUserMutation.mutateAsync({ background_image_url: null });
    setShowBackgroundSelector(false);
    setAverageColor(null);
  };

  const handleSetColor = async (color) => {
    await updateUserMutation.mutateAsync({ background_image_url: null, background_color: color });
    setShowBackgroundSelector(false);
    setAverageColor(color);
    const freshUser = await base44.auth.me();
    await updatePublicProfile(freshUser);
  };

  const handleRemoveColor = async () => {
    await updateUserMutation.mutateAsync({ background_color: null });
    setShowBackgroundSelector(false);
    setAverageColor(null);
    const freshUser = await base44.auth.me();
    await updatePublicProfile(freshUser);
  };

  const getAverageColor = (imageUrl) => {
    console.log("🖼️ getAverageColor called for:", imageUrl);
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        console.log("✅ Image loaded successfully:", imageUrl);
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
          
          const resultColor = `rgb(${r}, ${g}, ${b})`;
          console.log("✅ Average color calculated:", resultColor);
          resolve(resultColor);
        } catch (error) {
          console.error("❌ Error calculating average color:", error);
          resolve(null);
        }
      };
      
      img.onerror = (error) => {
        console.error("❌ Image failed to load:", imageUrl, error);
        resolve(null);
      };
      img.src = imageUrl;
    });
  };

  useEffect(() => {
    if (user?.background_color) {
      setAverageColor(user.background_color);
    } else if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) {
          setAverageColor(color);
        }
      });
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
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

  const scannedPlantsCount = userDiscoveries.length;

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
        <Dialog open={showBackgroundSelector} onOpenChange={setShowBackgroundSelector}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Hintergrund auswählen</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <Button
                variant="outline"
                onClick={() => {
                  handleRemoveBackground();
                  handleRemoveColor();
                }}
                className="w-full"
              >
                Hintergrund entfernen
              </Button>

              {/* Farben Section */}
              <div>
                <button
                  onClick={() => setCollapsedSections(prev => ({ ...prev, colors: !prev.colors }))}
                  className="w-full flex items-center justify-between p-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors mb-3"
                >
                  <h3 className="text-sm font-semibold text-stone-900">Einfarbiger Hintergrund</h3>
                  {collapsedSections.colors ? (
                    <ChevronDown className="w-5 h-5 text-stone-600" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-stone-600" />
                  )}
                </button>
                {!collapsedSections.colors && (
                  <TooltipProvider>
                    <div className="space-y-4">
                      {/* Reihe 1: 5 Scans */}
                      <div>
                        <p className="text-xs text-stone-600 mb-2">Freischaltung bei 5 Scans</p>
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            'rgb(199, 209, 163)',
                            'rgb(196, 178, 143)',
                            'rgb(143, 196, 178)',
                            'rgb(196, 143, 143)',
                          ].map((color) => {
                            const isUnlocked = scannedPlantsCount >= 5;
                            return (
                              <Tooltip key={color}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => isUnlocked && handleSetColor(color)}
                                    disabled={!isUnlocked}
                                    className={`aspect-square rounded-lg border-2 relative ${
                                      isUnlocked 
                                        ? 'border-stone-200 hover:border-stone-400 hover:scale-110' 
                                        : 'border-stone-400 cursor-not-allowed'
                                    } transition-all`}
                                    style={{ backgroundColor: color }}
                                  >
                                    {!isUnlocked && (
                                      <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                                        <Lock className="w-12 h-12 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]" />
                                      </div>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                {!isUnlocked && (
                                  <TooltipContent>
                                    <p>Scanne 5 Pflanzen um diese Farbe freizuschalten ({scannedPlantsCount}/5)</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            );
                            })}
                            </div>
                            </div>

                            {/* Reihe 2: 10 Scans */}
                            <div>
                            <p className="text-xs text-stone-600 mb-2">Freischaltung bei 10 Scans</p>
                            <div className="grid grid-cols-4 gap-3">
                            {[
                            'rgb(176, 72, 72)',
                            'rgb(176, 159, 72)',
                            'rgb(115, 158, 63)',
                            'rgb(227, 197, 84)',
                            ].map((color) => {
                            const isUnlocked = scannedPlantsCount >= 10;
                            return (
                              <Tooltip key={color}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => isUnlocked && handleSetColor(color)}
                                    disabled={!isUnlocked}
                                    className={`aspect-square rounded-lg border-2 relative ${
                                      isUnlocked 
                                        ? 'border-stone-200 hover:border-stone-400 hover:scale-110' 
                                        : 'border-stone-400 cursor-not-allowed'
                                    } transition-all`}
                                    style={{ backgroundColor: color }}
                                  >
                                    {!isUnlocked && (
                                      <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                                        <Lock className="w-12 h-12 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]" />
                                      </div>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                {!isUnlocked && (
                                  <TooltipContent>
                                    <p>Scanne 10 Pflanzen um diese Farbe freizuschalten ({scannedPlantsCount}/10)</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            );
                            })}
                            </div>
                            </div>

                            {/* Reihe 3: 20 Scans */}
                            <div>
                            <p className="text-xs text-stone-600 mb-2">Freischaltung bei 20 Scans</p>
                            <div className="grid grid-cols-4 gap-3">
                            {[
                            'rgb(97, 36, 31)',
                            'rgb(31, 92, 97)',
                            'rgb(74, 55, 21)',
                            'rgb(30, 54, 8)',
                            ].map((color) => {
                            const isUnlocked = scannedPlantsCount >= 20;
                            return (
                              <Tooltip key={color}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => isUnlocked && handleSetColor(color)}
                                    disabled={!isUnlocked}
                                    className={`aspect-square rounded-lg border-2 relative ${
                                      isUnlocked 
                                        ? 'border-stone-200 hover:border-stone-400 hover:scale-110' 
                                        : 'border-stone-400 cursor-not-allowed'
                                    } transition-all`}
                                    style={{ backgroundColor: color }}
                                  >
                                    {!isUnlocked && (
                                      <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                                        <Lock className="w-12 h-12 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]" />
                                      </div>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                {!isUnlocked && (
                                  <TooltipContent>
                                    <p>Scanne 20 Pflanzen um diese Farbe freizuschalten ({scannedPlantsCount}/20)</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </TooltipProvider>
                )}
              </div>

              {/* Vorgefertigte Hintergründe */}
              {PRESET_BACKGROUNDS.length > 0 && (
                <div>
                  <button
                    onClick={() => setCollapsedSections(prev => ({ ...prev, presets: !prev.presets }))}
                    className="w-full flex items-center justify-between p-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors mb-3"
                  >
                    <h3 className="text-sm font-semibold text-stone-900">Vorgefertigte Hintergründe</h3>
                    {collapsedSections.presets ? (
                      <ChevronDown className="w-5 h-5 text-stone-600" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-stone-600" />
                    )}
                  </button>
                  {!collapsedSections.presets && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {PRESET_BACKGROUNDS.map((bg, index) => (
                        <button
                          key={`preset-${index}`}
                          onClick={() => handleSetBackground(bg.url, bg.color)}
                          className="relative aspect-square rounded-lg overflow-hidden border-2 border-stone-200 hover:border-green-500 transition-colors group"
                        >
                          <img
                            src={bg.url}
                            alt={`Hintergrund ${index + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Scans Section - nur für Admins und Donors */}
              {(user?.role === 'admin' || user?.donor_status) && (
                <div>
                  <button
                    onClick={() => setCollapsedSections(prev => ({ ...prev, scans: !prev.scans }))}
                    className="w-full flex items-center justify-between p-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors mb-3"
                  >
                    <h3 className="text-sm font-semibold text-stone-900">Pflanzenbild als Hintergrund</h3>
                    {collapsedSections.scans ? (
                      <ChevronDown className="w-5 h-5 text-stone-600" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-stone-600" />
                    )}
                  </button>
                  {!collapsedSections.scans && (
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
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card 
            className="mb-6 shadow-xl bg-white overflow-hidden"
            style={{
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
            }}
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
              <button
                onClick={() => setShowBackgroundSelector(true)}
                className="absolute top-4 right-4 w-10 h-10 bg-stone-200/80 hover:bg-stone-300/80 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-10"
              >
                <ImageIcon className="w-5 h-5 text-stone-700" />
              </button>
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
                    <div className="mb-2 flex items-center gap-2">
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
                    onClick={stat.onClick}
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

              {/* Scannen/Karte Container - innerhalb der Profilkarte */}
              <div className="mt-4">
                <div 
                  className="bg-white/60 backdrop-blur-md rounded-xl p-4 shadow-md"
                  style={{
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
                  }}
                >
                  <div className="flex items-center justify-around gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(createPageUrl("Scanner"));
                      }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(createPageUrl("Map"));
                      }}
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
                        <MapIcon className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-semibold text-stone-900">Karte</span>
                    </button>
                  </div>
                </div>
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
              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
                <div>
                  <p className="font-semibold text-stone-900">Weekly Tracking</p>
                  <p className="text-xs text-stone-600">Deine Scans in wöchentlichen Challenges teilen</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={user?.weekly_tracking !== false}
                    onChange={(e) => updateUserMutation.mutate({ weekly_tracking: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
                <div>
                  <p className="font-semibold text-stone-900">Lokales Tracking</p>
                  <p className="text-xs text-stone-600">Zeige deine Scans im lokalen Tab (20km Umkreis)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={user?.local_tracking !== false}
                    onChange={(e) => updateUserMutation.mutate({ local_tracking: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

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
      </>
  );
}