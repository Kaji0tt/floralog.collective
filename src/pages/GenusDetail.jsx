import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Leaf, CheckCircle2, Lock, Sparkles, Volume2, VolumeX, ChevronLeft, ChevronRight, Star, HelpCircle, MapPin, X, ExternalLink, Trash2, Heart } from "lucide-react";
import { Link } from "react-router-dom";
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
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [expandedPlant, setExpandedPlant] = useState(null);
  const [locationNames, setLocationNames] = useState({});
  const [deleteConfirmDiscoveryId, setDeleteConfirmDiscoveryId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

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

  // Koordinaten zu Ortsnamen umwandeln
  const getLocationName = async (coords, discoveryId) => {
    if (!coords || locationNames[discoveryId]) return;
    
    // Prüfe ob es Koordinaten sind (Format: "lat, lng")
    const coordMatch = coords.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (!coordMatch) {
      // Ist bereits ein Name
      setLocationNames(prev => ({ ...prev, [discoveryId]: coords }));
      return;
    }
    
    const [, lat, lng] = coordMatch;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`
      );
      const data = await response.json();
      const name = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || coords;
      setLocationNames(prev => ({ ...prev, [discoveryId]: name }));
    } catch {
      setLocationNames(prev => ({ ...prev, [discoveryId]: coords }));
    }
  };

  // Lade Ortsnamen für alle Discoveries
  React.useEffect(() => {
    userDiscoveries.forEach(d => {
      if (d.discovery_location) {
        getLocationName(d.discovery_location, d.id);
      }
    });
  }, [userDiscoveries]);

  const setFrontImageMutation = useMutation({
    mutationFn: async ({ discoveryId }) => {
      // Alle Discoveries der gesamten Gattung auf false setzen
      const genusDiscoveries = userDiscoveries.filter(d => {
        const plant = plants.find(p => p.id === d.plant_id);
        return plant && selectedGenus && 
               plant.genus_category === selectedGenus.category && 
               plant.genus_number === selectedGenus.category_dex_number;
      });
      await Promise.all(
        genusDiscoveries.map(d => 
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

  const deleteDiscoveryMutation = useMutation({
    mutationFn: async (discoveryId) => {
      await base44.entities.UserPlantDiscovery.delete(discoveryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
      setDeleteConfirmDiscoveryId(null);
      // Wenn das expandedPlant keine Discoveries mehr hat, schließe das Modal
      if (expandedPlant) {
        const remainingDiscoveries = expandedPlant.allDiscoveries.filter(d => d.id !== deleteConfirmDiscoveryId);
        if (remainingDiscoveries.length === 0) {
          setExpandedPlant(null);
        }
      }
    },
  });

  const setFavoritePlantMutation = useMutation({
    mutationFn: async (plantId) => {
      await base44.auth.updateMe({ favorite_plant_id: plantId });
    },
    onSuccess: async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      queryClient.invalidateQueries({ queryKey: ['user'] });
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
  const selectedGenus = genus;
  const genusPlants = plants.filter(p => 
    selectedGenus && p.genus_category === selectedGenus.category && p.genus_number === selectedGenus.category_dex_number
  ).map(plant => {
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
    return plant && selectedGenus && 
           plant.genus_category === selectedGenus.category && 
           plant.genus_number === selectedGenus.category_dex_number && 
           d.image_url;
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
        <Card className="mb-6 border-2 border-amber-200 shadow-md bg-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex gap-4">
              {/* Bild links - größer und klickbar */}
              <div className="flex-shrink-0">
                {genusIconUrl ? (
                  <img
                    src={genusIconUrl}
                    alt={genus.genus_name}
                    onClick={() => setEnlargedImage(genusIconUrl)}
                    className="w-28 h-28 md:w-32 md:h-32 object-cover rounded-xl shadow-md border-2 border-stone-200 cursor-pointer hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-28 h-28 md:w-32 md:h-32 bg-gradient-to-br from-stone-100 to-stone-200 rounded-xl flex items-center justify-center border-2 border-stone-200">
                    <Leaf className="w-12 h-12 text-stone-400" />
                  </div>
                )}
              </div>
              
              {/* Info rechts */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className="bg-stone-800 text-white font-bold text-xs px-2 py-0.5">
                    {genus.category === "Bäume" && "🌳"}
                    {genus.category === "Sträucher" && "🌿"}
                    {genus.category === "Blumen & Kräuter" && "🌸"}
                    #{String(genus.category_dex_number).padStart(3, '0')}
                  </Badge>
                  <Badge className="bg-green-600 text-white text-xs px-2 py-0.5">
                    {discoveredSpecies.length}/{genusPlants.length}
                  </Badge>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-stone-900">
                  {genus.genus_name}
                </h1>
                <p className="text-sm text-stone-600 italic mb-2">
                  {genus.scientific_genus}
                </p>
                {genus.family && (
                  <Badge variant="outline" className="text-xs">{genus.family}</Badge>
                )}
              </div>
            </div>
            
            {genus.description && (
              <p className="text-sm text-stone-600 mt-3">{genus.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Bild-Vollansicht Modal */}
        {enlargedImage && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setEnlargedImage(null)}
          >
            <img 
              src={enlargedImage} 
              alt="Vergrößerte Ansicht"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}

        {/* Icon Selection Dialog and related button are removed */}

        {/* Species Cards - Kompakt, klickbar für Vollansicht */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {genusPlants.map((plant) => (
            <Card
              key={plant.id}
              onClick={() => plant.discovered && setExpandedPlant(plant)}
              className={`border shadow-sm transition-all duration-300 overflow-hidden ${
                plant.discovered 
                  ? 'border-green-200 hover:shadow-md bg-white cursor-pointer' 
                  : 'border-stone-200 bg-stone-50'
              }`}
            >
              <CardContent className="p-3">
                {plant.discovered ? (
                  <div className="space-y-3">
                    {/* Header mit Bild */}
                    <div className="flex gap-3">
                      {plant.allDiscoveries?.length > 0 && (
                        <div className="relative flex-shrink-0">
                          <img
                            src={plant.allDiscoveries[imageIndexes[plant.id] || 0]?.image_url || plant.userDiscovery.image_url}
                            alt={plant.species_name}
                            className="w-20 h-20 object-cover rounded-lg shadow-sm border border-stone-200"
                          />
                          {plant.allDiscoveries.length > 1 && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full">
                              {plant.allDiscoveries.length}x
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-stone-900 truncate">{plant.species_name}</h3>
                          <p className="text-xs text-stone-600 italic truncate">{plant.scientific_name}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {!friendEmail && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFavoritePlantMutation.mutate(plant.id);
                              }}
                              className="w-7 h-7 flex items-center justify-center hover:scale-110 transition-transform"
                            >
                              <Heart 
                                className={`w-5 h-5 ${
                                  currentUser?.favorite_plant_id === plant.id 
                                    ? 'text-red-500 fill-red-500' 
                                    : 'text-stone-400 hover:text-red-500'
                                }`} 
                              />
                            </button>
                          )}
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        </div>
                        </div>
                        {plant.rarity && (
                          <Badge className={`mt-1 ${getRarityColor(plant.rarity)} text-white text-xs px-1.5 py-0`}>
                            {getRarityStars(plant.rarity)}
                          </Badge>
                        )}
                        {/* Fundort anzeigen - klickbar zur Karte */}
                        {plant.userDiscovery?.discovery_location && (
                          <Link
                            to={createPageUrl(`Map?lat=${plant.userDiscovery.discovery_location.split(',')[0]?.trim()}&lng=${plant.userDiscovery.discovery_location.split(',')[1]?.trim()}`)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 mt-1 text-xs text-green-600 hover:text-green-700"
                          >
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{locationNames[plant.userDiscovery.id] || plant.userDiscovery.discovery_location}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                    
                    {/* Info Boxes kompakt */}
                    {plant.description && (
                      <p className="text-xs text-stone-600 line-clamp-2">{plant.description}</p>
                    )}
                  </div>
                ) : (
                  <div 
                    className="relative h-32 rounded-lg overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 cursor-pointer flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFlippedPlants(prev => ({ ...prev, [plant.id]: true }));
                      setTimeout(() => setFlippedPlants(prev => ({ ...prev, [plant.id]: false })), 3000);
                    }}
                  >
                    {!flippedPlants[plant.id] ? (
                      <div className="text-center">
                        <Leaf className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                        <p className="text-xs text-stone-500">{friendEmail ? "Noch nicht entdeckt" : "Tippen für Hinweis"}</p>
                      </div>
                    ) : (
                      <div className="text-center px-3">
                        <p className="text-sm font-bold text-stone-700">{plant.species_name}</p>
                        <p className="text-xs italic text-stone-600">{plant.scientific_name}</p>
                      </div>
                    )}
                    {!friendEmail && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://www.google.com/search?q=Wo+finde+ich+${encodeURIComponent(plant.species_name)}`, '_blank');
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-stone-400 rounded-full flex items-center justify-center hover:bg-stone-500 z-10"
                      >
                        <HelpCircle className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Erweiterte Pflanzen-Ansicht Modal */}
        {expandedPlant && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setExpandedPlant(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Großes Bild */}
              {expandedPlant.allDiscoveries?.length > 0 && (
                <div className="relative">
                  <img
                    src={expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0]?.image_url || expandedPlant.userDiscovery?.image_url}
                    alt={expandedPlant.species_name}
                    className="w-full aspect-square object-cover rounded-t-2xl"
                  />
                  {/* Schließen Button */}
                  <button
                    onClick={() => setExpandedPlant(null)}
                    className="absolute top-3 right-3 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                  
                  {/* Bild-Navigation */}
                  {expandedPlant.allDiscoveries.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentIndex = imageIndexes[expandedPlant.id] || 0;
                          const newIndex = currentIndex > 0 ? currentIndex - 1 : expandedPlant.allDiscoveries.length - 1;
                          setImageIndexes(prev => ({ ...prev, [expandedPlant.id]: newIndex }));
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <ChevronLeft className="w-6 h-6 text-stone-700" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentIndex = imageIndexes[expandedPlant.id] || 0;
                          const newIndex = currentIndex < expandedPlant.allDiscoveries.length - 1 ? currentIndex + 1 : 0;
                          setImageIndexes(prev => ({ ...prev, [expandedPlant.id]: newIndex }));
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <ChevronRight className="w-6 h-6 text-stone-700" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                        {(imageIndexes[expandedPlant.id] || 0) + 1} / {expandedPlant.allDiscoveries.length}
                      </div>
                    </>
                  )}
                  {/* Front-Image Button - nur anzeigen wenn mehr als 1 Scan in der Gattung */}
                  {!friendEmail && genusDiscoveries.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentDiscovery = expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0];
                          setFrontImageMutation.mutate({ discoveryId: currentDiscovery.id });
                        }}
                        className={`absolute bottom-3 left-3 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all backdrop-blur-sm ${
                          expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0]?.is_front_image 
                            ? 'bg-amber-500/80 hover:bg-amber-600/80' 
                            : 'bg-white/60 hover:bg-white/80'
                        }`}
                        title="Als Gattungsbild festlegen"
                      >
                        <Star className={`w-5 h-5 ${
                          expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0]?.is_front_image 
                            ? 'text-white fill-white' 
                            : 'text-stone-600'
                        }`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentDiscovery = expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0];
                          setDeleteConfirmDiscoveryId(currentDiscovery.id);
                        }}
                        className="absolute bottom-3 right-3 w-10 h-10 bg-red-500/60 hover:bg-red-600/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg transition-all"
                        title="Scan löschen"
                      >
                        <Trash2 className="w-5 h-5 text-white" />
                      </button>
                    </>
                  )}
                </div>
              )}
              
              {/* Info-Bereich */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-stone-900">{expandedPlant.species_name}</h2>
                    <p className="text-sm text-stone-600 italic">{expandedPlant.scientific_name}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!friendEmail && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFavoritePlantMutation.mutate(expandedPlant.id);
                        }}
                        variant="outline"
                        size="icon"
                      >
                        <Heart 
                          className={`w-5 h-5 ${
                            currentUser?.favorite_plant_id === expandedPlant.id 
                              ? 'text-red-500 fill-red-500' 
                              : 'text-stone-600'
                          }`} 
                        />
                      </Button>
                    )}
                    <Button
                      onClick={() => speakPlantDescription(expandedPlant)}
                      variant="outline"
                      size="icon"
                    >
                      {speakingPlantId === expandedPlant.id ? <VolumeX className="w-5 h-5 text-green-600" /> : <Volume2 className="w-5 h-5 text-stone-600" />}
                    </Button>
                  </div>
                </div>
                
                {expandedPlant.rarity && (
                  <Badge className={`${getRarityColor(expandedPlant.rarity)} text-white`}>
                    {getRarityStars(expandedPlant.rarity)} {expandedPlant.rarity}
                  </Badge>
                )}
                
                {/* Fundort - klickbar zur Karte */}
                {expandedPlant.allDiscoveries?.[imageIndexes[expandedPlant.id] || 0]?.discovery_location && (() => {
                  const currentDiscovery = expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0];
                  const coords = currentDiscovery.discovery_location;
                  const [lat, lng] = coords.split(',').map(s => s.trim());
                  return (
                    <Link
                      to={createPageUrl(`Map?lat=${lat}&lng=${lng}`)}
                      className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 bg-green-50 rounded-lg p-2 border border-green-100"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>{locationNames[currentDiscovery.id] || coords}</span>
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    </Link>
                  );
                })()}
                
                {expandedPlant.description && (
                  <p className="text-sm text-stone-700">{expandedPlant.description}</p>
                )}
                
                {expandedPlant.identification_features && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-900 mb-1">🔍 Erkennungsmerkmale</p>
                    <p className="text-sm text-stone-700">{expandedPlant.identification_features}</p>
                  </div>
                )}
                
                {expandedPlant.fun_fact && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-900 mb-1">💡 Wusstest du?</p>
                    <p className="text-sm text-stone-700">{expandedPlant.fun_fact}</p>
                  </div>
                )}
                
                {expandedPlant.discovery_date && (
                  <p className="text-xs text-stone-500">
                    Entdeckt am: {format(new Date(expandedPlant.discovery_date), "d. MMMM yyyy", { locale: de })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lösch-Bestätigungs-Dialog */}
        {deleteConfirmDiscoveryId && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirmDiscoveryId(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-stone-900 mb-2">Scan löschen?</h3>
                <p className="text-sm text-stone-600">
                  Möchtest du diesen Scan wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmDiscoveryId(null)}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={() => deleteDiscoveryMutation.mutate(deleteConfirmDiscoveryId)}
                  disabled={deleteDiscoveryMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {deleteDiscoveryMutation.isPending ? 'Wird gelöscht...' : 'Löschen'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}