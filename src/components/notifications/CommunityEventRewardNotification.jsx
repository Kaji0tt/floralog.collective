import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/api/supabaseClient";
import { getCommunityEventTheme } from "@/lib/communityEvents";

const parsePayload = (notification) => {
  try {
    const parsed = JSON.parse(notification?.description || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * One-time reward reveal shown on the first login after a community event
 * was finalized (UserNotification type "community_event_result").
 */
export default function CommunityEventRewardNotification({ notification, onComplete }) {
  const payload = useMemo(() => parsePayload(notification), [notification]);
  const rewardIds = Array.isArray(payload.reward_ids) ? payload.reward_ids : [];
  const succeeded = payload.outcome === "succeeded";
  const sparks = Number(payload.sparks) || 0;
  // Older result notifications (Kastanien-Kartierung) carry no theme/icon → chestnut defaults.
  const theme = getCommunityEventTheme(payload.theme);
  const overlay = theme.overlay;
  const eventIcon = payload.icon_emoji || theme.emoji;
  const targetLabel = payload.target_label || "Kastanien";

  const { data: rewards = [] } = useQuery({
    queryKey: ["communityEventRewardPreview", rewardIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Rewards")
        .select("id, display_name, name, image_url")
        .in("id", rewardIds);
      if (error) throw error;
      const order = new Map(rewardIds.map((id, index) => [id, index]));
      return (data || []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },
    enabled: rewardIds.length > 0,
    staleTime: Infinity,
  });

  if (!notification) return null;

  const sparkleNodes = Array.from({ length: succeeded ? 18 : 8 }, (_, idx) => {
    const top = 5 + (idx % 6) * 14;
    const left = 4 + ((idx * 19) % 90);
    return (
      <motion.span
        key={`community-sparkle-${idx}`}
        className={`pointer-events-none absolute ${overlay.sparkle}`}
        style={{ top: `${top}%`, left: `${left}%` }}
        initial={{ opacity: 0, y: 6, scale: 0.7 }}
        animate={{ opacity: [0, 1, 0], y: [6, -18, -38], scale: [0.7, 1.15, 0.85] }}
        transition={{ duration: 2 + (idx % 4) * 0.25, delay: idx * 0.08, repeat: Infinity, ease: "easeOut" }}
      >
        {idx % 3 === 0 ? <span className="text-sm">{eventIcon}</span> : <Sparkles className="h-3.5 w-3.5" />}
      </motion.span>
    );
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2150] flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[3px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 28 }}
          animate={{ opacity: 1, scale: [1, 1.018, 1], y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border ${overlay.panel} p-6 sm:p-8 text-stone-100 shadow-[0_36px_120px_rgba(0,0,0,0.75)]`}
        >
          <div className="absolute inset-0 pointer-events-none">{sparkleNodes}</div>

          <div className="relative z-10">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${overlay.chip}`}>
              <Users className="h-4 w-4" />
              Community Event
            </div>

            <h3 className={`mt-4 text-2xl sm:text-3xl font-semibold ${overlay.heading}`}>
              {notification.title || (succeeded ? "Geschafft!" : "Event beendet")}
            </h3>

            <p className="mt-3 text-sm sm:text-base text-stone-300 leading-relaxed">
              {notification.message}
            </p>

            {Number.isFinite(Number(payload.community_target)) && Number(payload.community_target) > 0 && (
              <div className="mt-4">
                <div className={`flex justify-between text-xs ${overlay.muted}`}>
                  <span>Community</span>
                  <span>{payload.community_progress} / {payload.community_target}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/40">
                  <motion.div
                    className={`h-full rounded-full ${overlay.bar}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (Number(payload.community_progress) / Number(payload.community_target)) * 100)}%` }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
                <p className={`mt-1 text-xs ${overlay.muted}`}>Dein Beitrag: {payload.contributed_count} {targetLabel}</p>
              </div>
            )}

            <div className={`mt-5 rounded-2xl border bg-black/35 px-4 py-4 sm:px-5 sm:py-5 ${overlay.box}`}>
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.6 }}
                className={`flex items-center justify-center gap-2 ${overlay.accent}`}
              >
                <Zap className={`h-6 w-6 ${overlay.icon}`} />
                <span className="text-3xl sm:text-4xl font-bold leading-none">+{sparks} Funken</span>
              </motion.div>

              {rewards.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {rewards.map((reward, index) => (
                    <motion.div
                      key={reward.id}
                      initial={{ scale: 0, rotate: -20, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.9 + index * 0.25 }}
                      className={`flex w-24 flex-col items-center gap-1 rounded-xl border p-2 ${overlay.reward}`}
                    >
                      {reward.image_url ? (
                        <img src={reward.image_url} alt={reward.display_name || reward.name} className="h-16 w-16 object-contain" />
                      ) : (
                        <span className="text-4xl">🎁</span>
                      )}
                      <span className={`text-center text-xs font-semibold ${overlay.accent}`}>
                        {reward.display_name || reward.name}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className={`mt-3 text-center text-sm ${overlay.muted}`}>
                {rewards.length > 0 ? "wurden freigeschaltet und deinem Konto gutgeschrieben" : "wurden deinem Konto gutgeschrieben"}
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                onClick={() => onComplete?.()}
                className={`min-w-36 text-black font-semibold ${overlay.button}`}
              >
                {succeeded ? `Danke, Team! ${eventIcon}` : `Nächstes Mal! ${eventIcon}`}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
