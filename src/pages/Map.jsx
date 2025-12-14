import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Navigation, Loader2, Info, Leaf, Filter } from "lucide-react";
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

// Erstelle dynamisches Icon mit Farbe
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

// Meine Pflanzen (Grün als Fallback)
const plantIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Farbpalette für Freunde
const friendColors = [
  { name: "blue", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png", bg: "bg-blue-600" },
  { name: "red", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png", bg: "bg-red-600" },
  { name: "orange", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png", bg: "bg-orange-600" },
  { name: "yellow", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png", bg: "bg-yellow-600" },
  { name: "violet", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png", bg: "bg-purple-600" },
  { name: "grey", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png", bg: "bg-gray-600" },
  { name: "black", url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png", bg: "bg-black" },
];

// Helper function um Icon für Freund zu erstellen
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

export default function Map() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [selectedViews, setSelectedViews] = useState({
    mine: true, // Standardmäßig eigene Pflanzen anzeigen
  });
  const [targetLocation, setTargetLocation] = useState(null);
  const [averageColor, setAverageColor] = useState(null);

  // URL-Parameter für Zielkoordinaten auslesen
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
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

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser?.background_image_url) {
        const color = await getAverageColor(currentUser.background_image_url);
        setAverageColor(color);
      }
    };
    loadUser();
  }, []);

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list('-discovery_date'),
  });

  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: () => base44.entities.UserPlantDiscovery.list(),
  });

  const { data: friendships = [] } = useQuery({
    queryKey: ['friendships'],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await base44.entities.Friend.list();
      return allFriends.filter(f => 
        f.status === 'accepted' &&
        (f.request_sent_by === user.email || f.request_sent_to === user.email)
      );
    },
    enabled: !!user?.email,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.PublicProfile.list(),
    enabled: friendships.length > 0,
  });

  // Helper: Hole Freund-Email aus Freundschaft
  const getFriendEmail = (friendship) => {
    if (!user) return null;
    return friendship.request_sent_by === user.email 
      ? friendship.request_sent_to 
      : friendship.request_sent_by;
  };

  // Helper: Hole Profil eines Freundes
  const getFriendProfile = (friendEmail) => {
    return publicProfiles.find(p => p.user_email?.toLowerCase() === friendEmail?.toLowerCase());
  };

  // Erstelle Freund-Objekte mit Namen
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

  // Helper function um Plant-Daten mit Discovery-Daten zu kombinieren
  const getPlantsWithDiscoveries = (userEmail) => {
    const userDiscoveries = allDiscoveries.filter(d => 
      d.user === userEmail || d.created_by === userEmail
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

  // Sammle alle Pflanzen basierend auf aktivierten Views
  const allFilteredPlants = [];

  // Meine Pflanzen
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

  // Freunde - jeder bekommt seine eigene Farbe
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

  // Berechne Bounding Box für alle gefilterten Pflanzen
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

  // Zähle aktivierte Views
  const activeViewCount = Object.values(selectedViews).filter(v => v).length;
  const totalPlantCount = allFilteredPlants.length;

  return (
    <div className="h-screen flex flex-col">
      <div className="z-[1001]">
        <MobileBackButton />
      </div>
      
      {/* Header mit Filter-Button */}
      <div className="bg-white border-b-2 border-stone-200 shadow-md z-50">
        <div className="p-3 md:p-4">
          <div className="flex items-center gap-3">
            {/* Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 border-2 border-stone-300 bg-white font-semibold h-10 justify-start">
                  <Filter className="w-4 h-4 mr-2" />
                  <span className="flex-1 text-left">
                    {activeViewCount} {activeViewCount === 1 ? 'Ansicht' : 'Ansichten'} aktiv
                  </span>
                  {activeViewCount > 0 && (
                    <Badge className="bg-green-600 text-white ml-2">{totalPlantCount}</Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-white" align="start">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-lg mb-3 text-stone-900">Kartenansichten</h3>
                    <p className="text-sm text-stone-600 mb-3">Wähle aus, welche Pflanzen angezeigt werden sollen</p>
                  </div>

                  {/* Meine Pflanzen */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg cursor-pointer" onClick={() => toggleView('mine')}>
                      <Checkbox 
                        checked={selectedViews.mine || false}
                        onCheckedChange={() => toggleView('mine')}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: averageColor 
                              ? `rgb(${averageColor.r}, ${averageColor.g}, ${averageColor.b})` 
                              : 'rgb(22, 163, 74)'
                          }}
                        ></div>
                        <span className="font-semibold text-stone-900">Meine Pflanzen</span>
                      </div>
                      {selectedViews.mine && (
                        <Badge variant="outline" className="text-xs">
                          {getPlantsWithDiscoveries(user?.email || '').filter(p => extractCoordinates(p.discovery_location)).length}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Freunde */}
                  {friends.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-stone-500 uppercase tracking-wider px-2">Freunde</div>
                      {friends.map((friend, friendIndex) => {
                        const viewKey = `friend-${friend.email}`;
                        const friendPlantCount = getPlantsWithDiscoveries(friend.email).filter(p => extractCoordinates(p.discovery_location)).length;
                        const color = friendColors[friendIndex % friendColors.length];
                        
                        return (
                          <div 
                            key={friend.id} 
                            className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg cursor-pointer"
                            onClick={() => toggleView(viewKey)}
                          >
                            <Checkbox 
                              checked={selectedViews[viewKey] || false}
                              onCheckedChange={() => toggleView(viewKey)}
                            />
                            <div className="flex items-center gap-2 flex-1">
                              <div className={`w-3 h-3 ${color.bg} rounded-full`}></div>
                              <span className="font-semibold text-stone-900">{friend.name}</span>
                            </div>
                            {selectedViews[viewKey] && (
                              <Badge variant="outline" className="text-xs">{friendPlantCount}</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Mein Standort Button */}
            <Button
              onClick={getUserLocation}
              disabled={gettingLocation}
              size="sm"
              className="bg-green-600 hover:bg-green-700 flex-shrink-0 h-10"
            >
              {gettingLocation ? (
                <>
                  <Loader2 className="w-4 h-4 md:mr-2 animate-spin" />
                  <span className="hidden md:inline">Standort...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Mein Standort</span>
                </>
              )}
            </Button>
          </div>

          {/* Info-Zeile */}
          <div className="mt-2 flex items-center justify-between text-xs text-stone-600">
            <span className="font-semibold">
              {totalPlantCount} {totalPlantCount === 1 ? 'Pflanze' : 'Pflanzen'} auf der Karte
            </span>
            <span className="text-stone-500">
              {activeViewCount === 0 ? 'Keine Ansicht aktiv' : `${activeViewCount} ${activeViewCount === 1 ? 'Quelle' : 'Quellen'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Karte - Komplett formatfüllend */}
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
                  eventHandlers={{
                    click: () => setSelectedPlant(plant),
                  }}
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
                        onClick={() => navigate(createPageUrl(`GenusDetail?id=${plant.genus_id}`))}
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

            {/* Overlay: Info bei keinen Pflanzen */}
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

            {/* Overlay: Ausgewählte Pflanze (Unten) */}
            {selectedPlant && allFilteredPlants.length > 0 && (
              <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[1000]">
                <Card className="shadow-2xl border-2 border-green-200 bg-white/95 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-base md:text-lg text-stone-900 flex-1 truncate pr-2">
                        {selectedPlant.species_name}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedPlant(null)}
                        className="flex-shrink-0 h-6 w-6"
                      >
                        <span className="text-xl">×</span>
                      </Button>
                    </div>
                    
                    {selectedPlant.image_url && (
                      <img
                        src={selectedPlant.image_url}
                        alt={selectedPlant.species_name}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                    )}
                    
                    <p className="text-sm italic text-stone-600 mb-2">{selectedPlant.scientific_name}</p>
                    
                    <div className="flex items-center gap-2 text-xs text-stone-500 mb-2">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{selectedPlant.discovery_location}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 ${selectedPlant.colorClass} rounded-full`}></div>
                      <Badge variant="outline">
                        {selectedPlant.sourceLabel}
                      </Badge>
                    </div>
                    
                    {selectedPlant.created_by !== user?.email && (
                      <Badge variant="outline" className="text-xs mb-3">
                        Gescannt von: {selectedPlant.created_by}
                      </Badge>
                    )}
                    
                    <Button
                      onClick={() => navigate(createPageUrl(`GenusDetail?id=${selectedPlant.genus_id}`))}
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      Vollständige Details
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}