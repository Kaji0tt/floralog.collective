import RewardCard from "@/components/home/RewardCard";
import { LOGO_ACCESSORY_DEFAULT_UNLOCKED_IDS } from "@/lib/logoAccessoryAssets";

const isNonPurchasableReward = (reward) => {
  if (!reward) return false;
  return Number(reward.spark_price || 0) <= 0 && Number(reward.amber_price || 0) <= 0;
};

const isDefaultLogoAccessoryReward = (reward) =>
  LOGO_ACCESSORY_DEFAULT_UNLOCKED_IDS.has(String(reward?.value || "").trim());

/**
 * Horizontally scrollable list of locked rewards that are not purchasable with sparks or amber.
 */
export default function RewardCardWrapper({
  rewards = [],
  userRewards = [],
  isLightUi = false,
  completedWeeklyQuestCount = 0,
  completedMonthlyQuestCount = 0,
  quests = [],
  weeklyQuests = [],
  monthlyQuests = [],
  achievements = [],
  genera = [],
  plants = [],
  className = "",
}) {
  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((userReward) => userReward.reward_id)
  );
  const safeRewards = Array.isArray(rewards)
    ? rewards.filter(
      (reward) =>
        isNonPurchasableReward(reward) &&
        !reward.shop_hidden &&
        !isDefaultLogoAccessoryReward(reward) &&
        !unlockedRewardIds.has(reward.id)
    )
    : [];
  if (safeRewards.length === 0) return null;

  return (
    <div
      className={`-mx-1 flex min-h-0 snap-x snap-mandatory items-stretch gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {safeRewards.map((reward) => (
        <RewardCard
          key={reward.id}
          reward={reward}
          isUnlocked={unlockedRewardIds.has(reward.id)}
          isLightUi={isLightUi}
          completedWeeklyQuestCount={completedWeeklyQuestCount}
          completedMonthlyQuestCount={completedMonthlyQuestCount}
          quests={quests}
          weeklyQuests={weeklyQuests}
          monthlyQuests={monthlyQuests}
          achievements={achievements}
          genera={genera}
          plants={plants}
        />
      ))}
    </div>
  );
}
