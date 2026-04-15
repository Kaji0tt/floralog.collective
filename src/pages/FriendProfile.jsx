import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Query } from "@/api/entities";
import { createUserNotification } from "@/api/notificationService";
import { sendFriendRequest } from "@/api/friendService";
import { createPageUrl } from "@/utils";
import { getNameFontSize } from "@/lib/utils";
import { useUiTheme } from "@/lib/UiThemeContext";
import { useFriendData } from "@/components/friends/hooks/useFriendData";
import FriendExperienceShell from "@/components/friends/FriendExperienceShell";
import { motion } from "framer-motion";
import { Leaf, Trophy, Target, Users, Map as MapIcon, UserPlus, Clock, Scroll } from "lucide-react";

export default function FriendProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLightUi } = useUiTheme();

  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get("email");

  const {
    friendUser,
    currentUser,
    isFriend,
    hasPendingRequest,
    averageColor,
    isLoading,
  } = useFriendData(friendEmail);

  // ── Extra data queries ────────────────────────────────────────────────────────
  const { data: plants = [] } = useQuery({
    queryKey: ["plants"],
    queryFn: () => Query.Plant.list(),
    staleTime: 60_000,
  });

  const { data: genera = [] } = useQuery({
    queryKey: ["genera"],
    queryFn: () => Query.PlantGenus.list(),
    staleTime: 300_000,
  });

  const { data: quests = [] } = useQuery({
    queryKey: ["quests"],
    queryFn: () => Query.Quest.list("quest_number"),
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ["userQuests", friendEmail],
    queryFn: () => Query.UserQuest.filter({ created_by: friendEmail }),
    enabled: !!friendEmail,
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ["userAchievements", friendEmail],
    queryFn: () => Query.UserAchievement.filter({ created_by: friendEmail }),
    enabled: !!friendEmail,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ["friends", friendEmail],
    queryFn: async () => {
      if (!friendEmail) return [];
      const allFriends = await Query.Friend.list();
      return allFriends.filter(
        (f) =>
          (f.request_sent_by?.toLowerCase() === friendEmail.toLowerCase() ||
            f.request_sent_to?.toLowerCase() === friendEmail.toLowerCase()) &&
          f.status === "accepted"
      );
    },
    enabled: !!friendEmail,
    staleTime: 10_000,
  });

  const { data: friendDiscoveries = [] } = useQuery({
    queryKey: ["friendDiscoveries", friendUser?.auth_id],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: friendUser.auth_id }),
    enabled: !!friendUser?.auth_id,
    staleTime: 30_000,
  });

  // ── Send friend-request mutation ─────────────────────────────────────────────
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
          title: "🤝 Neue Freundschaftsanfrage",
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

  // ── Derived stats ────────────────────────────────────────────────────────────
  const discoveredGenera = genera.filter((g) => {
    const genusPlants = plants.filter(
      (p) =>
        p.genus_category === g.category &&
        p.genus_number === g.category_dex_number
    );
    return genusPlants.some((p) => friendDiscoveries.some((d) => d.plant_id === p.id));
  }).length;

  const availableQuests = quests.filter(
    (q) => !userQuests.some((uq) => uq.quest_id === q.id && uq.completed)
  ).length;

  // ── Style tokens ─────────────────────────────────────────────────────────────
  const cardBase = isLightUi
    ? "bg-white/65 border border-[#c8ac62]/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
    : "bg-black/30 border border-[#f0e5a5]/20 shadow-[inset_0_1px_0_rgba(214,255,230,0.12)]";
  const textPrimary = isLightUi ? "text-stone-900" : "text-stone-100";
  const textSecondary = isLightUi ? "text-stone-600" : "text-stone-300";

  const statButtons = [
    {
      icon: Scroll,
      label: "Gattungen",
      value: discoveredGenera,
      gradient: isLightUi
        ? "bg-gradient-to-b from-[#d4f7d4]/95 via-[#b3eab3]/95 to-[#8ad48a]/95"
        : "bg-gradient-to-b from-[#1a3a2a]/90 via-[#0e2218]/96 to-[#040f09]/99",
      shadow: isLightUi
        ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 12px rgba(60,140,60,0.18)"
        : "inset 0 1px 0 rgba(180,255,200,0.14), 0 6px 12px rgba(0,0,0,0.28)",
      onClick: isFriend
        ? () => navigate(createPageUrl(`FriendCollection?email=${friendEmail}`))
        : null,
    },
    {
      icon: Trophy,
      label: "Erfolge",
      value: userAchievements.length,
      gradient: isLightUi
        ? "bg-gradient-to-b from-[#fef3c7]/95 via-[#fde68a]/95 to-[#fbbf24]/95"
        : "bg-gradient-to-b from-[#3a2e0a]/90 via-[#231c06]/96 to-[#0d0b00]/99",
      shadow: isLightUi
        ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 12px rgba(180,130,20,0.18)"
        : "inset 0 1px 0 rgba(255,230,100,0.14), 0 6px 12px rgba(0,0,0,0.28)",
      onClick: isFriend
        ? () => navigate(createPageUrl(`FriendAchievements?email=${friendEmail}`))
        : null,
    },
    {
      icon: Target,
      label: "Aufgaben",
      value: availableQuests,
      gradient: isLightUi
        ? "bg-gradient-to-b from-[#dbeafe]/95 via-[#bfdbfe]/95 to-[#93c5fd]/95"
        : "bg-gradient-to-b from-[#0a1e3a]/90 via-[#061025]/96 to-[#020610]/99",
      shadow: isLightUi
        ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 12px rgba(60,100,200,0.15)"
        : "inset 0 1px 0 rgba(150,200,255,0.12), 0 6px 12px rgba(0,0,0,0.28)",
      onClick: null,
    },
    {
      icon: Users,
      label: "Freunde",
      value: friends.length,
      gradient: isLightUi
        ? "bg-gradient-to-b from-[#ffedd5]/95 via-[#fed7aa]/95 to-[#fdba74]/95"
        : "bg-gradient-to-b from-[#3a1a0a]/90 via-[#220e04]/96 to-[#0d0400]/99",
      shadow: isLightUi
        ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 12px rgba(180,100,30,0.15)"
        : "inset 0 1px 0 rgba(255,200,140,0.12), 0 6px 12px rgba(0,0,0,0.28)",
      onClick: isFriend
        ? () => navigate(createPageUrl(`FriendFriendsList?email=${friendEmail}`))
        : null,
    },
  ];

  const friendDisplayName =
    friendUser?.display_name || friendUser?.full_name || friendEmail;
  const friendTitle =
    friendUser?.selected_title || friendUser?.title || "Pflanzen-Entdecker";

  return (
    <FriendExperienceShell
      friendUser={friendUser}
      activeTab="profile"
      friendEmail={friendEmail}
      averageColor={averageColor}
      isLoading={isLoading}
      accessDenied={false}
    >
      <div className={`h-full overflow-y-auto space-y-3 pb-2 ${textPrimary}`}>
        {/* Profile hero card */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`rounded-2xl backdrop-blur-md p-4 ${cardBase}`}
        >
          {/* Avatar + name row */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-[clamp(3rem,10vw,4.5rem)] h-[clamp(3rem,10vw,4.5rem)] rounded-xl bg-gradient-to-br from-emerald-600 to-green-700 flex items-center justify-center shadow-xl overflow-hidden ring-2 ring-white/30 flex-shrink-0">
              {friendUser?.avatar_url ? (
                <img src={friendUser.avatar_url} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <Leaf className="w-8 h-8 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className={`font-bold leading-tight truncate ${textPrimary}`}
                style={{ fontSize: getNameFontSize(friendDisplayName) }}
                title={friendDisplayName}
              >
                {friendDisplayName}
              </h1>
              <p className={`text-sm truncate mt-0.5 ${textSecondary}`}>{friendTitle}</p>
              {friendUser?.level && (
                <p className={`text-xs mt-0.5 ${textSecondary}`}>Level {friendUser.level}</p>
              )}
            </div>
          </div>

          {/* Stat buttons */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {statButtons.map((stat, i) => (
              <motion.button
                key={stat.label}
                onClick={stat.onClick ?? undefined}
                disabled={!stat.onClick}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.04 }}
                whileHover={stat.onClick ? { scale: 1.04 } : {}}
                whileTap={stat.onClick ? { scale: 0.96 } : {}}
                className={`rounded-xl p-3 flex flex-col items-center gap-1 backdrop-blur-sm transition-all ${stat.gradient} ${!stat.onClick ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                style={{ boxShadow: stat.shadow }}
              >
                <stat.icon className={`w-5 h-5 ${textPrimary}`} />
                <span className={`text-lg font-bold leading-none ${textPrimary}`}>{stat.value}</span>
                <span className={`text-[10px] font-medium hidden sm:block ${textSecondary}`}>{stat.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Action button */}
          <div
            className={`rounded-xl p-3 backdrop-blur-sm ${
              isLightUi
                ? "bg-white/40 border border-[#c8ac62]/25"
                : "bg-black/20 border border-[#f0e5a5]/15"
            }`}
          >
            {isFriend ? (
              <button
                onClick={() => navigate(createPageUrl("Map"))}
                className={`flex items-center justify-center gap-2 w-full font-semibold transition-opacity hover:opacity-80 ${textPrimary}`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md ${
                    isLightUi
                      ? "bg-gradient-to-br from-emerald-500 to-green-600"
                      : "bg-gradient-to-br from-emerald-700 to-green-800"
                  }`}
                >
                  <MapIcon className="w-4 h-4 text-white" />
                </div>
                <span>Zur Karte</span>
              </button>
            ) : hasPendingRequest ? (
              <button
                disabled
                className={`flex items-center justify-center gap-2 w-full opacity-55 cursor-not-allowed font-semibold ${textSecondary}`}
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
                className={`flex items-center justify-center gap-2 w-full font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 ${textPrimary}`}
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
                <span>
                  {sendFriendRequestMutation.isPending ? "Wird gesendet…" : "Freund hinzufügen"}
                </span>
              </button>
            )}
          </div>
        </motion.div>

        {/* "Not friends yet" hint */}
        {!isFriend && !hasPendingRequest && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`rounded-2xl backdrop-blur-md p-4 text-center ${cardBase}`}
          >
            <p className={`text-sm ${textSecondary}`}>
              Schicke eine Freundschaftsanfrage, um die Erfolge, Sammlungen und Freundesliste von{" "}
              <span className={`font-semibold ${textPrimary}`}>{friendDisplayName}</span> zu sehen.
            </p>
          </motion.div>
        )}
      </div>
    </FriendExperienceShell>
  );
}
