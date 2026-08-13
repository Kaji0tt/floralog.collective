import RewardCard from "@/components/home/RewardCard";

/**
 * Horizontally scrollable list of all catalog rewards (unfiltered, catalog order).
 */
export default function RewardCardWrapper({
  rewards = [],
  userRewards = [],
  isLightUi = false,
  completedWeeklyQuestCount = 0,
  completedMonthlyQuestCount = 0,
  className = "",
}) {
  const safeRewards = Array.isArray(rewards) ? rewards : [];
  if (safeRewards.length === 0) return null;

  const unlockedRewardIds = new Set(
    (Array.isArray(userRewards) ? userRewards : []).map((userReward) => userReward.reward_id)
  );

  return (
    <div
      className={`-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar ${className}`}
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
