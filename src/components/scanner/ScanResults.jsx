import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RotateCcw, Volume2, VolumeX, Sparkles, ChevronLeft, ChevronRight, Search, Check, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, useMotionValue, useTransform } from "framer-motion";
// import ShareScanDialog from "./ShareScanDialog";
import { Query } from "@/api/entities";
import SpeciesInfoCard from "@/components/collection/SpeciesInfoCard";
import ThreatLevelSparks from "@/components/effects/ThreatLevelSparks";
import {
  buildCollectionMembershipIndex,
} from "@/api/collectionCollaborationService";
import {
  getConservationEffectLevel,
  getConservationFromPlant,
  getRarityBorderClass,
  getRarityGlowColor,
  getRarityReflectionColor,
  getRarityScanBackgroundClass,
  getThreatAnimationClass,
} from "@/lib/conservationStatus";

export default function ScanResults({
  plant,
  imageUrl,
  onRescan,
  onBackToIntro,
  isSaving,
  userLocation,
  allResults = [],
  onDeleteResult,
  onChangeResult,
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
  const [collectionState, setCollectionState] = useState({
    collections: [],
    collectionItems: [],
    genera: [],
  });
  // Share-Dialog State entfernt, solange kein Dialog existiert
  const [discovery, setDiscovery] = useState(null);
  const navigate = useNavigate();
  const x = useMotionValue(0);
  const constraintsRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    const loadCollectionData = async () => {
      const [collections, collectionItems, genera] = await Promise.all([
        Query.Collection.list(),
        Query.CollectionItem.list(),
        Query.PlantGenus.list(),
      ]);

      setCollectionState({
        collections: collections || [],
        collectionItems: collectionItems || [],
        genera: genera || [],
      });
    };

    loadCollectionData();
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

  const { membershipsByPlantId } = buildCollectionMembershipIndex({
    plants: results,
    collectionItems: collectionState.collectionItems,
    collections: collectionState.collections,
    genera: collectionState.genera,
  });

  const currentCollectionMemberships = membershipsByPlantId[currentPlant?.id] || [];



  const hasMultipleResults = results.length > 1;
  const isPrimaryResult = currentResultIndex === 0;

  const scale = useTransform(x, [-200, -100, 0, 100, 200], [0.85, 0.95, 1, 0.95, 0.85]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (event, info) => {
    const threshold = 100;

    if (info.offset.x > threshold && currentResultIndex > 0) {
      const newIndex = currentResultIndex - 1;
      setCurrentResultIndex(newIndex);
      if (onResultIndexChange) onResultIndexChange(newIndex);
    } else if (info.offset.x < -threshold && currentResultIndex < results.length - 1) {
      const newIndex = currentResultIndex + 1;
      setCurrentResultIndex(newIndex);
      if (onResultIndexChange) onResultIndexChange(newIndex);
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
    const rarityBorderClass = getRarityBorderClass(conservation.populationRaw, false);
    const rarityBackgroundClass = getRarityScanBackgroundClass(conservation.populationRaw);
    const rarityGlowColor = getRarityGlowColor(conservation.populationRaw);
    const rarityReflectionColor = getRarityReflectionColor(conservation.populationRaw);
    const conservationEffectLevel = getConservationEffectLevel(
      conservation.threatRaw,
      conservation.populationRaw
    );
    const threatAnimationClass = getThreatAnimationClass(
      conservation.threatRaw,
      conservation.populationRaw
    );
    const threatGlowClass = conservationEffectLevel >= 4 ? "threat-glow-border" : "";
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
            key={currentResultIndex}
            ref={constraintsRef}
            className="flex-1 w-full overflow-visible"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}>

            <motion.div
              ref={cardRef}
              drag={hasMultipleResults ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={
                currentResultIndex === 0 || currentResultIndex === results.length - 1 
                  ? 0.05 
                  : 0.7
              }
              onDragEnd={handleDragEnd}
              style={{ x, scale, opacity }}
              className="w-full overflow-visible">

              <Card className="shadow-2xl bg-black/30 overflow-hidden border border-[#f0e5a5]/30 backdrop-blur-sm rounded-3xl">
                <CardContent className="p-4 md:p-6 space-y-3 bg-gradient-to-br from-black/35 via-emerald-950/20 to-black/35">
                  <div
                    className={`relative rounded-2xl p-2 border-2 ${rarityBorderClass} ${rarityBackgroundClass} ${threatAnimationClass} ${threatGlowClass}`}
                    style={{
                      boxShadow: '8px 8px 24px rgba(0, 0, 0, 0.15)',
                      "--threat-glow-color": rarityGlowColor,
                      "--rarity-reflection-color": rarityReflectionColor,
                    }}
                  >
                    <ThreatLevelSparks active={conservationEffectLevel >= 3} count={18} className="z-40" />
                    {isBlockedResult && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                        <Badge variant="secondary" className="bg-red-700/90 text-white border border-red-200/35 shadow-md hover:bg-red-700/90">
                          Nicht speicherbar
                        </Badge>
                      </div>
                    )}
                    <SpeciesInfoCard
                      plant={currentPlant}
                      imageUrl={imageUrl}
                      compact={false}
                      showPrimaryImage={true}
                      showScientificMeta={true}
                      showNarrative={!isBlockedResult}
                      isLightUi={false}
                      disableThreatEffects={true}
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
                    </div>
                    }
                  </div>

                  {/* Navigation unterhalb der Rarität-Kachel - nur bei mehreren Ergebnissen */}
                  {hasMultipleResults && (
                    <div className="flex justify-center items-center gap-3 mt-4">
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

                  {/* Informations-Container - direkt unter dem Hauptcontainer */}
                  <div className="space-y-3 bg-black/30 backdrop-blur-md rounded-xl p-4 border border-[#f0e5a5]/20">

                  {!isBlockedResult && (
                    <div className="space-y-2 rounded-xl border border-emerald-300/25 bg-black/20 p-3">
                      <p className="text-[11px] font-semibold text-emerald-200">Kollektionen mit dieser Art</p>
                      {currentCollectionMemberships.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {currentCollectionMemberships.map((entry) => (
                            <Badge
                              key={entry.id}
                              className="bg-emerald-800/65 border border-emerald-300/35 text-emerald-100 hover:bg-emerald-800/65"
                            >
                              {entry.title}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-stone-300">Noch in keiner sichtbaren Kollektion.</p>
                      )}

                    </div>
                  )}

                  {isBlockedResult ? (
                      <div className="bg-gradient-to-br from-orange-900/45 to-red-900/40 rounded-xl p-4 border border-orange-300/35 shadow-md">
                          <h4 className="font-bold text-orange-100 mb-2 flex items-center gap-2">
                            <span className="text-xl">⚠️</span>
                            <span>Nicht im Floralog sammelbar</span>
                          </h4>
                          <p className="text-stone-100/95 leading-relaxed text-sm">
                            {currentPlant?.metadata_failed
                              ? 'Pflanzendaten oder Verbreitungsinformationen sind unvollständig. Bitte versuche es mit einem klareren Foto erneut.'
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
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={onRescan}
                        disabled={isSavingPlant}
                        className="flex-1 border-[#f0e5a5]/35 bg-black/35 text-stone-100 hover:bg-black/55 font-semibold"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Erneut scannen
                      </Button>
                      <Button
                        onClick={onConfirmSave}
                        disabled={isSavingPlant || isBlockedResult || isLowConfidenceAlt}
                        className="flex-[2] border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 hover:brightness-110 disabled:opacity-50 text-white font-semibold"
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

