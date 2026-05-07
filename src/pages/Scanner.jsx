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
import ScanFeedbackNotification from "../components/notifications/ScanFeedbackNotification";
import { AnimatePresence, motion } from "framer-motion";

import MobileBackButton from "../components/navigation/MobileBackButton";
import { Check } from "lucide-react";
import { createPageUrl } from "@/utils";
import { cacheLocation, LOCATION_CACHE_MAX_AGE_MS, requestCurrentLocation } from "@/lib/locationSync";
import {
  grantRobotPlantRewardServerSide,
} from "@/api/robotPlantService";
import { ROBOT_PLANT_EVENT_SOURCES } from "@/lib/robotPlantConfig";
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
  const [showCamera, setShowCamera] = useState(true);
  const [user, setUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [showRateLimitDialog, setShowRateLimitDialog] = useState(false);
  const [pendingImageData, setPendingImageData] = useState(null);
  const [pendingScanData, setPendingScanData] = useState(null); // Temporäre Scan-Daten vor Bestätigung
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showBlockedResultDialog, setShowBlockedResultDialog] = useState(false);
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
  const [globalScanFeedback, setGlobalScanFeedback] = useState(null);
  const [guestScanFeedback, setGuestScanFeedback] = useState(null);
  const [showGuestRegisterDialog, setShowGuestRegisterDialog] = useState(false);
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

  const getUserLocation = async () => {
    setGettingLocation(true);
    if (!navigator.geolocation) {
      setGettingLocation(false);
      return;
    }

    try {
      const location = await requestUserLocation({
        maximumAge: LOCATION_CACHE_MAX_AGE_MS,
      });
      setUserLocation(location);
      cacheLocation(location);
    } catch (error) {
      console.error("Fehler beim Abrufen des Standorts:", error);
    } finally {
      setGettingLocation(false);
    }
  };

  const requestUserLocation = ({ maximumAge = LOCATION_CACHE_MAX_AGE_MS } = {}) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation wird von diesem Browser nicht unterstützt."));
        return;
      }

      requestCurrentLocation({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge,
      }).then(resolve).catch(reject);
    });
  };

  const getLocationString = (location) => {
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      return null;
    }
    return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  };

  const resolveCoordinatesForDiscovery = async ({ forceRefresh = false } = {}) => {
    if (!locationEnabled) {
      return null;
    }

    if (!forceRefresh && userLocation && typeof userLocation.lat === "number" && typeof userLocation.lng === "number") {
      return userLocation;
    }

    try {
      setGettingLocation(true);
      const freshLocation = await requestUserLocation({
        maximumAge: forceRefresh ? 0 : LOCATION_CACHE_MAX_AGE_MS,
      });
      setUserLocation(freshLocation);
      cacheLocation(freshLocation);
      return freshLocation;
    } catch (error) {
      console.warn("Standort konnte vor dem Speichern nicht ermittelt werden:", error);
      return null;
    } finally {
      setGettingLocation(false);
    }
  };

  const resolveLocationForDiscovery = async () => {
    const location = await resolveCoordinatesForDiscovery();
    return getLocationString(location);
  };

  const captureScanLocationSnapshot = async () => {
    const snapshot = await resolveCoordinatesForDiscovery({ forceRefresh: true });
    if (snapshot && Number.isFinite(snapshot.lat) && Number.isFinite(snapshot.lng)) {
      return {
        lat: Number(snapshot.lat),
        lng: Number(snapshot.lng),
        capturedAt: new Date().toISOString(),
      };
    }
    return null;
  };

  const getIsoDateKey = (value) => {
    if (!value) return null;
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }
    return parsedDate.toISOString().slice(0, 10);
  };

  const buildScanRewardFeedback = async ({ eventSource, duplicateScanCount, eventReference, location, rarity, isFirstScanOfDay = false }) => {
    if (!user?.id) {
      return {
        rewardDetails: null,
        activeZone: null,
        energyDelta: 0,
        dataQualityDelta: 0,
      };
    }

    const grantResult = await grantRobotPlantRewardServerSide({
      eventSource,
      eventReference,
      amount: 0,
      metadata: {
        duplicate_scan_count_client_hint: duplicateScanCount,
        rarity_client_hint: rarity,
        discovery_location_client_hint: getLocationString(location),
        is_first_scan_of_day_client_hint: isFirstScanOfDay,
      },
    });

    const rewardDetails = grantResult?.rewardDetails || null;
    const activeZone = rewardDetails?.isInActiveZone ? { serverComputed: true } : null;
    const energyDelta = Number(grantResult?.energyDelta ?? 0);
    const dataQualityDelta = Number(grantResult?.dataQualityDelta ?? 0);

    return { rewardDetails, activeZone, energyDelta, dataQualityDelta };
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
        avatar_url: userData.avatar_url,
        selected_face_asset: userData.selected_face_asset,
        selected_plant_asset: userData.selected_plant_asset,
        selected_border_asset: userData.selected_border_asset,
        selected_border_color: userData.selected_border_color
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
          const categoryCandidates = newPlant.category === "Blumen"
            ? ["Blumen", "Blumen & Kräuter"]
            : [newPlant.category];

          // Retry schützt vor Race Conditions bei parallelem Erstellen neuer Gattungen.
          for (let attempt = 0; attempt < 3 && !genus; attempt++) {
            const allGenera = await Query.PlantGenus.list();
            const categoryGenera = allGenera.filter((g) => categoryCandidates.includes(g.category));
            const highestNumber = Math.max(
              0,
              ...categoryGenera
                .map((g) => Number(g.category_dex_number || 0))
                .filter((value) => Number.isFinite(value))
            );

            try {
              genus = await createGenusMutation.mutateAsync({
                category_dex_number: highestNumber + 1,
                genus_name: newPlant.genus_name,
                scientific_genus: newPlant.scientific_genus,
                category: newPlant.category,
                family: newPlant.family,
                description: `Gattung der ${newPlant.category}`
              });
            } catch (createError) {
              const message = String(createError?.message || createError || "").toLowerCase();
              const isConflict = createError?.code === "23505" || message.includes("duplicate key");
              if (!isConflict || attempt === 2) {
                throw createError;
              }
            }
          }
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

  const updateScanningProgress = (phase) => {
    setScanningPhase(phase);
  };

  const identifyPlant = async (file, organ = "auto") => {
    setScanning(true);
    updateScanningProgress(0, "📦 Packe die Lupe aus und bereite dein Bild vor...");
    setMatchedPlant(null);
    setAllScanResults([]);
    setLatestDiscoveryId(null);

    try {
      const scanLocationSnapshot = await captureScanLocationSnapshot();

      console.log("📤 Starte Upload...");
      updateScanningProgress(0, "📦 Komprimiere Bild fuer eine schnelle Analyse...");
      const { file_url } = await uploadFile({ file });
      console.log("✅ Upload erfolgreich:", file_url);
      setImageUrl(file_url);

      console.log(`🌿 Starte Pflanzenerkennung mit organ: ${organ}...`);
      updateScanningProgress(1, "🌿 Sende den Fund an PlantNet...");

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

          updateScanningProgress(2, "📜 Sortiere Ergebnisse und gleiche sie mit dem Floralog ab...");
          await new Promise(resolve => setTimeout(resolve, 800));

          const normalizeString = (str) => {
            if (!str) return "";
            return str.toLowerCase().trim().replace(/\s+/g, ' ');
          };

          const totalResults = result.results.length;
          let completedResults = 0;

          const processedResults = await Promise.all(
            result.results.map(async (plantData, index) => {
              const iteration = { current: index + 1, total: totalResults };

              updateScanningProgress(
                3,
                `${iteration.current}/${iteration.total} - 📜 Pruefe Namen, Synonyme und Gattungen im Floralog...`,
                iteration
              );

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
                completedResults += 1;
                updateScanningProgress(
                  3,
                  `${completedResults}/${totalResults} - 📜 Kandidaten geprueft, ordne Ergebnisse...`,
                  { current: completedResults, total: totalResults }
                );
                return { ...match, aiData: plantData, inDatabase: true };
              } else {
                console.log("🆕 Nicht in Datenbank:", plantData.species_name);
                // Schritt 1: GBIF-Verteilung prüfen (ausschließliche Quelle für is_european)
                let distribution = null;
                let isEuropean = false;

                if (plantData.gbif_id) {
                  updateScanningProgress(
                    4,
                    `${iteration.current}/${iteration.total} - 🌍 Frage Verbreitungsdaten bei GBIF ab...`,
                    iteration
                  );
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

                // Wenn die GBIF-Anfrage komplett fehlschlug (kein Response-Objekt)
                if (!distribution) {
                  console.warn('❌ GBIF-Anfrage fehlgeschlagen – Scan wird abgelehnt');
                  completedResults += 1;
                  updateScanningProgress(
                    4,
                    `${completedResults}/${totalResults} - 🌍 Verteilungscheck abgeschlossen...`,
                    { current: completedResults, total: totalResults }
                  );
                  return { ...plantData, notInDex: true, inDatabase: false, metadata_failed: true };
                }

                // Wenn GBIF klar sagt „nicht europäisch" (inkl. keine Verbreitungsdaten vorhanden),
                // Pflanze anzeigen aber als nicht speicherbar markieren
                if (!isEuropean) {
                  completedResults += 1;
                  updateScanningProgress(
                    4,
                    `${completedResults}/${totalResults} - 🌍 Verteilungscheck abgeschlossen...`,
                    { current: completedResults, total: totalResults }
                  );
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
                  updateScanningProgress(
                    5,
                    `${iteration.current}/${iteration.total} - 📎 Frag Botaniker-KI nach weiteren Infos...`,
                    iteration
                  );

                  const { data, error } = await supabase.functions.invoke('generatePlantMetadata', {
                    body: {
                      species_name: plantData.species_name,
                      scientific_name: plantData.scientific_name,
                      language: 'de'
                    }
                  });

                  if (error || !data) {
                    console.error('Fehler beim Aufruf von generatePlantMetadata:', error);
                    completedResults += 1;
                    updateScanningProgress(
                      5,
                      `${completedResults}/${totalResults} - 📎 Botaniker-KI liefert letzte Details...`,
                      { current: completedResults, total: totalResults }
                    );
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

                  completedResults += 1;
                  updateScanningProgress(
                    5,
                    `${completedResults}/${totalResults} - 📎 Botaniker-KI liefert letzte Details...`,
                    { current: completedResults, total: totalResults }
                  );
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
                  completedResults += 1;
                  updateScanningProgress(
                    5,
                    `${completedResults}/${totalResults} - 📎 Botaniker-KI liefert letzte Details...`,
                    { current: completedResults, total: totalResults }
                  );
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

          updateScanningProgress(5);
          await new Promise(resolve => setTimeout(resolve, 800));

          const firstResult = processedResults[0];

          // Bei fehlenden Metadaten trotzdem Ergebnis anzeigen (nicht speicherbar), damit die UI konsistent bleibt
          if (firstResult && firstResult.metadata_failed) {
            console.warn('⚠️ Metadaten-Generierung fehlgeschlagen – zeige nicht speicherbares Ergebnis');
            setMatchedPlant(firstResult);
            setScanning(false);
            return;
          }

          // Alle Pflanzen (auch nicht-europäische) in pendingScanData legen;
          // nicht-europäische werden durch selectedResultBlocked gesperrt.
          if (firstResult) {
            const originLabel = firstResult.is_european === false ? "🌍 Nicht-europäische Pflanze" : "🌿 Pflanze";
            console.log(`${originLabel} erkannt - warte auf Bestätigung`);
            setPendingScanData({
              plant: firstResult,
              imageUrl: file_url,
              allResults: processedResults,
              isInDatabase: firstResult.inDatabase,
              scanLocationSnapshot,
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

  const handleAutoSave = async (plant, imageUrl, aiData, allResults = [], options = {}) => {
    const snapshot = options?.scanLocationSnapshot;
    const hasSnapshot = Number.isFinite(snapshot?.lat) && Number.isFinite(snapshot?.lng);
    const discoveryLocation = hasSnapshot
      ? { lat: Number(snapshot.lat), lng: Number(snapshot.lng) }
      : await resolveCoordinatesForDiscovery({ forceRefresh: true });
    const locationString = getLocationString(discoveryLocation);

    // Lade aktuelle Discoveries direkt von der DB, nicht vom Cache
    const currentDiscoveries = await Query.UserPlantDiscovery.filter({ auth_id: user.id });

    console.log("🔍 Überprüfe ob bereits entdeckt:");
    console.log("  plant.id:", plant.id);
    console.log("  plant.species_name:", plant.species_name);
    console.log("  Anzahl currentDiscoveries:", currentDiscoveries.length);
    console.log("  Plant IDs in Discoveries:", currentDiscoveries.map(d => d.plant_id));

    const alreadyDiscovered = currentDiscoveries.some((d) => d.plant_id === plant.id);
    const duplicateScanCount = currentDiscoveries.filter((d) => d.plant_id === plant.id).length;
    const eventSource = alreadyDiscovered
      ? ROBOT_PLANT_EVENT_SOURCES.scan
      : ROBOT_PLANT_EVENT_SOURCES.newScan;

    console.log("  ✅ alreadyDiscovered:", alreadyDiscovered);

    // Bestimme, ob dies der erste Scan des Tages ist
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const isFirstScanOfDay = !currentDiscoveries.some((d) => getIsoDateKey(d.discovered_date) === today);

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

    let rewardDetails = null;
    let activeZone = null;
    let energyDelta = 0;
    let dataQualityDelta = 0;
    try {
      const rewardFeedback = await buildScanRewardFeedback({
        eventSource,
        duplicateScanCount,
        eventReference: newDiscovery.id,
        location: discoveryLocation,
        rarity: plant?.rarity || aiData?.rarity || null,
        isFirstScanOfDay,
      });
      rewardDetails = rewardFeedback.rewardDetails;
      activeZone = rewardFeedback.activeZone;
      energyDelta = Number(rewardFeedback.energyDelta ?? 0);
      dataQualityDelta = Number(rewardFeedback.dataQualityDelta ?? 0);
    } catch (error) {
      console.error("Fehler bei Robot-Plant-Reward-Auszahlung:", error);
    }

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

    return { alreadyDiscovered, rewardDetails, activeZone, energyDelta, dataQualityDelta };
  };

  const handleAutoAddNewPlant = async (plantData, imageUrl, allResults = [], options = {}) => {
    const snapshot = options?.scanLocationSnapshot;
    const hasSnapshot = Number.isFinite(snapshot?.lat) && Number.isFinite(snapshot?.lng);
    const discoveryLocation = hasSnapshot
      ? { lat: Number(snapshot.lat), lng: Number(snapshot.lng) }
      : await resolveCoordinatesForDiscovery({ forceRefresh: true });
    const locationString = getLocationString(discoveryLocation);

    // Bestimme, ob dies der erste Scan des Tages ist
    const currentDiscoveriesForNewPlant = await Query.UserPlantDiscovery.filter({ auth_id: user.id });
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const isFirstScanOfDay = !currentDiscoveriesForNewPlant.some((d) => getIsoDateKey(d.discovered_date) === today);

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

      let rewardDetails = null;
      let activeZone = null;
      let energyDelta = 0;
      let dataQualityDelta = 0;
      try {
        const rewardFeedback = await buildScanRewardFeedback({
          eventSource: ROBOT_PLANT_EVENT_SOURCES.newGlobalScan,
          duplicateScanCount: 0,
          eventReference: newDiscoveryId,
          location: discoveryLocation,
          rarity: newPlant?.rarity || plantData?.rarity || null,
          isFirstScanOfDay,
        });
        rewardDetails = rewardFeedback.rewardDetails;
        activeZone = rewardFeedback.activeZone;
        energyDelta = Number(rewardFeedback.energyDelta ?? 0);
        dataQualityDelta = Number(rewardFeedback.dataQualityDelta ?? 0);
      } catch (rewardError) {
        console.error("Fehler bei Robot-Plant-Reward-Auszahlung fuer neue Global-Pflanze:", rewardError);
      }

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

      return { newPlant, rewardDetails, activeZone, energyDelta, dataQualityDelta };
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

  const handleBackToIntro = () => {
    setScanning(false);
    setMatchedPlant(null);
    setAllScanResults([]);
    setLatestDiscoveryId(null);
    setImageUrl(null);
    setPendingScanData(null);
    setCurrentResultIndex(0);
    setShowConfirmDialog(false);
    setShowRateLimitDialog(false);
    setShowCamera(false);
    setGuestScanFeedback(null);
    setShowGuestRegisterDialog(false);
  };

  const handleConfirmSave = async () => {
    if (!pendingScanData || isSavingPlant) return;

    if (selectedResultBlocked) {
      setShowBlockedResultDialog(true);
      return;
    }

    try {
      const { plant, imageUrl, allResults = [], scanLocationSnapshot = null } = pendingScanData;

      // Aktuell ausgewähltes Ergebnis bestimmen
      const selectedFromResults =
        allResults.length > 0
          ? allResults[currentResultIndex] || allResults[0]
          : null;

      const selectedPlant = selectedFromResults || plant;

      if (!selectedPlant) {
        throw new Error("Kein Scan-Ergebnis zum Speichern gefunden.");
      }

      if (!user?.id) {
        setShowConfirmDialog(false);
        setPendingScanData(null);
        setGuestScanFeedback({
          type: "newDiscovery",
          plantName: selectedPlant.species_name,
          isInActiveZone: true,
          rewardDetails: {
            baseReward: 12,
            preStreakReward: 18,
            finalReward: 18,
            healthStateLabel: "Preview",
            healthStateBonus: 0,
            zoneMultiplier: 1.5,
            rarityMultiplier: 1,
            noveltyMultiplier: 1,
            careMultiplier: 1,
            firstScanOfDayMultiplier: 1,
            streakMultiplier: 1,
          },
        });
        return;
      }

      setIsSavingPlant(true);

      if (selectedPlant.inDatabase) {
        // Pflanze existiert bereits im Floralog
        const { alreadyDiscovered, rewardDetails, activeZone, energyDelta, dataQualityDelta } = await handleAutoSave(
          selectedPlant,
          imageUrl,
          selectedPlant.aiData || plant?.aiData,
          allResults,
          { scanLocationSnapshot }
        );

        setShowConfirmDialog(false);
        setPendingScanData(null);

        navigate(createPageUrl("Home"), {
          state: {
            scanFeedback: {
              type: alreadyDiscovered ? "rescanned" : "newDiscovery",
              plantName: selectedPlant.species_name,
              rewardDetails,
              isInActiveZone: !!activeZone,
              energyDelta,
              dataQualityDelta,
            }
          }
        });
      } else {
        // Neue Pflanze für das globale Floralog
        try {
          const result = await handleAutoAddNewPlant(selectedPlant, imageUrl, allResults, { scanLocationSnapshot });

          if (result?.newPlant) {
            setGlobalScanFeedback({
              type: "globalNewPlant",
              plantName: result.newPlant.species_name,
              rewardDetails: result.rewardDetails,
              isInActiveZone: !!result.activeZone,
              energyDelta: Number(result.energyDelta ?? 0),
              dataQualityDelta: Number(result.dataQualityDelta ?? 0),
            });
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
      if (user?.id) {
        setIsSavingPlant(false);
      }
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

  const shouldTopAlignContent = !!matchedPlant || scanning;

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
      <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center" style={{minHeight:'100dvh',height:'100dvh',width:'100vw',overflow:'auto'}}>
        <div
          className="absolute inset-0"
          style={user?.background_image_url ? {
            backgroundImage: `url(${user.background_image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : user?.background_color ? {
            background: `linear-gradient(160deg, ${getRgbaFromRgb(user.background_color, 1)} 0%, ${getRgbaFromRgb(user.background_color, 0.55)} 100%)`,
          } : {
            background: averageColor
              ? `linear-gradient(135deg, var(--profile-bg-color-light) 0%, var(--profile-bg-color-mid) 50%, var(--profile-bg-color-dark) 100%)`
              : 'radial-gradient(circle at top, rgb(167, 243, 208) 0%, rgb(22, 101, 52) 60%, rgb(10, 30, 18) 100%)',
          }}
        />
        <div className="absolute inset-0 backdrop-blur-3xl" />
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-stone-100" style={{minHeight:'100dvh',height:'100dvh',width:'100vw',overflow:'auto'}}>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="w-full h-full flex flex-col items-center justify-center"
            style={{minHeight:'100dvh',height:'100dvh',width:'100vw',overflow:'auto'}}
          >
            <div className={`w-full min-h-full flex flex-col items-center ${shouldTopAlignContent ? 'justify-start py-4' : 'justify-center'}`}>
      {/* Grüner Haken / Ändern Button - nur wenn pendingScanData vorhanden */}
      {pendingScanData && !isSavingPlant && (
        <ConfirmButton 
          onConfirm={() => !selectedResultBlocked && setShowConfirmDialog(true)}
          disabled={selectedResultBlocked}
        />
      )}
      
      {/* Bestätigungs-Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => !isSavingPlant && setShowConfirmDialog(open)}>
        <DialogContent className="sm:max-w-md overflow-hidden rounded-3xl border border-[#f0e5a5]/35 bg-black/40 backdrop-blur-xl text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]" onInteractOutside={(e) => isSavingPlant && e.preventDefault()}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-emerald-950/20 to-black/45 pointer-events-none" />
          <div className="absolute inset-0 border border-[#f0e5a5]/25 rounded-3xl pointer-events-none" />
          <div className="relative z-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-300">
              {isSavingPlant ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
              {isSavingPlant ? "Wird gespeichert..." : "Pflanze hinzufügen?"}
            </DialogTitle>
            {!isSavingPlant && (
              <DialogDescription className="text-base pt-4 text-stone-200">
                {selectedResultBlocked ? (
                  <span>
                    <strong>{selectedPendingResult?.species_name || "Dieser Vorschlag"}</strong> kann nicht gespeichert werden –
                    {selectedPendingResult?.notInDex && selectedPendingResult?.is_european === false
                      ? " diese Pflanze kommt nicht in europäischen Ökosystemen vor. Floralog sammelt nur Pflanzen, die in Europa heimisch oder dauerhaft eingebürgert sind."
                      : " Pflanzendaten oder Verbreitungsinformationen sind unvollständig. Versuche es mit einem klareren Foto erneut."}
                    {" "}Wähle ein anderes Ergebnis oder scanne erneut.
                  </span>
                ) : (
                  <span>
                    Möchtest du <strong>{pendingScanData?.allResults?.[currentResultIndex]?.species_name || pendingScanData?.plant?.species_name}</strong> zu deiner Sammlung hinzufügen?
                  </span>
                )}
              </DialogDescription>
            )}
            {isSavingPlant && (
              <DialogDescription className="text-base pt-4 text-center text-stone-200">
                <p>Die Pflanze wird gespeichert und Quest-Fortschritte werden aktualisiert...</p>
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={handleCancelSave}
              disabled={isSavingPlant}
              className="border-[#f0e5a5]/35 bg-black/35 text-stone-100 hover:bg-black/55"
            >
              Nein
            </Button>
            <Button 
              onClick={handleConfirmSave}
              disabled={isSavingPlant || selectedResultBlocked}
              className="border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 hover:brightness-110 disabled:opacity-50"
            >
              {isSavingPlant ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Ja
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuestRegisterDialog} onOpenChange={setShowGuestRegisterDialog}>
        <DialogContent className="sm:max-w-md overflow-hidden rounded-3xl border border-[#f0e5a5]/35 bg-black/40 backdrop-blur-xl text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-emerald-950/20 to-black/45 pointer-events-none" />
          <div className="absolute inset-0 border border-[#f0e5a5]/25 rounded-3xl pointer-events-none" />
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-300">
                <Sparkles className="w-6 h-6" />
                Speichere deine Entdeckung
              </DialogTitle>
              <DialogDescription className="text-base pt-4 text-stone-200">
                Du hast eine Pflanze gefunden. Erstelle ein kostenloses Konto, damit sie Teil deiner Sammlung wird und deine Pflanze weiter wachsen kann.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowGuestRegisterDialog(false)}
                className="border-[#f0e5a5]/35 bg-black/35 text-stone-100 hover:bg-black/55"
              >
                Spaeter
              </Button>
              <Button
                onClick={() => navigate(createPageUrl("Register"))}
                className="border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 hover:brightness-110"
              >
                Kostenlos registrieren
              </Button>
              <Button
                onClick={() => navigate(createPageUrl("Login"))}
                className="border border-[#f0e5a5]/35 bg-black/35 hover:bg-black/55"
              >
                Anmelden
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blockiertes Ergebnis Dialog */}
      <Dialog open={showBlockedResultDialog} onOpenChange={setShowBlockedResultDialog}>
        <DialogContent className="sm:max-w-md overflow-hidden rounded-3xl border border-[#f0e5a5]/35 bg-black/40 backdrop-blur-xl text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-red-950/20 to-black/45 pointer-events-none" />
          <div className="absolute inset-0 border border-[#f0e5a5]/25 rounded-3xl pointer-events-none" />
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-300">
                <AlertTriangle className="w-6 h-6 text-red-300" />
                Ergebnis nicht speicherbar
              </DialogTitle>
              <DialogDescription className="text-base pt-4 text-stone-200">
                {selectedPendingResult?.notInDex && selectedPendingResult?.is_european === false
                  ? `${selectedPendingResult?.species_name || "Diese Pflanze"} kommt nicht in europäischen Ökosystemen vor und kann daher nicht ins Floralog aufgenommen werden. Floralog sammelt Pflanzen, die in Europa heimisch oder dauerhaft eingebürgert sind.`
                  : "Dieser Vorschlag kann nicht gespeichert werden, da Pflanzendaten oder Verbreitungsinformationen unvollständig sind. Bitte wähle ein anderes Ergebnis oder scanne erneut mit einem klareren Foto."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => setShowBlockedResultDialog(false)}
                className="w-full border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 hover:brightness-110"
              >
                Verstanden
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Globales Floralog erweitert Dialog */}
      <Dialog open={showGlobalFloralogModal} onOpenChange={(open) => {
        if (!open) {
          setShowGlobalFloralogModal(false);
          navigate(createPageUrl("Home"), {
            state: {
              scanFeedback: globalScanFeedback || {
                type: "globalNewPlant",
                plantName: newPlantName,
              }
            }
          });
        }
      }}>
        <DialogContent className="sm:max-w-md overflow-hidden rounded-3xl border border-[#f0e5a5]/35 bg-black/40 backdrop-blur-xl text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-emerald-950/20 to-black/45 pointer-events-none" />
          <div className="absolute inset-0 border border-[#f0e5a5]/25 rounded-3xl pointer-events-none" />
          <div className="relative z-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-300">
              <Sparkles className="w-6 h-6 text-amber-300" />
              Globales Floralog erweitert!
            </DialogTitle>
            <DialogDescription className="text-base pt-4 space-y-3 text-stone-200">
              <p className="font-semibold text-emerald-300">
                🌟 Glückwunsch!
              </p>
              <p>
                Du hast mit <strong>{newPlantName}</strong> eine neue Pflanze zum globalen Floralog hinzugefügt!
              </p>
              <p className="text-sm text-stone-300">
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
                    scanFeedback: globalScanFeedback || {
                      type: "globalNewPlant",
                      plantName: newPlantName,
                    }
                  }
                });
              }}
              className="w-full border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 hover:brightness-110"
            >
              Verstanden
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Rate-Limit Dialog */}
      <Dialog open={showRateLimitDialog} onOpenChange={setShowRateLimitDialog}>
        <DialogContent className="sm:max-w-md overflow-hidden rounded-3xl border border-[#f0e5a5]/35 bg-black/40 backdrop-blur-xl text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-amber-950/20 to-black/45 pointer-events-none" />
          <div className="absolute inset-0 border border-[#f0e5a5]/25 rounded-3xl pointer-events-none" />
          <div className="relative z-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="w-6 h-6 text-amber-300" />
              PlantNet nicht verfügbar
            </DialogTitle>
            <DialogDescription className="text-base pt-4 text-stone-200">
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
              className="border-[#f0e5a5]/35 bg-black/35 text-stone-100 hover:bg-black/55"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleLLMFallback}
              className="border border-amber-200/35 bg-gradient-to-r from-amber-700/80 via-amber-500/70 to-amber-700/80 hover:brightness-110"
            >
              Scannen
            </Button>
          </DialogFooter>
          </div>
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

      <AnimatePresence>
        {guestScanFeedback && (
          <ScanFeedbackNotification
            feedback={guestScanFeedback}
            onComplete={() => {
              setGuestScanFeedback(null);
              setShowGuestRegisterDialog(true);
            }}
          />
        )}
      </AnimatePresence>


      <div className="w-full">
        {!scanning && !matchedPlant && (
          <Card className="overflow-hidden rounded-3xl border border-[#f0e5a5]/30 bg-black/25 backdrop-blur-sm shadow-[0_18px_42px_rgba(0,0,0,0.42)]">
            <CardContent className="p-6 md:p-8 bg-gradient-to-b from-black/30 via-emerald-950/15 to-black/35">
              {showCamera ? (
                <CameraCapture
                  onCapture={handleCameraCapture}
                  onClose={() => setShowCamera(false)}
                />
              ) : (
                <button
                  onClick={() => setShowCamera(true)}
                  className="w-full group relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md border border-[#f0e5a5]/35 p-8 hover:bg-black/50 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg border border-lime-200/30">
                      <Camera className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2 text-stone-100">Foto aufnehmen</h3>
                    <p className="text-stone-200/85 text-base">Mit der Kamera scannen</p>
                  </div>
                </button>
              )}
            </CardContent>
          </Card>
        )}

        {scanning &&
        <Card 
          className="overflow-hidden rounded-3xl border border-[#f0e5a5]/30 bg-black/25 backdrop-blur-sm shadow-[0_18px_42px_rgba(0,0,0,0.42)]"
        >
            <CardContent className="p-12 bg-gradient-to-b from-black/30 via-emerald-950/15 to-black/35">
              <div className="flex flex-col items-center bg-black/40 backdrop-blur-md rounded-2xl p-8 border border-[#f0e5a5]/30">
                <Loader2 className="w-16 h-16 text-emerald-300 animate-spin mb-4" />
                <h3 className="text-2xl font-bold text-stone-100 mb-2">
                  Pflanze wird analysiert...
                </h3>
                <div className="text-center">
                  <p className="text-lg text-emerald-200 font-semibold transition-all duration-300">
                    {scanningPhase === 0 && '📦 Komprimiere Bild...'}
                    {scanningPhase === 1 && '📸 Lasse das Bild über PlantNet-API analysieren...'}
                    {scanningPhase === 2 && '📜 Überprüfe Ergebnis mit globalem Floralog...'}
                    {scanningPhase === 3 && '🌍 Überprüfe Verteilung...'}
                    {scanningPhase === 4 && '🧠 Frage einen KI-Botaniker...'}
                    {scanningPhase === 5 && '📚 Vergleiche das Ergebnis mit deinem Floralog...'}
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
            onRescan={handleBackToIntro}
            onBackToIntro={handleBackToIntro}
            onResultIndexChange={setCurrentResultIndex}
            userLocation={userLocation}
            allResults={allScanResults}
            onDeleteResult={handleDeleteResult}
            onChangeResult={handleChangeResult}
            latestDiscoveryId={latestDiscoveryId}
            isPendingConfirmation={!!pendingScanData} />

          </div>
        }
      </div>
      </div>
      </motion.div>
      </div>
      </div>
    </>);

}



