import { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { createUserNotification } from "@/api/notificationService";
import { sendFriendRequest, removeFriendship, respondToFriendRequest } from "@/api/friendService";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UserPlus, Users, Loader2, Check, X, Bell, ChevronRight, UserMinus, Leaf, Trophy, Share2, Plus, Heart, UserCheck, BookOpenText, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { checkAndUnlockAchievements } from "@/components/achievements/achievementChecker";
import AchievementNotification from "@/components/achievements/AchievementNotification";
import { AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import MobileBackButton from "@/components/navigation/MobileBackButton";
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

export function useFriendsFeatureContent({
  embedded = false,
  isLightUi,
  onHeaderMetaChange,
  openAddFriendDialogNonce = 0,
  onRequestClose: _onRequestClose = null,
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "friends");
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);

  useEffect(() => {
    if (!embedded) return;
    if (openAddFriendDialogNonce > 0) {
      setActiveTab("friends");
      setShowAddFriendDialog(true);
    }
  }, [embedded, openAddFriendDialogNonce]);

  useEffect(() => {
    const allowedTabs = new Set(["friends", "news", "explorer"]);
    if (!allowedTabs.has(activeTab)) {
      setActiveTab("friends");
    }
  }, [activeTab]);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
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
    queryFn: () => Query.Friend.list(),
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
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 60000 // 1 Minute Cache
  });

  const { data: allPublicProfiles = [] } = useQuery({
    queryKey: ['allPublicProfiles'],
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 30000 // 30 Sekunden Cache
  });

  // Lade alle Discoveries - mit höherem Limit
  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['allDiscoveries'],
    queryFn: async () => {
      const discoveries = await Query.UserPlantDiscovery.list('-created_date', 999);
      console.log("📊 Geladene Discoveries:", discoveries.length);
      return discoveries;
    }
  });

  // Lade alle Plants
  const { data: allPlants = [] } = useQuery({
    queryKey: ['allPlants'],
    queryFn: () => Query.Plant.list()
  });

  const NEWS_TYPES = ['gift_received', 'collection_followed', 'friendship_accepted', 'friend_request_received', 'friend_achievement', 'scan_liked'];

  const { data: userNews = [] } = useQuery({
    queryKey: ['friendsNews', user?.id, user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const [byAuthId, byEmail] = await Promise.all([
        user?.id ? Query.UserNotification.filter({ auth_id: user.id }) : Promise.resolve([]),
        Query.UserNotification.filter({ user_email: user.email }),
      ]);

      const merged = [...byAuthId, ...byEmail];
      const dedupedMap = new Map();

      merged.forEach((notification) => {
        dedupedMap.set(notification.id, notification);
      });

      const feed = Array.from(dedupedMap.values())
        .filter((notification) => NEWS_TYPES.includes(notification.notification_type))
        .sort((a, b) => {
          const aTime = new Date(a.created_date || a.created_at || 0).getTime();
          const bTime = new Date(b.created_date || b.created_at || 0).getTime();
          return bTime - aTime;
        })
        .slice(0, 50);

      console.info('[Friends] Loaded news feed', {
        byAuthId: byAuthId.length,
        byEmail: byEmail.length,
        deduped: dedupedMap.size,
        final: feed.length,
      });

      return feed;
    },
    enabled: !!user?.email,
    staleTime: 15000,
  });

  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = Query.UserNotification.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['friendsNews'] });
      }
    });

    return unsubscribe;
  }, [user?.email, queryClient]);

  // Lade alle Achievements - mit höherem Limit
  const { data: allUserAchievements = [] } = useQuery({
    queryKey: ['allUserAchievements'],
    queryFn: async () => {
      const achievements = await Query.UserAchievement.list('-created_date', 999);
      console.log("📊 Geladene UserAchievements:", achievements.length);
      return achievements;
    }
  });

  // Lade Achievement Definitionen
  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => Query.Achievement.list()
  });

  const sendFriendRequestMutation = useMutation({
    mutationFn: async () => {
      if (!user || !user.email) {
        throw new Error("User nicht geladen!");
      }

      const targetEmail = friendEmail.trim();
      if (!targetEmail) {
        throw new Error("Bitte gib eine E-Mail-Adresse ein.");
      }

      const myEmail = user.email.toLowerCase();
      const friendEmailLower = targetEmail.toLowerCase();

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

      // Serverseitiger Insert (bypasst clientseitige RLS-Probleme)
      await sendFriendRequest(targetEmail);

      const targetProfile = allPublicProfiles.find(
        (profile) => profile.user_email?.toLowerCase() === friendEmailLower
      );
      const senderName = user.display_name || user.full_name || user.email;

      try {
        await createUserNotification({
          authId: targetProfile?.auth_id,
          userEmail: targetProfile?.user_email || targetEmail,
          notificationType: "friend_request_received",
          title: "🤝 Neue Freundschaftsanfrage",
          message: `${senderName} hat dir eine Freundschaftsanfrage gesendet.`,
          actionUrl: "Friends",
          displayLocation: "banner",
          createdBy: user.email,
        });
      } catch (notificationError) {
        console.error("[Friends] Failed to create friend request notification:", notificationError);
      }
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
      const affected = await respondToFriendRequest(request.request_sent_by, "accept");
      if (affected <= 0) {
        throw new Error("Diese Anfrage ist nicht mehr offen.");
      }
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      await queryClient.refetchQueries({ queryKey: ['allFriendRecords'] });

      // Zeige Success-Message
      const requesterEmail = variables.request_sent_by;
      alert(`✅ Freundschaft mit ${requesterEmail} bestätigt!`);

      try {
        const requesterProfile = allPublicProfiles.find(
          (profile) => profile.user_email?.toLowerCase() === requesterEmail?.toLowerCase()
        );
        const accepterName = user.display_name || user.full_name || user.email;

        await createUserNotification({
          authId: requesterProfile?.auth_id,
          userEmail: requesterProfile?.user_email || requesterEmail,
          notificationType: "friendship_accepted",
          title: "🤝 Freundschaft bestätigt",
          message: `${accepterName} hat deine Freundschaftsanfrage angenommen!`,
          actionUrl: `FriendProfile?email=${encodeURIComponent(user.email)}`,
          displayLocation: "banner",
          createdBy: user.email
        });
      } catch (notificationError) {
        console.error("[Friends] Failed to create friendship acceptance notification:", notificationError);
      }

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
      const affected = await respondToFriendRequest(request.request_sent_by, "reject");
      if (affected <= 0) {
        throw new Error("Diese Anfrage ist nicht mehr offen.");
      }
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
      return removeFriendship(friendToRemove.email);
    },
    onSuccess: (removedCount) => {
      queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      if (removedCount > 0) {
        alert(`🗑️ Freund entfernt`);
      } else {
        alert(`Es wurde keine aktive Freundschaft gefunden.`);
      }
    },
    onError: (error) => {
      alert(`Fehler beim Entfernen des Freundes: ${error.message}`);
    }
  });

  const markNewsAsSeenMutation = useMutation({
    mutationFn: async (notificationId) => {
      await Query.UserNotification.update(notificationId, { seen: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendsNews'] });
    }
  });

  const shareAppMutation = useMutation({
    mutationFn: async (email) => {
      // Erstelle Referral-Eintrag
      await Query.Referral.create({
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
      await sendFriendRequestMutation.mutateAsync();
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

  const parseActivityDate = (primary, fallback) => {
    const value = primary || fallback;
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    // Filter offensichtlich kaputte Legacy-Daten (1970 etc.) heraus
    const minValid = new Date('2000-01-01T00:00:00Z');
    if (d < minValid) return null;
    return d;
  };

  // Helper: Hole letzte Aktivität eines Freundes (bevorzugt über auth_id)
  const getLastActivity = ({ email, authId }) => {
    if (!email && !authId) {
      console.log("⚠️ Weder Email noch authId übergeben");
      return null;
    }

    const friendEmailLower = email?.toLowerCase();
    console.log("🔍 Suche Aktivitäten für:", { email: friendEmailLower, authId });

    const matchesFriend = (row) => {
      const authMatch = authId && row.auth_id && row.auth_id === authId;
      const emailMatch = friendEmailLower && (
        row.user?.toLowerCase?.() === friendEmailLower ||
        row.created_by?.toLowerCase?.() === friendEmailLower
      );
      return authMatch || emailMatch;
    };

    // Letzte Discovery - prüfe auth_id und fallweise Email
    const friendDiscoveries = allDiscoveries.filter((d) => matchesFriend(d));
    console.log(`📦 ${friendDiscoveries.length} Discoveries gefunden`);

    const validSortedDiscoveries = friendDiscoveries
      .map((d) => ({
        row: d,
        date: parseActivityDate(d.discovered_date, d.created_date)
      }))
      .filter((x) => x.date)
      .sort((a, b) => b.date - a.date);

    const lastDiscoveryEntry = validSortedDiscoveries[0] || null;

    // Letztes Achievement
    const friendAchievements = allUserAchievements.filter((a) => matchesFriend(a));
    console.log(`🏆 ${friendAchievements.length} Achievements gefunden`);

    const validSortedAchievements = friendAchievements
      .map((a) => ({
        row: a,
        date: parseActivityDate(a.unlocked_date, a.created_date)
      }))
      .filter((x) => x.date)
      .sort((a, b) => b.date - a.date);

    const lastAchievementEntry = validSortedAchievements[0] || null;

    let activity = null;

    if (lastDiscoveryEntry && lastAchievementEntry) {
      const discoveryDate = lastDiscoveryEntry.date;
      const achievementDate = lastAchievementEntry.date;

      console.log("📅 Discovery:", discoveryDate, "Achievement:", achievementDate);

      if (discoveryDate > achievementDate) {
        const lastDiscovery = lastDiscoveryEntry.row;
        const plant = allPlants.find((p) => p.id === lastDiscovery.plant_id);
        activity = {
          type: 'discovery',
          plant,
          date: discoveryDate.toISOString()
        };
        console.log("✅ Neueste Aktivität: Discovery -", plant?.species_name);
      } else {
        const lastAchievement = lastAchievementEntry.row;
        const achievement = achievements.find((a) => a.id === lastAchievement.achievement_id);
        activity = {
          type: 'achievement',
          achievement,
          date: achievementDate.toISOString()
        };
        console.log("✅ Neueste Aktivität: Achievement -", achievement?.title);
      }
    } else if (lastDiscoveryEntry) {
      const lastDiscovery = lastDiscoveryEntry.row;
      const plant = allPlants.find((p) => p.id === lastDiscovery.plant_id);
      activity = {
        type: 'discovery',
        plant,
        date: lastDiscoveryEntry.date.toISOString()
      };
      console.log("✅ Neueste Aktivität: Discovery -", plant?.species_name);
    } else if (lastAchievementEntry) {
      const lastAchievement = lastAchievementEntry.row;
      const achievement = achievements.find((a) => a.id === lastAchievement.achievement_id);
      activity = {
        type: 'achievement',
        achievement,
        date: lastAchievementEntry.date.toISOString()
      };
      console.log("✅ Neueste Aktivität: Achievement -", achievement?.title);
    } else {
      console.log("❌ Keine gültigen Aktivitäten gefunden");
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

  const getNewsMeta = (notificationType) => {
    switch (notificationType) {
      case 'gift_received':
        return { icon: Share2, accent: 'text-pink-600', card: 'bg-pink-50 border-pink-200' };
      case 'collection_followed':
        return { icon: Users, accent: 'text-blue-600', card: 'bg-blue-50 border-blue-200' };
      case 'friendship_accepted':
        return { icon: UserCheck, accent: 'text-green-600', card: 'bg-green-50 border-green-200' };
      case 'friend_request_received':
        return { icon: UserPlus, accent: 'text-indigo-600', card: 'bg-indigo-50 border-indigo-200' };
      case 'friend_achievement':
        return { icon: Trophy, accent: 'text-amber-600', card: 'bg-amber-50 border-amber-200' };
      case 'scan_liked':
        return { icon: Heart, accent: 'text-rose-600', card: 'bg-rose-50 border-rose-200' };
      default:
        return { icon: Bell, accent: 'text-stone-600', card: 'bg-stone-50 border-stone-200' };
    }
  };

  const getNewsActor = (newsItem) => {
    const actorEmail = newsItem.created_by;
    if (!actorEmail || actorEmail === 'system') {
      return {
        name: 'System',
        avatarUrl: null,
        email: null,
      };
    }

    const actorProfile = allPublicProfiles.find(
      (profile) => profile.user_email?.toLowerCase() === actorEmail.toLowerCase()
    );

    return {
      name:
        actorProfile?.display_name ||
        actorProfile?.full_name ||
        actorEmail,
      avatarUrl: actorProfile?.avatar_url || null,
      email: actorEmail,
    };
  };

  const unreadNewsCount = userNews.filter((notification) => notification.seen !== true).length;

  const getPendingRequestFromNews = (newsItem) => {
    if (newsItem.notification_type !== 'friend_request_received' || !user?.email) {
      return null;
    }

    const actorEmail = newsItem.created_by?.toLowerCase();
    const myEmail = user.email.toLowerCase();
    if (!actorEmail) return null;

    return allFriendRecords.find((request) =>
      request.status === 'pending' &&
      request.request_sent_by?.toLowerCase() === actorEmail &&
      request.request_sent_to?.toLowerCase() === myEmail
    ) || null;
  };

  const handleFriendRequestActionFromNews = async (event, newsItem, action) => {
    event.stopPropagation();

    const pendingRequest = getPendingRequestFromNews(newsItem);
    if (!pendingRequest) {
      alert('Diese Anfrage ist nicht mehr offen.');
      markNewsAsSeenMutation.mutate(newsItem.id);
      await queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      return;
    }

    if (action === 'accept') {
      acceptFriendRequestMutation.mutate(pendingRequest);
    } else {
      rejectFriendRequestMutation.mutate(pendingRequest);
    }

    if (newsItem.seen !== true) {
      markNewsAsSeenMutation.mutate(newsItem.id);
    }
  };

  const openNewsEntry = (notification) => {
    if (notification.seen !== true) {
      markNewsAsSeenMutation.mutate(notification.id);
    }

    if (notification.action_url) {
      navigate(createPageUrl(notification.action_url));
    }
  };

  // Helper: Hole Freundesdaten
  const getFriendData = (friendEntry) => {
    if (!user || !user.email) return null;

    const isCurrentUserSender = friendEntry.request_sent_by?.toLowerCase() === user.email.toLowerCase();
    const friendEmail = isCurrentUserSender ? friendEntry.request_sent_to : friendEntry.request_sent_by;

    // Suche PublicProfile (bevorzugt, inkl. auth_id)
    const friendProfile = allPublicProfiles.find((p) => p.user_email?.toLowerCase() === friendEmail?.toLowerCase());

    // Fallback auf baseUser
    const friendUser = allUsers.find((u) => u.email?.toLowerCase() === friendEmail?.toLowerCase());

    const friendAuthId = friendProfile?.auth_id || friendUser?.auth_id || null;

    // Hole letzte Aktivität, bevorzugt über auth_id
    const lastActivity = getLastActivity({
      email: friendEmail,
      authId: friendAuthId
    });

    return {
      id: friendEntry.id,
      email: friendEmail,
      auth_id: friendAuthId,
      name: friendProfile?.display_name || friendProfile?.full_name || friendUser?.display_name || friendUser?.full_name || friendEmail,
      avatar_url: friendProfile?.avatar_url || friendUser?.avatar_url,
      level: friendProfile?.level || friendUser?.level || 1,
      title: friendProfile?.selected_title || friendProfile?.title || friendUser?.selected_title || friendUser?.title || "Pflanzen-Anfänger",
      lastActivity
    };
  };

  const ownEmailLower = user?.email?.toLowerCase() || "";
  const friendEmailSet = new Set(
    friends
      .map((entry) => {
        const isCurrentUserSender = entry.request_sent_by?.toLowerCase() === ownEmailLower;
        return isCurrentUserSender ? entry.request_sent_to?.toLowerCase() : entry.request_sent_by?.toLowerCase();
      })
      .filter(Boolean)
  );

  const profileByEmail = new Map(
    (allPublicProfiles || [])
      .filter((profile) => !!profile.user_email)
      .map((profile) => [profile.user_email.toLowerCase(), profile])
  );

  const getDiscoveryEmailLower = (entry) =>
    (entry.user || entry.created_by || entry.user_email || "").toLowerCase();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const acceptedEmailSet = new Set([ownEmailLower, ...Array.from(friendEmailSet)]);

  const recentDiscoveries = (allDiscoveries || [])
    .filter((entry) => {
      const entryEmail = getDiscoveryEmailLower(entry);
      if (!entryEmail || !acceptedEmailSet.has(entryEmail)) return false;
      const date = new Date(entry.created_date || entry.discovered_date || entry.updated_date || 0);
      if (Number.isNaN(date.getTime())) return false;
      return date >= thirtyDaysAgo;
    })
    .sort((a, b) =>
      new Date(b.created_date || b.discovered_date || b.updated_date || 0).getTime() -
      new Date(a.created_date || a.discovered_date || a.updated_date || 0).getTime()
    );

  const seenPlantKeys = new Set();
  const explorerLogEntries = [];

  recentDiscoveries.forEach((entry) => {
    const entryEmail = getDiscoveryEmailLower(entry);
    const key = `${entryEmail}::${entry.plant_id}`;
    if (seenPlantKeys.has(key)) return;
    seenPlantKeys.add(key);

    const scansBySameUserPlant = recentDiscoveries.filter((candidate) => {
      return getDiscoveryEmailLower(candidate) === entryEmail && candidate.plant_id === entry.plant_id;
    });

    const plant = allPlants.find((plantItem) => plantItem.id === entry.plant_id);
    const profile = profileByEmail.get(entryEmail);

    explorerLogEntries.push({
      id: entry.id,
      discovery: entry,
      plant,
      actorEmail: entryEmail,
      actorName: profile?.display_name || profile?.full_name || entryEmail,
      actorAvatar: profile?.avatar_url || null,
      scanCount: scansBySameUserPlant.length,
      timestamp: new Date(entry.created_date || entry.discovered_date || entry.updated_date || Date.now()),
    });
  });

  const tabsHeaderClass = embedded
    ? `sticky top-0 z-40 backdrop-blur-sm border-b ${isLightUi ? "bg-white/70 border-[#b99a48]/30" : "bg-black/20 border-[#f0e5a5]/20"}`
    : "fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-stone-200";

  const friendsContentClass = embedded ? "mt-0 px-2 pb-20 flex-1 min-h-0 overflow-y-auto overflow-x-hidden" : "pt-36 px-2 pb-4";
  const newsContentClass = embedded ? "mt-0 px-2 pb-20 flex-1 min-h-0 overflow-y-auto overflow-x-hidden" : "pt-36 px-2 pb-4";
  const explorerContentClass = embedded ? "mt-0 px-2 pb-20 flex-1 min-h-0 overflow-y-auto overflow-x-hidden" : "pt-36 px-2 pb-4";
  const listTopFadePx = 12;
  const listBottomFadePx = 18;
  const embeddedContentMaskStyle = embedded ? {
    WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
    maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
  } : undefined;

  const moduleChips = [
    {
      id: "friends",
      title: "Freunde",
      active: friends.length,
      total: friends.length,
    },
    {
      id: "news",
      title: "News",
      active: unreadNewsCount,
      total: userNews.length,
    },
    {
      id: "explorer",
      title: "Forscher Log",
      active: explorerLogEntries.length,
      total: explorerLogEntries.length,
    },
  ];

  useEffect(() => {
    if (!embedded || typeof onHeaderMetaChange !== "function") return;

    const infoLabel = activeTab === "friends"
      ? `${friends.length} Freunde`
      : activeTab === "news"
        ? `${unreadNewsCount} Neuigkeiten`
        : `${explorerLogEntries.length} Log-Eintraege`;

    onHeaderMetaChange({
      title: activeTab === "friends" ? "Social" : activeTab === "news" ? "Neuigkeiten" : "Forscher Log",
      subtitle: activeTab === "explorer" ? "Scans aus den letzten 30 Tagen" : "Dein Freundesbereich",
      infoLabel,
    });
  }, [
    embedded,
    onHeaderMetaChange,
    activeTab,
    friends.length,
    unreadNewsCount,
    explorerLogEntries.length,
  ]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>);

  }

  return (
    <>
      {embedded && isLightUi === false && (
        <style>{`
          [data-embedded-module="friends"][data-theme="dark"] .bg-white,
          [data-embedded-module="friends"][data-theme="dark"] .bg-white\/80,
          [data-embedded-module="friends"][data-theme="dark"] .bg-white\/90,
          [data-embedded-module="friends"][data-theme="dark"] .bg-stone-50,
          [data-embedded-module="friends"][data-theme="dark"] .bg-stone-100,
          [data-embedded-module="friends"][data-theme="dark"] .bg-stone-50\/80 {
            background-color: rgba(20, 20, 20, 0.62) !important;
          }
          [data-embedded-module="friends"][data-theme="dark"] .text-stone-900 {
            color: rgb(245 245 244) !important;
          }
          [data-embedded-module="friends"][data-theme="dark"] .text-stone-700,
          [data-embedded-module="friends"][data-theme="dark"] .text-stone-600,
          [data-embedded-module="friends"][data-theme="dark"] .text-stone-500,
          [data-embedded-module="friends"][data-theme="dark"] .text-stone-400 {
            color: rgb(214 211 209) !important;
          }
          [data-embedded-module="friends"][data-theme="dark"] .border-stone-200,
          [data-embedded-module="friends"][data-theme="dark"] .border-stone-300,
          [data-embedded-module="friends"][data-theme="dark"] .border-amber-100 {
            border-color: rgba(240, 229, 165, 0.28) !important;
          }
        `}</style>
      )}

      {!embedded && (
        <div 
          className="fixed inset-0 -z-10"
          style={{
            background: averageColor ?
            `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)` :
            'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
          }}
        />
      )}
      
      {/* Scrollbarer Content */}
      <div
        data-embedded-module="friends"
        data-theme={isLightUi ? "light" : "dark"}
        className={embedded ? "h-full min-h-0 overflow-hidden" : "min-h-screen p-4 md:p-8 overflow-x-hidden"}
      >
        {!embedded && <MobileBackButton />}

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

      <div className={`${embedded ? "w-full h-full min-h-0 flex flex-col" : "max-w-4xl mx-auto"} w-full`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className={embedded ? "w-full h-full min-h-0 flex flex-col" : "w-full"}>
          {/* Tabs Header - Fixed am oberen Bildschirmrand */}
          <div className={`${tabsHeaderClass} ${embedded ? "shrink-0" : ""}`}>
            <div className="max-w-4xl mx-auto">
              {!embedded && (
                <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-stone-900 truncate">
                      {activeTab === "friends" ? "Social" : activeTab === "news" ? "Neuigkeiten" : "Forscher Log"}
                    </h1>
                    <p className="text-xs text-stone-600 truncate">
                      {activeTab === "explorer" ? "Scans aus den letzten 30 Tagen" : "Dein Freundesbereich"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeTab === "friends" && (
                      <button
                        type="button"
                        onClick={() => setShowAddFriendDialog(true)}
                        className="w-11 h-11 rounded-full border border-[#f0e5a5]/35 bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/45 transition-colors shrink-0"
                        aria-label="Freund hinzufügen"
                      >
                        <Plus className="w-5 h-5 text-[#f0e5a5]" />
                      </button>
                    )}
                    <Badge className="bg-stone-800 text-white text-[10px] px-2 py-1 shrink-0">
                      {activeTab === "friends" ? `${friends.length} Freunde` : activeTab === "news" ? `${unreadNewsCount} neu` : `${explorerLogEntries.length} Eintraege`}
                    </Badge>
                  </div>
                </div>
              )}

              <div className={`px-2 py-2 ${embedded ? "" : "border-t border-stone-200/60"}`}>
                <div className="grid grid-cols-3 gap-2 min-w-0">
                  {moduleChips.map((chip) => {
                    const isPrimary = activeTab === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setActiveTab(chip.id)}
                        className={
                          "flex items-center justify-center gap-2 px-2 py-1.5 rounded-full border text-[11px] whitespace-nowrap transition-colors min-w-0 " +
                          (isPrimary
                            ? (isLightUi
                              ? "bg-white/90 text-[#8f6b22] shadow-sm"
                              : "bg-black/55 text-[#f7f0c1] shadow-sm")
                            : (isLightUi
                              ? "bg-white/55 text-stone-700 hover:bg-white/75"
                              : "bg-black/35 text-stone-200 hover:bg-black/50"))
                        }
                        style={{
                          borderColor: isPrimary
                            ? (isLightUi ? "rgba(200,172,98,0.70)" : "rgba(240,229,165,0.75)")
                            : (isLightUi ? "rgba(200,172,98,0.35)" : "rgba(255,255,255,0.3)"),
                        }}
                      >
                        <span className="font-medium truncate">{chip.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Friends Tab Content */}
          <TabsContent value="friends" className={friendsContentClass} style={embeddedContentMaskStyle}>
            <div style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>
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
                                      removeFriendMutation.mutate(friendData);
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
            </div>
          </TabsContent>

          {/* News Tab Content */}
          <TabsContent value="news" className={newsContentClass} style={embeddedContentMaskStyle}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}
            >
              {userNews.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                    <Bell className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-600 text-lg font-semibold mb-2">
                      Noch keine Neuigkeiten
                    </p>
                    <p className="text-stone-500">
                      Hier siehst du, was in deinem Freundeskreis passiert.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {userNews.map((newsItem, index) => {
                    const meta = getNewsMeta(newsItem.notification_type);
                    const Icon = meta.icon;
                    const actor = getNewsActor(newsItem);
                    const avatarFallback = (actor.name || actor.email || '?').charAt(0).toUpperCase();
                    const pendingRequestFromNews = getPendingRequestFromNews(newsItem);
                    const showFriendRequestActions =
                      newsItem.notification_type === 'friend_request_received' &&
                      !!pendingRequestFromNews;
                    const showFriendRequestResolvedHint =
                      newsItem.notification_type === 'friend_request_received' &&
                      !pendingRequestFromNews;

                    return (
                      <motion.div
                        key={newsItem.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                      >
                        <Card
                          className={`border shadow-sm hover:shadow-md transition-all cursor-pointer ${newsItem.seen ? 'bg-white border-stone-200' : meta.card}`}
                          onClick={() => openNewsEntry(newsItem)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="relative w-10 h-10 flex-shrink-0">
                                <div className={`w-10 h-10 rounded-full overflow-hidden border border-stone-200 ${newsItem.seen ? 'bg-stone-100' : 'bg-white'} flex items-center justify-center`}>
                                  {actor.avatarUrl ? (
                                    <img
                                      src={actor.avatarUrl}
                                      alt={actor.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs font-semibold text-stone-700">{avatarFallback}</span>
                                  )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-stone-200 flex items-center justify-center">
                                  <Icon className={`w-3 h-3 ${meta.accent}`} />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-stone-900 truncate">
                                  {newsItem.title || 'Neuigkeit'}
                                </p>
                                <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                                  von {actor.name}
                                </p>
                                <p className="text-xs text-stone-600 mt-0.5 line-clamp-2">
                                  {newsItem.message}
                                </p>
                                {!!newsItem.description && (
                                  <p className="text-[11px] text-stone-500 mt-1 truncate">{newsItem.description}</p>
                                )}
                                <p className="text-[10px] text-stone-400 mt-1">
                                  {formatDistanceToNow(new Date(newsItem.created_date || newsItem.created_at || new Date().toISOString()), {
                                    addSuffix: true,
                                    locale: de,
                                  })}
                                </p>
                                {showFriendRequestActions && (
                                  <div className="flex gap-2 mt-2" onClick={(event) => event.stopPropagation()}>
                                    <Button
                                      size="sm"
                                      className="h-7 px-2 bg-green-600 hover:bg-green-700"
                                      disabled={acceptFriendRequestMutation.isPending || rejectFriendRequestMutation.isPending}
                                      onClick={(event) => handleFriendRequestActionFromNews(event, newsItem, 'accept')}
                                    >
                                      <Check className="w-3 h-3 mr-1" />
                                      Annehmen
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50"
                                      disabled={acceptFriendRequestMutation.isPending || rejectFriendRequestMutation.isPending}
                                      onClick={(event) => handleFriendRequestActionFromNews(event, newsItem, 'reject')}
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      Ablehnen
                                    </Button>
                                  </div>
                                )}
                                {showFriendRequestResolvedHint && (
                                  <p className="text-[11px] text-stone-500 mt-2">Diese Anfrage wurde bereits beantwortet.</p>
                                )}
                              </div>
                              {!newsItem.seen && (
                                <div className="w-2.5 h-2.5 bg-green-500 rounded-full mt-1 flex-shrink-0" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="explorer" className={explorerContentClass} style={embeddedContentMaskStyle}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}
            >
              {explorerLogEntries.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto border border-stone-200 shadow-lg">
                    <BookOpenText className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-600 text-lg font-semibold mb-2">
                      Noch kein Forscher-Log
                    </p>
                    <p className="text-stone-500">
                      Scans von dir und deinen Freunden erscheinen hier.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {explorerLogEntries.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <Card className="border border-stone-200 hover:border-emerald-300 hover:shadow-md transition-all bg-white overflow-hidden">
                        {entry.discovery?.image_url && (
                          <div className="aspect-square overflow-hidden bg-stone-100">
                            <img
                              src={entry.discovery.image_url}
                              alt={entry.plant?.species_name || "Scan"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <CardContent className="p-2 space-y-1">
                          <p className="text-xs font-bold text-stone-900 truncate">
                            {entry.plant?.species_name || "Unbekannte Pflanze"}
                          </p>
                          <button
                            onClick={() => {
                              if (entry.actorEmail && entry.actorEmail !== ownEmailLower) {
                                navigate(createPageUrl(`FriendProfile?email=${entry.actorEmail}`));
                              }
                            }}
                            className="flex items-center gap-1 w-full text-left hover:opacity-80 transition-opacity"
                          >
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-500 to-green-600 overflow-hidden flex items-center justify-center text-white text-[10px] font-bold">
                              {entry.actorAvatar ? (
                                <img src={entry.actorAvatar} alt={entry.actorName} className="w-full h-full object-cover" />
                              ) : (
                                entry.actorName?.charAt(0)?.toUpperCase() || "?"
                              )}
                            </div>
                            <p className="text-[11px] text-stone-700 truncate">{entry.actorName}</p>
                          </button>
                          <div className="flex items-center justify-between text-[10px] text-stone-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: de })}
                            </span>
                            {entry.scanCount > 1 && (
                              <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                                {entry.scanCount}x
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>

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
