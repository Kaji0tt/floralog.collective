import { Query } from "@/api/entities";

/**
 * Prüft alle Achievements und schaltet neue frei
 * @param {Object} user - Der aktuelle User
 * @returns {Array} - Liste der neu freigeschalteten Achievements
 */
export async function checkAndUnlockAchievements(user) {
  if (!user) return [];

  try {
    console.log('[AchievementChecker] Starting check for user:', user.email);
    
    // Lade alle benötigten Daten
    const [achievements, userAchievements, plants, genera, userDiscoveries, allFriendRecords] = await Promise.all([
      Query.Achievement.list(),
      Query.UserAchievement.filter({ auth_id: user.id }),
      Query.Plant.list(),
      Query.PlantGenus.list(),
      Query.UserPlantDiscovery.filter({ auth_id: user.id }),
      // Lade alle Freundschafts-Einträge und filtere danach wie im restlichen App-Code
      Query.Friend.list()
    ]);

    const userEmailLower = (user.email || '').toLowerCase();

    // Akzeptierte Freundschaften, bei denen der User entweder Sender oder Empfänger ist
    const friends = allFriendRecords.filter((f) =>
      f.status === 'accepted' && (
        f.request_sent_by?.toLowerCase() === userEmailLower ||
        f.request_sent_to?.toLowerCase() === userEmailLower
      )
    );

    console.log('[AchievementChecker] Loaded data summary:', {
      achievements: achievements.length,
      userAchievements: userAchievements.length,
      plants: plants.length,
      genera: genera.length,
      userDiscoveries: userDiscoveries.length,
      friendsTotal: allFriendRecords.length,
      friendsAcceptedForUser: friends.length
    });

    const unlockedAchievements = [];

    // Hilfsfunktionen zum Finden von Achievements
    const findAchievementByTitle = (title) =>
      achievements.find(a => a.title === title);

    const findAchievementByRewardName = (rewardName) =>
      achievements.find(a => a.reward_name === rewardName);

    // Hilfsfunktion: Hat User das Achievement schon? (per Titel)
    const hasAchievement = (title) => {
      const achievement = findAchievementByTitle(title);
      return achievement && userAchievements.some(ua => ua.achievement_id === achievement.id);
    };

    // Hilfsfunktion: Achievement per Titel freischalten
    const unlockAchievement = async (title) => {
      const achievement = findAchievementByTitle(title);
      if (!achievement) {
        console.warn('[AchievementChecker] Achievement definition not found for title:', title);
        return null;
      }
      if (hasAchievement(title)) {
        console.log('[AchievementChecker] Achievement already unlocked, skipping:', title);
        return null;
      }

      console.log('[AchievementChecker] Unlocking achievement:', title, 'with reward:', achievement.reward_name);

      await Query.UserAchievement.create({
        achievement_id: achievement.id,
        unlocked_date: new Date().toISOString(),
        auth_id: user.id,
        created_by: user.email
      });

      // Wenn das Achievement einen Reward hat, schalte diesen ebenfalls frei
      if (achievement.reward_name) {
        const rewards = await Query.Reward.list();
        const reward = rewards.find(r => r.name === achievement.reward_name);
        
        if (reward) {
          // Prüfe ob User den Reward bereits hat
            const userRewards = await Query.UserReward.filter({ auth_id: user.id });
          const hasReward = userRewards.some(ur => ur.reward_id === reward.id);
          
          if (!hasReward) {
            console.log('[AchievementChecker] Unlocking reward:', reward.name, reward.display_name);
            
            // Schalte Reward frei
            await Query.UserReward.create({
              reward_id: reward.id,
              reward_name: reward.display_name,
              auth_id: user.id,
              user_email: user.email,
              user_name: user.display_name || user.full_name || user.email,
              unlocked_date: new Date().toISOString()
            });

            // Früher wurde hier eine UserNotification im Banner-Stil erstellt.
            // Belohnungs-Feedback wird nun direkt über UI-Komponenten (z.B. ScanFeedbackNotification)
            // gehandhabt und nicht mehr als persistente Notification gespeichert.
          } else {
            console.log('[AchievementChecker] User already has reward:', reward.name);
          }
        }
      }

      return achievement;
    };

    // Hilfsfunktion: Hat User ein Achievement mit bestimmtem Reward bereits?
    const hasAchievementByRewardName = (rewardName) => {
      const achievement = findAchievementByRewardName(rewardName);
      return achievement && userAchievements.some(ua => ua.achievement_id === achievement.id);
    };

    // Hilfsfunktion: Achievement über Reward-Name freischalten
    const unlockAchievementByRewardName = async (rewardName) => {
      const achievement = findAchievementByRewardName(rewardName);
      if (!achievement) {
        console.warn('[AchievementChecker] Achievement definition not found for reward_name:', rewardName);
        return null;
      }
      if (userAchievements.some(ua => ua.achievement_id === achievement.id)) {
        console.log('[AchievementChecker] Achievement for reward already unlocked, skipping:', rewardName, 'title:', achievement.title);
        return null;
      }

      console.log('[AchievementChecker] Unlocking achievement by reward:', rewardName, 'title:', achievement.title, 'with reward:', achievement.reward_name);

      await Query.UserAchievement.create({
        achievement_id: achievement.id,
        unlocked_date: new Date().toISOString(),
        auth_id: user.id,
        created_by: user.email
      });

      // Wenn das Achievement einen Reward hat, schalte diesen ebenfalls frei (gleiche Logik wie oben)
      if (achievement.reward_name) {
        const rewards = await Query.Reward.list();
        const reward = rewards.find(r => r.name === achievement.reward_name);
        
        if (reward) {
          const userRewards = await Query.UserReward.filter({ auth_id: user.id });
          const hasReward = userRewards.some(ur => ur.reward_id === reward.id);
          
          if (!hasReward) {
            console.log('[AchievementChecker] Unlocking reward (by reward_name):', reward.name, reward.display_name);
            await Query.UserReward.create({
              reward_id: reward.id,
              reward_name: reward.display_name,
              auth_id: user.id,
              user_email: user.email,
              user_name: user.display_name || user.full_name || user.email,
              unlocked_date: new Date().toISOString()
            });
          } else {
            console.log('[AchievementChecker] User already has reward (by reward_name):', reward.name);
          }
        }
      }

      return achievement;
    };

    // Berechne Statistiken
    const userDiscoveredPlantObjects = plants.filter(p => userDiscoveries.some(d => d.plant_id === p.id));
    
    // As per outline, discoveredPlants is the count of userDiscoveries
    const discoveredPlants = userDiscoveries.length;

    // Berechne aufeinanderfolgende Scan-Tage (Streak)
    const calculateScanStreak = () => {
      if (userDiscoveries.length === 0) return 0;
      
      // Extrahiere alle Scan-Tage (nur Datum, keine Zeit)
      const scanDates = userDiscoveries
        .map(d => {
          const date = new Date(d.discovered_date);
          return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        })
        .filter((value, index, self) => self.indexOf(value) === index) // Unique Tage
        .sort((a, b) => b - a); // Neueste zuerst

      let maxStreak = 1;
      let currentStreak = 1;
      
      for (let i = 0; i < scanDates.length - 1; i++) {
        const diffDays = (scanDates[i] - scanDates[i + 1]) / (1000 * 60 * 60 * 24);
        
        if (diffDays === 1) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
      }
      
      return maxStreak;
    };
    
    const longestScanStreak = calculateScanStreak(); 

    // As per outline, discoveredGenera is the count of unique genera discovered by the user
    const discoveredGenera = genera.filter(g => {
      const genusPlants = plants.filter(p => p.genus_id === g.id);
      return genusPlants.some(p => userDiscoveries.some(d => d.plant_id === p.id));
    }).length;

    // To get the actual genus objects discovered by the user (needed for filtering categories)
    const discoveredGenusIdsByUser = new Set(userDiscoveredPlantObjects.map(p => p.genus_id));
    const discoveredGeneraByUser = genera.filter(g => discoveredGenusIdsByUser.has(g.id));

    const baumGenera = genera.filter(g => g.category === "Bäume");
    const discoveredBaumGeneraByUser = discoveredGeneraByUser.filter(g => g.category === "Bäume");

    // This calculates plants *contributed* by the user to the global dex, not just discovered personally
    const newPlantsAddedToGlobalDex = plants.filter(p => 
      p.created_by === user.email && 
      p.discovered === true
    ).length;

    console.log('[AchievementChecker] Computed stats:', {
      discoveredPlants,
      longestScanStreak,
      discoveredGenera,
      discoveredGeneraByUser: discoveredGeneraByUser.length,
      baumGeneraTotal: baumGenera.length,
      discoveredBaumGeneraByUser: discoveredBaumGeneraByUser.length,
      newPlantsAddedToGlobalDex,
      friendsAcceptedForUser: friends.length
    });

    // 🏆 ACHIEVEMENT-PRÜFUNGEN 🏆

    // 1. Schatzsucher - Erste Pflanze entdeckt
    if (discoveredPlants >= 1 && !hasAchievement("Schatzsucher")) {
      const achievement = await unlockAchievement("Schatzsucher");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 2. Siebenschläfer - 7 Tage hintereinander aktiv
    if (longestScanStreak >= 7 && !hasAchievement("Siebenschläfer")) {
      const achievement = await unlockAchievement("Siebenschläfer");
      if (achievement) unlockedAchievements.push(achievement);
    }
    
    // 3. Fleißiger Sammler - 50 Pflanzen entdeckt
    if (discoveredPlants >= 50 && !hasAchievement("Fleißiger Sammler")) {
      const achievement = await unlockAchievement("Fleißiger Sammler");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 4. Lokaler Entdecker - 10 Pflanzen am gleichen Ort
    const locationCounts = {};
    userDiscoveredPlantObjects.forEach(p => {
      if (p.discovery_location) {
        locationCounts[p.discovery_location] = (locationCounts[p.discovery_location] || 0) + 1;
      }
    });
    const maxAtOneLocation = Math.max(0, ...Object.values(locationCounts));
    if (maxAtOneLocation >= 10 && !hasAchievement("Lokaler Entdecker")) {
      const achievement = await unlockAchievement("Lokaler Entdecker");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 5. Baum-Meister - Alle Baum-Gattungen entdeckt
    if (baumGenera.length > 0 && discoveredBaumGeneraByUser.length >= baumGenera.length && !hasAchievement("Baum-Meister")) {
      const achievement = await unlockAchievement("Baum-Meister");
      if (achievement) unlockedAchievements.push(achievement);
    }



    // 7. Jahrhundertsammlung - 100 Pflanzen entdeckt
    if (discoveredPlants >= 100 && !hasAchievement("Jahrhundertsammlung")) {
      const achievement = await unlockAchievement("Jahrhundertsammlung");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 8. Pionier - 10 neue Pflanzen zum globalen Floralog hinzugefügt
    if (newPlantsAddedToGlobalDex >= 10 && !hasAchievement("Pionier")) {
      const achievement = await unlockAchievement("Pionier");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 9. Duo Sammler (Legacy) - Erster Freund hinzugefügt
    // Hinweis: In neueren Versionen kann dieses Achievement durch "Buddy" ersetzt worden sein.
    if (friends.length >= 1 && hasAchievement("Duo Sammler") === false) {
      const achievement = await unlockAchievement("Duo Sammler");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 10. Gattungssammler - 10 verschiedene Gattungen entdeckt
    if (discoveredGenera >= 10 && !hasAchievement("Gattungssammler")) {
      const achievement = await unlockAchievement("Gattungssammler");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 11. Waldgott - Alle Baum-Arten einer bestimmten Gattung entdeckt
    for (const genus of baumGenera) {
      const allPlantsInGenus = plants.filter(p => p.genus_id === genus.id);
      if (allPlantsInGenus.length === 0) continue; // Cannot discover all if there are no plants in this genus

      const userDiscoveredInGenus = userDiscoveredPlantObjects.filter(p => p.genus_id === genus.id);
      
      if (userDiscoveredInGenus.length >= allPlantsInGenus.length) {
        if (!hasAchievement("Waldgott")) {
          const achievement = await unlockAchievement("Waldgott");
          if (achievement) {
            unlockedAchievements.push(achievement);
            break; // Achievement unlocked, no need to check other genera
          }
        }
      }
    }

    // 12. Floralog Meister - Alle Pflanzen entdeckt
    if (plants.length > 0 && userDiscoveredPlantObjects.length >= plants.length && !hasAchievement("Floralog Meister")) {
      const achievement = await unlockAchievement("Floralog Meister");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 13. Teamforscher (Legacy) - 5 Freunde hinzugefügt
    if (friends.length >= 5 && hasAchievement("Teamforscher") === false) {
      const achievement = await unlockAchievement("Teamforscher");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // Neuer Freundes-Erfolg "Buddy" (über Reward-Name title_buddy)
    // Bedingung: Mindestens 1 akzeptierte Freundschaft
    if (friends.length >= 1 && !hasAchievementByRewardName('title_buddy')) {
      const achievement = await unlockAchievementByRewardName('title_buddy');
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 14. Glücksfund - Eine Seltene Pflanze entdeckt
    const hasRarePlant = userDiscoveredPlantObjects.some(p => 
      p.rarity === "Selten" || 
      p.rarity === "Sehr Selten" || 
      p.rarity === "Extrem Selten"
    );
    if (hasRarePlant && !hasAchievement("Glücksfund")) {
      const achievement = await unlockAchievement("Glücksfund");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 7. Gewohnheitstier - 3 Tage hintereinander scannen
    if (longestScanStreak >= 3 && !hasAchievement("Gewohnheitstier")) {
      const achievement = await unlockAchievement("Gewohnheitstier");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 13. Naturmensch - 30 Tage hintereinander scannen
    if (longestScanStreak >= 30 && !hasAchievement("Naturmensch")) {
      const achievement = await unlockAchievement("Naturmensch");
      if (achievement) unlockedAchievements.push(achievement);
    }

    console.log('[AchievementChecker] Finished. Unlocked', unlockedAchievements.length, 'achievements');
    return unlockedAchievements;

  } catch (error) {
    console.error("[AchievementChecker] ERROR:", error);
    return [];
  }
}

