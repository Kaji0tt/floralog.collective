import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Query } from "@/api/entities";
import { createUserNotification } from "@/api/notificationService";
import { buildNotificationPayload } from "@/lib/story/storyDefinition";
import { supabase } from "@/api/supabaseClient";
import { sendFriendRequest, removeFriendship, respondToFriendRequest } from "@/api/friendService";
import { trackAction } from "@/api/analyticsService";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UserPlus, Users, Loader2, Check, X, Bell, UserMinus, Leaf, Trophy, Share2, Plus, Heart, UserCheck, BookOpenText, Clock, Newspaper, Send, ChevronDown, Handshake, ExternalLink, Gift, CheckCircle } from "lucide-react";
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
import { resolveTitleValue } from "@/lib/profileCustomizationOptions";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import HomeShellBorderGlow from "@/components/effects/HomeShellBorderGlow";
import { getRgbaFromRgb } from "@/lib/friendColorUtils";
import { getCurrentWeeklyQuest } from "@/components/quests/QuestRotationHelper";

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

const EXPLORER_PAGE_SIZE = 40;

// "2026-W28" (ISO week key from get_scan_of_the_week_history) → "KW 28 · 2026"
const formatSotwWeekLabel = (weekKey) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey || "");
  if (!match) return weekKey || "Unbekannte Woche";
  return `KW ${match[2]} · ${match[1]}`;
};

const normalizeNaturaDbSlug = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const buildExplorerNaturaDbUrl = (plant) => {
  if (plant?.naturadb_url) return plant.naturadb_url;
  const scientificName = plant?.scientific_name || plant?.aiData?.scientific_name;
  const slug = normalizeNaturaDbSlug(scientificName);
  return slug ? `https://www.naturadb.de/pflanzen/${slug}/` : "https://www.naturadb.de/pflanzen/";
};

const getExplorerEcoItems = (plant) => {
  if (!plant) return [];
  const r = (key) => {
    const v = plant?.[key] ?? plant?.aiData?.[key];
    return (v !== null && v !== undefined && v !== "") ? String(v) : null;
  };
  return [
    { label: "Wildbienen", value: r("wild_bees_count") },
    { label: "Schmetterlinge", value: r("butterflies_count") },
    { label: "Raupen", value: r("caterpillars_count") },
    { label: "Schwebfliegen", value: r("hoverflies_count") },
    { label: "Käfer", value: r("beetles_count") },
    { label: "Bestand", value: r("red_list_population") },
    { label: "Gefährdung", value: r("red_list_threat") },
    { label: "Nektarwert", value: r("nectar_value") },
    { label: "Pollenwert", value: r("pollen_value") },
  ].filter((c) => c.value !== null);
};

const EXPLORER_EVENT_SOURCE_LABELS = {
  new_global_scan:    { label: "Weltfund",    cls: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" },
  new_scan:           { label: "Erstfund",    cls: "border-sky-400/50 bg-sky-500/15 text-sky-200" },
  new_season_scan:    { label: "Saisonfund",  cls: "border-violet-400/50 bg-violet-500/15 text-violet-200" },
  season_rediscovery: { label: "Saison",      cls: "border-stone-400/40 bg-stone-500/10 text-stone-300" },
  scan:               { label: "Scan",        cls: "border-stone-400/40 bg-stone-500/10 text-stone-300" },
};

const getExplorerEventSourceMeta = (source) =>
  source ? (EXPLORER_EVENT_SOURCE_LABELS[source] ?? null) : null;

const EXPLORER_ZONE_THEME_LABELS = {
  forest:  { label: "🌲 Wald",   cls: "border-green-500/50 bg-green-500/20 text-green-200" },
  water:   { label: "🌊 Wasser", cls: "border-blue-400/50 bg-blue-500/20 text-blue-200" },
  urban:   { label: "🏙️ Urban",  cls: "border-amber-500/40 bg-amber-500/15 text-amber-200" },
  meadow:  { label: "🌸 Wiese",  cls: "border-lime-400/50 bg-lime-500/15 text-lime-200" },
};

const getExplorerZoneThemeMeta = (theme) =>
  theme ? (EXPLORER_ZONE_THEME_LABELS[theme] ?? null) : null;

const toNormalizedDexNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const resolveGenusForPlant = (plant, allGenera) => {
  if (!plant || !Array.isArray(allGenera) || allGenera.length === 0) return null;

  const genusById = plant.genus_id
    ? allGenera.find((genus) => genus.id === plant.genus_id)
    : null;
  if (genusById) return genusById;

  const plantCategory = String(plant.genus_category || "").trim().toLowerCase();
  const plantDexNumber = toNormalizedDexNumber(plant.genus_number);

  return allGenera.find((genus) => {
    const genusCategory = String(genus.category || "").trim().toLowerCase();
    if (plantCategory && genusCategory !== plantCategory) return false;

    const genusDexNumber = toNormalizedDexNumber(genus.category_dex_number);
    if (plantDexNumber !== null && genusDexNumber !== null) {
      return genusDexNumber === plantDexNumber;
    }

    return String(genus.category_dex_number || "").trim() === String(plant.genus_number || "").trim();
  }) || null;
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
  const _prevActiveTabRef = useRef(activeTab);
  useEffect(() => {
    if (activeTab !== _prevActiveTabRef.current) {
      trackAction(`social_tab_${activeTab}`, { sourcePage: "Social" });
      _prevActiveTabRef.current = activeTab;
    }
  }, [activeTab]);
  const [explorerViewMode, setExplorerViewMode] = useState(() =>
    searchParams.get("explorerView") === "sotw" ? "sotw" : "all"
  );
  const explorerSentinelRef = useRef(null);
  const explorerContainerRef = useRef(null);
  const explorerTouchStartYRef = useRef(0);
  const explorerPullingRef = useRef(false);
  const explorerThresholdReachedRef = useRef(false);
  const explorerSnapTimeoutRef = useRef(null);
  const [explorerPullOffset, setExplorerPullOffset] = useState(0);
  const [isExplorerPulling, setIsExplorerPulling] = useState(false);
  const [isExplorerRefreshing, setIsExplorerRefreshing] = useState(false);
  const [explorerSnapPulse, setExplorerSnapPulse] = useState(false);
  const [newsFilter, setNewsFilter] = useState("activities");
  const [expandedNewsIds, setExpandedNewsIds] = useState(new Set());
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const autoMarkingNewsRef = useRef(false);

  useEffect(() => {
    if (!embedded) return;
    if (openAddFriendDialogNonce > 0) {
      setActiveTab("friends");
      setShowAddFriendDialog(true);
    }
  }, [embedded, openAddFriendDialogNonce]);


  useEffect(() => {
    const allowedTabs = new Set(["friends", "achievements", "explorer"]);
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
      ['accepted'].includes(String(f.status || '').toLowerCase())
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
      ['pending'].includes(String(f.status || '').toLowerCase())
      );
    },
    enabled: !!user?.email && allFriendRecords.length > 0
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 60000, // 1 Minute Cache
    // Custom logo/avatar changes by other players must show up on re-entering this tab,
    // not just after a manual pull-to-refresh.
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: allPublicProfiles = [] } = useQuery({
    queryKey: ['allPublicProfiles'],
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 30000, // 30 Sekunden Cache
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Referrals, bei denen der aktuelle User der Werber ist (für Handshake-Markierung)
  const { data: myReferrals = [] } = useQuery({
    queryKey: ['myReferrals', user?.email],
    queryFn: () => Query.Referral.list(),
    enabled: !!user?.email,
    staleTime: 60000 // 1 Minute Cache
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
          "Unbekannt";
        const existingFriendship = getExistingFriendship(email, authId);
        return { profile, email, authId, displayName, existingFriendship };
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

  const { data: logoAssets = [] } = useQuery({
    queryKey: ['logoAssets'],
    queryFn: () => Query.LogoAsset.list(),
    staleTime: 60000,
  });

  const isExplorerTab = activeTab === "explorer";
  const isFriendsTab = activeTab === "friends";
  const isSotwView = explorerViewMode === "sotw";

  const explorerThresholdIso = '2026-06-21T00:00:00.000Z';
  const explorerQueryEmail = user?.email?.toLowerCase() || "";

  // Infinite-paginated explorer discoveries via RPC
  const {
    data: explorerPages,
    fetchNextPage: fetchNextExplorerPage,
    hasNextPage: hasNextExplorerPage,
    isFetchingNextPage: isFetchingNextExplorerPage,
    isLoading: isExplorerLoading,
    refetch: refetchExplorerDiscoveries,
  } = useInfiniteQuery({
    queryKey: ['explorerDiscoveriesInfinite', explorerQueryEmail, explorerThresholdIso],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase.rpc('get_explorer_discoveries', {
        p_viewer_email: explorerQueryEmail,
        p_audience: 'all',
        p_since: explorerThresholdIso,
        p_limit: EXPLORER_PAGE_SIZE,
        p_offset: pageParam * EXPLORER_PAGE_SIZE,
      });
      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < EXPLORER_PAGE_SIZE ? undefined : allPages.length,
    enabled: !!user?.email && isExplorerTab && !isSotwView,
    staleTime: 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,
  });

  const explorerDiscoveries = useMemo(
    () => (explorerPages?.pages ?? []).flatMap((page) => page),
    [explorerPages]
  );

  // Separate query for friends tab last-activity lookup (no dedup needed)
  const { data: friendActivityDiscoveries = [] } = useQuery({
    queryKey: ['friendActivityDiscoveries'],
    queryFn: async () => {
      const discoveries = await Query.UserPlantDiscovery.list('-discovered_date', 600);
      return discoveries;
    },
    enabled: !!user?.email && isFriendsTab,
    staleTime: 2 * 60 * 1000,
  });

  const { data: scanLikes = [] } = useQuery({
    queryKey: ['scanLikesAll'],
    queryFn: () => Query.ScanLike.list('-created_date', 2000),
    enabled: !!user?.email,
    staleTime: 60 * 1000,
  });

  // Lade nur die Plants, die in den aktuell geladenen Discoveries tatsächlich vorkommen,
  // statt der kompletten (1800+ Zeilen) Plant-Tabelle.
  const explorerPlantIds = useMemo(
    () => explorerDiscoveries.map((d) => d.plant_id).filter(Boolean),
    [explorerDiscoveries]
  );
  const friendActivityPlantIds = useMemo(
    () => friendActivityDiscoveries.map((d) => d.plant_id).filter(Boolean),
    [friendActivityDiscoveries]
  );
  const neededPlantIds = useMemo(
    () => [...new Set([...explorerPlantIds, ...friendActivityPlantIds])],
    [explorerPlantIds, friendActivityPlantIds]
  );

  const { data: allPlants = [] } = useQuery({
    queryKey: ['allPlants', neededPlantIds],
    queryFn: () => Query.Plant.filter({ id: neededPlantIds }),
    enabled: neededPlantIds.length > 0,
  });

  // Lade alle Genera (für genus_id-Auflösung in Social Feed Deeplinks)
  const { data: allGenera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
    staleTime: 10 * 60 * 1000,
  });

  // ── Explorer reward enrichment queries ─────────────────────────────────────

  const { data: weeklyQuestsForExplorer = [] } = useQuery({
    queryKey: ['weeklyQuestsForExplorer'],
    queryFn: () => Query.WeeklyQuest.list('quest_number'),
    staleTime: 10 * 60 * 1000,
    enabled: isExplorerTab,
  });

  const explorerDiscoveryIds = useMemo(
    () => (explorerDiscoveries || []).map((d) => d.id).filter(Boolean),
    [explorerDiscoveries]
  );

  const { data: ownRewardsForExplorer = [] } = useQuery({
    queryKey: ['explorerRewardUnlocks', explorerDiscoveryIds],
    queryFn: async () => {
      if (!explorerDiscoveryIds.length) return [];
      const { data, error } = await supabase.rpc('get_explorer_reward_unlocks', {
        p_discovery_ids: explorerDiscoveryIds,
      });
      if (error) { console.warn('[ExplorerFeed] reward unlocks RPC failed:', error); return []; }
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: explorerDiscoveryIds.length > 0 && isExplorerTab,
  });

  const { data: explorerScanRewards = [] } = useQuery({
    queryKey: ['explorerScanRewards', explorerDiscoveryIds],
    queryFn: async () => {
      if (!explorerDiscoveryIds.length) return [];
      const { data, error } = await supabase.rpc('get_explorer_scan_rewards', {
        p_discovery_ids: explorerDiscoveryIds,
      });
      if (error) { console.warn('[ExplorerFeed] scan rewards RPC failed:', error); return []; }
      return data || [];
    },
    enabled: !!user && explorerDiscoveryIds.length > 0 && isExplorerTab,
    staleTime: 5 * 60 * 1000,
  });

  const scanRewardByDiscoveryId = useMemo(
    () => new Map((explorerScanRewards || []).map((r) => [r.discovery_id, r])),
    [explorerScanRewards]
  );

  const currentWeeklyQuestForExplorer = useMemo(
    () => getCurrentWeeklyQuest(weeklyQuestsForExplorer),
    [weeklyQuestsForExplorer]
  );

  const rewardUnlockByDiscoveryId = useMemo(
    () => new Map((ownRewardsForExplorer || []).map((r) => [r.discovery_id, r])),
    [ownRewardsForExplorer]
  );

  // "SOTW" filter: staggered (per-week) history of Scan-of-the-Week winners,
  // i.e. every past weeklyRewardsScheduler "most liked scan" grant plus manual
  // AdminScanOfTheWeek awards, since the mechanic exists.
  const { data: sotwHistory = [], isLoading: isSotwLoading } = useQuery({
    queryKey: ['scanOfTheWeekHistory'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_scan_of_the_week_history', { p_limit: 300 });
      if (error) { console.warn('[ExplorerFeed] SOTW history RPC failed:', error); return []; }
      return data || [];
    },
    enabled: !!user?.email && isExplorerTab && isSotwView,
    staleTime: 5 * 60 * 1000,
  });

  const sotwWeekGroups = useMemo(() => {
    const groups = new Map();
    for (const row of sotwHistory) {
      const key = row.week_key || "—";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [sotwHistory]);

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
    queryFn: () => Query.Achievement.list('achievement_number')
  });

  // Lade eigene Achievements des aktuellen Users
  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', user?.id],
    queryFn: () => Query.UserAchievement.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
  });

  // Lade Belohnungen/Rewards für Titel
  const { data: rewards = [] } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Query.Reward.list(),
  });

  const sortedAchievements = useMemo(() => {
    return [...achievements].sort((a, b) => (a.achievement_number || 0) - (b.achievement_number || 0));
  }, [achievements]);

  const unlockedCount = useMemo(() => {
    return achievements.filter((a) => userAchievements.some((ua) => ua.achievement_id === a.id)).length;
  }, [achievements, userAchievements]);

  const updateTitleMutation = useMutation({
    mutationFn: (title) => updateCurrentUserProfile({ selected_title: title }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['shopCurrentUser'] });
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setShowTitleDialog(false);
    }
  });

  const handleSelectTitle = (achievement, reward) => {
    setSelectedAchievement({ ...achievement, selectedReward: reward });
    setShowTitleDialog(true);
  };

  const confirmTitleSelection = () => {
    const normalizedTitle = resolveTitleValue(
      selectedAchievement?.selectedReward?.value,
      selectedAchievement?.selectedReward?.display_name
    );
    if (normalizedTitle) {
      updateTitleMutation.mutate(normalizedTitle);
    }
  };

  const sendFriendRequestMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) {
        throw new Error("Bitte warte bis dein Profil geladen ist.");
      }

      const targetEmail = friendEmail?.trim();
      if (!targetEmail) {
        throw new Error("Bitte gib eine E-Mail-Adresse ein.");
      }

      const myEmail = user.email.toLowerCase();
      const friendEmailLower = targetEmail.toLowerCase();

      // Prüfe ob bereits eine Freundschaft existiert (in BEIDE Richtungen!)
      const existingFriendship = allFriendRecords.find((f) =>
        (f.request_sent_by?.toLowerCase() === myEmail && f.request_sent_to?.toLowerCase() === friendEmailLower) ||
        (f.request_sent_by?.toLowerCase() === friendEmailLower && f.request_sent_to?.toLowerCase() === myEmail)
      );

      if (existingFriendship) {
        if (existingFriendship.status === "accepted") {
          throw new Error("Ihr seid bereits befreundet!");
        }

        if (existingFriendship.request_sent_by?.toLowerCase() === myEmail) {
          throw new Error("Du hast dieser Person bereits eine Anfrage gesendet!");
        }

        throw new Error("Diese Person hat dir bereits eine Anfrage gesendet! Akzeptiere sie im Tab 'Anfragen'.");
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
          ...buildNotificationPayload("friendRequestReceived", { senderName }),
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
      await queryClient.invalidateQueries({ queryKey: ['friends'] });
      await queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests'] });
      await queryClient.refetchQueries({ queryKey: ['allFriendRecords'] });

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
          ...buildNotificationPayload("friendshipAccepted", { accepterName }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allFriendRecords'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests'] });
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
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['partnerPendingRelations'] });
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
        // genus_id über genus_category + genus_number auflösen, da Plant-Tabelle kein genus_id hat
        const matchedGenus = resolveGenusForPlant(entry.plant, allGenera);
        const likeGenusId = matchedGenus?.id || null;
        const actionParams = new URLSearchParams();
        if (likeGenusId) actionParams.set("id", likeGenusId);
        if (entry.actorEmail) actionParams.set("email", entry.actorEmail);
        actionParams.set("discoveryId", entry.id);

        await Promise.allSettled([
          createUserNotification({
            authId: entry.actorAuthId || null,
            userEmail: entry.actorEmail || null,
            notificationType: "scan_liked",
            ...buildNotificationPayload("scanLiked", {
              likerName,
              plantNameOptional: entry.plant?.species_name || "",
            }),
            actionUrl: likeGenusId
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

  const openExplorerDiscoveryInFriendCollection = useCallback((entry) => {
    const plant = entry?.plant;
    const plantId = plant?.id || entry?.plant_id || entry?.discovery?.plant_id;
    if (!plant && !plantId) return;

    const matchedGenus = resolveGenusForPlant(plant, allGenera);
    const genusId = matchedGenus?.id || null;

    if (!genusId) {
      if (!plantId) return;
      navigate(createPageUrl(`PlantDetail?id=${encodeURIComponent(plantId)}`));
      return;
    }

    const params = new URLSearchParams();
    params.set("id", genusId);
    if (entry.actorEmail) params.set("email", entry.actorEmail);
    params.set("collectionId", "global");
    params.set("discoveryId", entry.id);
    navigate(createPageUrl(`GenusDetail?${params.toString()}`));
  }, [navigate, allGenera]);

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
    const friendDiscoveries = friendActivityDiscoveries.filter((d) => matchesFriend(d));
    console.log(`📦 ${friendDiscoveries.length} Discoveries gefunden`);

    const validSortedDiscoveries = friendDiscoveries
      .map((d) => ({
        row: d,
        date: parseActivityDate(d.discovered_date)
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
        "Unbekannt",
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
  // E-Mails der Spieler, die der aktuelle User selbst eingeladen (geworben) hat
  const invitedEmailSet = useMemo(() => {
    const ownEmail = user?.email?.toLowerCase() || "";
    const ownAuthId = String(user?.id || "");
    if (!ownEmail && !ownAuthId) return new Set();
    return new Set(
      (myReferrals || [])
        .filter((referral) => {
          const refAuthId = String(referral?.referrer_auth_id || "").trim();
          const refEmail = String(referral?.referrer_email || "").trim().toLowerCase();
          return (refAuthId && refAuthId === ownAuthId) || (ownEmail && refEmail === ownEmail);
        })
        .map((referral) => String(referral?.referred_email || "").trim().toLowerCase())
        .filter(Boolean)
    );
  }, [myReferrals, user?.email]);

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
      name: friendProfile?.display_name || friendProfile?.full_name || friendUser?.display_name || friendUser?.full_name || "Unbekannt",
      logoAssets: resolveEquippedLogoAssetsWithCatalog(friendProfile || friendUser || {}, logoAssets),
      level: friendProfile?.level || friendUser?.level || 1,
      title: friendProfile?.selected_title || friendProfile?.title || friendUser?.selected_title || friendUser?.title || "Pflanzen-Anfänger",
      lastActivity,
      invitedByMe: invitedEmailSet.has(String(friendEmail || "").trim().toLowerCase())
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

  const recentDiscoveries = useMemo(() => explorerDiscoveries || [], [explorerDiscoveries]);

  const explorerLogEntries = useMemo(() => {
    return recentDiscoveries.map((entry) => {
      const entryEmail = getDiscoveryEmailLower(entry);
      const plant = allPlants.find((p) => p.id === entry.plant_id);
      const profile = profileByEmail.get(entryEmail);
      return {
        id: entry.id,
        discovery: entry,
        plant,
        actorEmail: entryEmail,
        actorAuthId: profile?.auth_id || entry.auth_id || null,
        actorName: profile?.display_name || profile?.full_name || "Unbekannt",
        actorLogoAssets: resolveEquippedLogoAssetsWithCatalog(profile || {}, logoAssets),
        actorBackgroundUrl: profile?.background_image_url || null,
        actorBackgroundColor: profile?.background_color || null,
        actorBorderColor: profile?.selected_border_color || '#C7AF8B',
        actorProfileEffect: profile?.selected_profile_effect || null,
        scanCount: 1,
        likedByCurrentUser: likedDiscoveryIdSet.has(entry.id),
        likeCount: likeCountByDiscoveryId.get(entry.id) || 0,
        timestamp: new Date(entry.discovered_date || Date.now()),
        // Reward enrichment
        seedAmount: scanRewardByDiscoveryId.get(entry.id)?.seed_amount ?? null,
        zoneTheme: scanRewardByDiscoveryId.get(entry.id)?.zone_theme ?? null,
        eventSource: scanRewardByDiscoveryId.get(entry.id)?.event_source ?? null,
        isWeeklyQuestPlant: (() => {
          const q = currentWeeklyQuestForExplorer;
          if (!plant || !q) return false;
          if (q.target_species_name) return plant.species_name === q.target_species_name;
          if (q.target_genus_name) {
            const genus = resolveGenusForPlant(plant, allGenera);
            return genus?.genus_name === q.target_genus_name;
          }
          if (q.category && q.category !== 'Alle') return plant.genus_category === q.category;
          return false;
        })(),
        rewardUnlocked: rewardUnlockByDiscoveryId.get(entry.id) || null,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentDiscoveries, allPlants, allGenera, profileByEmail, likedDiscoveryIdSet, likeCountByDiscoveryId, logoAssets, scanRewardByDiscoveryId, currentWeeklyQuestForExplorer, rewardUnlockByDiscoveryId]);

  useEffect(() => {
    if (!isExplorerTab || !hasNextExplorerPage) return;
    const sentinel = explorerSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextExplorerPage) {
          fetchNextExplorerPage();
        }
      },
      { rootMargin: "0px 0px 300px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isExplorerTab, hasNextExplorerPage, isFetchingNextExplorerPage, fetchNextExplorerPage]);

  const PULL_TO_REFRESH_THRESHOLD = 84;

  const clearExplorerSnapTimeout = useCallback(() => {
    if (explorerSnapTimeoutRef.current) {
      clearTimeout(explorerSnapTimeoutRef.current);
      explorerSnapTimeoutRef.current = null;
    }
  }, []);

  const resetExplorerPullState = useCallback(() => {
    clearExplorerSnapTimeout();
    explorerPullingRef.current = false;
    explorerThresholdReachedRef.current = false;
    setIsExplorerPulling(false);
    setExplorerPullOffset(0);
    setExplorerSnapPulse(false);
  }, [clearExplorerSnapTimeout]);

  const triggerExplorerRefresh = useCallback(() => {
    setIsExplorerRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ['scanLikesAll'] });
    queryClient.invalidateQueries({ queryKey: ['allPlants'] });
    queryClient.invalidateQueries({ queryKey: ['allPublicProfiles'] });
    queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    refetchExplorerDiscoveries().finally(() => {
      setIsExplorerRefreshing(false);
      resetExplorerPullState();
    });
  }, [refetchExplorerDiscoveries, queryClient, resetExplorerPullState]);

  const handleExplorerTouchStart = useCallback((e) => {
    const container = explorerContainerRef.current;
    if (!container || container.scrollTop !== 0) return;
    explorerTouchStartYRef.current = e.touches[0].clientY;
    explorerPullingRef.current = true;
  }, []);

  const handleExplorerTouchMove = useCallback((e) => {
    if (!explorerPullingRef.current) return;
    const deltaY = e.touches[0].clientY - explorerTouchStartYRef.current;
    if (deltaY <= 0) { resetExplorerPullState(); return; }
    const dampedOffset = Math.min(120, deltaY * 0.45);
    setIsExplorerPulling(true);
    setExplorerPullOffset(dampedOffset);
    const reached = dampedOffset >= PULL_TO_REFRESH_THRESHOLD;
    if (reached !== explorerThresholdReachedRef.current) {
      explorerThresholdReachedRef.current = reached;
      if (reached) { setExplorerSnapPulse(true); clearExplorerSnapTimeout(); explorerSnapTimeoutRef.current = setTimeout(() => setExplorerSnapPulse(false), 300); }
    }
  }, [resetExplorerPullState, clearExplorerSnapTimeout]);

  const handleExplorerTouchEnd = useCallback(() => {
    if (!explorerPullingRef.current) return;
    if (explorerThresholdReachedRef.current) {
      triggerExplorerRefresh();
    } else {
      resetExplorerPullState();
    }
  }, [triggerExplorerRefresh, resetExplorerPullState]);

  useEffect(() => {
    return () => clearExplorerSnapTimeout();
  }, [clearExplorerSnapTimeout]);

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

  const achievementUnlockedCardClass = isLightUi
    ? "border-amber-300 bg-gradient-to-br from-white/90 to-amber-50/90 backdrop-blur-md hover:shadow-md"
    : "border-[#f0e5a5]/40 bg-gradient-to-br from-[#2d2418]/90 via-[#1c1710]/88 to-[#12100b]/92 backdrop-blur-md hover:shadow-[0_8px_20px_rgba(0,0,0,0.35)]";
  const achievementLockedCardClass = isLightUi
    ? "border-stone-200 bg-stone-50/80 backdrop-blur-sm opacity-60"
    : "border-[#f0e5a5]/25 bg-black/35 backdrop-blur-sm opacity-70";
  const achievementTitleClass = isLightUi ? "text-stone-900" : "text-stone-100";
  const achievementMutedTextClass = isLightUi ? "text-stone-600" : "text-stone-300/90";
  const achievementLockedTitleClass = isLightUi ? "text-stone-500" : "text-stone-400/75";
  const achievementLockedMutedTextClass = isLightUi ? "text-stone-400" : "text-stone-500/75";
  const achievementRewardClass = isLightUi
    ? "bg-amber-50 text-amber-700"
    : "bg-amber-400/10 text-amber-200";
  const achievementLockedRewardClass = isLightUi
    ? "bg-stone-100 text-stone-400"
    : "bg-stone-700/35 text-stone-400";
  const achievementsContentClass = embedded ? "mt-0 px-2 pb-20 flex-1 min-h-0 overflow-y-auto overflow-x-hidden" : "pt-36 px-2 pb-4";

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case "Ungewöhnlich": return "bg-green-500";
      case "Selten": return "bg-blue-500";
      case "Episch": return "bg-purple-500";
      case "Legendär": return "bg-amber-500";
      default: return "bg-gray-500";
    }
  };

  const moduleChips = [
    {
      id: "explorer",
      title: "Forscher Log",
      active: explorerLogEntries.length,
      total: explorerLogEntries.length,
    },
    {
      id: "achievements",
      title: "Erfolge",
      active: unlockedCount,
      total: achievements.length,
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
      title: activeTab === "friends" ? "Social" : activeTab === "achievements" ? "Erfolge" : "Forscher Log",
      subtitle: activeTab === "explorer" ? "Scans der letzten 30 Tage" : activeTab === "achievements" ? "Dein Fortschritt im Überblick" : "Dein Freundesbereich",
    });
  }, [
    embedded,
    onHeaderMetaChange,
    activeTab,
  ]);

  const explorerFilterHeaderNode = (
    <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-start md:justify-between">
      <div>
        <div className={`flex items-center gap-2 ${titleTextClass}`}>
          <BookOpenText className={`w-4 h-4 ${isLightUi ? "text-emerald-700" : "text-emerald-300"}`} />
          <h3 className="text-base font-semibold">Forscher Log</h3>
        </div>
        <p className={`text-sm mt-1 ${bodyTextClass}`}>
          {isSotwView
            ? "Wochenliebling: die meistgelikten Scans der Community. Scan der Woche: die vom Team gekürten Scans. Gestaffelt nach Kalenderwoche."
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
            { id: "sotw", label: "Community" },
          ].map((option) => {
            const isSelected = explorerViewMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setExplorerViewMode(option.id)}
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
        <Badge className={accentBadgeClass}>
          {isSotwView ? sotwHistory.length : explorerLogEntries.length}{!isSotwView && hasNextExplorerPage ? "+" : ""}
        </Badge>
      </div>
    </div>
  );

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
                      {activeTab === "friends" ? "Social" : activeTab === "achievements" ? "Erfolge" : "Forscher Log"}
                    </h1>
                    <p className="text-xs text-stone-600 truncate">
                      {activeTab === "explorer" ? "Scans aus den letzten 30 Tagen" : activeTab === "achievements" ? "Dein Fortschritt im Überblick" : "Dein Freundesbereich"}
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
                      {activeTab === "friends" ? `${friends.length} Freunde` : activeTab === "achievements" ? `${unlockedCount} / ${achievements.length}` : `${explorerLogEntries.length} Eintraege`}
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
          >
            <div
              style={{
                transform: `translateY(${explorerPullOffset}px)`,
                transition: isExplorerPulling ? 'none' : 'transform 0.3s ease',
              }}
            >
            {(isExplorerRefreshing || (explorerPullOffset > 0)) && (
              <div className={`flex justify-center py-2 ${isLightUi ? "text-stone-400" : "text-stone-500"}`}>
                <Loader2 className={`w-5 h-5 ${isExplorerRefreshing ? "animate-spin" : ""}`} />
              </div>
            )}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-5xl mx-auto space-y-4"
              style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}
            >
              {isSotwView ? (
                isSotwLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className={`w-8 h-8 animate-spin ${isLightUi ? "text-stone-400" : "text-stone-500"}`} />
                  </div>
                ) : (
                  <section className={`${sectionSurfaceClass} p-4 md:p-5`}>
                    {explorerFilterHeaderNode}
                    {sotwWeekGroups.length === 0 ? (
                      <div className="px-1 py-8 text-center">
                        <Trophy className={`w-14 h-14 mx-auto mb-3 ${isLightUi ? "text-stone-300" : "text-stone-500"}`} />
                        <p className={`text-sm ${bodyTextClass}`}>
                          Der wöchentlich gekürte Scan der Community erscheint hier, sobald es einen gibt.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {sotwWeekGroups.map(([weekKey, rows]) => (
                          <div key={weekKey}>
                            <div className={`flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>
                              <Trophy className="w-3.5 h-3.5 text-amber-400" />
                              {formatSotwWeekLabel(weekKey)}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {rows.map((row) => {
                                const isCommunityPick = row.source === "scheduler";
                                return (
                                <Card
                                  key={row.ledger_id}
                                  className={`${nestedCardClass} ${interactiveHoverClass} transition-all overflow-hidden`}
                                >
                                  <div className="relative" style={{ aspectRatio: "4/3" }}>
                                    {row.image_url ? (
                                      <img
                                        src={row.image_url}
                                        alt={row.plant_species_name || "Scan"}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className={`w-full h-full flex items-center justify-center ${isLightUi ? "bg-gradient-to-br from-amber-50 to-stone-100" : "bg-gradient-to-br from-amber-500/10 to-stone-950/60"}`}>
                                        {isCommunityPick ? (
                                          <Heart className={`w-10 h-10 ${isLightUi ? "text-rose-400" : "text-rose-300"}`} />
                                        ) : (
                                          <Trophy className={`w-10 h-10 ${isLightUi ? "text-amber-500" : "text-amber-300"}`} />
                                        )}
                                      </div>
                                    )}
                                    {isCommunityPick ? (
                                      <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border border-rose-400/60 bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                                        <Heart className="w-3 h-3 fill-current" />
                                        Wochenliebling
                                      </div>
                                    ) : (
                                      <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-stone-950">
                                        <Trophy className="w-3 h-3" />
                                        Scan der Woche
                                      </div>
                                    )}
                                  </div>
                                  <CardContent className="p-3 space-y-1.5">
                                    <p className={`text-sm font-bold leading-tight truncate ${titleTextClass}`}>
                                      {row.plant_species_name || "Unbekannte Pflanze"}
                                    </p>
                                    <div className={`flex items-center justify-between text-[10px] ${mutedTextClass}`}>
                                      <span className="font-medium truncate">{row.actor_name}</span>
                                      <span>{formatDistanceToNow(new Date(row.awarded_at), { addSuffix: true, locale: de })}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isLightUi ? "border-amber-400/60 bg-amber-50 text-amber-700" : "border-amber-400/50 bg-amber-500/15 text-amber-300"}`}>
                                        ⚡ {row.sparks_amount} Funken
                                      </span>
                                      {row.like_count !== null && row.like_count !== undefined && (
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${isLightUi ? "border-rose-300 text-rose-600" : "border-rose-400/50 text-rose-300"}`}>
                                          <Heart className="w-3 h-3 fill-current" /> {row.like_count}
                                        </span>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )
              ) : isExplorerLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className={`w-8 h-8 animate-spin ${isLightUi ? "text-stone-400" : "text-stone-500"}`} />
                </div>
              ) : explorerLogEntries.length === 0 ? (
                <div className={`${sectionSurfaceClass} px-5 py-10 text-center`}>
                  <BookOpenText className={`w-16 h-16 mx-auto mb-4 ${isLightUi ? "text-stone-300" : "text-stone-500"}`} />
                  <p className={`text-lg font-semibold mb-2 ${titleTextClass}`}>
                      Noch kein Forscher-Log
                  </p>
                  <p className={bodyTextClass}>
                    Scans aller Spieler erscheinen hier.
                  </p>
                </div>
              ) : (
                <>
                <section className={`${sectionSurfaceClass} p-4 md:p-5`}>
                  {explorerFilterHeaderNode}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {explorerLogEntries.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(index, 10) * 0.02 }}
                    >
                      <Card
                        className={`${nestedCardClass} ${interactiveHoverClass} transition-all overflow-hidden relative`}
                        style={{
                          border: `1px solid ${entry.actorBorderColor}55`,
                          ...(entry.actorBackgroundColor && !entry.actorBackgroundUrl
                            ? { background: `linear-gradient(160deg, ${getRgbaFromRgb(entry.actorBackgroundColor, 0.55)} 0%, ${getRgbaFromRgb(entry.actorBackgroundColor, 0.28)} 100%)` }
                            : {}),
                        }}
                      >
                        {/* Profile background image */}
                        {entry.actorBackgroundUrl && (
                          <div
                            className="absolute inset-0 z-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${entry.actorBackgroundUrl})` }}
                          />
                        )}
                        {/* Readability scrim – stronger so text stays legible */}
                        {(entry.actorBackgroundUrl || entry.actorBackgroundColor) && (
                          <div className="absolute inset-0 z-0 bg-black/55" />
                        )}
                        {/* Border glow effect */}
                        {entry.actorProfileEffect === "shell_border_glow" && (
                          <HomeShellBorderGlow active particleCount={5} />
                        )}
                        {/* Header bar – 2-column: plant names (left) + logo (right) */}
                        <div className="relative z-10 px-3 pt-3 pb-1 flex items-center gap-2">
                          {/* Left: plant names */}
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              className="text-left w-full"
                              onClick={() => openExplorerDiscoveryInFriendCollection(entry)}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <p className={`text-sm font-bold leading-tight truncate ${titleTextClass}`}>
                                {entry.plant?.species_name || "Unbekannte Pflanze"}
                              </p>
                              {(entry.plant?.scientific_name || entry.plant?.aiData?.scientific_name) && (
                                <p className={`text-[10px] italic truncate mt-0.5 ${mutedTextClass}`}>
                                  {entry.plant.scientific_name || entry.plant.aiData?.scientific_name}
                                </p>
                              )}
                            </button>
                            {(entry.plant?.scientific_name || entry.plant?.aiData?.scientific_name) && (
                              <div className="flex items-center gap-1 min-w-0 mt-0.5">
                                <a
                                  href={buildExplorerNaturaDbUrl(entry.plant)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className={`flex-shrink-0 transition-colors ${isLightUi ? "text-stone-400 hover:text-amber-600" : "text-stone-500 hover:text-amber-300"}`}
                                  aria-label="NaturaDB öffnen"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            )}
                          </div>
                          {/* Right: custom logo – clickable to profile */}
                          <button
                            type="button"
                            className={`flex-shrink-0 transition-opacity ${entry.actorEmail && entry.actorEmail !== ownEmailLower ? "hover:opacity-80" : "cursor-default"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (entry.actorEmail && entry.actorEmail !== ownEmailLower) {
                                navigate(createPageUrl(`FriendProfile?email=${entry.actorEmail}`));
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <div className="w-11 h-11">
                              <CustomLogoAvatar
                                logoAssets={entry.actorLogoAssets}
                                className="w-full h-full"
                                fallbackText={entry.actorName?.charAt(0)?.toUpperCase() || "?"}
                                fallbackClassName="text-sm font-bold text-white"
                                noClip
                              />
                            </div>
                          </button>
                        </div>
                        {/* Scan image – padded so background is visible at edges */}
                        <div className="relative z-10 px-2 pt-2">
                          <button
                            type="button"
                            className="block w-full relative overflow-hidden rounded-xl"
                            style={{ aspectRatio: "4/3", border: `1px solid ${entry.actorBorderColor}66` }}
                            onClick={() => openExplorerDiscoveryInFriendCollection(entry)}
                          >
                            {entry.discovery?.image_url ? (
                              <img
                                src={entry.discovery.image_url}
                                alt={entry.plant?.species_name || "Scan"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center ${isLightUi ? "bg-gradient-to-br from-emerald-50 to-stone-100" : "bg-gradient-to-br from-emerald-500/10 to-stone-950/60"}`}>
                                <Leaf className={`w-10 h-10 ${isLightUi ? "text-emerald-500" : "text-emerald-300"}`} />
                              </div>
                            )}
                            {/* Vignette – black-to-transparent at all edges for 3D depth */}
                            <div
                              className="absolute inset-0 pointer-events-none rounded-xl"
                              style={{
                                boxShadow: "inset 0 0 32px 8px rgba(0,0,0,0.72)",
                              }}
                            />
                            {/* Bottom gradient – subtle vignette at bottom */}
                            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                          </button>
                        </div>
                        <CardContent className="p-3 space-y-2 relative z-10">
                          {/* Seeds row: [Samen] ... [Zone] [Pflanze der Woche] [Erstfund/Weltfund/...] */}
                          {entry.seedAmount !== null ? (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-base font-bold text-amber-300">{entry.seedAmount}</span>
                                <span className={`text-[10px] ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>Samen</span>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                {getExplorerZoneThemeMeta(entry.zoneTheme) && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${getExplorerZoneThemeMeta(entry.zoneTheme).cls}`}>
                                    {getExplorerZoneThemeMeta(entry.zoneTheme).label}
                                  </span>
                                )}
                                {entry.isWeeklyQuestPlant && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-violet-400/70 bg-violet-500/35 text-violet-200 font-semibold whitespace-nowrap">
                                    🌿 Pflanze der Woche
                                  </span>
                                )}
                                {getExplorerEventSourceMeta(entry.eventSource) && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${getExplorerEventSourceMeta(entry.eventSource).cls}`}>
                                    {getExplorerEventSourceMeta(entry.eventSource).label}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className={`text-[10px] ${mutedTextClass}`}>— Keine Belohnungsdaten —</div>
                              {entry.isWeeklyQuestPlant && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-violet-400/70 bg-violet-500/35 text-violet-200 font-semibold whitespace-nowrap">
                                  🌿 Pflanze der Woche
                                </span>
                              )}
                            </div>
                          )}
                          {/* Reward unlocked (own or friend) */}
                          {entry.rewardUnlocked && (
                            <div className="flex items-center gap-1.5 rounded-lg px-2 py-1 bg-amber-500/15 border border-amber-400/30">
                              <span className="text-[10px]">🎁</span>
                              <span className={`text-[10px] font-medium truncate ${isLightUi ? "text-amber-700" : "text-amber-200"}`}>
                                {entry.rewardUnlocked.reward_name} freigeschaltet
                              </span>
                            </div>
                          )}
                          <div className={`flex items-center justify-between text-[10px] ${mutedTextClass}`}>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span className="font-medium">{entry.actorName}</span>
                              <span>{formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: de })}</span>
                            </span>
                            {entry.actorEmail && entry.actorEmail !== ownEmailLower ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleExplorerLike(entry, !entry.likedByCurrentUser); }}
                                onMouseDown={(e) => e.stopPropagation()}
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
                              <span className={faintTextClass}>Saison 2026</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
                {/* Infinite scroll sentinel */}
                <div ref={explorerSentinelRef} className="h-px" />
                </section>
              {isFetchingNextExplorerPage && (
                <div className={`flex justify-center py-3 ${isLightUi ? "text-stone-400" : "text-stone-500"}`}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
                </>
              )}
            </motion.div>
            </div>
          </TabsContent>

          {/* Achievements Tab Content */}
          <TabsContent value="achievements" className={achievementsContentClass} style={embeddedContentMaskStyle}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-6xl mx-auto space-y-4"
              style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}
            >
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {sortedAchievements.map((achievement, index) => {
                  const isUnlocked = userAchievements.some((ua) => ua.achievement_id === achievement.id);
                  const achievementReward = achievement.reward_name ? rewards.find((r) => r.name === achievement.reward_name) : null;
                  const rewardTitleValue = resolveTitleValue(achievementReward?.value, achievementReward?.display_name);
                  const isCurrentTitle = achievementReward?.type === 'title' && resolveTitleValue(user?.selected_title) === rewardTitleValue;

                  return (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card className={`border shadow-sm transition-all duration-300 ${isUnlocked ? achievementUnlockedCardClass : achievementLockedCardClass}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <div className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-30'} flex-shrink-0`}>
                              {achievement.icon_emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-1">
                                <Badge className={`${getRarityColor(achievement.rarity)} text-white font-semibold text-[10px] px-1 py-0`}>
                                  {achievement.rarity}
                                </Badge>
                                {isUnlocked && <Trophy className="w-3 h-3 text-amber-500" />}
                              </div>
                              <h3 className={`text-sm font-bold mb-1 ${isUnlocked ? achievementTitleClass : achievementLockedTitleClass}`}>
                                {achievement.title}
                              </h3>
                              <p className={`text-xs mb-1 ${isUnlocked ? achievementMutedTextClass : achievementLockedMutedTextClass}`}>
                                {achievement.description}
                              </p>

                              {achievementReward && (
                                <div className={`flex items-center gap-1 text-xs mt-2 px-2 py-1 rounded-lg ${isUnlocked ? achievementRewardClass : achievementLockedRewardClass}`}>
                                  <Gift className="w-3 h-3" />
                                  <span className="font-semibold">{achievementReward.display_name}</span>
                                </div>
                              )}

                              {achievementReward && achievementReward.type === 'title' && isUnlocked && (
                                <Button
                                  onClick={() => handleSelectTitle(achievement, achievementReward)}
                                  disabled={isCurrentTitle || updateTitleMutation.isPending}
                                  className={`w-full text-[10px] h-6 mt-1 ${isCurrentTitle ? 'bg-green-600 hover:bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                                  size="sm"
                                >
                                  {isCurrentTitle ? (
                                    <>
                                      <CheckCircle className="w-2.5 h-2.5 mr-1" />
                                      Aktiv
                                    </>
                                  ) : (
                                    `Titel: ${rewardTitleValue}`
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}

                {sortedAchievements.length === 0 && (
                  <Card className={`border-2 backdrop-blur-md ${isLightUi ? "border-stone-200 bg-white/80" : "border-[#f0e5a5]/25 bg-black/35"}`}>
                    <CardContent className="p-12 text-center">
                      <Trophy className={`w-16 h-16 mx-auto mb-4 ${isLightUi ? "text-stone-400" : "text-stone-500"}`} />
                      <h3 className={`text-xl font-bold mb-2 ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
                        Noch keine Erfolge verfügbar
                      </h3>
                    </CardContent>
                  </Card>
                )}
              </div>
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
                              {friendData.invitedByMe && (
                                <span
                                  title="Von dir eingeladen"
                                  aria-label="Von dir eingeladen"
                                  className={`flex-shrink-0 inline-flex items-center justify-center ${isLightUi ? "text-emerald-600" : "text-emerald-300"}`}
                                >
                                  <Handshake className="w-4 h-4" />
                                </span>
                              )}
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

      {/* Title Selection Dialog */}
      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent className={!isLightUi ? "bg-[#1a1d1a] border-[#f0e5a5]/20" : ""}>
          <DialogHeader>
            <DialogTitle className={!isLightUi ? "text-stone-100" : ""}>Titel ausrüsten</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className={`mb-4 ${!isLightUi ? "text-stone-300" : "text-stone-700"}`}>
              Möchtest du den Titel <strong className={!isLightUi ? "text-purple-300" : "text-purple-700"}>"{resolveTitleValue(selectedAchievement?.selectedReward?.value, selectedAchievement?.selectedReward?.display_name)}"</strong> ausrüsten?
            </p>
            <p className={`text-sm mb-6 ${!isLightUi ? "text-stone-400" : "text-stone-500"}`}>
              Dieser Titel wird in deinem Profil und auf der Startseite angezeigt.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowTitleDialog(false)}
                className={`flex-1 ${!isLightUi ? "border-stone-600 text-stone-300 hover:bg-stone-800" : ""}`}
              >
                Abbrechen
              </Button>
              <Button
                onClick={confirmTitleSelection}
                disabled={updateTitleMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {updateTitleMutation.isPending ? 'Wird ausgerüstet...' : 'Ausrüsten'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      </div>
      </>);

      }
