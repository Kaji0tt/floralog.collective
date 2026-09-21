import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Leaf, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { getPublicPlayerProfile } from "@/api/publicPlayerProfile";
import GoldGradientCard from "@/components/home/GoldGradientCard";
import BadgeCircleIcon from "@/components/home/BadgeCircleIcon";
import { formatProfileBadgeMetricValue, getProfileBadgeDefinitionById } from "@/lib/profileBadges";
import { getUniqueBadgeById } from "@/lib/profileUniqueBadges";
import { getProfileBadgeIconComponent } from "@/lib/profileBadgeIcons";

const getBadgeAccomplishment = (badge, badgeMetrics) => {
  const value = badgeMetrics?.[badge.metricKey];
  if (!badge.metricKey) return badge.description || "Profil-Abzeichen";
  if (!Number.isFinite(Number(value))) return "Wert nicht verfügbar";
  return formatProfileBadgeMetricValue(badge, value);
};

export default function PlayerInfoCard({ playerAuthId, fallbackName, logo, onNavigate }) {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["publicProfile", playerAuthId],
    queryFn: () => getPublicPlayerProfile(playerAuthId),
    enabled: Boolean(playerAuthId),
    staleTime: 60_000,
  });

  const displayName = profile?.display_name || profile?.full_name || fallbackName || "Spieler";
  const title = profile?.selected_title || profile?.title || "Pflanzen-Entdecker";
  const badges = (Array.isArray(profile?.selected_badge_ids) ? profile.selected_badge_ids : [])
    .slice(0, 3)
    .map((id) => getProfileBadgeDefinitionById(id) || getUniqueBadgeById(id))
    .filter(Boolean);

  const openProfile = () => {
    if (!playerAuthId) return;
    onNavigate?.();
    navigate(createPageUrl(`FriendProfile?auth_id=${encodeURIComponent(playerAuthId)}`));
  };

  return (
    <GoldGradientCard
      blur
      rounded="2xl"
      className="w-[min(22rem,calc(100vw-1.5rem))]"
      contentClassName="p-4"
      borderClassName="gold-gradient-border-mask-thin"
    >
      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#f0e5a5]" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-24 w-24 shrink-0">{logo}</div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold">{displayName}</h2>
              <p className="truncate text-xs text-stone-300">{profile?.bot_name || title}</p>
              {profile?.bot_name && <p className="truncate text-[10px] text-stone-400">{title}</p>}
            </div>
          </div>

          {badges.length > 0 && (
            <div className="rounded-xl border border-[#f0e5a5]/20 bg-black/20 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-stone-400">
                  Ausgewählte Abzeichen
                </span>
                <span className="text-[9px] text-stone-400">{badges.length}/3</span>
              </div>

              <div className="space-y-2" aria-label="Ausgewählte Badges">
                {badges.map((badge) => {
                  const Icon = getProfileBadgeIconComponent(badge.iconKey) || Leaf;
                  return (
                    <div key={badge.id} className="flex min-w-0 items-center gap-2.5">
                      <BadgeCircleIcon size="2rem">
                        <Icon className="h-3.5 w-3.5 text-[#f5c542]" />
                      </BadgeCircleIcon>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-semibold text-stone-100">{badge.label}</p>
                        <p className="truncate text-[9px] text-stone-400">
                          {getBadgeAccomplishment(badge, profile?.badge_metrics)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={openProfile}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#f0e5a5]/35 bg-black/30 text-sm font-semibold text-[#f7f0c1] transition-colors hover:bg-black/45"
          >
            Profil öffnen
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </GoldGradientCard>
  );
}