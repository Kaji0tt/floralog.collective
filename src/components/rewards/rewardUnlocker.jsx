import { base44 } from "@/api/base44Client";

/**
 * Zentrale Funktion zum Prüfen und Freischalten von Rewards
 * Wird aufgerufen wenn sich relevante User-Daten ändern (Quest abgeschlossen, Gift erhalten, etc.)
 */
export async function checkAndUnlockRewards(userEmail) {
  try {
    console.log(`[RewardUnlocker] Checking rewards for ${userEmail}`);

    // Lade alle notwendigen Daten
    const [
      allRewards,
      userRewards,
      userQuests,
      userWeeklyQuests,
      userMonthlyQuests,
      sharedScans,
      userDiscoveries,
      plants,
      currentUser
    ] = await Promise.all([
      base44.entities.Reward.list(),
      base44.entities.UserReward.filter({ created_by: userEmail }),
      base44.entities.UserQuest.filter({ created_by: userEmail }),
      base44.entities.UserWeeklyQuest.filter({ created_by: userEmail }),
      base44.entities.UserMonthlyQuest.filter({ created_by: userEmail }),
      base44.entities.SharedScan.filter({ shared_to: userEmail }),
      base44.entities.UserPlantDiscovery.filter({ created_by: userEmail }),
      base44.entities.Plant.list(),
      base44.auth.me()
    ]);

    // Helper: Prüfe ob User bereits einen Reward hat
    const hasReward = (rewardId) => userRewards.some(ur => ur.reward_id === rewardId);

    // Helper: Schalte Reward frei
    const unlockReward = async (reward) => {
      if (hasReward(reward.id)) return false;
      
      console.log(`[RewardUnlocker] Unlocking reward: ${reward.display_name}`);
      await base44.entities.UserReward.create({
        reward_id: reward.id,
        unlocked_date: new Date().toISOString()
      });

      // Erstelle Notification
      await base44.entities.UserNotification.create({
        user_email: userEmail,
        notification_type: "custom",
        title: `🎁 Neue Belohnung freigeschaltet!`,
        message: `Du hast "${reward.display_name}" freigeschaltet!`,
        image_url: reward.image_url || reward.value,
        display_location: "banner",
        priority: 5,
        seen: false
      });

      return true;
    };

    // Berechne User-Statistiken
    const weeklyQuestParticipations = new Set(userWeeklyQuests.map(q => q.active_week)).size;
    const completedMonthlyQuests = userMonthlyQuests.filter(q => q.completed).length;
    const giftsReceived = sharedScans.length;
    const isDonor = currentUser?.donor_status || false;
    const referralCount = (await base44.entities.Referral.filter({ referrer_email: userEmail })).length;
    
    // Prüfe auf seltene Pflanzen
    const rarePlantCount = userDiscoveries.filter(d => {
      const plant = plants.find(p => p.id === d.plant_id);
      return plant && (plant.rarity === "Sehr Selten" || plant.rarity === "Extrem Selten");
    }).length;

    let newRewardsCount = 0;

    // Iteriere durch alle Rewards und prüfe Bedingungen
    for (const reward of allRewards) {
      if (hasReward(reward.id)) continue;

      let conditionsMet = true;

      // Prüfe requires_weekly_quests
      if (reward.requires_weekly_quests && weeklyQuestParticipations < reward.requires_weekly_quests) {
        conditionsMet = false;
      }

      // Prüfe requires_monthly_quests
      if (reward.requires_monthly_quests && completedMonthlyQuests < reward.requires_monthly_quests) {
        conditionsMet = false;
      }

      // Prüfe requires_gifts
      if (reward.requires_gifts && giftsReceived < reward.requires_gifts) {
        conditionsMet = false;
      }

      // Prüfe requires_donor
      if (reward.requires_donor && !isDonor) {
        conditionsMet = false;
      }

      // Prüfe requires_referrals
      if (reward.requires_referrals && referralCount < reward.requires_referrals) {
        conditionsMet = false;
      }

      // Prüfe requires_rare_plants
      if (reward.requires_rare_plants && rarePlantCount < reward.requires_rare_plants) {
        conditionsMet = false;
      }

      // Prüfe requires_quest (spezifische Quest abgeschlossen)
      if (reward.requires_quest) {
        const questCompleted = userQuests.some(uq => 
          uq.quest_id === reward.requires_quest && uq.completed
        );
        if (!questCompleted) {
          conditionsMet = false;
        }
      }

      // Wenn alle Bedingungen erfüllt sind, schalte den Reward frei
      if (conditionsMet) {
        const unlocked = await unlockReward(reward);
        if (unlocked) newRewardsCount++;
      }
    }

    console.log(`[RewardUnlocker] Unlocked ${newRewardsCount} new rewards`);
    return newRewardsCount;

  } catch (error) {
    console.error('[RewardUnlocker] Error checking rewards:', error);
    return 0;
  }
}