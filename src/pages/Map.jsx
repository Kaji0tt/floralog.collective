import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MapPin, Navigation, Loader2, Info, Leaf, Filter, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import MobileBackButton from "../components/navigation/MobileBackButton";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const createColoredIcon = (color) => {
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" 
            fill="rgb(${color.r}, ${color.g}, ${color.b})" 
            stroke="white" 
            stroke-width="1.5"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white" opacity="0.8"/>
    </svg>
  `;
  
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const plantIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const friendColors = [
  { name: "blue", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png", bg: "bg-blue-600" },
  { name: "red", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png", bg: "bg-red-600" },
  { name: "orange", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png", bg: "bg-orange-600" },
  { name: "yellow", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png", bg: "bg-yellow-600" },
  { name: "violet", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png", bg: "bg-purple-600" },
  { name: "grey", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png", bg: "bg-gray-600" },
  { name: "black", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png", bg: "bg-black" },
];

const USER_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
];

const createFriendIcon = (colorIndex) => {
  const color = friendColors[colorIndex % friendColors.length];
  return new L.Icon({
    iconUrl: color.url,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const createSimpleColoredIcon = (color) => {
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

function MapController({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (center) {
      map.setView(center, zoom || 13);
    }
  }, [center, zoom, bounds, map]);
  return null;
}

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
        
        resolve({ r, g, b });
      } catch (error) {
        resolve(null);
      }
    };
    
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

export default function Map() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [selectedViews, setSelectedViews] = useState({});
  const [targetLocation, setTargetLocation] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlantForSighting, setSelectedPlantForSighting] = useState(null);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const friendEmailParam = urlParams.get('email');

  useEffect(() => {
    const lat = urlParams.get('lat');
    const lng = urlParams.get('lng');
    if (lat && lng) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        setTargetLocation([parsedLat, parsedLng]);
      }
    }
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser?.background_color) {
        setAverageColor(currentUser.background_color);
      } else if (currentUser?.background_image_url) {
        const color = await getAverageColor(currentUser.background_image_url);
        setAverageColor(color);
      }
    };
    loadUser();
  }, []);

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list('-discovery_date'),
    staleTime: 60000,
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
    staleTime: 300000,
  });

  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => base44.entities.UserPlantDiscovery.list('-created_date', 999),
    staleTime: 30000,
  });

  const { data: friendships = [] } = useQuery({
    queryKey: ['friendships'],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await base44.entities.Friend.list();
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
    queryFn: () => base44.entities.PublicProfile.list(),
    enabled: friendships.length > 0,
    staleTime: 30000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const users = await base44.entities.PublicProfile.list();
      return users.filter(u => u.weekly_tracking !== false);
    },
  });

  const getFriendEmail = (friendship) => {
    if (!user) return null;
    const userEmailLower = user.email.toLowerCase();
    return friendship.request_sent_by?.toLowerCase() === userEmailLower 
      ? friendship.request_sent_to 
      : friendship.request_sent_by;
  };

  const getFriendProfile = (friendEmail) => {
    return publicProfiles.find(p => p.user_email?.toLowerCase() === friendEmail?.toLowerCase());
  };

  const friends = friendships.map(friendship => {
    const friendEmail = getFriendEmail(friendship);
    const profile = getFriendProfile(friendEmail);
    return {
      id: friendship.id,
      email: friendEmail,
      name: profile?.display_name || profile?.full_name || friendEmail,
      profile
    };
  });

  useEffect(() => {
    if (friendEmailParam && friends.length > 0) {
      const friend = friends.find(f => f.email?.toLowerCase() === friendEmailParam?.toLowerCase());
      if (friend) {
        setSelectedViews({ [`friend-${friend.email}`]: true });
      }
    } else if (!friendEmailParam) {
      setSelectedViews({ mine: true });
    }
  }, [friendEmailParam, friends.length > 0]);

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
          created_by: discovery.user || discovery.created_by
        };
      })
      .filter(p => p !== null);
  };

  function extractCoordinates(location) {
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
  }

  const getUserLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setGettingLocation(false);
        },
        (error) => {
          console.error("Fehler beim Abrufen des Standorts:", error);
          setGettingLocation(false);
        }
      );
    }
  };

  const toggleView = (viewKey) => {
    setSelectedViews(prev => ({
      ...prev,
      [viewKey]: !prev[viewKey]
    }));
  };

  const allFilteredPlants = [];

  if (selectedViews.mine && user) {
    const myIcon = averageColor ? createColoredIcon(averageColor) : plantIcon;
    const myColorClass = averageColor ? `bg-[rgb(${averageColor.r},${averageColor.g},${averageColor.b})]` : "bg-green-600";
    
    const myPlants = getPlantsWithDiscoveries(user.email)
      .filter(p => extractCoordinates(p.discovery_location) !== null)
      .map(p => ({
        ...p,
        coordinates: extractCoordinates(p.discovery_location),
        icon: myIcon,
        source: "mine",
        sourceLabel: "Meine Pflanzen",
        colorClass: myColorClass
      }));
    allFilteredPlants.push(...myPlants);
  }

  friends.forEach((friend, friendIndex) => {
    const viewKey = `friend-${friend.email}`;
    if (selectedViews[viewKey]) {
      const color = friendColors[friendIndex % friendColors.length];
      const friendPlants = getPlantsWithDiscoveries(friend.email)
        .filter(p => extractCoordinates(p.discovery_location) !== null)
        .map(p => ({
          ...p,
          coordinates: extractCoordinates(p.discovery_location),
          icon: createFriendIcon(friendIndex),
          source: viewKey,
          sourceLabel: friend.name,
          colorClass: color.bg
        }));
      allFilteredPlants.push(...friendPlants);
    }
  });

  const defaultCenter = [50.1109, 8.6821];
  const mapCenter = targetLocation || userLocation || (allFilteredPlants.length > 0 ? allFilteredPlants[0].coordinates : defaultCenter);

  const calculateBounds = () => {
    if (allFilteredPlants.length === 0) return null;
    
    let minLat = allFilteredPlants[0].coordinates[0];
    let maxLat = allFilteredPlants[0].coordinates[0];
    let minLng = allFilteredPlants[0].coordinates[1];
    let maxLng = allFilteredPlants[0].coordinates[1];
    
    allFilteredPlants.forEach(plant => {
      const [lat, lng] = plant.coordinates;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
    
    return [[minLat, minLng], [maxLat, maxLng]];
  };

  const bounds = calculateBounds();
  const activeViewCount = Object.values(selectedViews).filter(v => v).length;
  const totalPlantCount = allFilteredPlants.length;

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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  const averageColorRgb = averageColor ? `rgb(${averageColor.r}, ${averageColor.g}, ${averageColor.b})` : null;

  return (
    <div 
      className="min-h-screen"
      style={{
        background: averageColorRgb 
          ? `linear-gradient(135deg, ${getLighterColor(averageColorRgb)} 0%, ${averageColorRgb} 50%, ${getDarkerColor(averageColorRgb)} 100%)`
          : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
      }}
    >
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-stone-200">
            <div className="max-w-7xl mx-auto">
              <TabsList className="grid w-full grid-cols-3 bg-white h-12 rounded-none border-0">
                <TabsTrigger value="friends" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  👥 Freunde
                </TabsTrigger>
                <TabsTrigger value="local" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  📍 Lokal
                </TabsTrigger>
                <TabsTrigger value="sightings" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                  🔍 Sichtungen
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <MobileBackButton />

          {/* Freunde Tab */}
          <TabsContent value="friends" className="pt-12">
            <div className="flex flex-col h-screen">
              <div className="bg-white border-b-2 border-stone-200 shadow-md z-40">
                <div className="p-2">
                  {selectedViews.selectedFriend || selectedViews.mine ? (
                    <div className="flex items-center justify-between p-3 bg-white/90 backdrop-blur-md rounded-full border border-green-200">
                      <div>
                        <p className="text-sm font-bold text-stone-900">
                          {selectedViews.mine ? 'Meine Pflanzen' : selectedViews.selectedFriend?.name}
                        </p>
                        <p className="text-xs text-stone-500">
                          {totalPlantCount} {totalPlantCount === 1 ? 'Pflanze' : 'Pflanzen'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedViews({});
                          setSearchQuery("");
                        }}
                        className="h-8"
                      >
                        Ändern
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <Input
                            type="text"
                            placeholder="Wähle einen Freund..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-white border-2 border-stone-300 h-10"
                          />
                        </div>
                        <Button
                          onClick={getUserLocation}
                          disabled={gettingLocation}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 flex-shrink-0 h-10 px-3"
                        >
                          {gettingLocation ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Navigation className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {searchQuery.length > 0 && (
                        <div className="mt-2 bg-white rounded-lg border border-stone-200 shadow-lg max-h-60 overflow-y-auto">
                          <button
                            onClick={() => {
                              setSelectedViews({ mine: true });
                              setSearchQuery("");
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100"
                          >
                            <p className="text-sm font-bold text-stone-900">Meine Pflanzen</p>
                            <p className="text-xs text-stone-500">
                              {getPlantsWithDiscoveries(user?.email || '').filter(p => extractCoordinates(p.discovery_location)).length} Pflanzen
                            </p>
                          </button>
                          {friends
                            .filter(f => 
                              f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              f.email?.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .map((friend) => (
                              <button
                                key={friend.id}
                                onClick={() => {
                                  setSelectedViews({ [`friend-${friend.email}`]: true, selectedFriend: friend });
                                  setSearchQuery("");
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0"
                              >
                                <p className="text-sm font-bold text-stone-900">{friend.name}</p>
                                <p className="text-xs text-stone-500">
                                  {getPlantsWithDiscoveries(friend.email).filter(p => extractCoordinates(p.discovery_location)).length} Pflanzen
                                </p>
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 relative">
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-50 z-10">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                      <p className="text-stone-600">Karte wird geladen...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <MapContainer
                      center={mapCenter}
                      zoom={allFilteredPlants.length > 0 ? 6 : 6}
                      style={{ height: '100%', width: '100%' }}
                      className="z-0"
                    >
                      <MapController 
                        center={targetLocation || userLocation} 
                        zoom={targetLocation ? 15 : 13}
                        bounds={!targetLocation && !userLocation ? bounds : null}
                      />
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      
                      {allFilteredPlants.map((plant, index) => (
                        <Marker
                          key={`${plant.id}-${plant.created_by}-${plant.discovery_date}-${index}`}
                          position={plant.coordinates}
                          icon={plant.icon}
                        >
                          <Popup>
                            <div className="p-2">
                              <h3 className="font-bold text-lg mb-1">{plant.species_name}</h3>
                              <p className="text-sm italic text-stone-600 mb-2">{plant.scientific_name}</p>
                              {plant.image_url && (
                                <img 
                                  src={plant.image_url} 
                                  alt={plant.species_name}
                                  className="w-full h-32 object-cover rounded mb-2"
                                />
                              )}
                              <p className="text-xs text-stone-500 mb-2">
                                {format(new Date(plant.discovery_date), "d. MMMM yyyy", { locale: de })}
                              </p>
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 ${plant.colorClass} rounded-full`}></div>
                                <Badge variant="outline">
                                  {plant.sourceLabel}
                                </Badge>
                              </div>
                              {plant.created_by !== user?.email && (
                                <p className="text-xs text-stone-600 mb-2">
                                  Gescannt von: {plant.created_by}
                                </p>
                              )}
                              <Button
                                size="sm"
                                onClick={() => {
                                  const genus = genera.find(g => 
                                    g.category === plant.genus_category && 
                                    g.category_dex_number === plant.genus_number
                                  );
                                  if (genus) {
                                    const email = plant.source === 'mine' ? '' : plant.created_by;
                                    const url = email 
                                      ? `GenusDetail?id=${genus.id}&email=${email}`
                                      : `GenusDetail?id=${genus.id}`;
                                    navigate(createPageUrl(url));
                                  }
                                }}
                                className="w-full bg-green-600 hover:bg-green-700"
                              >
                                Details anzeigen
                              </Button>
                            </div>
                          </Popup>
                        </Marker>
                      ))}

                      {userLocation && (
                        <Marker position={userLocation}>
                          <Popup>
                            <div className="text-center p-2">
                              <p className="font-semibold">Du bist hier</p>
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </MapContainer>

                    {allFilteredPlants.length === 0 && activeViewCount > 0 && (
                      <div className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-md z-[1000]">
                        <Card className="shadow-2xl border-2 border-green-200 bg-white/95 backdrop-blur-sm">
                          <CardContent className="p-4 md:p-6">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Info className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                              </div>
                              <div>
                                <h3 className="font-bold text-base md:text-lg text-stone-900 mb-2">
                                  Keine Pflanzen mit Standort gefunden
                                </h3>
                                <p className="text-xs md:text-sm text-stone-600 mb-3 md:mb-4">
                                  Die ausgewählten Ansichten haben noch keine Pflanzen mit Standort-Koordinaten.
                                </p>
                                {selectedViews.mine && (
                                  <Button
                                    onClick={() => navigate(createPageUrl("Scanner"))}
                                    size="sm"
                                    className="w-full bg-green-600 hover:bg-green-700"
                                  >
                                    <Leaf className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                                    Erste Pflanze scannen
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {allFilteredPlants.length === 0 && activeViewCount === 0 && (
                      <div className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-md z-[1000]">
                        <Card className="shadow-2xl border-2 border-amber-200 bg-white/95 backdrop-blur-sm">
                          <CardContent className="p-4 md:p-6">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Info className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                              </div>
                              <div>
                                <h3 className="font-bold text-base md:text-lg text-stone-900 mb-2">
                                  Keine Ansicht ausgewählt
                                </h3>
                                <p className="text-xs md:text-sm text-stone-600">
                                  Wähle mindestens eine Ansicht über den Filter-Button aus.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <MobileBackButton />

          {/* Lokal Tab */}
          <TabsContent value="local" className="pt-14 px-4 pb-4">
            {!userLocation ? (
              <div className="text-center py-20">
                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                  <MapPin className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-stone-900 mb-2">Standort ermitteln</h3>
                  <p className="text-stone-600 mb-6">Erlaube den Standortzugriff, um Scans in deiner Nähe zu sehen</p>
                  <Button
                    onClick={getUserLocation}
                    disabled={gettingLocation}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {gettingLocation ? (
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
                  center={[userLocation[0], userLocation[1]]}
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
                      
                      const distance = calculateDistance(userLocation[0], userLocation[1], lat, lng);
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
                          icon={createSimpleColoredIcon(userColor)}
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
                    
                  <Marker position={userLocation} icon={createSimpleColoredIcon('#ef4444')}>
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
          <TabsContent value="sightings" className="pt-14 px-4 pb-4">
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
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between p-3 bg-white/90 backdrop-blur-md rounded-full border border-green-200">
                    <div>
                      <p className="text-sm font-bold text-stone-900">
                        {selectedPlantForSighting.type === 'genus' 
                          ? selectedPlantForSighting.data.genus_name 
                          : selectedPlantForSighting.data.species_name}
                      </p>
                      <p className="text-xs text-stone-500">
                        {selectedPlantForSighting.type === 'genus' ? 'Gattung' : 'Art'} · {
                          (() => {
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
                            return relevantDiscoveries.length;
                          })()
                        } Scans
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

                <div className="h-[calc(100vh-240px)] rounded-xl overflow-hidden border-2 border-stone-200 shadow-lg">
                  <MapContainer
                    center={userLocation ? userLocation : [51.1657, 10.4515]}
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
                                icon={createSimpleColoredIcon(userColor)}
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
              </>
            )}

            {!selectedPlantForSighting && (
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
      </div>
    </div>
  );
}