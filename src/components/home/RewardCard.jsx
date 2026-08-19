import { Award, ChevronRight, Gift, Image, Sparkles } from "lucide-react";
import GoldGradientCard from "@/components/home/GoldGradientCard";
import BadgeCircleIcon, { BADGE_CIRCLE_BORDER_GRADIENT } from "@/components/home/BadgeCircleIcon";

const REWARD_TYPE_ICONS = {
  background: Image,
  title: Award,
  animated_border: Sparkles,
  item: Gift,
};

const getRewardTypeIcon = (type) => REWARD_TYPE_ICONS[type] || Gift;

// Static "what needs to be done to unlock this" description (no live progress numbers here).
const buildRequirementDescription = (reward) => {
  if (!reward) return "";
  if (reward.requires_donor) return "Nur für Unterstützer.";
  if (reward.requires_referrals) return `Werbe ${reward.requires_referrals} Freund${reward.requires_referrals > 1 ? "e" : ""}.`;
  if (reward.requires_rare_plants) return `Entdecke ${reward.requires_rare_plants} seltene Pflanze${reward.requires_rare_plants > 1 ? "n" : ""}.`;
  if (reward.requires_gifts) return `Erhalte ${reward.requires_gifts} Geschenk${reward.requires_gifts > 1 ? "e" : ""}.`;
  if (reward.requires_weekly_quests) return `Schließe ${reward.requires_weekly_quests} Wochenquest${reward.requires_weekly_quests > 1 ? "s" : ""} ab.`;
  if (reward.requires_monthly_quests) return `Schließe ${reward.requires_monthly_quests} Monatsquest${reward.requires_monthly_quests > 1 ? "s" : ""} ab.`;
  if (reward.requires_quest) return "Schließe die verknüpfte Quest ab.";
  return "Noch nicht freigeschaltet.";
};

// Live progress (current/target) for the requirement types we actually have counters for.
const buildRewardProgress = (reward, { completedWeeklyQuestCount = 0, completedMonthlyQuestCount = 0 } = {}) => {
  if (!reward) return null;
  if (reward.requires_weekly_quests) {
    return { current: completedWeeklyQuestCount, target: reward.requires_weekly_quests, label: "Wochenquests" };
  }
  if (reward.requires_monthly_quests) {
    return { current: completedMonthlyQuestCount, target: reward.requires_monthly_quests, label: "Monatsquests" };
  }
  return null;
};

export default function RewardCard({
  reward,
  isUnlocked = false,
  isLightUi = false,
  completedWeeklyQuestCount = 0,
  completedMonthlyQuestCount = 0,
}) {
  const TypeIcon = getRewardTypeIcon(reward?.type);
  const progress = isUnlocked ? null : buildRewardProgress(reward, { completedWeeklyQuestCount, completedMonthlyQuestCount });
  const progressPercent = progress
    ? Math.min(100, Math.max(0, (progress.current / Math.max(1, progress.target)) * 100))
    : 0;

  return (
    <GoldGradientCard className="h-full w-52 shrink-0 snap-start" contentClassName="flex flex-col gap-1.5 p-2.5" blur>
      <div className="flex items-center gap-2">
        <BadgeCircleIcon size="2.5rem" className="shrink-0">
          <TypeIcon className="h-5 w-5 text-stone-50" />
        </BadgeCircleIcon>
        <p className="min-w-0 flex-1 line-clamp-2 text-[12px] font-semibold leading-tight">{reward?.display_name || "Belohnung"}</p>
        <ChevronRight className={`h-4 w-4 shrink-0 opacity-40 ${isLightUi ? "text-stone-500" : "text-stone-300"}`} />
      </div>

      <p className={`text-[10px] leading-snug ${isLightUi ? "text-stone-600" : "text-stone-300/80"}`}>
        {isUnlocked ? "Freigeschaltet" : buildRequirementDescription(reward)}
      </p>

      {progress && (
        <div className="flex flex-col gap-1">
          <p className={`text-[9px] font-medium ${isLightUi ? "text-stone-600" : "text-stone-300/70"}`}>
            {`${Math.min(progress.current, progress.target)} / ${progress.target} ${progress.label}`}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/25">
            <div
              className="h-full rounded-full"
              style={{ width: `${progressPercent}%`, background: BADGE_CIRCLE_BORDER_GRADIENT }}
            />
          </div>
        </div>
      )}
    </GoldGradientCard>
  );
}
