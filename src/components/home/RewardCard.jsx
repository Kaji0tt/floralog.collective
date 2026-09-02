import { Award, BookImage, ChevronRight, Circle, CircleDot, CircleUserRound, Gift, Sparkles } from "lucide-react";
import BadgeCircleIcon, {
  MUTED_CIRCLE_BACKGROUND_GRADIENT,
  MUTED_CIRCLE_BORDER_GRADIENT,
  MUTED_CIRCLE_SHADOW,
} from "@/components/home/BadgeCircleIcon";

const REWARD_TYPE_ICONS = {
  background: BookImage,
  title: Award,
  animated_border: Sparkles,
  item: Gift,
};

const getRewardTypeIcon = (reward) => {
  const value = String(reward?.value || "").trim();
  if (value.startsWith("border_")) return Circle;
  if (value.startsWith("face_")) return CircleUserRound;
  if (value.startsWith("plant_")) return CircleDot;
  return REWARD_TYPE_ICONS[reward?.type] || Gift;
};

const getQuestRequirementDescription = (quest) => {
  if (!quest) return null;

  const requirement = quest.requirement || quest.description;
  return requirement ? `${quest.title}: ${requirement}` : `Schließe die Quest „${quest.title}“ ab.`;
};

const getAchievementRequirementDescription = (achievement) => {
  if (!achievement) return null;

  const requirement = achievement.requirement || achievement.description;
  return requirement ? `${achievement.title}: ${requirement}` : `Erreiche den Erfolg „${achievement.title}“.`;
};

const getZoneRewardRequirementDescription = (reward, { genera = [], plants = [] } = {}) => {
  const zoneNames = {
    water: "Wasserzone",
    forest: "Waldzone",
    meadow: "Wiesenzone",
    urban: "Urbanzone",
  };
  const genusId = String(reward?.requires_plant_genus_id || "").trim();
  const speciesId = String(reward?.requires_plant_species_id || "").trim();
  const zoneName = zoneNames[String(reward?.requires_zone_theme || "").trim()];
  const genusName = genusId ? genera.find((genus) => genus.id === genusId)?.genus_name : null;
  const speciesName = speciesId ? plants.find((plant) => plant.id === speciesId)?.species_name : null;
  const plantName = speciesName || genusName;

  return plantName && zoneName ? `Scanne ${plantName} in einer ${zoneName}.` : null;
};

const formatRandomChance = (randomChance) => {
  const denominator = Number(randomChance);
  if (!Number.isFinite(denominator) || denominator <= 0) return null;

  return `${Number((100 / denominator).toFixed(2)).toLocaleString("de-DE")}%`;
};

// Static "what needs to be done to unlock this" description (no live progress numbers here).
const buildRequirementDescription = (
  reward,
  { quests = [], weeklyQuests = [], monthlyQuests = [], achievements = [], genera = [], plants = [] } = {}
) => {
  if (!reward) return "";
  const specificQuest = quests.find((quest) => quest.id === reward.requires_quest);
  if (specificQuest) return getQuestRequirementDescription(specificQuest);
  const zoneRequirement = getZoneRewardRequirementDescription(reward, { genera, plants });
  if (zoneRequirement) return zoneRequirement;
  if (reward.requires_donor) return "Nur für Unterstützer.";
  if (reward.requires_referrals) return `Werbe ${reward.requires_referrals} Freund${reward.requires_referrals > 1 ? "e" : ""}.`;
  if (reward.requires_rare_plants) return `Entdecke ${reward.requires_rare_plants} seltene Pflanze${reward.requires_rare_plants > 1 ? "n" : ""}.`;
  if (reward.requires_gifts) return `Erhalte ${reward.requires_gifts} Geschenk${reward.requires_gifts > 1 ? "e" : ""}.`;
  if (reward.requires_weekly_quests) return `Schließe ${reward.requires_weekly_quests} Wochenquest${reward.requires_weekly_quests > 1 ? "s" : ""} ab.`;
  if (reward.requires_monthly_quests) return `Schließe ${reward.requires_monthly_quests} Monatsquest${reward.requires_monthly_quests > 1 ? "s" : ""} ab.`;
  if (reward.requires_quest) return "Schließe die verknüpfte Quest ab.";

  const linkedQuest = [...quests, ...weeklyQuests, ...monthlyQuests].find(
    (quest) => quest.reward_name === reward.name
  );
  if (linkedQuest) return getQuestRequirementDescription(linkedQuest);

  const linkedAchievement = achievements.find((achievement) => achievement.reward_name === reward.name);
  if (linkedAchievement) return getAchievementRequirementDescription(linkedAchievement);

  const randomEventDescriptions = {
    scan: "Kann zufällig bei einem Scan freigeschaltet werden",
    weekly_scan: "Kann zufällig bei einem wöchentlichen Scan freigeschaltet werden",
    monthly_scan: "Kann zufällig bei einem monatlichen Scan freigeschaltet werden",
    gift_scan: "Kann zufällig bei einem Geschenk-Scan freigeschaltet werden",
    rare_scan: "Kann zufällig beim Scan einer seltenen Pflanze freigeschaltet werden",
  };
  const randomEventDescription = randomEventDescriptions[reward.random_event];
  const randomChance = formatRandomChance(reward.random_chance);
  return randomEventDescription
    ? `${randomEventDescription}${randomChance ? ` (${randomChance} Chance).` : "."}`
    : "Wird durch eine besondere Spielaktion freigeschaltet.";
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
  quests = [],
  weeklyQuests = [],
  monthlyQuests = [],
  achievements = [],
  genera = [],
  plants = [],
}) {
  const TypeIcon = getRewardTypeIcon(reward);
  const progress = isUnlocked ? null : buildRewardProgress(reward, { completedWeeklyQuestCount, completedMonthlyQuestCount });
  const progressPercent = progress
    ? Math.min(100, Math.max(0, (progress.current / Math.max(1, progress.target)) * 100))
    : 0;

  const borderGradient = isLightUi
    ? "linear-gradient(to bottom right, #000000, #272625, rgba(143,107,34,0.7))"
    : "linear-gradient(to bottom right, #333333, rgba(70, 67, 58, 0.85), #8f6b22)";

  return (
    <div className="relative h-full w-48 shrink-0 snap-start rounded-2xl shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
      {/* Dedicated blur layer, kept between content and the border-mask sibling below (avoids iOS compositing bug). */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 rounded-2xl backdrop-blur-sm ${isLightUi ? "bg-white/40" : "bg-black/20"}`}
      />
      <div className="relative flex h-full flex-col gap-1.5 p-2.5">
        <div className="flex items-center gap-2">
          <BadgeCircleIcon
            size="2rem"
            className="shrink-0"
            borderGradient={MUTED_CIRCLE_BORDER_GRADIENT}
            backgroundGradient={MUTED_CIRCLE_BACKGROUND_GRADIENT}
            shadow={MUTED_CIRCLE_SHADOW}
          >
            <TypeIcon className="h-4 w-4 text-stone-200" />
          </BadgeCircleIcon>
          <p className={`min-w-0 flex-1 line-clamp-2 text-[11px] font-medium leading-tight ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
            {reward?.display_name || "Belohnung"}
          </p>
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 opacity-30 ${isLightUi ? "text-stone-500" : "text-stone-300"}`} />
        </div>

        <p className={`text-[9.5px] leading-snug ${isLightUi ? "text-stone-500" : "text-stone-400/80"}`}>
          {isUnlocked
            ? "Freigeschaltet"
            : buildRequirementDescription(reward, {
              quests,
              weeklyQuests,
              monthlyQuests,
              achievements,
              genera,
              plants,
            })}
        </p>

        {progress && (
          <div className="flex flex-col gap-1">
            <p className={`text-[9px] font-medium ${isLightUi ? "text-stone-500" : "text-stone-400/70"}`}>
              {`${Math.min(progress.current, progress.target)} / ${progress.target} ${progress.label}`}
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full rounded-full opacity-70"
                style={{ width: `${progressPercent}%`, background: MUTED_CIRCLE_BORDER_GRADIENT }}
              />
            </div>
          </div>
        )}
      </div>
      <div aria-hidden="true" className="gold-gradient-border-mask gold-gradient-border-mask-thin" style={{ background: borderGradient }} />
    </div>
  );
}
