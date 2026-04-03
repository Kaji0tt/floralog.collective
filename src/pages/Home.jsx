import React, { useState, useEffect, useRef } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { upsertUserProfile } from "@/api/authService";
import { uploadFile } from "@/api/storage";
import { executeMigration } from "@/api/migrationService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, BookOpen, Target, Users, Camera, Loader2, Image as ImageIcon, Heart, Leaf } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import AchievementNotification from "../components/achievements/AchievementNotification";
import ScanFeedbackNotification from "../components/notifications/ScanFeedbackNotification";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getNameFontSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { updateQuestProgress } from "@/components/utils/questProgress";

import { Input } from "@/components/ui/input";
import { Edit2, CheckCircle, X, Scroll, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getWeekNumber, getMonthString, getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";

const LOGO_URL = "";

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const [showScannerHighlight, setShowScannerHighlight] = useState(false);
  const [showBackgroundHighlight, setShowBackgroundHighlight] = useState(false);
  const [showAchievementsHighlight, setShowAchievementsHighlight] = useState(false);
  const [showPlantDetailsPanel, setShowPlantDetailsPanel] = useState(false);
  const [openPlantMeterTooltip, setOpenPlantMeterTooltip] = useState(null);
  const plantSlotPanelRef = useRef(null);

  const [scanFeedback, setScanFeedback] = useState(null);

  // Migration states
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationSteps, setMigrationSteps] = useState([]);
  const [migrationError, setMigrationError] = useState(null);

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userDiscoveries = [], isLoading: isLoadingDiscoveries } = useQuery({
    queryKey: ['userDiscoveries', user?.id],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Lieblingsscan-/Lieblingspflanzen-Anzeige wurde aus dem Spiel entfernt

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => Query.Quest.list('quest_number'),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userQuests = [], isLoading: isLoadingQuests } = useQuery({
    queryKey: ['userQuests', user?.id],
    queryFn: async () => {
      try {
        return await Query.UserQuest.filter({ auth_id: user?.id });
      } catch (e) {
        // Fehler wird nur einmal angezeigt, kein Retry
        return [];
      }
    },
    enabled: !!user?.id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: friends = [], isLoading: isLoadingFriends } = useQuery({
    queryKey: ['friends', user?.email],
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
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: userAchievements = [], isLoading: isLoadingAchievements } = useQuery({
    queryKey: ['userAchievements', user?.id],
    queryFn: () => Query.UserAchievement.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => Query.WeeklyQuest.list('quest_number'),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userWeeklyQuests = [], isLoading: isLoadingWeeklyQuests } = useQuery({
    queryKey: ['userWeeklyQuests', user?.id],
    queryFn: () => Query.UserWeeklyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => Query.MonthlyQuest.list('quest_number'),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userMonthlyQuests = [], isLoading: isLoadingMonthlyQuests } = useQuery({
    queryKey: ['userMonthlyQuests', user?.id],
    queryFn: () => Query.UserMonthlyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => Query.CollectionQuest.list(),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userCollectionQuests = [], isLoading: isLoadingCollectionQuests } = useQuery({
    queryKey: ['userCollectionQuests', user?.id],
    queryFn: () => Query.UserCollectionQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => Query.UserPlantDiscovery.list('-created_date'),
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const users = await Query.PublicProfile.list();
      return users.filter(u => u.weekly_tracking !== false);
    },
    initialData: [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: backgroundNotifications = [] } = useQuery({
    queryKey: ['backgroundNotifications', user?.id],
    queryFn: () => Query.UserNotification.filter({ 
      auth_id: user?.id,
      notification_type: "custom",
      seen: false
    }),
    enabled: !!user?.id,
    initialData: [],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: robotPlantState = null } = useQuery({
    queryKey: ['robotPlantState', user?.id],
    queryFn: async () => {
      const rows = await Query.RobotPlant.filter({ auth_id: user?.id });
      return rows?.[0] || null;
    },
    enabled: !!user?.id,
    initialData: null,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });



  const loadUserData = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    const displayName = currentUser?.display_name || currentUser?.full_name || "";
    setEditedName(displayName);
    // Refetch alle Queries um Stats sofort zu aktualisieren
    queryClient.refetchQueries({ queryKey: ['userDiscoveries'] });
    queryClient.refetchQueries({ queryKey: ['plants'] });
    queryClient.refetchQueries({ queryKey: ['genera'] });
    queryClient.refetchQueries({ queryKey: ['friends'] });
    queryClient.refetchQueries({ queryKey: ['allDiscoveries'] });
    queryClient.refetchQueries({ queryKey: ['robotPlantState'] });
    
    // NICHT mehr hier - Rewards werden nur beim Scannen/Quest-Completion geprüft
  };

  useEffect(() => {
    loadUserData();

    // Subscription für User-Updates (z.B. aus WelcomeNameDialog)
    const unsubscribe = Query.PublicProfile.subscribe((event) => {
      if (event.type === 'update') {
        loadUserData();
      }
    });

    // Custom Event Listener für User-Updates vom Layout
    const handleUserUpdate = (event) => {
      const updatedUser = event.detail;
      setUser(updatedUser);
      const displayName = updatedUser?.display_name || updatedUser?.full_name || "";
      setEditedName(displayName);
      // Refetch alle Queries um Stats sofort zu aktualisieren
      queryClient.refetchQueries({ queryKey: ['userDiscoveries'] });
      queryClient.refetchQueries({ queryKey: ['plants'] });
      queryClient.refetchQueries({ queryKey: ['genera'] });
      queryClient.refetchQueries({ queryKey: ['friends'] });
      queryClient.refetchQueries({ queryKey: ['allDiscoveries'] });
      queryClient.refetchQueries({ queryKey: ['robotPlantState'] });
    };

    window.addEventListener('userUpdated', handleUserUpdate);
    
    return () => {
      unsubscribe();
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, []);

  // Beim Öffnen der Home-Seite einmalig Quest-Fortschritt aktualisieren
  useEffect(() => {
    const runQuestProgressUpdate = async () => {
      if (!user?.id) return;
      try {
        console.log('[HomePage] Running updateQuestProgress for user:', user.email);
        await updateQuestProgress(user);
      } catch (error) {
        console.error('[HomePage] Error while updating quest progress:', error);
      }
    };

    runQuestProgressUpdate();
  }, [user?.id]);

  // Consume scan feedback from navigation state exactly once per navigation
  useEffect(() => {
    if (location.state && location.state.scanFeedback) {
      // Show feedback from navigation state
      setScanFeedback(location.state.scanFeedback);

      // Remove scanFeedback from history state so it won't re-trigger
      const { scanFeedback: _ignored, ...restState } = location.state;
      const nextState = Object.keys(restState).length > 0 ? restState : null;

      navigate(location.pathname + location.search, {
        replace: true,
        state: nextState,
      });
    }
  }, [location, navigate]);

  // Auto-execute migration if pending (user came from SetPassword page)
  useEffect(() => {
    const migrationPending = localStorage.getItem('migration_pending');
    
    // Check if we should run migration
    if (migrationPending === 'true' && user) {
      console.log('[Home] Migration pending detected - starting automatic migration...');
      
      // IMMEDIATELY clear flag to prevent loop
      localStorage.removeItem('migration_pending');
      
      setIsMigrating(true);
      setMigrationSteps([]);
      setMigrationError(null);

      executeMigration((progress) => {
        console.log(`[Home] Migration progress: ${progress.completed}/${progress.total} - ${progress.step.name}`);
        setMigrationSteps(prev => [...prev, progress.step]);
      })
        .then(() => {
          console.log('[Home] Migration completed successfully!');
          setIsMigrating(false);
          // Refetch all user data after successful migration
          loadUserData();
        })
        .catch((err) => {
          console.error('[Home] Migration failed:', err);
          setMigrationError(err.message || 'Migration fehlgeschlagen');
          setIsMigrating(false);
        });
    }
  }, [user]); // Only depend on user, not isMigrating!

  // Prüfe ob Scanner-Highlight angezeigt werden soll
  useEffect(() => {
    if (!user || isLoadingDiscoveries) return;
    const hasDisplayName = user.display_name;
    const hasNoScans = userDiscoveries.length === 0;
    const shouldHighlight = hasDisplayName && hasNoScans;
    setShowScannerHighlight(shouldHighlight);
  }, [user?.display_name, userDiscoveries, isLoadingDiscoveries]);

  // Prüfe ob Hintergrund-Highlight angezeigt werden soll
  useEffect(() => {
    const hasChangedBackground = localStorage.getItem('hasChangedBackground');
    const hasPendingBackgroundNotification = backgroundNotifications.some(n => 
      n.title?.includes("Personalisiere") && !n.seen
    );
    const shouldHighlight = !hasChangedBackground && hasPendingBackgroundNotification;
    setShowBackgroundHighlight(shouldHighlight);
  }, [backgroundNotifications]);

  // Prüfe ob Erfolge-Highlight angezeigt werden soll
  useEffect(() => {
    const hasVisitedAchievements = localStorage.getItem('hasVisitedAchievements');
    const hasPendingQuestNotification = backgroundNotifications.some(n => 
      n.title?.includes("Quest") && !n.seen
    );
    const shouldHighlight = !hasVisitedAchievements && hasPendingQuestNotification;
    setShowAchievementsHighlight(shouldHighlight);
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

  // PublicProfile wird nur bei expliziten Updates aktualisiert (nicht automatisch)

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

  useEffect(() => {
    if (!showPlantDetailsPanel) return;

    const handleOutsideClick = (event) => {
      if (plantSlotPanelRef.current && !plantSlotPanelRef.current.contains(event.target)) {
        setShowPlantDetailsPanel(false);
        setOpenPlantMeterTooltip(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showPlantDetailsPanel]);

  const isLoadingCriticalData = isLoadingDiscoveries || isLoadingQuests || isLoadingAchievements || isLoadingFriends || isLoadingWeeklyQuests || isLoadingMonthlyQuests || isLoadingCollectionQuests;

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

  const playerSeeds = Math.max(
    0,
    Number(robotPlantState?.wallet_balance ?? robotPlantState?.walletBalance ?? 0)
  );

  const energyValue = Math.max(
    0,
    Math.min(100, Number(robotPlantState?.energy ?? robotPlantState?.energy_value ?? 0))
  );
  const dataQualityValue = Math.max(
    0,
    Math.min(
      100,
      Number(robotPlantState?.dataQuality ?? robotPlantState?.data_quality ?? robotPlantState?.data_quality_value ?? 0)
    )
  );
  const careValue = Math.max(
    0,
    Math.min(100, Number(robotPlantState?.care ?? robotPlantState?.care_value ?? 0))
  );

  const toSegments = (value) => Math.max(0, Math.min(10, Math.round(value / 10)));
  const plantStatMeters = [
    {
      id: "energy",
      label: "Energie",
      description: "Energie bestimmt, wie leistungsfaehig deine Pflanze ist. Sie steigt vor allem durch aktive Scans und sinkt mit der Zeit.",
      segments: toSegments(energyValue),
      color: "bg-emerald-500",
    },
    {
      id: "dataQuality",
      label: "Datenqualitaet",
      description: "Datenqualitaet steigt durch abwechslungsreiche und neue Scans, zum Beispiel in verschiedenen Zonen oder mit neuen Pflanzen.",
      segments: toSegments(dataQualityValue),
      color: "bg-cyan-500",
    },
    {
      id: "care",
      label: "Pflege",
      description: "Pflege zeigt, wie gut du regelmaessig mit deiner Pflanze interagierst. Kontinuierliche Aktivitaet haelt den Wert hoch.",
      segments: toSegments(careValue),
      color: "bg-amber-500",
    },
  ];

  const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);
  const currentMonthlyQuest = getCurrentMonthlyQuest(monthlyQuests);

  // Quest Status berechnen
  const isActiveOrCompleted = (uq) => {
    if (!uq) return false;
    if (uq.status) {
      return uq.status === 'active' || uq.status === 'completed';
    }
    return uq.accepted && !uq.redeemed;
  };

  const isCompletedStatus = (uq) => {
    if (!uq) return false;
    if (uq.status) {
      return uq.status === 'completed' || uq.status === 'redeemed';
    }
    return !!uq.completed;
  };

  const activeRegularQuests = quests
    .filter(q => {
      const userQuest = userQuests.find(uq => uq.quest_id === q.id);
      return isActiveOrCompleted(userQuest) && !(userQuest?.status === 'redeemed' || userQuest?.redeemed);
    })
    .map(q => {
      const userQuest = userQuests.find(uq => uq.quest_id === q.id);
      return { ...q, isCompleted: isCompletedStatus(userQuest) };
    });

  const availableRegularQuests = quests.filter(q => {
    const userQuest = userQuests.find(uq => uq.quest_id === q.id);
    let prerequisiteMet = true;
    if (q.prerequisite_quest_number) {
      const prerequisiteQuest = quests.find(pq => pq.quest_number === q.prerequisite_quest_number);
      if (prerequisiteQuest) {
        const prerequisiteUserQuest = userQuests.find(uq => uq.quest_id === prerequisiteQuest.id);
        prerequisiteMet = prerequisiteUserQuest?.status
          ? (prerequisiteUserQuest.status === 'redeemed')
          : (prerequisiteUserQuest?.redeemed || false);
      }
    }
    const hasUserQuest = !!userQuest;
    const isAccepted = userQuest?.accepted || !!userQuest?.status;
    return (!hasUserQuest || !isAccepted) && prerequisiteMet;
  });

  const currentWeeklyUserQuest = currentWeeklyQuest ? 
    userWeeklyQuests.find(uwq => uwq.weekly_quest_id === currentWeeklyQuest.id) : null;
  const activeWeeklyQuest = currentWeeklyQuest && currentWeeklyUserQuest && isActiveOrCompleted(currentWeeklyUserQuest) && !(currentWeeklyUserQuest.status === 'redeemed' || currentWeeklyUserQuest.redeemed) ?
    { ...currentWeeklyQuest, isCompleted: currentWeeklyUserQuest.completed || false } : null;
  const availableWeeklyQuest = currentWeeklyQuest && !currentWeeklyUserQuest;

  const currentMonthlyUserQuest = currentMonthlyQuest ?
    userMonthlyQuests.find(umq => umq.monthly_quest_id === currentMonthlyQuest.id) : null;
  const activeMonthlyQuest = currentMonthlyQuest && currentMonthlyUserQuest && isActiveOrCompleted(currentMonthlyUserQuest) && !(currentMonthlyUserQuest.status === 'redeemed' || currentMonthlyUserQuest.redeemed) ?
    { ...currentMonthlyQuest, isCompleted: currentMonthlyUserQuest.completed || false } : null;
  const availableMonthlyQuest = currentMonthlyQuest && !currentMonthlyUserQuest;

  const activeCollectionQuests = collectionQuests
    .filter(quest => {
      const userQuest = userCollectionQuests.find(ucq => ucq.collection_quest_id === quest.id);
      return quest.is_active && isActiveOrCompleted(userQuest) && !(userQuest?.status === 'redeemed' || userQuest?.redeemed);
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

  const weeklyParticipantsCount = (() => {
    if (!currentWeeklyQuest || allDiscoveries.length === 0 || allUsers.length === 0) return 0;
    
    const participatingUsers = new Set();
    
    allDiscoveries.forEach(d => {
      const discoveryUser = allUsers.find(u => u.user_email === d.user || u.user_email === d.created_by);
      if (!discoveryUser) return;

      const plant = plants.find(p => p.id === d.plant_id);
      if (!plant) return;

      let matches = false;
      
      if (currentWeeklyQuest.target_species_name) {
        matches = plant.species_name === currentWeeklyQuest.target_species_name;
      } else if (currentWeeklyQuest.target_genus_name) {
        const genus = genera.find(g => 
          g.category === plant.genus_category && 
          g.category_dex_number === plant.genus_number
        );
        matches = genus?.genus_name === currentWeeklyQuest.target_genus_name;
      } else if (currentWeeklyQuest.category && currentWeeklyQuest.category !== "Alle") {
        matches = plant.genus_category === currentWeeklyQuest.category;
      } else {
        matches = true;
      }
      
      if (matches) {
        participatingUsers.add(discoveryUser.user_email);
      }
    });
    
    return participatingUsers.size;
  })();



  const activeQuestsCount = activeRegularQuests.length + 
    (activeWeeklyQuest ? 1 : 0) + 
    (activeMonthlyQuest ? 1 : 0) + 
    activeCollectionQuests.length;

  const statButtons = [
    {
      icon: Leaf,
      label: "Sammlung",
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
      value: activeQuestsCount,
      color: "from-amber-500 to-amber-600",
      textColor: "text-amber-700",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      onClick: () => {
        navigate(createPageUrl("Achievements"));
        if (showAchievementsHighlight) {
          localStorage.setItem('hasVisitedAchievements', 'true');
        }
      },
      // Animierte Hervorhebung NUR, wenn es einlösbare Quests gibt
      hasNotification: hasRedeemableQuests,
      notificationRed: hasNewQuests,
      notificationGreen: hasRedeemableQuests
    },
    {
      icon: Users,
      label: "Community",
      value: weeklyParticipantsCount,
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
    // Fallback: Wenn opacity ungültig ist, auf 1 setzen
    const safeOpacity = (typeof opacity === 'number' && opacity >= 0 && opacity <= 1) ? opacity : 1;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${safeOpacity})`;
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
        className="h-screen w-full box-border p-4 md:p-8 fixed inset-0 overflow-hidden flex flex-col" 
        style={{
          background: averageColor 
            ? `linear-gradient(135deg, var(--profile-bg-color-light) 0%, var(--profile-bg-color-mid) 50%, var(--profile-bg-color-dark) 100%)`
            : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255,255,255,0.5)'
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

        <AnimatePresence>
          {scanFeedback && (
            <ScanFeedbackNotification
              feedback={scanFeedback}
              onComplete={() => setScanFeedback(null)}
            />
          )}
        </AnimatePresence>

      <div className="max-w-4xl mx-auto flex flex-col flex-1 min-h-0 justify-between">
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

        {/* Migration Dialog */}
        <Dialog open={isMigrating} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                Migration läuft...
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Deine Daten werden migriert. Dies kann einen Moment dauern.
              </p>
              
              {migrationError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900">Migration fehlgeschlagen</p>
                      <p className="text-sm text-red-700 mt-1">{migrationError}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {migrationSteps.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initialisierung...</span>
                    </div>
                  ) : (
                    migrationSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-green-800 animate-in fade-in duration-300">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span>{step.name}</span>
                        {step.updated !== undefined && (
                          <span className="text-gray-500">({step.updated})</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {migrationError && (
                <Button 
                  onClick={() => {
                    setIsMigrating(false);
                    setMigrationError(null);
                    localStorage.removeItem('migration_pending');
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Schließen
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-shrink-0"
        >
          <motion.div
            className="relative mb-4"
            animate={showBackgroundHighlight ? {
              scale: [1, 1.02, 1],
            } : {}}
            transition={showBackgroundHighlight ? {
              duration: 2,
              repeat: Infinity,
              repeatDelay: 0.5,
              ease: "easeInOut"
            } : {}}
          >
            {showBackgroundHighlight && (
              <>
                <motion.div
                  className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 rounded-2xl -z-10"
                  animate={{
                    opacity: [0.3, 0.7, 0.3],
                    scale: [1, 1.02, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                <motion.div
                  className="absolute -inset-2 bg-amber-300/20 rounded-2xl -z-10"
                  animate={{
                    scale: [1, 1.05, 1],
                    opacity: [0.2, 0.4, 0.2]
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
            <Card 
              className="shadow-xl bg-white overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow"
              style={{
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
              }}
              onClick={() => {
                navigate(createPageUrl("Profile"));
                if (showBackgroundHighlight) {
                  localStorage.setItem('hasVisitedProfileSettings', 'true');
                }
              }}
            >
            <CardContent 
              className="p-6 md:p-8 relative"
              style={user?.background_image_url ? {
                backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.4) 100%), url(${user.background_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : user?.background_color ? {
                background: `linear-gradient(135deg, ${getRgbaFromRgb(user.background_color, 0.6)} 0%, ${getRgbaFromRgb(user.background_color, 1)} 100%)`
              } : {}}
            >
              <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
                <div
                  ref={plantSlotPanelRef}
                  className={`relative h-28 transition-all duration-300 ${showPlantDetailsPanel ? "w-[15rem]" : "w-28"}`}
                >
                  <motion.button
                    type="button"
                    className="absolute top-2 left-2 w-6 h-6 rounded-full border-2 border-white/40 bg-white/55 text-stone-500 text-[11px] font-semibold shadow-sm z-30 flex items-center justify-center"
                    animate={{ x: showPlantDetailsPanel ? 128 : 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlantDetailsPanel((prev) => {
                        const next = !prev;
                        if (!next) setOpenPlantMeterTooltip(null);
                        return next;
                      });
                    }}
                    aria-label="Pflanzenpanel aufklappen"
                  >
                    {showPlantDetailsPanel ? ">" : "<"}
                  </motion.button>

                  <motion.div
                    className="absolute left-0 top-0 z-10 w-28 h-28 rounded-2xl bg-white/60 backdrop-blur-md border-2 border-white/40 shadow-lg flex flex-col items-center justify-center text-stone-700"
                    animate={{ x: showPlantDetailsPanel ? 128 : 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-bold shadow-md border border-emerald-200">
                      {playerSeeds}
                    </div>
                    <Leaf className="w-10 h-10 text-green-600" />
                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide">Pflanzen-Slot</span>
                  </motion.div>

                  <AnimatePresence>
                    {showPlantDetailsPanel && (
                      <motion.div
                        initial={{ opacity: 0, x: -8, scale: 0.97 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute left-0 top-0 w-28 h-28 rounded-2xl bg-white/70 backdrop-blur-md border-2 border-white/40 shadow-lg z-20 p-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="h-full flex items-end justify-around gap-1">
                          {plantStatMeters.map((meter) => (
                            <Popover
                              key={meter.id}
                              open={openPlantMeterTooltip === meter.id}
                              onOpenChange={(open) => setOpenPlantMeterTooltip(open ? meter.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="h-full w-6 flex items-end justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm"
                                  aria-label={`${meter.label} erklaeren`}
                                >
                                  <div className="grid grid-rows-10 gap-[1px] h-full w-4">
                                    {Array.from({ length: 10 }).map((_, index) => (
                                      <div
                                        key={`${meter.label}-${index}`}
                                        className={`rounded-[2px] border border-stone-200 ${index >= 10 - meter.segments ? `${meter.color} border-transparent` : "bg-white/80"}`}
                                      />
                                    ))}
                                  </div>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                side="bottom"
                                align="center"
                                sideOffset={6}
                                collisionPadding={12}
                                className="w-[min(14rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-3 text-xs break-words"
                              >
                                <p className="font-semibold text-stone-900 mb-1">{meter.label}</p>
                                <p className="text-stone-600 leading-relaxed">{meter.description}</p>
                              </PopoverContent>
                            </Popover>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-1 w-full max-w-full min-w-0 bg-white/40 backdrop-blur-md rounded-xl p-5 border-2 border-white/30 shadow-lg">
                  <div className="flex items-start gap-4 mb-3">
                    <div className="relative group flex-shrink-0">
                      <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-xl overflow-hidden ring-2 ring-white/70 backdrop-blur-sm">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                        ) : (
                          <Leaf className="w-10 h-10 text-white" />
                        )}
                      </div>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        disabled={uploadingImage}
                        aria-label="Profilbild hochladen"
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                          <Camera className="w-6 h-6 text-white" />
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

                    <div className="flex-1 min-w-0">
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
                    <div className="mb-2 min-w-0 max-w-full">
                      <h1
                        className="block w-full max-w-full min-w-0 font-bold text-stone-900 leading-tight"
                        style={{
                          fontSize: getNameFontSize(getDisplayName()),
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={getDisplayName()}
                        key={getDisplayName()}
                      >
                        {getDisplayName()}
                      </h1>
                    </div>
                  )}

                  <div className="mb-3">
                    <span className="text-base font-semibold text-stone-700">
                      {user.selected_title || user.title || "Pflanzen-Entdecker"}
                    </span>
                    </div>
                    </div>
                  </div>
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
                      <div className="text-xl short-screen:hidden md:text-3xl font-bold text-stone-700">
                        {isLoadingCriticalData ? (
                          <div className="w-8 h-6 bg-stone-200 animate-pulse rounded"></div>
                        ) : (
                          stat.value
                        )}
                      </div>
                      <div className="text-xs font-semibold text-stone-600 hidden sm:block short-screen:hidden">{stat.label}</div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Scannen Container - innerhalb der Profilkarte */}
              <div className="mt-4">
                <div 
                  className="bg-white/60 backdrop-blur-md rounded-xl p-4 shadow-md"
                  style={{
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
                  }}
                >
                  <div className="flex items-center justify-center gap-4">
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(createPageUrl("Scanner"));
                        // NICHT mehr hasVisitedScanner setzen - Highlight bleibt bis zum ersten Scan
                      }}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity relative"
                      animate={showScannerHighlight ? {
                        scale: [1, 1.05, 1],
                      } : {}}
                      transition={showScannerHighlight ? {
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 0.5,
                        ease: "easeInOut"
                      } : {}}
                    >
                      {showScannerHighlight && (
                        <>
                          <motion.div
                            className="absolute -inset-2 bg-green-400/20 rounded-xl -z-10"
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.3, 0.6, 0.3]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                          <motion.div
                            className="absolute -inset-3 bg-green-500/10 rounded-xl -z-10"
                            animate={{
                              scale: [1, 1.3, 1],
                              opacity: [0.2, 0.4, 0.2]
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
                    </motion.button>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
          </motion.div>
        </motion.div>

        {/* Desktop Spenden/Impressum Links - außerhalb der Profilkarte */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="hidden md:block flex-shrink-0"
        >
          <div className="flex justify-center gap-3 text-sm">
            <button
              onClick={() => navigate(createPageUrl("Donate"))}
              className="hover:opacity-60 transition-all font-medium px-1.5 py-1 opacity-50"
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
              className="hover:opacity-60 transition-all font-medium px-1.5 py-1 opacity-50"
              style={{ 
                color: averageColor ? getLighterColor(getLighterColor(averageColor)) : 'rgb(120, 113, 108)',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              Impressum
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
              onClick={() => navigate(createPageUrl("News"))}
              className="hover:opacity-60 transition-all font-medium px-1.5 py-1 opacity-50"
              style={{ 
                color: averageColor ? getLighterColor(getLighterColor(averageColor)) : 'rgb(120, 113, 108)',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              News
            </button>
          </div>
        </motion.div>

        {/* Mobile Spenden/Impressum Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex-shrink-0 md:hidden"
        >
          <div className="flex justify-center gap-3 text-sm">
            <button
              onClick={() => navigate(createPageUrl("Donate"))}
              className="hover:opacity-60 transition-all font-medium px-1.5 py-1"
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
              className="hover:opacity-60 transition-all font-medium px-1.5 py-1"
              style={{ 
                color: 'var(--profile-text-color)',
                opacity: 0.7,
                textShadow: averageColor && isColorDark(averageColor) ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'
              }}
            >
              Impressum
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
              onClick={() => navigate(createPageUrl("News"))}
              className="hover:opacity-60 transition-all font-medium px-1.5 py-1"
              style={{ 
                color: 'var(--profile-text-color)',
                opacity: 0.7,
                textShadow: averageColor && isColorDark(averageColor) ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'
              }}
            >
              News
            </button>
          </div>
        </motion.div>

      </div>
      </div>
    </>
  );
}
