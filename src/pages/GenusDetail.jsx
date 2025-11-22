import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Leaf, CheckCircle2, Lock, Sparkles, Volume2, VolumeX, ChevronLeft, ChevronRight, Star, HelpCircle } from "lucide-react";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import MobileBackButton from "../components/navigation/MobileBackButton";

export default function GenusDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const genusId = urlParams.get('id');
  const friendEmail = urlParams.get('email'); // NEU: Prüfe ob wir im Freundes-Kontext sind
  const [speakingPlantId, setSpeakingPlantId] = useState(null);
  const [imageIndexes, setImageIndexes] = useState({});
  const [flippedPlants, setFlippedPlants] = useState({});

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: userDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ['userDiscoveries', friendEmail],
    queryFn: async () => {
      // Wenn friendEmail vorhanden, lade Discoveries des Freundes
      // Ansonsten lade eigene Discoveries
      const discoveries = await base44.entities.UserPlantDiscovery.list();
      
      if (friendEmail) {
        return discoveries.filter(d => d.user === friendEmail || d.created_by === friendEmail);
      }
      
      const user = await base44.auth.me();
      if (!user || !user.email) {
        return [];
      }
      return discoveries.filter(d => d.user === user.email || d.created_by === user.email);
    },
  });

  const setFrontImageMutation = useMutation({
    mutationFn: async ({ discoveryId, plantId }) => {
      // Erst alle anderen Discoveries dieser Pflanze auf false setzen
      const plantDiscoveries = userDiscoveries.filter(d => d.plant_id === plantId);
      await Promise.all(
        plantDiscoveries.map(d => 
          base44.entities.UserPlantDiscovery.update(d.id, { is_front_image: false })
        )
      );
      // Dann das ausgewählte auf true setzen
      await base44.entities.UserPlantDiscovery.update(discoveryId, { is_front_image: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
    },
  });

  // Removed updateGenusMutation as it's no longer needed for dynamically loaded icons
  // Removed handleUpdateIcon as it's tied to updateGenusMutation

  const speakPlantDescription = (plant) => {
    if (!('speechSynthesis' in window)) {
      console.warn("Speech synthesis not supported in this browser.");
      return;
    }
    
    window.speechSynthesis.cancel();
    
    if (speakingPlantId === plant.id) {
      setSpeakingPlantId(null);
      return;
    }

    let text = `${plant.species_name}. ${plant.scientific_name}. `;
    
    if (plant.description) {
      text += plant.description + ". ";
    }
    
    if (plant.identification_features) {
      text += "Erkennungsmerkmale: " + plant.identification_features + ". ";
    }
    
    if (plant.fun_fact) {
      text += "Wusstest du? " + plant.fun_fact;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 1.2;
    utterance.pitch = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const germanMaleVoice = voices.find(voice => 
      voice.lang.includes('de') && 
      (voice.name.includes('Male') || voice.name.includes('männlich') || voice.name.includes('Martin') || voice.name.includes('Stefan'))
    );
    
    const germanVoice = voices.find(voice => voice.lang.includes('de'));
    
    if (germanMaleVoice) {
      utterance.voice = germanMaleVoice;
    } else if (germanVoice) {
      utterance.voice = germanVoice;
    }
    
    utterance.onstart = () => setSpeakingPlantId(plant.id);
    utterance.onend = () => setSpeakingPlantId(null);
    utterance.onerror = () => setSpeakingPlantId(null);
    
    window.speechSynthesis.speak(utterance);
  };

  const genus = genera.find(g => g.id === genusId);
  const genusPlants = plants
    .filter(p => p.genus_id === genusId)
    .sort((a, b) => a.species_name.localeCompare(b.species_name, 'de')) // Alphabetisch sortieren
    .map(plant => {
      const plantDiscoveries = userDiscoveries.filter(d => d.plant_id === plant.id);
      // Sortiere: Front-Image zuerst, dann nach Datum
      const sortedDiscoveries = [...plantDiscoveries].sort((a, b) => {
        if (a.is_front_image && !b.is_front_image) return -1;
        if (!a.is_front_image && b.is_front_image) return 1;
        return new Date(b.discovered_date) - new Date(a.discovered_date);
      });
      const userDiscovery = sortedDiscoveries[0];
      return {
        ...plant,
        discovered: !!userDiscovery,
        userDiscovery: userDiscovery,
        allDiscoveries: sortedDiscoveries,
        discovery_date: userDiscovery ? userDiscovery.created_at : null
      };
    });
  const discoveredSpecies = genusPlants.filter(p => p.discovered);

  // Removed myGenusImages calculation as it was only for the icon selection dialog

  // Hole das Gattungsbild: Front-Image bevorzugt, sonst neuestes
  const genusDiscoveries = userDiscoveries.filter(d => {
    const plant = plants.find(p => p.id === d.plant_id);
    return plant && plant.genus_id === genusId && d.image_url;
  });
  const genusIconUrl = genusDiscoveries.find(d => d.is_front_image)?.image_url || 
                       genusDiscoveries.sort((a, b) => new Date(b.discovered_date) - new Date(a.discovered_date))[0]?.image_url;

  if (generaLoading || plantsLoading || discoveriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!genus) {
    // Determine the correct back URL even if genus is not found
    const backUrl = friendEmail 
      ? createPageUrl(`FriendCollection?email=${friendEmail}`)
      : createPageUrl("Collection");
    const backLabel = friendEmail ? "Zurück zum Freundes-PlantDex" : "Zurück zur Sammlung";

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-gray-500 mb-4">Gattung nicht gefunden</p>
        <Button onClick={() => navigate(backUrl)}>
          {backLabel}
        </Button>
      </div>
    );
  }

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

  // Bestimme Zurück-URL basierend auf Kontext
  const backUrl = friendEmail 
    ? createPageUrl(`FriendCollection?email=${friendEmail}`)
    : createPageUrl("Collection");
  const backLabel = friendEmail ? "Zurück zum Freundes-PlantDex" : "Zurück zur Sammlung";

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton backUrl={backUrl} />
      
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(backUrl)}
          className="mb-6 bg-white hover:bg-stone-50 text-stone-900 font-semibold shadow-sm border border-stone-200 hidden md:inline-flex" // Hide on mobile, show on desktop
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>

        {/* Header Card */}
        <Card className="mb-8 border-2 border-amber-200 shadow-lg bg-white">
          <CardHeader className="border-b-2 border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex-shrink-0">
                <Badge className="bg-stone-800 text-white font-bold text-xl px-4 py-2 mb-4">
                  {genus.category === "Bäume" && "🌳"}
                  {genus.category === "Sträucher" && "🌿"}
                  {genus.category === "Blumen & Kräuter" && "🌸"}
                  #{String(genus.category_dex_number).padStart(3, '0')}
                </Badge>
                {/* Changed to dynamically load icon from user discoveries */}
                {genusIconUrl && (
                  <img
                    src={genusIconUrl}
                    alt={genus.genus_name}
                    className="w-32 h-32 object-cover rounded-xl shadow-md border-2 border-stone-200"
                  />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-2">
                  {genus.genus_name}
                </h1>
                <p className="text-2xl text-stone-600 italic mb-4">
                  {genus.scientific_genus}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className="bg-green-600 text-white font-semibold px-3 py-1">
                    {genus.category}
                  </Badge>
                  <Badge className="bg-stone-700 text-white font-semibold px-3 py-1">
                    {genus.family}
                  </Badge>
                </div>
                <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-full shadow-sm border border-stone-200">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-base text-stone-900">
                    {discoveredSpecies.length} / {genusPlants.length} Arten entdeckt
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          {genus.description && (
            <CardContent className="p-6">
              <p className="text-lg text-stone-700 leading-relaxed">{genus.description}</p>
            </CardContent>
          )}
        </Card>

        {/* Icon Selection Dialog and related button are removed */}

        {/* Species Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {genusPlants.map((plant) => (
            <Card
              key={plant.id}
              className={`border-2 shadow-md transition-all duration-300 ${
                plant.discovered 
                  ? 'border-green-300 hover:shadow-lg bg-white' 
                  : 'border-stone-200 bg-stone-50'
              }`}
            >
              <CardHeader className={`border-b-2 ${plant.discovered ? 'border-green-100 bg-green-50' : 'border-stone-200 bg-stone-100'}`}>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold ${plant.discovered ? 'text-stone-900' : 'text-stone-500'}`}>
                      {plant.discovered ? plant.species_name : '???'}
                    </h3>
                    <p className={`text-sm italic ${plant.discovered ? 'text-stone-600' : 'text-stone-400'}`}>
                      {plant.discovered ? plant.scientific_name : 'Noch nicht entdeckt'}
                    </p>
                    {plant.discovered && plant.rarity && (
                      <Badge className={`mt-2 ${getRarityColor(plant.rarity)} text-white font-bold text-xs`}>
                        {getRarityStars(plant.rarity)} {plant.rarity}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {plant.discovered && (
                      <Button
                        onClick={() => speakPlantDescription(plant)}
                        variant="outline"
                        size="icon"
                        className={`border-2 ${speakingPlantId === plant.id ? 'border-green-500 bg-green-50' : 'border-stone-300'}`}
                      >
                        {speakingPlantId === plant.id ? (
                          <VolumeX className="w-5 h-5 text-green-600" />
                        ) : (
                          <Volume2 className="w-5 h-5 text-stone-600" />
                        )}
                      </Button>
                    )}
                    {plant.discovered ? (
                      <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                    ) : (
                      <Leaf className="w-8 h-8 text-stone-400 flex-shrink-0" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {plant.discovered ? (
                  <div className="space-y-4">
                    {plant.allDiscoveries?.length > 0 && (
                      <div className="relative">
                        <img
                          src={plant.allDiscoveries[imageIndexes[plant.id] || 0]?.image_url || plant.userDiscovery.image_url}
                          alt={plant.species_name}
                          className="w-full h-48 object-cover rounded-lg shadow-sm border border-stone-200"
                        />
                        
                        {plant.allDiscoveries.length > 1 && (
                          <>
                            {/* Navigation Buttons */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const currentIndex = imageIndexes[plant.id] || 0;
                                const newIndex = currentIndex > 0 ? currentIndex - 1 : plant.allDiscoveries.length - 1;
                                setImageIndexes(prev => ({ ...prev, [plant.id]: newIndex }));
                              }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all"
                            >
                              <ChevronLeft className="w-5 h-5 text-stone-700" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const currentIndex = imageIndexes[plant.id] || 0;
                                const newIndex = currentIndex < plant.allDiscoveries.length - 1 ? currentIndex + 1 : 0;
                                setImageIndexes(prev => ({ ...prev, [plant.id]: newIndex }));
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all"
                            >
                              <ChevronRight className="w-5 h-5 text-stone-700" />
                            </button>
                            
                            {/* Counter */}
                            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                              {(imageIndexes[plant.id] || 0) + 1} / {plant.allDiscoveries.length}
                            </div>
                            
                            {/* Front-Image Button - nur für eigene Discoveries */}
                            {!friendEmail && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentDiscovery = plant.allDiscoveries[imageIndexes[plant.id] || 0];
                                  setFrontImageMutation.mutate({ 
                                    discoveryId: currentDiscovery.id, 
                                    plantId: plant.id 
                                  });
                                }}
                                className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all ${
                                  plant.allDiscoveries[imageIndexes[plant.id] || 0]?.is_front_image
                                    ? 'bg-amber-500 hover:bg-amber-600'
                                    : 'bg-white/80 hover:bg-white'
                                }`}
                                title="Als Hauptbild festlegen"
                              >
                                <Star 
                                  className={`w-4 h-4 ${
                                    plant.allDiscoveries[imageIndexes[plant.id] || 0]?.is_front_image
                                      ? 'text-white fill-white'
                                      : 'text-stone-600'
                                  }`}
                                />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {plant.description && (
                      <p className="text-stone-700">{plant.description}</p>
                    )}
                    {plant.identification_features && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-blue-900 mb-1">🔍 Erkennungsmerkmale:</p>
                        <p className="text-sm text-stone-700">{plant.identification_features}</p>
                      </div>
                    )}
                    {plant.fun_fact && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-amber-900 mb-1">💡 Wusstest du?</p>
                        <p className="text-sm text-stone-700">{plant.fun_fact}</p>
                      </div>
                    )}
                    {plant.discovery_date && (
                      <p className="text-sm text-stone-500">
                        Entdeckt am: {format(new Date(plant.discovery_date), "d. MMMM yyyy", { locale: de })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div 
                    className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 cursor-pointer"
                    style={{ perspective: 1000 }}
                    onClick={() => {
                      setFlippedPlants(prev => ({ ...prev, [plant.id]: true }));
                      setTimeout(() => {
                        setFlippedPlants(prev => ({ ...prev, [plant.id]: false }));
                      }, 3000);
                    }}
                  >
                    <motion.div 
                      className="absolute inset-0 flex items-center justify-center"
                      animate={{ rotateY: flippedPlants[plant.id] ? 180 : 0 }}
                      transition={{ duration: 0.6 }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <motion.div
                        className="absolute inset-0 flex flex-col items-center justify-center"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <Leaf className="w-16 h-16 text-stone-300 mb-3" strokeWidth={1.5} />
                        <p className="text-stone-500 font-semibold px-4 text-center text-sm">
                          {friendEmail ? "Noch nicht entdeckt" : "Klicke für Hinweis"}
                        </p>
                      </motion.div>
                      <motion.div
                        className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
                        style={{ 
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)"
                        }}
                      >
                        <p className="text-lg font-bold text-stone-700 mb-2">{plant.species_name}</p>
                        <p className="text-sm italic text-stone-600">{plant.scientific_name}</p>
                      </motion.div>
                    </motion.div>
                    
                    {!friendEmail && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://www.google.com/search?q=Wo+finde+ich+${encodeURIComponent(plant.species_name)}`, '_blank');
                        }}
                        className="absolute top-2 right-2 w-7 h-7 bg-stone-400 rounded-full flex items-center justify-center hover:bg-stone-500 transition-colors z-20"
                        title="Wo finde ich diese Pflanze?"
                      >
                        <HelpCircle className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}