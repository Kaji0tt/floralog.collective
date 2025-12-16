import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Users, TrendingUp, Clock, Leaf, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { getCurrentWeeklyQuest, getWeekNumber } from "../components/quests/QuestRotationHelper";

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
      className="min-h-screen p-4 md:p-8"
      style={{
        background: averageColor 
          ? `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)`
          : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
      }}
    >
      <MobileBackButton />

      <div className="max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-md border border-stone-200 p-1 mb-6">
            <TabsTrigger value="weekly" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold">
              🏆 Wöchentlich
            </TabsTrigger>
            <TabsTrigger value="missions" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold">
              📋 Missionen
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold">
              ✅ Erledigt
            </TabsTrigger>
          </TabsList>

          {/* Wöchentliche Community Challenge */}
          <TabsContent value="weekly" className="space-y-4">
            {currentWeeklyQuest ? (
              <>
                {/* Quest Header Card */}
                <Card className="border-2 border-emerald-400 bg-white/90 backdrop-blur-md shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <Badge className="bg-emerald-600 text-white font-bold mb-3">
                          📆 Wöchentliche Challenge - KW {getWeekNumber().split('-W')[1]}
                        </Badge>
                        <CardTitle className="text-2xl text-stone-900 mb-2">{currentWeeklyQuest.title}</CardTitle>
                        <p className="text-stone-600">{currentWeeklyQuest.description}</p>
                      </div>
                    </div>
                    
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
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-stone-600">
                      <Users className="w-4 h-4" />
                      <span>{allUsers.length} Teilnehmer aktiv</span>
                      <span className="mx-2">•</span>
                      <TrendingUp className="w-4 h-4" />
                      <span>{weeklyDiscoveries.length} Scans diese Woche</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Filter Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => setSortFilter("newest")}
                    variant={sortFilter === "newest" ? "default" : "outline"}
                    className={sortFilter === "newest" ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Neueste
                  </Button>
                  <Button
                    onClick={() => setSortFilter("popular")}
                    variant={sortFilter === "popular" ? "default" : "outline"}
                    className={sortFilter === "popular" ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Beliebteste
                  </Button>
                  <Button
                    onClick={() => setSortFilter("frequent")}
                    variant={sortFilter === "frequent" ? "default" : "outline"}
                    className={sortFilter === "frequent" ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Häufigste
                  </Button>
                </div>

                {/* Scans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedDiscoveries.map((discovery, index) => {
                    const plant = plants.find(p => p.id === discovery.plant_id);
                    const genus = genera.find(g => 
                      plant && g.category === plant.genus_category && 
                      g.category_dex_number === plant.genus_number
                    );
                    const discoveryUser = allUsers.find(u => 
                      u.user_email === discovery.user || u.user_email === discovery.created_by
                    );
                    const likeCount = scanLikes.filter(like => like.discovery_id === discovery.id).length;
                    const isLiked = scanLikes.some(
                      like => like.discovery_id === discovery.id && like.liked_by === user.email
                    );

                    return (
                      <motion.div
                        key={discovery.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="border-2 border-stone-200 hover:border-green-300 hover:shadow-lg transition-all bg-white/90 backdrop-blur-md overflow-hidden">
                          {discovery.image_url && (
                            <img
                              src={discovery.image_url}
                              alt={plant?.species_name}
                              className="w-full h-48 object-cover"
                            />
                          )}
                          <CardContent className="p-4">
                            {plant && (
                              <div className="mb-3">
                                <h3 className="text-lg font-bold text-stone-900">{plant.species_name}</h3>
                                <p className="text-sm italic text-stone-600">{plant.scientific_name}</p>
                                {genus && (
                                  <Badge variant="outline" className="mt-1">
                                    {genus.genus_name}
                                  </Badge>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() => navigate(createPageUrl(`FriendProfile?email=${discoveryUser?.user_email}`))}
                              className="flex items-center gap-2 mb-3 hover:opacity-70 transition-opacity"
                            >
                              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                                {discoveryUser?.avatar_url ? (
                                  <img src={discoveryUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  <Users className="w-4 h-4 text-white" />
                                )}
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-semibold text-stone-900">
                                  {discoveryUser?.display_name || discoveryUser?.full_name || 'Unbekannt'}
                                </p>
                                <p className="text-xs text-stone-500">
                                  {format(new Date(discovery.created_date || discovery.discovered_date), "d. MMM yyyy, HH:mm", { locale: de })}
                                </p>
                              </div>
                            </button>

                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => toggleLikeMutation.mutate(discovery.id)}
                                variant="outline"
                                size="sm"
                                disabled={toggleLikeMutation.isPending}
                                className={isLiked ? "border-red-500 text-red-500" : ""}
                              >
                                <Heart className={`w-4 h-4 mr-1 ${isLiked ? 'fill-red-500' : ''}`} />
                                {likeCount}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                {sortedDiscoveries.length === 0 && (
                  <Card className="border-2 border-stone-200 bg-white/80 backdrop-blur-md">
                    <CardContent className="p-12 text-center">
                      <Leaf className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-stone-900 mb-2">
                        Noch keine Scans diese Woche
                      </h3>
                      <p className="text-stone-600">
                        Sei der Erste und scanne eine passende Pflanze!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="border-2 border-stone-200 bg-white/80 backdrop-blur-md">
                <CardContent className="p-12 text-center">
                  <Leaf className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-stone-900 mb-2">
                    Keine wöchentliche Challenge aktiv
                  </h3>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Placeholder Tabs */}
          <TabsContent value="missions">
            <Card className="border-2 border-stone-200 bg-white/80 backdrop-blur-md">
              <CardContent className="p-12 text-center">
                <p className="text-stone-600">Missionen folgen bald...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card className="border-2 border-stone-200 bg-white/80 backdrop-blur-md">
              <CardContent className="p-12 text-center">
                <p className="text-stone-600">Erledigte Quests folgen bald...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}