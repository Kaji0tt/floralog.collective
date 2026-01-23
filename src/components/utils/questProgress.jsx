import { base44 } from "@/api/base44Client";

/**
 * Aktualisiert den Quest-Fortschritt für alle aktiven Quests eines Users
 */
export async function updateQuestProgress(user) {
  if (!user) return;

  try {
    // Lade alle benötigten Daten
    const [
      quests,
      userQuests,
      weeklyQuests,
      userWeeklyQuests,
      monthlyQuests,
      userMonthlyQuests,
      collectionQuests,
      userCollectionQuests,
      userDiscoveries,
      plants,
      genera
    ] = await Promise.all([
      base44.entities.Quest.list(),
      base44.entities.UserQuest.filter({ created_by: user.email }),
      base44.entities.WeeklyQuest.list(),
      base44.entities.UserWeeklyQuest.filter({ created_by: user.email }),
      base44.entities.MonthlyQuest.list(),
      base44.entities.UserMonthlyQuest.filter({ created_by: user.email }),
      base44.entities.CollectionQuest.list(),
      base44.entities.UserCollectionQuest.filter({ created_by: user.email }),
      base44.entities.UserPlantDiscovery.filter({ created_by: user.email }),
      base44.entities.Plant.list(),
      base44.entities.PlantGenus.list()
    ]);

    // Hilfsfunktion: Berechne Fortschritt für eine Quest
    const calculateProgress = (quest, discoveries, plants, genera) => {
      if (!quest.required_discoveries) return 0;

      let matchingDiscoveries = discoveries;

      // Filter nach Kategorie
      if (quest.category && quest.category !== "Alle") {
        const categoryGenera = genera.filter(g => g.category === quest.category);
        const categoryGeneraIds = categoryGenera.map(g => g.id);
        const categoryPlants = plants.filter(p => categoryGeneraIds.includes(p.genus_id));
        const categoryPlantIds = categoryPlants.map(p => p.id);
        matchingDiscoveries = matchingDiscoveries.filter(d => categoryPlantIds.includes(d.plant_id));
      }

      // Filter nach spezifischer Gattung
      if (quest.target_genus_name) {
        const targetGenus = genera.find(g => g.genus_name === quest.target_genus_name);
        if (targetGenus) {
          const targetGenusPlants = plants.filter(p => p.genus_id === targetGenus.id);
          const targetGenusPlantIds = targetGenusPlants.map(p => p.id);
          matchingDiscoveries = matchingDiscoveries.filter(d => targetGenusPlantIds.includes(d.plant_id));
        }
      }

      // Filter nach spezifischer Art
      if (quest.target_species_name) {
        const targetPlant = plants.find(p => p.species_name === quest.target_species_name);
        if (targetPlant) {
          matchingDiscoveries = matchingDiscoveries.filter(d => d.plant_id === targetPlant.id);
        }
      }

      return matchingDiscoveries.length;
    };

    // Update reguläre Quests
    for (const userQuest of userQuests) {
      if (userQuest.accepted && !userQuest.redeemed) {
        const quest = quests.find(q => q.id === userQuest.quest_id);
        if (!quest) continue;

        const progress = calculateProgress(quest, userDiscoveries, plants, genera);
        const completed = progress >= (quest.required_discoveries || 0);

        if (progress !== userQuest.progress || completed !== userQuest.completed) {
          await base44.entities.UserQuest.update(userQuest.id, {
            progress,
            completed,
            completed_date: completed && !userQuest.completed ? new Date().toISOString() : userQuest.completed_date
          });
        }
      }
    }

    // Update wöchentliche Quests
    for (const userWeeklyQuest of userWeeklyQuests) {
      if (userWeeklyQuest.accepted && !userWeeklyQuest.redeemed) {
        const quest = weeklyQuests.find(q => q.id === userWeeklyQuest.weekly_quest_id);
        if (!quest) continue;

        const progress = calculateProgress(quest, userDiscoveries, plants, genera);
        const completed = progress >= (quest.required_discoveries || 0);

        if (progress !== userWeeklyQuest.progress || completed !== userWeeklyQuest.completed) {
          await base44.entities.UserWeeklyQuest.update(userWeeklyQuest.id, {
            progress,
            completed,
            completed_date: completed && !userWeeklyQuest.completed ? new Date().toISOString() : userWeeklyQuest.completed_date
          });
        }
      }
    }

    // Update monatliche Quests
    for (const userMonthlyQuest of userMonthlyQuests) {
      if (userMonthlyQuest.accepted && !userMonthlyQuest.redeemed) {
        const quest = monthlyQuests.find(q => q.id === userMonthlyQuest.monthly_quest_id);
        if (!quest) continue;

        const progress = calculateProgress(quest, userDiscoveries, plants, genera);
        const completed = progress >= (quest.required_discoveries || 0);

        if (progress !== userMonthlyQuest.progress || completed !== userMonthlyQuest.completed) {
          await base44.entities.UserMonthlyQuest.update(userMonthlyQuest.id, {
            progress,
            completed,
            completed_date: completed && !userMonthlyQuest.completed ? new Date().toISOString() : userMonthlyQuest.completed_date
          });
        }
      }
    }

    // Update Sammlungs-Quests
    for (const userCollectionQuest of userCollectionQuests) {
      if (userCollectionQuest.accepted && !userCollectionQuest.redeemed) {
        const quest = collectionQuests.find(q => q.id === userCollectionQuest.collection_quest_id);
        if (!quest || !quest.target_plants) continue;

        const discoveredPlants = userDiscoveries
          .filter(d => quest.target_plants.includes(d.plant_id))
          .map(d => d.plant_id);

        const uniqueDiscoveredPlants = [...new Set(discoveredPlants)];
        const completed = uniqueDiscoveredPlants.length >= quest.target_plants.length;

        if (JSON.stringify(uniqueDiscoveredPlants.sort()) !== JSON.stringify((userCollectionQuest.discovered_plants || []).sort()) ||
            completed !== userCollectionQuest.completed) {
          await base44.entities.UserCollectionQuest.update(userCollectionQuest.id, {
            discovered_plants: uniqueDiscoveredPlants,
            completed,
            completed_date: completed && !userCollectionQuest.completed ? new Date().toISOString() : userCollectionQuest.completed_date
          });
        }
      }
    }

    // Prüfe und schalte Rewards frei
    const { checkAndUnlockRewards } = await import('../rewards/rewardUnlocker');
    await checkAndUnlockRewards(user.email);

  } catch (error) {
    console.error("Fehler beim Aktualisieren des Quest-Fortschritts:", error);
  }
}