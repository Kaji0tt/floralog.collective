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
      currentUser,
      quests,
      weeklyQuests,
      monthlyQuests
    ] = await Promise.all([
      base44.entities.Reward.list(),
      base44.entities.UserReward.filter({ created_by: userEmail }),
      base44.entities.UserQuest.filter({ created_by: userEmail }),
      base44.entities.UserWeeklyQuest.filter({ created_by: userEmail }),
      base44.entities.UserMonthlyQuest.filter({ created_by: userEmail }),
      base44.entities.SharedScan.filter({ shared_to: userEmail }),
      base44.entities.UserPlantDiscovery.filter({ created_by: userEmail }),
      base44.entities.Plant.list(),
      base44.auth.me(),
      base44.entities.Quest.list(),
      base44.entities.WeeklyQuest.list(),
      base44.entities.MonthlyQuest.list()
    ]);

    // Track neu freigeschaltete Rewards lokal
    const unlockedRewardIds = new Set(userRewards.map(ur => ur.reward_id));

    // Helper: Prüfe ob User bereits einen Reward hat
    const hasReward = (rewardId) => unlockedRewardIds.has(rewardId);

    // Helper: Schalte Reward frei
    const unlockReward = async (reward) => {
      if (hasReward(reward.id)) return false;
      
      console.log(`[RewardUnlocker] Unlocking reward: ${reward.display_name}`);
      await base44.entities.UserReward.create({
        reward_id: reward.id,
        unlocked_date: new Date().toISOString()
      });

      // Füge zum lokalen Set hinzu
      unlockedRewardIds.add(reward.id);

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
          if (unlocked) {
            console.log(`✅ Nachträglich freigeschaltet: ${questReward.display_name} (Quest: ${quest.title})`);
            newRewardsCount++;
          }
        }
      }
    }

    // Iteriere durch alle Rewards und prüfe Bedingungen
    for (const reward of allRewards) {
      console.log(`[RewardUnlocker] Prüfe Reward: ${reward.display_name} (${reward.name})`);
      
      if (hasReward(reward.id)) {
        console.log(`[RewardUnlocker] ✓ Bereits freigeschaltet: ${reward.display_name}`);
        continue;
      }

      // Überspringe random_event Rewards - diese werden nur im randomRewardChecker geprüft
      if (reward.random_event && reward.random_chance) {
        console.log(`[RewardUnlocker] ⏭️ Überspringe Random-Event Reward: ${reward.display_name} (Event: ${reward.random_event}, Chance: ${reward.random_chance})`);
        continue;
      }

      console.log(`[RewardUnlocker] 🔍 Prüfe Bedingungen für: ${reward.display_name}`, {
        requires_weekly_quests: reward.requires_weekly_quests,
        requires_monthly_quests: reward.requires_monthly_quests,
        requires_gifts: reward.requires_gifts,
        requires_donor: reward.requires_donor,
        requires_referrals: reward.requires_referrals,
        requires_rare_plants: reward.requires_rare_plants,
        requires_quest: reward.requires_quest
      });

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

      // Wenn alle Bedingungen erfüllt sind, schalte den Reward frei
      if (conditionsMet) {
        console.log(`[RewardUnlocker] ✅ Alle Bedingungen erfüllt für: ${reward.display_name}`);
        const unlocked = await unlockReward(reward);
        if (unlocked) newRewardsCount++;
      } else {
        console.log(`[RewardUnlocker] ❌ Bedingungen nicht erfüllt für: ${reward.display_name}`);
      }
    }

    console.log(`[RewardUnlocker] Unlocked ${newRewardsCount} new rewards`);
    return newRewardsCount;

  } catch (error) {
    console.error('[RewardUnlocker] Error checking rewards:', error);
    return 0;
  }
}