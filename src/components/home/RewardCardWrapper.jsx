import RewardCard from "@/components/home/RewardCard";

const isNonPurchasableReward = (reward) => {
  if (!reward) return false;
  return Number(reward.spark_price || 0) <= 0 && Number(reward.amber_price || 0) <= 0;
};

/**
 * Horizontally scrollable list of rewards that are not purchasable with sparks or amber.
 */
export default function RewardCardWrapper({
  rewards = [],
  userRewards = [],
  isLightUi = false,
  completedWeeklyQuestCount = 0,
  completedMonthlyQuestCount = 0,
  className = "",
}) {
  const safeRewards = Array.isArray(rewards) ? rewards.filter(isNonPurchasableReward) : [];
  if (safeRewards.length === 0) return null;

  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((userReward) => userReward.reward_id)
  );

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
        />
      ))}
    </div>
  );
}
