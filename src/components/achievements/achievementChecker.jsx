
import { base44 } from "@/api/base44Client";

/**
 * Prüft alle Achievements und schaltet neue frei
 * @param {Object} user - Der aktuelle User
 * @returns {Array} - Liste der neu freigeschalteten Achievements
 */
export async function checkAndUnlockAchievements(user) {
  if (!user) return [];

  try {
    // Lade alle benötigten Daten
    const [achievements, userAchievements, plants, genera, userDiscoveries, friends] = await Promise.all([
      base44.entities.Achievement.list(),
      base44.entities.UserAchievement.filter({ created_by: user.email }),
      base44.entities.Plant.list(),
      base44.entities.PlantGenus.list(),
      base44.entities.UserPlantDiscovery.filter({ created_by: user.email }),
      base44.entities.Friend.filter({ created_by: user.email })
    ]);

    const unlockedAchievements = [];

    // Hilfsfunktion: Hat User das Achievement schon?
    const hasAchievement = (title) => {
      const achievement = achievements.find(a => a.title === title);
      return achievement && userAchievements.some(ua => ua.achievement_id === achievement.id);
    };

    // Hilfsfunktion: Achievement freischalten
    const unlockAchievement = async (title) => {
      const achievement = achievements.find(a => a.title === title);
      if (!achievement || hasAchievement(title)) return null;

      await base44.entities.UserAchievement.create({
        achievement_id: achievement.id,
        unlocked_date: new Date().toISOString(),
        created_by: user.email
      });

      return achievement;
    };

    // Berechne Statistiken
    const userDiscoveredPlantObjects = plants.filter(p => userDiscoveries.some(d => d.plant_id === p.id));
    
    // As per outline, discoveredPlants is the count of userDiscoveries
    const discoveredPlants = userDiscoveries.length; 

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

    // 🏆 ACHIEVEMENT-PRÜFUNGEN 🏆

    // 1. Schatzsucher - Erste Pflanze entdeckt
    if (discoveredPlants >= 1 && !hasAchievement("Schatzsucher")) {
      const achievement = await unlockAchievement("Schatzsucher");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 2. Siebenschläfer - 7 Tage hintereinander aktiv (SELTEN)
    // TODO: Benötigt Login-Tracking - erstmal überspringen
    
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

    // 6. Aufsteiger - Level 15 erreicht
    if (user.level >= 15 && !hasAchievement("Aufsteiger")) {
      const achievement = await unlockAchievement("Aufsteiger");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 15. Meister der Flora - Level 30 erreicht (EPISCH)
    if (user.level >= 30 && !hasAchievement("Meister der Flora")) {
      const achievement = await unlockAchievement("Meister der Flora");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 7. Jahrhundertsammlung - 100 Pflanzen entdeckt
    if (discoveredPlants >= 100 && !hasAchievement("Jahrhundertsammlung")) {
      const achievement = await unlockAchievement("Jahrhundertsammlung");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 8. Pionier - 10 neue Pflanzen zum globalen PlantDex hinzugefügt
    if (newPlantsAddedToGlobalDex >= 10 && !hasAchievement("Pionier")) {
      const achievement = await unlockAchievement("Pionier");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 9. Duo Sammler - Erster Freund hinzugefügt
    if (friends.length >= 1 && !hasAchievement("Duo Sammler")) {
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

    // 12. PlantDex Meister - Alle Pflanzen entdeckt
    if (plants.length > 0 && userDiscoveredPlantObjects.length >= plants.length && !hasAchievement("PlantDex Meister")) {
      const achievement = await unlockAchievement("PlantDex Meister");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 13. Teamforscher - 5 Freunde hinzugefügt
    if (friends.length >= 5 && !hasAchievement("Teamforscher")) {
      const achievement = await unlockAchievement("Teamforscher");
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

    return unlockedAchievements;

  } catch (error) {
    console.error("Fehler beim Prüfen der Achievements:", error);
    return [];
  }
}
