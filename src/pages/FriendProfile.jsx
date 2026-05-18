import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Query } from "@/api/entities";
import { createUserNotification } from "@/api/notificationService";
import { sendFriendRequest } from "@/api/friendService";
import { useUiTheme } from "@/lib/UiThemeContext";
import { useFriendData } from "@/components/friends/hooks/useFriendData";
import FriendExperienceShell from "@/components/friends/FriendExperienceShell";
import CollectionFeatureRoot from "@/components/collection/CollectionFeatureRoot";
import FriendAchievementsPanel from "@/components/friends/FriendAchievementsPanel";
import FriendFriendsPanel from "@/components/friends/FriendFriendsPanel";
import { computeOverallPlantHealth, computePlantHealthState } from "@/lib/robotPlantEconomy";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, UserPlus, Clock, Heart, Zap } from "lucide-react";
import PlantHeroHealthPanel from "@/components/home/PlantHeroHealthPanel";
import { hexToFilter } from "@/lib/hexToFilter";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";

const VALID_FRIEND_TABS = ["profile", "collection", "achievements", "friends"];

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
  resolvedPlantHealthState,
  displayedOverallPlantHealth,
  healthStateBonus,
  healthStats,
  isPlantHealthPending,
  friendLogoAssets,
  sendFriendRequestMutation,
  showNoFriendAccessHint,
}) {
  const [showHealthStatsPanel, setShowHealthStatsPanel] = useState(false);
  const [heroStageSizePx, setHeroStageSizePx] = useState(0);
  const healthStatsPanelRef = useRef(null);
  const controlsScale = heroStageSizePx > 0
    ? Math.max(0.86, Math.min(1.18, heroStageSizePx / 250))
    : 1;

  useEffect(() => {
    const panel = healthStatsPanelRef.current;
    if (!panel) return;

    const updateHeroStageSize = () => {
      const bounds = panel.getBoundingClientRect();
      const nextSize = Math.floor(Math.min(bounds.width, bounds.height));
      if (!Number.isFinite(nextSize) || nextSize <= 0) return;
      setHeroStageSizePx((prev) => (prev === nextSize ? prev : nextSize));
    };

    updateHeroStageSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateHeroStageSize);
      observer.observe(panel);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateHeroStageSize);
    return () => window.removeEventListener("resize", updateHeroStageSize);
  }, [showHealthStatsPanel]);

  return (
    <div className="h-full flex min-h-0 flex-col overflow-hidden">
      <div className="h-full flex flex-1 min-h-0 flex-col overflow-y-auto p-[clamp(0.75rem,2vw,1.25rem)] gap-3" data-ui="friend-content-stack">
        <section className="flex min-h-0 flex-1 flex-col px-[clamp(0.25rem,1vw,0.75rem)] py-[clamp(0.2rem,1vh,0.5rem)]">
          <div ref={healthStatsPanelRef} className="flex-1 min-h-0 flex items-start justify-center pt-[clamp(0.2rem,1vh,0.5rem)]">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative mx-auto"
              style={{
                width: showHealthStatsPanel
                  ? "100%"
                  : (heroStageSizePx > 0 ? `${heroStageSizePx}px` : "100%"),
                height: showHealthStatsPanel
                  ? "100%"
                  : (heroStageSizePx > 0 ? `${heroStageSizePx}px` : "100%"),
                maxWidth: "100%",
                maxHeight: "100%",
                aspectRatio: showHealthStatsPanel ? undefined : "1 / 1",
              }}
            >
              <button
                type="button"
                onClick={() => setShowHealthStatsPanel((prev) => !prev)}
                className={`absolute left-0 md:left-2 top-5 md:top-6 z-10 w-[4.4rem] h-[3.6rem] md:w-[4.9rem] md:h-[3.9rem] rounded-2xl border backdrop-blur-sm flex flex-col items-center justify-center ${
                  isLightUi
                    ? "border-[#c8ac62]/60"
                    : "border-[#f0e5a5]/40"
                }`}
                style={{
                  background: isLightUi
                    ? `linear-gradient(135deg, ${resolvedPlantHealthState.color}35 0%, ${resolvedPlantHealthState.color}15 100%)`
                    : `linear-gradient(135deg, ${resolvedPlantHealthState.color}7a 0%, ${resolvedPlantHealthState.color}4d 100%)`,
                }}
                aria-label="Pflanzenstatus ein- oder ausklappen"
              >
                <Leaf className={`w-4 h-4 ${isLightUi ? "text-stone-700" : "text-white/90"}`} />
                <span className={`font-bold text-[11px] md:text-xs leading-none mt-0.5 ${isLightUi ? "text-stone-800" : "text-white"}`}>
                  {displayedOverallPlantHealth === null ? "..." : `${displayedOverallPlantHealth}%`}
                </span>
              </button>

              <div
                className={`absolute right-0 md:right-2 top-5 md:top-6 z-10 w-[4.4rem] h-[3.6rem] md:w-[4.9rem] md:h-[3.9rem] rounded-2xl border backdrop-blur-sm flex flex-col items-center justify-center ${
                  isLightUi
                    ? "border-[#c8ac62]/60"
                    : "border-[#f0e5a5]/40"
                }`}
                style={{
                  background: isLightUi
                    ? `linear-gradient(135deg, ${resolvedPlantHealthState.color}35 0%, ${resolvedPlantHealthState.color}15 100%)`
                    : `linear-gradient(135deg, ${resolvedPlantHealthState.color}7a 0%, ${resolvedPlantHealthState.color}4d 100%)`,
                }}
                aria-hidden="true"
              >
                <span className={`font-semibold text-[11px] md:text-xs leading-none mt-0.5 truncate max-w-[85%] ${isLightUi ? "text-stone-800" : "text-white"}`}>
                  {resolvedPlantHealthState.label}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {showHealthStatsPanel ? (
                  <PlantHeroHealthPanel
                    plantHealthState={resolvedPlantHealthState}
                    healthStateBonus={healthStateBonus}
                    healthStats={healthStats}
                    isLoading={isPlantHealthPending}
                    showCareActions={false}
                  />
                ) : (
                  <motion.div
                    key="friend-hero-plant"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="absolute inset-0"
                  >
                    <div
                      className={`absolute left-1/2 top-1/2 w-[82%] -translate-x-1/2 -translate-y-1/2 aspect-square rounded-full border backdrop-blur-sm shadow-[inset_0_0_30px_rgba(190,242,100,0.15)] ${
                        isLightUi
                          ? "border-[#b8d4a8]/55 bg-gradient-to-b from-emerald-50/75 to-emerald-100/45"
                          : "border-[#f0e5a5]/35 bg-gradient-to-b from-emerald-100/25 to-emerald-900/45"
                      }`}
                    />

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative w-[74%] h-[74%] drop-shadow-[0_0_24px_rgba(190,242,100,0.6)]">
                        {(friendLogoAssets?.border?.imageUrl || friendLogoAssets?.plant?.imageUrl || friendLogoAssets?.face?.imageUrl) && (
                          <div className="absolute left-1/2 top-1/2 h-[56%] w-[56%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35" />
                        )}
                        {friendLogoAssets?.border?.imageUrl && (
                          <img
                            src={friendLogoAssets.border.imageUrl}
                            alt="Logo Rahmen"
                            className="absolute inset-0 w-full h-full object-contain"
                            style={friendLogoAssets.borderColor
                              ? { filter: `brightness(0) saturate(100%) ${hexToFilter(friendLogoAssets.borderColor)}` }
                              : undefined}
                          />
                        )}
                        {friendLogoAssets?.plant?.imageUrl && (
                          <img
                            src={friendLogoAssets.plant.imageUrl}
                            alt="Logo Pflanze"
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                        )}
                        {friendLogoAssets?.face?.imageUrl && (
                          <img
                            src={friendLogoAssets.face.imageUrl}
                            alt="Logo Gesicht"
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                        )}
                        {!friendLogoAssets?.border?.imageUrl && !friendLogoAssets?.plant?.imageUrl && !friendLogoAssets?.face?.imageUrl && (
                          <Leaf
                            className={`w-20 h-20 md:w-24 md:h-24 ${
                              isLightUi ? "text-emerald-600" : "text-lime-200"
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </section>

        <div className="shrink-0">
          <div
            className={`w-full rounded-2xl border backdrop-blur-sm px-[clamp(0.625rem,2vw,0.875rem)] ${
              isLightUi
                ? "border-[#c8ac62]/45 bg-gradient-to-r from-emerald-100/50 via-white/40 to-emerald-100/50"
                : "border-[#f0e5a5]/45 bg-gradient-to-r from-emerald-900/45 via-black/30 to-emerald-900/45"
            }`}
            style={{ height: `${(2.4 * controlsScale).toFixed(2)}rem` }}
          >
            <div className={`h-full w-full flex items-center justify-between text-xs md:text-sm font-semibold ${
              isLightUi ? "text-stone-700" : "text-white/95"
            }`}>
              <div className={`flex items-center gap-1.5 min-w-0 ${isLightUi ? "text-stone-700" : "text-lime-100/95"}`}>
                <Leaf className={`w-4 h-4 ${isLightUi ? "text-emerald-600" : "text-lime-200"}`} />
                <span className="truncate">Samen {friendSeeds} · Tiles {friendClaimedTiles}</span>
              </div>

              <div className={`flex items-center gap-1.5 min-w-0 ${isLightUi ? "text-stone-700" : "text-amber-100/95"}`}>
                <div className={`h-5 w-px ${isLightUi ? "bg-[#c8ac62]/40" : "bg-[#f0e5a5]/35"}`} />
                <Zap className={`w-4 h-4 ${isLightUi ? "text-amber-700" : "text-amber-300"}`} />
                <span className="truncate">Status {resolvedPlantHealthState.label}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {isFriend ? (
            <button
              onClick={() => alert("Share a Scan kommt bald.")}
              className={`w-full rounded-2xl border flex items-center justify-center font-semibold tracking-wide transition-shadow ${
                isLightUi
                  ? "border-red-400/50 bg-gradient-to-r from-red-500/85 via-rose-400/75 to-red-500/85 text-white shadow-[0_8px_24px_rgba(239,68,68,0.2)] hover:shadow-[0_12px_32px_rgba(239,68,68,0.35)]"
                  : "border-red-200/35 bg-gradient-to-r from-red-700/80 via-rose-500/70 to-red-700/80 text-white shadow-[0_8px_24px_rgba(239,68,68,0.3)]"
              }`}
              style={{
                height: `${(3.35 * controlsScale).toFixed(2)}rem`,
                gap: "0.56rem",
                fontSize: `${(1.05 * controlsScale).toFixed(2)}rem`,
              }}
            >
              <Heart className="w-5 h-5" />
              Share a Scan
            </button>
          ) : hasPendingRequest ? (
            <button
              disabled
              className={`w-full flex items-center justify-center gap-2 opacity-55 cursor-not-allowed font-semibold rounded-2xl border ${cardBase} ${textSecondary}`}
              style={{ height: `${(3.35 * controlsScale).toFixed(2)}rem` }}
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
              style={{ height: `${(3.35 * controlsScale).toFixed(2)}rem` }}
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
              <span>{sendFriendRequestMutation.isPending ? "Wird gesendet..." : "Freund hinzufuegen"}</span>
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
          title: "Neue Freundschaftsanfrage",
          message: `${senderName} hat dir eine Freundschaftsanfrage gesendet.`,
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
    { id: "energy", label: "Energie", value: Math.round(energyValue), color: "#10b981" },
    { id: "data-quality", label: "Daten", value: Math.round(dataQualityValue), color: "#06b6d4" },
    { id: "care", label: "Pflege", value: Math.round(careValue), color: "#f59e0b" },
  ];

  const displayedOverallPlantHealth = isPlantHealthPending ? null : overallPlantHealth;
  const friendSeeds = Math.max(
    0,
    Number(friendRobotPlant?.wallet_balance ?? friendRobotPlant?.walletBalance ?? 0)
  );
  const friendClaimedTiles = Math.max(
    0,
    Number(friendRobotPlant?.claimed_tiles_count ?? friendRobotPlant?.claimedTilesCount ?? 0)
  );

  const cardBase = isLightUi
    ? "bg-white/35 border border-[#c8ac62]/30"
    : "bg-black/28 border border-[#f0e5a5]/22";
  const textPrimary = isLightUi ? "text-stone-900" : "text-white";
  const textSecondary = isLightUi ? "text-stone-700" : "text-stone-200";

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
        <CollectionFeatureRoot
          embedded
          profileUser={friendUser}
          friendEmail={friendEmail}
          readOnly
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
          resolvedPlantHealthState={resolvedPlantHealthState}
          displayedOverallPlantHealth={displayedOverallPlantHealth}
          healthStateBonus={healthStateBonus}
          healthStats={healthStats}
          isPlantHealthPending={isPlantHealthPending}
          friendLogoAssets={friendLogoAssets}
          sendFriendRequestMutation={sendFriendRequestMutation}
          showNoFriendAccessHint={showNoFriendAccessHint}
        />
      )}
    </FriendExperienceShell>
  );
}
