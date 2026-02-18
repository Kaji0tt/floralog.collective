import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";

/**
 * Zentrale Funktion zum Prüfen und Freischalten von Rewards
 * Wird aufgerufen wenn sich relevante User-Daten ändern (Quest abgeschlossen, Gift erhalten, etc.)
 */
export async function checkAndUnlockRewards(userEmail) {
  try {
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
      currentUser,
      quests,
      weeklyQuests,
      monthlyQuests
    ] = await Promise.all([
      Query.Reward.list(),
      Query.UserReward.filter({ created_by: userEmail }),
      Query.UserQuest.filter({ created_by: userEmail }),
      Query.UserWeeklyQuest.filter({ created_by: userEmail }),
      Query.UserMonthlyQuest.filter({ created_by: userEmail }),
      Query.SharedScan.filter({ shared_to: userEmail }),
      Query.UserPlantDiscovery.filter({ created_by: userEmail }),
      Query.Plant.list(),
      getCurrentUser(),
      Query.Quest.list(),
      Query.WeeklyQuest.list(),
      Query.MonthlyQuest.list()
    ]);

    // Track neu freigeschaltete Rewards lokal
    const unlockedRewardIds = new Set(userRewards.map(ur => ur.reward_id));

    // Helper: Prüfe ob User bereits einen Reward hat
    const hasReward = (rewardId) => unlockedRewardIds.has(rewardId);

    // Helper: Schalte Reward frei
    const unlockReward = async (reward) => {
      if (hasReward(reward.id)) return false;
      
      await Query.UserReward.create({
        reward_id: reward.id,
        reward_name: reward.display_name,
        user_email: userEmail,
        user_name: currentUser?.display_name || currentUser?.full_name || userEmail,
        unlocked_date: new Date().toISOString()
      });

      // Füge zum lokalen Set hinzu
      unlockedRewardIds.add(reward.id);

      // Erstelle Notification
      await Query.UserNotification.create({
        user_email: userEmail,
        notification_type: "custom",
        title: `🎁 Neue Belohnung freigeschaltet!`,
        message: `Du hast "${reward.display_name}" freigeschaltet!`,
        image_url: reward.image_url || reward.value,
        display_location: "banner",
        priority: "medium",
        seen: false
      });

      return true;
    };

    // Berechne User-Statistiken
    const weeklyQuestParticipations = new Set(userWeeklyQuests.map(q => q.active_week)).size;
    const completedMonthlyQuests = userMonthlyQuests.filter(q => q.completed).length;
    const giftsReceived = sharedScans.length;
    const isDonor = currentUser?.donor_status || false;
    const referralCount = (await Query.Referral.filter({ referrer_email: userEmail })).length;
    
    // Prüfe auf seltene Pflanzen
    const rarePlantCount = userDiscoveries.filter(d => {
      const plant = plants.find(p => p.id === d.plant_id);
      return plant && (plant.rarity === "Sehr Selten" || plant.rarity === "Extrem Selten");
    }).length;

    let newRewardsCount = 0;

    // NACHTRÄGLICHE FREISCHALTUNG: Prüfe alle eingelösten Quests und schalte deren Rewards frei
    const redeemedQuests = [
      ...userQuests.filter(uq => uq.redeemed).map(uq => ({ type: 'regular', userQuest: uq })),
      ...userWeeklyQuests.filter(uwq => uwq.redeemed).map(uwq => ({ type: 'weekly', userQuest: uwq })),
      ...userMonthlyQuests.filter(umq => umq.redeemed).map(umq => ({ type: 'monthly', userQuest: umq }))
    ];

    for (const { type, userQuest } of redeemedQuests) {
      let quest;
      if (type === 'regular') {
        quest = quests.find(q => q.id === userQuest.quest_id);
      } else if (type === 'weekly') {
        quest = weeklyQuests.find(q => q.id === userQuest.weekly_quest_id);
      } else if (type === 'monthly') {
        quest = monthlyQuests.find(q => q.id === userQuest.monthly_quest_id);
      }

      if (quest?.reward_name) {
        const questReward = allRewards.find(r => r.name === quest.reward_name);
        if (questReward && !hasReward(questReward.id)) {
          const unlocked = await unlockReward(questReward);
          if (unlocked) newRewardsCount++;
        }
      }
    }

    // Iteriere durch alle Rewards und prüfe Bedingungen
    for (const reward of allRewards) {
      if (hasReward(reward.id)) continue;

      // Überspringe random_event Rewards - diese werden nur im randomRewardChecker geprüft
      if (reward.random_event && reward.random_chance) continue;

      // KRITISCH: Überspringe Rewards ohne Bedingungen - diese sollten NUR über Achievements/Quests freigeschaltet werden
      const hasAnyCondition = 
        reward.requires_weekly_quests ||
        reward.requires_monthly_quests ||
        reward.requires_gifts ||
        reward.requires_donor ||
        reward.requires_referrals ||
        reward.requires_rare_plants ||
        reward.requires_quest;

      if (!hasAnyCondition) {
        console.log('[RewardUnlocker] Skipping reward without conditions:', reward.name, reward.display_name);
        continue;
      }

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

      // Prüfe requires_quest (spezifische Quest eingelöst)
      if (reward.requires_quest) {
        const questCompleted = userQuests.some(uq => 
          uq.quest_id === reward.requires_quest && uq.redeemed
        );
        if (!questCompleted) {
          conditionsMet = false;
        }
      }

      console.log('[RewardUnlocker] Checking reward:', reward.name, reward.display_name, 'conditionsMet:', conditionsMet);

      // Wenn alle Bedingungen erfüllt sind, schalte den Reward frei
      if (conditionsMet) {
        const unlocked = await unlockReward(reward);
        if (unlocked) {
          console.log('[RewardUnlocker] Unlocked reward:', reward.name, reward.display_name);
          newRewardsCount++;
        }
      }
    }

    return newRewardsCount;

  } catch (error) {
    console.error('[RewardUnlocker] Error checking rewards:', error);
    return 0;
  }
}

