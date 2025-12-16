import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Users, TrendingUp, Clock, Leaf, Loader2, ChevronLeft, ChevronRight, X, Search, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { getCurrentWeeklyQuest, getWeekNumber } from "../components/quests/QuestRotationHelper";

// Leaflet Icon Setup
if (typeof window !== 'undefined') {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const createColoredIcon = (color) => {
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.125 12.5 28.125S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0z" 
            fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="12.5" cy="12.5" r="5" fill="#fff"/>
    </svg>
  `;
  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
};

const USER_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
];

const getColorForUser = (userEmail, allUsers) => {
  const index = allUsers.findIndex(u => u.user_email === userEmail);
  return USER_COLORS[index % USER_COLORS.length];
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const MapController = ({ center, zoom, bounds }) => {
  const map = useMap();
  React.useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    } else if (center) {
      map.setView(center, zoom || 13);
    }
  }, [center, zoom, bounds, map]);
  return null;
};

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

export default function Quests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("weekly");
  const [averageColor, setAverageColor] = useState(null);
  const [sortFilter, setSortFilter] = useState("newest");
  const [questExpanded, setQuestExpanded] = useState(false);
  const [selectedDiscovery, setSelectedDiscovery] = useState(null);
  const [imageIndexes, setImageIndexes] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlantForSighting, setSelectedPlantForSighting] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => base44.entities.WeeklyQuest.list('quest_number'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const users = await base44.entities.PublicProfile.list();
      return users.filter(u => u.weekly_tracking !== false);
    },
  });

  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => base44.entities.UserPlantDiscovery.list('-created_date'),
  });

  const { data: scanLikes = [] } = useQuery({
    queryKey: ['scanLikes'],
    queryFn: () => base44.entities.ScanLike.list(),
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const calculateLocation = () => {
    if (!navigator.geolocation) {
      alert("Standortdienste werden von deinem Browser nicht unterstützt.");
      return;
    }

    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLoadingLocation(false);
      },
      (error) => {
        console.log("Location error:", error);
        alert("Fehler beim Ermitteln des Standorts. Bitte erlaube den Standortzugriff.");
        setIsLoadingLocation(false);
      }
    );
  };

  useEffect(() => {
    if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else if (user?.background_color) {
      setAverageColor(user.background_color);
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

  const toggleLikeMutation = useMutation({
    mutationFn: async (discoveryId) => {
      const existingLike = scanLikes.find(
        like => like.discovery_id === discoveryId && like.liked_by === user.email
      );
      
      if (existingLike) {
        await base44.entities.ScanLike.delete(existingLike.id);
      } else {
        await base44.entities.ScanLike.create({
          discovery_id: discoveryId,
          liked_by: user.email,
          liked_date: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scanLikes'] });
    },
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);

  // Filtere Discoveries basierend auf wöchentlicher Quest
  const weeklyDiscoveries = currentWeeklyQuest ? allDiscoveries.filter(d => {
    // Nur Discoveries von Usern mit weekly_tracking
    const discoveryUser = allUsers.find(u => u.user_email === d.user || u.user_email === d.created_by);
    if (!discoveryUser) return false;

    const plant = plants.find(p => p.id === d.plant_id);
    if (!plant) return false;

    // Wenn target_species_name gesetzt ist, filtere nach Art
    if (currentWeeklyQuest.target_species_name) {
      return plant.species_name === currentWeeklyQuest.target_species_name;
    }

    // Wenn target_genus_name gesetzt ist, filtere nach Gattung
    if (currentWeeklyQuest.target_genus_name) {
      const genus = genera.find(g => 
        g.category === plant.genus_category && 
        g.category_dex_number === plant.genus_number
      );
      return genus?.genus_name === currentWeeklyQuest.target_genus_name;
    }

    // Wenn Kategorie gesetzt ist (aber keine spezifische Gattung/Art), filtere nach Kategorie
    if (currentWeeklyQuest.category && currentWeeklyQuest.category !== "Alle") {
      return plant.genus_category === currentWeeklyQuest.category;
    }

    return true;
  }) : [];

  // Sortierung anwenden
  let sortedDiscoveries = [...weeklyDiscoveries];
  if (sortFilter === "newest") {
    sortedDiscoveries.sort((a, b) => new Date(b.created_date || b.discovered_date) - new Date(a.created_date || a.discovered_date));
  } else if (sortFilter === "popular") {
    sortedDiscoveries.sort((a, b) => {
      const likesA = scanLikes.filter(like => like.discovery_id === a.id).length;
      const likesB = scanLikes.filter(like => like.discovery_id === b.id).length;
      return likesB - likesA;
    });
  } else if (sortFilter === "frequent") {
    // Gruppiere nach User und zähle Scans
    const userScanCounts = {};
    weeklyDiscoveries.forEach(d => {
      const userEmail = d.user || d.created_by;
      userScanCounts[userEmail] = (userScanCounts[userEmail] || 0) + 1;
    });
    
    sortedDiscoveries.sort((a, b) => {
      const userA = a.user || a.created_by;
      const userB = b.user || b.created_by;
      return userScanCounts[userB] - userScanCounts[userA];
    });
  }

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
    <div 
      className="min-h-screen"
      style={{
        background: averageColor 
          ? `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)`
          : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
      }}
    >
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-stone-200">
            <div className="max-w-7xl mx-auto">
              <TabsList className="grid w-full grid-cols-3 bg-white h-12 rounded-none border-0">
                <TabsTrigger value="weekly" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5">
                  🏆 Wöchentlich
                </TabsTrigger>
                <TabsTrigger value="local" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5">
                  📍 Lokal
                </TabsTrigger>
                <TabsTrigger value="sightings" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5">
                  🔍 Sichtungen
                </TabsTrigger>
              </TabsList>
              
              {activeTab === "weekly" && (
                <div className="flex gap-2 p-2 border-t border-stone-200">
                  <Button
                    onClick={() => setSortFilter("newest")}
                    variant={sortFilter === "newest" ? "default" : "outline"}
                    size="sm"
                    className={sortFilter === "newest" ? "bg-green-600 hover:bg-green-700 h-8" : "h-8"}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Neueste
                  </Button>
                  <Button
                    onClick={() => setSortFilter("popular")}
                    variant={sortFilter === "popular" ? "default" : "outline"}
                    size="sm"
                    className={sortFilter === "popular" ? "bg-green-600 hover:bg-green-700 h-8" : "h-8"}
                  >
                    <Heart className="w-3 h-3 mr-1" />
                    Beliebteste
                  </Button>
                  <Button
                    onClick={() => setSortFilter("frequent")}
                    variant={sortFilter === "frequent" ? "default" : "outline"}
                    size="sm"
                    className={sortFilter === "frequent" ? "bg-green-600 hover:bg-green-700 h-8" : "h-8"}
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Häufigste
                  </Button>
                </div>
              )}
            </div>
          </div>

          <MobileBackButton />

          {/* Wöchentliche Community Challenge */}
          <TabsContent value="weekly" className="pt-24 px-4 pb-4">
            {currentWeeklyQuest ? (
              <>
                {/* Kompakte Quest-Anzeige */}
                <div className="mb-3">
                  <button
                    onClick={() => setQuestExpanded(!questExpanded)}
                    className="w-full text-left px-3 py-2 bg-white/70 backdrop-blur-md rounded-full border border-emerald-200 hover:border-emerald-400 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-stone-900 truncate">
                          📆 KW {getWeekNumber().split('-W')[1]} · {currentWeeklyQuest.title}
                        </p>
                      </div>
                      <motion.div
                        animate={{ rotate: questExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      </motion.div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {questExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 mt-2 bg-white/90 backdrop-blur-md rounded-lg border border-emerald-200 shadow-sm">
                          <p className="text-sm text-stone-600 mb-3">{currentWeeklyQuest.description}</p>
                          
                          {currentWeeklyQuest.target_species_name && (
                            <Badge variant="outline" className="border-2 border-emerald-500 text-emerald-700 font-bold">
                              🎯 Ziel: {currentWeeklyQuest.target_species_name}
                            </Badge>
                          )}
                          {currentWeeklyQuest.target_genus_name && !currentWeeklyQuest.target_species_name && (
                            <Badge variant="outline" className="border-2 border-emerald-500 text-emerald-700 font-bold">
                              🎯 Ziel: {currentWeeklyQuest.target_genus_name}
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Scans Grid - Kompakt wie GenusCard */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {sortedDiscoveries.map((discovery, index) => {
                    const plant = plants.find(p => p.id === discovery.plant_id);
                    const genus = genera.find(g => 
                      plant && g.category === plant.genus_category && 
                      g.category_dex_number === plant.genus_number
                    );
                    const discoveryUser = allUsers.find(u => 
                      u.user_email === discovery.user || u.user_email === discovery.created_by
                    );
                    
                    // Finde alle Scans dieses Users für diese Pflanze in dieser Woche
                    const userEmail = discovery.user || discovery.created_by;
                    const userPlantScans = weeklyDiscoveries.filter(d => 
                      (d.user === userEmail || d.created_by === userEmail) && 
                      d.plant_id === discovery.plant_id
                    );
                    
                    const likeCount = scanLikes.filter(like => like.discovery_id === discovery.id).length;
                    const isLiked = scanLikes.some(
                      like => like.discovery_id === discovery.id && like.liked_by === user.email
                    );

                    return (
                      <motion.div
                        key={discovery.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <Card 
                          className="border-2 border-stone-200 hover:border-green-300 hover:shadow-md transition-all bg-white overflow-hidden cursor-pointer"
                          onClick={() => setSelectedDiscovery({ discovery, allScans: userPlantScans, plant, genus, discoveryUser })}
                        >
                          {discovery.image_url && (
                            <div className="relative aspect-square">
                              <img
                                src={discovery.image_url}
                                alt={plant?.species_name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLikeMutation.mutate(discovery.id);
                                }}
                                disabled={toggleLikeMutation.isPending}
                                className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                              >
                                <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-stone-600'}`} />
                              </button>
                              {likeCount > 0 && (
                                <div className="absolute bottom-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-bold text-stone-900 shadow-md">
                                  {likeCount}
                                </div>
                              )}
                            </div>
                          )}
                          <CardContent className="p-2">
                            <div className="flex items-center justify-between gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(createPageUrl(`FriendProfile?email=${discoveryUser?.user_email}`));
                                }}
                                className="flex items-center gap-1 hover:opacity-70 transition-opacity flex-1 min-w-0"
                              >
                                <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                  {discoveryUser?.avatar_url ? (
                                    <img src={discoveryUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    <Users className="w-3 h-3 text-white" />
                                  )}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                  <p className="text-[10px] font-semibold text-stone-900 truncate">
                                    {discoveryUser?.display_name || discoveryUser?.full_name || 'Unbekannt'}
                                  </p>
                                </div>
                              </button>
                              {userPlantScans.length > 1 && (
                                <div className="px-1.5 py-0.5 bg-green-100 rounded-full text-[10px] font-bold text-green-700 flex-shrink-0">
                                  {userPlantScans.length}x
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                {sortedDiscoveries.length === 0 && (
                  <div className="text-center py-20">
                    <Leaf className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-stone-900 mb-2">
                      Noch keine Scans diese Woche
                    </h3>
                    <p className="text-stone-600">
                      Sei der Erste und scanne eine passende Pflanze!
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <Leaf className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-stone-900 mb-2">
                  Keine wöchentliche Challenge aktiv
                </h3>
              </div>
            )}
          </TabsContent>

          <MobileBackButton />

          {/* Lokal Tab */}
          <TabsContent value="local" className="pt-24 px-4 pb-4">
            {!userLocation ? (
              <div className="text-center py-20">
                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                  <MapPin className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-stone-900 mb-2">Standort ermitteln</h3>
                  <p className="text-stone-600 mb-6">Erlaube den Standortzugriff, um Scans in deiner Nähe zu sehen</p>
                  <Button
                    onClick={calculateLocation}
                    disabled={isLoadingLocation}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isLoadingLocation ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Standort wird ermittelt...
                      </>
                    ) : (
                      <>
                        <MapPin className="w-5 h-5 mr-2" />
                        Standort berechnen
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-[calc(100vh-160px)] rounded-xl overflow-hidden border-2 border-stone-200 shadow-lg">
                <MapContainer
                  center={[userLocation.lat, userLocation.lng]}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  
                  {allDiscoveries
                    .filter(d => {
                      const discoveryUser = allUsers.find(u => u.user_email === d.user || u.user_email === d.created_by);
                      if (!discoveryUser || discoveryUser.local_tracking === false) return false;
                      
                      if (!d.discovery_location) return false;
                      const coords = d.discovery_location.split(',');
                      if (coords.length !== 2) return false;
                      const lat = parseFloat(coords[0].trim());
                      const lng = parseFloat(coords[1].trim());
                      if (isNaN(lat) || isNaN(lng)) return false;
                      
                      const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
                      return distance <= 20;
                    })
                    .map((discovery) => {
                      const coords = discovery.discovery_location.split(',');
                      const lat = parseFloat(coords[0].trim());
                      const lng = parseFloat(coords[1].trim());
                      const plant = plants.find(p => p.id === discovery.plant_id);
                      const discoveryUser = allUsers.find(u => u.user_email === discovery.user || u.user_email === discovery.created_by);
                      const userColor = getColorForUser(discoveryUser?.user_email, allUsers);
                      
                      return (
                        <Marker
                          key={discovery.id}
                          position={[lat, lng]}
                          icon={createColoredIcon(userColor)}
                        >
                          <Popup>
                            <div className="text-sm">
                              <p className="font-bold">{plant?.species_name}</p>
                              <p className="text-xs italic text-stone-600">{plant?.scientific_name}</p>
                              <p className="text-xs text-stone-500 mt-1">
                                von {discoveryUser?.display_name || discoveryUser?.full_name}
                              </p>
                              {discovery.image_url && (
                                <img src={discovery.image_url} alt="" className="w-32 h-32 object-cover mt-2 rounded" />
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                    
                  <Marker position={[userLocation.lat, userLocation.lng]} icon={createColoredIcon('#ef4444')}>
                    <Popup>
                      <p className="text-sm font-bold">📍 Dein Standort</p>
                    </Popup>
                  </Marker>
                  </MapContainer>
                  </div>
                  )}
                  </TabsContent>

          <MobileBackButton />

          {/* Sichtungen Tab */}
          <TabsContent value="sightings" className="pt-24 px-4 pb-4">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  type="text"
                  placeholder="Suche nach Art oder Gattung..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/70 backdrop-blur-md border-stone-200"
                />
              </div>
              
              {searchQuery.length > 1 && !selectedPlantForSighting && (
                <div className="mt-2 bg-white/90 backdrop-blur-md rounded-lg border border-stone-200 shadow-lg max-h-60 overflow-y-auto">
                  {genera
                    .filter(g => 
                      g.genus_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      g.scientific_genus?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .slice(0, 5)
                    .map(genus => (
                      <button
                        key={`genus-${genus.id}`}
                        onClick={() => setSelectedPlantForSighting({ type: 'genus', data: genus })}
                        className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0"
                      >
                        <p className="text-sm font-bold text-stone-900">{genus.genus_name}</p>
                        <p className="text-xs text-stone-500">Gattung · {genus.scientific_genus}</p>
                      </button>
                    ))}
                  {plants
                    .filter(p => 
                      p.species_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.scientific_name?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .slice(0, 5)
                    .map(plant => (
                      <button
                        key={`plant-${plant.id}`}
                        onClick={() => setSelectedPlantForSighting({ type: 'species', data: plant })}
                        className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0"
                      >
                        <p className="text-sm font-bold text-stone-900">{plant.species_name}</p>
                        <p className="text-xs text-stone-500">Art · {plant.scientific_name}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {selectedPlantForSighting && (
              <div className="mb-4">
                <div className="flex items-center justify-between p-3 bg-white/90 backdrop-blur-md rounded-full border border-green-200">
                  <div>
                    <p className="text-sm font-bold text-stone-900">
                      {selectedPlantForSighting.type === 'genus' 
                        ? selectedPlantForSighting.data.genus_name 
                        : selectedPlantForSighting.data.species_name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {selectedPlantForSighting.type === 'genus' ? 'Gattung' : 'Art'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPlantForSighting(null);
                      setSearchQuery("");
                    }}
                    className="h-8"
                  >
                    Ändern
                  </Button>
                </div>
              </div>
            )}

            {selectedPlantForSighting ? (
              <div className="h-[calc(100vh-240px)] rounded-xl overflow-hidden border-2 border-stone-200 shadow-lg">
                <MapContainer
                  center={userLocation ? [userLocation.lat, userLocation.lng] : [51.1657, 10.4515]}
                  zoom={6}
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  
                  {(() => {
                    const relevantDiscoveries = selectedPlantForSighting.type === 'genus'
                      ? allDiscoveries.filter(d => {
                          const plant = plants.find(p => p.id === d.plant_id);
                          return plant && 
                            plant.genus_category === selectedPlantForSighting.data.category &&
                            plant.genus_number === selectedPlantForSighting.data.category_dex_number &&
                            d.discovery_location;
                        })
                      : allDiscoveries.filter(d => 
                          d.plant_id === selectedPlantForSighting.data.id && d.discovery_location
                        );
                    
                    const bounds = relevantDiscoveries
                      .filter(d => {
                        const coords = d.discovery_location.split(',');
                        return coords.length === 2 && !isNaN(parseFloat(coords[0])) && !isNaN(parseFloat(coords[1]));
                      })
                      .map(d => {
                        const coords = d.discovery_location.split(',');
                        return [parseFloat(coords[0].trim()), parseFloat(coords[1].trim())];
                      });
                    
                    return (
                      <>
                        {bounds.length > 0 && <MapController bounds={bounds} />}
                        {relevantDiscoveries.map((discovery) => {
                          const coords = discovery.discovery_location.split(',');
                          if (coords.length !== 2) return null;
                          const lat = parseFloat(coords[0].trim());
                          const lng = parseFloat(coords[1].trim());
                          if (isNaN(lat) || isNaN(lng)) return null;
                          
                          const plant = plants.find(p => p.id === discovery.plant_id);
                          const discoveryUser = allUsers.find(u => u.user_email === discovery.user || u.user_email === discovery.created_by);
                          const userColor = getColorForUser(discoveryUser?.user_email, allUsers);
                          
                          return (
                            <Marker
                              key={discovery.id}
                              position={[lat, lng]}
                              icon={createColoredIcon(userColor)}
                            >
                              <Popup>
                                <div className="text-sm">
                                  <p className="font-bold">{plant?.species_name}</p>
                                  <p className="text-xs italic text-stone-600">{plant?.scientific_name}</p>
                                  <p className="text-xs text-stone-500 mt-1">
                                    von {discoveryUser?.display_name || discoveryUser?.full_name}
                                  </p>
                                  {discovery.image_url && (
                                    <img src={discovery.image_url} alt="" className="w-32 h-32 object-cover mt-2 rounded" />
                                  )}
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </>
                    );
                  })()}
                </MapContainer>
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                  <Search className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-stone-900 mb-2">Suche eine Pflanze</h3>
                  <p className="text-stone-600">Gib eine Art oder Gattung ein, um alle Sichtungen zu sehen</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Vergrößerte Ansicht Modal */}
        {selectedDiscovery && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDiscovery(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Großes Bild */}
              {selectedDiscovery.allScans?.length > 0 && (
                <div className="relative">
                  <img
                    src={selectedDiscovery.allScans[imageIndexes[selectedDiscovery.discovery.id] || 0]?.image_url || selectedDiscovery.discovery.image_url}
                    alt={selectedDiscovery.plant?.species_name}
                    className="w-full aspect-square object-cover rounded-t-2xl"
                  />
                  
                  {/* Schließen Button */}
                  <button
                    onClick={() => setSelectedDiscovery(null)}
                    className="absolute top-3 right-3 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                  
                  {/* Bild-Navigation */}
                  {selectedDiscovery.allScans.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentIndex = imageIndexes[selectedDiscovery.discovery.id] || 0;
                          const newIndex = currentIndex > 0 ? currentIndex - 1 : selectedDiscovery.allScans.length - 1;
                          setImageIndexes(prev => ({ ...prev, [selectedDiscovery.discovery.id]: newIndex }));
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <ChevronLeft className="w-6 h-6 text-stone-700" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentIndex = imageIndexes[selectedDiscovery.discovery.id] || 0;
                          const newIndex = currentIndex < selectedDiscovery.allScans.length - 1 ? currentIndex + 1 : 0;
                          setImageIndexes(prev => ({ ...prev, [selectedDiscovery.discovery.id]: newIndex }));
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <ChevronRight className="w-6 h-6 text-stone-700" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                        {(imageIndexes[selectedDiscovery.discovery.id] || 0) + 1} / {selectedDiscovery.allScans.length}
                      </div>
                    </>
                  )}

                  {/* Like Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentScan = selectedDiscovery.allScans[imageIndexes[selectedDiscovery.discovery.id] || 0];
                      toggleLikeMutation.mutate(currentScan.id);
                    }}
                    className="absolute bottom-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                  >
                    <Heart className={`w-5 h-5 ${
                      scanLikes.some(like => 
                        like.discovery_id === (selectedDiscovery.allScans[imageIndexes[selectedDiscovery.discovery.id] || 0]?.id) && 
                        like.liked_by === user.email
                      ) ? 'fill-red-500 text-red-500' : 'text-stone-600'
                    }`} />
                  </button>
                </div>
              )}
              
              {/* Info-Bereich */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-stone-900">{selectedDiscovery.plant?.species_name}</h2>
                    <p className="text-sm text-stone-600 italic">{selectedDiscovery.plant?.scientific_name}</p>
                    {selectedDiscovery.genus && (
                      <Badge variant="outline" className="mt-2">
                        {selectedDiscovery.genus.genus_name}
                      </Badge>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => navigate(createPageUrl(`FriendProfile?email=${selectedDiscovery.discoveryUser?.user_email}`))}
                  className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors w-full"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                    {selectedDiscovery.discoveryUser?.avatar_url ? (
                      <img src={selectedDiscovery.discoveryUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-stone-900">
                      {selectedDiscovery.discoveryUser?.display_name || selectedDiscovery.discoveryUser?.full_name || 'Unbekannt'}
                    </p>
                    <p className="text-xs text-stone-500">
                      {selectedDiscovery.allScans.length} {selectedDiscovery.allScans.length === 1 ? 'Scan' : 'Scans'} diese Woche
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-stone-600">
                    <Heart className="w-4 h-4" />
                    <span>
                      {scanLikes.filter(like => 
                        like.discovery_id === (selectedDiscovery.allScans[imageIndexes[selectedDiscovery.discovery.id] || 0]?.id)
                      ).length} Likes
                    </span>
                  </div>
                  <span className="text-stone-400">•</span>
                  <p className="text-xs text-stone-500">
                    {format(new Date(selectedDiscovery.discovery.created_date || selectedDiscovery.discovery.discovered_date), "d. MMMM yyyy, HH:mm", { locale: de })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}