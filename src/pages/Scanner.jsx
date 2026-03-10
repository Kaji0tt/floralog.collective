import { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { upsertUserProfile } from "@/api/authService";
import { uploadFile } from "@/api/storage";
import { supabase } from "@/api/supabaseClient";
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
import { Check } from "lucide-react";
import { createPageUrl } from "@/utils";
import { updateQuestProgress } from "@/components/utils/questProgress";
const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

// Bestätigungs-Button Komponente (draggable wie MobileBackButton)
function ConfirmButton({ onConfirm, disabled = false }) {
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
        disabled={disabled}
        className={`w-16 h-16 shadow-lg border-2 border-white text-white rounded-full cursor-move bg-green-600 hover:bg-green-700 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <Check className="w-8 h-8" />
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
  const selectedPendingResult = pendingScanData?.allResults?.[currentResultIndex] || pendingScanData?.plant || null;
  const selectedResultBlocked = !!selectedPendingResult && (
    selectedPendingResult.metadata_failed === true ||
    (selectedPendingResult.notInDex && selectedPendingResult.is_european === false)
  );

  const [showGlobalFloralogModal, setShowGlobalFloralogModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
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
    queryFn: () => Query.Plant.list()
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list()
  });

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ['userDiscoveries', user?.id],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => Query.MonthlyQuest.list('quest_number')
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => Query.WeeklyQuest.list('quest_number')
  });

  const { data: userMonthlyQuests = [] } = useQuery({
    queryKey: ['userMonthlyQuests', user?.id],
    queryFn: () => Query.UserMonthlyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => Query.Quest.list('quest_number')
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests', user?.id],
    queryFn: () => Query.UserQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ['userWeeklyQuests', user?.id],
    queryFn: () => Query.UserWeeklyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const updatePlantMutation = useMutation({
    mutationFn: ({ id, data }) => Query.Plant.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    }
  });

  const createPlantMutation = useMutation({
    mutationFn: (data) => Query.Plant.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    }
  });

  const createGenusMutation = useMutation({
    mutationFn: (data) => Query.PlantGenus.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genera'] });
    }
  });

  const deleteDiscoveryMutation = useMutation({
    mutationFn: (discoveryId) => Query.UserPlantDiscovery.delete(discoveryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
    }
  });

  const updateDiscoveryMutation = useMutation({
    mutationFn: ({ discoveryId, data }) => Query.UserPlantDiscovery.update(discoveryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
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
        avatar_url: userData.avatar_url
      };

      await upsertUserProfile(userData.id, profileData);
    } catch (error) {
      console.error("PublicProfile Update Fehler:", error);
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
          const allGenera = await Query.PlantGenus.list();

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
      const { file_url } = await uploadFile({ file });
      console.log("✅ Upload erfolgreich:", file_url);
      setImageUrl(file_url);

      console.log(`🌿 Starte Pflanzenerkennung mit organ: ${organ}...`);
      setScanningPhase(1); // PlantNet-API analysiert

      try {
        const response = await supabase.functions.invoke('identifyPlant', {
          body: {
            image_url: file_url,
            organ: organ
          }
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
                // Schritt 1: GBIF-Verteilung prüfen (ausschließliche Quelle für is_european)
                let distribution = null;
                let isEuropean = false;

                if (plantData.gbif_id) {
                  try {
                    const { data: distData, error: distError } = await supabase.functions.invoke('checkPlantDistribution', {
                      body: {
                        gbifId: plantData.gbif_id,
                        // Perspektivisch können hier weitere Regionen ergänzt werden
                        // regions: ['EUROPE', 'MEDITERRANEAN', 'NEAR_EAST'],
                      }
                    });

                    if (distError || !distData) {
                      console.error('Fehler beim Aufruf von checkPlantDistribution:', distError);
                    } else {
                      distribution = distData;
                      isEuropean = distData.is_european === true;
                    }
                  } catch (e) {
                    console.error('Fehler beim Aufruf von checkPlantDistribution:', e);
                  }
                } else {
                  console.warn('Kein gbif_id im PlantNet-Ergebnis vorhanden – kann Verteilung nicht prüfen');
                }

                // Wenn keine oder zu wenige GBIF-Daten vorhanden sind, lehnen wir den Scan ab
                if (!distribution || typeof distribution.totalCount !== 'number' || distribution.totalCount === 0) {
                  console.warn('❌ Keine ausreichenden GBIF-Daten verfügbar – Scan wird abgelehnt');
                  return { ...plantData, notInDex: true, inDatabase: false, metadata_failed: true };
                }

                // Wenn GBIF klar sagt „nicht europäisch“, nur zur Anzeige freigeben
                if (!isEuropean) {
                  return {
                    ...plantData,
                    notInDex: true,
                    inDatabase: false,
                    is_european: false,
                    distribution,
                  };
                }

                // Schritt 2: Metadaten (Beschreibung, Merkmale, Fun Fact, Seltenheit) über LLM erzeugen
                // WICHTIG: is_european aus dem LLM wird ignoriert, GBIF ist alleinige Quelle.
                try {
                  const { data, error } = await supabase.functions.invoke('generatePlantMetadata', {
                    body: {
                      species_name: plantData.species_name,
                      scientific_name: plantData.scientific_name,
                      language: 'de'
                    }
                  });

                  if (error || !data) {
                    console.error('Fehler beim Aufruf von generatePlantMetadata:', error);
                    return {
                      ...plantData,
                      notInDex: true,
                      inDatabase: false,
                      metadata_failed: true,
                      is_european: isEuropean,
                      distribution,
                    };
                  }

                  const meta = data;
                  const identificationText = Array.isArray(meta.identification_features)
                    ? meta.identification_features.join(' ')
                    : meta.identification_features;

                  return {
                    ...plantData,
                    description: meta.description || plantData.description,
                    identification_features: identificationText || plantData.identification_features,
                    fun_fact: meta.fun_fact || plantData.fun_fact,
                    rarity: meta.rarity || plantData.rarity || 'Gelegentlich',
                    genus_name: meta.genus_name || plantData.genus_name,
                    category: meta.category || plantData.category,
                    notInDex: true,
                    inDatabase: false,
                    is_european: isEuropean,
                    distribution,
                  };
                } catch (e) {
                  console.error('Fehler beim Generieren der Vorschau-Metadaten:', e);
                  return {
                    ...plantData,
                    notInDex: true,
                    inDatabase: false,
                    metadata_failed: true,
                    is_european: isEuropean,
                    distribution,
                  };
                }
              }
            })
          );

          setAllScanResults(processedResults);

          setScanningPhase(3); // Vergleiche mit deinem Floralog
          await new Promise(resolve => setTimeout(resolve, 800));

          const firstResult = processedResults[0];

          // Wenn die Metadaten-Generierung fehlgeschlagen ist, Scan klar ablehnen
          if (firstResult && firstResult.metadata_failed) {
            console.warn('❌ Metadaten-Generierung fehlgeschlagen – Scan wird abgelehnt');
            setMatchedPlant({
              identified: false,
              error:
                'Die Pflanze konnte nicht in einen sinnvollen Kontext gesetzt werden. Bitte versuche es später erneut oder mit einem anderen Foto.',
            });
            setScanning(false);
            return;
          }

          // KORRIGIERTE LOGIK: Prüfe zuerst ob nicht-europäisch, dann ob in Datenbank
          if (firstResult && firstResult.is_european === false) {
            // Nicht-europäische Pflanze - nur anzeigen, nicht speichern
            console.log("🌍 Nicht-europäische Pflanze erkannt - nur Anzeige");
            setMatchedPlant(firstResult);
            setScanning(false);
          } else if (firstResult) {
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
          } else {
            // Sicherheitsfallback: Kein valides Ergebnis vorhanden
            console.warn('❌ Kein valides Scan-Ergebnis nach Verarbeitung vorhanden');
            setMatchedPlant({
              identified: false,
              error:
                'Die Pflanze konnte nicht in einen sinnvollen Kontext gesetzt werden. Bitte versuche es später erneut oder mit einem anderen Foto.',
            });
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
    const currentDiscoveries = await Query.UserPlantDiscovery.filter({ auth_id: user.id });

    console.log("🔍 Überprüfe ob bereits entdeckt:");
    console.log("  plant.id:", plant.id);
    console.log("  plant.species_name:", plant.species_name);
    console.log("  Anzahl currentDiscoveries:", currentDiscoveries.length);
    console.log("  Plant IDs in Discoveries:", currentDiscoveries.map(d => d.plant_id));

    const alreadyDiscovered = currentDiscoveries.some((d) => d.plant_id === plant.id);

    console.log("  ✅ alreadyDiscovered:", alreadyDiscovered);

    const newDiscovery = await Query.UserPlantDiscovery.create({
      auth_id: user.id,
      created_by_id: user.id,
      created_by: user.email,
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

    // Quest-Progress zentral anhand aller Entdeckungen aktualisieren
    await updateQuestProgress(user);

    // Prüfe zufällige Rewards
    const { checkRandomRewards } = await import('../components/rewards/randomRewardChecker');
    await checkRandomRewards(user, 'scan');

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

    return { alreadyDiscovered };
  };

  const handleAutoAddNewPlant = async (plantData, imageUrl, allResults = []) => {
    let locationString = null;
    if (userLocation) {
      locationString = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
    }

    try {
      const { data, error } = await supabase.functions.invoke('createGlobalPlant', {
        body: {
          plant: {
            species_name: plantData.species_name,
            scientific_name: plantData.scientific_name,
            genus_name: plantData.genus_name,
            scientific_genus: plantData.scientific_genus,
            category: plantData.category,
            family: plantData.family,
            description: plantData.description,
            identification_features: plantData.identification_features,
            fun_fact: plantData.fun_fact,
            rarity: plantData.rarity || "Gelegentlich"
          },
          image_url: imageUrl,
          discovery_location: locationString
        }
      });

      if (error) {
        console.error("Fehler beim Aufruf von createGlobalPlant:", error);
        throw error;
      }

      const newPlant = data?.newPlant;
      const newDiscoveryId = data?.newDiscoveryId;

      if (!newPlant || !newDiscoveryId) {
        throw new Error("Unerwartete Antwort von createGlobalPlant");
      }

      setLatestDiscoveryId(newDiscoveryId);

      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
      queryClient.invalidateQueries({ queryKey: ['plants'] });

      const newlyUnlocked = await checkAndUnlockAchievements(user);
      if (newlyUnlocked.length > 0) {
        setNewAchievements(newlyUnlocked);
        setCurrentAchievementIndex(0);
      }

      // Quest-Progress zentral anhand aller Entdeckungen aktualisieren
      await updateQuestProgress(user);

      // Prüfe zufällige Rewards
      const { checkRandomRewards } = await import('../components/rewards/randomRewardChecker');
      await checkRandomRewards(user, 'scan');

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

      return { newPlant };
    } catch (error) {
      console.error("Fehler beim Hinzufügen der Pflanze:", error);
      setScanning(false);
      throw error;
    }
  };

  const handleCameraCapture = (file, organ = "auto") => {
    setShowCamera(false);
    identifyPlant(file, organ);
  };

  const handleLLMFallback = () => {
    setShowRateLimitDialog(false);
    setPendingImageData(null);
    setScanning(false);
    alert("Die KI-Notfall-Erkennung ist aktuell nicht konfiguriert. Bitte versuche es spaeter erneut.");
  };

  const handleCancelSave = () => {
    setShowConfirmDialog(false);
    setPendingScanData(null);
    setMatchedPlant(null);
    setAllScanResults([]);
    setImageUrl(null);
  };

  const handleConfirmSave = async () => {
    if (!pendingScanData || isSavingPlant) return;

    if (selectedResultBlocked) {
      alert("Dieser Vorschlag kann nicht gespeichert werden. Bitte waehle ein anderes Ergebnis oder scanne erneut.");
      return;
    }

    setIsSavingPlant(true);

    try {
      const { plant, imageUrl, allResults = [] } = pendingScanData;

      // Aktuell ausgewähltes Ergebnis bestimmen
      const selectedFromResults =
        allResults.length > 0
          ? allResults[currentResultIndex] || allResults[0]
          : null;

      const selectedPlant = selectedFromResults || plant;

      if (!selectedPlant) {
        throw new Error("Kein Scan-Ergebnis zum Speichern gefunden.");
      }

      if (selectedPlant.inDatabase) {
        // Pflanze existiert bereits im Floralog
        const { alreadyDiscovered } = await handleAutoSave(
          selectedPlant,
          imageUrl,
          selectedPlant.aiData || plant?.aiData,
          allResults
        );

        setShowConfirmDialog(false);
        setPendingScanData(null);

        navigate(createPageUrl("Home"), {
          state: {
            scanFeedback: {
              type: alreadyDiscovered ? "rescanned" : "newDiscovery",
              plantName: selectedPlant.species_name
            }
          }
        });
      } else {
        // Neue Pflanze für das globale Floralog
        try {
          const result = await handleAutoAddNewPlant(selectedPlant, imageUrl, allResults);

          if (result?.newPlant) {
            setShowGlobalFloralogModal(true);

            setShowConfirmDialog(false);
            setPendingScanData(null);
          } else {
            alert("Die Pflanze konnte nicht zum globalen Floralog hinzugefügt werden. Bitte versuche es später erneut.");
          }
        } catch (error) {
          console.error("Fehler beim automatischen Hinzufügen zum Floralog:", error);
          alert("Die Pflanze konnte nicht zum globalen Floralog hinzugefügt werden. Bitte versuche es später erneut.");
        }
      }
    } catch (error) {
      console.error("Fehler beim Bestätigen des Speicherns:", error);
      alert("Fehler beim Speichern der Pflanze. Bitte versuche es erneut.");
    } finally {
      setIsSavingPlant(false);
    }
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
          onConfirm={() => !selectedResultBlocked && setShowConfirmDialog(true)}
          disabled={selectedResultBlocked}
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
                {selectedResultBlocked ? (
                  <span>
                    <strong>{selectedPendingResult?.species_name || "Dieser Vorschlag"}</strong> kann nicht gespeichert werden,
                    weil er nicht in den Sammelbereich passt oder unvollständige Metadaten hat.
                  </span>
                ) : (
                  <span>
                    Möchtest du <strong>{pendingScanData?.allResults?.[currentResultIndex]?.species_name || pendingScanData?.plant?.species_name}</strong> zu deiner Sammlung hinzufügen?
                  </span>
                )}
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
              disabled={isSavingPlant || selectedResultBlocked}
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
          navigate(createPageUrl("Home"), {
            state: {
              scanFeedback: {
                type: "globalNewPlant",
                plantName: newPlantName
              }
            }
          });
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
                navigate(createPageUrl("Home"), {
                  state: {
                    scanFeedback: {
                      type: "globalNewPlant",
                      plantName: newPlantName
                    }
                  }
                });
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
              Eine alternative KI-Erkennung ist aktuell nicht konfiguriert.
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



