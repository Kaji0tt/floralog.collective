import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { createUserNotification, getUserDisplayName } from "@/api/notificationService";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Users, TrendingUp, Clock, Leaf, Loader2, ChevronLeft, ChevronRight, X, Search, MapPin, Plus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getRobotPlantDailyZones, initializeGeoRasterGrid } from "@/api/robotPlantService";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MobileBackButton from "../components/navigation/MobileBackButton";
import SearchSortBar from "../components/collection/SearchSortBar";
import { getCurrentWeeklyQuest, getWeekNumber, getCurrentWeekBounds } from "../components/quests/QuestRotationHelper";
import tweakingRobotGif from "../../tweaking-robot.gif";

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

const THEME_MAP_COLORS = {
  forest: "#007a3f",
  urban: "#8d755c",
  water: "#2b6cb0",
  meadow: "#84cc16",
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
  const [isRegeneratingZones, setIsRegeneratingZones] = useState(false);
  const [mapQuickView, setMapQuickView] = useState("local");
  const [mapFriendSearchQuery, setMapFriendSearchQuery] = useState("");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [mapSelectedViews, setMapSelectedViews] = useState({ mine: true });

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

  const { data: friendships = [] } = useQuery({
    queryKey: ['friendships'],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await Query.Friend.list();
      const userEmailLower = user.email.toLowerCase();
      return allFriends.filter(f =>
        f.status === 'accepted' &&
        (f.request_sent_by?.toLowerCase() === userEmailLower ||
         f.request_sent_to?.toLowerCase() === userEmailLower)
      );
    },
    enabled: !!user?.email,
    staleTime: 10000,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => Query.PublicProfile.list(),
    enabled: friendships.length > 0,
    staleTime: 30000,
  });

  const {
    data: robotPlantDailyZones = [],
    isLoading: isZonesLoading,
    isFetching: isZonesFetching,
  } = useQuery({
    queryKey: ["robotPlantDailyZones", userLocation?.lat, userLocation?.lng],
    queryFn: async () => {
      if (!userLocation) return [];
      const response = await getRobotPlantDailyZones({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      });
      return response?.zones || [];
    },
    enabled: mapQuickView === "local" && !!userLocation && user?.role !== 'admin',
    staleTime: 1000 * 60 * 10,
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
        const createdLike = await Query.ScanLike.create({
          auth_id: user.id,
          discovery_id: discoveryId,
          liked_by: user.email,
          liked_date: new Date().toISOString()
        });

        try {
          const discovery = allDiscoveries.find((d) => d.id === discoveryId);
          const ownerAuthId = discovery?.auth_id;
          const ownerEmail = discovery?.created_by || discovery?.user;

          if ((ownerAuthId && ownerAuthId !== user.id) || (ownerEmail && ownerEmail !== user.email)) {
            const likerName = getUserDisplayName(user, user.email);
            await createUserNotification({
              authId: ownerAuthId,
              userEmail: ownerEmail,
              notificationType: "scan_liked",
              title: "❤️ Neuer Like",
              message: `${likerName} gefällt dein Scan!`,
              actionUrl: "Quests",
              description: createdLike?.id || "",
              displayLocation: "banner",
              createdBy: user.email,
            });
          }
        } catch (error) {
          console.error("[Quests] Could not create scan like notification:", error);
        }
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
    onSuccess: async (_data, collectionId) => {
      try {
        const collection = allCollections.find((c) => c.id === collectionId);
        if (collection && collection.auth_id && collection.auth_id !== user?.id) {
          const profiles = await Query.PublicProfile.list();
          const ownerProfile = profiles.find((p) => p.auth_id === collection.auth_id);
          const followerName = getUserDisplayName(user, user?.email);

          await createUserNotification({
            authId: collection.auth_id,
            userEmail: ownerProfile?.user_email,
            notificationType: "collection_followed",
            title: "👀 Neuer Kollektion-Follower",
            message: `${followerName} folgt jetzt deiner Kollektion!`,
            description: collection.title || "",
            actionUrl: `Collection?collectionId=${collection.id}`,
            displayLocation: "banner",
            createdBy: user?.email || "system",
          });
        }
      } catch (error) {
        console.error("[Quests] Could not create collection follow notification:", error);
      }

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

    const adjustFollowerCount = (delta) => {
      queryClient.setQueryData(['allCollections'], (previous) => {
        if (!Array.isArray(previous)) return previous;
        return previous.map((entry) =>
          entry.id === collection.id
            ? {
                ...entry,
                followers_count: Math.max((entry.followers_count ?? 0) + delta, 0),
              }
            : entry
        );
      });
    };

    const existingLink = userCollectionByCollectionId.get(collection.id);
    if (existingLink?.id) {
      adjustFollowerCount(-1);
      unfollowCollectionMutation.mutate(existingLink.id);
      return;
    }

    adjustFollowerCount(1);
    followCollectionMutation.mutate(collection.id);
  };

  // Map helper functions
  const extractCoordinates = (location) => {
    if (!location) return null;
    const coordPattern = /(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/;
    const match = location.match(coordPattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [lat, lng];
      }
    }
    return null;
  };

  const getFriendEmail = (friendship) => {
    if (!user) return null;
    const userEmailLower = user.email.toLowerCase();
    return friendship.request_sent_by?.toLowerCase() === userEmailLower
      ? friendship.request_sent_to
      : friendship.request_sent_by;
  };

  const friends = friendships.map(friendship => {
    const friendEmail = getFriendEmail(friendship);
    const profile = publicProfiles.find(p => p.user_email?.toLowerCase() === friendEmail?.toLowerCase());
    return {
      id: friendship.id,
      email: friendEmail,
      name: profile?.display_name || profile?.full_name || friendEmail,
    };
  });

  const getPlantsWithDiscoveries = (userEmail) => {
    if (!userEmail) return [];
    const userEmailLower = userEmail.toLowerCase();
    const userDiscoveries = allDiscoveries.filter(d =>
      d.user?.toLowerCase() === userEmailLower || d.created_by?.toLowerCase() === userEmailLower
    );
    return userDiscoveries
      .map(discovery => {
        const plant = plants.find(p => p.id === discovery.plant_id);
        if (!plant) return null;
        return {
          ...plant,
          discovery_location: discovery.discovery_location,
          discovery_date: discovery.discovered_date,
          image_url: discovery.image_url,
          created_by: discovery.user || discovery.created_by,
        };
      })
      .filter(Boolean);
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
                <TabsTrigger value="map" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  🗺️ Karte
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
                              <div className="text-[11px] text-stone-600 mb-0.5 truncate flex items-center gap-1">
                                {!c.isOwnCollection && (
                                  <button
                                    type="button"
                                    disabled={isCollectionTogglePending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCollectionFollowToggle(c);
                                    }}
                                    aria-label={c.isFollowing ? 'Abo beenden' : 'Abonnieren'}
                                    title={c.isFollowing ? 'Abo beenden' : 'Abonnieren'}
                                    className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${c.isFollowing
                                      ? 'bg-emerald-50/95 border-emerald-200 text-emerald-600 hover:bg-emerald-100/95'
                                      : 'bg-white/85 border-stone-200 text-stone-500 hover:bg-white'}`}
                                  >
                                    {c.isFollowing ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                                  </button>
                                )}
                                <span className="truncate">{c.ownerName}</span>
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

          {/* Karte Tab */}
          <TabsContent value="map" className="pt-12 overflow-hidden">
            <div className="relative w-full" style={{ height: 'calc(100vh - 48px)' }}>

              {/* Overlay: view chips + secondary controls */}
              <div className="absolute top-2 left-0 right-0 z-[1000] px-4">
                {/* View selector chips styled like sort chips */}
                <div className="flex items-center rounded-full bg-white/90 backdrop-blur-md shadow-md border border-stone-200 p-0.5">
                  {[
                    { value: "local",   label: "📍 Lokal"   },
                    { value: "friends", label: "👥 Freunde" },
                    { value: "sightings", label: "🌿 Sichtungen" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMapQuickView(opt.value)}
                      className={`flex-1 px-2 py-1.5 rounded-full text-xs whitespace-nowrap text-center transition-all ${
                        mapQuickView === opt.value
                          ? "bg-green-600 text-white shadow font-semibold"
                          : "text-stone-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Friends: search / selected friend */}
                {mapQuickView === "friends" && (
                  <div className="mt-2">
                    {mapSelectedViews?.mine || mapSelectedViews?.selectedFriend ? (
                      <div className="flex items-center justify-between px-4 py-2 bg-white/90 backdrop-blur-md rounded-full border border-green-200 shadow">
                        <span className="text-sm font-semibold text-stone-900">
                          {mapSelectedViews.mine ? "Meine Pflanzen" : mapSelectedViews.selectedFriend?.name}
                        </span>
                        <button
                          className="text-xs text-stone-500 ml-2"
                          onClick={() => { setMapSelectedViews({}); setMapFriendSearchQuery(""); }}
                        >
                          Ändern
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input
                            type="text"
                            placeholder="Freund auswählen..."
                            value={mapFriendSearchQuery}
                            onChange={e => setMapFriendSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-stone-200 shadow text-sm outline-none"
                          />
                        </div>
                        {mapFriendSearchQuery.length > 0 && (
                          <div className="mt-1 bg-white/95 backdrop-blur-md rounded-xl border border-stone-200 shadow-lg overflow-y-auto" style={{ maxHeight: '180px' }}>
                            <button
                              onClick={() => { setMapSelectedViews({ mine: true }); setMapFriendSearchQuery(""); }}
                              className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100"
                            >
                              <p className="text-sm font-bold text-stone-900">Meine Pflanzen</p>
                            </button>
                            {friends
                              .filter(f =>
                                f.name?.toLowerCase().includes(mapFriendSearchQuery.toLowerCase()) ||
                                f.email?.toLowerCase().includes(mapFriendSearchQuery.toLowerCase())
                              )
                              .map(friend => (
                                <button
                                  key={friend.id}
                                  onClick={() => {
                                    setMapSelectedViews({ [`friend-${friend.email}`]: true, selectedFriend: friend });
                                    setMapFriendSearchQuery("");
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0"
                                >
                                  <p className="text-sm font-bold text-stone-900">{friend.name}</p>
                                </button>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Sightings: search for a plant/genus */}
                {mapQuickView === "sightings" && (
                  <div className="mt-2">
                    {selectedPlantForSighting ? (
                      <div className="flex items-center justify-between px-4 py-2 bg-white/90 backdrop-blur-md rounded-full border border-green-200 shadow">
                        <span className="text-sm font-semibold text-stone-900">
                          {selectedPlantForSighting.type === 'genus'
                            ? selectedPlantForSighting.data.genus_name
                            : selectedPlantForSighting.data.species_name}
                        </span>
                        <button
                          className="text-xs text-stone-500 ml-2"
                          onClick={() => { setSelectedPlantForSighting(null); setMapSearchQuery(""); }}
                        >
                          Ändern
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input
                            type="text"
                            placeholder="Art oder Gattung suchen..."
                            value={mapSearchQuery}
                            onChange={e => setMapSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-stone-200 shadow text-sm outline-none"
                          />
                        </div>
                        {mapSearchQuery.length > 1 && (
                          <div className="mt-1 bg-white/95 backdrop-blur-md rounded-xl border border-stone-200 shadow-lg overflow-y-auto" style={{ maxHeight: '180px' }}>
                            {genera
                              .filter(g =>
                                g.genus_name?.toLowerCase().includes(mapSearchQuery.toLowerCase()) ||
                                g.scientific_genus?.toLowerCase().includes(mapSearchQuery.toLowerCase())
                              )
                              .slice(0, 5)
                              .map(genus => (
                                <button
                                  key={`genus-${genus.id}`}
                                  onClick={() => { setSelectedPlantForSighting({ type: 'genus', data: genus }); setMapSearchQuery(""); }}
                                  className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0"
                                >
                                  <p className="text-sm font-bold text-stone-900">{genus.genus_name}</p>
                                  <p className="text-xs text-stone-500">Gattung · {genus.scientific_genus}</p>
                                </button>
                              ))}
                            {plants
                              .filter(p =>
                                p.species_name?.toLowerCase().includes(mapSearchQuery.toLowerCase()) ||
                                p.scientific_name?.toLowerCase().includes(mapSearchQuery.toLowerCase())
                              )
                              .slice(0, 5)
                              .map(plant => (
                                <button
                                  key={`plant-${plant.id}`}
                                  onClick={() => { setSelectedPlantForSighting({ type: 'species', data: plant }); setMapSearchQuery(""); }}
                                  className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0"
                                >
                                  <p className="text-sm font-bold text-stone-900">{plant.species_name}</p>
                                  <p className="text-xs text-stone-500">Art · {plant.scientific_name}</p>
                                </button>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Local: get-location button when no location yet */}
                {mapQuickView === "local" && !userLocation && (
                  <div className="mt-2 flex justify-center">
                    <button
                      onClick={calculateLocation}
                      disabled={isLoadingLocation}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-stone-200 shadow text-sm font-medium text-stone-700 disabled:opacity-60"
                    >
                      {isLoadingLocation
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <MapPin className="w-4 h-4" />}
                      {isLoadingLocation ? "Wird ermittelt..." : "Standort ermitteln"}
                    </button>
                  </div>
                )}
              </div>

              {/* Friends map */}
              {mapQuickView === "friends" && (() => {
                const mapUserLocation = userLocation ? [userLocation.lat, userLocation.lng] : null;
                const filteredPlants = [];
                if (mapSelectedViews?.mine && user) {
                  getPlantsWithDiscoveries(user.email)
                    .filter(p => extractCoordinates(p.discovery_location))
                    .forEach(p => filteredPlants.push({
                      ...p,
                      coordinates: extractCoordinates(p.discovery_location),
                      color: USER_COLORS[0],
                      sourceLabel: "Meine Pflanzen",
                    }));
                }
                friends.forEach((friend, idx) => {
                  if (mapSelectedViews?.[`friend-${friend.email}`]) {
                    getPlantsWithDiscoveries(friend.email)
                      .filter(p => extractCoordinates(p.discovery_location))
                      .forEach(p => filteredPlants.push({
                        ...p,
                        coordinates: extractCoordinates(p.discovery_location),
                        color: USER_COLORS[(idx + 1) % USER_COLORS.length],
                        sourceLabel: friend.name,
                      }));
                  }
                });
                const bounds = filteredPlants.length > 0 ? filteredPlants.map(p => p.coordinates) : null;
                const center = mapUserLocation || (filteredPlants[0]?.coordinates) || [51.1657, 10.4515];
                return (
                  <MapContainer
                    center={center}
                    zoom={6}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                    zoomControl={false}
                  >
                    {bounds && <MapController bounds={bounds} center={null} zoom={null} />}
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    {filteredPlants.map((plant, idx) => (
                      <Marker
                        key={`${plant.id}-${plant.created_by}-${idx}`}
                        position={plant.coordinates}
                        icon={createColoredIcon(plant.color)}
                      >
                        <Popup>
                          <div className="p-1">
                            <p className="font-bold text-sm">{plant.species_name}</p>
                            {plant.image_url && (
                              <img src={plant.image_url} alt={plant.species_name} className="w-full h-24 object-cover rounded my-1" />
                            )}
                            <Badge variant="outline">{plant.sourceLabel}</Badge>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {mapUserLocation && (
                      <Marker position={mapUserLocation}>
                        <Popup><p className="text-sm font-bold">📍 Du bist hier</p></Popup>
                      </Marker>
                    )}
                  </MapContainer>
                );
              })()}

              {/* Local map */}
              {mapQuickView === "local" && (() => {
                if (!userLocation) {
                  return (
                    <div className="h-full flex items-center justify-center bg-stone-100">
                      <div className="text-center text-stone-400">
                        <MapPin className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm">Standort aktivieren, um Pflanzen in der Nähe zu sehen</p>
                      </div>
                    </div>
                  );
                }

                if (isRegeneratingZones || ((user?.role !== 'admin') && (isZonesLoading || isZonesFetching))) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center bg-white">
                      <img
                        src={tweakingRobotGif}
                        alt="Zonen werden geladen"
                        className="w-40 h-40 object-contain"
                      />
                      <p className="mt-4 text-sm text-stone-600 font-medium">Karte und Zonen werden geladen...</p>
                    </div>
                  );
                }

                const mapUserLocation = [userLocation.lat, userLocation.lng];
                return (
                  <MapContainer
                    center={mapUserLocation}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    {robotPlantDailyZones
                      .filter(zone => Number.isFinite(zone.centerLat) && Number.isFinite(zone.centerLng))
                      .map((zone) => {
                      const color = THEME_MAP_COLORS[zone.theme] || "#718096";
                      const zoneLabel = `${zone.title || zone.theme} • x${Number(zone.bonusMultiplier || 1).toFixed(2)}`;
                      
                      // Phase 3.2: Support für GeoJSON-Geometrie wenn vorhanden
                      if (zone.geometry) {
                        try {
                          const geojson = typeof zone.geometry === 'string' ? JSON.parse(zone.geometry) : zone.geometry;
                          return (
                            <GeoJSON
                              key={zone.id || zone.zoneKey}
                              data={geojson}
                              style={{
                                color,
                                fillColor: color,
                                fillOpacity: 0.2,
                                weight: 2,
                              }}
                              onEachFeature={(feature, layer) => {
                                layer.bindPopup(
                                  `<div class="text-sm"><p class="font-bold">${zoneLabel}</p><p class="text-stone-600">Theme: ${zone.theme}</p></div>`
                                );
                              }}
                            />
                          );
                        } catch (_err) {
                          // Fallback auf Circle bei GeoJSON-Fehler
                        }
                      }
                      
                      // Fallback: Circle (klassisch)
                      return (
                        <Circle
                          key={zone.id || zone.zoneKey}
                          center={[zone.centerLat, zone.centerLng]}
                          radius={zone.radiusM || 150}
                          pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.2,
                            weight: 2,
                          }}
                        >
                          <Popup>
                            <div className="text-sm">
                              <p className="font-bold">{zoneLabel}</p>
                              <p className="text-stone-600">Theme: {zone.theme}</p>
                            </div>
                          </Popup>
                        </Circle>
                      );
                    })}
                    {(() => {
                      const userMap = new Map(allUsers.map(u => [u.user_email, u]));
                      return allDiscoveries
                        .map(d => {
                          const coords = extractCoordinates(d.discovery_location);
                          if (!coords) return null;
                          const discoveryUser = userMap.get(d.user) || userMap.get(d.created_by);
                          if (!discoveryUser || discoveryUser.local_tracking === false) return null;
                          if (calculateDistance(mapUserLocation[0], mapUserLocation[1], coords[0], coords[1]) > 20) return null;
                          return { discovery: d, coords, discoveryUser };
                        })
                        .filter(Boolean)
                        .map(({ discovery, coords, discoveryUser }) => {
                          const plant = plants.find(p => p.id === discovery.plant_id);
                          const userColor = getColorForUser(discoveryUser.user_email, allUsers);
                          return (
                            <CircleMarker key={discovery.id} center={coords} radius={6} pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.85, weight: 1.5 }}>
                              <Popup>
                                <div className="text-sm">
                                  <p className="font-bold">{plant?.species_name}</p>
                                  <p className="text-xs italic text-stone-600">{plant?.scientific_name}</p>
                                  {discovery.image_url && (
                                    <img src={discovery.image_url} alt="" className="w-24 h-24 object-cover mt-1 rounded" />
                                  )}
                                </div>
                              </Popup>
                            </CircleMarker>
                          );
                        });
                    })()}
                    <CircleMarker center={mapUserLocation} radius={9} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}>
                      <Popup><p className="text-sm font-bold">📍 Dein Standort</p></Popup>
                    </CircleMarker>
                  </MapContainer>
                );
              })()}

              {/* Zone controls */}
              {mapQuickView === "local" && (
                <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
                  {userLocation && (
                    <button
                      onClick={async () => {
                        setIsRegeneratingZones(true);
                        try {
                          console.log('[Admin] Starting zone regeneration...');
                          const zones = await getRobotPlantDailyZones({
                            latitude: userLocation.lat,
                            longitude: userLocation.lng,
                            forceRegenerate: true,
                          });
                          queryClient.setQueryData(
                            ["robotPlantDailyZones", userLocation.lat, userLocation.lng],
                            zones.zones || []
                          );
                          alert(`✅ Zonen neu generiert!\n${zones.zones?.length ?? 0} Zonen erstellt.`);
                        } catch (err) {
                          alert(`❌ Fehler:\n${err.message}`);
                        } finally {
                          setIsRegeneratingZones(false);
                        }
                      }}
                      className="px-3 py-2 text-xs bg-yellow-200 hover:bg-yellow-300 text-yellow-900 rounded-lg font-medium shadow-md transition"
                    >
                      🔄 Zonen neu generieren {user?.role === 'admin' ? '' : '(1x taeglich)'}
                    </button>
                  )}
                  {user?.role === 'admin' && (
                    <button
                      onClick={async () => {
                        const lat = userLocation?.lat ?? 54.32;
                        const lng = userLocation?.lng ?? 10.13;
                        const r = 0.0315; // ~3.5km radius in degrees
                        const label = userLocation ? 'Aktueller Standort' : 'Kiel (Standard)';
                        if (!confirm(`Raster-Grid für ${label} initialisieren?\nBounds: ±${r}° (~3,5km) um ${lat.toFixed(3)}, ${lng.toFixed(3)}\n\nDas kann 10-40 Sekunden dauern.`)) return;
                        try {
                          const result = await initializeGeoRasterGrid({
                            bounds: {
                              north: lat + r,
                              south: lat - r,
                              east: lng + r,
                              west: lng - r,
                            },
                            forceRefresh: false,
                          });
                          alert(`✅ Grid initialisiert!\n${result.cellsCreated} Zellen erstellt in ${result.duration_ms}ms.`);
                        } catch (err) {
                          alert(`❌ Grid-Fehler:\n${err.message}`);
                        }
                      }}
                      className="px-3 py-2 text-xs bg-blue-200 hover:bg-blue-300 text-blue-900 rounded-lg font-medium shadow-md transition"
                    >
                      🗺️ Grid initialisieren
                    </button>
                  )}
                </div>
              )}

              {/* Sightings map */}
              {mapQuickView === "sightings" && (() => {
                if (!selectedPlantForSighting) {
                  return (
                    <div className="h-full flex items-center justify-center bg-stone-100">
                      <div className="text-center text-stone-400">
                        <MapPin className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm">Pflanze suchen, um Sichtungen anzuzeigen</p>
                      </div>
                    </div>
                  );
                }
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
                const validDiscoveries = relevantDiscoveries.filter(d => {
                  const coords = d.discovery_location?.split(',');
                  if (!coords || coords.length !== 2) return false;
                  const lat = parseFloat(coords[0].trim());
                  const lng = parseFloat(coords[1].trim());
                  return !isNaN(lat) && !isNaN(lng);
                });
                const center = validDiscoveries.length > 0
                  ? (() => {
                      const coords = validDiscoveries[0].discovery_location.split(',');
                      return [parseFloat(coords[0].trim()), parseFloat(coords[1].trim())];
                    })()
                  : [51.1657, 10.4515];
                return (
                  <MapContainer
                    center={center}
                    zoom={validDiscoveries.length > 0 ? 8 : 6}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    {validDiscoveries.map(discovery => {
                      const coords = discovery.discovery_location.split(',');
                      const lat = parseFloat(coords[0].trim());
                      const lng = parseFloat(coords[1].trim());
                      const plant = plants.find(p => p.id === discovery.plant_id);
                      return (
                        <Marker key={discovery.id} position={[lat, lng]} icon={createColoredIcon('#10b981')}>
                          <Popup>
                            <div className="text-sm">
                              <p className="font-bold">{plant?.species_name}</p>
                              <p className="text-xs italic">{plant?.scientific_name}</p>
                              {discovery.image_url && (
                                <img src={discovery.image_url} alt="" className="w-24 h-24 object-cover mt-1 rounded" />
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                );
              })()}
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
