import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Users, TrendingUp, Clock, Leaf, Loader2, ChevronLeft, ChevronRight, X, Search, MapPin, BarChart3, Award } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import MobileBackButton from "../components/navigation/MobileBackButton";
import SearchSortBar from "../components/collection/SearchSortBar";
import { getCurrentWeeklyQuest, getWeekNumber, getCurrentWeekBounds } from "../components/quests/QuestRotationHelper";

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

  const [questExpanded, setQuestExpanded] = useState(false);
  const [selectedDiscovery, setSelectedDiscovery] = useState(null);
  const [imageIndexes, setImageIndexes] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionsSort, setCollectionsSort] = useState("newest"); // "title" | "newest" | "followers" | "items"
  const [selectedPlantForSighting, setSelectedPlantForSighting] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const collectionsSortOptions = [
    { value: "newest", label: "Neu" },
    { value: "title", label: "Titel" },
    { value: "followers", label: "Follower" },
    { value: "items", label: "Pflanzen" },
  ];

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => Query.WeeklyQuest.list('quest_number'),
  });

  const { data: allCollections = [] } = useQuery({
    queryKey: ['allCollections'],
    queryFn: () => Query.Collection.list(),
  });

  const { data: allCollectionItems = [] } = useQuery({
    queryKey: ['allCollectionItems'],
    queryFn: () => Query.CollectionItem.list(),
  });

  const { data: userCollections = [] } = useQuery({
    queryKey: ['userCollections', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return Query.UserCollection.filter({ auth_id: user.id });
    },
    enabled: !!user?.id,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const users = await Query.PublicProfile.list();
      return users.filter(u => u.weekly_tracking !== false);
    },
  });

  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => Query.UserPlantDiscovery.list('-created_date'),
  });

  const { data: scanLikes = [] } = useQuery({
    queryKey: ['scanLikes'],
    queryFn: () => Query.ScanLike.list(),
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
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
    if (user?.background_color) {
      setAverageColor(user.background_color);
    } else if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
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
        await Query.ScanLike.delete(existingLike.id);
      } else {
        await Query.ScanLike.create({
          auth_id: user.id,
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

  const followCollectionMutation = useMutation({
    mutationFn: async (collectionId) => {
      if (!user?.id) return null;

      // Avoid duplicate follow rows when a collection is already followed.
      const existing = await Query.UserCollection.filter({
        auth_id: user.id,
        collection_id: collectionId,
      });

      if (existing?.length) return existing[0];

      return Query.UserCollection.create({
        auth_id: user.id,
        collection_id: collectionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCollections', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['allCollections'] });
    },
  });

  const unfollowCollectionMutation = useMutation({
    mutationFn: async (userCollectionId) => {
      return Query.UserCollection.delete(userCollectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCollections', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['allCollections'] });
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
  const { weekStart, weekEnd } = getCurrentWeekBounds();

  // Filtere Discoveries basierend auf wöchentlicher Quest
  const weeklyDiscoveries = currentWeeklyQuest ? allDiscoveries.filter(d => {
    // Nur Discoveries von Usern mit weekly_tracking
    const discoveryUser = allUsers.find(u => u.user_email === d.user || u.user_email === d.created_by);
    if (!discoveryUser) return false;

    // Prüfe ob der Scan in der aktuellen Kalenderwoche erstellt wurde
    const scanDate = new Date(d.created_date || d.discovered_date);
    if (scanDate < weekStart || scanDate > weekEnd) return false;

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

  // Sortierung: Immer nach Neuesten
  let sortedDiscoveries = [...weeklyDiscoveries];
  sortedDiscoveries.sort((a, b) => new Date(b.created_date || b.discovered_date) - new Date(a.created_date || a.discovered_date));

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

  const userCollectionByCollectionId = new Map(
    (userCollections || [])
      .filter((uc) => uc?.collection_id)
      .map((uc) => [uc.collection_id, uc])
  );

  const isCollectionTogglePending =
    followCollectionMutation.isPending || unfollowCollectionMutation.isPending;

  const handleCollectionFollowToggle = (collection) => {
    if (!collection?.id || !user?.id) return;
    if (collection.auth_id === user.id) return;

    const existingLink = userCollectionByCollectionId.get(collection.id);
    if (existingLink?.id) {
      unfollowCollectionMutation.mutate(existingLink.id);
      return;
    }

    followCollectionMutation.mutate(collection.id);
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
                <TabsTrigger value="weekly" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  🎯 Aufgaben
                </TabsTrigger>
                <TabsTrigger value="collections" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  🌿 Kollektionen
                </TabsTrigger>
                <TabsTrigger value="stats" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  📊 Statistiken
                </TabsTrigger>
              </TabsList>
              

            </div>
          </div>

          {/* Wöchentliche Community Challenge */}
          <TabsContent value="weekly" className="pt-14 px-4 pb-20">
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

          {/* Kollektionen Tab */}
          <TabsContent value="collections" className="pt-14 px-4 pb-20">
            <div className="max-w-3xl mx-auto space-y-3">
              <SearchSortBar
                placeholder="Titel, Beschreibung oder Owner durchsuchen..."
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                sortOptions={collectionsSortOptions}
                sortValue={collectionsSort}
                onSortChange={setCollectionsSort}
              />

              <div className="space-y-2">
                {(() => {
                  const publicCollections = (allCollections || []).filter((c) => c.is_public);

                  if (!publicCollections.length) {
                    return (
                      <div className="text-center py-16 bg-white/60 rounded-2xl border border-dashed border-stone-200">
                        <Leaf className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                        <h3 className="text-base font-semibold text-stone-800 mb-1">
                          Noch keine öffentlichen Kollektionen
                        </h3>
                        <p className="text-[13px] text-stone-500 max-w-sm mx-auto">
                          Markiere deine Kollektionen als öffentlich, damit andere sie im Community-Bereich entdecken können.
                        </p>
                      </div>
                    );
                  }

                  const normalized = searchQuery.trim().toLowerCase();

                  const itemCounts = {};
                  (allCollectionItems || []).forEach((item) => {
                    if (!item.collection_id) return;
                    itemCounts[item.collection_id] = (itemCounts[item.collection_id] || 0) + 1;
                  });

                  const userDiscoveries = (allDiscoveries || []).filter((d) =>
                    d.auth_id === user?.id ||
                    d.user === user?.email ||
                    d.created_by === user?.email ||
                    d.user_email === user?.email
                  );
                  const discoveredPlantIds = new Set(
                    userDiscoveries.map((d) => d.plant_id).filter(Boolean)
                  );

                  const userProgressByCollection = {};
                  publicCollections.forEach((c) => {
                    const itemsForCollection = (allCollectionItems || []).filter(
                      (item) => item.collection_id === c.id
                    );

                    const totalRequired = itemsForCollection.length;
                    let discoveredRequired = 0;

                    itemsForCollection.forEach((item) => {
                      let isDiscovered = false;

                      if (item.plant_id) {
                        isDiscovered = discoveredPlantIds.has(item.plant_id);
                      } else if (item.genus_id) {
                        const targetGenus = (genera || []).find((g) => g.id === item.genus_id);
                        if (targetGenus) {
                          isDiscovered = (plants || []).some(
                            (p) =>
                              p.genus_category === targetGenus.category &&
                              p.genus_number === targetGenus.category_dex_number &&
                              discoveredPlantIds.has(p.id)
                          );
                        }
                      }

                      if (isDiscovered) discoveredRequired += 1;
                    });

                    userProgressByCollection[c.id] = {
                      discovered: discoveredRequired,
                      total: totalRequired,
                    };
                  });

                  const collectionsWithMeta = publicCollections.map((c) => {
                    const owner = (allUsers || []).find((u) => u.auth_id === c.auth_id);
                    const ownerName = owner?.display_name || owner?.full_name || owner?.user_email || "Unbekannt";
                    const items = itemCounts[c.id] || 0;
                    const followers = c.followers_count ?? 0;
                    const progress = userProgressByCollection[c.id] || { discovered: 0, total: items };
                    const isOwnCollection = c.auth_id === user?.id;
                    const userCollectionLink = userCollectionByCollectionId.get(c.id) || null;
                    const isFollowing = !!userCollectionLink && !isOwnCollection;
                    return {
                      ...c,
                      ownerName,
                      items,
                      followers,
                      progress,
                      isOwnCollection,
                      isFollowing,
                      userCollectionLink,
                    };
                  });

                  let filtered = collectionsWithMeta;
                  if (normalized) {
                    filtered = filtered.filter((c) => {
                      const inTitle = (c.title || "").toLowerCase().includes(normalized);
                      const inDesc = (c.description || "").toLowerCase().includes(normalized);
                      const inOwner = (c.ownerName || "").toLowerCase().includes(normalized);
                      return inTitle || inDesc || inOwner;
                    });
                  }

                  filtered = [...filtered];
                  if (collectionsSort === 'title') {
                    filtered.sort((a, b) => (a.title || "").localeCompare(b.title || "", 'de')); 
                  } else if (collectionsSort === 'followers') {
                    filtered.sort((a, b) => (b.followers || 0) - (a.followers || 0));
                  } else if (collectionsSort === 'items') {
                    filtered.sort((a, b) => (b.items || 0) - (a.items || 0));
                  } else {
                    // newest
                    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                  }

                  const followedCollections = filtered.filter((c) => c.isFollowing);
                  const discoverableCollections = filtered.filter((c) => !c.isFollowing);
                  const defaultBg = 'rgba(255,255,255,0.95)';

                  const renderCollectionCard = (c) => {
                    const accent = c.background_color || 'rgb(34,197,94)';
                    const background = `linear-gradient(to left, ${accent} 0%, ${accent} 35%, ${defaultBg} 70%, ${defaultBg} 100%)`;

                    return (
                      <div key={c.id} className="w-full">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(createPageUrl(`Collection?collectionId=${c.id}&from=quests`))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(createPageUrl(`Collection?collectionId=${c.id}&from=quests`));
                            }
                          }}
                          className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
                          style={{ background }}
                        >
                          <div className="p-3 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-stone-600 mb-0.5 truncate">
                                {c.ownerName}
                              </div>
                              <div className="text-sm font-semibold text-stone-900 truncate mb-0.5">
                                {c.title}
                              </div>
                              <div className="text-[11px] text-emerald-700 font-medium mb-0.5">
                                Fortschritt: {c.progress.discovered}/{c.progress.total}
                              </div>
                              {c.description && (
                                <div className="text-[11px] text-stone-600 line-clamp-2">
                                  {c.description}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1 text-[11px] text-stone-700 flex-shrink-0">
                              <div className="flex items-center gap-1 bg-white/70 rounded-full px-2 py-0.5">
                                <Leaf className="w-3 h-3 text-emerald-600" />
                                <span>{c.items}</span>
                                <span className="text-[10px] text-stone-400">Pflanzen</span>
                              </div>
                              <div className="flex items-center gap-1 bg-white/70 rounded-full px-2 py-0.5">
                                <Users className="w-3 h-3 text-sky-600" />
                                <span>{c.followers}</span>
                                <span className="text-[10px] text-stone-400">Follower</span>
                              </div>
                              {!c.isOwnCollection && (
                                <button
                                  type="button"
                                  disabled={isCollectionTogglePending}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCollectionFollowToggle(c);
                                  }}
                                  className="flex items-center gap-1 bg-white/70 rounded-full px-2 py-0.5 border border-transparent hover:bg-white/90 hover:border-emerald-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  <Users className={`w-3 h-3 ${c.isFollowing ? 'text-emerald-600' : 'text-stone-500'}`} />
                                  <span className="text-[10px] text-stone-500">
                                    {c.isFollowing ? 'Abo beenden' : 'Abonnieren'}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-3">
                      {followedCollections.length > 0 && (
                        <div className="space-y-2">
                          <div className="px-1">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Deine Abos</h3>
                          </div>
                          <div className="space-y-2">
                            {followedCollections.map((c) => renderCollectionCard(c))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="px-1">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-700">Öffentliche Kollektionen</h3>
                        </div>
                        <div className="space-y-2">
                          {discoverableCollections.length > 0 ? (
                            discoverableCollections.map((c) => renderCollectionCard(c))
                          ) : (
                            <div className="text-center py-6 bg-white/60 rounded-xl border border-dashed border-stone-200 text-[12px] text-stone-500">
                              Aktuell keine weiteren öffentlichen Kollektionen.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </TabsContent>

            {/* Statistiken Tab */}
          <TabsContent value="stats" className="pt-14 px-4 pb-20">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {/* Häufigste Scans (Insgesamt) */}
                <Card className="border-2 border-stone-200 bg-white/90 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-600" />
                      Häufigste Scans
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(() => {
                      const plantCounts = {};
                      allDiscoveries.forEach(d => {
                        if (!plantCounts[d.plant_id]) plantCounts[d.plant_id] = 0;
                        plantCounts[d.plant_id]++;
                      });
                      
                      const topPlants = Object.entries(plantCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3);
                      
                      if (topPlants.length === 0) {
                        return (
                          <div className="text-center py-6 text-stone-500 text-sm">
                            Noch keine Scans vorhanden
                          </div>
                        );
                      }
                      
                      return topPlants.map(([plantId, count], index) => {
                        const plant = plants.find(p => p.id === plantId);
                        return (
                          <div key={plantId} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                index === 0 ? 'bg-amber-500 text-white' :
                                index === 1 ? 'bg-stone-300 text-stone-700' :
                                'bg-orange-300 text-orange-800'
                              }`}>
                                {index + 1}
                              </div>
                              <span className="text-sm font-semibold text-stone-900 truncate">
                                {plant?.species_name || 'Unbekannt'}
                              </span>
                            </div>
                            <Badge className="bg-amber-600 text-white text-xs px-2 py-0">
                              {count}x
                            </Badge>
                          </div>
                        );
                      });
                    })()}
                  </CardContent>
                </Card>

                {/* Häufigste Scans (Dieser Monat) */}
                <Card className="border-2 border-stone-200 bg-white/90 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="w-5 h-5 text-blue-600" />
                      Häufigste diesen Monat
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(() => {
                      const monthStart = new Date();
                      monthStart.setDate(1);
                      monthStart.setHours(0, 0, 0, 0);
                      
                      const thisMonthDiscoveries = allDiscoveries.filter(d => 
                        new Date(d.created_date || d.discovered_date) >= monthStart
                      );
                      
                      const plantCounts = {};
                      thisMonthDiscoveries.forEach(d => {
                        if (!plantCounts[d.plant_id]) plantCounts[d.plant_id] = 0;
                        plantCounts[d.plant_id]++;
                      });
                      
                      const topPlants = Object.entries(plantCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3);
                      
                      if (topPlants.length === 0) {
                        return (
                          <div className="text-center py-6 text-stone-500 text-sm">
                            Noch keine Scans diesen Monat
                          </div>
                        );
                      }
                      
                      return topPlants.map(([plantId, count], index) => {
                        const plant = plants.find(p => p.id === plantId);
                        return (
                          <div key={plantId} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                index === 0 ? 'bg-blue-500 text-white' :
                                index === 1 ? 'bg-stone-300 text-stone-700' :
                                'bg-blue-300 text-blue-800'
                              }`}>
                                {index + 1}
                              </div>
                              <span className="text-sm font-semibold text-stone-900 truncate">
                                {plant?.species_name || 'Unbekannt'}
                              </span>
                            </div>
                            <Badge className="bg-blue-600 text-white text-xs px-2 py-0">
                              {count}x
                            </Badge>
                          </div>
                        );
                      });
                    })()}
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
              {/* Scan-Statistiken */}
              <Card className="border-2 border-stone-200 bg-white/90 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-green-600" />
                    Deine Scans
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-stone-700">Gesamt</span>
                    <Badge className="bg-green-600 text-white text-base px-3 py-1">
                      {allDiscoveries.filter(d => d.user === user.email || d.created_by === user.email).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                    <span className="text-sm text-stone-700">Diese Woche</span>
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {(() => {
                        const weekStart = new Date();
                        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                        weekStart.setHours(0, 0, 0, 0);
                        return allDiscoveries.filter(d => 
                          (d.user === user.email || d.created_by === user.email) &&
                          new Date(d.created_date || d.discovered_date) >= weekStart
                        ).length;
                      })()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                    <span className="text-sm text-stone-700">Dieser Monat</span>
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {(() => {
                        const monthStart = new Date();
                        monthStart.setDate(1);
                        monthStart.setHours(0, 0, 0, 0);
                        return allDiscoveries.filter(d => 
                          (d.user === user.email || d.created_by === user.email) &&
                          new Date(d.created_date || d.discovered_date) >= monthStart
                        ).length;
                      })()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Sammlungs-Statistiken */}
              <Card className="border-2 border-stone-200 bg-white/90 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-purple-600" />
                    Deine Sammlung
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm text-stone-700">Entdeckte Gattungen</span>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-600 text-white text-base px-3 py-1">
                        {(() => {
                          const myDiscoveries = allDiscoveries.filter(d => d.user === user.email || d.created_by === user.email);
                          const uniqueGenera = new Set();
                          myDiscoveries.forEach(d => {
                            const plant = plants.find(p => p.id === d.plant_id);
                            if (plant) {
                              uniqueGenera.add(`${plant.genus_category}-${plant.genus_number}`);
                            }
                          });
                          return uniqueGenera.size;
                        })()}
                      </Badge>
                      <Badge variant="outline" className="text-sm px-2 py-1">
                        {(() => {
                          const myDiscoveries = allDiscoveries.filter(d => d.user === user.email || d.created_by === user.email);
                          const uniqueGenera = new Set();
                          myDiscoveries.forEach(d => {
                            const plant = plants.find(p => p.id === d.plant_id);
                            if (plant) {
                              uniqueGenera.add(`${plant.genus_category}-${plant.genus_number}`);
                            }
                          });
                          const totalGenera = genera.length;
                          return totalGenera > 0 ? `${Math.round((uniqueGenera.size / totalGenera) * 100)}%` : '0%';
                        })()}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                    <span className="text-sm text-stone-700">Entdeckte Arten</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {(() => {
                          const myDiscoveries = allDiscoveries.filter(d => d.user === user.email || d.created_by === user.email);
                          const uniquePlants = new Set(myDiscoveries.map(d => d.plant_id));
                          return uniquePlants.size;
                        })()}
                      </Badge>
                      <Badge variant="outline" className="text-sm px-2 py-1">
                        {(() => {
                          const myDiscoveries = allDiscoveries.filter(d => d.user === user.email || d.created_by === user.email);
                          const uniquePlants = new Set(myDiscoveries.map(d => d.plant_id));
                          const totalPlants = plants.length;
                          return totalPlants > 0 ? `${Math.round((uniquePlants.size / totalPlants) * 100)}%` : '0%';
                        })()}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                    <span className="text-sm text-stone-700">Seltenste Entdeckung</span>
                    <Badge variant="outline" className="text-xs px-2 py-1">
                      {(() => {
                        const myDiscoveries = allDiscoveries.filter(d => d.user === user.email || d.created_by === user.email);
                        const myPlants = myDiscoveries.map(d => plants.find(p => p.id === d.plant_id)).filter(p => p);
                        const rarestPlant = myPlants.find(p => p.rarity === 'Extrem Selten') || 
                                           myPlants.find(p => p.rarity === 'Sehr Selten') ||
                                           myPlants.find(p => p.rarity === 'Selten');
                        return rarestPlant?.rarity || 'Keine';
                      })()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Likes & Social */}
              <Card className="border-2 border-stone-200 bg-white/90 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-600" />
                    Community
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm text-stone-700">Erhaltene Likes</span>
                    <Badge className="bg-red-600 text-white text-base px-3 py-1">
                      {(() => {
                        const myDiscoveries = allDiscoveries.filter(d => d.user === user.email || d.created_by === user.email);
                        return scanLikes.filter(like => 
                          myDiscoveries.some(d => d.id === like.discovery_id)
                        ).length;
                      })()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                    <span className="text-sm text-stone-700">Gegebene Likes</span>
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {scanLikes.filter(like => like.liked_by === user.email).length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              </div>
              </div>
              </TabsContent>
              </Tabs>

        <MobileBackButton />

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
