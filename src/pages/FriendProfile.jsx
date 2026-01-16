import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getXPProgressInLevel } from "../components/utils/xpSystem";
import MobileBackButton from "../components/navigation/MobileBackButton"; // Added import
import { Camera, BookOpen, Trophy, Target, Users, ChevronRight, Star, ArrowLeft, Lock, Map as MapIcon, Heart, UserPlus, Clock, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion } from "framer-motion";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

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

export default function FriendProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [friendUser, setFriendUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get('email');

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    loadCurrentUser();
  }, []);

  // Lade Friend-Record um Grunddaten zu bekommen
  const { data: friendRecord } = useQuery({
    queryKey: ['friendRecord', friendEmail, currentUser?.email],
    queryFn: async () => {
      if (!friendEmail || !currentUser?.email) return null;
      const allFriends = await base44.entities.Friend.list();
      
      // Finde den Friend-Eintrag zwischen mir und dem Freund
      return allFriends.find(f =>
        ((f.request_sent_by?.toLowerCase() === currentUser.email?.toLowerCase() && 
          f.request_sent_to?.toLowerCase() === friendEmail?.toLowerCase()) ||
         (f.request_sent_by?.toLowerCase() === friendEmail?.toLowerCase() && 
          f.request_sent_to?.toLowerCase() === currentUser.email?.toLowerCase())) &&
        f.status === 'accepted'
      );
    },
    enabled: !!friendEmail && !!currentUser?.email,
  });

  // Lade PublicProfile (jeder kann das sehen!)
  const { data: publicProfile } = useQuery({
    queryKey: ['publicProfile', friendEmail],
    queryFn: async () => {
      if (!friendEmail) return null;
      const profiles = await base44.entities.PublicProfile.list();
      return profiles.find(p => p.user_email?.toLowerCase() === friendEmail.toLowerCase());
    },
    enabled: !!friendEmail,
    staleTime: 30000, // 30 Sekunden Cache
  });

  // Setze friendUser aus den verfügbaren Daten
  useEffect(() => {
    if (!friendEmail) {
      setFriendUser(null); 
      return;
    }

    if (publicProfile) {
      // Nutze PublicProfile Daten, wenn verfügbar
      setFriendUser(publicProfile);
    } else if (friendRecord) {
      // Fallback auf Friend-Record, wenn kein PublicProfile aber anerkannter Freund
      setFriendUser({
        email: friendEmail,
        full_name: friendRecord.friend_name || friendEmail,
        display_name: friendRecord.friend_name || friendEmail,
        level: 1,
        xp: 0,
        title: "Pflanzen-Anfänger",
        selected_title: null,
        avatar_url: null
      });
    } else {
        // If there's an email but no accepted friend record AND no public profile,
        // it means they are not accepted friends and don't have a public profile.
        // Set a minimal user to avoid a permanent loading state or error,
        // but note that most dependent queries will fail or be empty.
        setFriendUser({
            email: friendEmail,
            full_name: friendEmail,
            display_name: friendEmail,
            level: 1, 
            xp: 0, 
            title: "Unbekannter", 
            selected_title: null, 
            avatar_url: null 
        });
    }
  }, [publicProfile, friendRecord, friendEmail]);

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
    staleTime: 60000, // 1 Minute Cache
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
    staleTime: 300000, // 5 Minuten Cache
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => base44.entities.Quest.list('quest_number'),
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests', friendEmail],
    queryFn: () => base44.entities.UserQuest.filter({ created_by: friendEmail }),
    enabled: !!friendEmail,
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', friendEmail],
    queryFn: () => base44.entities.UserAchievement.filter({ created_by: friendEmail }),
    enabled: !!friendEmail,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list('achievement_number'),
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', friendEmail],
    queryFn: async () => {
      if (!friendEmail) return [];
      const allFriends = await base44.entities.Friend.list();
      
      // Freunde in beide Richtungen - nutze die richtigen Felder
      return allFriends.filter(f => 
        ((f.request_sent_by?.toLowerCase() === friendEmail.toLowerCase() || 
          f.request_sent_to?.toLowerCase() === friendEmail.toLowerCase()) && 
        f.status === 'accepted')
      );
    },
    enabled: !!friendEmail,
    staleTime: 10000, // 10 Sekunden Cache
  });

  // Prüfe ob ich mit diesem User bereits befreundet bin
  const { data: myFriendship } = useQuery({
    queryKey: ['myFriendship', currentUser?.email, friendEmail],
    queryFn: async () => {
      if (!currentUser?.email || !friendEmail) return null;
      const allFriends = await base44.entities.Friend.list();
      const currentEmailLower = currentUser.email.toLowerCase();
      const friendEmailLower = friendEmail.toLowerCase();
      
      return allFriends.find(f =>
        ((f.request_sent_by?.toLowerCase() === currentEmailLower && 
          f.request_sent_to?.toLowerCase() === friendEmailLower) ||
         (f.request_sent_by?.toLowerCase() === friendEmailLower && 
          f.request_sent_to?.toLowerCase() === currentEmailLower))
      );
    },
    enabled: !!currentUser?.email && !!friendEmail,
    staleTime: 10000, // 10 Sekunden Cache
  });

  const { data: friendDiscoveries = [] } = useQuery({
    queryKey: ['friendDiscoveries', friendEmail],
    queryFn: async () => {
      const discoveries = await base44.entities.UserPlantDiscovery.list('-created_date', 999);
      // Nutze das neue "user" Feld (mit Fallback auf created_by für alte Einträge)
      return discoveries.filter(d => d.user === friendEmail || d.created_by === friendEmail);
    },
    enabled: !!friendEmail,
    staleTime: 30000, // 30 Sekunden Cache
  });

  const sendFriendRequestMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Friend.create({
        request_sent_by: currentUser.email,
        request_sent_to: friendEmail,
        status: "pending"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myFriendship'] });
      alert(`Freundschaftsanfrage an ${friendUser?.display_name || friendEmail} gesendet! ✅`);
    },
    onError: (error) => {
      alert(`Fehler beim Senden der Anfrage: ${error.message}`);
    },
  });

  const favoritePlant = friendUser?.favorite_plant_id 
    ? plants.find(p => p.id === friendUser.favorite_plant_id)
    : null;

  useEffect(() => {
    if (friendUser?.background_image_url) {
      getAverageColor(friendUser.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else if (friendUser?.background_color) {
      setAverageColor(friendUser.background_color);
    } else {
      setAverageColor(null);
    }
  }, [friendUser?.background_image_url, friendUser?.background_color]);

  const isFriend = myFriendship && myFriendship.status === 'accepted';
  const hasPendingRequest = myFriendship && myFriendship.status === 'pending';

  if (!friendUser || !currentUser) { // Updated loading condition
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  const currentLevel = friendUser.level || 1;
  const currentXP = friendUser.xp || 0;
  const xpProgress = getXPProgressInLevel(currentXP, currentLevel);

  const discoveredGenera = genera.filter(g => {
    const genusPlants = plants.filter(p => 
      p.genus_category === g.category && p.genus_number === g.category_dex_number
    );
    return genusPlants.some(p => friendDiscoveries.some(d => d.plant_id === p.id));
  }).length;

  const availableQuests = quests.filter(q => 
    (q.unlocked_at_level || 1) <= currentLevel &&
    !userQuests.some(uq => uq.quest_id === q.id && uq.completed)
  ).length;

  const statButtons = [
    {
      icon: BookOpen,
      label: "Gattungen",
      value: discoveredGenera,
      color: "from-green-500 to-green-600",
      textColor: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      onClick: () => navigate(createPageUrl(`FriendCollection?email=${friendEmail}`))
    },
    {
      icon: Trophy,
      label: "Erfolge",
      value: userAchievements.length,
      color: "from-amber-500 to-amber-600",
      textColor: "text-amber-700",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      onClick: () => navigate(createPageUrl(`FriendAchievements?email=${friendEmail}`))
    },
    {
      icon: Target,
      label: "Aufgaben",
      value: availableQuests,
      color: "from-blue-500 to-blue-600",
      textColor: "text-blue-700",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      onClick: null
    },
    {
      icon: Users,
      label: "Freunde",
      value: friends.length,
      color: "from-purple-500 to-purple-600",
      textColor: "text-purple-700",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      onClick: () => navigate(createPageUrl(`FriendFriendsList?email=${friendEmail}`))
    }
  ];

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

  const getRgbaFromRgb = (rgbString, opacity) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
  };

  return (
    <>
      <style>{`
        :root {
          --friend-bg-color: ${averageColor || 'rgb(250, 250, 249)'};
          --friend-bg-color-light: ${averageColor ? getLighterColor(averageColor) : 'rgb(255, 255, 255)'};
          --friend-bg-color-mid: ${averageColor ? averageColor : 'rgb(236, 253, 245)'};
          --friend-bg-color-dark: ${averageColor ? getDarkerColor(averageColor) : 'rgb(220, 252, 231)'};
          --friend-border-color: ${averageColor ? getRgbaFromRgb(averageColor, 0.4) : 'rgb(134, 239, 172)'};
        }
      `}</style>
      <div 
        className="h-screen min-w-full p-4 md:p-8 fixed inset-0 overflow-auto"
        style={{
          background: averageColor 
            ? `linear-gradient(135deg, var(--friend-bg-color-light) 0%, var(--friend-bg-color-mid) 50%, var(--friend-bg-color-dark) 100%)`
            : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
        }}
      >
        <MobileBackButton backUrl={createPageUrl("Friends")} />
      
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card 
              className="shadow-xl bg-white overflow-hidden"
              style={{
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: averageColor ? 'var(--friend-border-color)' : 'rgb(187, 247, 208)'
              }}
            >
              <CardContent 
                className="p-6 md:p-8 relative"
                style={friendUser?.background_image_url ? {
                  backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.4) 100%), url(${friendUser.background_image_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                } : friendUser?.background_color ? {
                  background: `linear-gradient(135deg, ${friendUser.background_color.replace('rgb', 'rgba').replace(')', ', 0.6)')} 0%, ${friendUser.background_color.replace('rgb', 'rgba').replace(')', ', 1)')} 100%)`
                } : {}}
              >
                <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
                  <div className="relative group flex-shrink-0">
                    <div className="w-28 h-28 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden ring-4 ring-white/50 backdrop-blur-sm">
                      {friendUser.avatar_url ? (
                        <img src={friendUser.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                      ) : (
                        <img src={LOGO_URL} alt="Floralog" className="w-14 h-14 object-contain" />
                      )}
                    </div>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="absolute -top-2 -right-2 px-3 py-1 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-xl backdrop-blur-sm border-2 border-white/80 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <span className="text-white font-bold text-sm">LV {currentLevel}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 bg-white">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-stone-800">Level {currentLevel}</span>
                            <span className="text-sm font-bold text-stone-800">{xpProgress.current} / {xpProgress.needed} XP</span>
                          </div>
                          <Progress value={xpProgress.percentage} className="h-2" />
                          <p className="text-xs text-stone-600">{xpProgress.percentage.toFixed(1)}% bis Level {currentLevel + 1}</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex-1 w-full bg-white/40 backdrop-blur-md rounded-xl p-5 border-2 border-white/30 shadow-lg">
                    <div className="mb-2">
                      <h1 
                        className="font-bold text-stone-900 break-words" 
                        style={{
                          fontSize: (friendUser.display_name || friendUser.full_name || '').length > 20 
                            ? 'clamp(1.5rem, 4vw, 2rem)' 
                            : 'clamp(1.875rem, 5vw, 2.25rem)'
                        }}
                        key={friendUser.display_name || friendUser.full_name}
                      >
                        {friendUser.display_name || friendUser.full_name}
                      </h1>
                    </div>

                    <div className="mb-3">
                      <span className="text-base font-semibold text-stone-700">
                        {friendUser.selected_title || friendUser.title || "Pflanzen-Anfänger"}
                      </span>
                    </div>

                    {favoritePlant && (() => {
                      const genus = genera.find(g => 
                        g.category === favoritePlant.genus_category && 
                        g.category_dex_number === favoritePlant.genus_number
                      );
                      return genus ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(createPageUrl(`GenusDetail?id=${genus.id}&email=${friendEmail}`));
                          }}
                          className="mt-3 flex items-center gap-2 p-2 bg-white/40 rounded-lg border border-white/30 hover:bg-white/60 transition-colors w-full"
                        >
                          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-stone-900">{favoritePlant.species_name}</p>
                            <p className="text-xs italic text-stone-600">{favoritePlant.scientific_name}</p>
                          </div>
                        </button>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {statButtons.map((stat, index) => (
                    <motion.button
                      key={stat.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (stat.onClick && isFriend) stat.onClick();
                      }}
                      disabled={!stat.onClick || !isFriend}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      whileHover={{ scale: (stat.onClick && isFriend) ? 1.05 : 1 }}
                      whileTap={{ scale: (stat.onClick && isFriend) ? 0.95 : 1 }}
                      className={`bg-white/60 backdrop-blur-md rounded-xl p-3 md:p-4 hover:shadow-lg transition-all duration-300 group ${
                        (!stat.onClick || !isFriend) ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      style={{
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: averageColor ? 'var(--friend-border-color)' : stat.borderColor.replace('border-', '').replace('-200', '')
                      }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br ${stat.color} rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                          <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="text-2xl md:text-3xl font-bold text-stone-700">{stat.value}</div>
                        <div className="text-xs font-semibold text-stone-600 hidden sm:block">{stat.label}</div>
                      </div>
                    </motion.button>
                    ))}
                    </div>

                    {/* Action Button - innerhalb der Profilkarte */}
                    <div className="mt-4">
                      <div 
                        className="bg-white/60 backdrop-blur-md rounded-xl p-4 shadow-md"
                        style={{
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          borderColor: averageColor ? 'var(--friend-border-color)' : 'rgb(187, 247, 208)'
                        }}
                      >
                        {isFriend ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(createPageUrl("Map"));
                            }}
                            className="flex items-center justify-center gap-2 hover:opacity-80 transition-opacity w-full"
                          >
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
                              style={{
                                background: averageColor 
                                  ? `linear-gradient(135deg, var(--friend-bg-color) 0%, var(--friend-bg-color-dark) 100%)`
                                  : 'linear-gradient(135deg, rgb(34, 197, 94), rgb(22, 163, 74))'
                              }}
                            >
                              <MapIcon className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-semibold text-stone-900">Zur Karte</span>
                          </button>
                        ) : hasPendingRequest ? (
                          <button
                            disabled
                            className="flex items-center justify-center gap-2 opacity-60 cursor-not-allowed w-full"
                          >
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
                              style={{
                                background: 'linear-gradient(135deg, rgb(156, 163, 175), rgb(107, 114, 128))'
                              }}
                            >
                              <Clock className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-semibold text-stone-900">Anfrage gesendet</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sendFriendRequestMutation.mutate();
                            }}
                            disabled={sendFriendRequestMutation.isPending}
                            className="flex items-center justify-center gap-2 hover:opacity-80 transition-opacity w-full disabled:opacity-50"
                          >
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
                              style={{
                                background: 'linear-gradient(135deg, rgb(34, 197, 94), rgb(22, 163, 74))'
                              }}
                            >
                              <UserPlus className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-semibold text-stone-900">
                              {sendFriendRequestMutation.isPending ? 'Wird gesendet...' : 'Freund hinzufügen'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                    </CardContent>
                    </Card>
                    </motion.div>


        </div>
      </div>
    </>
  );
}