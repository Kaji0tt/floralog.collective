import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UserPlus, Users, Loader2, Mail, Star, Check, X, Bell, ChevronRight, UserMinus, Clock, Leaf, Trophy, Gift, Share2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { checkAndUnlockAchievements } from "../components/achievements/achievementChecker";
import AchievementNotification from "../components/achievements/AchievementNotification";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

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
        let r = 0,g = 0,b = 0,count = 0;
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

export default function Friends() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState("friends");
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.background_color) {
      setAverageColor(user.background_color);
    } else if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then((color) => {
        if (color) setAverageColor(color);
      });
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

  // Lade ALLE Friend-Einträge
  const { data: allFriendRecords = [] } = useQuery({
    queryKey: ['allFriendRecords'],
    queryFn: () => base44.entities.Friend.list(),
    enabled: !!user?.email,
    staleTime: 10000 // 10 Sekunden Cache
  });

  // Akzeptierte Freundschaften (wo ich ENTWEDER Sender ODER Empfänger bin)
  const { data: friends = [] } = useQuery({
    queryKey: ['friends', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return allFriendRecords.filter((f) =>
      (f.request_sent_by?.toLowerCase() === user.email.toLowerCase() ||
      f.request_sent_to?.toLowerCase() === user.email.toLowerCase()) &&
      f.status === 'accepted'
      );
    },
    enabled: !!user?.email && allFriendRecords.length > 0
  });

  // Eingehende Anfragen (wo ICH Empfänger bin)
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pendingRequests', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return allFriendRecords.filter((f) =>
      f.request_sent_to?.toLowerCase() === user.email.toLowerCase() &&
      f.status === 'pending'
      );
    },
    enabled: !!user?.email && allFriendRecords.length > 0
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 60000 // 1 Minute Cache
  });

  const { data: allPublicProfiles = [] } = useQuery({
    queryKey: ['allPublicProfiles'],
    queryFn: () => base44.entities.PublicProfile.list(),
    staleTime: 30000 // 30 Sekunden Cache
  });

  // Lade alle Discoveries - mit höherem Limit
  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: async () => {
      const discoveries = await base44.entities.UserPlantDiscovery.list('-created_date', 999);
      console.log("📊 Geladene Discoveries:", discoveries.length);
      return discoveries;
    }
  });

  // Lade alle Plants
  const { data: allPlants = [] } = useQuery({
    queryKey: ['allPlants'],
    queryFn: () => base44.entities.Plant.list()
  });

  // Lade alle Genera
  const { data: allGenera = [] } = useQuery({
    queryKey: ['allGenera'],
    queryFn: () => base44.entities.PlantGenus.list()
  });

  // Lade SharedScans
  const { data: sharedScans = [] } = useQuery({
    queryKey: ['sharedScans', user?.email],
    queryFn: () => base44.entities.SharedScan.filter({ shared_to: user?.email }),
    enabled: !!user?.email,
  });

  // Lade alle Achievements - mit höherem Limit
  const { data: allUserAchievements = [] } = useQuery({
    queryKey: ['allUserAchievements'],
    queryFn: async () => {
      const achievements = await base44.entities.UserAchievement.list('-created_date', 999);
      console.log("📊 Geladene UserAchievements:", achievements.length);
      return achievements;
    }
  });

  // Lade Achievement Definitionen
  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list()
  });

  const sendFriendRequestMutation = useMutation({
    mutationFn: async (friendEmail) => {
      if (!user || !user.email) {
        throw new Error("User nicht geladen!");
      }

      const myEmail = user.email.toLowerCase();
      const friendEmailLower = friendEmail.toLowerCase();

      // Selbst-Check
      if (friendEmailLower === myEmail) {
        throw new Error("Du kannst dir nicht selbst eine Anfrage senden!");
      }

      // Prüfe ob bereits eine Freundschaft existiert (in BEIDE Richtungen!)
      const existingFriendship = allFriendRecords.find((f) =>
      f.request_sent_by?.toLowerCase() === myEmail && f.request_sent_to?.toLowerCase() === friendEmailLower ||
      f.request_sent_by?.toLowerCase() === friendEmailLower && f.request_sent_to?.toLowerCase() === myEmail
      );

      if (existingFriendship) {
        if (existingFriendship.status === "accepted") {
          throw new Error("Ihr seid bereits befreundet!");
        } else {
          if (existingFriendship.request_sent_by?.toLowerCase() === myEmail) {
            throw new Error("Du hast dieser Person bereits eine Anfrage gesendet!");
          } else {
            throw new Error("Diese Person hat dir bereits eine Anfrage gesendet! Akzeptiere sie im Tab 'Anfragen'.");
          }
        }
      }

      // Erstelle EINEN Eintrag mit den neuen Feldern
      await base44.entities.Friend.create({
        request_sent_by: user.email,
        request_sent_to: friendEmail,
        status: "pending"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      setFriendEmail("");
    },
    onError: (error) => {
      alert(error.message);
    }
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (request) => {
      await base44.entities.Friend.update(request.id, {
        status: "accepted",
        added_date: new Date().toISOString()
      });
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      await queryClient.refetchQueries({ queryKey: ['allFriendRecords'] });

      // Zeige Success-Message
      const requesterEmail = variables.request_sent_by;
      alert(`✅ Freundschaft mit ${requesterEmail} bestätigt!`);

      // Prüfe Achievements
      const newlyUnlocked = await checkAndUnlockAchievements(user);
      if (newlyUnlocked.length > 0) {
        setNewAchievements(newlyUnlocked);
        setCurrentAchievementIndex(0);
      }
    },
    onError: (error) => {
      alert(`Fehler beim Annehmen der Anfrage: ${error.message}`);
    }
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (request) => {
      await base44.entities.Friend.delete(request.id);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      alert(`❌ Freundschaftsanfrage abgelehnt`);
    },
    onError: (error) => {
      alert(`Fehler beim Ablehnen der Anfrage: ${error.message}`);
    }
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendToRemove) => {
      await base44.entities.Friend.delete(friendToRemove.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      alert(`🗑️ Freund entfernt`);
    },
    onError: (error) => {
      alert(`Fehler beim Entfernen des Freundes: ${error.message}`);
    }
  });

  const shareAppMutation = useMutation({
    mutationFn: async (email) => {
      // Erstelle Referral-Eintrag
      await base44.entities.Referral.create({
        invited_by: user.email,
        invited_email: email,
        status: "pending"
      });
      return email;
    },
    onSuccess: (email) => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      
      // Erstelle Referral-Link mit User-Email als Code
      const referralCode = encodeURIComponent(user.email);
      const referralLink = `https://floralog.de?ref=${referralCode}`;
      
      // Erstelle Share-Text
      const shareText = `Hallo!

${user.display_name || user.full_name} lädt dich zu Floralog ein! 🌱

Floralog ist eine App zum Entdecken und Sammeln von Pflanzen. Scanne Pflanzen in deiner Umgebung, baue deine Sammlung auf und tausche dich mit Freunden aus!

Starte jetzt: ${referralLink}

Viel Spaß beim Entdecken! 🌿`;

      // Kopiere in Zwischenablage
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
          alert(`✅ Einladungstext wurde in die Zwischenablage kopiert!\n\nSende ihn per WhatsApp, SMS oder E-Mail an ${email}!\n\nDein Referral-Link: ${referralLink}`);
        }).catch(() => {
          alert(`✅ Referral für ${email} erstellt!\n\nTeile diesen Link: ${referralLink}`);
        });
      } else {
        alert(`✅ Referral für ${email} erstellt!\n\nTeile diesen Link: ${referralLink}`);
      }
      
      setFriendEmail("");
    },
    onError: (error) => {
      alert(`Fehler: ${error.message}`);
    }
  });

  const handleSendRequest = async () => {
    if (!user || !user.email) {
      alert("Bitte warte bis dein Profil geladen ist.");
      return;
    }

    if (!friendEmail || !friendEmail.trim()) {
      alert("Bitte gib eine E-Mail-Adresse ein.");
      return;
    }

    const trimmedEmail = friendEmail.trim();

    // Self-Check
    if (trimmedEmail.toLowerCase() === user.email.toLowerCase()) {
      alert("Du kannst dir nicht selbst eine Anfrage senden! 😄");
      setFriendEmail("");
      return;
    }

    // Basic E-Mail Format Check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      alert("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    try {
      await sendFriendRequestMutation.mutateAsync(trimmedEmail);
      alert(`Freundschaftsanfrage an ${trimmedEmail} gesendet! ✅`);
    } catch (error) {

      // Error already shown by mutation
    }};

  const createPageUrl = (path) => {
    if (path.startsWith('/')) {
      return path;
    }
    return `/${path}`;
  };

  // Helper: Hole letzte Aktivität eines Freundes
  const getLastActivity = (friendEmail) => {
    if (!friendEmail) {
      console.log("⚠️ Keine friendEmail übergeben");
      return null;
    }

    const friendEmailLower = friendEmail.toLowerCase();
    console.log("🔍 Suche Aktivitäten für:", friendEmailLower);

    // Letzte Discovery - prüfe sowohl user als auch created_by
    const friendDiscoveries = allDiscoveries.filter((d) => {
      const userMatch = d.user?.toLowerCase() === friendEmailLower;
      const createdByMatch = d.created_by?.toLowerCase() === friendEmailLower;
      return userMatch || createdByMatch;
    });

    console.log(`📦 ${friendDiscoveries.length} Discoveries gefunden für ${friendEmailLower}`);

    const lastDiscovery = friendDiscoveries.length > 0 ?
    friendDiscoveries.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0] :
    null;

    // Letztes Achievement
    const friendAchievements = allUserAchievements.filter((a) =>
    a.created_by?.toLowerCase() === friendEmailLower
    );

    console.log(`🏆 ${friendAchievements.length} Achievements gefunden für ${friendEmailLower}`);

    const lastAchievement = friendAchievements.length > 0 ?
    friendAchievements.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0] :
    null;

    // Vergleiche welches neuer ist
    let activity = null;

    if (lastDiscovery && lastAchievement) {
      const discoveryDate = new Date(lastDiscovery.created_date);
      const achievementDate = new Date(lastAchievement.created_date);

      console.log("📅 Discovery:", discoveryDate, "Achievement:", achievementDate);

      if (discoveryDate > achievementDate) {
        const plant = allPlants.find((p) => p.id === lastDiscovery.plant_id);
        activity = {
          type: 'discovery',
          plant: plant,
          date: lastDiscovery.created_date
        };
        console.log("✅ Neueste Aktivität: Discovery -", plant?.species_name);
      } else {
        const achievement = achievements.find((a) => a.id === lastAchievement.achievement_id);
        activity = {
          type: 'achievement',
          achievement: achievement,
          date: lastAchievement.created_date
        };
        console.log("✅ Neueste Aktivität: Achievement -", achievement?.title);
      }
    } else if (lastDiscovery) {
      const plant = allPlants.find((p) => p.id === lastDiscovery.plant_id);
      activity = {
        type: 'discovery',
        plant: plant,
        date: lastDiscovery.created_date
      };
      console.log("✅ Neueste Aktivität: Discovery -", plant?.species_name);
    } else if (lastAchievement) {
      const achievement = achievements.find((a) => a.id === lastAchievement.achievement_id);
      activity = {
        type: 'achievement',
        achievement: achievement,
        date: lastAchievement.created_date
      };
      console.log("✅ Neueste Aktivität: Achievement -", achievement?.title);
    } else {
      console.log("❌ Keine Aktivitäten gefunden");
    }

    return activity;
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

  // Helper: Hole Freundesdaten
  const getFriendData = (friendEntry) => {
    if (!user || !user.email) return null;

    // Bestimme die Email des anderen
    const friendEmail = friendEntry.request_sent_by?.toLowerCase() === user.email.toLowerCase() ?
    friendEntry.request_sent_to :
    friendEntry.request_sent_by;

    // Suche PublicProfile (jeder kann das sehen!)
    const friendProfile = allPublicProfiles.find((p) => p.user_email?.toLowerCase() === friendEmail?.toLowerCase());

    // Fallback auf allUsers (klappt nur wenn in der Liste)
    const friendUser = allUsers.find((u) => u.email?.toLowerCase() === friendEmail?.toLowerCase());

    // Hole letzte Aktivität
    const lastActivity = getLastActivity(friendEmail);

    return {
      id: friendEntry.id,
      email: friendEmail,
      name: friendProfile?.display_name || friendProfile?.full_name || friendUser?.display_name || friendUser?.full_name || friendEmail,
      avatar_url: friendProfile?.avatar_url || friendUser?.avatar_url,
      level: friendProfile?.level || friendUser?.level || 1,
      title: friendProfile?.selected_title || friendProfile?.title || friendUser?.selected_title || friendUser?.title || "Pflanzen-Anfänger",
      lastActivity: lastActivity
    };
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>);

  }

  return (
    <>
      {/* Fixer Hintergrund */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: averageColor ?
          `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)` :
          'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
        }}
      />
      
      {/* Scrollbarer Content */}
      <div className="min-h-screen p-4 md:p-8 overflow-x-hidden">
        <MobileBackButton />

      <AnimatePresence>
        {newAchievements.length > 0 && currentAchievementIndex < newAchievements.length &&
        <AchievementNotification
          achievement={newAchievements[currentAchievementIndex]}
          onComplete={() => {
            if (currentAchievementIndex < newAchievements.length - 1) {
              setCurrentAchievementIndex(currentAchievementIndex + 1);
            } else {
              setNewAchievements([]);
              setCurrentAchievementIndex(0);
            }
          }} />

        }
      </AnimatePresence>

      <div className="max-w-4xl mx-auto w-full overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tabs Header - Fixed am oberen Bildschirmrand */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-stone-200">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between px-2">
                <TabsList className="flex-1 grid grid-cols-2 bg-white h-12 rounded-none border-0">
                  <TabsTrigger value="friends" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Meine Freunde ({friends.length})
                  </TabsTrigger>
                  <TabsTrigger value="gifts" className="data-[state=active]:bg-pink-600 data-[state=active]:text-white font-semibold rounded-lg mx-0.5 text-xs sm:text-sm">
                    <Gift className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Meine Geschenke ({sharedScans.length})
                  </TabsTrigger>
                </TabsList>
                {activeTab === "friends" && (
                  <Button
                    onClick={() => setShowAddFriendDialog(true)}
                    size="icon"
                    className="bg-green-600 hover:bg-green-700 ml-2 w-10 h-10 rounded-full flex-shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                )}
              </div>


            </div>
          </div>

          {/* Friends Tab Content */}
          <TabsContent value="friends" className="pt-14 px-2 pb-4">
            {/* Freundschaftsanfragen */}
            {pendingRequests.length > 0 &&
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-2">

              <Card className="border-2 border-amber-200 shadow-lg bg-white">
                <CardHeader className="border-b border-amber-100 bg-amber-50 p-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bell className="w-5 h-5 text-amber-600" />
                    Freundschaftsanfragen
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {pendingRequests.map((request, index) => {
                    const requesterData = getFriendData(request);
                    if (!requesterData) return null;

                    return (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}>

                          <Card className="border-2 border-stone-200 bg-white">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md overflow-hidden flex-shrink-0">
                                    {requesterData?.avatar_url ?
                                  <img src={requesterData.avatar_url} alt={requesterData.name} className="w-full h-full object-cover" /> :

                                  requesterData.name?.[0]?.toUpperCase() || '?'
                                  }
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-stone-900 truncate">{requesterData.name}</div>
                                    <div className="text-sm text-stone-600">möchte dein Freund sein</div>
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button
                                  size="sm"
                                  onClick={() => acceptFriendRequestMutation.mutate(request)}
                                  disabled={acceptFriendRequestMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700">

                                    <Check className="w-4 h-4 mr-1" />
                                    Annehmen
                                  </Button>
                                  <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => rejectFriendRequestMutation.mutate(request)}
                                  disabled={rejectFriendRequestMutation.isPending}
                                  className="border-2 border-red-300 text-red-600 hover:bg-red-50">

                                    <X className="w-4 h-4 mr-1" />
                                    Ablehnen
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>);

                  })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          }

            {/* Freundesliste */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="space-y-2">

              {friends.length === 0 ?
              <div className="text-center py-12">
                  <Users className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                  <p className="text-stone-600 text-lg font-semibold mb-2">
                    Noch keine Freunde
                  </p>
                  <p className="text-stone-500">
                    Füge Freunde hinzu, um ihre Sammlungen zu sehen!
                  </p>
                </div> :

              <div className="grid gap-2">
                {friends.map((friend, index) => {
                const friendData = getFriendData(friend);
                if (!friendData) return null;

                return (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}>

                      <Card className="border shadow-sm hover:border-purple-300 hover:shadow-md transition-all bg-white group rounded-lg">
                        <CardContent className="p-2">
                          <button
                          onClick={() => navigate(createPageUrl(`FriendProfile?email=${friendData.email}`))}
                          className="flex items-start gap-2 w-full text-left min-w-0">

                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md overflow-hidden flex-shrink-0">
                              {friendData.avatar_url ?
                            <img src={friendData.avatar_url} alt={friendData.name} className="w-full h-full object-cover" /> :

                            friendData.name?.[0]?.toUpperCase() || friendData.email?.[0]?.toUpperCase()
                            }
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Obere Zeile: Name + Icons */}
                              <div className="flex items-center justify-between gap-1 min-w-0">
                                <div className="font-bold text-stone-900 group-hover:text-green-600 transition-colors truncate text-sm flex-1 min-w-0">
                                  {friendData.name}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
                                  <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Möchtest du ${friendData.name} wirklich entfernen?`)) {
                                      removeFriendMutation.mutate(friend);
                                    }
                                  }}
                                  disabled={removeFriendMutation.isPending}
                                  className="text-red-600 hover:bg-red-50 w-6 h-6 p-0 flex-shrink-0">

                                    <UserMinus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              {/* Letzte Aktivität */}
                              {friendData.lastActivity &&
                            <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5 min-w-0">
                                  {friendData.lastActivity.type === 'discovery' && friendData.lastActivity.plant &&
                              <>
                                      <Leaf className="w-3 h-3 text-green-600 flex-shrink-0" />
                                      <span className="truncate flex-1 min-w-0">
                                        {friendData.lastActivity.plant.species_name}
                                      </span>
                                    </>
                              }
                                  {friendData.lastActivity.type === 'achievement' && friendData.lastActivity.achievement &&
                              <>
                                      <Trophy className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                      <span className="truncate flex-1 min-w-0">
                                        {friendData.lastActivity.achievement.title}
                                      </span>
                                    </>
                              }
                                  <span className="text-stone-400 flex-shrink-0 whitespace-nowrap text-[10px]">
                                    · {formatDistanceToNow(new Date(friendData.lastActivity.date), { addSuffix: false, locale: de })}
                                  </span>
                                </div>
                            }
                            </div>
                          </button>
                        </CardContent>
                      </Card>
                    </motion.div>);

                })}
                </div>
              }
            </motion.div>
          </TabsContent>

          {/* Gifts Tab Content */}
          <TabsContent value="gifts" className="pt-14 px-2 pb-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {sharedScans.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                    <Gift className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-600 text-lg font-semibold mb-2">
                      Noch keine Geschenke
                    </p>
                    <p className="text-stone-500">
                      Deine Freunde können dir Pflanzen schenken!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {sharedScans.map((scan, index) => {
                    const plant = allPlants.find(p => p.id === scan.plant_id);
                    const genus = plant ? allGenera.find(g => 
                      g.category === plant.genus_category && 
                      g.category_dex_number === plant.genus_number
                    ) : null;
                    const senderProfile = allPublicProfiles.find(p => 
                      p.user_email?.toLowerCase() === scan.shared_by?.toLowerCase()
                    );
                    
                    return (
                      <motion.div
                        key={scan.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <Card 
                          className="border shadow-sm hover:border-pink-300 hover:shadow-md transition-all bg-white overflow-hidden cursor-pointer"
                          onClick={() => navigate(createPageUrl(`ViewSharedScan?id=${scan.id}`))}
                        >
                          {scan.image_url && (
                            <div className="relative aspect-square">
                              <img
                                src={scan.image_url}
                                alt={plant?.species_name}
                                className="w-full h-full object-cover"
                              />
                              {!scan.viewed && (
                                <div className="absolute top-2 right-2 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center shadow-md">
                                  <Gift className="w-3 h-3 text-white" />
                                </div>
                              )}
                              <div className="absolute bottom-2 left-2 w-6 h-6 bg-white rounded-full shadow-md overflow-hidden border border-stone-200">
                                {senderProfile?.avatar_url ? (
                                  <img
                                    src={senderProfile.avatar_url}
                                    alt={senderProfile.display_name || scan.shared_by}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                                    {scan.shared_by?.[0]?.toUpperCase() || '?'}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          <CardContent className="p-2">
                            <p className="text-xs font-semibold text-stone-900 truncate">
                              {plant?.species_name || 'Unbekannt'}
                            </p>
                            <p className="text-[10px] text-stone-500 truncate">
                              von {senderProfile?.display_name || scan.shared_by}
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Desktop View - TODO: Implement desktop tabs version similar to mobile */}
        <div className="hidden md:block pt-14">

          {/* Freundschaftsanfragen Desktop */}
          {pendingRequests.length > 0 &&
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6">

              <Card className="border-2 border-amber-200 shadow-lg bg-white">
                <CardHeader className="border-b border-amber-100 bg-amber-50">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Bell className="w-6 h-6 text-amber-600" />
                    Freundschaftsanfragen
                    <Badge className="bg-amber-600 text-white ml-2">{pendingRequests.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {pendingRequests.map((request, index) => {
                    const requesterData = getFriendData(request);
                    if (!requesterData) return null;

                    return (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}>

                          <Card className="border-2 border-stone-200 bg-white">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md overflow-hidden flex-shrink-0">
                                    {requesterData?.avatar_url ?
                                  <img src={requesterData.avatar_url} alt={requesterData.name} className="w-full h-full object-cover" /> :

                                  requesterData.name?.[0]?.toUpperCase() || '?'
                                  }
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-stone-900 truncate">{requesterData.name}</div>
                                    <div className="text-sm text-stone-600">möchte dein Freund sein</div>
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button
                                  size="sm"
                                  onClick={() => acceptFriendRequestMutation.mutate(request)}
                                  disabled={acceptFriendRequestMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700">

                                    <Check className="w-4 h-4 mr-1" />
                                    Annehmen
                                  </Button>
                                  <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => rejectFriendRequestMutation.mutate(request)}
                                  disabled={rejectFriendRequestMutation.isPending}
                                  className="border-2 border-red-300 text-red-600 hover:bg-red-50">

                                    <X className="w-4 h-4 mr-1" />
                                    Ablehnen
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>);

                  })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          }

          {/* Freund hinzufügen Desktop */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-8">

            <Card className="border-2 border-stone-200 shadow-lg bg-white">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="text-sm font-semibold text-stone-700 mb-2 block">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Freundschaftsanfrage senden
                    </label>
                    <Input
                      placeholder="E-Mail des Freundes"
                      value={friendEmail}
                      onChange={(e) => setFriendEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendRequest()}
                      className="border-2 border-stone-200" />

                  </div>
                  <Button
                    onClick={handleSendRequest}
                    disabled={!friendEmail || sendFriendRequestMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 px-8 w-full md:w-auto">

                    {sendFriendRequestMutation.isPending ?
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird gesendet...
                      </> :

                    <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Anfrage senden
                      </>
                    }
                  </Button>
                </div>

                <Button
                  onClick={() => {
                    const email = prompt("📧 E-Mail des Freundes eingeben:");
                    if (email && email.trim()) {
                      shareAppMutation.mutate(email.trim());
                    }
                  }}
                  disabled={shareAppMutation.isPending}
                  variant="outline"
                  className="w-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {shareAppMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4 mr-2" />
                  )}
                  Teile diese App mit einem Freund!
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Freundesliste Desktop */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}>

            <Card className="border-2 border-stone-200 shadow-lg bg-white">
              <CardHeader className="border-b border-stone-200">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="w-6 h-6 text-green-600" />
                  Deine Freunde
                  {friends.length > 0 &&
                  <Badge className="bg-green-600 text-white ml-2">{friends.length}</Badge>
                  }
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {friends.length === 0 ?
                <div className="text-center py-12">
                    <Users className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-600 text-lg font-semibold mb-2">
                      Noch keine Freunde
                    </p>
                    <p className="text-stone-500">
                      Füge Freunde hinzu, um ihre Sammlungen zu sehen!
                    </p>
                  </div> :

                <div className="grid gap-3">
                    {friends.map((friend, index) => {
                    const friendData = getFriendData(friend);
                    if (!friendData) return null;

                    return (
                      <motion.div
                        key={friend.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}>

                          <Card className="border-2 border-stone-200 hover:border-green-300 hover:shadow-md transition-all bg-white group">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <button
                                onClick={() => navigate(createPageUrl(`FriendProfile?email=${friendData.email}`))}
                                className="flex items-start gap-3 flex-1 text-left min-w-0">

                                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md overflow-hidden flex-shrink-0">
                                    {friendData.avatar_url ?
                                  <img src={friendData.avatar_url} alt={friendData.name} className="w-full h-full object-cover" /> :

                                  friendData.name?.[0]?.toUpperCase() || friendData.email?.[0]?.toUpperCase()
                                  }
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-lg text-stone-900 group-hover:text-green-600 transition-colors truncate">
                                      {friendData.name}
                                    </div>
                                    <div className="text-sm text-stone-600 mb-2">
                                      <span className="truncate">{friendData.title}</span>
                                    </div>

                                    {/* Letzte Aktivität Desktop */}
                                    {friendData.lastActivity &&
                                  <div className="text-sm text-stone-500 flex items-start gap-2 bg-stone-50 rounded-lg p-2">
                                        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          {friendData.lastActivity.type === 'discovery' && friendData.lastActivity.plant &&
                                      <div className="flex items-center gap-2">
                                              <Leaf className="w-4 h-4 text-green-600 flex-shrink-0" />
                                              <span className="truncate font-medium">
                                                {friendData.lastActivity.plant.species_name}
                                              </span>
                                            </div>
                                      }
                                          {friendData.lastActivity.type === 'achievement' && friendData.lastActivity.achievement &&
                                      <div className="flex items-center gap-2">
                                              <Trophy className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                              <span className="truncate font-medium">
                                                {friendData.lastActivity.achievement.title}
                                              </span>
                                            </div>
                                      }
                                          <span className="text-stone-400 text-xs">
                                            {formatDistanceToNow(new Date(friendData.lastActivity.date), { addSuffix: true, locale: de })}
                                          </span>
                                        </div>
                                      </div>
                                  }
                                  </div>
                                  <ChevronRight className="w-6 h-6 text-stone-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                                </button>
                                <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Möchtest du ${friendData.name} wirklich entfernen?`)) {
                                    removeFriendMutation.mutate(friend);
                                  }
                                }}
                                disabled={removeFriendMutation.isPending}
                                className="text-red-600 hover:bg-red-50 flex-shrink-0">

                                  <UserMinus className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>);

                  })}
                  </div>
                }
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Add Friend Dialog */}
      <Dialog open={showAddFriendDialog} onOpenChange={setShowAddFriendDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Freund hinzufügen oder einladen</DialogTitle>
            <DialogDescription>
              Wähle eine Option aus
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Freundschaftsanfrage senden</h3>
              <p className="text-xs text-stone-600">
                Sende eine Anfrage an jemanden, der bereits die App nutzt
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="E-Mail des Freundes"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendRequest()}
                  className="border-2 border-stone-200 flex-1"
                />
                <Button
                  onClick={() => {
                    handleSendRequest();
                    if (!sendFriendRequestMutation.isPending) {
                      setShowAddFriendDialog(false);
                    }
                  }}
                  disabled={!friendEmail || sendFriendRequestMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {sendFriendRequestMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="border-t border-stone-200 pt-4">
              <h3 className="text-sm font-semibold text-stone-900 mb-2">Freund einladen</h3>
              <p className="text-xs text-stone-600 mb-3">
                Erstelle einen Einladungslink und teile ihn per WhatsApp, SMS oder E-Mail
              </p>
              <Button
                onClick={() => {
                  // Erstelle Referral-Link
                  const referralCode = encodeURIComponent(user.email);
                  const referralLink = `https://floralog.de?ref=${referralCode}`;
                  
                  // Erstelle Share-Text
                  const shareText = `Hallo!

${user.display_name || user.full_name} lädt dich zu Floralog ein! 🌱

Floralog ist eine App zum Entdecken und Sammeln von Pflanzen. Scanne Pflanzen in deiner Umgebung, baue deine Sammlung auf und tausche dich mit Freunden aus!

Starte jetzt: ${referralLink}

Viel Spaß beim Entdecken! 🌿`;

                  // Kopiere in Zwischenablage
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareText).then(() => {
                      alert(`✅ Einladungstext wurde in die Zwischenablage kopiert!\n\nSende ihn per WhatsApp, SMS oder E-Mail!\n\nDein Referral-Link: ${referralLink}`);
                      setShowAddFriendDialog(false);
                    }).catch(() => {
                      alert(`✅ Dein Referral-Link: ${referralLink}\n\nKopiere ihn und teile ihn mit deinen Freunden!`);
                    });
                  } else {
                    alert(`✅ Dein Referral-Link: ${referralLink}\n\nKopiere ihn und teile ihn mit deinen Freunden!`);
                  }
                }}
                variant="outline"
                className="w-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Einladungslink kopieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
      </>);

      }