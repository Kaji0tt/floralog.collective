import { Query } from "@/api/entities";

/**
 * Aktualisiert den Quest-Fortschritt für alle aktiven Quests eines Users
 */
export async function updateQuestProgress(user) {
  if (!user?.id) return;

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
      Query.Quest.list(),
      Query.UserQuest.filter({ auth_id: user.id }),
      Query.WeeklyQuest.list(),
      Query.UserWeeklyQuest.filter({ auth_id: user.id }),
      Query.MonthlyQuest.list(),
      Query.UserMonthlyQuest.filter({ auth_id: user.id }),
      Query.CollectionQuest.list(),
      Query.UserCollectionQuest.filter({ auth_id: user.id }),
      Query.UserPlantDiscovery.filter({ auth_id: user.id }),
      // listAll() - quest target species can be any plant, list() truncates at 1000 rows.
      Query.Plant.listAll(),
      Query.PlantGenus.list()
    ]);

    // Hilfsfunktion: Berechne Fortschritt für eine Quest
    const calculateProgress = (quest, discoveries, plants, genera) => {
      if (!quest.required_discoveries) return 0;

      let matchingDiscoveries = discoveries;

      // Filter nach Kategorie
      if (quest.category && quest.category !== "Alle") {
        // Plants sind über genus_category (z.B. "Blumen") klassifiziert
        const categoryPlantIds = plants
          .filter(p => p.genus_category === quest.category)
          .map(p => p.id);
        matchingDiscoveries = matchingDiscoveries.filter(d => categoryPlantIds.includes(d.plant_id));
      }

      // Filter nach spezifischer Gattung
      if (quest.target_genus_name) {
        const targetGenus = genera.find(g => g.genus_name === quest.target_genus_name);
        if (targetGenus) {
          // Verknüpfung Plant <-> Genus erfolgt über (genus_category, genus_number)
          const targetGenusPlantIds = plants
            .filter(p =>
              p.genus_category === targetGenus.category &&
              p.genus_number === targetGenus.category_dex_number
            )
            .map(p => p.id);
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

    const isActiveStatus = (status) => status === 'active';

    // Update reguläre Quests
    for (const userQuest of userQuests) {
      const isActive = userQuest.status ? isActiveStatus(userQuest.status) : (userQuest.accepted && !userQuest.redeemed);
      if (isActive) {
        const quest = quests.find(q => q.id === userQuest.quest_id);
        if (!quest) continue;

        const progress = calculateProgress(quest, userDiscoveries, plants, genera);
        const completed = progress >= (quest.required_discoveries || 0);

        if (progress !== userQuest.progress || completed !== userQuest.completed) {
          await Query.UserQuest.update(userQuest.id, {
            progress,
            completed,
            completed_date: completed && !userQuest.completed ? new Date().toISOString() : userQuest.completed_date,
            // Optional Status-Feld: nur setzen, falls vorhanden
            status: completed ? 'completed' : 'active'
          });
        }
      }
    }

    // Update wöchentliche Quests
    for (const userWeeklyQuest of userWeeklyQuests) {
      const isActive = userWeeklyQuest.status ? isActiveStatus(userWeeklyQuest.status) : (userWeeklyQuest.accepted && !userWeeklyQuest.redeemed);
      if (isActive) {
        const quest = weeklyQuests.find(q => q.id === userWeeklyQuest.weekly_quest_id);
        if (!quest) continue;

        // Für Wochenquests gilt der Wochenbeginn (Montag 00:00 UTC) als Startpunkt,
        // nicht das accepted_at – so zählen Scans auch wenn der Auto-Accept verzögert war.
        // Das Wochenende (nächster Montag 00:00 UTC) dient als Endgrenze –
        // Scans aus Folgewochen dürfen eine vergangene Quest NICHT erfüllen.
        const getWeekStart = (isoString) => {
          const d = isoString ? new Date(isoString) : new Date();
          const dow = d.getUTCDay();
          const daysBack = dow === 0 ? 6 : dow - 1;
          return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack));
        };
        const acceptedAt = userWeeklyQuest.accepted_at || userWeeklyQuest.accepted_date;
        const effectiveStart = getWeekStart(acceptedAt);
        const effectiveEnd = new Date(effectiveStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const discoveriesSinceAccept = userDiscoveries.filter(
          d => d.discovered_date &&
               new Date(d.discovered_date) >= effectiveStart &&
               new Date(d.discovered_date) < effectiveEnd
        );

        const progress = calculateProgress(quest, discoveriesSinceAccept, plants, genera);
        const completed = progress >= (quest.required_discoveries || 0);

        if (progress !== userWeeklyQuest.progress || completed !== userWeeklyQuest.completed) {
          await Query.UserWeeklyQuest.update(userWeeklyQuest.id, {
            progress,
            completed,
            completed_date: completed && !userWeeklyQuest.completed ? new Date().toISOString() : userWeeklyQuest.completed_date,
            status: completed ? 'completed' : 'active'
          });
        }
      }
    }

    // Update monatliche Quests
    for (const userMonthlyQuest of userMonthlyQuests) {
      const isActive = userMonthlyQuest.status ? isActiveStatus(userMonthlyQuest.status) : (userMonthlyQuest.accepted && !userMonthlyQuest.redeemed);
      if (isActive) {
        const quest = monthlyQuests.find(q => q.id === userMonthlyQuest.monthly_quest_id);
        if (!quest) continue;

        // Nur Entdeckungen ab Aktivierung der Quest zählen
        const acceptedAt = userMonthlyQuest.accepted_at || userMonthlyQuest.accepted_date;
        const discoveriesSinceAccept = acceptedAt
          ? userDiscoveries.filter(d => d.discovered_date && new Date(d.discovered_date) >= new Date(acceptedAt))
          : userDiscoveries;

        const progress = calculateProgress(quest, discoveriesSinceAccept, plants, genera);
        const completed = progress >= (quest.required_discoveries || 0);

        if (progress !== userMonthlyQuest.progress || completed !== userMonthlyQuest.completed) {
          await Query.UserMonthlyQuest.update(userMonthlyQuest.id, {
            progress,
            completed,
            completed_date: completed && !userMonthlyQuest.completed ? new Date().toISOString() : userMonthlyQuest.completed_date,
            status: completed ? 'completed' : 'active'
          });
        }
      }
    }

    // Update Sammlungs-Quests
    for (const userCollectionQuest of userCollectionQuests) {
      const isActive = userCollectionQuest.status ? isActiveStatus(userCollectionQuest.status) : (userCollectionQuest.accepted && !userCollectionQuest.redeemed);
      if (isActive) {
        const quest = collectionQuests.find(q => q.id === userCollectionQuest.collection_quest_id);
        if (!quest || !quest.target_plants) continue;

        const discoveredPlants = userDiscoveries
          .filter(d => quest.target_plants.includes(d.plant_id))
          .map(d => d.plant_id);

        const uniqueDiscoveredPlants = [...new Set(discoveredPlants)];
        const completed = uniqueDiscoveredPlants.length >= quest.target_plants.length;

        if (JSON.stringify(uniqueDiscoveredPlants.sort()) !== JSON.stringify((userCollectionQuest.discovered_plants || []).sort()) ||
            completed !== userCollectionQuest.completed) {
          await Query.UserCollectionQuest.update(userCollectionQuest.id, {
            discovered_plants: uniqueDiscoveredPlants,
            completed,
            completed_date: completed && !userCollectionQuest.completed ? new Date().toISOString() : userCollectionQuest.completed_date,
            status: completed ? 'completed' : 'active'
          });
        }
      }
    }

    // Prüfe und schalte Rewards frei
    const { checkAndUnlockRewards } = await import('../rewards/rewardUnlocker');
    await checkAndUnlockRewards(user);

  } catch (error) {
    console.error("Fehler beim Aktualisieren des Quest-Fortschritts:", error);
  }
}