import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Query } from "@/api/entities";
import { createUserNotification } from "@/api/notificationService";
import { supabase } from "@/api/supabaseClient";
import { sendFriendRequest, removeFriendship, respondToFriendRequest } from "@/api/friendService";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
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
import { EXPLORER_PAGE_SIZE, getExplorerThresholdIso } from "@/lib/explorerLog";
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

const parseScanLikedNotification = (newsItem, actorNameFallback = "Jemand") => {
  const message = String(newsItem?.message || "").trim();
  const match = message.match(/^(.+?)\s+gef[äa]llt\s+dein\s+Scan(?:\s*\((.+?)\))?\.?$/i);

  const actorName = actorNameFallback || (match?.[1] ? match[1].trim() : "") || "Jemand";
  const scanNameFromDescription = String(newsItem?.description || "").trim();
  const scanNameFromMessage = match?.[2] ? match[2].trim() : "";

  return {
    actorName,
    scanName: scanNameFromDescription || scanNameFromMessage,
  };
};

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
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [newAchievements, setNewAchievements] = useState([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [averageColor, setAverageColor] = useState(null);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "explorer");
  const [explorerAudienceFilter, setExplorerAudienceFilter] = useState("all");
  const explorerSentinelRef = useRef(null);
  const [newsFilter, setNewsFilter] = useState("activities");
  const [expandedNewsIds, setExpandedNewsIds] = useState(new Set());
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);
  const [addFriendExpandedSection, setAddFriendExpandedSection] = useState(null);
  const [showAdminNewsDialog, setShowAdminNewsDialog] = useState(false);
  const [adminNewsTitle, setAdminNewsTitle] = useState("");
  const [adminNewsText, setAdminNewsText] = useState("");
  const [explorerPullOffset, setExplorerPullOffset] = useState(0);
  const [isExplorerPulling, setIsExplorerPulling] = useState(false);
  const [isExplorerRefreshing, setIsExplorerRefreshing] = useState(false);
  const [explorerSnapPulse, setExplorerSnapPulse] = useState(false);
  const explorerTouchStartYRef = useRef(null);
  const explorerPullingRef = useRef(false);
  const explorerThresholdReachedRef = useRef(false);
  const explorerSnapTimeoutRef = useRef(null);
  const explorerContainerRef = useRef(null);
  const autoMarkingNewsRef = useRef(false);
  const [isNewsRefreshing, setIsNewsRefreshing] = useState(
    () => (searchParams.get("tab") || "explorer") === "news"
  );
  const isFriendsTab = activeTab === "friends";
  const isExplorerTab = activeTab === "explorer";
  const shouldLoadDiscoveryData = isExplorerTab || isFriendsTab;

  useEffect(() => {
    if (!embedded) return;
    if (openAddFriendDialogNonce > 0) {
      setActiveTab("friends");
      setShowAddFriendDialog(true);
    }
  }, [embedded, openAddFriendDialogNonce]);

  useEffect(() => {
    if (showAddFriendDialog) {
      setAddFriendExpandedSection(null);
    }
  }, [showAddFriendDialog]);

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
  const friends = useMemo(() => {
    if (!user?.email) return [];
    const ownEmail = user.email.toLowerCase();
    return allFriendRecords.filter((f) =>
      (f.request_sent_by?.toLowerCase() === ownEmail ||
        f.request_sent_to?.toLowerCase() === ownEmail) &&
      f.status === "accepted"
    );
  }, [allFriendRecords, user?.email]);

  // Eingehende Anfragen (wo ICH Empfänger bin)
  const pendingRequests = useMemo(() => {
    if (!user?.email) return [];
    const ownEmail = user.email.toLowerCase();
    return allFriendRecords.filter((f) =>
      f.request_sent_to?.toLowerCase() === ownEmail &&
      f.status === "pending"
    );
  }, [allFriendRecords, user?.email]);

  const { data: allPublicProfiles = [], refetch: refetchAllPublicProfiles } = useQuery({
    queryKey: ['allPublicProfiles'],
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 30000 // 30 Sekunden Cache
  });

  const ownEmailLower = user?.email?.toLowerCase() || "";
  const profileByEmail = useMemo(
    () => new Map(
      (allPublicProfiles || [])
        .filter((profile) => !!profile.user_email)
        .map((profile) => [profile.user_email.toLowerCase(), profile])
    ),
    [allPublicProfiles]
  );

  const profileByAuthId = useMemo(
    () => new Map(
      (allPublicProfiles || [])
        .filter((profile) => !!profile.auth_id)
        .map((profile) => [profile.auth_id, profile])
    ),
    [allPublicProfiles]
  );

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

  const explorerThresholdIso = useMemo(() => getExplorerThresholdIso(), []);

  const {
    data: explorerDiscoveriesPages,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isLoading: isExplorerLoading,
    refetch: refetchExplorerDiscoveries,
  } = useInfiniteQuery({
    queryKey: ['explorerDiscoveriesInfinite', ownEmailLower, explorerAudienceFilter, explorerThresholdIso],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase.rpc('get_explorer_discoveries', {
        p_audience: explorerAudienceFilter,
        p_since: explorerThresholdIso,
        p_limit: EXPLORER_PAGE_SIZE,
        p_offset: pageParam * EXPLORER_PAGE_SIZE,
      });

      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < EXPLORER_PAGE_SIZE ? undefined : allPages.length,
    enabled: !!user?.email && isExplorerTab,
    staleTime: 30 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialPageParam: 0,
  });

  const explorerDiscoveries = useMemo(
    () => explorerDiscoveriesPages?.pages?.flatMap((page) => page) || [],
    [explorerDiscoveriesPages]
  );

  const PULL_TO_REFRESH_THRESHOLD = 84;

  const clearExplorerSnapTimeout = useCallback(() => {
    if (explorerSnapTimeoutRef.current) {
      window.clearTimeout(explorerSnapTimeoutRef.current);
      explorerSnapTimeoutRef.current = null;
    }
  }, []);

  const resetExplorerPullState = useCallback(() => {
    explorerTouchStartYRef.current = null;
    explorerPullingRef.current = false;
    explorerThresholdReachedRef.current = false;
    setIsExplorerPulling(false);
    setExplorerPullOffset(0);
  }, []);

  const triggerExplorerRefresh = useCallback(async () => {
    if (isExplorerRefreshing) return;
    setIsExplorerRefreshing(true);
    try {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["explorerDiscoveriesInfinite"] }),
        queryClient.cancelQueries({ queryKey: ["allPublicProfiles"] }),
        queryClient.cancelQueries({ queryKey: ["scanLikesAll"] }),
      ]);

      queryClient.removeQueries({ queryKey: ["explorerDiscoveriesInfinite"] });
      queryClient.removeQueries({ queryKey: ["allPublicProfiles"], exact: true });
      queryClient.removeQueries({ queryKey: ["scanLikesAll"], exact: true });

      await Promise.all([
        refetchExplorerDiscoveries({ cancelRefetch: false }),
        refetchAllPublicProfiles({ cancelRefetch: false }),
        queryClient.invalidateQueries({ queryKey: ["scanLikesAll"], refetchType: "active" }),
      ]);
    } finally {
      setIsExplorerRefreshing(false);
      setExplorerSnapPulse(false);
      setExplorerPullOffset(0);
    }
  }, [isExplorerRefreshing, queryClient, refetchAllPublicProfiles, refetchExplorerDiscoveries]);

  const handleExplorerTouchStart = useCallback((event) => {
    if (!isExplorerTab || isExplorerRefreshing) return;
    const container = explorerContainerRef.current;
    if (!container) return;
    if (container.scrollTop > 0) return;

    explorerTouchStartYRef.current = event.touches?.[0]?.clientY ?? null;
    explorerPullingRef.current = false;
    explorerThresholdReachedRef.current = false;
    clearExplorerSnapTimeout();
    setExplorerSnapPulse(false);
  }, [isExplorerRefreshing, isExplorerTab]);

  const handleExplorerTouchMove = useCallback((event) => {
    if (!isExplorerTab || isExplorerRefreshing) return;
    const startY = explorerTouchStartYRef.current;
    const container = explorerContainerRef.current;
    if (typeof startY !== "number" || !container) return;

    if (container.scrollTop > 0) {
      resetExplorerPullState();
      return;
    }

    const currentY = event.touches?.[0]?.clientY ?? null;
    if (typeof currentY !== "number") return;

    const deltaY = currentY - startY;
    if (deltaY <= 0) {
      if (explorerPullingRef.current) {
        setIsExplorerPulling(false);
        setExplorerPullOffset(0);
      }
      return;
    }

    explorerPullingRef.current = true;
    setIsExplorerPulling(true);
    const dampedOffset = Math.min(120, deltaY * 0.45);

    const reachedThreshold = dampedOffset >= PULL_TO_REFRESH_THRESHOLD;
    if (reachedThreshold && !explorerThresholdReachedRef.current) {
      explorerThresholdReachedRef.current = true;
      clearExplorerSnapTimeout();
      setExplorerSnapPulse(true);
      explorerSnapTimeoutRef.current = window.setTimeout(() => {
        setExplorerSnapPulse(false);
        explorerSnapTimeoutRef.current = null;
      }, 160);
    } else if (!reachedThreshold) {
      explorerThresholdReachedRef.current = false;
    }

    setExplorerPullOffset(dampedOffset);
    event.preventDefault();
  }, [clearExplorerSnapTimeout, isExplorerRefreshing, isExplorerTab, resetExplorerPullState]);

  const handleExplorerTouchEnd = useCallback(async () => {
    if (!isExplorerTab) {
      resetExplorerPullState();
      return;
    }

    const shouldRefresh = explorerPullingRef.current && explorerPullOffset >= PULL_TO_REFRESH_THRESHOLD;
    resetExplorerPullState();

    if (shouldRefresh) {
      await triggerExplorerRefresh();
    }
  }, [explorerPullOffset, isExplorerTab, resetExplorerPullState, triggerExplorerRefresh]);

  useEffect(() => {
    if (!isExplorerTab) {
      resetExplorerPullState();
    }
  }, [isExplorerTab, resetExplorerPullState]);

  useEffect(() => () => {
    clearExplorerSnapTimeout();
  }, [clearExplorerSnapTimeout]);

  const { data: friendActivityDiscoveries = [] } = useQuery({
    queryKey: ['friendActivityDiscoveries'],
    queryFn: () => Query.UserPlantDiscovery.list('-created_date', 600),
    enabled: !!user?.email && isFriendsTab,
    staleTime: 60 * 1000,
  });

  const { data: adminNews = [], refetch: refetchAdminNews } = useQuery({
    queryKey: ['news'],
    queryFn: () => Query.News.list('-created_date'),
    staleTime: 60000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: scanLikes = [] } = useQuery({
    queryKey: ['scanLikesAll'],
    queryFn: () => Query.ScanLike.list('-created_date', 2000),
    enabled: !!user?.email && isExplorerTab,
    staleTime: 60 * 1000,
  });

  // Lade alle Plants
  const { data: allPlants = [] } = useQuery({
    queryKey: ['allPlants'],
    queryFn: () => Query.Plant.list(),
    enabled: !!user?.email && shouldLoadDiscoveryData,
  });

  const { data: allGenera = [] } = useQuery({
    queryKey: ['allGenera'],
    queryFn: () => Query.PlantGenus.list(),
    enabled: !!user?.email && shouldLoadDiscoveryData,
  });

  const NEWS_TYPES = ['gift_received', 'collection_followed', 'friendship_accepted', 'friend_request_received', 'friend_achievement', 'scan_liked', 'admin_broadcast'];

  const { data: userNews = [], refetch: refetchUserNews } = useQuery({
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
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Beim Oeffnen des News-Tabs immer Aktivitaeten und Server-News neu laden.
  useEffect(() => {
    if (activeTab !== 'news' || !user?.email) {
      return;
    }

    let cancelled = false;

    const refreshNewsTab = async () => {
      setIsNewsRefreshing(true);
      try {
        await Promise.all([
          refetchUserNews(),
          refetchAdminNews(),
        ]);
      } catch (error) {
        console.error('[Friends] Error while refreshing news tab:', error);
      } finally {
        if (!cancelled) {
          setIsNewsRefreshing(false);
        }
      }
    };

    refreshNewsTab();

    return () => {
      cancelled = true;
    };
  }, [activeTab, user?.email, refetchUserNews, refetchAdminNews]);

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
    queryFn: () => Query.UserAchievement.list('-created_date', 999),
    enabled: !!user?.email && isFriendsTab,
  });

  // Lade Achievement Definitionen
  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => Query.Achievement.list(),
    enabled: isFriendsTab,
  });

  const plantById = useMemo(
    () => new Map((allPlants || []).map((plant) => [plant.id, plant])),
    [allPlants]
  );

  const genusIdByPlantId = useMemo(() => {
    const genusByKey = new Map(
      (allGenera || []).map((genus) => [
        `${String(genus?.category || "").trim().toLowerCase()}::${String(genus?.category_dex_number || "").trim()}`,
        genus?.id,
      ])
    );

    const result = new Map();
    (allPlants || []).forEach((plant) => {
      if (!plant?.id) return;
      if (plant?.genus_id) {
        result.set(plant.id, plant.genus_id);
        return;
      }

      const key = `${String(plant?.genus_category || "").trim().toLowerCase()}::${String(plant?.genus_number || "").trim()}`;
      const derivedGenusId = genusByKey.get(key);
      if (derivedGenusId) {
        result.set(plant.id, derivedGenusId);
      }
    });

    return result;
  }, [allGenera, allPlants]);

  const achievementById = useMemo(
    () => new Map((achievements || []).map((achievement) => [achievement.id, achievement])),
    [achievements]
  );

  const pendingRequestByActorEmail = useMemo(() => {
    const map = new Map();
    if (!user?.email) return map;

    const myEmail = user.email.toLowerCase();
    allFriendRecords.forEach((request) => {
      const actorEmail = request.request_sent_by?.toLowerCase();
      if (!actorEmail) return;
      if (request.status !== 'pending') return;
      if (request.request_sent_to?.toLowerCase() !== myEmail) return;
      map.set(actorEmail, request);
    });

    return map;
  }, [allFriendRecords, user?.email]);

  const unreadNewsCount = useMemo(
    () => userNews.filter((notification) => notification.seen !== true).length,
    [userNews]
  );

  const getExistingFriendship = useCallback((targetEmailRaw, targetAuthIdRaw) => {
    if (!user?.email) return null;

    const myEmail = user.email.toLowerCase();
    const myAuthId = String(user.id || "").trim() || null;
    const targetEmail = String(targetEmailRaw || "").trim().toLowerCase() || null;
    const targetAuthId = String(targetAuthIdRaw || "").trim() || null;

    return allFriendRecords.find((record) => {
      const byEmail = Boolean(targetEmail) && (
        (record.request_sent_by?.toLowerCase() === myEmail && record.request_sent_to?.toLowerCase() === targetEmail) ||
        (record.request_sent_by?.toLowerCase() === targetEmail && record.request_sent_to?.toLowerCase() === myEmail)
      );

      const byAuthId = Boolean(targetAuthId && myAuthId) && (
        (record.request_sent_by_auth_id === myAuthId && record.request_sent_to_auth_id === targetAuthId) ||
        (record.request_sent_by_auth_id === targetAuthId && record.request_sent_to_auth_id === myAuthId)
      );

      return byEmail || byAuthId;
    }) || null;
  }, [allFriendRecords, user?.email, user?.id]);

  const friendSearchResults = useMemo(() => {
    const query = friendSearchQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    const ownAuthId = String(user?.id || "").trim() || null;
    const ownEmailLower = user?.email?.toLowerCase() || "";

    return (allPublicProfiles || [])
      .filter((profile) => {
        const profileAuthId = String(profile?.auth_id || "").trim() || null;
        const profileEmailLower = String(profile?.user_email || "").trim().toLowerCase();

        if (profileAuthId && ownAuthId && profileAuthId === ownAuthId) return false;
        if (profileEmailLower && ownEmailLower && profileEmailLower === ownEmailLower) return false;

        const displayName = String(profile?.display_name || "").trim().toLowerCase();
        const fullName = String(profile?.full_name || "").trim().toLowerCase();
        return displayName.startsWith(query) || fullName.startsWith(query);
      })
      .map((profile) => {
        const email = String(profile?.user_email || "").trim() || null;
        const authId = String(profile?.auth_id || "").trim() || null;
        const displayName =
          String(profile?.display_name || "").trim() ||
          String(profile?.full_name || "").trim() ||
          email ||
          "Unbekannt";
        const existingFriendship = getExistingFriendship(email, authId);

        return {
          profile,
          email,
          authId,
          displayName,
          existingFriendship,
        };
      })
      .sort((left, right) => {
        const leftName = left.displayName.toLowerCase();
        const rightName = right.displayName.toLowerCase();
        const leftStarts = leftName.startsWith(query) ? 0 : 1;
        const rightStarts = rightName.startsWith(query) ? 0 : 1;
        if (leftStarts !== rightStarts) return leftStarts - rightStarts;
        return leftName.localeCompare(rightName, "de");
      })
      .slice(0, 8);
  }, [allPublicProfiles, friendSearchQuery, getExistingFriendship, user?.email, user?.id]);

  const sendFriendRequestMutation = useMutation({
    mutationFn: async ({ recipientEmail = null, recipientAuthId = null } = {}) => {
      if (!user || !user.email) {
        throw new Error("User nicht geladen!");
      }

      const targetEmail = String(recipientEmail || "").trim() || null;
      const targetAuthId = String(recipientAuthId || "").trim() || null;

      if (!targetEmail && !targetAuthId) {
        throw new Error("Bitte gib eine E-Mail-Adresse ein oder waehle einen Spieler aus.");
      }

      const myEmail = user.email.toLowerCase();
      const myAuthId = String(user.id || "").trim() || null;
      const friendEmailLower = targetEmail?.toLowerCase() || null;

      // Selbst-Check
      if ((friendEmailLower && friendEmailLower === myEmail) || (targetAuthId && myAuthId && targetAuthId === myAuthId)) {
        throw new Error("Du kannst dir nicht selbst eine Anfrage senden!");
      }

      const existingFriendship = getExistingFriendship(targetEmail, targetAuthId);

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
      await sendFriendRequest(targetEmail, targetAuthId);

      const targetProfile =
        (targetAuthId ? profileByAuthId.get(targetAuthId) : null) ||
        (friendEmailLower ? profileByEmail.get(friendEmailLower) : null);
      const senderName = user.display_name || user.full_name || user.email;
      const notificationRecipientEmail = targetProfile?.user_email || targetEmail;

      if (!notificationRecipientEmail) {
        return;
      }

      try {
        await createUserNotification({
          authId: targetProfile?.auth_id,
          userEmail: notificationRecipientEmail,
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
          setFriendSearchQuery("");
      setFriendEmail("");
    },
    onError: (error) => {
      alert(error.message);
    }
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (request) => {
      const affected = await respondToFriendRequest(
        request.request_sent_by,
        "accept",
        request.request_sent_by_auth_id || null,
      );
      return { affected };
    },
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      await queryClient.refetchQueries({ queryKey: ['allFriendRecords'] });

      if (!result?.affected || result.affected <= 0) {
        return;
      }

      // Zeige Success-Message
      const requesterEmail = variables.request_sent_by;
      alert(`✅ Freundschaft mit ${requesterEmail} bestätigt!`);

      try {
        const requesterProfile = profileByEmail.get(requesterEmail?.toLowerCase());
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
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("nicht mehr offen") || message.includes("nicht mehr gültig") || message.includes("not open")) {
        queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
        return;
      }
      alert(`Fehler beim Annehmen der Anfrage: ${error.message}`);
    }
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (request) => {
      const affected = await respondToFriendRequest(
        request.request_sent_by,
        "reject",
        request.request_sent_by_auth_id || null,
      );
      return { affected };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      await queryClient.refetchQueries({ queryKey: ['allFriendRecords'] });

      if (!result?.affected || result.affected <= 0) {
        return;
      }

      alert(`❌ Freundschaftsanfrage abgelehnt`);
    },
    onError: (error) => {
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("nicht mehr offen") || message.includes("nicht mehr gültig") || message.includes("not open")) {
        queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
        return;
      }
      alert(`Fehler beim Ablehnen der Anfrage: ${error.message}`);
    }
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendToRemove) => {
      return removeFriendship(friendToRemove.email, friendToRemove.auth_id || null);
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
      // Kein direkter Referral-Insert im Frontend: das verursacht RLS-Fehler.
      // Die Verknüpfung wird beim ersten Login des eingeladenen Users serverseitig erstellt.
      return email;
    },
    onSuccess: (email) => {
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
      return false;
    }

    if (!friendEmail || !friendEmail.trim()) {
      alert("Bitte gib eine E-Mail-Adresse ein.");
      return false;
    }

    const trimmedEmail = friendEmail.trim();

    // Self-Check
    if (trimmedEmail.toLowerCase() === user.email.toLowerCase()) {
      alert("Du kannst dir nicht selbst eine Anfrage senden! 😄");
      setFriendEmail("");
      return false;
    }

    // Basic E-Mail Format Check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      alert("Bitte gib eine gültige E-Mail-Adresse ein.");
      return false;
    }

    try {
      await sendFriendRequestMutation.mutateAsync({ recipientEmail: trimmedEmail });
      alert(`Freundschaftsanfrage an ${trimmedEmail} gesendet! ✅`);
      return true;
    } catch (error) {

      // Error already shown by mutation
      return false;
    }
  };

  const handleSendRequestToProfile = async (result) => {
    if (!result) return;

    const profileLabel = result.displayName || result.email || "diesem Spieler";

    try {
      await sendFriendRequestMutation.mutateAsync({
        recipientEmail: result.email,
        recipientAuthId: result.authId,
      });
      alert(`Freundschaftsanfrage an ${profileLabel} gesendet! ✅`);
      setShowAddFriendDialog(false);
    } catch (_error) {
      // Error already shown by mutation
    }
  };

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
        const notificationGenusId = entry?.plant?.genus_id || genusIdByPlantId.get(entry?.plant?.id);
        const actionParams = new URLSearchParams();
        if (notificationGenusId) actionParams.set("id", notificationGenusId);
        actionParams.set("discoveryId", entry.id);

        await Promise.allSettled([
          createUserNotification({
            authId: entry.actorAuthId || null,
            userEmail: entry.actorEmail || null,
            notificationType: "scan_liked",
            title: "❤️ Neuer Like",
            message: `${likerName} gefällt dein Scan${entry.plant?.species_name ? ` (${entry.plant.species_name})` : ""}.`,
            description: entry.plant?.species_name || "",
            actionUrl: notificationGenusId
              ? `GenusDetail?${actionParams.toString()}`
              : "Collection",
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

  const openExplorerDiscoveryInFriendCollection = useCallback((entry) => {
    const genusId = entry?.plant?.genus_id || genusIdByPlantId.get(entry?.plant?.id);
    const discoveryId = entry?.id;
    const actorEmail = String(entry?.actorEmail || "").trim();

    if (!genusId || !discoveryId || !actorEmail) {
      return;
    }

    const nextParams = new URLSearchParams();
    nextParams.set("id", genusId);
    nextParams.set("email", actorEmail);
    nextParams.set("collectionId", "global");
    nextParams.set("discoveryId", discoveryId);

    navigate(createPageUrl(`GenusDetail?${nextParams.toString()}`));
  }, [genusIdByPlantId, navigate]);

  const latestFriendActivityByKey = useMemo(() => {
    const latestByKey = new Map();

    const updateLatest = (key, candidate) => {
      if (!key || !candidate) return;
      const current = latestByKey.get(key);
      if (!current || candidate.timestamp > current.timestamp) {
        latestByKey.set(key, candidate);
      }
    };

    friendActivityDiscoveries.forEach((entry) => {
      const date = parseActivityDate(entry.discovered_date, entry.created_date);
      if (!date) return;

      const activity = {
        type: 'discovery',
        plant: plantById.get(entry.plant_id),
        date: date.toISOString(),
        timestamp: date.getTime(),
      };

      updateLatest(entry.auth_id ? `auth:${entry.auth_id}` : null, activity);

      const email = (entry.user || entry.created_by || entry.user_email || '').toLowerCase();
      updateLatest(email ? `email:${email}` : null, activity);
    });

    allUserAchievements.forEach((entry) => {
      const date = parseActivityDate(entry.unlocked_date, entry.created_date);
      if (!date) return;

      const activity = {
        type: 'achievement',
        achievement: achievementById.get(entry.achievement_id),
        date: date.toISOString(),
        timestamp: date.getTime(),
      };

      updateLatest(entry.auth_id ? `auth:${entry.auth_id}` : null, activity);

      const email = (entry.user || entry.created_by || entry.user_email || '').toLowerCase();
      updateLatest(email ? `email:${email}` : null, activity);
    });

    const normalizedMap = new Map();
    latestByKey.forEach((activity, key) => {
      const { timestamp: _timestamp, ...normalizedActivity } = activity;
      normalizedMap.set(key, normalizedActivity);
    });

    return normalizedMap;
  }, [friendActivityDiscoveries, allUserAchievements, plantById, achievementById]);

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

    const actorProfile = profileByEmail.get(actorEmail.toLowerCase());

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

  const getPendingRequestFromNews = (newsItem) => {
    if (newsItem.notification_type !== 'friend_request_received' || !user?.email) {
      return null;
    }

    const actorEmail = newsItem.created_by?.toLowerCase();
    if (!actorEmail) return null;

    return pendingRequestByActorEmail.get(actorEmail) || null;
  };

  const handleFriendRequestActionFromNews = async (event, newsItem, action) => {
    event.stopPropagation();

    const pendingRequest = getPendingRequestFromNews(newsItem);
    if (!pendingRequest) {
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

  const openNewsActorProfile = (event, newsItem, actorEmail) => {
    event.stopPropagation();
    if (!actorEmail) return;

    if (newsItem.seen !== true) {
      markNewsAsSeenMutation.mutate(newsItem.id);
    }

    navigate(createPageUrl(`FriendProfile?email=${encodeURIComponent(actorEmail)}`));
  };

  const openNewsScanDetail = (event, newsItem) => {
    event.stopPropagation();
    if (!newsItem?.action_url) return;

    if (newsItem.seen !== true) {
      markNewsAsSeenMutation.mutate(newsItem.id);
    }

    navigate(createPageUrl(newsItem.action_url));
  };

  // Helper: Hole Freundesdaten
  const getFriendData = useCallback((friendEntry) => {
    if (!user || !user.email) return null;

    const ownEmailLower = user.email.toLowerCase();
    const isCurrentUserSender = friendEntry.request_sent_by?.toLowerCase() === ownEmailLower;
    const candidateFriendEmail = isCurrentUserSender
      ? friendEntry.request_sent_to
      : friendEntry.request_sent_by;
    const candidateFriendEmailLower = candidateFriendEmail?.toLowerCase() || "";

    // Friend rows currently carry a single auth_id (creator). Use it when it is not me.
    const recordAuthId =
      friendEntry?.auth_id && user?.id && friendEntry.auth_id !== user.id
        ? friendEntry.auth_id
        : null;

    let friendProfile = profileByEmail.get(candidateFriendEmailLower) || null;
    const friendAuthId = friendProfile?.auth_id || recordAuthId || null;
    if (friendAuthId) {
      friendProfile = profileByAuthId.get(friendAuthId) || friendProfile;
    }

    const resolvedFriendEmail = friendProfile?.user_email || candidateFriendEmail || null;
    if (!resolvedFriendEmail && !friendProfile) return null;

    const resolvedFriendEmailLower = resolvedFriendEmail?.toLowerCase() || "";
    const lastActivity =
      (friendAuthId ? latestFriendActivityByKey.get(`auth:${friendAuthId}`) : null) ||
      (resolvedFriendEmailLower ? latestFriendActivityByKey.get(`email:${resolvedFriendEmailLower}`) : null) ||
      null;

    return {
      id: friendEntry.id,
      email: resolvedFriendEmail,
      auth_id: friendAuthId,
      name: friendProfile?.display_name || friendProfile?.full_name || resolvedFriendEmail,
      logoAssets: resolveEquippedLogoAssetsWithCatalog(friendProfile || {}, logoAssets),
      level: friendProfile?.level || 1,
      title: friendProfile?.selected_title || friendProfile?.title || "Pflanzen-Anfänger",
      lastActivity
    };
  }, [user, profileByEmail, profileByAuthId, latestFriendActivityByKey, logoAssets]);

  const likedDiscoveryIdSet = useMemo(
    () => new Set(
      scanLikes
        .filter((like) => like?.discovery_id && like?.liked_by?.toLowerCase() === ownEmailLower)
        .map((like) => like.discovery_id)
    ),
    [scanLikes, ownEmailLower]
  );

  const likeCountByDiscoveryId = useMemo(
    () => scanLikes.reduce((acc, like) => {
      if (!like?.discovery_id) return acc;
      acc.set(like.discovery_id, (acc.get(like.discovery_id) || 0) + 1);
      return acc;
    }, new Map()),
    [scanLikes]
  );

  const getDiscoveryEmailLower = (entry) =>
    (entry.user || entry.created_by || entry.user_email || "").toLowerCase();
  const showFriendsOnlyInExplorer = explorerAudienceFilter === "friends";

  const recentDiscoveries = useMemo(
    () => explorerDiscoveries || [],
    [explorerDiscoveries]
  );

  const scanCountByUserPlant = useMemo(
    () => recentDiscoveries.reduce((acc, entry) => {
      const key = `${getDiscoveryEmailLower(entry)}::${entry.plant_id}`;
      if (!key) return acc;
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map()),
    [recentDiscoveries]
  );

  const explorerLogEntries = useMemo(() => {
    return recentDiscoveries.map((entry) => {
      const entryEmail = getDiscoveryEmailLower(entry);
      const key = `${entryEmail}::${entry.plant_id}`;
      const profile =
        profileByEmail.get(entryEmail) ||
        (entry.auth_id ? profileByAuthId.get(entry.auth_id) : null);
      const isOwnEntry = Boolean(
        (entry.auth_id && user?.id && entry.auth_id === user.id) ||
        (entryEmail && ownEmailLower && entryEmail === ownEmailLower)
      );
      const actorName =
        profile?.display_name ||
        profile?.full_name ||
        (isOwnEntry
          ? (user?.display_name || user?.full_name || "Du")
          : "Unbekannte Entdeckerin");

      return {
        id: entry.id,
        discovery: entry,
        plant: plantById.get(entry.plant_id),
        actorEmail: entryEmail || String(profile?.user_email || "").toLowerCase(),
        actorAuthId: profile?.auth_id || entry.auth_id || null,
        actorName,
        actorLogoAssets: resolveEquippedLogoAssetsWithCatalog(profile || {}, logoAssets),
        scanCount: scanCountByUserPlant.get(key) || 0,
        likedByCurrentUser: likedDiscoveryIdSet.has(entry.id),
        likeCount: likeCountByDiscoveryId.get(entry.id) || 0,
        timestamp: new Date(entry.created_date || entry.discovered_date || entry.updated_date || Date.now()),
      };
    });
  }, [recentDiscoveries, profileByEmail, profileByAuthId, plantById, logoAssets, scanCountByUserPlant, likedDiscoveryIdSet, likeCountByDiscoveryId, ownEmailLower, user]);

  useEffect(() => {
    if (activeTab !== "explorer" || !hasNextPage || isFetchingNextPage) return;

    const sentinel = explorerSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isFetchingNextPage) return;
        fetchNextPage();
      },
      { rootMargin: "0px 0px 200px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const friendCards = useMemo(
    () => friends
      .map((friendEntry) => ({
        friend: friendEntry,
        friendData: getFriendData(friendEntry),
      }))
      .filter((entry) => !!entry.friendData),
    [friends, getFriendData]
  );

  const pendingRequestCards = useMemo(
    () => pendingRequests
      .map((request) => ({ request, requesterData: getFriendData(request) }))
      .filter((entry) => !!entry.requesterData),
    [pendingRequests, getFriendData]
  );

  const pendingRequestsCount = pendingRequestCards.length;

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
          <TabsContent
            value="explorer"
            className={explorerContentClass}
            style={embeddedContentMaskStyle}
            ref={explorerContainerRef}
            onTouchStart={handleExplorerTouchStart}
            onTouchMove={handleExplorerTouchMove}
            onTouchEnd={handleExplorerTouchEnd}
            onTouchCancel={handleExplorerTouchEnd}
          >
            <div
              className="will-change-transform"
              style={{
                transform: `translateY(${Math.min(16, explorerPullOffset * 0.16)}px) scale(${explorerSnapPulse ? 0.988 : 1})`,
                transition: isExplorerPulling || isExplorerRefreshing
                  ? "transform 70ms linear"
                  : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-5xl mx-auto space-y-4"
              style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}
            >
              {isExplorerLoading ? (
                <div className={`${sectionSurfaceClass} px-5 py-10 text-center`}>
                  <Loader2 className={`w-12 h-12 mx-auto mb-4 animate-spin ${isLightUi ? "text-stone-400" : "text-stone-500"}`} />
                  <p className={bodyTextClass}>Lade Forscher-Log...</p>
                </div>
              ) : explorerLogEntries.length === 0 ? (
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
                  {explorerLogEntries.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <Card
                        className={`${nestedCardClass} ${isLightUi ? "bg-white" : ""} ${interactiveHoverClass} transition-all overflow-hidden`}
                      >
                        {entry.discovery?.image_url ? (
                          <button
                            type="button"
                            onClick={() => openExplorerDiscoveryInFriendCollection(entry)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openExplorerDiscoveryInFriendCollection(entry);
                              }
                            }}
                            className={`block w-full aspect-[4/3] overflow-hidden ${isLightUi ? "bg-stone-100" : "bg-stone-900/60"}`}
                            aria-label="Scan in Freundes-Kollektion oeffnen"
                          >
                            <img
                              src={entry.discovery.image_url}
                              alt={entry.plant?.species_name || "Scan"}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openExplorerDiscoveryInFriendCollection(entry)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openExplorerDiscoveryInFriendCollection(entry);
                              }
                            }}
                            className={`block w-full aspect-[4/3] ${isLightUi ? "bg-gradient-to-br from-emerald-50 to-stone-100" : "bg-gradient-to-br from-emerald-500/10 to-stone-950/60"}`}
                            aria-label="Scan in Freundes-Kollektion oeffnen"
                          >
                          <div className="w-full h-full flex items-center justify-center">
                            <Leaf className={`w-10 h-10 ${isLightUi ? "text-emerald-500" : "text-emerald-300"}`} />
                          </div>
                          </button>
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
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
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
                                tooltipText={entry.actorName || entry.actorEmail || "Freund"}
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
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleExplorerLike(entry, !entry.likedByCurrentUser);
                                }}
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
              <div ref={explorerSentinelRef} className="h-px" />
              {(hasNextPage || isFetchingNextPage) && (
                <div className={`flex justify-center py-3 ${isLightUi ? "text-stone-400" : "text-stone-500"}`}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
                </>
              )}
            </motion.div>
            </div>
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
              {isNewsRefreshing ? (
                <div className={`${sectionSurfaceClass} px-5 py-10 text-center`}>
                  <Loader2 className={`w-12 h-12 mx-auto mb-4 animate-spin ${isLightUi ? "text-stone-400" : "text-stone-500"}`} />
                  <p className={bodyTextClass}>Neuigkeiten werden aktualisiert...</p>
                </div>
              ) : userNews.length === 0 && adminNews.length === 0 ? (
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
                        const parsedScanLike =
                          newsItem.notification_type === 'scan_liked'
                            ? parseScanLikedNotification(newsItem, actor.name)
                            : null;
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
                              className={`${nestedCardClass} ${isLightUi ? "bg-white" : ""} transition-all cursor-pointer ${isExpanded ? "bg-opacity-100" : "hover:bg-opacity-75"} ${newsItem.seen ? "" : (isLightUi ? "border-emerald-200 bg-white" : "border-emerald-300/30 bg-emerald-500/10")}`}
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
                                        tooltipText={actor.name || actor.email || "Freund"}
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
                                    {newsItem.notification_type === 'scan_liked' && (
                                      <p className={`text-xs mt-0.5 truncate ${mutedTextClass}`}>
                                        <button
                                          type="button"
                                          onClick={(event) => openNewsActorProfile(event, newsItem, actor.email)}
                                          className={`font-semibold underline-offset-2 ${actor.email ? "underline" : "cursor-default no-underline"}`}
                                          disabled={!actor.email}
                                        >
                                          {parsedScanLike?.actorName || actor.name || 'Jemand'}
                                        </button>
                                        {' gefällt dein Scan '}
                                        {parsedScanLike?.scanName ? (
                                          <button
                                            type="button"
                                            onClick={(event) => openNewsScanDetail(event, newsItem)}
                                            className={`font-semibold underline underline-offset-2 ${newsItem.action_url ? "" : "no-underline cursor-default"}`}
                                            disabled={!newsItem.action_url}
                                          >
                                            {parsedScanLike.scanName}
                                          </button>
                                        ) : (
                                          <span>diesen Scan</span>
                                        )}
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
                                        {newsItem.notification_type === 'scan_liked' ? (
                                          <p className={`text-xs ${bodyTextClass}`}>
                                            <button
                                              type="button"
                                              onClick={(event) => openNewsActorProfile(event, newsItem, actor.email)}
                                              className={`font-semibold underline-offset-2 ${actor.email ? "underline" : "cursor-default no-underline"}`}
                                              disabled={!actor.email}
                                            >
                                              {parsedScanLike?.actorName || actor.name || 'Jemand'}
                                            </button>
                                            {' gefällt dein Scan '}
                                            {parsedScanLike?.scanName ? (
                                              <button
                                                type="button"
                                                onClick={(event) => openNewsScanDetail(event, newsItem)}
                                                className={`font-semibold underline underline-offset-2 ${newsItem.action_url ? "" : "no-underline cursor-default"}`}
                                                disabled={!newsItem.action_url}
                                              >
                                                {parsedScanLike.scanName}
                                              </button>
                                            ) : (
                                              <span>diesen Scan</span>
                                            )}
                                          </p>
                                        ) : (
                                          <p className={`text-xs ${bodyTextClass}`}>
                                            {newsItem.message}
                                          </p>
                                        )}
                                        {!!newsItem.description && (
                                          <p className={`text-[11px] mt-2 ${mutedTextClass}`}>{newsItem.description}</p>
                                        )}
                                        {showFriendRequestActions && (
                                          <div className="mt-3 grid grid-cols-2 gap-2" onClick={(event) => event.stopPropagation()}>
                                            <Button
                                              size="sm"
                                              className="h-8 w-full px-2 text-xs bg-green-600 hover:bg-green-700"
                                              disabled={acceptFriendRequestMutation.isPending || rejectFriendRequestMutation.isPending}
                                              onClick={(event) => handleFriendRequestActionFromNews(event, newsItem, 'accept')}
                                            >
                                              <Check className="w-3 h-3 mr-1" />
                                              Annehmen
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className={`h-8 w-full px-2 text-xs ${isLightUi ? "border-red-300 text-red-600 hover:bg-red-50" : "border-red-400/50 text-red-200 hover:bg-red-500/10"}`}
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
                              className={`${nestedCardClass} ${isLightUi ? "bg-white" : ""} transition-all cursor-pointer`}
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
                    {pendingRequestCards.map(({ request, requesterData }, index) => {

                      return (
                        <motion.div
                          key={request.id}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.06 }}
                          className={`${nestedCardClass} p-3 md:p-4`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
                                <CustomLogoAvatar
                                  logoAssets={requesterData.logoAssets}
                                  className="w-full h-full"
                                  tooltipText={requesterData.name || requesterData.email || "Freund"}
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
                            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-none sm:flex sm:justify-end">
                              <Button
                                size="sm"
                                onClick={() => acceptFriendRequestMutation.mutate(request)}
                                disabled={acceptFriendRequestMutation.isPending}
                                className="h-9 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Annehmen
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectFriendRequestMutation.mutate(request)}
                                disabled={rejectFriendRequestMutation.isPending}
                                className={`${isLightUi ? "border-red-300 text-red-600 hover:bg-red-50" : "border-red-400/50 text-red-200 hover:bg-red-500/10"} h-9 w-full sm:w-auto`}
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
                          onClick={() => {
                            if (!friendData.email) return;
                            navigate(createPageUrl(`FriendProfile?email=${encodeURIComponent(friendData.email)}`));
                          }}
                          className="flex items-center gap-2.5 flex-1 min-w-0 max-w-full text-left"
                        >
                          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                            <CustomLogoAvatar
                              logoAssets={friendData.logoAssets}
                              className="w-full h-full"
                              tooltipText={friendData.name || friendData.email || "Freund"}
                              fallbackText={friendData.name?.[0]?.toUpperCase() || friendData.email?.[0]?.toUpperCase()}
                              fallbackClassName="text-sm font-bold text-white"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className={`font-semibold truncate ${titleTextClass}`}>{friendData.name}</p>
                            </div>
                            <p className={`text-xs truncate ${bodyTextClass}`}>{friendData.email || "E-Mail nicht verfügbar"}</p>
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
            {[
              { id: "name", title: "1.) Freund per Namen suchen" },
              { id: "email", title: "2.) Freund per Mail hinzufuegen" },
              { id: "invite", title: "3.) Freund zu Floralog einladen" },
            ].map((section) => {
              const isOpen = addFriendExpandedSection === section.id;
              return (
                <div key={section.id} className={`rounded-xl border ${!isLightUi ? "border-stone-700 bg-stone-900/20" : "border-stone-200 bg-stone-50/60"}`}>
                  <button
                    type="button"
                    onClick={() => setAddFriendExpandedSection((current) => current === section.id ? null : section.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-3 text-left ${!isLightUi ? "text-stone-100" : "text-stone-900"}`}
                  >
                    <span className="text-sm font-semibold">{section.title}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && section.id === "name" && (
                    <div className={`px-3 pb-3 border-t ${!isLightUi ? "border-stone-700" : "border-stone-200"}`}>
                      <div className="pt-3 space-y-3">
                        <Input
                          placeholder="Spielername suchen (Displayname)"
                          value={friendSearchQuery}
                          onChange={(e) => setFriendSearchQuery(e.target.value)}
                          className={`border-2 ${!isLightUi ? "border-stone-600 bg-stone-800/60 text-stone-100 placeholder:text-stone-500" : "border-stone-200"}`}
                        />

                        {friendSearchQuery.trim().length > 0 && (
                          <div className={`rounded-lg border p-2 max-h-56 overflow-y-auto ${!isLightUi ? "border-stone-700 bg-stone-900/40" : "border-stone-200 bg-stone-50/70"}`}>
                            {friendSearchQuery.trim().length < 2 ? (
                              <p className={`text-xs px-2 py-1 ${!isLightUi ? "text-stone-400" : "text-stone-500"}`}>
                                Bitte mindestens 2 Zeichen eingeben.
                              </p>
                            ) : friendSearchResults.length === 0 ? (
                              <p className={`text-xs px-2 py-1 ${!isLightUi ? "text-stone-400" : "text-stone-500"}`}>
                                Keine passenden Spieler gefunden.
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {friendSearchResults.map((result) => {
                                  const existingStatus = result.existingFriendship?.status || null;
                                  const isAccepted = existingStatus === "accepted";
                                  const isPending = existingStatus === "pending";
                                  const disabled = sendFriendRequestMutation.isPending || isAccepted || isPending;

                                  return (
                                    <div
                                      key={result.profile.id || `${result.authId || ""}:${result.email || ""}`}
                                      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${!isLightUi ? "border-stone-700" : "border-stone-200 bg-white"}`}
                                    >
                                      <div className="min-w-0">
                                        <p className={`text-sm font-medium truncate ${!isLightUi ? "text-stone-100" : "text-stone-900"}`}>
                                          {result.displayName}
                                        </p>
                                        <p className={`text-[11px] truncate ${!isLightUi ? "text-stone-400" : "text-stone-500"}`}>
                                          {result.email || "Keine E-Mail verfuegbar"}
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() => handleSendRequestToProfile(result)}
                                        disabled={disabled}
                                        className="h-8 px-2 bg-green-600 hover:bg-green-700"
                                      >
                                        {sendFriendRequestMutation.isPending ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : isAccepted ? (
                                          "Bereits Freund"
                                        ) : isPending ? (
                                          "Anfrage offen"
                                        ) : (
                                          <UserPlus className="w-3.5 h-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isOpen && section.id === "email" && (
                    <div className={`px-3 pb-3 border-t ${!isLightUi ? "border-stone-700" : "border-stone-200"}`}>
                      <div className="pt-3 space-y-2">
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
                            onClick={async () => {
                              const isSuccess = await handleSendRequest();
                              if (isSuccess) {
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
                    </div>
                  )}

                  {isOpen && section.id === "invite" && (
                    <div className={`px-3 pb-3 border-t ${!isLightUi ? "border-stone-700" : "border-stone-200"}`}>
                      <div className="pt-3 space-y-3">
                        <p className={`text-xs ${!isLightUi ? "text-stone-400" : "text-stone-600"}`}>
                          Erstelle einen Einladungslink und teile ihn per WhatsApp, SMS oder E-Mail
                        </p>
                        <div className={`rounded-xl border-2 p-4 ${!isLightUi ? "border-amber-500/40 bg-amber-500/10" : "border-amber-400/60 bg-amber-50"}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">🌟</span>
                            <h3 className={`text-sm font-bold ${!isLightUi ? "text-amber-300" : "text-amber-800"}`}>Freunde einladen & Belohnungen sichern</h3>
                          </div>
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
                  )}
                </div>
              );
            })}
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
