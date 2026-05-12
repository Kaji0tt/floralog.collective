import { useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Query } from "@/api/entities";
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

  useEffect(() => {
    if (!friendEmail) return;
    const unsubscribe = Query.Friend.subscribe((event) => {
      if (["create", "update", "delete"].includes(event.type)) {
        queryClient.invalidateQueries({ queryKey: ["allFriendRecords"] });
      }
    });
    return unsubscribe;
  }, [friendEmail, queryClient]);

  const { data: allFriendRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["allFriendRecords"],
    queryFn: () => Query.Friend.list(),
    enabled: !!friendEmail,
  });

  const friends = useMemo(() => {
    if (!friendEmail) return [];
    const emailL = friendEmail.toLowerCase();
    return allFriendRecords.filter(
      (f) =>
        (f.request_sent_by?.toLowerCase() === emailL ||
          f.request_sent_to?.toLowerCase() === emailL) &&
        f.status === "accepted"
    );
  }, [allFriendRecords, friendEmail]);

  const { data: allPublicProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["allPublicProfiles"],
    queryFn: () => Query.PublicProfile.list(),
  });

  const { data: logoAssets = [] } = useQuery({
    queryKey: ["logoAssets"],
    queryFn: () => Query.LogoAsset.list(),
    staleTime: 60000,
  });

  const getFriendData = (record) => {
    if (!friendEmail) return null;
    const otherEmail =
      record.request_sent_by?.toLowerCase() === friendEmail.toLowerCase()
        ? record.request_sent_to
        : record.request_sent_by;
    const profile = allPublicProfiles.find(
      (p) => p.user_email?.toLowerCase() === otherEmail?.toLowerCase()
    );
    return {
      id: record.id,
      email: otherEmail,
      name: profile?.display_name || profile?.full_name || otherEmail,
      logoAssets: resolveEquippedLogoAssetsWithCatalog(profile || {}, logoAssets),
      level: profile?.level || 1,
      title: profile?.selected_title || profile?.title || "Pflanzen-Anfänger",
    };
  };

  const handleFriendClick = (data) => {
    if (currentUser && data.email?.toLowerCase() === currentUser.email?.toLowerCase()) {
      navigate(createPageUrl("Home"));
    } else {
      navigate(createPageUrl(`FriendProfile?email=${data.email}`));
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
              currentUser &&
              data.email?.toLowerCase() === currentUser.email?.toLowerCase();

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
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shadow-md overflow-hidden flex-shrink-0 ${
                    isSelf
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                      : isLightUi
                      ? "bg-gradient-to-br from-stone-500 to-stone-600"
                      : "bg-gradient-to-br from-stone-600 to-stone-700"
                  }`}
                >
                  <CustomLogoAvatar
                    logoAssets={data.logoAssets}
                    className="w-full h-full"
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
