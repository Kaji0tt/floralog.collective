import { Gift, Lock, CheckCircle2 } from "lucide-react";
import GoldGradientCard from "@/components/home/GoldGradientCard";

const buildRequirementHint = (reward, { completedWeeklyQuestCount = 0, completedMonthlyQuestCount = 0 } = {}) => {
  if (!reward) return "";
  if (reward.requires_donor) return "Nur für Unterstützer.";
  if (reward.requires_referrals) return `Werbe ${reward.requires_referrals} Freund${reward.requires_referrals > 1 ? "e" : ""}.`;
  if (reward.requires_rare_plants) return `Entdecke ${reward.requires_rare_plants} seltene Pflanze${reward.requires_rare_plants > 1 ? "n" : ""}.`;
  if (reward.requires_gifts) return `Erhalte ${reward.requires_gifts} Geschenk${reward.requires_gifts > 1 ? "e" : ""}.`;
  if (reward.requires_weekly_quests) return `Wochenquests: ${completedWeeklyQuestCount}/${reward.requires_weekly_quests}`;
  if (reward.requires_monthly_quests) return `Monatsquests: ${completedMonthlyQuestCount}/${reward.requires_monthly_quests}`;
  if (reward.requires_quest) return "Schließe die verknüpfte Quest ab.";
  return "Noch nicht freigeschaltet.";
};

export default function RewardCard({
  reward,
  isUnlocked = false,
  isLightUi = false,
  completedWeeklyQuestCount = 0,
  completedMonthlyQuestCount = 0,
}) {
  const isImageValue = typeof reward?.value === "string" && /^https?:\/\//.test(reward.value);
  const previewImage = reward?.image_url || (reward?.type === "background" && isImageValue ? reward.value : "");
  const swatchColor = !previewImage && reward?.type === "background" ? reward?.color : null;
  const hint = isUnlocked ? null : buildRequirementHint(reward, { completedWeeklyQuestCount, completedMonthlyQuestCount });

  return (
    <GoldGradientCard className="w-28 shrink-0 snap-start" contentClassName="flex h-36 flex-col gap-1.5 p-2">
      <div className="relative h-16 w-full overflow-hidden rounded-xl bg-black/20">
        {previewImage ? (
          <img src={previewImage} alt={reward?.display_name || ""} className="h-full w-full object-cover" />
        ) : swatchColor ? (
          <div className="h-full w-full" style={{ background: swatchColor }} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gift className={`h-6 w-6 ${isLightUi ? "text-stone-500" : "text-stone-300/70"}`} />
          </div>
        )}
        <span
          className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full ${
            isUnlocked ? "bg-emerald-500/85" : "bg-black/60"
          }`}
        >
          {isUnlocked ? <CheckCircle2 className="h-3 w-3 text-white" /> : <Lock className="h-3 w-3 text-stone-200" />}
        </span>
      </div>
      <p className="line-clamp-1 text-[11px] font-semibold">{reward?.display_name || "Belohnung"}</p>
      <p className={`line-clamp-2 text-[9px] leading-snug ${isLightUi ? "text-stone-600" : "text-stone-300/75"}`}>
        {isUnlocked ? "Freigeschaltet" : hint}
      </p>
    </GoldGradientCard>
  );
}
