import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, BookOpen, Target, Users, Camera, Loader2, Image as ImageIcon, Map as MapIcon, Heart, Leaf } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import AchievementNotification from "../components/achievements/AchievementNotification";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Edit2, CheckCircle, X, Scroll } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const LOGO_URL = "";

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
  const [showTestQuest, setShowTestQuest] = useState(false);

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

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => base44.entities.WeeklyQuest.list('quest_number'),
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ['userWeeklyQuests', user?.email],
    queryFn: () => base44.entities.UserWeeklyQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => base44.entities.MonthlyQuest.list('quest_number')
  });

  const { data: userMonthlyQuests = [] } = useQuery({
    queryKey: ['userMonthlyQuests', user?.email],
    queryFn: () => base44.entities.UserMonthlyQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => base44.entities.CollectionQuest.list()
  });

  const { data: userCollectionQuests = [] } = useQuery({
    queryKey: ['userCollectionQuests', user?.email],
    queryFn: () => base44.entities.UserCollectionQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => base44.entities.UserPlantDiscovery.list('-created_date'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const users = await base44.entities.PublicProfile.list();
      return users.filter(u => u.weekly_tracking !== false);
    },
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setEditedName(currentUser?.display_name || currentUser?.full_name || "");
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
  }, [user?.display_name, user?.avatar_url, user?.selected_title, user?.email, user?.background_image_url, user?.background_color, user?.favorite_plant_id, user?.title]);

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

  const currentWeeklyQuest = getCurrentWeeklyQuest();
  const currentMonthlyQuest = getCurrentMonthlyQuest();

  // Quest Status berechnen
  const activeRegularQuests = quests
    .filter(q => {
      const userQuest = userQuests.find(uq => uq.quest_id === q.id);
      return userQuest?.accepted && !userQuest?.redeemed;
    })
    .map(q => {
      const userQuest = userQuests.find(uq => uq.quest_id === q.id);
      return { ...q, isCompleted: userQuest?.completed || false };
    });

  const availableRegularQuests = quests.filter(q => {
    const userQuest = userQuests.find(uq => uq.quest_id === q.id);
    const isUnlocked = (q.unlocked_at_level || 1) <= (user?.level || 1);
    let prerequisiteMet = true;
    if (q.prerequisite_quest_number) {
      const prerequisiteQuest = quests.find(pq => pq.quest_number === q.prerequisite_quest_number);
      if (prerequisiteQuest) {
        const prerequisiteUserQuest = userQuests.find(uq => uq.quest_id === prerequisiteQuest.id);
        prerequisiteMet = prerequisiteUserQuest?.redeemed || false;
      }
    }
    return !userQuest?.accepted && isUnlocked && prerequisiteMet;
  });

  const currentWeeklyUserQuest = currentWeeklyQuest ? 
    userWeeklyQuests.find(uwq => uwq.weekly_quest_id === currentWeeklyQuest.id) : null;
  const activeWeeklyQuest = currentWeeklyQuest && currentWeeklyUserQuest?.accepted && !currentWeeklyUserQuest?.redeemed ?
    { ...currentWeeklyQuest, isCompleted: currentWeeklyUserQuest.completed || false } : null;
  const availableWeeklyQuest = currentWeeklyQuest && !currentWeeklyUserQuest?.accepted;

  const currentMonthlyUserQuest = currentMonthlyQuest ?
    userMonthlyQuests.find(umq => umq.monthly_quest_id === currentMonthlyQuest.id) : null;
  const activeMonthlyQuest = currentMonthlyQuest && currentMonthlyUserQuest?.accepted && !currentMonthlyUserQuest?.redeemed ?
    { ...currentMonthlyQuest, isCompleted: currentMonthlyUserQuest.completed || false } : null;
  const availableMonthlyQuest = currentMonthlyQuest && !currentMonthlyUserQuest?.accepted;

  const activeCollectionQuests = collectionQuests
    .filter(quest => {
      const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
      return quest.is_active && userQuest?.accepted && !userQuest?.redeemed;
    })
    .map(quest => {
      const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
      return { ...quest, isCompleted: userQuest?.completed || false };
    });

  const availableCollectionQuests = collectionQuests.filter(quest => {
    const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
    return quest.is_active && !userQuest?.accepted;
  });

  const hasRedeemableQuests = [...activeRegularQuests, ...activeCollectionQuests].some(q => q.isCompleted) ||
    (activeWeeklyQuest?.isCompleted) || (activeMonthlyQuest?.isCompleted);
  const hasNewQuests = availableRegularQuests.length > 0 || availableCollectionQuests.length > 0 ||
    availableWeeklyQuest || availableMonthlyQuest;

  const weeklyDiscoveriesCount = currentWeeklyQuest ? allDiscoveries.filter(d => {
    const discoveryUser = allUsers.find(u => u.user_email === d.user || u.user_email === d.created_by);
    if (!discoveryUser) return false;

    const plant = plants.find(p => p.id === d.plant_id);
    if (!plant) return false;

    if (currentWeeklyQuest.target_species_name) {
      return plant.species_name === currentWeeklyQuest.target_species_name;
    }

    if (currentWeeklyQuest.target_genus_name) {
      const genus = genera.find(g => 
        g.category === plant.genus_category && 
        g.category_dex_number === plant.genus_number
      );
      return genus?.genus_name === currentWeeklyQuest.target_genus_name;
    }

    if (currentWeeklyQuest.category && currentWeeklyQuest.category !== "Alle") {
      return plant.genus_category === currentWeeklyQuest.category;
    }

    return true;
  }).length : 0;



  const statButtons = [
    {
      icon: BookOpen,
      label: "Sammlung",
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
      onClick: () => navigate(createPageUrl("Achievements")),
      hasNotification: hasRedeemableQuests || hasNewQuests,
      notificationRed: hasNewQuests,
      notificationGreen: hasRedeemableQuests
    },
    {
      icon: Users,
      label: "Community",
      value: weeklyDiscoveriesCount,
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

  const isColorDark = (rgbString) => {
    if (!rgbString) return false;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return false;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    // Berechne Helligkeit (0-255) - Werte unter 100 gelten als dunkel
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 100;
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
          --profile-text-color: ${averageColor && isColorDark(averageColor) ? 'rgb(255, 255, 255)' : 'rgb(28, 25, 23)'};
        }
        @media (max-height: 610px) {
          .short-screen\\:hidden {
            display: none !important;
          }
          .short-screen\\:w-7 {
            width: 1.75rem !important;
          }
          .short-screen\\:h-7 {
            height: 1.75rem !important;
          }
          .short-screen\\:w-3\\.5 {
            width: 0.875rem !important;
          }
          .short-screen\\:h-3\\.5 {
            height: 0.875rem !important;
          }
          .short-screen\\:p-1\\.5 {
            padding: 0.375rem !important;
          }
          .short-screen\\:gap-0\\.5 {
            gap: 0.125rem !important;
          }
        }
      `}</style>
      <div 
        className="h-screen min-w-full p-4 md:p-8 fixed inset-0 overflow-hidden flex flex-col" 
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

      <div className="max-w-4xl mx-auto flex flex-col flex-1 min-h-0">
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
          className="flex-shrink-0"
        >
          <Card 
            className="mb-4 shadow-xl bg-white overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow"
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
                    <div className="mb-2">
                      <h1 className="text-3xl md:text-4xl font-bold text-stone-900" key={getDisplayName()}>
                        {getDisplayName()}
                      </h1>
                    </div>
                  )}

                  <div className="mb-3">
                    <span className="text-base font-semibold text-stone-700">
                      {user.selected_title || user.title || "Pflanzen-Entdecker"}
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
                    className="bg-white/60 backdrop-blur-md rounded-xl p-2 short-screen:p-1.5 md:p-4 hover:shadow-lg transition-all duration-300 group relative overflow-hidden"
                    style={{
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: stat.hasNotification 
                        ? 'transparent'
                        : (averageColor ? 'var(--profile-border-color)' : stat.borderColor.replace('border-', '').replace('-200', '')),
                      backgroundImage: stat.hasNotification
                        ? 'linear-gradient(white, white), linear-gradient(90deg, #f59e0b, #f97316, #ea580c, #f59e0b)'
                        : 'none',
                      backgroundOrigin: 'border-box',
                      backgroundClip: stat.hasNotification ? 'padding-box, border-box' : 'padding-box'
                    }}
                  >
                    {stat.hasNotification && (
                      <>
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-300/30 to-transparent"
                          animate={{
                            y: ['-100%', '200%']
                          }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            repeatDelay: 3,
                            ease: "easeInOut"
                          }}
                          style={{ pointerEvents: 'none' }}
                        />
                        <motion.div
                          className="absolute inset-0 rounded-xl"
                          animate={{
                            boxShadow: [
                              '0 0 0px rgba(245, 158, 11, 0)',
                              '0 0 20px rgba(245, 158, 11, 0.6)',
                              '0 0 0px rgba(245, 158, 11, 0)'
                            ]
                          }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            repeatDelay: 3,
                            ease: "easeInOut"
                          }}
                        />
                      </>
                    )}
                    <div className="flex flex-col items-center gap-1 short-screen:gap-0.5 md:gap-2">
                      <div className={`w-8 h-8 short-screen:w-7 short-screen:h-7 md:w-12 md:h-12 bg-gradient-to-br ${stat.color} rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                        <stat.icon className="w-4 h-4 short-screen:w-3.5 short-screen:h-3.5 md:w-6 md:h-6 text-white" />
                      </div>
                      <div className="text-xl short-screen:hidden md:text-3xl font-bold text-stone-700">{stat.value}</div>
                      <div className="text-xs font-semibold text-stone-600 hidden sm:block short-screen:hidden">{stat.label}</div>
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

        {/* Desktop Spenden/Impressum Links - außerhalb der Profilkarte */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="hidden md:block flex-shrink-0"
        >
          <div className="flex justify-center gap-6 text-sm">
            <button
              onClick={() => navigate(createPageUrl("Donate"))}
              className="hover:opacity-60 transition-all font-medium px-2 py-1 opacity-50"
              style={{ 
                color: averageColor ? getLighterColor(getLighterColor(averageColor)) : 'rgb(120, 113, 108)',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              Spenden
            </button>
            <span 
              className="opacity-40"
              style={{ 
                color: averageColor ? getLighterColor(averageColor) : 'rgb(120, 113, 108)'
              }}
            >
              •
            </span>
            <button
              onClick={() => navigate(createPageUrl("Impressum"))}
              className="hover:opacity-60 transition-all font-medium px-2 py-1 opacity-50"
              style={{ 
                color: averageColor ? getLighterColor(getLighterColor(averageColor)) : 'rgb(120, 113, 108)',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              Impressum
            </button>
            {user?.role === 'admin' && (
              <>
                <span 
                  className="opacity-40"
                  style={{ 
                    color: averageColor ? getLighterColor(averageColor) : 'rgb(120, 113, 108)'
                  }}
                >
                  •
                </span>
                <button
                  onClick={() => setShowTestQuest(true)}
                  className="hover:opacity-60 transition-all font-medium px-2 py-1 opacity-50"
                  style={{ 
                    color: averageColor ? getLighterColor(getLighterColor(averageColor)) : 'rgb(120, 113, 108)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}
                >
                  QTest
                </button>
              </>
            )}
          </div>
        </motion.div>

        {/* Mobile Spenden/Impressum Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex-shrink-0 pb-4 md:hidden"
        >
          <div className="flex justify-center gap-6 text-sm">
            <button
              onClick={() => navigate(createPageUrl("Donate"))}
              className="hover:opacity-60 transition-all font-medium px-2 py-1"
              style={{ 
                color: 'var(--profile-text-color)',
                opacity: 0.7,
                textShadow: averageColor && isColorDark(averageColor) ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'
              }}
            >
              Spenden
            </button>
            <span 
              className="opacity-40"
              style={{ 
                color: 'var(--profile-text-color)'
              }}
            >
              •
            </span>
            <button
              onClick={() => navigate(createPageUrl("Impressum"))}
              className="hover:opacity-60 transition-all font-medium px-2 py-1"
              style={{ 
                color: 'var(--profile-text-color)',
                opacity: 0.7,
                textShadow: averageColor && isColorDark(averageColor) ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'
              }}
            >
              Impressum
            </button>
            {user?.role === 'admin' && (
              <>
                <span 
                  className="opacity-40"
                  style={{ 
                    color: 'var(--profile-text-color)'
                  }}
                >
                  •
                </span>
                <button
                  onClick={() => setShowTestQuest(true)}
                  className="hover:opacity-60 transition-all font-medium px-2 py-1"
                  style={{ 
                    color: 'var(--profile-text-color)',
                    opacity: 0.7,
                    textShadow: averageColor && isColorDark(averageColor) ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'
                  }}
                >
                  QTest
                </button>
              </>
            )}
          </div>
        </motion.div>
        
        {/* Test Quest Notification */}
        <AnimatePresence>
          {showTestQuest && (
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4"
              onClick={() => setShowTestQuest(false)}
            >
              <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                transition={{ type: "spring", damping: 20 }}
                className="relative w-full max-w-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Quest Content Box */}
                <div className="bg-amber-50 border-4 border-amber-300 rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto relative">
                  {/* Schließen Button */}
                  <button
                    onClick={() => setShowTestQuest(false)}
                    className="absolute top-3 right-3 w-10 h-10 bg-amber-200 hover:bg-amber-300 rounded-full flex items-center justify-center transition-colors z-10 shadow-lg"
                  >
                    <X className="w-6 h-6 text-amber-900" />
                  </button>

                  <h4 className="font-bold text-stone-900 mb-3 text-lg">
                    Der Pflanzen-Sammler
                  </h4>
                  
                  <p className="text-base text-stone-700 leading-relaxed mb-3">
                    Willkommen, tapferer Sammler! Es ist Zeit, dich auf ein neues Abenteuer zu begeben. 
                    Die Natur ruft nach dir und wartet darauf, von dir entdeckt zu werden. 
                    Sammle die Schätze der Flora und werde zum Meister des Floralog!
                  </p>
                  
                  <p className="text-sm text-stone-600 mb-3 italic bg-amber-100 p-3 rounded-lg border border-amber-200">
                    📋 Scanne 5 verschiedene Pflanzen in deiner Umgebung
                  </p>

                  <div className="mt-4 text-sm text-stone-500 text-center bg-amber-100 py-2 rounded-lg">
                    Dies ist eine Test-Notification
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </>
  );
}