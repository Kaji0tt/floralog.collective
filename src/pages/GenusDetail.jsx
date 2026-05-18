import React, { useState, useEffect, useRef } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Leaf, CheckCircle2, Lock, Sparkles, Volume2, VolumeX, ChevronLeft, ChevronRight, Star, HelpCircle, MapPin, X, ExternalLink, Trash2, Heart, PencilLine } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import MobileBackButton from "../components/navigation/MobileBackButton";
import EditPlantDialog from "../components/collection/EditPlantDialog";
import { useUiTheme } from "@/lib/UiThemeContext";

export default function GenusDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLightUi: contextIsLightUi } = useUiTheme();
  const urlParams = new URLSearchParams(window.location.search);
  const genusId = urlParams.get('id');
  const friendEmail = urlParams.get('email'); // NEU: Prüfe ob wir im Freundes-Kontext sind
  const targetDiscoveryId = urlParams.get('discoveryId');
  const [speakingPlantId, setSpeakingPlantId] = useState(null);
  const [imageIndexes, setImageIndexes] = useState({});
  const [flippedPlants, setFlippedPlants] = useState({});
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [expandedPlant, setExpandedPlant] = useState(null);
  const [editingPlant, setEditingPlant] = useState(null);
  const [locationNames, setLocationNames] = useState({});
  const [deleteConfirmDiscoveryId, setDeleteConfirmDiscoveryId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const geocodePendingRef = useRef(new Set());
  const geocodeByCoordsRef = useRef({});
  const deepLinkAppliedRef = useRef(false);

  const getDiscoveryTimestamp = (discovery) => {
    const raw = discovery?.discovered_date || discovery?.created_date || discovery?.created_at;
    const parsed = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      try {
        const user = await getCurrentUser();
        if (isMounted) {
          setCurrentUser(user || null);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      }
    };
    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

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

  useEffect(() => {
    if (currentUser?.background_color) {
      setAverageColor(currentUser.background_color);
    } else if (currentUser?.background_image_url) {
      getAverageColor(currentUser.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else {
      setAverageColor(null);
    }
  }, [currentUser?.background_image_url, currentUser?.background_color]);

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
  });

  // Wenn friendEmail gesetzt ist, laden wir das PublicProfile des Freundes,
  // um dessen auth_id zu erhalten (für RLS-kompatible Queries auf UserPlantDiscovery).
  const { data: friendProfile } = useQuery({
    queryKey: ['friendProfileForGenus', friendEmail],
    queryFn: async () => {
      if (!friendEmail) return null;
      const profiles = await Query.PublicProfile.list();
      return profiles.find(p => p.user_email?.toLowerCase() === friendEmail.toLowerCase()) || null;
    },
    enabled: !!friendEmail,
  });

  const isLightUi = friendEmail
    ? friendProfile?.ui_theme === "light"
    : contextIsLightUi;

  const { data: userDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ['userDiscoveries', friendEmail || currentUser?.id],
    queryFn: async () => {
      // Freundes-Kontext: Discoveries des Freundes über auth_id laden
      if (friendEmail) {
        if (friendProfile?.auth_id) {
          return Query.UserPlantDiscovery.filter({ auth_id: friendProfile.auth_id });
        }

        // Fallback: alte Discoveries über Email filtern (falls kein auth_id vorhanden)
        const discoveries = await Query.UserPlantDiscovery.list();
        return discoveries.filter(d => d.user === friendEmail || d.created_by === friendEmail);
      }

      // Eigene Discoveries über auth_id laden (wie in Collection.jsx)
      if (!currentUser?.id) {
        return [];
      }
      return Query.UserPlantDiscovery.filter({ auth_id: currentUser.id });
    },
    enabled: friendEmail ? (friendProfile !== undefined) : !!currentUser?.id,
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

    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (!isLocalhost) {
      setLocationNames((prev) => ({ ...prev, [discoveryId]: coords }));
      return;
    }

    const normalizedCoords = `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
    if (geocodeByCoordsRef.current[normalizedCoords]) {
      setLocationNames((prev) => ({ ...prev, [discoveryId]: geocodeByCoordsRef.current[normalizedCoords] }));
      return;
    }
    if (geocodePendingRef.current.has(normalizedCoords)) {
      return;
    }

    geocodePendingRef.current.add(normalizedCoords);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`
      );
      if (!response.ok) {
        throw new Error(`Reverse geocode failed: ${response.status}`);
      }
      const data = await response.json();
      const name = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || coords;
      geocodeByCoordsRef.current[normalizedCoords] = name;
      setLocationNames(prev => ({ ...prev, [discoveryId]: name }));
    } catch {
      setLocationNames(prev => ({ ...prev, [discoveryId]: coords }));
    } finally {
      geocodePendingRef.current.delete(normalizedCoords);
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
      const selectedDiscovery = userDiscoveries.find((d) => d.id === discoveryId);
      if (!selectedDiscovery) {
        throw new Error("Ausgewaehlter Scan nicht gefunden.");
      }

      // Alle Discoveries der gesamten Gattung auf false setzen
      const genusDiscoveries = userDiscoveries.filter(d => {
        const plant = plants.find(p => p.id === d.plant_id);
        return plant && selectedGenus && 
               plant.genus_category === selectedGenus.category && 
               plant.genus_number === selectedGenus.category_dex_number;
      });

      // Species-Frontbild nur innerhalb derselben Species zuruecksetzen.
      const speciesDiscoveries = genusDiscoveries.filter(
        (d) => d.plant_id === selectedDiscovery.plant_id
      );

      await Promise.allSettled(
        genusDiscoveries.map(d => 
          Query.UserPlantDiscovery.update(d.id, {
            is_front_image: false,
          })
        )
      );

      await Promise.allSettled(
        speciesDiscoveries.map((d) =>
          Query.UserPlantDiscovery.update(d.id, {
            is_species_front_image: false,
          })
        )
      );

      // Dann das ausgewählte auf true setzen
      await Query.UserPlantDiscovery.update(discoveryId, {
        is_front_image: true,
        is_species_front_image: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries', currentUser?.id] });
    },
    onError: (error) => {
      console.error("Fehler beim Setzen des Gattungsbilds:", error);
      const details = error?.message || error?.details || error?.hint || "Unbekannter Fehler";
      alert("Das Vorschaubild konnte nicht gesetzt werden: " + details);
    },
  });

  // Ehemalige Lieblingsscan-Funktion (Herz) wurde entfernt

  const deleteDiscoveryMutation = useMutation({
    mutationFn: async (discoveryId) => {
      await Query.UserPlantDiscovery.delete(discoveryId);
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
      const aIsFront = Boolean(a.is_front_image || a.is_species_front_image);
      const bIsFront = Boolean(b.is_front_image || b.is_species_front_image);
      if (aIsFront && !bIsFront) return -1;
      if (!aIsFront && bIsFront) return 1;
      return getDiscoveryTimestamp(b) - getDiscoveryTimestamp(a);
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

  useEffect(() => {
    if (!targetDiscoveryId || deepLinkAppliedRef.current) return;
    if (!Array.isArray(genusPlants) || genusPlants.length === 0) return;

    const matchingPlant = genusPlants.find((plant) =>
      Array.isArray(plant.allDiscoveries) && plant.allDiscoveries.some((discovery) => discovery.id === targetDiscoveryId)
    );
    if (!matchingPlant) return;

    const targetIndex = matchingPlant.allDiscoveries.findIndex((discovery) => discovery.id === targetDiscoveryId);
    if (targetIndex < 0) return;

    setExpandedPlant(matchingPlant);
    setImageIndexes((prev) => ({ ...prev, [matchingPlant.id]: targetIndex }));
    deepLinkAppliedRef.current = true;
  }, [genusPlants, targetDiscoveryId]);

  // Removed myGenusImages calculation as it was only for the icon selection dialog

  // Hole das Gattungsbild: Front-Image bevorzugt, sonst neuestes
  const genusDiscoveries = userDiscoveries.filter(d => {
    const plant = plants.find(p => p.id === d.plant_id);
    return plant && selectedGenus && 
           plant.genus_category === selectedGenus.category && 
           plant.genus_number === selectedGenus.category_dex_number && 
           d.image_url;
  });
  const genusIconUrl =
    genusDiscoveries.find((d) => d.is_front_image)?.image_url ||
    genusDiscoveries.find((d) => d.is_species_front_image)?.image_url ||
    [...genusDiscoveries].sort((a, b) => getDiscoveryTimestamp(b) - getDiscoveryTimestamp(a))[0]?.image_url;

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
    const backLabel = friendEmail ? "Zurück zum Freundes-Floralog" : "Zurück zur Sammlung";

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
      case "Selten": return "bg-fuchsia-500";
      case "Sehr Selten": return "bg-orange-500";
      case "Extrem Selten": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getRarityBorderColor = (rarity) => {
    switch (rarity) {
      case "Extrem Selten":
        return isLightUi ? "border-red-300" : "border-red-300/70";
      case "Sehr Selten":
        return isLightUi ? "border-orange-300" : "border-orange-300/70";
      case "Selten":
        return isLightUi ? "border-fuchsia-300" : "border-fuchsia-300/70";
      case "Gelegentlich":
        return isLightUi ? "border-green-300" : "border-emerald-300/60";
      case "Häufig":
      default:
        return isLightUi ? "border-stone-300" : "border-stone-500/60";
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

  // Bestimme Zurück-URL basierend auf Kontext
  const backUrl = friendEmail 
    ? createPageUrl(`FriendCollection?email=${friendEmail}`)
    : createPageUrl("Collection");
  const backLabel = friendEmail ? "Zurück zum Freundes-PlantDex" : "Zurück zur Sammlung";

  return (
    <div 
      className="min-h-screen p-4 md:p-8"
      style={{
        background: averageColor 
          ? (isLightUi
            ? `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)`
            : `linear-gradient(135deg, ${getDarkerColor(averageColor)} 0%, ${averageColor} 55%, ${getLighterColor(averageColor)} 100%)`)
          : (isLightUi
            ? 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
            : 'linear-gradient(to bottom right, rgb(17, 24, 21), rgb(24, 34, 29))')
      }}
    >
      <MobileBackButton backUrl={backUrl} />
      
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(backUrl)}
          className={"mb-6 font-semibold shadow-sm border hidden md:inline-flex " + (isLightUi
            ? "bg-white hover:bg-stone-50 text-stone-900 border-stone-200"
            : "bg-black/45 hover:bg-black/60 text-stone-100 border-[#f0e5a5]/35")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>

        {/* Header Card */}
        <Card className={"mb-6 border-2 shadow-md overflow-hidden " + (isLightUi
          ? "border-amber-200 bg-white"
          : "border-[#f0e5a5]/35 bg-black/40 backdrop-blur-sm")}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              {/* Bild links - größer und klickbar */}
              <div className="flex-shrink-0">
                {genusIconUrl ? (
                  <img
                    src={genusIconUrl}
                    alt={genus.genus_name}
                    onClick={() => setEnlargedImage(genusIconUrl)}
                    className={"w-28 h-28 md:w-32 md:h-32 object-cover rounded-xl shadow-md border-2 cursor-pointer hover:opacity-90 transition-opacity " + (isLightUi ? "border-stone-200" : "border-stone-700/70")}
                  />
                ) : (
                  <div className={"w-28 h-28 md:w-32 md:h-32 rounded-xl flex items-center justify-center border-2 " + (isLightUi
                    ? "bg-gradient-to-br from-stone-100 to-stone-200 border-stone-200"
                    : "bg-gradient-to-br from-stone-800/90 to-stone-900 border-stone-700/70")}>
                    <Leaf className={"w-12 h-12 " + (isLightUi ? "text-stone-400" : "text-stone-500")} />
                  </div>
                )}
              </div>
              
              {/* Info rechts */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={"font-bold text-xs px-2 py-0.5 " + (isLightUi ? "bg-stone-800 text-white" : "bg-[#f0e5a5]/20 text-[#f8f1c8] border border-[#f0e5a5]/30")}>
                    {genus.category === "Bäume" && "🌳"}
                    {genus.category === "Sträucher" && "🌿"}
                    {genus.category === "Blumen & Kräuter" && "🌸"}
                    #{String(genus.category_dex_number).padStart(3, '0')}
                  </Badge>
                  <Badge className={"text-xs px-2 py-0.5 " + (isLightUi ? "bg-green-600 text-white" : "bg-emerald-600/30 text-emerald-200 border border-emerald-400/35")}>
                    {discoveredSpecies.length}/{genusPlants.length}
                  </Badge>
                </div>
                <h1 className={"text-xl md:text-2xl font-bold " + (isLightUi ? "text-stone-900" : "text-[#f8f4d6]")}>
                  {genus.genus_name}
                </h1>
                <p className={"text-sm italic mb-2 " + (isLightUi ? "text-stone-600" : "text-stone-300")}>
                  {genus.scientific_genus}
                </p>
                {genus.family && (
                  <Badge variant="outline" className={"text-xs " + (isLightUi ? "" : "border-stone-500 text-stone-200")}>{genus.family}</Badge>
                )}
              </div>
            </div>
            
            {genus.description && (
              <p className={"text-sm mt-3 " + (isLightUi ? "text-stone-600" : "text-stone-300")}>{genus.description}</p>
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
                  ? `${getRarityBorderColor(plant.rarity)} hover:shadow-md ${isLightUi ? 'bg-white cursor-pointer' : 'bg-black/40 cursor-pointer'}`
                  : (isLightUi ? 'border-stone-200 bg-stone-50' : 'border-stone-700/60 bg-black/30')
              }`}
            >
              <CardContent className="p-3">
                <div className="space-y-3">
                    {/* Header mit Bild */}
                    <div className="flex gap-3">
                      {plant.allDiscoveries?.length > 0 && (
                        <div className="relative flex-shrink-0">
                          <img
                            src={plant.allDiscoveries[imageIndexes[plant.id] || 0]?.image_url || plant.userDiscovery.image_url}
                            alt={plant.species_name}
                            className={"w-20 h-20 object-cover rounded-lg shadow-sm border " + (isLightUi ? "border-stone-200" : "border-stone-700/70")}
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
                          <h3 className={"text-base font-bold truncate " + (isLightUi ? "text-stone-900" : "text-stone-100")}>{plant.species_name}</h3>
                          <p className={"text-xs italic truncate " + (isLightUi ? "text-stone-600" : "text-stone-300")}>{plant.scientific_name}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {currentUser?.role === "admin" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPlant(plant);
                              }}
                              className={"shrink-0 p-1.5 rounded-full border transition-colors " + (isLightUi
                                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800 border-amber-300"
                                : "bg-[#f0e5a5]/20 text-[#f0e5a5] hover:bg-[#f0e5a5]/30 border-[#f0e5a5]/45")}
                              aria-label="Art bearbeiten"
                            >
                              <PencilLine className="w-3 h-3" />
                            </button>
                          )}
                          {plant.discovered && (
                            <CheckCircle2 className={"w-5 h-5 flex-shrink-0 " + (isLightUi ? "text-green-600" : "text-emerald-300")} />
                          )}
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
                            className={"flex items-center gap-1 mt-1 text-xs " + (isLightUi ? "text-green-600 hover:text-green-700" : "text-emerald-300 hover:text-emerald-200")}
                          >
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{locationNames[plant.userDiscovery.id] || plant.userDiscovery.discovery_location}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                    
                    {/* Info Boxes kompakt */}
                    {plant.description && (
                      <p className={"text-xs line-clamp-2 " + (isLightUi ? "text-stone-600" : "text-stone-300")}>{plant.description}</p>
                    )}
                  </div>
                )
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
              className={"rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto " + (isLightUi ? "bg-white" : "bg-[#141916] border border-[#f0e5a5]/25")}
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
                        className={"absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg " + (isLightUi
                          ? "bg-white/90 hover:bg-white"
                          : "bg-black/65 hover:bg-black/80")}
                      >
                        <ChevronLeft className={"w-6 h-6 " + (isLightUi ? "text-stone-700" : "text-stone-100")} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentIndex = imageIndexes[expandedPlant.id] || 0;
                          const newIndex = currentIndex < expandedPlant.allDiscoveries.length - 1 ? currentIndex + 1 : 0;
                          setImageIndexes(prev => ({ ...prev, [expandedPlant.id]: newIndex }));
                        }}
                        className={"absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg " + (isLightUi
                          ? "bg-white/90 hover:bg-white"
                          : "bg-black/65 hover:bg-black/80")}
                      >
                        <ChevronRight className={"w-6 h-6 " + (isLightUi ? "text-stone-700" : "text-stone-100")} />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                        {(imageIndexes[expandedPlant.id] || 0) + 1} / {expandedPlant.allDiscoveries.length}
                      </div>
                    </>
                  )}
                  {/* Aktionen für eigene Discoveries */}
                  {!friendEmail && (
                    <>
                      {/* Front-Image nur sinnvoll, wenn es mehrere Scans in der Gattung gibt */}
                      {genusDiscoveries.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentDiscovery = expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0];
                            setFrontImageMutation.mutate({ discoveryId: currentDiscovery.id });
                          }}
                          className={`absolute bottom-3 left-3 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all backdrop-blur-sm ${
                            (expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0]?.is_front_image ||
                              expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0]?.is_species_front_image)
                              ? 'bg-amber-500/80 hover:bg-amber-600/80' 
                              : 'bg-white/60 hover:bg-white/80'
                          }`}
                          title="Als Gattungsbild festlegen"
                        >
                          <Star className={`w-5 h-5 ${
                            (expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0]?.is_front_image ||
                              expandedPlant.allDiscoveries[imageIndexes[expandedPlant.id] || 0]?.is_species_front_image)
                              ? 'text-white fill-white' 
                              : 'text-stone-600'
                          }`} />
                        </button>
                      )}

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
                    <h2 className={"text-xl font-bold " + (isLightUi ? "text-stone-900" : "text-stone-100")}>{expandedPlant.species_name}</h2>
                    <p className={"text-sm italic " + (isLightUi ? "text-stone-600" : "text-stone-300")}>{expandedPlant.scientific_name}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      onClick={() => speakPlantDescription(expandedPlant)}
                      variant="outline"
                      size="icon"
                      className={isLightUi ? "" : "border-stone-600 bg-black/40 hover:bg-black/60"}
                    >
                      {speakingPlantId === expandedPlant.id
                        ? <VolumeX className={"w-5 h-5 " + (isLightUi ? "text-green-600" : "text-emerald-300")} />
                        : <Volume2 className={"w-5 h-5 " + (isLightUi ? "text-stone-600" : "text-stone-200")} />}
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
                      className={"flex items-center gap-2 text-sm rounded-lg p-2 border " + (isLightUi
                        ? "text-green-600 hover:text-green-700 bg-green-50 border-green-100"
                        : "text-emerald-300 hover:text-emerald-200 bg-emerald-900/20 border-emerald-700/40")}
                    >
                      <MapPin className="w-4 h-4" />
                      <span>{locationNames[currentDiscovery.id] || coords}</span>
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    </Link>
                  );
                })()}
                
                {expandedPlant.description && (
                  <p className={"text-sm " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{expandedPlant.description}</p>
                )}
                
                {expandedPlant.identification_features && (
                  <div className={"border rounded-lg p-3 " + (isLightUi ? "bg-blue-50 border-blue-100" : "bg-blue-900/20 border-blue-700/45")}>
                    <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-blue-900" : "text-blue-200")}>🔍 Erkennungsmerkmale</p>
                    <p className={"text-sm " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{expandedPlant.identification_features}</p>
                  </div>
                )}
                
                {expandedPlant.fun_fact && (
                  <div className={"border rounded-lg p-3 " + (isLightUi ? "bg-amber-50 border-amber-100" : "bg-amber-900/20 border-amber-700/45")}>
                    <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-amber-900" : "text-amber-200")}>💡 Wusstest du?</p>
                    <p className={"text-sm " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{expandedPlant.fun_fact}</p>
                  </div>
                )}

                {expandedPlant.native_region && (
                  <div className={"border rounded-lg p-3 " + (isLightUi ? "bg-teal-50 border-teal-100" : "bg-teal-900/20 border-teal-700/45")}>
                    <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-teal-900" : "text-teal-200")}>🌍 Herkunft</p>
                    <p className={"text-sm " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{expandedPlant.native_region}</p>
                  </div>
                )}
                
                {expandedPlant.discovery_date && (
                  <p className={"text-xs " + (isLightUi ? "text-stone-500" : "text-stone-300") }>
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
              className={"rounded-2xl max-w-md w-full p-6 " + (isLightUi ? "bg-white" : "bg-[#141916] border border-red-500/30")}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className={"w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 " + (isLightUi ? "bg-red-100" : "bg-red-900/35 border border-red-500/35")}>
                  <Trash2 className={"w-8 h-8 " + (isLightUi ? "text-red-600" : "text-red-300")} />
                </div>
                <h3 className={"text-xl font-bold mb-2 " + (isLightUi ? "text-stone-900" : "text-stone-100")}>Scan löschen?</h3>
                <p className={"text-sm " + (isLightUi ? "text-stone-600" : "text-stone-300") }>
                  Möchtest du diesen Scan wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmDiscoveryId(null)}
                  className={"flex-1 " + (isLightUi ? "" : "border-stone-600 bg-black/35 text-stone-100 hover:bg-black/55")}
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

        <EditPlantDialog
          plant={editingPlant}
          isOpen={!!editingPlant}
          onClose={() => setEditingPlant(null)}
          onSaved={(updatedPlant) => {
            setEditingPlant((prev) => (prev && prev.id === updatedPlant.id ? { ...prev, ...updatedPlant } : prev));
            setExpandedPlant((prev) => {
              if (!prev || prev.id !== updatedPlant.id) return prev;
              return { ...prev, ...updatedPlant };
            });
          }}
        />
      </div>
    </div>
  );
}

