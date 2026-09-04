import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { createUserNotification } from "@/api/notificationService";
import { buildNotificationPayload } from "@/lib/story/storyDefinition";
import { sendFriendRequest } from "@/api/friendService";
import { useUiTheme } from "@/lib/UiThemeContext";
import { useFriendData } from "@/components/friends/hooks/useFriendData";
import FriendExperienceShell from "@/components/friends/FriendExperienceShell";
import FriendCollectionPanel from "@/components/friends/FriendCollectionPanel";
import FriendAchievementsPanel from "@/components/friends/FriendAchievementsPanel";
import FriendFriendsPanel from "@/components/friends/FriendFriendsPanel";
import { computeOverallPlantHealth, computePlantHealthState } from "@/lib/robotPlantEconomy";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, UserPlus, Clock } from "lucide-react";
import { HomeMilestoneStripe } from "@/components/home/HomeCollectionStripes";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import FlorabotLogo from "@/components/florabot/FlorabotLogo";
import { evaluateProfileBadges, buildSelectedProfileBadges } from "@/lib/profileBadges";
import { getRarityLevelFromLabel } from "@/lib/plantRarity";
import { getProfileBadgeIconComponent } from "@/lib/profileBadgeIcons";
import { resolveOwnedUniqueBadges } from "@/lib/profileUniqueBadges";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import { getActiveSeason } from "@/lib/seasonConfig";
import { parseDiscoveryCoordinates, calculateDistanceMetersRaw } from "@/lib/discoveryMap";

const VALID_FRIEND_TABS = ["profile", "collection", "achievements", "friends"];

const PET_DAILY_LIMIT = 1;

const FRIEND_HEALTH_STAT_COLORS = {
  energy: "#f97316",
  "data-quality": "#06b6d4",
  care: "#22c55e",
};

const FRIEND_HEALTH_STAT_LABELS = {
  energy: "Energie",
  "data-quality": "Daten",
  care: "Pflege",
};

const BADGE_RANK_ICON_STYLE = {
  gray: "text-[#9ca3af]",
  white: "text-white",
  bronze: "text-[#cd7f32]",
  silver: "text-[#c0c7d1]",
  gold: "text-[#f5c542]",
};

const BADGE_GLASS_CLASS = "border-[#f0e5a5]/55 bg-black/88 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl";

// Mirror HomeCollectionStripes layout constants exactly
const HERO_UNIT_HEIGHT_REM = 10;
const HERO_UNIT_MAX_WIDTH_REM = 22;
const HERO_BADGE_ROW_HEIGHT_REM = 7.25;
const HERO_LOGO_TOP_REM = 4.9;
const HERO_BADGE_TOP_SIDE_REM = 2.9;
const HERO_BADGE_TOP_CENTER_REM = 1.1;
const HERO_BADGE_LOGO_MIN_SCALE = 0.24;
const HERO_BADGE_LOGO_MAX_SCALE = 1.56;
const HERO_BADGE_LOGO_VISIBLE_HEIGHT_RATIO = 0.72;

const BADGE_ARC_POSITIONS = [
  { left: "16.6667%", topRem: HERO_BADGE_TOP_SIDE_REM },
  { left: "50%",      topRem: HERO_BADGE_TOP_CENTER_REM },
  { left: "83.3333%", topRem: HERO_BADGE_TOP_SIDE_REM },
];

function buildFriendKpiFeed(friendSeeds, friendClaimedTiles, overallHealth) {
  return [
    {
      id: "friend-kpi",
      kind: "kpi",
      title: "Statistiken",
      kpiSummary: {
        playerSeedsDisplay: String(Math.round(friendSeeds)),
        conqueredZonesDisplay: String(Math.round(friendClaimedTiles)),
        healthSeedBonusDisplay: overallHealth != null ? Math.round(overallHealth) : 0,
        securedMultiplier: null,
        zoneHintText: "",
        nearestZoneDirectionIcon: "",
        nearestZoneDistanceKm: null,
      },
    },
  ];
}

function PetAnimation({ attribute, nonce, logoRef }) {
  const color = FRIEND_HEALTH_STAT_COLORS[attribute] || "#22c55e";

  return (
    <AnimatePresence mode="wait">
      {attribute && nonce ? (
        <motion.div
          key={`pet-anim-${nonce}`}
          className="pointer-events-none absolute inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-[-8%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${color}55 0%, ${color}2a 38%, transparent 76%)`,
              filter: "blur(10px)",
            }}
            initial={{ opacity: 0, scale: 0.78 }}
            animate={{ opacity: [0, 1, 0], scale: [0.78, 1.08, 1.28] }}
            transition={{ duration: 0.72, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2"
            style={{
              borderColor: color,
              boxShadow: `0 0 32px ${color}cc, 0 0 60px ${color}55`,
            }}
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: [0, 1, 0], scale: [0.82, 1.04, 1.15] }}
            transition={{ duration: 0.68, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-3 rounded-full border"
            style={{
              borderColor: `${color}99`,
              boxShadow: `0 0 18px ${color}66`,
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.92, 1, 1.1] }}
            transition={{ duration: 0.64, ease: "easeOut", delay: 0.05 }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PetFloatingBadge({ attribute, nonce }) {
  const color = FRIEND_HEALTH_STAT_COLORS[attribute] || "#22c55e";
  const label = FRIEND_HEALTH_STAT_LABELS[attribute] || attribute;

  return (
    <AnimatePresence>
      {attribute && nonce ? (
        <motion.div
          key={`pet-badge-${nonce}`}
          className="pointer-events-none absolute z-30 left-1/2 -translate-x-1/2"
          style={{ top: "15%" }}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -52 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          aria-hidden="true"
        >
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold text-white shadow-lg"
            style={{ background: color }}
          >
            +3 {label}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function FriendProfileHomePanel({
  isLightUi,
  isFriend,
  hasPendingRequest,
  isLoading,
  cardBase,
  textPrimary,
  textSecondary,
  friendSeeds,
  friendClaimedTiles,
  displayedOverallPlantHealth,
  friendUser,
  logoAssets,
  selectedFriendBadges,
  botName,
  petsMadeToday,
  petFriendMutation,
  sendFriendRequestMutation,
  showNoFriendAccessHint,
}) {
  const [petAnimAttribute, setPetAnimAttribute] = useState(null);
  const [petAnimNonce, setPetAnimNonce] = useState(0);
  const [petBadgeNonce, setPetBadgeNonce] = useState(0);
  const [unitScale, setUnitScale] = useState(1);
  const heroViewportRef = useRef(null);
  const heroUnitRef = useRef(null);
  const unitScaleRef = useRef(1);
  const petAnimTimeoutRef = useRef(null);

  // Scale the badge+logo unit to fill the available space — same logic as HomeCollectionStripes
  useEffect(() => {
    const computeScale = () => {
      const viewportNode = heroViewportRef.current;
      const unitNode = heroUnitRef.current;
      if (!viewportNode || !unitNode) return;

      const availableHeight = Math.max(1, viewportNode.clientHeight);
      const availableWidth = Math.max(1, viewportNode.clientWidth);
      const currentScale = Math.max(0.01, unitScaleRef.current || 1);
      const unitRect = unitNode.getBoundingClientRect();
      const unitHeight = Math.max(1, unitRect.height / currentScale);
      const unitWidth = Math.max(1, unitRect.width / currentScale);

      // Logo extends beyond the unit — compensate for transparent region
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const logoHeightPx = 12.75 * 1.24 * remPx;
      const transparentCompensation = logoHeightPx * (1 - HERO_BADGE_LOGO_VISIBLE_HEIGHT_RATIO);
      const effectiveUnitHeight = Math.max(1, unitHeight - transparentCompensation);

      const heightScale = (availableHeight * 0.98) / effectiveUnitHeight;
      const widthScale = (availableWidth * 0.96) / unitWidth;
      const nextScale = Math.max(
        HERO_BADGE_LOGO_MIN_SCALE,
        Math.min(HERO_BADGE_LOGO_MAX_SCALE, heightScale, widthScale)
      );

      unitScaleRef.current = nextScale;
      setUnitScale((prev) => (Math.abs(prev - nextScale) < 0.01 ? prev : nextScale));
    };

    computeScale();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(computeScale);
    if (heroViewportRef.current) observer.observe(heroViewportRef.current);
    if (heroUnitRef.current) observer.observe(heroUnitRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (petAnimTimeoutRef.current) window.clearTimeout(petAnimTimeoutRef.current);
    };
  }, []);

  const handlePetFriend = useCallback(() => {
    if (petFriendMutation.isPending) return;
    petFriendMutation.mutate(undefined, {
      onSuccess: (result) => {
        const attr = result?.attribute || null;
        if (!attr) return;
        if (petAnimTimeoutRef.current) window.clearTimeout(petAnimTimeoutRef.current);
        const nonce = Date.now();
        setPetAnimAttribute(attr);
        setPetAnimNonce(nonce);
        setPetBadgeNonce(nonce);
        petAnimTimeoutRef.current = window.setTimeout(() => {
          setPetAnimAttribute(null);
          petAnimTimeoutRef.current = null;
        }, 950);
      },
    });
  }, [petFriendMutation]);

  const petsRemaining = Math.max(0, PET_DAILY_LIMIT - (petsMadeToday ?? 0));
  const canPet = isFriend && petsRemaining > 0 && !petFriendMutation.isPending;
  const safeBotName = String(botName || "Florabot").trim() || "Florabot";

  const kpiFeed = useMemo(
    () => buildFriendKpiFeed(friendSeeds, friendClaimedTiles, displayedOverallPlantHealth),
    [friendSeeds, friendClaimedTiles, displayedOverallPlantHealth]
  );

  const badgeSlots = Array.from({ length: 3 }, (_, i) => selectedFriendBadges?.[i] || null);

  return (
    <div className="h-full flex min-h-0 flex-col overflow-hidden">
      <div className="h-full flex flex-1 min-h-0 flex-col overflow-y-auto p-[clamp(0.75rem,2vw,1.25rem)] gap-3" data-ui="friend-content-stack">

        {/* Hero area — identical layout to HomeCollectionStripes */}
        <section className="flex min-h-0 flex-1 flex-col px-[clamp(0.25rem,1vw,0.75rem)]">
          <div
            ref={heroViewportRef}
            className="relative min-h-[17.25rem] flex-1 overflow-hidden text-stone-100 sm:min-h-[19.25rem]"
            aria-label="Florabot und Abzeichen"
          >
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute inset-0 flex justify-center items-start"
              style={{ pointerEvents: "none" }}
            >
              {/* Scaled unit — same geometry as HomeCollectionStripes */}
              <div
                ref={heroUnitRef}
                className="relative w-[20rem] max-w-full"
                style={{
                  maxWidth: `${HERO_UNIT_MAX_WIDTH_REM}rem`,
                  height: `${HERO_UNIT_HEIGHT_REM}rem`,
                  transform: `scale(${unitScale})`,
                  transformOrigin: "top center",
                  pointerEvents: "auto",
                }}
              >
                {/* Badge arc row */}
                <div
                  className="absolute inset-x-0 top-0 z-20 pointer-events-none"
                  style={{ height: `${HERO_BADGE_ROW_HEIGHT_REM}rem` }}
                  aria-label="Ausgewählte Abzeichen"
                >
                  {badgeSlots.map((badge, slotIndex) => {
                    const pos = BADGE_ARC_POSITIONS[slotIndex] || BADGE_ARC_POSITIONS[1];
                    const posStyle = {
                      left: pos.left,
                      top: `${pos.topRem}rem`,
                      transform: "translateX(-50%)",
                    };

                    if (!badge) {
                      return (
                        <div
                          key={`badge-slot-empty-${slotIndex}`}
                          style={posStyle}
                          className={`pointer-events-none absolute h-16 w-16 overflow-hidden rounded-full border flex items-center justify-center text-[9px] font-medium ${BADGE_GLASS_CLASS}`}
                        >
                          <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.34),rgba(255,255,255,0.08)_34%,rgba(255,255,255,0)_66%)]" />
                          <span className="pointer-events-none absolute inset-[2px] rounded-full border border-white/10" />
                          <span className="relative z-[1] text-stone-300/70">Leer</span>
                        </div>
                      );
                    }

                    const Icon = badge?.Icon || Leaf;
                    const rankKey = String(badge?.rankKey || "gray").toLowerCase();
                    const rankLabel = badge?.rankMeta?.label || "Grau";
                    const iconToneClass = BADGE_RANK_ICON_STYLE[rankKey] || BADGE_RANK_ICON_STYLE.gray;
                    const valueLabel = String(badge?.valueLabel || "-");

                    return (
                      <LockedTooltip
                        key={badge.id}
                        content={(
                          <div className="space-y-1">
                            <p className="text-xs font-semibold">{badge.label}</p>
                            <p className="text-[11px] leading-snug">{badge.description}</p>
                            <p className="text-[11px]"><span className="font-semibold">Wert:</span> {valueLabel}</p>
                            <p className="text-[11px]"><span className="font-semibold">Rang:</span> {rankLabel}</p>
                          </div>
                        )}
                        contentClassName={isLightUi ? "" : "text-white/90"}
                      >
                        <button
                          type="button"
                          style={posStyle}
                          className={`pointer-events-auto absolute h-16 w-16 overflow-hidden rounded-full border flex flex-col items-center justify-center gap-1 ${BADGE_GLASS_CLASS}`}
                          aria-label={`${badge.label}: ${valueLabel}, Rang ${rankLabel}`}
                        >
                          <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.34),rgba(255,255,255,0.08)_34%,rgba(255,255,255,0)_66%)]" />
                          <span className="pointer-events-none absolute inset-[2px] rounded-full border border-white/10" />
                          <Icon className={`relative z-[1] h-6 w-6 ${iconToneClass}`} />
                          <span className="relative z-[1] w-full max-w-[3.3rem] text-center text-[10px] leading-none font-bold text-stone-100 truncate">
                            {valueLabel}
                          </span>
                        </button>
                      </LockedTooltip>
                    );
                  })}
                </div>

                {/* Logo row — same position as HomeCollectionStripes */}
                <div
                  className="absolute inset-x-0 z-10 flex justify-center"
                  style={{ top: `${HERO_LOGO_TOP_REM}rem` }}
                >
                  <div className="flex flex-col items-center gap-2">
                    {/* Logo with pet animation overlay */}
                    <div className="relative scale-[1.24]">
                      <PetAnimation attribute={petAnimAttribute} nonce={petAnimNonce} />
                      <PetFloatingBadge attribute={petAnimAttribute} nonce={petBadgeNonce} />
                      <FlorabotLogo
                        profile={friendUser}
                        logoAssets={logoAssets}
                        sizeClass="w-[12.75rem] h-[12.75rem] sm:w-[14.75rem] sm:h-[14.75rem]"
                        padding="p-[7%]"
                        className="drop-shadow-[0_0_28px_rgba(190,242,100,0.5)]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* KPI Stripe — below logo, same position as in Home screen */}
        <div className="shrink-0" style={{ height: "3.35rem" }}>
          <HomeMilestoneStripe
            isLightUi={isLightUi}
            milestoneFeed={kpiFeed}
            controlsScale={1}
          />
        </div>

        {/* Action button */}
        <div className="shrink-0">
          {isFriend ? (
            <button
              onClick={handlePetFriend}
              disabled={!canPet}
              className={`w-full rounded-2xl border flex items-center justify-center font-semibold tracking-wide transition-all ${
                canPet
                  ? isLightUi
                    ? "border-emerald-400/60 bg-gradient-to-r from-emerald-500/85 via-green-400/75 to-emerald-500/85 text-white shadow-[0_8px_24px_rgba(34,197,94,0.25)] hover:shadow-[0_12px_32px_rgba(34,197,94,0.4)] active:scale-[0.98]"
                    : "border-emerald-300/35 bg-gradient-to-r from-emerald-700/80 via-green-600/70 to-emerald-700/80 text-white shadow-[0_8px_24px_rgba(34,197,94,0.3)]"
                  : isLightUi
                    ? "border-stone-200/40 bg-stone-100/40 text-stone-400/60 saturate-50 cursor-not-allowed"
                    : "border-stone-700/30 bg-stone-800/30 text-stone-500/50 saturate-50 cursor-not-allowed"
              }`}
              style={{ height: "3.35rem", fontSize: "1.05rem" }}
              aria-label={canPet ? `${safeBotName} streicheln` : `${safeBotName} wurde heute bereits gestreichelt`}
            >
              <span>{petFriendMutation.isPending ? "…" : `${safeBotName} streicheln.`}</span>
            </button>
          ) : hasPendingRequest ? (
            <button
              disabled
              className={`w-full flex items-center justify-center gap-2 opacity-55 cursor-not-allowed font-semibold rounded-2xl border ${cardBase} ${textSecondary}`}
              style={{ height: "3.35rem" }}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-stone-400 to-stone-500 flex items-center justify-center shadow-md">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <span>Anfrage gesendet</span>
            </button>
          ) : (
            <button
              onClick={() => sendFriendRequestMutation.mutate()}
              disabled={sendFriendRequestMutation.isPending}
              className={`w-full flex items-center justify-center gap-2 font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 rounded-2xl border ${cardBase} ${textPrimary}`}
              style={{ height: "3.35rem" }}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md ${
                  isLightUi
                    ? "bg-gradient-to-br from-emerald-500 to-green-600"
                    : "bg-gradient-to-br from-emerald-700 to-green-800"
                }`}
              >
                <UserPlus className="w-4 h-4 text-white" />
              </div>
              <span>{sendFriendRequestMutation.isPending ? "Wird gesendet..." : "Freund hinzufügen"}</span>
            </button>
          )}
        </div>

        {showNoFriendAccessHint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`rounded-2xl backdrop-blur-md p-4 text-center ${cardBase}`}
          >
            <p className={`text-sm ${textSecondary}`}>
              Schicke eine Freundschaftsanfrage, um die Erfolge, Sammlungen und Freundesliste zu sehen.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function FriendProfile() {
  const queryClient = useQueryClient();
  const { isLightUi } = useUiTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const friendEmail = searchParams.get("email");
  const requestedTab = searchParams.get("tab");
  const activeTab = VALID_FRIEND_TABS.includes(requestedTab) ? requestedTab : "profile";

  const {
    friendUser,
    currentUser,
    isFriend,
    hasPendingRequest,
    averageColor,
    isLoading,
  } = useFriendData(friendEmail);

  const { data: logoAssets = [] } = useQuery({
    queryKey: ["logoAssets"],
    queryFn: () => Query.LogoAsset.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const friendLogoAssets = useMemo(
    () => resolveEquippedLogoAssetsWithCatalog(friendUser || {}, logoAssets),
    [friendUser, logoAssets]
  );

  const { data: friendRobotPlant = null, isFetched: isFriendRobotPlantFetched } = useQuery({
    queryKey: ["friendRobotPlant", friendUser?.auth_id],
    queryFn: async () => {
      const rows = await Query.RobotPlant.filter({ auth_id: friendUser?.auth_id });
      return rows?.[0] || null;
    },
    enabled: !!friendUser?.auth_id && activeTab === "profile",
    staleTime: 30_000,
  });

  const activeSeason = getActiveSeason();
  const seasonStartDate = activeSeason?.startDate || null;

  const { data: friendSeasonSeedLeaderboard = [] } = useQuery({
    queryKey: ["friendSeasonSeedLeaderboard", seasonStartDate || "alltime"],
    queryFn: async () => {
      if (!seasonStartDate) return [];
      const { data, error } = await supabase.rpc("get_weekly_seed_leaderboard", {
        p_limit: 500,
        p_from_date: seasonStartDate,
      });
      if (error) {
        console.warn("[FriendProfile] get_weekly_seed_leaderboard unavailable:", error?.message || error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: !!seasonStartDate && activeTab === "profile",
    staleTime: 60_000,
  });

  const { data: friendOwnedUniqueBadgeIds = [] } = useQuery({
    queryKey: ["friendUniqueBadges", friendUser?.auth_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unique_badges")
        .select("badge_id")
        .eq("auth_id", friendUser?.auth_id);
      if (error) {
        console.warn("[FriendProfile] unique_badges query failed:", error?.message || error);
        return [];
      }
      return (data || []).map((row) => row.badge_id);
    },
    enabled: !!friendUser?.auth_id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: friendHighestScanResultsLeaderboard = [] } = useQuery({
    queryKey: ["friendHighestScanResultsLeaderboard", seasonStartDate || "alltime"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_highest_scan_results_leaderboard", {
        p_limit: 500,
        p_from_date: seasonStartDate,
      });
      if (error) {
        console.warn("[FriendProfile] get_highest_scan_results_leaderboard unavailable:", error?.message || error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: !!friendUser?.auth_id && activeTab === "profile",
    staleTime: 60_000,
  });

  const { data: friendTotalScans = 0 } = useQuery({
    queryKey: ["friendTotalScans", friendUser?.auth_id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("UserPlantDiscovery")
        .select("*", { count: "exact", head: true })
        .eq("auth_id", friendUser?.auth_id);
      if (error) return 0;
      return Math.max(0, Number(count ?? 0));
    },
    enabled: !!friendUser?.auth_id,
    staleTime: 60_000,
  });

  // ── Total walked distance between scans (UserPlantDiscovery world-readable) ─
  const { data: friendTotalDistanceKm = 0 } = useQuery({
    queryKey: ["friendTotalDistanceKm", friendUser?.auth_id],
    queryFn: async () => {
      const { data: discoveries, error } = await supabase
        .from("UserPlantDiscovery")
        .select("discovery_location, discovered_date")
        .eq("auth_id", friendUser?.auth_id)
        .order("discovered_date", { ascending: true });
      if (error || !discoveries?.length) return 0;
      let totalMeters = 0;
      for (let i = 1; i < discoveries.length; i++) {
        const prev = parseDiscoveryCoordinates(discoveries[i - 1]?.discovery_location);
        const curr = parseDiscoveryCoordinates(discoveries[i]?.discovery_location);
        if (!prev || !curr) continue;
        const d = calculateDistanceMetersRaw(prev.lat, prev.lng, curr.lat, curr.lng);
        if (Number.isFinite(d) && d >= 0) totalMeters += d;
      }
      return totalMeters / 1000;
    },
    enabled: !!friendUser?.auth_id,
    staleTime: 5 * 60 * 1000,
  });

  // ── Received likes (ScanLike + UserPlantDiscovery both world-readable) ─────
  const { data: friendReceivedLikesCount = 0 } = useQuery({
    queryKey: ["friendReceivedLikesCount", friendUser?.auth_id],
    queryFn: async () => {
      const { data: discoveries, error: discErr } = await supabase
        .from("UserPlantDiscovery")
        .select("id")
        .eq("auth_id", friendUser?.auth_id);
      if (discErr || !discoveries?.length) return 0;
      const ids = discoveries.map((d) => d.id);
      const { count, error: likeErr } = await supabase
        .from("ScanLike")
        .select("*", { count: "exact", head: true })
        .in("discovery_id", ids);
      if (likeErr) return 0;
      return Math.max(0, Number(count ?? 0));
    },
    enabled: !!friendUser?.auth_id,
    staleTime: 60_000,
  });

  // ── Rarest plant score (UserPlantDiscovery + Plant both world-readable) ────
  const { data: friendRarestPlantScore = 0 } = useQuery({
    queryKey: ["friendRarestPlantScore", friendUser?.auth_id],
    queryFn: async () => {
      const { data: discoveries, error: discErr } = await supabase
        .from("UserPlantDiscovery")
        .select("plant_id")
        .eq("auth_id", friendUser?.auth_id);
      if (discErr || !discoveries?.length) return 0;
      const plantIds = [...new Set(discoveries.map((d) => d.plant_id).filter(Boolean))];
      if (!plantIds.length) return 0;
      const { data: plantRows, error: plantErr } = await supabase
        .from("Plant")
        .select("rarity")
        .in("id", plantIds);
      if (plantErr || !plantRows?.length) return 0;
      return plantRows.reduce((maxScore, plant) => {
        return Math.max(maxScore, getRarityLevelFromLabel(plant.rarity));
      }, 0);
    },
    enabled: !!friendUser?.auth_id,
    staleTime: 5 * 60 * 1000,
  });

  // ── Weekly / monthly quest completions (accessible via public-profile RLS) ─
  const { data: friendWeeklyQuestsCompleted = 0 } = useQuery({
    queryKey: ["friendWeeklyQuestsCompleted", friendUser?.auth_id],
    queryFn: async () => {
      const rows = await Query.UserWeeklyQuest.filter({ auth_id: friendUser?.auth_id });
      return (rows || []).filter(
        (r) => r.status === "completed" || r.status === "redeemed" || r.completed
      ).length;
    },
    enabled: !!friendUser?.auth_id,
    staleTime: 60_000,
  });

  const { data: friendMonthlyQuestsCompleted = 0 } = useQuery({
    queryKey: ["friendMonthlyQuestsCompleted", friendUser?.auth_id],
    queryFn: async () => {
      const rows = await Query.UserMonthlyQuest.filter({ auth_id: friendUser?.auth_id });
      return (rows || []).filter(
        (r) => r.status === "completed" || r.status === "redeemed" || r.completed
      ).length;
    },
    enabled: !!friendUser?.auth_id,
    staleTime: 60_000,
  });

  // ── Zone unlocked accessories (UserRewards accessible via public-profile RLS) ─
  const { data: rewardsCatalog = [] } = useQuery({
    queryKey: ["rewardsCatalog"],
    queryFn: () => Query.Reward.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: friendUserRewards = [] } = useQuery({
    queryKey: ["friendUserRewards", friendUser?.auth_id],
    queryFn: () => Query.UserReward.filter({ auth_id: friendUser?.auth_id }),
    enabled: !!friendUser?.auth_id,
    staleTime: 60_000,
  });

  // ── Pet count today ────────────────────────────────────────────────────────
  const { data: petsMadeToday = 0, refetch: refetchPetsToday } = useQuery({
    queryKey: ["petFriendToday", friendUser?.auth_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pet_friend_count_today", {
        p_friend_auth_id: friendUser?.auth_id,
      });
      if (error) return 0;
      return Number(data) || 0;
    },
    enabled: !!friendUser?.auth_id && isFriend && activeTab === "profile",
    staleTime: 60_000,
  });

  // ── Pet mutation ───────────────────────────────────────────────────────────
  const petFriendMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("robot_plant_pet_friend", {
        p_friend_auth_id: friendUser?.auth_id,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      refetchPetsToday();
      queryClient.invalidateQueries({ queryKey: ["friendRobotPlant", friendUser?.auth_id] });

      // Push notification to the friend whose bot was petted
      const attribute = data?.attribute;
      const attributeLabel =
        attribute === "energy" ? "Energie" :
        attribute === "data_quality" ? "Daten" :
        attribute === "care" ? "Pflege" :
        attribute || "Attribut";
      const petter =
        currentUser?.display_name || currentUser?.full_name || currentUser?.email || "Jemand";
      const botName = friendUser?.bot_name || "Florabot";
      try {
        createUserNotification({
          authId: friendUser?.auth_id,
          userEmail: friendUser?.user_email,
          notificationType: "florabot_petted",
          ...buildNotificationPayload("florabotPetted", { petter, botName, attribute: attributeLabel }),
          displayLocation: "banner",
          createdBy: currentUser?.email,
        });
      } catch (err) {
        console.error("[FriendProfile] pet notification error:", err);
      }
    },
  });

  const sendFriendRequestMutation = useMutation({
    mutationFn: async () => {
      await sendFriendRequest(friendEmail);
      const senderName =
        currentUser?.display_name || currentUser?.full_name || currentUser?.email;
      try {
        await createUserNotification({
          authId: friendUser?.auth_id,
          userEmail: friendUser?.user_email || friendEmail,
          notificationType: "friend_request_received",
          ...buildNotificationPayload("friendRequestReceived", { senderName }),
          actionUrl: "Friends",
          displayLocation: "banner",
          createdBy: currentUser?.email,
        });
      } catch (err) {
        console.error("[FriendProfile] notification error:", err);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myFriendship"] });
    },
    onError: (err) => {
      alert(`Fehler beim Senden der Anfrage: ${err.message}`);
    },
  });

  const isPlantHealthPending = Boolean(friendUser?.auth_id) && !isFriendRobotPlantFetched;

  const energyValue = Math.max(
    0,
    Math.min(100, Number(friendRobotPlant?.energy ?? friendRobotPlant?.energy_value ?? 0))
  );
  const dataQualityValue = Math.max(
    0,
    Math.min(
      100,
      Number(
        friendRobotPlant?.dataQuality ??
          friendRobotPlant?.data_quality ??
          friendRobotPlant?.data_quality_value ??
          0
      )
    )
  );
  const careValue = Math.max(
    0,
    Math.min(100, Number(friendRobotPlant?.care ?? friendRobotPlant?.care_value ?? 0))
  );

  const overallPlantHealth = computeOverallPlantHealth({
    energyValue,
    dataQualityValue,
    careValue,
  });

  const plantHealthState = computePlantHealthState({
    overallPlantHealth,
    energyValue,
    dataQualityValue,
    careValue,
  });

  const resolvedPlantHealthState = isPlantHealthPending
    ? { label: "Status wird geladen", color: "#6b7280", scanEventBonus: 0 }
    : plantHealthState;
  const healthStateBonus = Number(resolvedPlantHealthState?.scanEventBonus ?? 0);
  const healthStats = [
    { id: "energy", label: "Energie", value: Math.round(energyValue), color: FRIEND_HEALTH_STAT_COLORS.energy },
    { id: "data-quality", label: "Daten", value: Math.round(dataQualityValue), color: FRIEND_HEALTH_STAT_COLORS["data-quality"] },
    { id: "care", label: "Pflege", value: Math.round(careValue), color: FRIEND_HEALTH_STAT_COLORS.care },
  ];

  const displayedOverallPlantHealth = isPlantHealthPending ? null : overallPlantHealth;
  const friendAllTimeSeeds = Math.max(
    0,
    Number(friendRobotPlant?.wallet_balance ?? friendRobotPlant?.walletBalance ?? 0)
  );
  const friendSeasonSeedEntry = useMemo(() => {
    if (!seasonStartDate || !friendUser?.auth_id) return null;
    return (friendSeasonSeedLeaderboard || []).find(
      (entry) => String(entry?.auth_id || "") === String(friendUser.auth_id)
    ) || null;
  }, [seasonStartDate, friendSeasonSeedLeaderboard, friendUser?.auth_id]);
  const friendSeasonSeedsValue = Math.max(0, Number(friendSeasonSeedEntry?.weekly_seed_total ?? 0));
  const friendSeeds = seasonStartDate ? friendSeasonSeedsValue : friendAllTimeSeeds;
  const friendClaimedTiles = Math.max(
    0,
    Number(friendRobotPlant?.claimed_tiles_count ?? friendRobotPlant?.claimedTilesCount ?? 0)
  );
  const friendStreakDays = Math.max(0, Number(friendRobotPlant?.streak_days ?? 0));
  const friendMemberSinceDays = useMemo(() => {
    const raw = friendUser?.created_date || friendUser?.created_at || null;
    if (!raw) return 0;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.max(0, Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000)));
  }, [friendUser?.created_date, friendUser?.created_at]);
  const friendGlobalSeedRank = useMemo(() => {
    if (!friendUser?.auth_id || !friendSeasonSeedLeaderboard.length) return 0;
    const sorted = [...friendSeasonSeedLeaderboard].sort(
      (a, b) => Number(b.weekly_seed_total ?? 0) - Number(a.weekly_seed_total ?? 0)
    );
    const idx = sorted.findIndex((e) => String(e.auth_id) === String(friendUser.auth_id));
    return idx >= 0 ? idx + 1 : 0;
  }, [friendSeasonSeedLeaderboard, friendUser?.auth_id]);
  const friendHighestScanResult = useMemo(() => {
    const emailLower = String(friendUser?.user_email || "").toLowerCase();
    if (!emailLower || !friendHighestScanResultsLeaderboard.length) return 0;
    const entry = friendHighestScanResultsLeaderboard.find(
      (e) =>
        String(e?.public_profile_email || e?.user_email || e?.profile_email || e?.email || "")
          .toLowerCase() === emailLower
    );
    return Math.max(0, Number(entry?.reward_amount ?? 0));
  }, [friendHighestScanResultsLeaderboard, friendUser?.user_email]);

  const friendZoneUnlockedAccessories = useMemo(() => {
    const unlockedIds = new Set(
      (friendUserRewards || []).map((r) => String(r?.reward_id || "").trim()).filter(Boolean)
    );
    return (rewardsCatalog || []).reduce((count, reward) => {
      const type = String(reward?.type || reward?.reward_type || reward?.kind || "").trim().toLowerCase();
      const id = String(reward?.id || "").trim();
      if (!id || !unlockedIds.has(id)) return count;
      if (type !== "logo_accessory" && type !== "accessory") return count;
      if (!String(reward?.requires_zone_theme || "").trim()) return count;
      return count + 1;
    }, 0);
  }, [rewardsCatalog, friendUserRewards]);

  const cardBase = isLightUi
    ? "bg-white/35 border border-[#c8ac62]/30"
    : "bg-black/28 border border-[#f0e5a5]/22";
  const textPrimary = isLightUi ? "text-stone-900" : "text-white";
  const textSecondary = isLightUi ? "text-stone-700" : "text-stone-200";

  // ── Friend badges ──────────────────────────────────────────────────────────
  const selectedFriendBadges = useMemo(() => {
    const partialMetrics = {
      total_seeds:                     friendAllTimeSeeds,
      season_seeds:                    friendSeasonSeedsValue,
      alltime_seeds:                   friendAllTimeSeeds,
      claimed_tiles:                   friendClaimedTiles,
      highest_plant_status:            displayedOverallPlantHealth ?? 0,
      daily_streak_days:               friendStreakDays,
      member_since_days:               friendMemberSinceDays,
      global_seed_rank:                friendGlobalSeedRank,
      highest_scan_result:             friendHighestScanResult,
      total_scans:                     friendTotalScans,
      total_distance_between_scans_km: friendTotalDistanceKm,
      received_likes_count:            friendReceivedLikesCount,
      rarest_plant_score:              friendRarestPlantScore,
      weekly_quests_completed:         friendWeeklyQuestsCompleted,
      monthly_quests_completed:        friendMonthlyQuestsCompleted,
      zone_unlocked_plant_accessories: friendZoneUnlockedAccessories,
    };
    const evaluated = evaluateProfileBadges(partialMetrics);
    const ownedUniqueBadges = resolveOwnedUniqueBadges(friendOwnedUniqueBadgeIds);
    return buildSelectedProfileBadges(
      friendUser?.selected_badge_ids,
      evaluated,
      undefined,
      ownedUniqueBadges,
    ).map((badge) => ({
      ...badge,
      Icon: getProfileBadgeIconComponent(badge.iconKey),
    }));
  }, [
    friendUser?.selected_badge_ids,
    friendAllTimeSeeds,
    friendSeasonSeedsValue,
    friendClaimedTiles,
    displayedOverallPlantHealth,
    friendStreakDays,
    friendMemberSinceDays,
    friendGlobalSeedRank,
    friendHighestScanResult,
    friendTotalScans,
    friendTotalDistanceKm,
    friendReceivedLikesCount,
    friendRarestPlantScore,
    friendWeeklyQuestsCompleted,
    friendMonthlyQuestsCompleted,
    friendZoneUnlockedAccessories,
    friendOwnedUniqueBadgeIds,
  ]);

  const friendBotName = String(friendUser?.bot_name || "Florabot").trim() || "Florabot";

  const isPublicProfile = friendUser?.public_profile !== false;
  const showNoFriendAccessHint = !isFriend && !hasPendingRequest && !isPublicProfile && !isLoading;
  const contentAccessDenied = activeTab !== "profile" && !isFriend && !isPublicProfile && !isLoading;

  const handleTabChange = (nextTab) => {
    if (!VALID_FRIEND_TABS.includes(nextTab)) return;
    const nextParams = new URLSearchParams(searchParams);
    if (friendEmail) nextParams.set("email", friendEmail);
    nextParams.set("tab", nextTab);
    setSearchParams(nextParams);
  };

  return (
    <FriendExperienceShell
      friendUser={friendUser}
      friendLogoAssets={friendLogoAssets}
      activeTab={activeTab}
      friendEmail={friendEmail}
      averageColor={averageColor}
      isLoading={isLoading}
      accessDenied={contentAccessDenied}
      onTabChange={handleTabChange}
    >
      {activeTab === "collection" ? (
        <FriendCollectionPanel
          friendEmail={friendEmail}
          friendUser={friendUser}
          averageColor={averageColor}
        />
      ) : activeTab === "achievements" ? (
        <FriendAchievementsPanel friendUser={friendUser} />
      ) : activeTab === "friends" ? (
        <FriendFriendsPanel
          friendUser={friendUser}
          friendEmail={friendEmail}
          currentUser={currentUser}
        />
      ) : (
        <FriendProfileHomePanel
          isLightUi={isLightUi}
          isFriend={isFriend}
          hasPendingRequest={hasPendingRequest}
          isLoading={isLoading}
          cardBase={cardBase}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          friendSeeds={friendSeeds}
          friendClaimedTiles={friendClaimedTiles}
          displayedOverallPlantHealth={displayedOverallPlantHealth}
          friendUser={friendUser}
          logoAssets={logoAssets}
          selectedFriendBadges={selectedFriendBadges}
          botName={friendBotName}
          petsMadeToday={petsMadeToday}
          petFriendMutation={petFriendMutation}
          sendFriendRequestMutation={sendFriendRequestMutation}
          showNoFriendAccessHint={showNoFriendAccessHint}
        />
      )}
    </FriendExperienceShell>
  );
}
