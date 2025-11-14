import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RotateCcw, Volume2, VolumeX, BookOpen, Sparkles, ChevronLeft, ChevronRight, Search, Trash2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";

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
  const navigate = useNavigate();
  const x = useMotionValue(0);
  const constraintsRef = useRef(null);
  const cardRef = useRef(null);

  // Wenn allResults leer ist, aber plant vorhanden ist, nutze plant als einziges Ergebnis
  const results = allResults.length > 0 ? allResults : (plant ? [plant] : []);
  const currentPlant = results[currentResultIndex] || plant;

  const hasMultipleResults = results.length > 1;
  const isPrimaryResult = currentResultIndex === 0;

  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (event, info) => {
    const threshold = 100;
    
    if (info.offset.x > threshold && currentResultIndex > 0) {
      // Nach rechts gewischt - vorheriges Ergebnis
      setCurrentResultIndex(currentResultIndex - 1);
    } else if (info.offset.x < -threshold && currentResultIndex < results.length - 1) {
      // Nach links gewischt - nächstes Ergebnis
      setCurrentResultIndex(currentResultIndex + 1);
    }
  };

  const handleVerifyResult = () => {
    const searchQuery = encodeURIComponent(currentPlant.species_name + " " + currentPlant.scientific_name);
    window.open(`https://www.google.com/search?tbm=isch&q=${searchQuery}`, '_blank');
  };

  const handleDeleteResult = async () => {
    if (!latestDiscoveryId) return;
    
    if (confirm(`Möchtest du diese Entdeckung wirklich löschen?\n\n"${currentPlant.species_name}" wird aus deiner Sammlung entfernt.`)) {
      setIsDeleting(true);
      try {
        await onDeleteResult(latestDiscoveryId);
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

      selectedVoice = voices.find(voice => 
        voice.lang.startsWith('de') && 
        (voice.name.toLowerCase().includes('male') || voice.name.toLowerCase().includes('männlich') || voice.name.toLowerCase().includes('martin') || voice.name.toLowerCase().includes('stefan'))
      );
      
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang.startsWith('de'));
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
    switch(rarity) {
      case "Häufig": return "bg-gray-500";
      case "Gelegentlich": return "bg-green-500";
      case "Selten": return "bg-purple-500";
      case "Sehr Selten": return "bg-orange-500";
      case "Extrem Selten": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getRarityStars = (rarity) => {
    switch(rarity) {
      case "Häufig": return "⭐";
      case "Gelegentlich": return "⭐⭐";
      case "Selten": return "⭐⭐⭐";
      case "Sehr Selten": return "⭐⭐⭐⭐";
      case "Extrem Selten": return "⭐⭐⭐⭐⭐";
      default: return "⭐";
    }
  };

  const isUnidentified = plant?.notInDex === undefined && (plant?.identified === false || (!plant?.species_name && !plant?.aiData));

  if (isUnidentified) {
    return (
      <Card className="border-2 border-red-200 shadow-lg bg-white">
        <CardContent className="p-8">
          <Alert className="border-2 border-red-200 bg-red-50 mb-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <AlertDescription className="text-base font-semibold text-red-900">
              Diese Pflanze konnte ich nicht erkennen! 🤔
            </AlertDescription>
          </Alert>

          {imageUrl && (
            <img
              src={imageUrl}
              alt="Gescanntes Bild"
              className="w-full h-64 object-cover rounded-lg mb-4 border-2 border-stone-200"
            />
          )}

          {plant?.error && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-orange-900 mb-2">⚠️ Fehlerdetails:</p>
              <p className="text-sm text-orange-800">{plant.error}</p>
            </div>
          )}

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
            <p className="font-semibold text-blue-900 mb-2">💡 Tipps für bessere Ergebnisse:</p>
            <ul className="list-disc ml-6 space-y-1 text-sm text-blue-800">
              <li>Fotografiere die Pflanze bei Tageslicht</li>
              <li>Zeige mehrere Details: Blätter, Blüten, Stamm</li>
              <li>Halte die Kamera ruhig und fokussiert</li>
              <li>Vermeide starke Schatten oder Gegenlicht</li>
              <li>Fotografiere charakteristische Merkmale aus der Nähe</li>
            </ul>
          </div>

          <Button onClick={onRescan} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-5">
            <RotateCcw className="w-5 h-5 mr-2" />
            Nochmal versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Nicht-europäische Pflanzen
  if (currentPlant?.notInDex && currentPlant?.is_european === false) {
    return (
      <Card className="border-2 border-orange-200 shadow-lg bg-white">
        <CardHeader className="border-b-2 border-orange-100 bg-gradient-to-r from-orange-50 to-red-50">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-orange-600 mx-auto mb-3" />
            <CardTitle className="text-3xl font-bold text-stone-900 mb-2">
              Keine mitteleuropäische Pflanze! 🌍
            </CardTitle>
            <p className="text-orange-700 font-semibold">PlantDex sammelt nur Pflanzen aus Mitteleuropa</p>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <img
                src={imageUrl}
                alt={currentPlant.species_name}
                className="w-full aspect-square object-cover rounded-xl shadow-md border-2 border-orange-300"
              />
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-stone-900 mb-2">
                  {currentPlant.species_name}
                </h3>
                <p className="text-lg text-stone-600 italic mb-2">
                  {currentPlant.scientific_name}
                </p>
              </div>

              {currentPlant.description && (
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                  <h4 className="font-bold text-stone-900 mb-2">📖 Beschreibung</h4>
                  <p className="text-stone-700 leading-relaxed">{currentPlant.description}</p>
                </div>
              )}

              {currentPlant.fun_fact && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h4 className="font-bold text-blue-900 mb-2">💡 Wusstest du?</h4>
                  <p className="text-stone-700 leading-relaxed">{currentPlant.fun_fact}</p>
                </div>
              )}
            </div>
          </div>

          <Alert className="border-2 border-orange-200 bg-orange-50">
            <AlertDescription className="text-base font-semibold text-orange-900 text-center">
              ⚠️ Diese Pflanze gehört nicht zur mitteleuropäischen Flora und kann daher nicht zum PlantDex hinzugefügt werden.
              <br />
              <span className="text-sm">PlantDex konzentriert sich auf Pflanzen aus Deutschland, Österreich, Schweiz und angrenzenden Regionen.</span>
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="flex gap-4 p-6 border-t-2 border-stone-200 bg-stone-50">
          <Button
            onClick={onRescan}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-5"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Andere Pflanze scannen
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Erfolgreich gescannte Pflanze (neu oder bereits entdeckt)
  if (currentPlant?.species_name) {
    const rarity = currentPlant.rarity || currentPlant.aiData?.rarity || "Häufig";
    const isNewToPlantDex = currentPlant.isNewToPlantDex || false;
    const wasAlreadyDiscovered = currentPlant.discovered === true;
    const confidencePercentage = currentPlant.confidence_percentage;

    return (
      <div className="relative">
        {/* Navigation für mehrere Ergebnisse */}
        {hasMultipleResults && (
          <div className="mb-4 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentResultIndex(Math.max(0, currentResultIndex - 1))}
              disabled={currentResultIndex === 0}
              className="border-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-600">
                Ergebnis {currentResultIndex + 1} von {results.length}
              </p>
              <div className="flex gap-1 mt-1">
                {results.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentResultIndex ? 'bg-green-600 w-4' : 'bg-stone-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentResultIndex(Math.min(results.length - 1, currentResultIndex + 1))}
              disabled={currentResultIndex === results.length - 1}
              className="border-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {hasMultipleResults && (
          <div className="mb-4 text-center">
            <p className="text-xs text-stone-500">
              💡 Wische nach links/rechts für weitere Ergebnisse
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentResultIndex}
            ref={constraintsRef}
            className="relative"
          >
            <motion.div
              ref={cardRef}
              drag={hasMultipleResults ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              style={{ x, rotate, opacity }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-2 border-green-200 shadow-lg bg-white">
                <CardHeader className="border-b-2 border-green-100 bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl font-bold text-stone-900">
                        {isNewToPlantDex ? "Neue Pflanze zum PlantDex hinzugefügt! 🎉" : 
                         wasAlreadyDiscovered ? "Pflanze erneut gescannt! ✅" : 
                         "Neue Pflanze entdeckt! 🌟"}
                      </CardTitle>
                      {confidencePercentage !== null && confidencePercentage !== undefined && (
                        <div className="mt-2">
                          <Badge className="bg-blue-600 text-white font-bold">
                            🎯 {confidencePercentage}% Übereinstimmung
                          </Badge>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => speakText(getDescriptionText(currentPlant))}
                      variant="outline"
                      size="icon"
                      className={`border-2 flex-shrink-0 ${isSpeaking ? 'border-green-500 bg-green-50' : 'border-stone-300'}`}
                    >
                      {isSpeaking ? (
                        <VolumeX className="w-5 h-5 text-green-600" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-stone-600" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={currentPlant.species_name}
                          className="w-full aspect-square object-cover rounded-xl shadow-md border-2 border-green-300"
                        />
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-3xl font-bold text-stone-900 mb-2">
                          {currentPlant.species_name}
                        </h3>
                        <p className="text-xl text-stone-600 italic mb-3">
                          {currentPlant.scientific_name}
                        </p>
                        <Badge className={`${getRarityColor(rarity)} text-white font-bold px-3 py-1 text-sm`}>
                          {getRarityStars(rarity)} {rarity}
                        </Badge>
                      </div>

                      {(currentPlant.description || currentPlant.aiData?.description) && (
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                          <h4 className="font-bold text-stone-900 mb-2">📖 Beschreibung</h4>
                          <p className="text-stone-700 leading-relaxed">
                            {currentPlant.description || currentPlant.aiData?.description}
                          </p>
                        </div>
                      )}

                      {(currentPlant.identification_features || currentPlant.aiData?.identification_features) && (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                          <h4 className="font-bold text-blue-900 mb-2">🔍 Erkennungsmerkmale</h4>
                          <p className="text-stone-700 leading-relaxed">
                            {currentPlant.identification_features || currentPlant.aiData?.identification_features}
                          </p>
                        </div>
                      )}

                      {(currentPlant.fun_fact || currentPlant.aiData?.fun_fact) && (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                          <h4 className="font-bold text-amber-900 mb-2">💡 Wusstest du?</h4>
                          <p className="text-stone-700 leading-relaxed">
                            {currentPlant.fun_fact || currentPlant.aiData?.fun_fact}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* XP Belohnung */}
                  {currentPlant.xpAwarded !== undefined && isPrimaryResult && (
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border-2 border-amber-200">
                      <div className="flex items-center justify-center gap-3">
                        <Sparkles className="w-6 h-6 text-amber-600" />
                        <p className="text-xl font-bold text-amber-900">
                          +{currentPlant.xpAwarded} XP {isNewToPlantDex ? "für neue PlantDex-Pflanze!" : 
                                                 wasAlreadyDiscovered ? "für erneuten Scan!" : 
                                                 "für Erstentdeckung!"}
                        </p>
                        <Sparkles className="w-6 h-6 text-amber-600" />
                      </div>
                    </div>
                  )}

                  {/* Verifizierungs- und Korrektur-Buttons */}
                  {latestDiscoveryId && (
                    <div className="flex gap-3 flex-wrap">
                      <Button
                        onClick={handleVerifyResult}
                        variant="outline"
                        className="flex-1 border-2 border-blue-300 hover:bg-blue-50 text-blue-700 font-semibold"
                      >
                        <Search className="w-4 h-4 mr-2" />
                        Überprüfe dieses Ergebnis
                      </Button>
                      
                      {isPrimaryResult ? (
                        <Button
                          onClick={handleDeleteResult}
                          disabled={isDeleting}
                          variant="outline"
                          className="flex-1 border-2 border-red-300 hover:bg-red-50 text-red-700 font-semibold"
                        >
                          {isDeleting ? (
                            <>
                              <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                              Wird gelöscht...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Falsches Ergebnis
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleChangeResult}
                          disabled={isChanging}
                          variant="outline"
                          className="flex-1 border-2 border-amber-300 hover:bg-amber-50 text-amber-700 font-semibold"
                        >
                          {isChanging ? (
                            <>
                              <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                              Wird geändert...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Ergebnis ändern
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex gap-4 p-6 border-t-2 border-stone-200 bg-stone-50">
                  <Button
                    onClick={onRescan}
                    variant="outline"
                    className="flex-1 border-2 border-stone-300 hover:bg-stone-100 font-semibold py-5"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Neuer Scan
                  </Button>
                  <Button
                    onClick={() => navigate(createPageUrl("Collection"))}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-5"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Zur Collection
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return null;
}