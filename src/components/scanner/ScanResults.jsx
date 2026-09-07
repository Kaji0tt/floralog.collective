import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RotateCcw, Volume2, VolumeX, Sparkles, ChevronLeft, ChevronRight, Search, Check, Loader2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, useMotionValue, useTransform } from "framer-motion";
// import ShareScanDialog from "./ShareScanDialog";
import { Query } from "@/api/entities";
import SpeciesInfoCard from "@/components/collection/SpeciesInfoCard";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import ThreatLevelSparks from "@/components/effects/ThreatLevelSparks";
import {
  getConservationFromPlant,
} from "@/lib/conservationStatus";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import {
  getRarityBorderClass,
  getRarityGlowColor,
  getRarityReflectionColor,
  getRarityScanBackgroundClass,
  getRarityAnimationClass,
  getRarityGlowBorderClass,
  getRarityLevelFromLabel,
  computeRarityLabel,
} from "@/lib/plantRarity";

export default function ScanResults({
  plant,
  imageUrl,
  scanImageUrls = [],
  onRescan,
  onBackToIntro,
  isSaving,
  userLocation,
  allResults = [],
  onDeleteResult,
  onChangeResult,
  onAddSupplementaryPhoto,
  canAddSupplementaryPhoto = true,
  maxScanImages = 5,
  currentUserId,
  latestDiscoveryId,
  isPendingConfirmation = false,
  onResultIndexChange,
  onConfirmSave,
  isSavingPlant = false,
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [genera, setGenera] = useState([]);
  // Share-Dialog State entfernt, solange kein Dialog existiert
  const [discovery, setDiscovery] = useState(null);
  const x = useMotionValue(0);
  const constraintsRef = useRef(null);
  const cardRef = useRef(null);
  const playerButtonRefs = useRef([]);

  useEffect(() => {
    const loadGenera = async () => {
      const genusRows = await Query.PlantGenus.list();
      setGenera(genusRows || []);
    };

    loadGenera();
  }, []);

  useEffect(() => {
    const loadDiscovery = async () => {
      if (!latestDiscoveryId) return;
      const discoveries = await Query.UserPlantDiscovery.list();
      const found = discoveries.find((d) => d.id === latestDiscoveryId);
      setDiscovery(found);
    };
    loadDiscovery();

  }, [latestDiscoveryId]);

  // Wenn allResults leer ist, aber plant vorhanden ist, nutze plant als einziges Ergebnis
  const results = allResults.length > 0 ? allResults : plant ? [plant] : [];
  const currentPlant = results[currentResultIndex] || plant;

  const [logoAssetsCatalog, setLogoAssetsCatalog] = useState([]);
  const [communityState, setCommunityState] = useState({ loading: false, otherPlayers: [], ownProfile: null });
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);

  useEffect(() => {
    Query.LogoAsset.list().then(setLogoAssetsCatalog).catch(() => setLogoAssetsCatalog([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setActivePlayerIndex(0);

    // Community-Scans nur moeglich, wenn die aktuell angezeigte Art bereits im Floralog existiert.
    if (!currentPlant?.id) {
      setCommunityState({ loading: false, otherPlayers: [], ownProfile: null });
      return () => { cancelled = true; };
    }

    const loadCommunityScans = async () => {
      setCommunityState((prev) => ({ ...prev, loading: true }));
      try {
        const [discoveries, publicProfiles] = await Promise.all([
          Query.UserPlantDiscovery.filter({ plant_id: currentPlant.id }),
          Query.PublicProfile.list(),
        ]);

        const profileByAuthId = new Map(
          (publicProfiles || []).filter((p) => p?.auth_id).map((p) => [p.auth_id, p])
        );
        const ownProfile = currentUserId ? profileByAuthId.get(currentUserId) || null : null;

        const discoveriesByAuthId = {};
        (discoveries || []).forEach((d) => {
          if (!d?.auth_id || !d?.image_url) return;
          const profile = profileByAuthId.get(d.auth_id);
          const isSelf = d.auth_id === currentUserId;
          const isPublic = profile?.public_profile !== false;
          if (isSelf || !isPublic) return;
          if (!discoveriesByAuthId[d.auth_id]) discoveriesByAuthId[d.auth_id] = [];
          discoveriesByAuthId[d.auth_id].push(d);
        });

        const otherPlayers = Object.entries(discoveriesByAuthId)
          .map(([authId, discs]) => {
            const profile = profileByAuthId.get(authId);
            const sortedDiscs = [...discs].sort(
              (a, b) => new Date(b.discovered_date || b.created_date || 0) - new Date(a.discovered_date || a.created_date || 0)
            );
            // Alle Fotos aller Funde dieser Art (Haupt- + Zusatzfotos je Fund) zu einem Stack zusammenfassen.
            const images = sortedDiscs.flatMap((d) =>
              [d?.image_url, ...(Array.isArray(d?.additional_image_urls) ? d.additional_image_urls : [])].filter(Boolean)
            );
            return {
              authId,
              isOwn: false,
              name: profile?.display_name || profile?.full_name || profile?.user_email || "Spieler",
              logoAssets: resolveEquippedLogoAssetsWithCatalog(profile || {}, logoAssetsCatalog),
              images,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "de"));

        if (!cancelled) {
          setCommunityState({ loading: false, otherPlayers, ownProfile });
        }
      } catch (error) {
        console.error("Fehler beim Laden der Community-Scans:", error);
        if (!cancelled) setCommunityState({ loading: false, otherPlayers: [], ownProfile: null });
      }
    };

    loadCommunityScans();
    return () => { cancelled = true; };
  }, [currentPlant?.id, currentUserId, logoAssetsCatalog]);

  const ownImages = scanImageUrls.length > 0 ? scanImageUrls : (imageUrl ? [imageUrl] : []);
  const players = [
    {
      authId: currentUserId || "self",
      isOwn: true,
      name: "Du",
      logoAssets: resolveEquippedLogoAssetsWithCatalog(communityState.ownProfile || {}, logoAssetsCatalog),
      images: ownImages,
    },
    ...communityState.otherPlayers,
  ];
  const safeActivePlayerIndex = Math.min(activePlayerIndex, players.length - 1);
  const activePlayer = players[safeActivePlayerIndex] || players[0];
  const activePlayerImages = activePlayer?.images || [];
  const hasMultiplePlayers = players.length > 1;

  useEffect(() => {
    if (!hasMultiplePlayers) return;
    playerButtonRefs.current[safeActivePlayerIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [hasMultiplePlayers, safeActivePlayerIndex]);

  const currentGenusId = genera.find(
    (genus) =>
      genus.category === currentPlant?.genus_category &&
      genus.category_dex_number === currentPlant?.genus_number
  )?.id || null;



  const hasMultipleResults = results.length > 1;
  const isPrimaryResult = currentResultIndex === 0;

  const scale = useTransform(x, [-200, -100, 0, 100, 200], [0.85, 0.95, 1, 0.95, 0.85]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (event, info) => {
    const threshold = 100;

    if (info.offset.x > threshold && activePlayerIndex > 0) {
      setActivePlayerIndex(activePlayerIndex - 1);
    } else if (info.offset.x < -threshold && activePlayerIndex < players.length - 1) {
      setActivePlayerIndex(activePlayerIndex + 1);
    }
  };

  const handleResultIndexChange = (newIndex) => {
    setCurrentResultIndex(newIndex);
    if (onResultIndexChange) onResultIndexChange(newIndex);
  };

  const handleVerifyResult = () => {
    const searchQuery = encodeURIComponent(currentPlant.species_name + " " + currentPlant.scientific_name);
    window.open(`https://www.google.com/search?tbm=isch&q=${searchQuery}`, '_blank');
  };

  const handleDeleteResult = async () => {
    if (!latestDiscoveryId) return;

    if (confirm(`Möchtest du diesen Scan wirklich löschen und neu scannen?\n\n"${currentPlant.species_name}" wird aus deiner Sammlung entfernt.`)) {
      setIsDeleting(true);
      try {
        await onDeleteResult(latestDiscoveryId);
        onRescan();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleChangeResult = async () => {
    if (!latestDiscoveryId || !currentPlant) return;

    if (confirm(`Möchtest du die Entdeckung wirklich auf "${currentPlant.species_name}" ändern?`)) {
      setIsChanging(true);
      try {
        await onChangeResult(latestDiscoveryId, currentPlant, imageUrl);
      } finally {
        setIsChanging(false);
      }
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      if (isSpeaking) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 1.2;
      utterance.pitch = 1;

      const voices = window.speechSynthesis.getVoices();

      let selectedVoice = null;

      selectedVoice = voices.find((voice) =>
      voice.lang.startsWith('de') && (
      voice.name.toLowerCase().includes('male') || voice.name.toLowerCase().includes('männlich') || voice.name.toLowerCase().includes('martin') || voice.name.toLowerCase().includes('stefan'))
      );

      if (!selectedVoice) {
        selectedVoice = voices.find((voice) => voice.lang.startsWith('de'));
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } else {
      alert("Dein Browser unterstützt leider keine Sprachausgabe.");
    }
  };

  const getDescriptionText = (plantData = currentPlant) => {
    if (!plantData) return "";

    let text = `${plantData.species_name}. `;

    if (plantData.description) {
      text += plantData.description + ". ";
    }

    if (plantData.identification_features || plantData.aiData?.identification_features) {
      text += "Erkennungsmerkmale: " + (plantData.identification_features || plantData.aiData?.identification_features) + ". ";
    }

    if (plantData.fun_fact || plantData.aiData?.fun_fact) {
      text += "Wusstest du? " + (plantData.fun_fact || plantData.aiData?.fun_fact);
    }

    return text;
  };

  const isUnidentified = plant?.notInDex === undefined && (plant?.identified === false || !plant?.species_name && !plant?.aiData);

  if (isUnidentified) {
    return (
      <Card className="overflow-hidden rounded-3xl border border-red-300/45 bg-black/35 backdrop-blur-sm shadow-[0_18px_42px_rgba(0,0,0,0.42)]">
        <CardContent className="p-4 space-y-3">
          <Alert className="border border-red-300/45 bg-red-900/40 text-red-100">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm font-semibold text-red-100">
              Diese Pflanze konnte ich nicht erkennen! 🤔
            </AlertDescription>
          </Alert>

          {imageUrl &&
          <img
            src={imageUrl}
            alt="Gescanntes Bild"
            className="w-full h-40 object-cover rounded-lg border border-[#f0e5a5]/30" />

          }

          {plant?.error &&
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-900 mb-1">⚠️ Fehlerdetails:</p>
              <p className="text-xs text-orange-800">{plant.error}</p>
            </div>
          }

          <div className="bg-emerald-900/35 border border-emerald-200/30 rounded-lg p-3">
            <p className="text-sm font-semibold text-emerald-100 mb-2">💡 Tipps für bessere Ergebnisse:</p>
            <ul className="list-disc ml-5 space-y-0.5 text-xs text-emerald-50/95">
              <li>Fotografiere bei Tageslicht</li>
              <li>Zeige Details: Blätter, Blüten, Stamm</li>
              <li>Halte die Kamera ruhig</li>
              <li>Vermeide Schatten/Gegenlicht</li>
            </ul>
          </div>

          <Button onClick={onRescan} className="w-full border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 hover:brightness-110 text-white font-semibold py-3">
            <RotateCcw className="w-4 h-4 mr-2" />
            Nochmal versuchen
          </Button>
        </CardContent>
      </Card>);

  }

  // Erfolgreich gescannte Pflanze (neu oder bereits entdeckt)
  if (currentPlant?.species_name) {
    const isBlockedResult = currentPlant?.metadata_failed === true || (currentPlant?.notInDex && currentPlant?.is_european === false);
    const showBackToIntroButton = isBlockedResult;
    const conservation = getConservationFromPlant(currentPlant);
    // plant.rarity ist die kanonische, Rote-Liste-abgeleitete Seltenheitsstufe (max aus Bestand+Gefaehrdung).
    const plantRarityLabel = currentPlant?.rarity || currentPlant?.aiData?.rarity || computeRarityLabel(conservation.populationRaw, conservation.threatRaw);
    const rarityBorderClass = getRarityBorderClass(plantRarityLabel, false);
    const rarityBackgroundClass = getRarityScanBackgroundClass(plantRarityLabel);
    const rarityGlowColor = getRarityGlowColor(plantRarityLabel);
    const rarityReflectionColor = getRarityReflectionColor(plantRarityLabel);
    const threatAnimationClass = getRarityAnimationClass(plantRarityLabel);
    const threatGlowClass = getRarityGlowBorderClass(plantRarityLabel);
    const isNewToPlantDex = currentPlant.isNewToPlantDex || false;
    const wasAlreadyDiscovered = currentPlant.discovered === true;
    const confidencePercentage = currentPlant.confidence_percentage || currentPlant.aiData?.confidence_percentage;

    // Prüfe ob Ergebnis ändern Button angezeigt werden soll
    const showChangeResultButton = !isPrimaryResult && confidencePercentage >= 25;
    const isLowConfidenceAlt = isPendingConfirmation && !isPrimaryResult && typeof confidencePercentage === 'number' && confidencePercentage < 25;

    return (
      <div className="relative overflow-visible">
        {/* ShareScanDialog und zugehörigen Event-Listener entfernt, solange kein Dialog existiert */}

        <div className="relative flex items-center gap-4 overflow-visible">
          <motion.div
            key={`${currentResultIndex}-${safeActivePlayerIndex}`}
            ref={constraintsRef}
            className="flex-1 w-full overflow-visible"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}>

            <motion.div
              ref={cardRef}
              drag={hasMultiplePlayers ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={
                safeActivePlayerIndex === 0 || safeActivePlayerIndex === players.length - 1
                  ? 0.05 
                  : 0.7
              }
              onDragEnd={handleDragEnd}
              style={{ x, scale, opacity }}
              className="w-full overflow-visible">

              <Card className="shadow-2xl bg-black/30 overflow-hidden border border-[#f0e5a5]/30 backdrop-blur-sm rounded-3xl">
                <CardContent className="p-4 md:p-6 space-y-3 bg-gradient-to-br from-black/35 via-emerald-950/20 to-black/35">
                  {/* Navigation für alternative Bestimmungsergebnisse - oberhalb des Bildes */}
                  {hasMultipleResults && (
                    <div className="flex justify-center items-center gap-3 mb-1">
                      {/* Linker Pfeil */}
                      <motion.button
                        onClick={() => currentResultIndex > 0 && handleResultIndexChange(currentResultIndex - 1)}
                        disabled={currentResultIndex === 0}
                        className={`flex items-center justify-center transition-all ${
                          currentResultIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-50 hover:opacity-80'
                        }`}
                        whileHover={currentResultIndex > 0 ? { scale: 1.2 } : {}}
                        whileTap={currentResultIndex > 0 ? { scale: 0.9 } : {}}>
                        <ChevronLeft className="w-8 h-8 text-stone-300" />
                      </motion.button>

                      {/* Dots */}
                      <div className="flex gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-[#f0e5a5]/30">
                        {results.map((_, index) =>
                          <div
                            key={index}
                            className={`h-2 rounded-full transition-all ${
                              index === currentResultIndex ? 'bg-emerald-400 w-6' : 'bg-stone-500/70 w-2'
                            }`} />
                        )}
                      </div>

                      {/* Rechter Pfeil */}
                      <motion.button
                        onClick={() => currentResultIndex < results.length - 1 && handleResultIndexChange(currentResultIndex + 1)}
                        disabled={currentResultIndex === results.length - 1}
                        className={`flex items-center justify-center transition-all ${
                          currentResultIndex === results.length - 1 ? 'opacity-20 cursor-not-allowed' : 'opacity-50 hover:opacity-80'
                        }`}
                        whileHover={currentResultIndex < results.length - 1 ? { scale: 1.2 } : {}}
                        whileTap={currentResultIndex < results.length - 1 ? { scale: 0.9 } : {}}>
                        <ChevronRight className="w-8 h-8 text-stone-300" />
                      </motion.button>
                    </div>
                  )}

                  <div
                    className={`relative rounded-2xl p-2 border-2 ${rarityBorderClass} ${rarityBackgroundClass} ${threatAnimationClass} ${threatGlowClass}`}
                    style={{
                      boxShadow: '8px 8px 24px rgba(0, 0, 0, 0.15)',
                      "--threat-glow-color": rarityGlowColor,
                      "--rarity-reflection-color": rarityReflectionColor,
                    }}
                  >
                    <ThreatLevelSparks active={getRarityLevelFromLabel(plantRarityLabel) >= 4} count={18} className="z-40" />
                    {isBlockedResult && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                        <Badge variant="secondary" className="bg-red-700/90 text-white border border-red-200/35 shadow-md hover:bg-red-700/90">
                          Nicht speicherbar
                        </Badge>
                      </div>
                    )}
                    <SpeciesInfoCard
                      plant={currentPlant}
                      imageUrl={activePlayerImages[0] || imageUrl}
                      compact={false}
                      showPrimaryImage={true}
                      showScientificMeta={true}
                      showNarrative={!isBlockedResult}
                      isLightUi={false}
                      disableThreatEffects={true}
                      genusId={currentGenusId}
                      currentUserId={currentUserId || null}
                      previewStackImages={activePlayerImages.length > 1 ? activePlayerImages : []}
                      topRight={confidencePercentage ? (
                        <Badge className="bg-black/50 border border-stone-500/60 text-stone-100">{confidencePercentage}%</Badge>
                      ) : null}
                    />

                    {(latestDiscoveryId || isPendingConfirmation) &&
                    <div className="flex justify-evenly items-center mt-4 pb-2">
                      <motion.button
                        onClick={handleVerifyResult}
                        className="w-11 h-11 bg-cyan-700 rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-800 transition-all border border-cyan-200/25"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}>
                        <Search className="w-5 h-5 text-white" />
                      </motion.button>

                      <motion.button
                        onClick={() => speakText(getDescriptionText(currentPlant))}
                        className="w-11 h-11 bg-emerald-700 rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-800 transition-all border border-lime-200/25"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}>
                        {isSpeaking ?
                          <VolumeX className="w-5 h-5 text-white" /> :
                          <Volume2 className="w-5 h-5 text-white" />
                        }
                      </motion.button>

                      <motion.button
                        onClick={onRescan}
                        className="w-11 h-11 bg-stone-700 rounded-full flex items-center justify-center shadow-lg hover:bg-stone-800 transition-all border border-stone-200/20"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}>
                        <RotateCcw className="w-5 h-5 text-white" />
                      </motion.button>

                      {onAddSupplementaryPhoto && (
                        <motion.button
                          onClick={() => {
                            if (!canAddSupplementaryPhoto) {
                              alert(`Maximal ${maxScanImages} Fotos können zur Identifikation verwendet werden.`);
                              return;
                            }
                            onAddSupplementaryPhoto();
                          }}
                          title={
                            canAddSupplementaryPhoto
                              ? "Zusatzfoto hinzufügen für mehr Sicherheit"
                              : `Maximal ${maxScanImages} Fotos möglich`
                          }
                          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all border ${
                            !canAddSupplementaryPhoto
                              ? "bg-stone-700/60 border-stone-500/30 opacity-50"
                              : isBlockedResult || isLowConfidenceAlt
                                ? "bg-amber-600 hover:bg-amber-700 border-amber-200/60 threat-glow-border threat-effect-level-4"
                                : "bg-amber-800/70 hover:bg-amber-800 border-amber-200/25"
                          }`}
                          style={canAddSupplementaryPhoto && (isBlockedResult || isLowConfidenceAlt) ? { "--threat-glow-color": "rgba(245,158,11,0.85)" } : undefined}
                          whileHover={{ scale: canAddSupplementaryPhoto ? 1.1 : 1 }}
                          whileTap={{ scale: canAddSupplementaryPhoto ? 0.95 : 1 }}>
                          <Plus className="w-5 h-5 text-white" />
                        </motion.button>
                      )}
                    </div>
                    }
                  </div>

                  {/* Spieler-Auswahl: eigener Scan + andere Spieler mit Scans dieser Art (Swipe wechselt Spieler) */}
                  {hasMultiplePlayers && (
                    <div className="flex items-center gap-2 mt-4">
                      <motion.button
                        type="button"
                        onClick={() => safeActivePlayerIndex > 0 && setActivePlayerIndex(safeActivePlayerIndex - 1)}
                        disabled={safeActivePlayerIndex === 0}
                        className={`shrink-0 flex items-center justify-center transition-all ${
                          safeActivePlayerIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-50 hover:opacity-80'
                        }`}
                        whileHover={safeActivePlayerIndex > 0 ? { scale: 1.2 } : {}}
                        whileTap={safeActivePlayerIndex > 0 ? { scale: 0.9 } : {}}>
                        <ChevronLeft className="w-8 h-8 text-stone-300" />
                      </motion.button>

                      <div
                        className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                      >
                        <div className="flex items-center justify-start gap-2 flex-nowrap px-1 py-1">
                          {players.map((player, index) => (
                            <button
                              key={player.authId}
                              ref={(node) => { playerButtonRefs.current[index] = node; }}
                              type="button"
                              onClick={() => setActivePlayerIndex(index)}
                              title={player.isOwn ? "Deine Scans" : player.name}
                              className={`rounded-full overflow-hidden bg-black/35 border shrink-0 transition-all duration-200 ${
                                index === safeActivePlayerIndex ? "w-9 h-9 ring-2 ring-emerald-400/70 border-white/60" : "w-7 h-7 border-white/20 opacity-70 hover:opacity-100"
                              }`}
                            >
                              <CustomLogoAvatar
                                logoAssets={player.logoAssets}
                                className="w-full h-full"
                                tooltipText={player.name}
                                fallbackText={(player.name || "?").charAt(0).toUpperCase()}
                                fallbackClassName="text-[9px] font-bold text-white"
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <motion.button
                        type="button"
                        onClick={() => safeActivePlayerIndex < players.length - 1 && setActivePlayerIndex(safeActivePlayerIndex + 1)}
                        disabled={safeActivePlayerIndex === players.length - 1}
                        className={`shrink-0 flex items-center justify-center transition-all ${
                          safeActivePlayerIndex === players.length - 1 ? 'opacity-20 cursor-not-allowed' : 'opacity-50 hover:opacity-80'
                        }`}
                        whileHover={safeActivePlayerIndex < players.length - 1 ? { scale: 1.2 } : {}}
                        whileTap={safeActivePlayerIndex < players.length - 1 ? { scale: 0.9 } : {}}>
                        <ChevronRight className="w-8 h-8 text-stone-300" />
                      </motion.button>
                    </div>
                  )}

                  {/* Informations-Container - direkt unter dem Hauptcontainer */}
                  <div className="space-y-3 bg-black/30 backdrop-blur-md rounded-xl p-4 border border-[#f0e5a5]/20">
                  {isBlockedResult ? (
                      <div className="bg-gradient-to-br from-orange-900/45 to-red-900/40 rounded-xl p-4 border border-orange-300/35 shadow-md">
                          <h4 className="font-bold text-orange-100 mb-2 flex items-center gap-2">
                            <span className="text-xl">⚠️</span>
                            <span>Nicht im Floralog sammelbar</span>
                          </h4>
                          <p className="text-stone-100/95 leading-relaxed text-sm">
                            {currentPlant?.metadata_failed
                              ? 'Pflanzendaten oder Verbreitungsinformationen sind unvollständig. Bitte versuche es mit einem klareren Foto erneut. Möglicherweise ist aktuell das Guthaben für die KI-/LLM-Nutzung von floralog.collective ausgelaufen – in diesem Fall bitte später erneut versuchen.'
                              : 'Diese Pflanze kommt nicht in europäischen Ökosystemen vor und kann daher nicht ins Floralog aufgenommen werden. Floralog sammelt Pflanzen, die in Europa heimisch oder dauerhaft eingebürgert sind.'}
                          </p>
                        </div>
                      ) : null}

                      {/* Mindest-Sicherheitshinweis für alternative Ergebnisse */}
                      {isLowConfidenceAlt && (
                        <div className="bg-gradient-to-br from-amber-900/40 to-yellow-950/40 rounded-xl p-3 border border-amber-300/30">
                          <p className="text-amber-200 text-sm font-medium flex items-center gap-2">
                            <span>🔒</span>
                            Mindestsicherheit nicht erreicht
                          </p>
                          <p className="text-stone-300 text-xs mt-1">
                            Eine Erkennungssicherheit von mindestens 25 % wird benötigt, um dieses Ergebnis zu speichern (aktuell: {confidencePercentage} %). Wähle ein sichereres Ergebnis oder scanne erneut.
                          </p>
                        </div>
                      )}
                      </div>

                  {/* Status Anzeige - nur bei bestätigten und speicherbaren Scans */}
                  {!isPendingConfirmation && !isBlockedResult && (
                  <div className="bg-gradient-to-r from-emerald-700/90 via-emerald-500/80 to-emerald-700/90 rounded-xl p-4 border border-lime-200/35 shadow-lg">
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <Sparkles className="w-6 h-6 text-white animate-pulse" />
                        <p className="text-lg md:text-xl font-bold text-white text-center">
                          {wasAlreadyDiscovered ? "Erneut gescannt!" : "Erstentdeckung!"}
                        </p>
                        <Sparkles className="w-6 h-6 text-white animate-pulse" />
                      </div>
                    </div>
                  )}

                  {isPendingConfirmation ? (
                    <div className="pt-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
                      <Button
                        onClick={onConfirmSave}
                        disabled={isSavingPlant || isBlockedResult || isLowConfidenceAlt}
                        className="w-full border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 hover:brightness-110 disabled:opacity-50 text-white font-semibold"
                      >
                        {isSavingPlant ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                        {isSavingPlant ? "Wird gespeichert\u2026" : "Pflanze speichern"}
                      </Button>
                    </div>
                  ) : showBackToIntroButton ? (
                    <Button
                      onClick={onBackToIntro || onRescan}
                      variant="secondary"
                      className="w-full bg-black/45 hover:bg-black/65 text-stone-100 border border-[#f0e5a5]/35 font-semibold"
                    >
                      Zurück
                    </Button>
                  ) : null}
                </CardContent>

                </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>);

  }

  return null;
}

