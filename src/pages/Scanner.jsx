import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, MapPin, AlertTriangle, ArrowLeft, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import ScanResults from "../components/scanner/ScanResults";
import CameraCapture from "../components/scanner/CameraCapture";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import AchievementNotification from "../components/achievements/AchievementNotification";
import { AnimatePresence, motion } from "framer-motion";

import MobileBackButton from "../components/navigation/MobileBackButton";
import { Check, RefreshCw } from "lucide-react";
import { createPageUrl } from "@/utils";
import {
  getCurrentMonthlyQuest,
  getCurrentWeeklyQuest,
  getOrCreateActiveMonthlyQuest,
  getOrCreateActiveWeeklyQuest,
  getTodayString,
  getWeekNumber,
  getMonthString } from
"../components/quests/QuestRotationHelper";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

// Bestätigungs-Button Komponente (draggable wie MobileBackButton)
function ConfirmButton({ onConfirm, isPrimaryResult }) {
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('mobileButtonPosition');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const handleDragEnd = (event, info) => {
    const newPosition = {
      x: position.x + info.offset.x,
      y: position.y + info.offset.y
    };
    setPosition(newPosition);
    localStorage.setItem('mobileButtonPosition', JSON.stringify(newPosition));
  };

  return (
    <motion.div
      className="md:hidden fixed bottom-4 left-4 z-50"
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      animate={position}
      style={{ x: position.x, y: position.y }}
    >
      <Button
        onClick={onConfirm}
        className={`w-16 h-16 shadow-lg border-2 border-white text-white rounded-full cursor-move ${
          isPrimaryResult 
            ? "bg-green-600 hover:bg-green-700" 
            : "bg-orange-600 hover:bg-orange-700"
        }`}
      >
        {isPrimaryResult ? (
          <Check className="w-8 h-8" />
        ) : (
          <RefreshCw className="w-8 h-8" />
        )}
      </Button>
    </motion.div>
  );
}

export default function Scanner() {
  const [scanning, setScanning] = useState(false);
  const [matchedPlant, setMatchedPlant] = useState(null);
  const [allScanResults, setAllScanResults] = useState([]);
  const [latestDiscoveryId, setLatestDiscoveryId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [user, setUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [showRateLimitDialog, setShowRateLimitDialog] = useState(false);
  const [pendingImageData, setPendingImageData] = useState(null);
  const [pendingScanData, setPendingScanData] = useState(null); // Temporäre Scan-Daten vor Bestätigung
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSavingPlant, setIsSavingPlant] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0); // Aktuell ausgewähltes Ergebnis
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [scanningPhase, setScanningPhase] = useState(0);
  const [showGlobalFloralogModal, setShowGlobalFloralogModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();

    // Markiere dass User den Scanner besucht hat
    localStorage.setItem('hasVisitedScanner', 'true');

    if (locationEnabled) {
      getUserLocation();
    }
  }, []);

  useEffect(() => {
    if (locationEnabled && !userLocation && !gettingLocation) {
      getUserLocation();
    }
  }, [locationEnabled]);

  const getUserLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setGettingLocation(false);
        },
        (error) => {
          console.error("Fehler beim Abrufen des Standorts:", error);
          setGettingLocation(false);
        }
      );
    }
  };

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list()
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list()
  });

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ['userDiscoveries'],
    queryFn: () => base44.entities.UserPlantDiscovery.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => base44.entities.MonthlyQuest.list('quest_number')
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => base44.entities.WeeklyQuest.list('quest_number')
  });

  const { data: userMonthlyQuests = [] } = useQuery({
    queryKey: ['userMonthlyQuests'],
    queryFn: () => base44.entities.UserMonthlyQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => base44.entities.Quest.list('quest_number')
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests'],
    queryFn: () => base44.entities.UserQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ['userWeeklyQuests'],
    queryFn: () => base44.entities.UserWeeklyQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  const updatePlantMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Plant.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    }
  });

  const createPlantMutation = useMutation({
    mutationFn: (data) => base44.entities.Plant.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    }
  });

  const createGenusMutation = useMutation({
    mutationFn: (data) => base44.entities.PlantGenus.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genera'] });
    }
  });

  const deleteDiscoveryMutation = useMutation({
    mutationFn: (discoveryId) => base44.entities.UserPlantDiscovery.delete(discoveryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
    }
  });

  const updateDiscoveryMutation = useMutation({
    mutationFn: ({ discoveryId, data }) => base44.entities.UserPlantDiscovery.update(discoveryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
    }
  });

  const updatePublicProfile = async (userData) => {
    try {
      const profiles = await base44.entities.PublicProfile.list();
      const existingProfile = profiles.find((p) => p.user_email?.toLowerCase() === userData.email?.toLowerCase());

      const profileData = {
        user_email: userData.email,
        display_name: userData.display_name || userData.full_name,
        full_name: userData.full_name,
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
      console.error("PublicProfile Update Fehler:", error);
    }
  };

  const updateQuestProgress = async (scannedPlant) => {
    if (!user?.email || !scannedPlant) return;

    try {
      const currentMonthlyQuest = getCurrentMonthlyQuest(monthlyQuests);
      const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);

      // Helper: Prüft ob der Scan für die Quest zählt
      const scanMatchesQuest = (quest) => {
        // Weekly/Monthly Quests: target_species_name / target_genus_name
        if (quest.target_species_name) {
          return scannedPlant.species_name?.toLowerCase() === quest.target_species_name.toLowerCase();
        }
        if (quest.target_genus_name) {
          const genus = genera.find((g) => g.id === scannedPlant.genus_id);
          return genus?.genus_name?.toLowerCase() === quest.target_genus_name.toLowerCase();
        }
        
        // Reguläre Quests: targets Array
        if (quest.targets && quest.targets.length > 0) {
          const genus = genera.find((g) => g.id === scannedPlant.genus_id);
          const matchesTarget = quest.targets.some(target => {
            if (target.target_type === 'species') {
              return scannedPlant.species_name?.toLowerCase() === target.target_name.toLowerCase();
            } else if (target.target_type === 'genus') {
              return genus?.genus_name?.toLowerCase() === target.target_name.toLowerCase();
            }
            return false;
          });
          
          if (!matchesTarget) return false;
        }
        
        // Kategorie-basiert (falls keine spezifischen Ziele)
        if (quest.category && quest.category !== "Alle") {
          const genus = genera.find((g) => g.id === scannedPlant.genus_id);
          return genus?.category === quest.category;
        }
        
        // Alle Kategorien
        return true;
      };

      // Update reguläre Quests - nur die bereits geladenen durchgehen
      const activeUserQuests = userQuests.filter(uq => uq.accepted && !uq.completed);
      const updatePromises = [];
      
      for (const userQuest of activeUserQuests) {
        const quest = quests.find(q => q.id === userQuest.quest_id);
        if (quest && scanMatchesQuest(quest)) {
          const newProgress = (userQuest.progress || 0) + 1;
          const isCompleted = newProgress >= (quest.required_discoveries || 1);
          updatePromises.push(
            base44.entities.UserQuest.update(userQuest.id, {
              progress: newProgress,
              completed: isCompleted,
              completed_date: isCompleted ? new Date().toISOString() : userQuest.completed_date
            })
          );
        }
      }

      if (currentMonthlyQuest) {
        const activeMonthlyQuest = await getOrCreateActiveMonthlyQuest(base44, currentMonthlyQuest, userMonthlyQuests, user.email);
        if (activeMonthlyQuest && !activeMonthlyQuest.completed && scanMatchesQuest(currentMonthlyQuest)) {
          const newProgress = (activeMonthlyQuest.progress || 0) + 1;
          const isCompleted = newProgress >= (currentMonthlyQuest.required_discoveries || 1);
          updatePromises.push(
            base44.entities.UserMonthlyQuest.update(activeMonthlyQuest.id, {
              progress: newProgress,
              completed: isCompleted,
              completed_date: isCompleted ? new Date().toISOString() : activeMonthlyQuest.completed_date
            })
          );
        }
      }

      if (currentWeeklyQuest) {
        const activeWeeklyQuest = await getOrCreateActiveWeeklyQuest(base44, currentWeeklyQuest, userWeeklyQuests, user.email);
        if (activeWeeklyQuest && !activeWeeklyQuest.completed && scanMatchesQuest(currentWeeklyQuest)) {
          const newProgress = (activeWeeklyQuest.progress || 0) + 1;
          const isCompleted = newProgress >= (currentWeeklyQuest.required_discoveries || 1);
          updatePromises.push(
            base44.entities.UserWeeklyQuest.update(activeWeeklyQuest.id, {
              progress: newProgress,
              completed: isCompleted,
              completed_date: isCompleted ? new Date().toISOString() : activeWeeklyQuest.completed_date
            })
          );
        }
      }

      // Alle Updates parallel ausführen
      await Promise.all(updatePromises);

      queryClient.invalidateQueries({ queryKey: ['userQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userMonthlyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
    } catch (error) {
      console.error("Quest-Progress Update Fehler:", error);
      // Fehler nicht weiterwerfen - Quest-Updates sollen den Scan nicht blockieren
    }
  };

  // Hintergrund-Freischaltungen im Hintergrund prüfen (nicht-blockierend)
  const checkBackgroundUnlocks = async (plant, isFirstScan) => {
    try {
      const currentUser = await base44.auth.me();
      
      // Referral-Hintergrund (nur bei erstem Scan)
      if (isFirstScan) {
        const referrals = await base44.entities.Referral.list();
        const myReferral = referrals.find(r => r.invited_email?.toLowerCase() === currentUser.email.toLowerCase() && r.status === "pending");
        
        if (myReferral) {
          await base44.entities.Referral.update(myReferral.id, {
            status: "completed",
            completed_date: new Date().toISOString()
          });

          const inviterProfiles = await base44.entities.PublicProfile.list();
          const inviter = inviterProfiles.find(p => p.user_email?.toLowerCase() === myReferral.invited_by?.toLowerCase());
          
          if (inviter) {
            await base44.entities.PublicProfile.update(inviter.id, {
              referral_background_unlocked: true
            });
          }

          await base44.entities.UserNotification.create({
            user_email: currentUser.email,
            notification_type: "custom",
            title: "🎉 Freund belohnt!",
            message: "Dein Freund hat den 'Plains' Hintergrund freigeschaltet!",
            priority: "low",
            display_location: "banner"
          });
        }
      }

      // Seltene-Pflanze-Hintergrund
      if (plant.rarity === "Selten" || plant.rarity === "Sehr Selten" || plant.rarity === "Extrem Selten") {
        if (!currentUser.rare_plant_unlocked) {
          await base44.auth.updateMe({ rare_plant_unlocked: true });
          await base44.entities.UserNotification.create({
            user_email: currentUser.email,
            notification_type: "custom",
            title: "🌟 Hintergrund freigeschaltet!",
            message: "Du hast den 'Epic Rare' Hintergrund freigeschaltet!",
            priority: "medium",
            display_location: "banner"
          });
        }
      }

      // Weekly Quest Hintergrund (nur wenn tatsächlich Progress > 0)
      const userWeeklyQuestsData = await base44.entities.UserWeeklyQuest.filter({ created_by: currentUser.email });
      const weeklyWithProgress = userWeeklyQuestsData.filter(q => (q.progress || 0) > 0);
      const weeklyParticipations = new Set(weeklyWithProgress.map(q => q.active_week)).size;
      
      if (weeklyParticipations >= 1 && !currentUser.weekly_bg1_unlocked) {
        await base44.auth.updateMe({ weekly_bg1_unlocked: true });
        await base44.entities.UserNotification.create({
          user_email: currentUser.email,
          notification_type: "custom",
          title: "🎉 Hintergrund freigeschaltet!",
          message: "Hintergrund 'BackGround1' freigeschaltet!",
          priority: "low",
          display_location: "banner"
        });
      }
      if (weeklyParticipations >= 3 && !currentUser.weekly_bg2_unlocked) {
        await base44.auth.updateMe({ weekly_bg2_unlocked: true });
        await base44.entities.UserNotification.create({
          user_email: currentUser.email,
          notification_type: "custom",
          title: "🎉 Hintergrund freigeschaltet!",
          message: "Hintergrund 'BackGround2' freigeschaltet!",
          priority: "low",
          display_location: "banner"
        });
      }

      // Monthly Quest Hintergrund (nur wenn tatsächlich completed)
      const userMonthlyQuestsData = await base44.entities.UserMonthlyQuest.filter({ created_by: currentUser.email });
      const hasCompleted = userMonthlyQuestsData.some(q => q.completed);
      
      if (hasCompleted && !currentUser.monthly_bg_unlocked) {
        await base44.auth.updateMe({ monthly_bg_unlocked: true });
        await base44.entities.UserNotification.create({
          user_email: currentUser.email,
          notification_type: "custom",
          title: "🎉 Hintergrund freigeschaltet!",
          message: "Hintergrund 'BackGround4' freigeschaltet!",
          priority: "low",
          display_location: "banner"
        });
      }

      // Quest 1 Hintergrund - nur wenn eingelöst (redeemed)
      const userQuestsData = await base44.entities.UserQuest.filter({ created_by: currentUser.email });
      const questsData = await base44.entities.Quest.list();
      const quest1 = questsData.find(q => q.quest_number === 1);
      const userQuest1 = userQuestsData.find(uq => uq.quest_id === quest1?.id);
      
      if (userQuest1?.redeemed && !currentUser.gift_bg_unlocked) {
        await base44.auth.updateMe({ gift_bg_unlocked: true });
        await base44.entities.UserNotification.create({
          user_email: currentUser.email,
          notification_type: "custom",
          title: "🎁 Hintergrund freigeschaltet!",
          message: "Hintergrund 'Colors' freigeschaltet!",
          priority: "low",
          display_location: "banner"
        });
      }
    } catch (error) {
      console.error("Fehler bei Hintergrund-Freischaltung:", error);
    }
  };



  const handleDeleteResult = async (discoveryId) => {
    try {
      await deleteDiscoveryMutation.mutateAsync(discoveryId);

      setMatchedPlant(null);
      setAllScanResults([]);
      setLatestDiscoveryId(null);
      setImageUrl(null);

      alert("Die Entdeckung wurde erfolgreich gelöscht.");
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Fehler beim Löschen der Entdeckung. Bitte versuche es erneut.");
    }
  };

  const handleChangeResult = async (discoveryId, newPlant, currentImageUrl) => {
    try {
      let targetPlantId = newPlant.id;

      if (!targetPlantId || newPlant.notInDex) {
        let genus = genera.find((g) =>
        g.genus_name?.toLowerCase() === newPlant.genus_name?.toLowerCase() ||
        g.scientific_genus?.toLowerCase() === newPlant.scientific_genus?.toLowerCase()
        );

        if (!genus) {
          // Lade frische Genera-Daten direkt von der DB
          const allGenera = await base44.entities.PlantGenus.list();

          const categoryGenera = allGenera.filter((g) =>
          g.category === newPlant.category ||
          newPlant.category === "Blumen" && g.category === "Blumen & Kräuter"
          );

          // Berechne die nächste Nummer: Anzahl aller Gattungen in dieser Kategorie + 1
          const nextCategoryDexNumber = categoryGenera.length + 1;

          genus = await createGenusMutation.mutateAsync({
            category_dex_number: nextCategoryDexNumber,
            genus_name: newPlant.genus_name,
            scientific_genus: newPlant.scientific_genus,
            category: newPlant.category,
            family: newPlant.family,
            description: `Gattung der ${newPlant.category}`
          });
        }

        const displayName = newPlant.species_name;

        const createdPlant = await createPlantMutation.mutateAsync({
          genus_category: genus.category,
          genus_number: genus.category_dex_number,
          species_name: displayName,
          scientific_name: newPlant.scientific_name,
          description: newPlant.description,
          identification_features: newPlant.identification_features,
          fun_fact: newPlant.fun_fact,
          rarity: newPlant.rarity || "Gelegentlich"
        });

        targetPlantId = createdPlant.id;
      }

      await updateDiscoveryMutation.mutateAsync({
        discoveryId: discoveryId,
        data: {
          plant_id: targetPlantId,
          image_url: currentImageUrl
        }
      });

      const updatedPlant = plants.find((p) => p.id === targetPlantId) || newPlant;
      setMatchedPlant({
        ...updatedPlant,
        discovered: false,
        xpAwarded: 0,
        aiData: newPlant
      });

      const updatedResults = allScanResults.map((result, index) =>
      index === 0 ? { ...updatedPlant, aiData: result.aiData || result } : result
      );
      setAllScanResults(updatedResults);

      alert(`Erfolgreich auf "${newPlant.species_name}" geändert!`);
    } catch (error) {
      console.error("Fehler beim Ändern:", error);
      alert("Fehler beim Ändern der Entdeckung. Bitte versuche es erneut.");
    }
  };

  const identifyPlant = async (file, organ = "auto") => {
    setScanning(true);
    setScanningPhase(0);
    setMatchedPlant(null);
    setAllScanResults([]);
    setLatestDiscoveryId(null);

    try {
      console.log("📤 Starte Upload...");
      setScanningPhase(0); // Komprimiere Bild
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      console.log("✅ Upload erfolgreich:", file_url);
      setImageUrl(file_url);

      console.log(`🌿 Starte Pflanzenerkennung mit organ: ${organ}...`);
      setScanningPhase(1); // PlantNet-API analysiert

      try {
        const response = await base44.functions.invoke('identifyPlant', {
          image_url: file_url,
          organ: organ
        });

        console.log("✅ Rohe Response:", response);

        const result = response.data || response;
        
        // Prüfe auf Rate-Limit-Fehler
        if (result.error_type === 'PLANTNET_RATE_LIMIT') {
          console.warn("⚠️ PlantNet Rate-Limit erreicht");
          // Speichere Bild-Daten für späteren LLM-Versuch
          setPendingImageData({ file_url, organ });
          setShowRateLimitDialog(true);
          setScanning(false);
          return;
        }

        console.log("✅ Verarbeitetes Ergebnis:", JSON.stringify(result, null, 2));

        if (result && result.identified && result.results && result.results.length > 0) {
          console.log(`🌿 ${result.results.length} Pflanze(n) erkannt`);

          setScanningPhase(2); // Vergleiche mit globalem Floralog
          await new Promise(resolve => setTimeout(resolve, 800));

          const normalizeString = (str) => {
            if (!str) return "";
            return str.toLowerCase().trim().replace(/\s+/g, ' ');
          };

          const processedResults = await Promise.all(
            result.results.map(async (plantData) => {
              const resultSpeciesNorm = normalizeString(plantData.species_name);
              const resultScientificNorm = normalizeString(plantData.scientific_name);
              const resultGenusNorm = normalizeString(plantData.genus_name);

              let match = plants.find((p) => {
                const plantSpeciesNorm = normalizeString(p.species_name);
                const plantScientificNorm = normalizeString(p.scientific_name);
                return plantSpeciesNorm === resultSpeciesNorm || plantScientificNorm === resultScientificNorm;
              });

              if (!match) {
                const genus = genera.find((g) =>
                normalizeString(g.genus_name) === resultGenusNorm ||
                normalizeString(g.scientific_genus) === normalizeString(plantData.scientific_genus)
                );

                if (genus) {
                  const genusPlants = plants.filter((p) => p.genus_id === genus.id);
                  match = genusPlants.find((p) => {
                    const plantWords = normalizeString(p.species_name).split(' ');
                    const resultWords = resultSpeciesNorm.split(' ');
                    const scientificWords = normalizeString(p.scientific_name).split(' ');
                    const resultScientificWords = normalizeString(resultScientificNorm).split(' ');

                    const commonWords = plantWords.filter((w) => resultWords.includes(w)).length;
                    const commonScientific = scientificWords.filter((w) => resultScientificWords.includes(w)).length;

                    return commonWords >= 2 || commonScientific >= 2;
                  });
                }
              }

              if (match) {
                console.log("📚 Gefunden in Datenbank:", match.species_name);
                return { ...match, aiData: plantData, inDatabase: true };
              } else {
                console.log("🆕 Nicht in Datenbank:", plantData.species_name);

                if (plantData.is_european === false) {
                  return { ...plantData, notInDex: true, is_european: false, inDatabase: false };
                }

                return { ...plantData, notInDex: true, inDatabase: false };
              }
            })
          );

          setAllScanResults(processedResults);

          setScanningPhase(3); // Vergleiche mit deinem Floralog
          await new Promise(resolve => setTimeout(resolve, 800));

          const firstResult = processedResults[0];

          // KORRIGIERTE LOGIK: Prüfe zuerst ob nicht-europäisch, dann ob in Datenbank
          if (firstResult.is_european === false) {
            // Nicht-europäische Pflanze - nur anzeigen, nicht speichern
            console.log("🌍 Nicht-europäische Pflanze erkannt - nur Anzeige");
            setMatchedPlant(firstResult);
            setScanning(false);
          } else {
            // Europäische Pflanze erkannt - temporär speichern, aber noch nicht in DB
            console.log("🌿 Pflanze erkannt - warte auf Bestätigung");
            setPendingScanData({
              plant: firstResult,
              imageUrl: file_url,
              allResults: processedResults,
              isInDatabase: firstResult.inDatabase
            });
            setMatchedPlant(firstResult);
            setScanning(false);
          }

        } else {
          console.warn("❌ Pflanze nicht erkannt");
          // Vibration: 1x lang für Fehler
          if (navigator.vibrate) {
            navigator.vibrate(500);
          }
          setMatchedPlant({
            identified: false,
            error: "Die Pflanze konnte nicht identifiziert werden. Versuche ein klareres Foto mit mehr Details (Blätter, Blüten, Stamm)."
          });
          setScanning(false);
        }
      } catch (funcError) {
        console.error("💥 Fehler beim Funktionsaufruf:", funcError);
        throw new Error(`Funktion fehlgeschlagen: ${funcError.message}`);
      }
    } catch (error) {
      console.error("💥 HAUPTFEHLER:", error);
      setMatchedPlant({
        identified: false,
        error: `Fehler: ${error.message}`
      });
      setScanning(false);
    }
  };

  const handleAutoSave = async (plant, imageUrl, aiData, allResults = []) => {
    let locationString = null;
    if (userLocation) {
      locationString = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
    }

    // Lade aktuelle Discoveries direkt von der DB, nicht vom Cache
    const currentDiscoveries = await base44.entities.UserPlantDiscovery.filter({ created_by: user.email });

    console.log("🔍 Überprüfe ob bereits entdeckt:");
    console.log("  plant.id:", plant.id);
    console.log("  plant.species_name:", plant.species_name);
    console.log("  Anzahl currentDiscoveries:", currentDiscoveries.length);
    console.log("  Plant IDs in Discoveries:", currentDiscoveries.map(d => d.plant_id));

    const alreadyDiscovered = currentDiscoveries.some((d) => d.plant_id === plant.id);

    console.log("  ✅ alreadyDiscovered:", alreadyDiscovered);

    const newDiscovery = await base44.entities.UserPlantDiscovery.create({
      plant_id: plant.id,
      discovered_date: new Date().toISOString(),
      discovery_location: locationString,
      discovery_notes: "",
      image_url: imageUrl
    });

    setLatestDiscoveryId(newDiscovery.id);

    queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });

    const newlyUnlocked = await checkAndUnlockAchievements(user);
    if (newlyUnlocked.length > 0) {
      setNewAchievements(newlyUnlocked);
      setCurrentAchievementIndex(0);
    }

    // Quest-Progress aktualisieren - inline statt über Helper
    await updateQuestProgress(newPlant);

    // Hintergrund-Freischaltungen im Hintergrund prüfen (nicht-blockierend)
    const isFirstScan = currentDiscoveries.length === 1;
    checkBackgroundUnlocks(plant, isFirstScan).catch(err => console.error("Background unlock error:", err));

    // Vibration: 1x kurz für erfolgreichen Scan
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    setMatchedPlant({
      ...plant,
      discovered: alreadyDiscovered,
      aiData: aiData
    });

    // Aktualisiere auch allScanResults mit discovered-Status
    setAllScanResults(prevResults => prevResults.map((result, index) => 
      index === 0 ? { ...result, discovered: alreadyDiscovered } : result
    ));

    setScanning(false);
  };

  const handleAutoAddNewPlant = async (plantData, imageUrl, allResults = []) => {
    let locationString = null;
    if (userLocation) {
      locationString = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
    }

    try {
      let genus = genera.find((g) =>
      g.genus_name?.toLowerCase() === plantData.genus_name?.toLowerCase() ||
      g.scientific_genus?.toLowerCase() === plantData.scientific_genus?.toLowerCase()
      );

      if (!genus) {
        // Lade frische Genera-Daten direkt von der DB
        const allGenera = await base44.entities.PlantGenus.list();

        const categoryGenera = allGenera.filter((g) =>
        g.category === plantData.category ||
        plantData.category === "Blumen" && g.category === "Blumen & Kräuter"
        );

        // Berechne die nächste Nummer: Anzahl aller Gattungen in dieser Kategorie + 1
        const nextCategoryDexNumber = categoryGenera.length + 1;

        genus = await createGenusMutation.mutateAsync({
          category_dex_number: nextCategoryDexNumber,
          genus_name: plantData.genus_name,
          scientific_genus: plantData.scientific_genus,
          category: plantData.category,
          family: plantData.family,
          description: `Gattung der ${plantData.category}`
        });
      }

      const displayName = plantData.species_name;

      const newPlant = await createPlantMutation.mutateAsync({
        genus_category: genus.category,
        genus_number: genus.category_dex_number,
        species_name: displayName,
        scientific_name: plantData.scientific_name,
        description: plantData.description,
        identification_features: plantData.identification_features,
        fun_fact: plantData.fun_fact,
        rarity: plantData.rarity || "Gelegentlich"
      });

      const newDiscovery = await base44.entities.UserPlantDiscovery.create({
        plant_id: newPlant.id,
        discovered_date: new Date().toISOString(),
        discovery_location: locationString,
        discovery_notes: "",
        image_url: imageUrl
      });

      setLatestDiscoveryId(newDiscovery.id);

      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
      queryClient.invalidateQueries({ queryKey: ['plants'] });

      const newlyUnlocked = await checkAndUnlockAchievements(user);
      if (newlyUnlocked.length > 0) {
        setNewAchievements(newlyUnlocked);
        setCurrentAchievementIndex(0);
      }

      // Quest-Progress aktualisieren - inline statt über Helper
      await updateQuestProgress(plant);

      // Hintergrund-Freischaltungen im Hintergrund prüfen (nicht-blockierend)
      const currentUser = await base44.auth.me();
      const myDiscoveries = await base44.entities.UserPlantDiscovery.filter({ created_by: currentUser.email });
      const isFirstScan = myDiscoveries.length === 1;
      checkBackgroundUnlocks(newPlant, isFirstScan).catch(err => console.error("Background unlock error:", err));

      // Vibration: 3x kurz für neuen Floralog-Eintrag
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }

      // Speichere Pflanzennamen für Modal
      setNewPlantName(newPlant.species_name);
      
      setMatchedPlant({
        ...newPlant,
        discovered: false,
        aiData: plantData,
        isNewToFloralog: true
      });
      setScanning(false);
    } catch (error) {
      console.error("Fehler beim Hinzufügen der Pflanze:", error);
      setScanning(false);
    }
  };

  const handleCameraCapture = (file, organ = "auto") => {
    setShowCamera(false);
    identifyPlant(file, organ);
  };

  const handleLLMFallback = async () => {
    setShowRateLimitDialog(false);
    if (!pendingImageData) return;
    
    setScanning(true);
    
    try {
      // Rufe LLM-Fallback direkt auf
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein präziser Botaniker und Pflanzenexperte.

Analysiere dieses Foto sehr sorgfältig und identifiziere die Pflanze NUR wenn du dir SICHER bist.

WICHTIGE REGELN:
- Setze "identified" nur auf TRUE wenn du die Pflanze mit hoher Sicherheit erkennst
- Achte genau auf: Blattform, Blütenform, Farbe, Wuchsform, Stängelstruktur
- Bei Unsicherheit: setze "identified" auf FALSE
- Lieber keine Antwort als eine falsche!
- WICHTIG: Prüfe ob die Pflanze in Mitteleuropa heimisch oder häufig vorkommt
- Setze "is_european" auf false für tropische, asiatische, amerikanische oder andere nicht-europäische Pflanzen

Falls du die Pflanze SICHER erkennst, gib an:
1. Deutschen Artnamen (präzise, z.B. "Gewöhnliche Sonnenblume")
2. Gattungsname (z.B. "Sonnenblume")
3. Wissenschaftlicher Artname (z.B. "Helianthus annuus")
4. Wissenschaftlicher Gattungsname (z.B. "Helianthus")
5. Kategorie: "Bäume", "Sträucher" oder "Blumen"
6. Pflanzenfamilie (z.B. "Korbblütler")
7. Beschreibung (2-3 Sätze)
8. Haupterkennungsmerkmale
9. Interessanter Fakt
10. is_european: true/false
11. rarity: "Häufig", "Gelegentlich", "Selten", "Sehr Selten", oder "Extrem Selten"`,
        file_urls: [pendingImageData.file_url],
        response_json_schema: {
          type: "object",
          properties: {
            identified: { type: "boolean" },
            species_name: { type: "string" },
            genus_name: { type: "string" },
            scientific_name: { type: "string" },
            scientific_genus: { type: "string" },
            category: { type: "string", enum: ["Bäume", "Sträucher", "Blumen"] },
            family: { type: "string" },
            description: { type: "string" },
            identification_features: { type: "string" },
            fun_fact: { type: "string" },
            is_european: { type: "boolean" },
            rarity: { type: "string", enum: ["Häufig", "Gelegentlich", "Selten", "Sehr Selten", "Extrem Selten"] }
          },
          required: ["identified"]
        }
      });
      
      if (response.identified) {
        const plantData = {
          ...response,
          notInDex: true,
          inDatabase: false
        };
        
        setAllScanResults([plantData]);
        
        if (response.is_european === false) {
          setMatchedPlant(plantData);
          setScanning(false);
        } else {
          // Temporär speichern, warte auf Bestätigung
          setPendingScanData({
            plant: plantData,
            imageUrl: pendingImageData.file_url,
            allResults: [plantData],
            isInDatabase: false
          });
          setMatchedPlant(plantData);
          setScanning(false);
        }
      } else {
        setMatchedPlant({
          identified: false,
          error: "Die Pflanze konnte nicht identifiziert werden."
        });
        setScanning(false);
      }
      
      setPendingImageData(null);
    } catch (error) {
      console.error("LLM-Fallback Fehler:", error);
      setMatchedPlant({
        identified: false,
        error: `Fehler: ${error.message}`
      });
      setScanning(false);
      setPendingImageData(null);
    }
  };

  const handleConfirmSave = async () => {
    if (!pendingScanData || isSavingPlant) return;
    
    setIsSavingPlant(true);
    // Modal bleibt offen und zeigt Loading-State
    
    try {
      // Wähle das aktuell ausgewählte Ergebnis
      const selectedPlant = pendingScanData.allResults[currentResultIndex] || pendingScanData.plant;
      const isInDatabase = selectedPlant.inDatabase;
      
      if (isInDatabase) {
        await handleAutoSave(selectedPlant, pendingScanData.imageUrl, selectedPlant.aiData || selectedPlant, pendingScanData.allResults);
        
        // Prüfe ob das der erste Scan war - dann Quest-Notification erstellen
        try {
          const currentUser = await base44.auth.me();
          const allDiscoveries = await base44.entities.UserPlantDiscovery.filter({ created_by: currentUser.email });
          
          if (allDiscoveries.length === 1) {
            await base44.entities.UserNotification.create({
              user_email: currentUser.email,
              notification_type: "custom",
              title: "🎯 Deine erste Quest ist abgeschlossen!",
              message: "Glückwunsch! Du hast deine erste Pflanze gescannt. Jetzt kannst du deine Quests einlösen und Belohnungen erhalten. Schau bei 'Erfolge' vorbei!",
              description: "Löse deine erste Quest ein.",
              action_url: "",
              priority: "high",
              display_location: "modal"
            });
          }
        } catch (notificationError) {
          console.error("Fehler beim Erstellen der Notification:", notificationError);
        }
        
        // Navigation zur Home-Page
        navigate(createPageUrl("Home"));
      } else {
        await handleAutoAddNewPlant(selectedPlant, pendingScanData.imageUrl, pendingScanData.allResults);
        
        // Prüfe ob das der erste Scan war - dann Quest-Notification erstellen
        try {
          const currentUser = await base44.auth.me();
          const allDiscoveries = await base44.entities.UserPlantDiscovery.filter({ created_by: currentUser.email });
          
          if (allDiscoveries.length === 1) {
            await base44.entities.UserNotification.create({
              user_email: currentUser.email,
              notification_type: "custom",
              title: "🎯 Deine erste Quest ist abgeschlossen!",
              message: "Glückwunsch! Du hast deine erste Pflanze gescannt. Jetzt kannst du deine Quests einlösen und Belohnungen erhalten. Schau bei 'Erfolge' vorbei!",
              description: "Löse deine erste Quest ein.",
              action_url: "",
              priority: "high",
              display_location: "modal"
            });
          }
        } catch (notificationError) {
          console.error("Fehler beim Erstellen der Notification:", notificationError);
        }
        
        // Modal schließen und Floralog-Modal anzeigen
        setShowConfirmDialog(false);
        setIsSavingPlant(false);
        setShowGlobalFloralogModal(true);
      }
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      setIsSavingPlant(false);
    }
  };

  const handleCancelSave = () => {
    setShowConfirmDialog(false);
    setPendingScanData(null);
    setMatchedPlant(null);
    setAllScanResults([]);
    setImageUrl(null);
  };

  const [averageColor, setAverageColor] = useState(null);

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
      {/* Grüner Haken / Ändern Button - nur wenn pendingScanData vorhanden */}
      {pendingScanData && !isSavingPlant && (
        <ConfirmButton 
          onConfirm={() => setShowConfirmDialog(true)}
          isPrimaryResult={currentResultIndex === 0}
        />
      )}
      
      {/* Bestätigungs-Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => !isSavingPlant && setShowConfirmDialog(open)}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => isSavingPlant && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              {isSavingPlant ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
              {isSavingPlant ? "Wird gespeichert..." : "Pflanze hinzufügen?"}
            </DialogTitle>
            {!isSavingPlant && (
              <DialogDescription className="text-base pt-4">
                Möchtest du <strong>{pendingScanData?.allResults?.[currentResultIndex]?.species_name || pendingScanData?.plant?.species_name}</strong> zu deiner Sammlung hinzufügen?
              </DialogDescription>
            )}
            {isSavingPlant && (
              <DialogDescription className="text-base pt-4 text-center">
                <p>Die Pflanze wird gespeichert und Quest-Fortschritte werden aktualisiert...</p>
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={handleCancelSave}
              disabled={isSavingPlant}
            >
              Nein
            </Button>
            <Button 
              onClick={handleConfirmSave}
              disabled={isSavingPlant}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {isSavingPlant ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Ja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Globales Floralog erweitert Dialog */}
      <Dialog open={showGlobalFloralogModal} onOpenChange={(open) => {
        if (!open) {
          setShowGlobalFloralogModal(false);
          navigate(createPageUrl("Home"));
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Sparkles className="w-6 h-6" />
              Globales Floralog erweitert!
            </DialogTitle>
            <DialogDescription className="text-base pt-4 space-y-3">
              <p className="font-semibold text-green-700">
                🌟 Glückwunsch!
              </p>
              <p>
                Du hast mit <strong>{newPlantName}</strong> eine neue Pflanze zum globalen Floralog hinzugefügt!
              </p>
              <p className="text-sm text-stone-600">
                Diese Pflanze ist jetzt für alle Nutzer verfügbar.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              onClick={() => {
                setShowGlobalFloralogModal(false);
                navigate(createPageUrl("Home"));
              }}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Verstanden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Rate-Limit Dialog */}
      <Dialog open={showRateLimitDialog} onOpenChange={setShowRateLimitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-6 h-6" />
              PlantNet nicht verfügbar
            </DialogTitle>
            <DialogDescription className="text-base pt-4">
              Achtung: PlantNet hat die maximale Anzahl an Scans erreicht oder ist nicht erreichbar. 
              Soll stattdessen die KI von Base44 zur Erkennung verwendet werden? Diese ist deutlich unzuverlässiger.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRateLimitDialog(false);
                setPendingImageData(null);
                setMatchedPlant(null);
                setImageUrl(null);
              }}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleLLMFallback}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Scannen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AnimatePresence>
        {newAchievements.length > 0 && currentAchievementIndex < newAchievements.length &&
        <AchievementNotification
          achievement={newAchievements[currentAchievementIndex]}
          onComplete={() => {
            if (currentAchievementIndex < newAchievements.length - 1) {
              setCurrentAchievementIndex(currentAchievementIndex + 1);
            } else {
              setNewAchievements([]);
              setCurrentAchievementIndex(0);
            }
          }} />

        }
      </AnimatePresence>

      <div className="max-w-4xl mx-auto">
        {!scanning && !matchedPlant && !showCamera &&
        <Card 
          className="shadow-xl bg-white overflow-hidden"
          style={{
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
          }}
        >
            <CardContent className="p-6 md:p-8" style={user?.background_image_url ? {
              backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.4) 100%), url(${user.background_image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : user?.background_color ? {
              background: `linear-gradient(135deg, ${user.background_color.replace('rgb', 'rgba').replace(')', ', 0.6)')} 0%, ${user.background_color.replace('rgb', 'rgba').replace(')', ', 1)')} 100%)`
            } : {}}>
              <button
              onClick={() => setShowCamera(true)}
              className="w-full group relative overflow-hidden rounded-xl bg-white/60 backdrop-blur-md border-2 p-8 hover:bg-white/80 shadow-lg hover:shadow-xl transition-all duration-300"
              style={{
                borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
              }}>

                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Camera className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-stone-900">Foto aufnehmen</h3>
                  <p className="text-stone-600 text-base">Mit der Kamera scannen</p>
                </div>
              </button>

              <div className="mt-6 p-4 bg-white/40 backdrop-blur-md rounded-xl border border-white/30">
                <p className="text-center font-semibold text-stone-700">
                  💡 Tipp: Achte darauf, dass die Pflanze gut zu sehen ist!
                </p>
                {userLocation &&
              <p className="text-center text-sm text-stone-600 mt-2">
                    📍 Dein Standort wird automatisch gespeichert
                  </p>
              }
              </div>
            </CardContent>
          </Card>
        }

        {!scanning && !matchedPlant && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6"
          >
          <Card 
            className="shadow-xl bg-white overflow-hidden"
            style={{
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
            }}
          >
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center justify-between gap-4">
                <Button
                  onClick={() => navigate(createPageUrl("Home"))}
                  className="bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Zurück
                </Button>

                <div className="flex items-center gap-3 bg-stone-50 rounded-lg px-4 py-2.5 border-2 border-stone-200">
                  <Label htmlFor="location-toggle" className="text-stone-900 font-semibold cursor-pointer flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Standort
                  </Label>
                  <Switch 
                    id="location-toggle"
                    checked={locationEnabled}
                    onCheckedChange={setLocationEnabled}
                  />
                </div>
              </div>
              
              {gettingLocation && locationEnabled && (
                <div className="flex items-center justify-center gap-2 text-sm text-stone-600 mt-4 bg-green-50 rounded-lg p-3 border border-green-200">
                  <MapPin className="w-4 h-4 animate-pulse text-green-600" />
                  <span>Standort wird ermittelt...</span>
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        )}

        {scanning &&
        <Card 
          className="shadow-xl bg-white overflow-hidden"
          style={{
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
          }}
        >
            <CardContent className="p-12" style={user?.background_image_url ? {
              backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.4) 100%), url(${user.background_image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : user?.background_color ? {
              background: `linear-gradient(135deg, ${user.background_color.replace('rgb', 'rgba').replace(')', ', 0.6)')} 0%, ${user.background_color.replace('rgb', 'rgba').replace(')', ', 1)')} 100%)`
            } : {}}>
              <div className="flex flex-col items-center bg-white/60 backdrop-blur-md rounded-xl p-8 border-2" style={{
                borderColor: averageColor ? 'var(--profile-border-color)' : 'rgb(187, 247, 208)'
              }}>
                <Loader2 className="w-16 h-16 text-green-600 animate-spin mb-4" />
                <h3 className="text-2xl font-bold text-stone-900 mb-2">
                  Pflanze wird analysiert...
                </h3>
                <div className="text-center">
                  <p className="text-lg text-green-700 font-semibold transition-all duration-300">
                    {scanningPhase === 0 && '📦 Komprimiere Bild...'}
                    {scanningPhase === 1 && '🌿 Lasse das Bild über PlantNet-API analysieren...'}
                    {scanningPhase === 2 && '🌍 Vergleiche das Ergebnis mit globalem Floralog...'}
                    {scanningPhase === 3 && '📚 Vergleiche das Ergebnis mit deinem Floralog...'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        }

        {matchedPlant && !scanning &&
        <div className="w-full">
            <ScanResults
            plant={matchedPlant}
            imageUrl={imageUrl}
            onRescan={() => {
              setMatchedPlant(null);
              setAllScanResults([]);
              setLatestDiscoveryId(null);
              setImageUrl(null);
              setPendingScanData(null);
              setCurrentResultIndex(0);
            }}
            onResultIndexChange={setCurrentResultIndex}
            userLocation={userLocation}
            allResults={allScanResults}
            onDeleteResult={handleDeleteResult}
            onChangeResult={handleChangeResult}
            latestDiscoveryId={latestDiscoveryId}
            isPendingConfirmation={!!pendingScanData} />

          </div>
        }

        {showCamera &&
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)} />

        }
      </div>
      </div>
    </>);

}