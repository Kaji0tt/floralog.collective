import { useState, useEffect, useRef } from "react";
import { Query } from "@/api/entities";
import { createUserNotification } from "@/api/notificationService";
import { supabase } from "@/api/supabaseClient";
import { sendFriendRequest, removeFriendship, respondToFriendRequest } from "@/api/friendService";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UserPlus, Users, Loader2, Check, X, Bell, UserMinus, Leaf, Trophy, Share2, Plus, Heart, UserCheck, BookOpenText, Clock, Newspaper, Send, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { checkAndUnlockAchievements } from "@/components/achievements/achievementChecker";
import AchievementNotification from "@/components/achievements/AchievementNotification";
import { AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import MobileBackButton from "@/components/navigation/MobileBackButton";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useUiTheme } from "@/lib/UiThemeContext";
import { encodeReferralCode } from "@/lib/referralCode";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";

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

const MAX_EXPLORER_DISCOVERIES = 200;
const EXPLORER_BATCH_SIZE = 10;
const EXPLORER_PREFETCH_REMAINING = 5;

export function useFriendsFeatureContent({
  embedded = false,
  onHeaderMetaChange,
  openAddFriendDialogNonce = 0,
  onRequestClose: _onRequestClose = null,
}) {
  const { isLightUi } = useUiTheme();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "explorer");
  const [explorerAudienceFilter, setExplorerAudienceFilter] = useState("all");
  const [visibleExplorerCount, setVisibleExplorerCount] = useState(EXPLORER_BATCH_SIZE);
  const explorerSentinelRef = useRef(null);
  const [newsFilter, setNewsFilter] = useState("activities");
  const [expandedNewsIds, setExpandedNewsIds] = useState(new Set());
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);
  const [showAdminNewsDialog, setShowAdminNewsDialog] = useState(false);
  const [adminNewsTitle, setAdminNewsTitle] = useState("");
  const [adminNewsText, setAdminNewsText] = useState("");
  const autoMarkingNewsRef = useRef(false);

  useEffect(() => {
    if (!embedded) return;
    if (openAddFriendDialogNonce > 0) {
      setActiveTab("friends");
      setShowAddFriendDialog(true);
    }
  }, [embedded, openAddFriendDialogNonce]);

  // Sichtbare Einträge zurücksetzen wenn Filter wechselt
  useEffect(() => {
    setVisibleExplorerCount(EXPLORER_BATCH_SIZE);
  }, [explorerAudienceFilter]);

  useEffect(() => {
    const allowedTabs = new Set(["friends", "news", "explorer"]);
    if (!allowedTabs.has(activeTab)) {
      setActiveTab("explorer");
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

  const normalizedRole = (value) => String(value || '').trim().toLowerCase();
  const ownProfile = allPublicProfiles.find((profile) => {
    if (!profile) return false;
    if (user?.id && profile.auth_id && profile.auth_id === user.id) return true;
    if (user?.email && profile.user_email) {
      return profile.user_email.toLowerCase() === user.email.toLowerCase();
    }
    return false;
  });
  const isAdminUser = normalizedRole(user?.role) === 'admin' || normalizedRole(ownProfile?.role) === 'admin';

  const { data: logoAssets = [] } = useQuery({
    queryKey: ['logoAssets'],
    queryFn: () => Query.LogoAsset.list(),
    staleTime: 60000,
  });

  // Lade alle Discoveries - mit höherem Limit
  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ['explorerDiscoveries', MAX_EXPLORER_DISCOVERIES],
    queryFn: async () => {
      const discoveries = await Query.UserPlantDiscovery.list('-created_date', MAX_EXPLORER_DISCOVERIES);
      console.log("📊 Geladene Discoveries:", discoveries.length);
      return discoveries;
    },
    staleTime: 60 * 1000,
  });

  const { data: adminNews = [] } = useQuery({
    queryKey: ['news'],
    queryFn: () => Query.News.list('-created_date'),
    staleTime: 60000,
  });

  const { data: scanLikes = [] } = useQuery({
    queryKey: ['scanLikesAll'],
    queryFn: () => Query.ScanLike.list('-created_date', 2000),
    enabled: !!user?.email,
    staleTime: 60 * 1000,
  });

  // Lade alle Plants
  const { data: allPlants = [] } = useQuery({
    queryKey: ['allPlants'],
    queryFn: () => Query.Plant.list()
  });

  const NEWS_TYPES = ['gift_received', 'collection_followed', 'friendship_accepted', 'friend_request_received', 'friend_achievement', 'scan_liked', 'admin_broadcast'];

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
          const aUnseen = a.seen !== true;
          const bUnseen = b.seen !== true;
          if (aUnseen !== bUnseen) {
            return aUnseen ? -1 : 1;
          }
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

  useEffect(() => {
    if (activeTab !== 'news' || !user?.email || autoMarkingNewsRef.current) {
      return;
    }

    const unseenIds = userNews
      .filter((notification) => notification.seen !== true)
      .map((notification) => notification.id)
      .filter(Boolean);

    if (unseenIds.length === 0) {
      return;
    }

    autoMarkingNewsRef.current = true;

    (async () => {
      try {
        await Promise.allSettled(
          unseenIds.map((notificationId) =>
            Query.UserNotification.update(notificationId, { seen: true })
          )
        );
      } finally {
        autoMarkingNewsRef.current = false;
        queryClient.invalidateQueries({ queryKey: ['friendsNews'] });
        queryClient.invalidateQueries({ queryKey: ['friendsUnreadNewsCount'] });
      }
    })();
  }, [activeTab, user?.email, userNews, queryClient]);

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

  const broadcastNewsMutation = useMutation({
    mutationFn: async ({ title, text }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("broadcastNews", {
        body: { title, text, createdBy: user?.email },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Broadcast fehlgeschlagen");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      setAdminNewsTitle("");
      setAdminNewsText("");
      setShowAdminNewsDialog(false);
      alert(`✅ Neuigkeit erstellt und an ${data.pushSent ?? 0} Spielende als Push-Benachrichtigung gesendet!`);
    },
    onError: (error) => {
      alert(`❌ Fehler: ${error.message}`);
    },
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
        referrer_email: user.email,
        referred_email: email,
        status: "pending"
      });
      return email;
    },
    onSuccess: (email) => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      
      // Erstelle Referral-Link mit verschleiertem Referral-Code
      const referralCode = encodeReferralCode(user.email);
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

  const toggleNewsExpanded = (id) => {
    const newSet = new Set(expandedNewsIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedNewsIds(newSet);
  };

  const handleExplorerLike = async (entry, nextLiked) => {
    if (!user?.email || !entry?.id || !entry?.actorEmail || entry.actorEmail === ownEmailLower) {
      return;
    }

    const existingLike = scanLikes.find(
      (like) =>
        like.discovery_id === entry.id &&
        like.liked_by?.toLowerCase() === ownEmailLower
    );
    const currentlyLiked = Boolean(existingLike);

    if (currentlyLiked === nextLiked) {
      return;
    }

    try {
      if (nextLiked) {
        await Query.ScanLike.create({
          discovery_id: entry.id,
          liked_by: user.email,
          liked_date: new Date().toISOString(),
          auth_id: user.id,
          created_by: user.email,
        });

        const likerName = user.display_name || user.full_name || user.email;
        const actionParams = new URLSearchParams();
        if (entry.plant?.genus_id) actionParams.set("id", entry.plant.genus_id);
        if (entry.actorEmail) actionParams.set("email", entry.actorEmail);
        actionParams.set("discoveryId", entry.id);

        await Promise.allSettled([
          createUserNotification({
            authId: entry.actorAuthId || null,
            userEmail: entry.actorEmail || null,
            notificationType: "scan_liked",
            title: "❤️ Neuer Like",
            message: `${likerName} gefällt dein Scan${entry.plant?.species_name ? ` (${entry.plant.species_name})` : ""}.`,
            actionUrl: entry.plant?.genus_id
              ? `GenusDetail?${actionParams.toString()}`
              : "Friends?tab=explorer",
            displayLocation: "banner",
            createdBy: user.email,
          }),
          entry.actorAuthId
            ? supabase.functions.invoke("robotPlantGrantReward", {
                body: {
                  authId: entry.actorAuthId,
                  userEmail: entry.actorEmail,
                  eventSource: "scan_like_received",
                  eventReference: entry.id,
                  amount: 5,
                  metadata: {
                    source: "friends_explorer_like",
                    likedBy: user.email,
                  },
                },
              })
            : Promise.resolve(),
        ]);
      } else if (existingLike?.id) {
        await Query.ScanLike.delete(existingLike.id);
      }

      await queryClient.invalidateQueries({ queryKey: ['scanLikesAll'] });
    } catch (error) {
      console.error('[Friends] Failed to toggle explorer like:', error);
      alert('Like konnte nicht gespeichert werden. Bitte versuche es erneut.');
    }
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
      case 'admin_broadcast':
        return { icon: Newspaper, accent: 'text-emerald-600', card: 'bg-emerald-50 border-emerald-200' };
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
      logoAssets: resolveEquippedLogoAssetsWithCatalog(actorProfile || {}, logoAssets),
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
      logoAssets: resolveEquippedLogoAssetsWithCatalog(friendProfile || friendUser || {}, logoAssets),
      level: friendProfile?.level || friendUser?.level || 1,
      title: friendProfile?.selected_title || friendProfile?.title || friendUser?.selected_title || friendUser?.title || "Pflanzen-Anfänger",
      lastActivity
    };
  };

  const ownEmailLower = user?.email?.toLowerCase() || "";
  const likedDiscoveryIdSet = new Set(
    scanLikes
      .filter((like) => like?.discovery_id && like?.liked_by?.toLowerCase() === ownEmailLower)
      .map((like) => like.discovery_id)
  );
  const likeCountByDiscoveryId = scanLikes.reduce((acc, like) => {
    if (!like?.discovery_id) return acc;
    acc.set(like.discovery_id, (acc.get(like.discovery_id) || 0) + 1);
    return acc;
  }, new Map());

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
  const showFriendsOnlyInExplorer = explorerAudienceFilter === "friends";

  const recentDiscoveries = (allDiscoveries || [])
    .filter((entry) => {
      const entryEmail = getDiscoveryEmailLower(entry);
      if (!entryEmail) return false;
      const actorProfile = profileByEmail.get(entryEmail);
      const isCurrentUserEntry = entryEmail === ownEmailLower;
      const isVisibleInGlobalExplorer = actorProfile?.global_explorer_visibility !== false;
      if (!showFriendsOnlyInExplorer && !isCurrentUserEntry && !isVisibleInGlobalExplorer) return false;
      if (showFriendsOnlyInExplorer && !acceptedEmailSet.has(entryEmail)) return false;
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
      actorAuthId: profile?.auth_id || entry.auth_id || null,
      actorName: profile?.display_name || profile?.full_name || entryEmail,
      actorLogoAssets: resolveEquippedLogoAssetsWithCatalog(profile || {}, logoAssets),
      scanCount: scansBySameUserPlant.length,
      likedByCurrentUser: likedDiscoveryIdSet.has(entry.id),
      likeCount: likeCountByDiscoveryId.get(entry.id) || 0,
      timestamp: new Date(entry.created_date || entry.discovered_date || entry.updated_date || Date.now()),
    });
  });

  const hasMoreExplorerEntries = visibleExplorerCount < explorerLogEntries.length;
  const visibleExplorerEntries = explorerLogEntries.slice(0, visibleExplorerCount);
  const explorerPrefetchIndex = hasMoreExplorerEntries
    ? Math.max(0, visibleExplorerEntries.length - EXPLORER_PREFETCH_REMAINING)
    : -1;

  useEffect(() => {
    if (activeTab !== "explorer" || !hasMoreExplorerEntries) return;

    const sentinel = explorerSentinelRef.current;
    if (!sentinel) return;

    let didTrigger = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || didTrigger) return;
        didTrigger = true;
        setVisibleExplorerCount((prev) =>
          Math.min(prev + EXPLORER_BATCH_SIZE, explorerLogEntries.length)
        );
      },
      { rootMargin: "0px 0px 200px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, explorerLogEntries.length, hasMoreExplorerEntries, visibleExplorerCount]);

  const friendCards = friends
    .map((friendEntry) => ({
      friend: friendEntry,
      friendData: getFriendData(friendEntry),
    }))
    .filter((entry) => !!entry.friendData);

  const pendingRequestsCount = pendingRequests.length;

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

  const sectionSurfaceClass = isLightUi
    ? "rounded-[1.5rem] border border-[#d9c48a]/45 bg-white/72 backdrop-blur-xl shadow-[0_14px_32px_rgba(162,129,48,0.12)]"
    : "rounded-[1.5rem] border border-[#f0e5a5]/25 bg-black/30 backdrop-blur-md shadow-[0_16px_34px_rgba(0,0,0,0.3)]";
  const nestedCardClass = isLightUi
    ? "rounded-[1.15rem] border border-stone-200/80 bg-white/88 backdrop-blur-sm"
    : "rounded-[1.15rem] border border-[#f0e5a5]/18 bg-stone-950/35 backdrop-blur-sm";
  const titleTextClass = isLightUi ? "text-stone-900" : "text-stone-100";
  const bodyTextClass = isLightUi ? "text-stone-600" : "text-stone-300/90";
  const mutedTextClass = isLightUi ? "text-stone-500" : "text-stone-400/80";
  const faintTextClass = isLightUi ? "text-stone-400" : "text-stone-500/80";
  const interactiveHoverClass = isLightUi
    ? "hover:border-[#c9ab59]/55 hover:shadow-[0_10px_24px_rgba(162,129,48,0.16)]"
    : "hover:border-[#e3c97b]/60 hover:bg-stone-950/42 hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)]";
  const friendTileClass = isLightUi
    ? "rounded-[1rem] border border-[#c6a54e]/35 bg-white/70"
    : "rounded-[1rem] border border-[#d6b665]/45 bg-stone-950/26 shadow-[inset_0_0_0_1px_rgba(214,182,101,0.14)]";
  const accentBadgeClass = isLightUi
    ? "bg-[#8f6b22] text-white"
    : "border border-[#d6b665]/55 bg-[#2b2412]/72 text-[#f6e7b7]";

  const moduleChips = [
    {
      id: "explorer",
      title: "Forscher Log",
      active: explorerLogEntries.length,
      total: explorerLogEntries.length,
    },
    {
      id: "news",
      title: "News",
      active: unreadNewsCount,
      total: userNews.length,
    },
    {
      id: "friends",
      title: "Freunde",
      active: friends.length,
      total: friends.length,
    },
  ];

  useEffect(() => {
    if (!embedded || typeof onHeaderMetaChange !== "function") return;

    onHeaderMetaChange({
      title: activeTab === "friends" ? "Social" : activeTab === "news" ? "Neuigkeiten" : "Forscher Log",
      subtitle: activeTab === "explorer" ? "Scans der letzten 30 Tage" : "Dein Freundesbereich",
    });
  }, [
    embedded,
    onHeaderMetaChange,
    activeTab,
  ]);

  if (!user) {
    return (
      <div className={embedded ? "flex h-full min-h-0 items-center justify-center bg-transparent" : "flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50"}>
        <Leaf className={`w-12 h-12 animate-spin ${embedded ? (isLightUi ? "text-emerald-700" : "text-[#f0e5a5]") : "text-green-600"}`} />
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
                    {activeTab === "news" && isAdminUser && (
                      <button
                        type="button"
                        onClick={() => setShowAdminNewsDialog(true)}
                        className="w-11 h-11 rounded-full border border-[#f0e5a5]/35 bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/45 transition-colors shrink-0"
                        aria-label="Neuigkeit senden"
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

          {/* Explorer Tab Content */}
          <TabsContent value="explorer" className={explorerContentClass} style={embeddedContentMaskStyle}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-5xl mx-auto space-y-4"
              style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}
            >
              {explorerLogEntries.length === 0 ? (
                <div className={`${sectionSurfaceClass} px-5 py-10 text-center`}>
                  <BookOpenText className={`w-16 h-16 mx-auto mb-4 ${isLightUi ? "text-stone-300" : "text-stone-500"}`} />
                  <p className={`text-lg font-semibold mb-2 ${titleTextClass}`}>
                      Noch kein Forscher-Log
                  </p>
                  <p className={bodyTextClass}>
                    {showFriendsOnlyInExplorer
                      ? "Scans von dir und deinen Freunden erscheinen hier."
                      : "Scans aller Spieler erscheinen hier."}
                  </p>
                </div>
              ) : (
                <>
                <section className={`${sectionSurfaceClass} p-4 md:p-5`}>
                  <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className={`flex items-center gap-2 ${titleTextClass}`}>
                        <BookOpenText className={`w-4 h-4 ${isLightUi ? "text-emerald-700" : "text-emerald-300"}`} />
                        <h3 className="text-base font-semibold">Forscher Log</h3>
                      </div>
                      <p className={`text-sm mt-1 ${bodyTextClass}`}>
                        {showFriendsOnlyInExplorer
                          ? "Ein visuelles Journal der letzten Scans von dir und deinen Freunden."
                          : "Ein visuelles Journal der letzten Scans aller Spieler."}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <div
                        className={
                          `inline-flex rounded-full border p-1 ${isLightUi
                            ? "border-[#d9c48a]/60 bg-[#f8f1dc]/85"
                            : "border-[#f0e5a5]/30 bg-black/30"}`
                        }
                      >
                        {[
                          { id: "all", label: "Alle" },
                          { id: "friends", label: "Freunde" },
                        ].map((option) => {
                          const isSelected = explorerAudienceFilter === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setExplorerAudienceFilter(option.id)}
                              className={
                                `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isSelected
                                  ? (isLightUi
                                    ? "bg-white text-[#8f6b22] shadow-sm"
                                    : "bg-[#f0e5a5] text-stone-950")
                                  : (isLightUi
                                    ? "text-stone-600 hover:text-stone-900"
                                    : "text-stone-300 hover:text-stone-100")}`
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <Badge className={accentBadgeClass}>{explorerLogEntries.length}</Badge>
                    </div>
                  </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visibleExplorerEntries.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      ref={index === explorerPrefetchIndex ? explorerSentinelRef : null}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <Card className={`${nestedCardClass} ${interactiveHoverClass} transition-all overflow-hidden`}>
                        {entry.discovery?.image_url ? (
                          <div className={`aspect-[4/3] overflow-hidden ${isLightUi ? "bg-stone-100" : "bg-stone-900/60"}`}>
                            <img
                              src={entry.discovery.image_url}
                              alt={entry.plant?.species_name || "Scan"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className={`aspect-[4/3] flex items-center justify-center ${isLightUi ? "bg-gradient-to-br from-emerald-50 to-stone-100" : "bg-gradient-to-br from-emerald-500/10 to-stone-950/60"}`}>
                            <Leaf className={`w-10 h-10 ${isLightUi ? "text-emerald-500" : "text-emerald-300"}`} />
                          </div>
                        )}
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-bold truncate ${titleTextClass}`}>
                            {entry.plant?.species_name || "Unbekannte Pflanze"}
                            </p>
                            {entry.scanCount > 1 && (
                              <Badge className={isLightUi ? "bg-emerald-600 text-white" : "bg-emerald-300 text-stone-900"}>
                                {entry.scanCount}x
                              </Badge>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (entry.actorEmail && entry.actorEmail !== ownEmailLower) {
                                navigate(createPageUrl(`FriendProfile?email=${entry.actorEmail}`));
                              }
                            }}
                            className={`flex items-center gap-2 w-full text-left transition-opacity ${entry.actorEmail && entry.actorEmail !== ownEmailLower ? "hover:opacity-80" : "cursor-default"}`}
                          >
                            <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold">
                              <CustomLogoAvatar
                                logoAssets={entry.actorLogoAssets}
                                className="w-full h-full"
                                fallbackText={entry.actorName?.charAt(0)?.toUpperCase() || "?"}
                                fallbackClassName="text-[10px] font-bold text-white"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[11px] font-medium truncate ${titleTextClass}`}>{entry.actorName}</p>
                              <p className={`text-[10px] truncate ${mutedTextClass}`}>hat diesen Scan eingetragen</p>
                            </div>
                          </button>
                          <div className={`flex items-center justify-between text-[10px] ${mutedTextClass}`}>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: de })}
                            </span>
                            {entry.actorEmail && entry.actorEmail !== ownEmailLower ? (
                              <button
                                type="button"
                                onClick={() => handleExplorerLike(entry, !entry.likedByCurrentUser)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${
                                  entry.likedByCurrentUser
                                    ? (isLightUi
                                      ? "border-rose-300 bg-rose-50 text-rose-600"
                                      : "border-rose-400/60 bg-rose-400/10 text-rose-200")
                                    : (isLightUi
                                      ? "border-stone-300 text-stone-500 hover:border-rose-300 hover:text-rose-600"
                                      : "border-stone-600 text-stone-300 hover:border-rose-400/60 hover:text-rose-200")
                                }`}
                                aria-label={entry.likedByCurrentUser ? "Like entfernen" : "Scan liken"}
                              >
                                <Heart className={`w-3 h-3 ${entry.likedByCurrentUser ? "fill-current" : ""}`} />
                                <span>{entry.likeCount}</span>
                              </button>
                            ) : (
                              <span className={faintTextClass}>30 Tage Fenster</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
                </section>
              {hasMoreExplorerEntries && (
                <div className={`flex justify-center py-3 ${isLightUi ? "text-stone-400" : "text-stone-500"}`}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
                </>
              )}
            </motion.div>
          </TabsContent>

          {/* News Tab Content */}
          <TabsContent value="news" className={newsContentClass} style={embeddedContentMaskStyle}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-5xl mx-auto space-y-4"
              style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}
            >
              {/* Kombinierte News-Liste mit Filter-Toggle */}
              {userNews.length === 0 && adminNews.length === 0 ? (
                <div className={`${sectionSurfaceClass} px-5 py-10 text-center`}>
                  <Bell className={`w-16 h-16 mx-auto mb-4 ${isLightUi ? "text-stone-300" : "text-stone-500"}`} />
                  <p className={`text-lg font-semibold mb-2 ${titleTextClass}`}>
                      Noch keine Neuigkeiten
                  </p>
                  <p className={bodyTextClass}>Hier siehst du, was in deinem Freundeskreis passiert.</p>
                </div>
              ) : (
                <section className={`${sectionSurfaceClass} p-4 md:p-5`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className={`flex items-center gap-2 ${titleTextClass}`}>
                        <Bell className={`w-4 h-4 ${isLightUi ? "text-blue-700" : "text-blue-300"}`} />
                        <h3 className="text-base font-semibold">{newsFilter === "activities" ? "Aktivitätsfeed" : "Server-News"}</h3>
                      </div>
                      <p className={`text-sm mt-1 ${bodyTextClass}`}>
                        {newsFilter === "activities" 
                          ? "Achievements, Likes, Anfragen und Sammlungs-Updates"
                          : "Neuigkeiten und Ankündigungen vom Server"}
                      </p>
                    </div>
                    <Badge className={accentBadgeClass}>
                      {newsFilter === "activities" ? unreadNewsCount : adminNews.length} {newsFilter === "activities" ? "neu" : ""}
                    </Badge>
                  </div>

                  {/* Filter Toggle */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div
                      className={
                          `inline-flex rounded-full border p-1 ${isLightUi
                            ? "border-[#d9c48a]/60 bg-[#f8f1dc]/85"
                            : "border-[#f0e5a5]/30 bg-black/30"}`
                      }
                    >
                      {[
                        { id: "activities", label: "Aktivitäten" },
                        { id: "server", label: "Server" },
                      ].map((option) => {
                        const isSelected = newsFilter === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setNewsFilter(option.id)}
                            className={
                              `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isSelected
                                ? (isLightUi
                                  ? "bg-white text-[#8f6b22] shadow-sm"
                                  : "bg-[#f0e5a5] text-stone-950")
                                : (isLightUi
                                  ? "text-stone-600 hover:text-stone-900"
                                  : "text-stone-300 hover:text-stone-100")}`
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* News Items - Collapsible */}
                  <div className="space-y-2">
                    {(newsFilter === "activities" ? userNews : adminNews).map((newsItem, index) => {
                      const isExpanded = expandedNewsIds.has(newsItem.id);
                      const isAdminNews = !newsItem.created_by || newsItem.created_by === 'system' || newsItem.text;
                      
                      if (newsFilter === "activities") {
                        // User News Items
                        const meta = getNewsMeta(newsItem.notification_type);
                        const Icon = meta.icon;
                        const actor = getNewsActor(newsItem);
                        const avatarFallback = (actor.name || actor.email || '?').charAt(0).toUpperCase();
                        const pendingRequestFromNews = getPendingRequestFromNews(newsItem);
                        const showFriendRequestActions =
                          newsItem.notification_type === 'friend_request_received' &&
                          !!pendingRequestFromNews;

                        return (
                          <motion.div
                            key={newsItem.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <div
                              className={`${nestedCardClass} transition-all cursor-pointer ${isExpanded ? "bg-opacity-100" : "hover:bg-opacity-75"} ${newsItem.seen ? "" : (isLightUi ? "border-emerald-200 bg-emerald-50/65" : "border-emerald-300/30 bg-emerald-500/10")}`}
                              onClick={() => toggleNewsExpanded(newsItem.id)}
                            >
                              <CardContent className="p-3">
                                {/* Collapsed View */}
                                <div className="flex items-start gap-3">
                                  <div className="relative w-10 h-10 flex-shrink-0">
                                    <div className={`w-10 h-10 rounded-full overflow-hidden border ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/20"} flex items-center justify-center`}>
                                      <CustomLogoAvatar
                                        logoAssets={actor.logoAssets}
                                        className="w-full h-full"
                                        fallbackText={avatarFallback}
                                        fallbackClassName={`text-xs font-semibold ${isLightUi ? "text-stone-700" : "text-stone-100"}`}
                                      />
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center ${isLightUi ? "bg-white border-stone-200" : "bg-stone-950 border-[#f0e5a5]/20"}`}>
                                      <Icon className={`w-3 h-3 ${meta.accent}`} />
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {!newsItem.seen && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                                        <p className={`text-sm font-semibold truncate ${titleTextClass}`}>
                                          {newsItem.title || 'Neuigkeit'}
                                        </p>
                                      </div>
                                      <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""} ${mutedTextClass}`} />
                                    </div>
                                    {newsItem.notification_type === 'friend_achievement' && (
                                      <p className={`text-xs mt-0.5 truncate ${mutedTextClass}`}>
                                        {actor.name}{newsItem.description ? ` · ${newsItem.description}` : ''}
                                      </p>
                                    )}
                                    <p className={`text-[10px] mt-1 ${faintTextClass}`}>
                                      {formatDistanceToNow(new Date(newsItem.created_date || newsItem.created_at || new Date().toISOString()), {
                                        addSuffix: true,
                                        locale: de,
                                      })}
                                    </p>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-3 pt-3 border-t border-current border-opacity-10"
                                      >
                                        <p className={`text-[11px] mb-2 ${mutedTextClass}`}>
                                          von {actor.name}
                                        </p>
                                        <p className={`text-xs ${bodyTextClass}`}>
                                          {newsItem.message}
                                        </p>
                                        {!!newsItem.description && (
                                          <p className={`text-[11px] mt-2 ${mutedTextClass}`}>{newsItem.description}</p>
                                        )}
                                        {showFriendRequestActions && (
                                          <div className="flex gap-2 mt-3" onClick={(event) => event.stopPropagation()}>
                                            <Button
                                              size="sm"
                                              className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                                              disabled={acceptFriendRequestMutation.isPending || rejectFriendRequestMutation.isPending}
                                              onClick={(event) => handleFriendRequestActionFromNews(event, newsItem, 'accept')}
                                            >
                                              <Check className="w-3 h-3 mr-1" />
                                              Annehmen
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className={`h-6 px-2 text-xs ${isLightUi ? "border-red-300 text-red-600 hover:bg-red-50" : "border-red-400/50 text-red-200 hover:bg-red-500/10"}`}
                                              disabled={acceptFriendRequestMutation.isPending || rejectFriendRequestMutation.isPending}
                                              onClick={(event) => handleFriendRequestActionFromNews(event, newsItem, 'reject')}
                                            >
                                              <X className="w-3 h-3 mr-1" />
                                              Ablehnen
                                            </Button>
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </div>
                          </motion.div>
                        );
                      } else {
                        // Admin News Items
                        return (
                          <motion.div
                            key={newsItem.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <div
                              className={`${nestedCardClass} transition-all cursor-pointer`}
                              onClick={() => toggleNewsExpanded(newsItem.id)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isLightUi ? "bg-emerald-100" : "bg-emerald-500/15"}`}>
                                    <Newspaper className={`w-4 h-4 ${isLightUi ? "text-emerald-600" : "text-emerald-300"}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                      <p className={`text-sm font-semibold truncate ${titleTextClass}`}>{newsItem.title}</p>
                                      <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""} ${mutedTextClass}`} />
                                    </div>
                                    <p className={`text-[10px] mt-1 ${faintTextClass}`}>
                                      {formatDistanceToNow(new Date(newsItem.created_date || new Date().toISOString()), { addSuffix: true, locale: de })}
                                    </p>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-3 pt-3 border-t border-current border-opacity-10"
                                      >
                                        <p className={`text-xs ${bodyTextClass}`}>{newsItem.text}</p>
                                      </motion.div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </div>
                          </motion.div>
                        );
                      }
                    })}
                  </div>
                </section>
              )}
            </motion.div>
          </TabsContent>


          {/* Friends Tab Content */}
          <TabsContent value="friends" className={friendsContentClass} style={embeddedContentMaskStyle}>
            <div className="max-w-5xl mx-auto space-y-4" style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>

              {pendingRequestsCount > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className={`${sectionSurfaceClass} p-4 md:p-5`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className={`flex items-center gap-2 ${titleTextClass}`}>
                        <Bell className={`w-4 h-4 ${isLightUi ? "text-amber-700" : "text-amber-300"}`} />
                        <h3 className="text-base font-semibold">Freundschaftsanfragen</h3>
                      </div>
                      <p className={`text-sm mt-1 ${bodyTextClass}`}>Neue Kontakte warten auf deine Entscheidung.</p>
                    </div>
                    <Badge className={accentBadgeClass}>{pendingRequestsCount}</Badge>
                  </div>

                  <div className="space-y-3">
                    {pendingRequests.map((request, index) => {
                      const requesterData = getFriendData(request);
                      if (!requesterData) return null;

                      return (
                        <motion.div
                          key={request.id}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.06 }}
                          className={`${nestedCardClass} p-3 md:p-4`}
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
                                <CustomLogoAvatar
                                  logoAssets={requesterData.logoAssets}
                                  className="w-full h-full"
                                  fallbackText={requesterData.name?.[0]?.toUpperCase() || "?"}
                                  fallbackClassName="text-lg font-bold text-white"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className={`font-semibold truncate ${titleTextClass}`}>{requesterData.name}</p>
                                <p className={`text-sm truncate ${bodyTextClass}`}>möchte dein Netzwerk erweitern</p>
                                <p className={`text-xs mt-1 truncate ${mutedTextClass}`}>{requesterData.title}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                onClick={() => acceptFriendRequestMutation.mutate(request)}
                                disabled={acceptFriendRequestMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Annehmen
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectFriendRequestMutation.mutate(request)}
                                disabled={rejectFriendRequestMutation.isPending}
                                className={isLightUi ? "border-red-300 text-red-600 hover:bg-red-50" : "border-red-400/50 text-red-200 hover:bg-red-500/10"}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Ablehnen
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.section>
              )}

              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className={`${sectionSurfaceClass} p-4 md:p-5`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className={`flex items-center gap-2 ${titleTextClass}`}>
                      <Users className={`w-4 h-4 ${isLightUi ? "text-emerald-700" : "text-emerald-300"}`} />
                      <h3 className="text-base font-semibold">Dein Netzwerk</h3>
                    </div>
                    <p className={`text-sm mt-1 ${bodyTextClass}`}>Freunde, letzte Aktivitaeten und schneller Zugriff auf Profile.</p>
                  </div>
                  <Badge className={accentBadgeClass}>{friendCards.length}</Badge>
                </div>

                {friendCards.length === 0 ? (
                  <div className={`${nestedCardClass} px-5 py-10 text-center`}>
                    <Users className={`w-14 h-14 mx-auto mb-4 ${isLightUi ? "text-stone-300" : "text-stone-500"}`} />
                    <p className={`text-lg font-semibold mb-2 ${titleTextClass}`}>Noch keine Freunde</p>
                    <p className={`text-sm ${bodyTextClass}`}>Füge Freunde hinzu, um ihre Sammlungen, Erfolge und Scans zu sehen.</p>
                  </div>
                ) : (
                  <div className="grid gap-2.5">
                    {friendCards.map(({ friend, friendData }, index) => (
                      <motion.div
                        key={friend.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className={`${friendTileClass} ${interactiveHoverClass} w-full max-w-full overflow-hidden p-2.5 md:p-3 transition-all flex items-center justify-between gap-2.5`}
                      >
                        <button
                          onClick={() => navigate(createPageUrl(`FriendProfile?email=${friendData.email}`))}
                          className="flex items-center gap-2.5 flex-1 min-w-0 max-w-full text-left"
                        >
                          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                            <CustomLogoAvatar
                              logoAssets={friendData.logoAssets}
                              className="w-full h-full"
                              fallbackText={friendData.name?.[0]?.toUpperCase() || friendData.email?.[0]?.toUpperCase()}
                              fallbackClassName="text-sm font-bold text-white"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className={`font-semibold truncate ${titleTextClass}`}>{friendData.name}</p>
                            </div>
                            <p className={`text-xs truncate ${bodyTextClass}`}>{friendData.email}</p>
                            {friendData.lastActivity && (
                              <div className={`mt-1 flex items-center gap-1 text-[10px] min-w-0 ${mutedTextClass}`}>
                                {friendData.lastActivity.type === "discovery" ? (
                                  <Leaf className={`w-3 h-3 flex-shrink-0 ${isLightUi ? "text-emerald-600" : "text-emerald-300"}`} />
                                ) : (
                                  <Trophy className={`w-3 h-3 flex-shrink-0 ${isLightUi ? "text-amber-600" : "text-amber-300"}`} />
                                )}
                                <span className="truncate">
                                  {friendData.lastActivity.type === "discovery"
                                    ? friendData.lastActivity.plant?.species_name || "Neuer Scan"
                                    : friendData.lastActivity.achievement?.title || "Neuer Erfolg"}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Möchtest du ${friendData.name} wirklich entfernen?`)) {
                              removeFriendMutation.mutate(friendData);
                            }
                          }}
                          disabled={removeFriendMutation.isPending}
                          className={isLightUi ? "text-red-600 hover:bg-red-50 w-8 h-8 p-0 flex-shrink-0" : "text-red-300 hover:bg-red-500/10 w-8 h-8 p-0 flex-shrink-0"}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.section>
            </div>
          </TabsContent>

        </Tabs>

      </div>

      {/* Add Friend Dialog */}
      <Dialog open={showAddFriendDialog} onOpenChange={setShowAddFriendDialog}>
        <DialogContent className={`max-w-md ${!isLightUi ? "bg-[#1a1d1a] border-[#f0e5a5]/20" : ""}`}>
          <DialogHeader>
            <DialogTitle className={!isLightUi ? "text-stone-100" : ""}>Freund hinzufügen oder einladen</DialogTitle>
            <DialogDescription className={!isLightUi ? "text-stone-400" : ""}>
              Wähle eine Option aus
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-3">
              <h3 className={`text-sm font-semibold ${!isLightUi ? "text-stone-200" : "text-stone-900"}`}>Freundschaftsanfrage senden</h3>
              <p className={`text-xs ${!isLightUi ? "text-stone-400" : "text-stone-600"}`}>
                Sende eine Anfrage an jemanden, der bereits die App nutzt
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="E-Mail des Freundes"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendRequest()}
                  className={`border-2 flex-1 ${!isLightUi ? "border-stone-600 bg-stone-800/60 text-stone-100 placeholder:text-stone-500" : "border-stone-200"}`}
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

            <div className={`border-t pt-4 ${!isLightUi ? "border-stone-700" : "border-stone-200"}`}>
              <h3 className={`text-sm font-semibold mb-2 ${!isLightUi ? "text-stone-200" : "text-stone-900"}`}>Freund einladen</h3>
              <p className={`text-xs mb-3 ${!isLightUi ? "text-stone-400" : "text-stone-600"}`}>
                Erstelle einen Einladungslink und teile ihn per WhatsApp, SMS oder E-Mail
              </p>
            <div className={`rounded-xl border-2 p-4 ${!isLightUi ? "border-amber-500/40 bg-amber-500/10" : "border-amber-400/60 bg-amber-50"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🌟</span>
                <h3 className={`text-sm font-bold ${!isLightUi ? "text-amber-300" : "text-amber-800"}`}>Freunde einladen & Belohnungen sichern</h3>
              </div>
              <p className={`text-xs mb-3 leading-relaxed ${!isLightUi ? "text-amber-200/70" : "text-amber-700/80"}`}>
                Lade Freunde ein und ihr werdet automatisch in der Freundesliste verbunden. Für geworbene Spielende winken exklusive Belohnungen!
              </p>
              <Button
                onClick={() => {
                  const referralCode = encodeReferralCode(user.email);
                  const referralLink = "https://floralog.de?ref=" + referralCode;
                  const shareText = "Hallo!\n\n" + (user.display_name || user.full_name) + " lädt dich zu Floralog ein! 🌱\n\nFloralog ist eine App zum Entdecken und Sammeln von Pflanzen. Scanne Pflanzen in deiner Umgebung, baue deine Sammlung auf und tausche dich mit Freunden aus!\n\nStarte jetzt: " + referralLink + "\n\nViel Spaß beim Entdecken! 🌿";
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareText).then(() => {
                      alert("✅ Einladungstext wurde in die Zwischenablage kopiert!\n\nSende ihn per WhatsApp, SMS oder E-Mail!\n\nDein Referral-Link: " + referralLink);
                      setShowAddFriendDialog(false);
                    }).catch(() => {
                      alert("✅ Dein Referral-Link: " + referralLink + "\n\nKopiere ihn und teile ihn mit deinen Freunden!");
                    });
                  } else {
                    alert("✅ Dein Referral-Link: " + referralLink + "\n\nKopiere ihn und teile ihn mit deinen Freunden!");
                  }
                }}
                className={`w-full font-semibold border-2 shadow-md transition-all duration-150 active:scale-95 ${!isLightUi ? "bg-amber-500/15 border-amber-400/60 text-amber-300 hover:bg-amber-500/30 hover:border-amber-400" : "bg-amber-50 border-amber-400 text-amber-800 hover:bg-amber-100 hover:border-amber-500"}`}
                variant="outline"
              >
                <Share2 className="w-4 h-4 mr-2 flex-shrink-0" />
                Einladungslink kopieren
              </Button>
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Broadcast Dialog */}
      <Dialog open={showAdminNewsDialog} onOpenChange={setShowAdminNewsDialog}>
        <DialogContent className={`max-w-md ${!isLightUi ? "bg-[#1a1d1a] border-[#f0e5a5]/20" : ""}`}>
          <DialogHeader>
            <DialogTitle className={!isLightUi ? "text-stone-100" : ""}>
              <span className="flex items-center gap-2">
                <Newspaper className="w-5 h-5" />
                Neuigkeit senden
              </span>
            </DialogTitle>
            <DialogDescription className={!isLightUi ? "text-stone-400" : ""}>
              Die Neuigkeit wird für alle Spielenden sichtbar und als Push-Benachrichtigung gesendet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className={`text-sm font-medium ${!isLightUi ? "text-stone-200" : "text-stone-900"}`}>Titel</label>
              <input
                type="text"
                value={adminNewsTitle}
                onChange={(e) => setAdminNewsTitle(e.target.value)}
                placeholder="z.B. Neues Update verfügbar!"
                className={`w-full px-3 py-2 rounded-md border text-sm ${!isLightUi ? "border-stone-600 bg-stone-800/60 text-stone-100 placeholder:text-stone-500" : "border-stone-200 bg-white"}`}
              />
            </div>
            <div className="space-y-2">
              <label className={`text-sm font-medium ${!isLightUi ? "text-stone-200" : "text-stone-900"}`}>Text</label>
              <Textarea
                value={adminNewsText}
                onChange={(e) => setAdminNewsText(e.target.value)}
                placeholder="Beschreibe die Neuigkeit..."
                rows={4}
                className={`border-2 resize-none ${!isLightUi ? "border-stone-600 bg-stone-800/60 text-stone-100 placeholder:text-stone-500" : "border-stone-200"}`}
              />
            </div>
            <Button
              onClick={() => {
                if (!adminNewsTitle.trim() || !adminNewsText.trim()) {
                  alert("Bitte fülle Titel und Text aus.");
                  return;
                }
                broadcastNewsMutation.mutate({ title: adminNewsTitle, text: adminNewsText });
              }}
              disabled={broadcastNewsMutation.isPending || !adminNewsTitle.trim() || !adminNewsText.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {broadcastNewsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              An alle senden
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      </div>
      </>);

      }
