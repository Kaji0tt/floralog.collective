import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, RotateCcw, Volume2, VolumeX, BookOpen, Sparkles, ChevronLeft, ChevronRight, Search, X, RefreshCw, Gift } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import ShareScanDialog from "./ShareScanDialog";
import { base44 } from "@/api/base44Client";

export default function ScanResults({
  plant,
  imageUrl,
  onRescan,
  isSaving,
  userLocation,
  allResults = [],
  onDeleteResult,
  onChangeResult,
  latestDiscoveryId,
  isPendingConfirmation = false,
  onResultIndexChange
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [user, setUser] = useState(null);
  const [discovery, setDiscovery] = useState(null);
  const navigate = useNavigate();
  const x = useMotionValue(0);
  const constraintsRef = useRef(null);
  const cardRef = useRef(null);

  // Transform für Pfeile-Animation bei Swipe - verstärkte Responsiveness
  const leftArrowX = useTransform(x, [0, 100], [0, -25]);
  const rightArrowX = useTransform(x, [0, -100], [0, 25]);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  useEffect(() => {
    const loadDiscovery = async () => {
      if (!latestDiscoveryId) return;
      const discoveries = await base44.entities.UserPlantDiscovery.list();
      const found = discoveries.find((d) => d.id === latestDiscoveryId);
      setDiscovery(found);
    };
    loadDiscovery();
  }, [latestDiscoveryId]);

  // Wenn allResults leer ist, aber plant vorhanden ist, nutze plant als einziges Ergebnis
  const results = allResults.length > 0 ? allResults : plant ? [plant] : [];
  const currentPlant = results[currentResultIndex] || plant;

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

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case "Häufig":return "bg-gray-500";
      case "Gelegentlich":return "bg-green-500";
      case "Selten":return "bg-purple-500";
      case "Sehr Selten":return "bg-orange-500";
      case "Extrem Selten":return "bg-red-500";
      default:return "bg-gray-500";
    }
  };

  const getRarityBorderColor = (rarity) => {
    switch (rarity) {
      case "Häufig":return "border-gray-500";
      case "Gelegentlich":return "border-green-500";
      case "Selten":return "border-purple-500";
      case "Sehr Selten":return "border-orange-500";
      case "Extrem Selten":return "border-red-500";
      default:return "border-gray-500";
    }
  };

  const getRarityBackgroundColor = (rarity) => {
    switch (rarity) {
      case "Häufig":return "bg-gradient-to-br from-zinc-300 via-zinc-200 to-stone-100";
      case "Gelegentlich":return "bg-gradient-to-br from-green-200 via-emerald-100 to-teal-100";
      case "Selten":return "bg-gradient-to-br from-purple-200 via-violet-100 to-indigo-100";
      case "Sehr Selten":return "bg-gradient-to-br from-orange-200 via-amber-100 to-yellow-100";
      case "Extrem Selten":return "bg-gradient-to-br from-red-200 via-rose-100 to-pink-100";
      default:return "bg-gradient-to-br from-zinc-300 via-zinc-200 to-stone-100";
    }
  };

  const getRaritySymbol = (rarity) => {
    switch (rarity) {
      case "Häufig":return "●";
      case "Gelegentlich":return "▲";
      case "Selten":return "★";
      default:return "●";
    }
  };

  const isUnidentified = plant?.notInDex === undefined && (plant?.identified === false || !plant?.species_name && !plant?.aiData);

  if (isUnidentified) {
    return (
      <Card className="border-2 border-red-200 shadow-lg bg-white">
        <CardContent className="p-4 space-y-3">
          <Alert className="border border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm font-semibold text-red-900">
              Diese Pflanze konnte ich nicht erkennen! 🤔
            </AlertDescription>
          </Alert>

          {imageUrl &&
          <img
            src={imageUrl}
            alt="Gescanntes Bild"
            className="w-full h-40 object-cover rounded-lg border border-stone-200" />

          }

          {plant?.error &&
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-900 mb-1">⚠️ Fehlerdetails:</p>
              <p className="text-xs text-orange-800">{plant.error}</p>
            </div>
          }

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-900 mb-2">💡 Tipps für bessere Ergebnisse:</p>
            <ul className="list-disc ml-5 space-y-0.5 text-xs text-blue-800">
              <li>Fotografiere bei Tageslicht</li>
              <li>Zeige Details: Blätter, Blüten, Stamm</li>
              <li>Halte die Kamera ruhig</li>
              <li>Vermeide Schatten/Gegenlicht</li>
            </ul>
          </div>

          <Button onClick={onRescan} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3">
            <RotateCcw className="w-4 h-4 mr-2" />
            Nochmal versuchen
          </Button>
        </CardContent>
      </Card>);

  }

  // Nicht-europäische Pflanzen - kompaktes Design
  if (currentPlant?.notInDex && currentPlant?.is_european === false && isPrimaryResult) {
    return (
      <Card className="border-2 border-orange-200 shadow-md bg-white overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Header kompakt */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-red-50 -mx-4 -mt-4 p-3 border-b border-orange-200">
            <AlertCircle className="w-8 h-8 text-orange-600 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-stone-900">Keine mitteleuropäische Pflanze! 🌍</h2>
              <p className="text-xs text-orange-700">PlantDex sammelt nur Pflanzen aus Mitteleuropa</p>
            </div>
          </div>

          {/* Bild und Info nebeneinander */}
          <div className="flex gap-4">
            <img
              src={imageUrl}
              alt={currentPlant.species_name}
              className="w-24 h-24 object-cover rounded-xl shadow-sm border-2 border-orange-300 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-stone-900 truncate">
                {currentPlant.species_name}
              </h3>
              <p className="text-sm text-stone-600 italic truncate">
                {currentPlant.scientific_name}
              </p>
            </div>
          </div>

          {/* Beschreibung kompakt */}
          {currentPlant.description && (
            <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
              <p className="text-sm text-stone-700 line-clamp-3">{currentPlant.description}</p>
            </div>
          )}

          {currentPlant.fun_fact && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-1">💡 Wusstest du?</p>
              <p className="text-sm text-stone-700 line-clamp-2">{currentPlant.fun_fact}</p>
            </div>
          )}

          {/* Hinweis */}
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
            <p className="text-xs text-orange-800 text-center">
              ⚠️ Diese Pflanze kann nicht zum PlantDex hinzugefügt werden.
            </p>
          </div>

          {/* Button */}
          <Button
            onClick={onRescan}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Andere Pflanze scannen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Erfolgreich gescannte Pflanze (neu oder bereits entdeckt)
  if (currentPlant?.species_name) {
    const rarity = currentPlant.rarity || currentPlant.aiData?.rarity || "Häufig";
    const isNewToPlantDex = currentPlant.isNewToPlantDex || false;
    const wasAlreadyDiscovered = currentPlant.discovered === true;
    const confidencePercentage = currentPlant.confidence_percentage || currentPlant.aiData?.confidence_percentage;

    // Prüfe ob Ergebnis ändern Button angezeigt werden soll
    const showChangeResultButton = !isPrimaryResult && confidencePercentage >= 25;

    return (
      <div className="relative -top-5">
        {showShareDialog && user && discovery && currentPlant &&
        <ShareScanDialog
          open={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          discovery={discovery}
          plant={currentPlant}
          user={user} />

        }



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

              <Card className="shadow-2xl bg-gradient-to-br from-stone-100 to-stone-50 overflow-hidden border-none">
                <CardContent className="p-4 md:p-6 space-y-3 bg-gradient-to-br from-green-50/40 via-emerald-50/30 to-teal-50/20">
                  {/* Container mit Rarität-Border für Titel und Bild */}
                  <div className={`relative rounded-2xl p-4 ${getRarityBackgroundColor(rarity)}`} style={{ boxShadow: '8px 8px 24px rgba(0, 0, 0, 0.15)' }}>
                    {/* Namen linksbündig mit Rarität Badge rechts */}
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-stone-900 break-words" style={{
                          fontSize: currentPlant.species_name?.length > 25 ? 'clamp(1.25rem, 5vw, 1.875rem)' : 'clamp(1.5rem, 6vw, 1.875rem)',
                          lineHeight: '1.2'
                        }}>
                          {currentPlant.species_name}
                        </h3>
                        <p className="text-stone-600 italic mt-1 break-words flex items-center flex-wrap gap-1" style={{
                          fontSize: currentPlant.scientific_name?.length > 30 ? 'clamp(0.875rem, 4vw, 1.25rem)' : 'clamp(1rem, 5vw, 1.25rem)',
                          lineHeight: '1.3'
                        }}>
                          <span>{currentPlant.scientific_name}</span>
                          {confidencePercentage &&
                            <span className="text-stone-400 whitespace-nowrap">
                              ({confidencePercentage}%)
                            </span>
                          }
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-black font-bold text-2xl cursor-pointer">
                                {getRaritySymbol(rarity)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white border-2 border-stone-200 shadow-lg p-3">
                              <div className="space-y-1 text-sm text-stone-900">
                                <div className="font-bold mb-2">Raritäten:</div>
                                <div className="flex items-center gap-2"><span className="text-xl">●</span> Häufig</div>
                                <div className="flex items-center gap-2"><span className="text-xl">▲</span> Gelegentlich</div>
                                <div className="flex items-center gap-2"><span className="text-xl">★</span> Selten</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>



                    {/* Bild mit Navigation */}
                    <div className="relative">
                      {imageUrl &&
                      <>
                        <img
                          src={imageUrl}
                          alt={currentPlant.species_name}
                          className={`w-full aspect-square object-cover rounded-xl shadow-[inset_0_0_30px_rgba(0,0,0,0.4)] border-2 ${getRarityBorderColor(rarity)}`} />
                        </>
                        }
                        </div>

                      {/* Lupe, Lautsprecher, Geschenk und Löschen unterhalb des Bildes */}
                      {(latestDiscoveryId || isPendingConfirmation) &&
                      <div className="flex justify-evenly items-center mt-4">
                        {/* Lupe (Search) */}
                        <motion.button
                          onClick={handleVerifyResult}
                          className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}>
                          <Search className="w-5 h-5 text-white" />
                        </motion.button>

                        {/* Lautsprecher */}
                        <motion.button
                          onClick={() => speakText(getDescriptionText(currentPlant))}
                          className="w-11 h-11 bg-purple-600 rounded-full flex items-center justify-center shadow-lg hover:bg-purple-700 transition-all"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}>
                          {isSpeaking ?
                            <VolumeX className="w-5 h-5 text-white" /> :
                            <Volume2 className="w-5 h-5 text-white" />
                          }
                        </motion.button>

                        {/* Geschenk (Gift) */}
                        <motion.button
                          onClick={() => setShowShareDialog(true)}
                          className="w-11 h-11 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-all"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}>
                          <Gift className="w-5 h-5 text-white" />
                        </motion.button>

                        {/* Erneut Scannen */}
                        <motion.button
                          onClick={onRescan}
                          className="w-11 h-11 bg-stone-600 rounded-full flex items-center justify-center shadow-lg hover:bg-stone-700 transition-all"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}>
                          <RotateCcw className="w-5 h-5 text-white" />
                        </motion.button>

                      </div>
                      }
                  </div>

                  {/* Navigation unterhalb der Rarität-Kachel */}
                  {hasMultipleResults && (latestDiscoveryId || isPendingConfirmation) && (
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
                        <ChevronLeft className="w-8 h-8 text-gray-600" />
                      </motion.button>

                      {/* Dots */}
                      <div className="flex gap-1.5 bg-stone-100 px-3 py-1.5 rounded-full border-2 border-stone-300">
                        {results.map((_, index) =>
                          <div
                            key={index}
                            className={`h-2 rounded-full transition-all ${
                              index === currentResultIndex ? 'bg-green-600 w-6' : 'bg-stone-300 w-2'
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
                        <ChevronRight className="w-8 h-8 text-gray-600" />
                      </motion.button>
                    </div>
                  )}

                  {/* Informations-Container - direkt unter dem Hauptcontainer */}
                  <div className="space-y-3">
                      {(currentPlant.description || currentPlant.aiData?.description) &&
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200 shadow-md">
                          <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                            <span className="text-xl">📖</span>
                            <span>Beschreibung</span>
                          </h4>
                          <p className="text-stone-800 leading-relaxed">
                            {currentPlant.description || currentPlant.aiData?.description}
                          </p>
                        </div>
                      }

                      {(currentPlant.identification_features || currentPlant.aiData?.identification_features) &&
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200 shadow-md">
                          <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                            <span className="text-xl">🔍</span>
                            <span>Erkennungsmerkmale</span>
                          </h4>
                          <p className="text-stone-800 leading-relaxed">
                            {currentPlant.identification_features || currentPlant.aiData?.identification_features}
                          </p>
                        </div>
                      }

                      {(currentPlant.fun_fact || currentPlant.aiData?.fun_fact) &&
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border-2 border-amber-300 shadow-md">
                          <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                            <span className="text-xl">💡</span>
                            <span>Wusstest du?</span>
                          </h4>
                          <p className="text-stone-800 leading-relaxed">
                            {currentPlant.fun_fact || currentPlant.aiData?.fun_fact}
                          </p>
                        </div>
                      }
                      </div>

                  {/* Status Anzeige - nur bei bestätigten Scans */}
                  {!isPendingConfirmation &&
                  <div className="bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl p-4 border-2 border-green-500 shadow-lg">
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <Sparkles className="w-6 h-6 text-white animate-pulse" />
                        <p className="text-lg md:text-xl font-bold text-white text-center">
                          {isNewToPlantDex ? "Neue PlantDex-Pflanze!" :
                        wasAlreadyDiscovered ? "Erneut gescannt!" :
                        "Erstentdeckung!"}
                        </p>
                        <Sparkles className="w-6 h-6 text-white animate-pulse" />
                      </div>
                    </div>
                  }
                </CardContent>

                </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>);

  }

  return null;
}