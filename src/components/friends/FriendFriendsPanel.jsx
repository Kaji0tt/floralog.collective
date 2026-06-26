import { useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { createPageUrl } from "@/utils";
import { useUiTheme } from "@/lib/UiThemeContext";
import { motion } from "framer-motion";
import { Users, Star, ChevronRight, Leaf, Loader2 } from "lucide-react";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";

export default function FriendFriendsPanel({ friendUser, friendEmail, currentUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLightUi } = useUiTheme();
  const friendAuthId = friendUser?.auth_id || null;

  useEffect(() => {
    if (!friendAuthId) return;
    // Invalidate on any Friend change so the panel stays in sync
    const unsubscribe = Query.Friend.subscribe((event) => {
      if (["create", "update", "delete"].includes(event.type)) {
        queryClient.invalidateQueries({ queryKey: ["friendFriendsList", friendAuthId] });
      }
    });
    return unsubscribe;
  }, [friendAuthId, queryClient]);

  const { data: allFriendRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["friendFriendsList", friendAuthId],
    queryFn: async () => {
      if (!friendAuthId) return [];
      const { data, error } = await supabase.rpc("get_user_friends_public", {
        p_user_auth_id: friendAuthId,
      });
      if (error) {
        console.error("[FriendFriendsPanel] get_user_friends_public error:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!friendAuthId,
  });

  const friends = useMemo(() => allFriendRecords, [allFriendRecords]);

  const { data: allPublicProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["allPublicProfiles"],
    queryFn: () => Query.PublicProfile.list(),
  });

  const { data: logoAssets = [] } = useQuery({
    queryKey: ["logoAssets"],
    queryFn: () => Query.LogoAsset.list(),
    staleTime: 60000,
  });

  const profileByEmail = useMemo(
    () =>
      new Map(
        (allPublicProfiles || [])
          .filter((profile) => !!profile?.user_email)
          .map((profile) => [String(profile.user_email).toLowerCase(), profile])
      ),
    [allPublicProfiles]
  );

  const profileByAuthId = useMemo(
    () =>
      new Map(
        (allPublicProfiles || [])
          .filter((profile) => !!profile?.auth_id)
          .map((profile) => [profile.auth_id, profile])
      ),
    [allPublicProfiles]
  );

  const getFriendData = (record) => {
    const sentBy = record.request_sent_by || "";
    const sentTo = record.request_sent_to || "";
    const sentByL = sentBy.toLowerCase();
    const sentToL = sentTo.toLowerCase();
    const friendEmailL = friendEmail?.toLowerCase() || "";

    let otherEmail = null;
    if (friendEmailL && sentByL === friendEmailL) {
      otherEmail = sentTo;
    } else if (friendEmailL && sentToL === friendEmailL) {
      otherEmail = sentBy;
    }

    let otherProfile = otherEmail ? profileByEmail.get(otherEmail.toLowerCase()) : null;
    let otherAuthId = otherProfile?.auth_id || null;

    // Fall back to auth-based matching when participant emails are outdated.
    if (!otherAuthId && record.auth_id && record.auth_id !== friendAuthId) {
      otherAuthId = record.auth_id;
    }

    if (otherAuthId) {
      otherProfile = profileByAuthId.get(otherAuthId) || otherProfile;
    }

    if (!otherEmail && otherProfile?.user_email) {
      otherEmail = otherProfile.user_email;
    }

    if (!otherEmail && !otherProfile) return null;

    return {
      id: record.id,
      authId: otherProfile?.auth_id || otherAuthId || null,
      email: otherEmail,
      name: otherProfile?.display_name || otherProfile?.full_name || otherEmail,
      logoAssets: resolveEquippedLogoAssetsWithCatalog(otherProfile || {}, logoAssets),
      level: otherProfile?.level || 1,
      title: otherProfile?.selected_title || otherProfile?.title || "Pflanzen-Anfänger",
    };
  };

  const handleFriendClick = (data) => {
    const isCurrentUserByAuth =
      !!currentUser?.id && !!data.authId && data.authId === currentUser.id;
    const isCurrentUserByEmail =
      !!currentUser?.email &&
      !!data.email &&
      data.email.toLowerCase() === currentUser.email.toLowerCase();

    if (isCurrentUserByAuth || isCurrentUserByEmail) {
      navigate(createPageUrl("Home"));
    } else if (data.email) {
      navigate(createPageUrl(`FriendProfile?email=${encodeURIComponent(data.email)}`));
    } else {
      navigate(createPageUrl("Friends"));
    }
  };

  const cardBase = isLightUi
    ? "bg-white/65 border border-[#c8ac62]/35 backdrop-blur-md"
    : "bg-black/30 border border-[#f0e5a5]/20 backdrop-blur-md";
  const cardSelf = isLightUi
    ? "bg-emerald-50/70 border border-emerald-300/60 backdrop-blur-md"
    : "bg-emerald-900/20 border border-emerald-400/30 backdrop-blur-md";
  const textPrimary = isLightUi ? "text-stone-900" : "text-stone-100";
  const textSecondary = isLightUi ? "text-stone-600" : "text-stone-300";
  const textMuted = isLightUi ? "text-stone-500" : "text-stone-400";

  if ((recordsLoading || profilesLoading) && allFriendRecords.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Freundesliste wird geladen
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-[clamp(0.75rem,2vw,1.25rem)] pb-[clamp(1rem,2.5vh,1.5rem)]">
      {friends.length === 0 ? (
        <div className={`rounded-2xl p-10 text-center ${cardBase}`}>
          <Users className={`w-12 h-12 mx-auto mb-3 ${textMuted}`} />
          <p className={`font-semibold mb-1 ${textSecondary}`}>
            Noch keine Freunde
          </p>
          <p className={`text-sm ${textMuted}`}>
            {friendUser?.display_name || friendUser?.full_name || friendEmail} hat noch
            keine Freunde hinzugefügt.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {friends.map((record, index) => {
            const data = getFriendData(record);
            if (!data) return null;
            const isSelf =
              !!currentUser &&
              ((currentUser.id && data.authId && currentUser.id === data.authId) ||
                (currentUser.email &&
                  data.email &&
                  data.email.toLowerCase() === currentUser.email.toLowerCase()));

            return (
              <motion.button
                key={record.id}
                onClick={() => handleFriendClick(data)}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group text-left ${
                  isSelf ? cardSelf : cardBase
                }`}
              >
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shadow-md overflow-hidden flex-shrink-0">
                  <CustomLogoAvatar
                    logoAssets={data.logoAssets}
                    className="w-full h-full"
                    tooltipText={data.name || data.email || "Freund"}
                    fallbackText={data.name?.[0]?.toUpperCase() || data.email?.[0]?.toUpperCase()}
                    fallbackClassName="text-white text-base font-bold"
                    leafClassName="w-5 h-5 text-white"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`font-bold truncate flex items-center gap-2 ${textPrimary}`}>
                    {data.name}
                    {isSelf && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          isLightUi
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-emerald-900/40 text-emerald-300"
                        }`}
                      >
                        Du
                      </span>
                    )}
                  </div>
                  <div className={`text-xs flex items-center gap-1 mt-0.5 ${textSecondary}`}>
                    <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <span className="truncate">
                      Level {data.level} • {data.title}
                    </span>
                  </div>
                </div>

                <ChevronRight
                  className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-1 ${textMuted}`}
                />
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
