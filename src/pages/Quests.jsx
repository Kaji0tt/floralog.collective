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
  const [questExpanded, setQuestExpanded] = useState(false);

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
      className="min-h-screen"
      style={{
        background: averageColor 
          ? `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)`
          : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
      }}
    >
      <MobileBackButton />

      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="fixed top-0 left-0 right-0 z-40 bg-white shadow-sm border-b border-stone-200">
            <div className="max-w-7xl mx-auto">
              <TabsList className="grid w-full grid-cols-3 bg-white h-12 rounded-none border-0">
                <TabsTrigger value="weekly" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-none">
                  🏆 Wöchentlich
                </TabsTrigger>
                <TabsTrigger value="missions" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-none">
                  📋 Missionen
                </TabsTrigger>
                <TabsTrigger value="completed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold rounded-none">
                  ✅ Erledigt
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

          {/* Wöchentliche Community Challenge */}
          <TabsContent value="weekly" className="pt-32 px-4 pb-4">
            {currentWeeklyQuest ? (
              <>
                {/* Kompakte Quest-Anzeige */}
                <div className="mb-4">
                  <button
                    onClick={() => setQuestExpanded(!questExpanded)}
                    className="w-full text-left p-3 bg-white/90 backdrop-blur-md rounded-lg border border-emerald-200 hover:border-emerald-400 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-emerald-600 mb-1">
                          📆 KW {getWeekNumber().split('-W')[1]} · {allUsers.length} Teilnehmer · {weeklyDiscoveries.length} Scans
                        </p>
                        <p className="text-sm font-bold text-stone-900">{currentWeeklyQuest.title}</p>
                      </div>
                      <motion.div
                        animate={{ rotate: questExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
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
                        <Card className="border-2 border-stone-200 hover:border-green-300 hover:shadow-md transition-all bg-white overflow-hidden">
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
                            {plant && (
                              <div className="mb-2">
                                <h3 className="text-xs font-bold text-stone-900 line-clamp-1">{plant.species_name}</h3>
                                <p className="text-[10px] italic text-stone-600 line-clamp-1">{plant.scientific_name}</p>
                              </div>
                            )}

                            <button
                              onClick={() => navigate(createPageUrl(`FriendProfile?email=${discoveryUser?.user_email}`))}
                              className="flex items-center gap-1 w-full hover:opacity-70 transition-opacity"
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

          {/* Placeholder Tabs */}
          <TabsContent value="missions" className="pt-32 px-4">
            <div className="text-center py-20">
              <p className="text-stone-600">Missionen folgen bald...</p>
            </div>
          </TabsContent>

          <TabsContent value="completed" className="pt-32 px-4">
            <div className="text-center py-20">
              <p className="text-stone-600">Erledigte Quests folgen bald...</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}