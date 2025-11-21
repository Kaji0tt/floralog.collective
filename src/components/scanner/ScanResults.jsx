import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  latestDiscoveryId
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
      setCurrentResultIndex(currentResultIndex - 1);
    } else if (info.offset.x < -threshold && currentResultIndex < results.length - 1) {
      setCurrentResultIndex(currentResultIndex + 1);
    }
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

  const getRarityStars = (rarity) => {
    switch (rarity) {
      case "Häufig":return "⭐";
      case "Gelegentlich":return "⭐⭐";
      case "Selten":return "⭐⭐⭐";
      case "Sehr Selten":return "⭐⭐⭐⭐";
      case "Extrem Selten":return "⭐⭐⭐⭐⭐";
      default:return "⭐";
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

  // Nicht-europäische Pflanzen - nur separate UI wenn es das erste Ergebnis ist
  if (currentPlant?.notInDex && currentPlant?.is_european === false && isPrimaryResult) {
    return (
      <Card className="border-2 border-orange-200 shadow-lg bg-white">
        <CardHeader className="border-b-2 border-orange-100 bg-gradient-to-r from-orange-50 to-red-50">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-orange-600 mx-auto mb-3" />
            <CardTitle className="text-2xl md:text-3xl font-bold text-stone-900 mb-2 px-4">
              Keine mitteleuropäische Pflanze! 🌍
            </CardTitle>
            <p className="text-sm md:text-base text-orange-700 font-semibold px-4">PlantDex sammelt nur Pflanzen aus Mitteleuropa</p>
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <img
                src={imageUrl}
                alt={currentPlant.species_name}
                className="w-full aspect-square object-cover rounded-xl shadow-md border-2 border-orange-300" />

            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-stone-900 mb-2 break-words">
                  {currentPlant.species_name}
                </h3>
                <p className="text-base md:text-lg text-stone-600 italic mb-2 break-words">
                  {currentPlant.scientific_name}
                </p>
              </div>

              {currentPlant.description &&
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                  <h4 className="font-bold text-stone-900 mb-2">📖 Beschreibung</h4>
                  <p className="text-stone-700 leading-relaxed">{currentPlant.description}</p>
                </div>
              }

              {currentPlant.fun_fact &&
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h4 className="font-bold text-blue-900 mb-2">💡 Wusstest du?</h4>
                  <p className="text-stone-700 leading-relaxed">{currentPlant.fun_fact}</p>
                </div>
              }
            </div>
          </div>

          <Alert className="border-2 border-orange-200 bg-orange-50">
            <AlertDescription className="text-sm md:text-base font-semibold text-orange-900 text-center">
              ⚠️ Diese Pflanze gehört nicht zur mitteleuropäischen Flora und kann daher nicht zum PlantDex hinzugefügt werden.
              <br />
              <span className="text-xs md:text-sm">PlantDex konzentriert sich auf Pflanzen aus Deutschland, Österreich, Schweiz und angrenzenden Regionen.</span>
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="flex gap-4 p-4 md:p-6 border-t-2 border-stone-200 bg-stone-50">
          <Button
            onClick={onRescan}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-5">

            <RotateCcw className="w-4 h-4 mr-2" />
            Andere Pflanze scannen
          </Button>
        </CardFooter>
      </Card>);

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

        {/* Indikator-Dots über dem Card */}
        {hasMultipleResults &&
        <div className="flex justify-center mb-3">
            <div className="flex gap-1.5 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
              {results.map((_, index) =>
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
              index === currentResultIndex ? 'bg-green-600 w-6' : 'bg-stone-300 w-2'}`
              } />

            )}
            </div>
          </div>
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
                <CardHeader className="border-b-2 border-stone-300 bg-gradient-to-r from-green-600 to-emerald-600 p-4 md:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white flex-1 truncate">
                      {isPrimaryResult ?
                      isNewToPlantDex ? "Neue Pflanze zum PlantDex hinzugefügt! 🎉" :
                      wasAlreadyDiscovered ? "Pflanze erneut gescannt! ✅" :
                      "Neue Pflanze entdeckt! 🌟" :

                      `Alternative ${currentResultIndex}`
                      }
                      {confidencePercentage &&
                      <span className="text-base md:text-lg ml-2 text-green-100">
                          ({confidencePercentage}%)
                        </span>
                      }
                    </h2>
                    <button
                      onClick={() => speakText(getDescriptionText(currentPlant))}
                      className="flex-shrink-0 hover:scale-110 transition-transform">

                      {isSpeaking ?
                      <VolumeX className="w-8 h-8 text-white" /> :

                      <Volume2 className="w-8 h-8 text-white" />
                      }
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 md:p-6 space-y-3">
                  {/* Container mit Rarität-Border für Titel und Bild */}
                  <div className={`relative border-4 ${getRarityBorderColor(rarity)} rounded-2xl p-4 shadow-xl bg-white`}>
                    {/* Namen und Rarität über dem Bild */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <h3 className="text-2xl md:text-3xl font-bold text-stone-900 break-words">
                          {currentPlant.species_name}
                        </h3>
                        <p className="text-lg md:text-xl text-stone-600 italic mt-1 break-words">
                          {currentPlant.scientific_name}
                        </p>
                      </div>
                      <Badge className={`${getRarityColor(rarity)} text-white font-bold px-3 py-1 text-sm flex-shrink-0`}>
                        {getRarityStars(rarity)} {rarity}
                      </Badge>
                    </div>

                    {/* Icon-Buttons über dem Container */}
                    {latestDiscoveryId &&
                      <div className="absolute -top-5 -left-5 -right-5 flex justify-start z-20">
                        {/* Links: Alle Buttons */}
                        <div className="flex flex-col gap-2">
                          <motion.button
                            onClick={handleDeleteResult}
                            disabled={isDeleting}
                            className="w-11 h-11 bg-white/95 backdrop-blur-sm border-2 border-red-400 rounded-full flex items-center justify-center shadow-lg hover:bg-red-50 transition-all"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}>
                            <X className="w-5 h-5 text-red-600" />
                          </motion.button>

                          <motion.button
                            onClick={handleVerifyResult}
                            className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all mt-16"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}>
                            <Search className="w-5 h-5 text-white" />
                          </motion.button>

                          <motion.button
                            onClick={() => setShowShareDialog(true)}
                            className="w-11 h-11 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-all"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}>
                            <Gift className="w-5 h-5 text-white" />
                          </motion.button>
                        </div>
                      </div>
                    }

                    {/* Bild mit Navigation */}
                    <div className="relative">
                      {imageUrl &&
                      <>
                        <img
                          src={imageUrl}
                          alt={currentPlant.species_name}
                          className={`w-full aspect-square object-cover rounded-xl shadow-md border-4 ${getRarityBorderColor(rarity)}`} />

                        {/* Navigations-Pfeile Container - nach den interaktiven Buttons */}
                        {hasMultipleResults &&
                        <>
                            {/* Linker Pfeil */}
                            <motion.button
                              onClick={() => currentResultIndex > 0 && setCurrentResultIndex(currentResultIndex - 1)}
                              disabled={currentResultIndex === 0}
                              className={`absolute -left-7 top-[50%] -translate-y-1/2 w-14 h-14 bg-white border-2 border-green-400 rounded-full flex items-center justify-center shadow-lg transition-all z-10 ${
                                currentResultIndex === 0 ? 'opacity-0 cursor-not-allowed' : 'hover:bg-green-50 opacity-100'
                              }`}
                              whileHover={currentResultIndex > 0 ? { scale: 1.1 } : {}}
                              whileTap={currentResultIndex > 0 ? { scale: 0.95 } : {}}
                              style={{ x: leftArrowX }}>

                                <ChevronLeft className="w-6 h-6 text-green-600" />
                              </motion.button>

                            {/* Rechter Pfeil */}
                            <motion.button
                              onClick={() => currentResultIndex < results.length - 1 && setCurrentResultIndex(currentResultIndex + 1)}
                              disabled={currentResultIndex === results.length - 1}
                              className={`absolute -right-7 top-[50%] -translate-y-1/2 w-14 h-14 bg-white border-2 border-green-400 rounded-full flex items-center justify-center shadow-lg transition-all z-10 ${
                                currentResultIndex === results.length - 1 ? 'opacity-0 cursor-not-allowed' : 'hover:bg-green-50 opacity-100'
                              }`}
                              whileHover={currentResultIndex < results.length - 1 ? { scale: 1.1 } : {}}
                              whileTap={currentResultIndex < results.length - 1 ? { scale: 0.95 } : {}}
                              style={{ x: rightArrowX }}>

                                <ChevronRight className="w-6 h-6 text-green-600" />
                          </motion.button>
                        </>
                        }
                      </>
                      }
                    </div>
                  </div>

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

                  {/* XP Belohnung */}
                  {currentPlant.xpAwarded !== undefined && isPrimaryResult &&
                  <div className="bg-gradient-to-r from-amber-400 to-yellow-400 rounded-xl p-4 border-2 border-amber-500 shadow-lg">
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <Sparkles className="w-6 h-6 text-white animate-pulse" />
                        <p className="text-lg md:text-xl font-bold text-white text-center">
                          +{currentPlant.xpAwarded} XP {isNewToPlantDex ? "für neue PlantDex-Pflanze!" :
                        wasAlreadyDiscovered ? "für erneuten Scan!" :
                        "für Erstentdeckung!"}
                        </p>
                        <Sparkles className="w-6 h-6 text-white animate-pulse" />
                      </div>
                    </div>
                  }

                  {/* Alternative Ergebnisse: Button zum Ändern */}
                  {latestDiscoveryId && !isPrimaryResult && showChangeResultButton &&
                  <Button
                    onClick={handleChangeResult}
                    disabled={isChanging}
                    variant="outline"
                    size="sm"
                    className="w-full border border-amber-200 hover:bg-amber-50 text-amber-700">

                      {isChanging ?
                    <>
                          <RotateCcw className="w-4 h-4 mr-1 animate-spin" />
                          Wird geändert...
                        </> :

                    <>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Als Ergebnis verwenden
                        </>
                    }
                    </Button>
                  }
                </CardContent>

                <CardFooter className="p-4 border-t-2 border-stone-300 bg-gradient-to-r from-stone-100 to-stone-50">
                  <Button
                    onClick={() => navigate(createPageUrl("Collection"))}
                    className="w-full bg-green-600 hover:bg-green-700 text-white">

                    <BookOpen className="w-4 h-4 mr-1" />
                    Zur Collection
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>);

  }

  return null;
}