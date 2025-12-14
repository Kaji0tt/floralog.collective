import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, MapPin, AlertTriangle, ArrowLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import ScanResults from "../components/scanner/ScanResults";
import CameraCapture from "../components/scanner/CameraCapture";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import AchievementNotification from "../components/achievements/AchievementNotification";
import { AnimatePresence, motion } from "framer-motion";
import { awardXP } from "../components/utils/xpSystem";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { Check, RefreshCw } from "lucide-react";
import { createPageUrl } from "@/utils";
import {
  getCurrentDailyQuest,
  getCurrentWeeklyQuest,
  getOrCreateActiveDailyQuest,
  getOrCreateActiveWeeklyQuest,
  getTodayString,
  getWeekNumber } from
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();

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
    queryFn: () => base44.entities.UserPlantDiscovery.filter({ user: user?.email }),
    enabled: !!user?.email
  });

  const { data: dailyQuests = [] } = useQuery({
    queryKey: ['dailyQuests'],
    queryFn: () => base44.entities.DailyQuest.list('quest_number')
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => base44.entities.WeeklyQuest.list('quest_number')
  });

  const { data: userDailyQuests = [] } = useQuery({
    queryKey: ['userDailyQuests'],
    queryFn: () => base44.entities.UserDailyQuest.filter({ created_by: user?.email }),
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

  const awardXPToUser = async (amount) => {
    if (!user) return;
    const currentXP = user.xp || 0;
    const result = awardXP(currentXP, amount);

    await base44.auth.updateMe(result);

    const freshUser = await base44.auth.me();
    setUser(freshUser);
    await updatePublicProfile(freshUser);
  };

  const updatePublicProfile = async (userData) => {
    try {
      const profiles = await base44.entities.PublicProfile.list();
      const existingProfile = profiles.find((p) => p.user_email?.toLowerCase() === userData.email?.toLowerCase());

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
      console.error("PublicProfile Update Fehler:", error);
    }
  };

  const updateQuestProgress = async (scannedPlant) => {
    if (!user?.email || !scannedPlant) return;

    const currentDailyQuest = getCurrentDailyQuest(dailyQuests);
    const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);

    // Helper: Prüft ob der Scan für die Quest zählt
    const scanMatchesQuest = (quest) => {
      // Wenn spezifische Art gefordert: muss exakt diese Art sein
      if (quest.target_species_name) {
        return scannedPlant.species_name?.toLowerCase() === quest.target_species_name.toLowerCase();
      }
      // Wenn spezifische Gattung gefordert: muss diese Gattung sein
      if (quest.target_genus_name) {
        const genus = genera.find((g) => g.id === scannedPlant.genus_id);
        return genus?.genus_name?.toLowerCase() === quest.target_genus_name.toLowerCase();
      }
      // Sonst: Kategorie-basiert (wie bisher)
      if (quest.category && quest.category !== "Alle") {
        const genus = genera.find((g) => g.id === scannedPlant.genus_id);
        return genus?.category === quest.category;
      }
      // Alle Kategorien
      return true;
    };

    if (currentDailyQuest) {
      const activeDailyQuest = await getOrCreateActiveDailyQuest(base44, currentDailyQuest, userDailyQuests, user.email);
      if (activeDailyQuest && !activeDailyQuest.completed && scanMatchesQuest(currentDailyQuest)) {
        await base44.entities.UserDailyQuest.update(activeDailyQuest.id, {
          progress: (activeDailyQuest.progress || 0) + 1
        });
      }
    }

    if (currentWeeklyQuest) {
      const activeWeeklyQuest = await getOrCreateActiveWeeklyQuest(base44, currentWeeklyQuest, userWeeklyQuests, user.email);
      if (activeWeeklyQuest && !activeWeeklyQuest.completed && scanMatchesQuest(currentWeeklyQuest)) {
        await base44.entities.UserWeeklyQuest.update(activeWeeklyQuest.id, {
          progress: (activeWeeklyQuest.progress || 0) + 1
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['userDailyQuests'] });
    queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
  };

  const getRarityXP = (rarity) => {
    switch (rarity) {
      case "Häufig":return 20;
      case "Gelegentlich":return 35;
      case "Selten":return 50;
      case "Sehr Selten":return 75;
      case "Extrem Selten":return 100;
      default:return 20;
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
    setMatchedPlant(null);
    setAllScanResults([]);
    setLatestDiscoveryId(null);

    try {
      console.log("📤 Starte Upload...");
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      console.log("✅ Upload erfolgreich:", file_url);
      setImageUrl(file_url);

      console.log(`🌿 Starte Pflanzenerkennung mit organ: ${organ}...`);

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
    const currentDiscoveries = await base44.entities.UserPlantDiscovery.filter({ user: user.email });

    console.log("🔍 Überprüfe ob bereits entdeckt:");
    console.log("  plant.id:", plant.id);
    console.log("  plant.species_name:", plant.species_name);
    console.log("  Anzahl currentDiscoveries:", currentDiscoveries.length);
    console.log("  Plant IDs in Discoveries:", currentDiscoveries.map(d => d.plant_id));

    const alreadyDiscovered = currentDiscoveries.some((d) => d.plant_id === plant.id);

    console.log("  ✅ alreadyDiscovered:", alreadyDiscovered);

    let xpAwarded = 0;

    if (alreadyDiscovered) {
      xpAwarded = 5;
    } else {
      xpAwarded = getRarityXP(plant.rarity || "Häufig");
    }

    const newDiscovery = await base44.entities.UserPlantDiscovery.create({
      plant_id: plant.id,
      user: user.email,
      discovered_date: new Date().toISOString(),
      discovery_location: locationString,
      discovery_notes: "",
      image_url: imageUrl
    });

    setLatestDiscoveryId(newDiscovery.id);

    await awardXPToUser(xpAwarded);

    queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });

    const newlyUnlocked = await checkAndUnlockAchievements(user);
    if (newlyUnlocked.length > 0) {
      setNewAchievements(newlyUnlocked);
      setCurrentAchievementIndex(0);
    }

    await updateQuestProgress(plant);

    // Vibration: 1x kurz für erfolgreichen Scan
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    setMatchedPlant({
      ...plant,
      discovered: alreadyDiscovered,
      xpAwarded: xpAwarded,
      aiData: aiData
    });

    // Aktualisiere auch allScanResults mit discovered-Status
    setAllScanResults(prevResults => prevResults.map((result, index) => 
      index === 0 ? { ...result, discovered: alreadyDiscovered, xpAwarded } : result
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
        user: user.email,
        discovered_date: new Date().toISOString(),
        discovery_location: locationString,
        discovery_notes: "",
        image_url: imageUrl
      });

      setLatestDiscoveryId(newDiscovery.id);

      await awardXPToUser(50);

      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
      queryClient.invalidateQueries({ queryKey: ['plants'] });

      const newlyUnlocked = await checkAndUnlockAchievements(user);
      if (newlyUnlocked.length > 0) {
        setNewAchievements(newlyUnlocked);
        setCurrentAchievementIndex(0);
      }

      await updateQuestProgress(newPlant);

      // Vibration: 3x kurz für neuen PlantDex-Eintrag
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }

      setMatchedPlant({
        ...newPlant,
        discovered: false,
        xpAwarded: 50,
        aiData: plantData,
        isNewToPlantDex: true
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
    if (!pendingScanData) return;
    
    setIsSavingPlant(true);
    setShowConfirmDialog(false);
    
    try {
      // Wähle das aktuell ausgewählte Ergebnis
      const selectedPlant = pendingScanData.allResults[currentResultIndex] || pendingScanData.plant;
      const isInDatabase = selectedPlant.inDatabase;
      
      if (isInDatabase) {
        await handleAutoSave(selectedPlant, pendingScanData.imageUrl, selectedPlant.aiData || selectedPlant, pendingScanData.allResults);
      } else {
        await handleAutoAddNewPlant(selectedPlant, pendingScanData.imageUrl, pendingScanData.allResults);
      }
      setPendingScanData(null);
      setCurrentResultIndex(0);
      // Nach erfolgreichem Speichern zur Startseite navigieren
      navigate(createPageUrl("Home"));
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
    if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) {
          setAverageColor(color);
        }
      });
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url]);

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
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-6 h-6" />
              Pflanze hinzufügen?
            </DialogTitle>
            <DialogDescription className="text-base pt-4">
              Möchtest du <strong>{pendingScanData?.allResults?.[currentResultIndex]?.species_name || pendingScanData?.plant?.species_name}</strong> zu deiner Sammlung hinzufügen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={handleCancelSave}
            >
              Nein
            </Button>
            <Button 
              onClick={handleConfirmSave}
              className="bg-green-600 hover:bg-green-700"
            >
              Ja
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
                <p className="text-lg text-stone-600">
                  🔍 Suche im PlantDex...
                </p>
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