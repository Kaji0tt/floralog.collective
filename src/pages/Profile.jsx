import React, { useState, useEffect, useRef } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { upsertUserProfile } from "@/api/authService";
import { signOut } from "@/api/authService";
import { uploadFile } from "@/api/storage";
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

import MobileBackButton from "../components/navigation/MobileBackButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";




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
  const [showBackgroundButtonHighlight, setShowBackgroundButtonHighlight] = useState(false);
  const [showScanButtonHighlight, setShowScanButtonHighlight] = useState(false);
  const [showAchievementsButtonHighlight, setShowAchievementsButtonHighlight] = useState(false);

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ['userDiscoveries'],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
  });

  // Lieblingsscan-/Lieblingspflanzen-Anzeige wurde aus dem Spiel entfernt

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => Query.Quest.list('quest_number'),
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests'],
    queryFn: async () => {
      try {
        return await Query.UserQuest.filter({ auth_id: user?.id });
      } catch (e) {
        // Fehler wird nur einmal angezeigt, kein Retry
        return [];
      }
    },
    enabled: !!user?.id,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await Query.Friend.list();
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
    queryFn: () => Query.UserAchievement.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => Query.Achievement.list(),
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ['userWeeklyQuests'],
    queryFn: () => Query.UserWeeklyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
  });

  const { data: userMonthlyQuests = [] } = useQuery({
    queryKey: ['userMonthlyQuests'],
    queryFn: () => Query.UserMonthlyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
  });

  const { data: sharedScans = [] } = useQuery({
    queryKey: ['sharedScans'],
    queryFn: () => Query.SharedScan.filter({ auth_id_to: user?.id }),
    enabled: !!user?.id,
  });

  const { data: backgroundNotifications = [] } = useQuery({
    queryKey: ['backgroundNotifications', user?.id],
    queryFn: () => Query.UserNotification.filter({ 
      auth_id: user?.id,
      notification_type: "custom",
      seen: false
    }),
    enabled: !!user?.id
  });

  const { data: allRewards = [] } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Query.Reward.list(),
  });

  const { data: userRewards = [] } = useQuery({
    queryKey: ['userRewards', user?.id],
    queryFn: () => Query.UserReward.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setEditedName(currentUser?.display_name || currentUser?.full_name || "");
      
      // Prüfe und schalte Rewards frei (z.B. Donor-Rewards)
      if (currentUser?.email) {
        const { checkAndUnlockRewards } = await import("../components/rewards/rewardUnlocker");
        await checkAndUnlockRewards(currentUser);
      }
    };
    loadUser();
  }, []);

  // Prüfe ob Hintergrund-Button-Highlight angezeigt werden soll
  useEffect(() => {
    // Nur prüfen wenn Daten vollständig geladen sind
    if (backgroundNotifications.length === undefined) return;
    
    const hasChangedBackground = localStorage.getItem('hasChangedBackground');
    const hasVisitedProfileSettings = localStorage.getItem('hasVisitedProfileSettings');
    const hasPendingBackgroundNotification = backgroundNotifications.some(n => 
      n.title?.includes("Personalisiere") && !n.seen
    );
    
    // Nur aktivieren wenn ALLE Bedingungen erfüllt sind
    const shouldHighlight = !hasChangedBackground && hasVisitedProfileSettings && hasPendingBackgroundNotification;
    setShowBackgroundButtonHighlight(shouldHighlight);
  }, [backgroundNotifications]);

  // Prüfe ob Scan-Button-Highlight angezeigt werden soll
  useEffect(() => {
    if (backgroundNotifications.length === undefined) return;
    
    const hasCompletedFirstScan = localStorage.getItem('hasVisitedScanner');
    const hasPendingScanNotification = backgroundNotifications.some(n => 
      n.title?.includes("Scannen") && !n.seen
    );
    
    // Nur aktivieren wenn ALLE Bedingungen erfüllt sind
    const shouldHighlight = !hasCompletedFirstScan && hasPendingScanNotification;
    setShowScanButtonHighlight(shouldHighlight);
  }, [backgroundNotifications]);

  // Prüfe ob Erfolge-Button-Highlight angezeigt werden soll
  useEffect(() => {
    if (backgroundNotifications.length === undefined) return;
    
    const hasVisitedAchievements = localStorage.getItem('hasVisitedAchievements');
    const hasPendingQuestNotification = backgroundNotifications.some(n => 
      n.title?.includes("Quest") && !n.seen
    );
    
    // Nur aktivieren wenn ALLE Bedingungen erfüllt sind
    const shouldHighlight = !hasVisitedAchievements && hasPendingQuestNotification;
    setShowAchievementsButtonHighlight(shouldHighlight);
  }, [backgroundNotifications]);

  const updateUserMutation = useMutation({
    mutationFn: (data) => updateCurrentUserProfile(data),
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      const freshUser = await getCurrentUser();
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
      const profileData = {
        user_email: userData.email,
        display_name: userData.display_name || userData.full_name,
        full_name: userData.full_name,
        title: userData.title,
        selected_title: userData.selected_title,
        avatar_url: userData.avatar_url,
        background_image_url: userData.background_image_url,
        background_color: userData.background_color
      };

      await upsertUserProfile(userData.id, profileData);
    } catch (error) {
      console.error("Fehler beim PublicProfile Update:", error);
    }
  };

  useEffect(() => {
    if (user && user.email) {
      updatePublicProfile(user);
    }
  }, [user?.display_name, user?.avatar_url, user?.selected_title, user?.email, user?.background_image_url, user?.background_color]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await uploadFile({ file });
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
    
    // Markiere dass Hintergrund geändert wurde
    localStorage.setItem('hasChangedBackground', 'true');
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
    const freshUser = await getCurrentUser();
    await updatePublicProfile(freshUser);
    
    // Markiere dass Hintergrund geändert wurde
    localStorage.setItem('hasChangedBackground', 'true');
  };

  const handleRemoveColor = async () => {
    await updateUserMutation.mutateAsync({ background_color: null });
    setShowBackgroundSelector(false);
    setAverageColor(null);
    const freshUser = await getCurrentUser();
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

  const discoveredGenera = genera.filter(g => {
    const genusPlants = plants.filter(p => 
      p.genus_category === g.category && p.genus_number === g.category_dex_number
    );
    return genusPlants.some(p => userDiscoveries.some(d => d.plant_id === p.id));
  }).length;

  const scannedPlantsCount = userDiscoveries.length;

  // Berechne Anzahl verschiedener gescannter Arten
  const uniqueSpeciesCount = new Set(userDiscoveries.map(d => d.plant_id)).size;

  // Berechne Anzahl verschiedener wöchentlicher Quest-Teilnahmen
  const weeklyQuestParticipations = new Set(userWeeklyQuests.map(q => q.active_week)).size;

  // Prüfe ob mindestens eine Monatsquest abgeschlossen wurde
  const hasCompletedMonthlyQuest = userMonthlyQuests.some(q => q.completed);

  const availableQuests = quests.filter(q => 
    !userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  ).length;

  const statButtons = [
    {
      icon: Leaf,
      label: "Gattungen",
      value: discoveredGenera,
      color: "from-emerald-500 to-emerald-600",
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      onClick: () => navigate(createPageUrl("Collection"))
    },
    {
      icon: BookOpen,
      label: "Erfolge",
      value: userAchievements.length,
      color: "from-amber-500 to-amber-600",
      textColor: "text-amber-700",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      onClick: () => navigate(createPageUrl("Achievements"))
    },
    {
      icon: Users,
      label: "Community",
      value: availableQuests,
      color: "from-blue-500 to-blue-600",
      textColor: "text-blue-700",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      onClick: () => navigate(createPageUrl("Quests"))
    },
    {
      icon: Heart,
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
            : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255,255,255,0.5)'
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

              {/* Vorgefertigte Hintergründe - aus Reward Entität */}
              {allRewards.filter(r => r.type === 'background').length > 0 && (
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
                    <TooltipProvider>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {allRewards
                          .filter(r => r.type === 'background')
                          .map((reward) => {
                            const isUnlocked = userRewards.some(ur => ur.reward_id === reward.id);
                            
                            // Erstelle Tooltip-Text basierend auf Bedingungen
                            let tooltipText = '';
                            if (reward.requires_donor) tooltipText = 'Nur für Unterstützer - spende, um diesen Hintergrund freizuschalten! 💚';
                            else if (reward.requires_referrals) tooltipText = `Werbe ${reward.requires_referrals} Freund${reward.requires_referrals > 1 ? 'e' : ''}! 🌱`;
                            else if (reward.requires_rare_plants) tooltipText = `Entdecke ${reward.requires_rare_plants} seltene Pflanze${reward.requires_rare_plants > 1 ? 'n' : ''}! 🌟`;
                            else if (reward.requires_weekly_quests) tooltipText = `Nimm an ${reward.requires_weekly_quests} wöchentlichen Quest${reward.requires_weekly_quests > 1 ? 's' : ''} teil! (${weeklyQuestParticipations}/${reward.requires_weekly_quests})`;
                            else if (reward.requires_monthly_quests) tooltipText = `Schließe ${reward.requires_monthly_quests} Monatsquest${reward.requires_monthly_quests > 1 ? 's' : ''} ab! 📅`;
                            else if (reward.requires_gifts) tooltipText = `Erhalte ${reward.requires_gifts} Geschenk${reward.requires_gifts > 1 ? 'e' : ''} von Freunden! 🎁`;
                            else if (reward.requires_quest) {
                              const requiredQuest = quests.find(q => q.id === reward.requires_quest);
                              tooltipText = requiredQuest ? `Löse Quest "${requiredQuest.title}" ein! 🎯` : 'Schließe eine spezifische Quest ab! 🎯';
                            }
                            else if (reward.random_event) tooltipText = `Zufällige Belohnung beim ${reward.random_event === 'scan' ? 'Scannen' : 'Event'}! 🎲`;

                            return (
                              <Tooltip key={reward.id}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => isUnlocked && handleSetBackground(reward.value, reward.color)}
                                    disabled={!isUnlocked}
                                    className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                                      isUnlocked 
                                        ? 'border-amber-300 hover:border-amber-500' 
                                        : 'border-stone-400 cursor-not-allowed'
                                    } transition-colors group`}
                                  >
                                    <img
                                      src={reward.value}
                                      alt={reward.display_name}
                                      className={`w-full h-full object-cover ${isUnlocked ? 'group-hover:scale-105' : ''} transition-transform`}
                                    />
                                    <div className={`absolute inset-0 ${isUnlocked ? 'bg-black/0 group-hover:bg-black/20' : 'bg-black/40'} transition-colors`} />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                                      {reward.display_name}
                                    </div>
                                    {!isUnlocked && (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <Lock className="w-12 h-12 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]" />
                                      </div>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                {!isUnlocked && tooltipText && (
                                  <TooltipContent>
                                    <p>{tooltipText}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            );
                          })}
                      </div>
                    </TooltipProvider>
                  )}
                </div>
              )}

              {/* Scans Section - ab 50 verschiedenen Arten */}
              {uniqueSpeciesCount >= 50 && (
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
                    <>
                      <p className="text-xs text-stone-600 mb-3">
                        ✅ Freigeschaltet! Du hast {uniqueSpeciesCount} verschiedene Arten entdeckt.
                      </p>
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
                    </>
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
              <motion.button
                onClick={() => {
                  setShowBackgroundSelector(true);
                  localStorage.setItem('hasVisitedProfileSettings', 'true');
                }}
                className="absolute top-4 right-4 w-10 h-10 bg-stone-200/80 hover:bg-stone-300/80 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-10"
                animate={showBackgroundButtonHighlight ? {
                  scale: [1, 1.15, 1],
                } : {}}
                transition={showBackgroundButtonHighlight ? {
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: "easeInOut"
                } : {}}
              >
                {showBackgroundButtonHighlight && (
                  <>
                    <motion.div
                      className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 rounded-full -z-10"
                      animate={{
                        opacity: [0.4, 0.8, 0.4],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    <motion.div
                      className="absolute -inset-2 bg-amber-300/30 rounded-full -z-10"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.3, 0.5, 0.3]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.3
                      }}
                    />
                  </>
                )}
                <ImageIcon className="w-5 h-5 text-stone-700" />
              </motion.button>
              <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
                <div className="relative group flex-shrink-0">
                  <div className="w-28 h-28 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden ring-4 ring-white/50 backdrop-blur-sm">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                    ) : (
                      <Leaf className="w-14 h-14 text-white" />
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
                      {user.selected_title || user.title || "Pflanzen-Entdecker"}
                    </span>
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
                    
                                {(() => {
                                  // Titel aus Achievements (legacy-Feld `title_reward`)
                                  const achievementTitleOptions = userAchievements
                                    .map(ua => {
                                      const achievement = achievements.find(a => a.id === ua.achievement_id);
                                      return achievement?.title_reward ? achievement.title_reward : null;
                                    })
                                    .filter(Boolean);

                                  // Titel aus Rewards (type === 'title') für freigeschaltete Rewards
                                  const rewardTitleOptions = userRewards
                                    .map(ur => {
                                      const reward = allRewards.find(r => r.id === ur.reward_id);
                                      if (!reward || reward.type !== 'title') return null;
                                      const value = reward.value || reward.display_name;
                                      const label = reward.display_name || reward.value || value;
                                      if (!value) return null;
                                      return { value, label };
                                    })
                                    .filter(Boolean);

                                  // Kombiniere alle Titel und entferne Duplikate anhand des Wertes
                                  const titleMap = new Map();

                                  achievementTitleOptions.forEach(title => {
                                    if (!titleMap.has(title)) {
                                      titleMap.set(title, { value: title, label: title });
                                    }
                                  });

                                  rewardTitleOptions.forEach(opt => {
                                    if (!titleMap.has(opt.value)) {
                                      titleMap.set(opt.value, opt);
                                    }
                                  });

                                  const combinedTitleOptions = Array.from(titleMap.values());

                                  const hasAnyTitles = combinedTitleOptions.length > 0;

                                  return (
                                    <>
                                      <Select
                                        value={user.selected_title || "default"}
                                        onValueChange={(value) => {
                                          if (value === 'default') {
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
                                              {user.selected_title || "Pflanzen-Entdecker"}
                                            </span>
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="default">
                                            <span className="font-semibold">Pflanzen-Entdecker</span>
                                          </SelectItem>

                                          {combinedTitleOptions.map(option => (
                                            <SelectItem key={option.value} value={option.value}>
                                              <span className="font-semibold">{option.label}</span>
                                            </SelectItem>
                                          ))}

                                          {!hasAnyTitles && (
                                            <div className="p-3 text-center text-sm text-stone-500">
                                              Noch keine Titel freigeschaltet
                                            </div>
                                          )}
                                        </SelectContent>
                                      </Select>

                                      {!hasAnyTitles && (
                                        <p className="text-xs text-stone-600 mt-2">
                                          💡 Schalte Erfolge oder besondere Rewards frei, um Titel zu erhalten!
                                        </p>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                    </p>
                    
                    <Select
                      value={user.selected_title || "default"}
                      onValueChange={(value) => {
                        if (value === 'default') {
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
                            {user.selected_title || "Pflanzen-Entdecker"}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">
                          <span className="font-semibold">Pflanzen-Entdecker</span>
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
                  Passwort und E-Mail werden über dein Supabase-Konto verwaltet.
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
                  onClick={() => signOut()}
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
