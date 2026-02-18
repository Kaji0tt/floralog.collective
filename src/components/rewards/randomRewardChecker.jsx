import { Query } from "@/api/entities";

/**
 * Prüft ob zufällige Rewards bei einem Event freigeschaltet werden sollen
 * @param {string} userEmail - Email des Users
 * @param {string} eventType - Art des Events ("scan", "weekly_scan", "monthly_scan", "gift_scan", "rare_scan")
 * @returns {Array} - Liste der neu freigeschalteten Rewards
 */
export async function checkRandomRewards(userEmail, eventType) {
  try {
    console.log(`[RandomRewardChecker] Checking random rewards for ${userEmail} on event: ${eventType}`);

    // Lade alle Rewards mit dem entsprechenden Event
    const allRewards = await Query.Reward.filter({ random_event: eventType });
    
    if (allRewards.length === 0) {
      console.log(`[RandomRewardChecker] No random rewards configured for event: ${eventType}`);
      return [];
    }

    // Lade bereits freigeschaltete Rewards des Users
    const userRewards = await Query.UserReward.filter({ created_by: userEmail });
    const hasReward = (rewardId) => userRewards.some(ur => ur.reward_id === rewardId);

    const unlockedRewards = [];

    // Prüfe jeden Reward
    for (const reward of allRewards) {
      // Skip wenn bereits freigeschaltet
      if (hasReward(reward.id)) continue;

      // Skip wenn keine Chance definiert ist
      if (!reward.random_chance || reward.random_chance <= 0) continue;

      // Würfle: Generiere Zufallszahl zwischen 1 und random_chance
      const roll = Math.floor(Math.random() * reward.random_chance) + 1;
      
      console.log(`[RandomRewardChecker] Rolling for ${reward.display_name}: ${roll}/${reward.random_chance}`);

      // Wenn 1 gewürfelt wurde = Treffer!
      if (roll === 1) {
        console.log(`[RandomRewardChecker] 🎉 Unlocked random reward: ${reward.display_name}`);
        
        // Schalte Reward frei
        await Query.UserReward.create({
          reward_id: reward.id,
          unlocked_date: new Date().toISOString()
        });

        // Erstelle spezielle Notification für zufällige Belohnungen
        await Query.UserNotification.create({
          user_email: userEmail,
          notification_type: "custom",
          title: `✨ Glücksfund!`,
          message: `Du hast "${reward.display_name}" durch Zufall freigeschaltet!`,
          image_url: reward.image_url || reward.value,
          display_location: "modal",
          priority: 10,
          seen: false
        });

        unlockedRewards.push(reward);
      }
    }

    if (unlockedRewards.length > 0) {
      console.log(`[RandomRewardChecker] Unlocked ${unlockedRewards.length} random reward(s)`);
    }

    return unlockedRewards;

  } catch (error) {
    console.error('[RandomRewardChecker] Error checking random rewards:', error);
    return [];
  }
}

