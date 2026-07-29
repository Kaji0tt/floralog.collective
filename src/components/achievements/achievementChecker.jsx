import { Query } from "@/api/entities";
import { notifyAcceptedFriends } from "@/api/notificationService";
import { listUserRewardsWithLegacyFallback } from "@/api/userRewardService";

/**
 * Prüft alle Achievements und schaltet neue frei
 * @param {Object} user - Der aktuelle User
 * @param {Object} [options]
 * @param {string} [options.triggerDiscoveryId] - Discovery-ID des auslösenden Scans (für Reward-Zuordnung im Social Feed)
 * @returns {Array} - Liste der neu freigeschalteten Achievements
 */
export async function checkAndUnlockAchievements(user, { triggerDiscoveryId = null } = {}) {
  if (!user) return [];

  try {
    console.log('[AchievementChecker] Starting check for user:', user.email);
    
    // Lade alle benötigten Daten
    const [
      achievements,
      userAchievements,
      plants,
      genera,
      userDiscoveries,
      allFriendRecords,
      rewards,
      userRewards,
      referrals,
      robotPlantLedgerEntries,
    ] = await Promise.all([
      Query.Achievement.list(),
      Query.UserAchievement.filter({ auth_id: user.id }),
      Query.Plant.list(),
      Query.PlantGenus.list(),
      Query.UserPlantDiscovery.filter({ auth_id: user.id }),
      // Lade alle Freundschafts-Einträge und filtere danach wie im restlichen App-Code
      Query.Friend.list(),
      // Rewards und bereits freigeschaltete User-Rewards (für Backfill)
      Query.Reward.list(),
      listUserRewardsWithLegacyFallback({ authId: user.id, userEmail: user.email }),
      Query.Referral.list(),
      Query.RobotPlantWalletLedger.filter({ auth_id: user.id }),
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
      rewards: rewards.length,
      userRewards: userRewards.length,
      referrals: referrals.length,
      robotPlantLedgerEntries: robotPlantLedgerEntries.length,
      friendsTotal: allFriendRecords.length,
      friendsAcceptedForUser: friends.length
    });

    const normalizeText = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const lineeAchievementAliases = [
      "Carl von Linne",
      "Carl von Linnee",
      "Carl von Linee",
      "Carl von Linée",
      "Carl von Linné",
      "Jahrhundertsammlung",
    ];

    const hasAllTokens = (text, tokens = []) => {
      if (!text) return false;
      return tokens.every((token) => text.includes(token));
    };

    const findRewardByTokenSets = (tokenSets = []) => {
      if (!Array.isArray(tokenSets) || tokenSets.length === 0) return null;

      const fieldsByPriority = ["name", "display_name", "value"];

      for (const tokenSet of tokenSets) {
        const normalizedTokens = (Array.isArray(tokenSet) ? tokenSet : [tokenSet])
          .map((token) => normalizeText(token))
          .filter(Boolean);

        if (normalizedTokens.length === 0) continue;

        for (const field of fieldsByPriority) {
          const reward = rewards.find((entry) =>
            hasAllTokens(normalizeText(entry?.[field]), normalizedTokens)
          );
          if (reward) return reward;
        }
      }

      return null;
    };

    const resolveRewardByCandidates = (candidates = []) => {
      const normalizedCandidates = (Array.isArray(candidates) ? candidates : [candidates])
        .map((candidate) => normalizeText(candidate))
        .filter(Boolean);

      if (normalizedCandidates.length === 0) return null;

      const fieldsByPriority = ["name", "display_name", "value"];
      for (const field of fieldsByPriority) {
        const reward = rewards.find((entry) =>
          normalizedCandidates.includes(normalizeText(entry?.[field]))
        );
        if (reward) return reward;
      }

      return null;
    };

    const resolveRewardForAchievement = (achievement) => {
      if (!achievement) return null;
      const directMatch = resolveRewardByCandidates([
        achievement?.reward_name,
        achievement?.title_reward,
      ]);

      if (directMatch) return directMatch;

      const isLineeAchievement = lineeAchievementAliases
        .map((title) => normalizeText(title))
        .includes(normalizeText(achievement?.title));

      if (!isLineeAchievement) return null;

      // Fallback for historic spelling/encoding variants of the Carl-von-Linne background reward.
      return findRewardByTokenSets([
        ["carl", "lin", "hintergrund"],
        ["carl", "lin", "background"],
        ["linee", "hintergrund"],
      ]);
    };

    const unlockedAchievements = [];
    const unlockedRewardIds = new Set((Array.isArray(userRewards) ? userRewards : []).map((ur) => ur?.reward_id).filter(Boolean));

    // Backfill: Fehlende Rewards für bereits freigeschaltete Achievements nachtragen
    try {
      for (const userAchievement of userAchievements) {
        const achievement = achievements.find((a) => a.id === userAchievement.achievement_id);
        if (!achievement) continue;

        const reward = resolveRewardForAchievement(achievement);
        if (!reward || unlockedRewardIds.has(reward.id)) continue;

        console.log(
          "[AchievementChecker] Backfilling missing reward for existing achievement:",
          achievement.title,
          "->",
          reward.name
        );

        await Query.UserReward.create({
          reward_id: reward.id,
          reward_name: reward.display_name,
          auth_id: user.id,
          user_email: user.email,
          user_name: user.display_name || user.full_name || user.email,
          unlocked_date: new Date().toISOString(),
        });

        unlockedRewardIds.add(reward.id);
      }
    } catch (backfillError) {
      console.error("[AchievementChecker] Error while backfilling rewards for existing achievements:", backfillError);
    }

    // Hilfsfunktionen zum Finden von Achievements
    const findAchievementByTitle = (title) =>
      achievements.find((a) => normalizeText(a.title) === normalizeText(title));

    const findAchievementByTitles = (titles = []) => {
      if (!Array.isArray(titles) || titles.length === 0) return null;
      for (const title of titles) {
        const found = achievements.find((achievement) => normalizeText(achievement.title) === normalizeText(title));
        if (found) return found;
      }
      return null;
    };

    const findAllAchievementsByTitles = (titles = []) => {
      if (!Array.isArray(titles) || titles.length === 0) return [];
      const normalizedTargets = titles.map((title) => normalizeText(title)).filter(Boolean);
      return achievements.filter((achievement) => normalizedTargets.includes(normalizeText(achievement.title)));
    };

    const findAchievementByRewardName = (rewardName) =>
      achievements.find(a => a.reward_name === rewardName);

    // Hilfsfunktion: Hat User das Achievement schon? (per Titel)
    const hasAchievement = (title) => {
      const achievement = findAchievementByTitle(title);
      return achievement && userAchievements.some(ua => ua.achievement_id === achievement.id);
    };

    const hasAchievementByAnyTitle = (titles = []) => {
      const matchedAchievements = findAllAchievementsByTitles(titles);
      return matchedAchievements.some((achievement) =>
        userAchievements.some((ua) => ua.achievement_id === achievement.id)
      );
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

      try {
        await notifyAcceptedFriends({
          actorUser: user,
          notificationType: "friend_achievement",
          title: "🏆 Neuer Freundes-Erfolg",
          message: `${user.display_name || user.full_name || user.email} hat den Erfolg „${achievement.title}" freigeschaltet!`,
          description: achievement.title || "",
          actionUrl: `FriendAchievements?email=${encodeURIComponent(user.email)}`,
        });
      } catch (notificationError) {
        console.error("[AchievementChecker] Failed to notify friends about achievement unlock:", notificationError);
      }

      // Wenn das Achievement einen zuordenbaren Reward hat, schalte diesen ebenfalls frei
      const reward = resolveRewardForAchievement(achievement);

      if (reward) {
        // Prüfe konsistent gegen bereits geladenen/fortgeschriebenen Reward-Status.
        const hasReward = unlockedRewardIds.has(reward.id);

        if (!hasReward) {
          console.log('[AchievementChecker] Unlocking reward:', reward.name, reward.display_name);

          // Schalte Reward frei
          await Query.UserReward.create({
            reward_id: reward.id,
            reward_name: reward.display_name,
            auth_id: user.id,
            user_email: user.email,
            user_name: user.display_name || user.full_name || user.email,
            unlocked_date: new Date().toISOString(),
            ...(triggerDiscoveryId ? { discovery_id: triggerDiscoveryId } : {}),
          });
          unlockedRewardIds.add(reward.id);

          // Früher wurde hier eine UserNotification im Banner-Stil erstellt.
          // Belohnungs-Feedback wird nun direkt über UI-Komponenten (z.B. ScanFeedbackNotification)
          // gehandhabt und nicht mehr als persistente Notification gespeichert.
        } else {
          console.log('[AchievementChecker] User already has reward:', reward.name);
        }
      }

      return achievement;
    };

    const unlockAchievementByAnyTitle = async (titles = []) => {
      const achievement = findAchievementByTitles(titles);
      if (!achievement) {
        console.warn('[AchievementChecker] Achievement definition not found for any title:', titles);
        return null;
      }
      if (hasAchievementByAnyTitle(titles)) {
        console.log('[AchievementChecker] Achievement already unlocked, skipping alias group:', titles, 'resolved title:', achievement.title);
        return null;
      }

      console.log('[AchievementChecker] Unlocking achievement by aliases:', titles, 'resolved title:', achievement.title, 'with reward:', achievement.reward_name);

      await Query.UserAchievement.create({
        achievement_id: achievement.id,
        unlocked_date: new Date().toISOString(),
        auth_id: user.id,
        created_by: user.email
      });

      try {
        await notifyAcceptedFriends({
          actorUser: user,
          notificationType: "friend_achievement",
          title: "🏆 Neuer Freundes-Erfolg",
          message: `${user.display_name || user.full_name || user.email} hat den Erfolg „${achievement.title}" freigeschaltet!`,
          description: achievement.title || "",
          actionUrl: `FriendAchievements?email=${encodeURIComponent(user.email)}`,
        });
      } catch (notificationError) {
        console.error("[AchievementChecker] Failed to notify friends about achievement unlock:", notificationError);
      }

      // Wenn das Achievement einen zuordenbaren Reward hat, schalte diesen ebenfalls frei
      const reward = resolveRewardForAchievement(achievement);

      if (reward) {
        // Prüfe konsistent gegen bereits geladenen/fortgeschriebenen Reward-Status.
        const hasReward = unlockedRewardIds.has(reward.id);

        if (!hasReward) {
          console.log('[AchievementChecker] Unlocking reward:', reward.name, reward.display_name);

          // Schalte Reward frei
          await Query.UserReward.create({
            reward_id: reward.id,
            reward_name: reward.display_name,
            auth_id: user.id,
            user_email: user.email,
            user_name: user.display_name || user.full_name || user.email,
            unlocked_date: new Date().toISOString(),
            ...(triggerDiscoveryId ? { discovery_id: triggerDiscoveryId } : {}),
          });
          unlockedRewardIds.add(reward.id);

          // Früher wurde hier eine UserNotification im Banner-Stil erstellt.
          // Belohnungs-Feedback wird nun direkt über UI-Komponenten (z.B. ScanFeedbackNotification)
          // gehandhabt und nicht mehr als persistente Notification gespeichert.
        } else {
          console.log('[AchievementChecker] User already has reward:', reward.name);
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

      try {
        await notifyAcceptedFriends({
          actorUser: user,
          notificationType: "friend_achievement",
          title: "🏆 Neuer Freundes-Erfolg",
          message: `${user.display_name || user.full_name || user.email} hat den Erfolg „${achievement.title}" freigeschaltet!`,
          description: achievement.title || "",
          actionUrl: `FriendAchievements?email=${encodeURIComponent(user.email)}`,
        });
      } catch (notificationError) {
        console.error("[AchievementChecker] Failed to notify friends about achievement unlock:", notificationError);
      }

      // Wenn das Achievement einen zuordenbaren Reward hat, schalte diesen ebenfalls frei (gleiche Logik wie oben)
      const reward = resolveRewardForAchievement(achievement);

      if (reward) {
        const hasReward = unlockedRewardIds.has(reward.id);

        if (!hasReward) {
          console.log('[AchievementChecker] Unlocking reward (by reward_name):', reward.name, reward.display_name);
          await Query.UserReward.create({
            reward_id: reward.id,
            reward_name: reward.display_name,
            auth_id: user.id,
            user_email: user.email,
            user_name: user.display_name || user.full_name || user.email,
            unlocked_date: new Date().toISOString(),
            ...(triggerDiscoveryId ? { discovery_id: triggerDiscoveryId } : {}),
          });
          unlockedRewardIds.add(reward.id);
        } else {
          console.log('[AchievementChecker] User already has reward (by reward_name):', reward.name);
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

    const getGenusKey = (genus) => {
      if (!genus) return "";
      const genusId = String(genus.id || "").trim();
      if (genusId) return `id:${genusId}`;

      const category = String(genus.category || "").trim();
      const genusNumber = Number(genus.category_dex_number || 0);
      if (category && genusNumber) return `cat:${category}:${genusNumber}`;

      return "";
    };

    const getPlantGenusKey = (plant) => {
      if (!plant) return "";
      const plantGenusId = String(plant.genus_id || "").trim();
      if (plantGenusId) return `id:${plantGenusId}`;

      const category = String(plant.genus_category || "").trim();
      const genusNumber = Number(plant.genus_number || 0);
      if (category && genusNumber) return `cat:${category}:${genusNumber}`;

      return "";
    };

    const matchesGenus = (plant, genus) => {
      if (!plant || !genus) return false;

      if (plant.genus_id && genus.id && String(plant.genus_id) === String(genus.id)) {
        return true;
      }

      return (
        String(plant.genus_category || "").trim() === String(genus.category || "").trim() &&
        Number(plant.genus_number || 0) === Number(genus.category_dex_number || 0)
      );
    };

    // As per outline, discoveredGenera is the count of unique genera discovered by the user
    const discoveredGenera = genera.filter((genus) =>
      userDiscoveredPlantObjects.some((plant) => matchesGenus(plant, genus))
    ).length;

    // To get the actual genus objects discovered by the user (needed for filtering categories)
    const discoveredGenusKeysByUser = new Set(
      userDiscoveredPlantObjects.map((plant) => getPlantGenusKey(plant)).filter(Boolean)
    );
    const discoveredGeneraByUser = genera.filter((genus) => discoveredGenusKeysByUser.has(getGenusKey(genus)));

    const discoveredPlantIds = new Set(
      userDiscoveries.map((discovery) => discovery?.plant_id).filter(Boolean)
    );

    const discoveredSpeciesCount = discoveredPlantIds.size;

    const normalizeGenusCategory = (value) => {
      const normalized = String(value || '').trim();
      if (!normalized) return '';
      if (normalized === 'Blumen & Kräuter') return 'Blumen';
      return normalized;
    };

    const discoveredPlantsUnique = plants.filter((plant) => discoveredPlantIds.has(plant.id));
    const discoveredTreeSpeciesCount = discoveredPlantsUnique.filter((plant) => normalizeGenusCategory(plant.genus_category) === 'Bäume').length;
    const discoveredFlowerSpeciesCount = discoveredPlantsUnique.filter((plant) => normalizeGenusCategory(plant.genus_category) === 'Blumen').length;
    const discoveredShrubSpeciesCount = discoveredPlantsUnique.filter((plant) => normalizeGenusCategory(plant.genus_category) === 'Sträucher').length;

    const referralCompletions = (Array.isArray(referrals) ? referrals : []).filter((referral) => {
      const referrerEmail = String(referral?.referrer_email || '').trim().toLowerCase();
      const referrerAuthId = String(referral?.referrer_auth_id || '').trim();
      const createdByEmail = String(referral?.created_by || '').trim().toLowerCase();
      const status = String(referral?.status || '').trim().toLowerCase();
      return (
        (referrerAuthId && referrerAuthId === String(user.id)) ||
        (referrerEmail && referrerEmail === userEmailLower) ||
        (createdByEmail && createdByEmail === userEmailLower)
      ) && status === 'completed';
    }).length;

    // Pionier: Primär über new_global_scan Ledger-Events (stabil im neuen Scanner-Flow),
    // Legacy-Fallback über Plant-Autorfelder falls vorhanden.
    const newGlobalEventDiscoveryIds = new Set(
      (Array.isArray(robotPlantLedgerEntries) ? robotPlantLedgerEntries : [])
        .filter((entry) => String(entry?.event_source || '').trim().toLowerCase() === 'new_global_scan')
        .map((entry) => String(entry?.event_reference || '').trim())
        .filter(Boolean)
    );

    const plantIdsFromNewGlobalEvents = new Set(
      (Array.isArray(userDiscoveries) ? userDiscoveries : [])
        .filter((discovery) => newGlobalEventDiscoveryIds.has(String(discovery?.id || '').trim()))
        .map((discovery) => discovery?.plant_id)
        .filter(Boolean)
    );

    const legacyAttributedPlantIds = new Set(
      (Array.isArray(plants) ? plants : [])
        .filter((plant) => {
          const createdById = String(plant?.created_by_id || '').trim();
          const authId = String(plant?.auth_id || '').trim();
          const createdByEmail = String(plant?.created_by || '').trim().toLowerCase();
          return (
            (createdById && createdById === String(user.id)) ||
            (authId && authId === String(user.id)) ||
            (createdByEmail && createdByEmail === userEmailLower)
          );
        })
        .map((plant) => plant?.id)
        .filter(Boolean)
    );

    const newPlantsAddedToGlobalDex = new Set([
      ...plantIdsFromNewGlobalEvents,
      ...legacyAttributedPlantIds,
    ]).size;

    console.log('[AchievementChecker] Computed stats:', {
      discoveredPlants,
      discoveredSpeciesCount,
      longestScanStreak,
      discoveredGenera,
      discoveredGeneraByUser: discoveredGeneraByUser.length,
      discoveredTreeSpeciesCount,
      discoveredFlowerSpeciesCount,
      discoveredShrubSpeciesCount,
      newPlantsAddedToGlobalDex,
      newGlobalEventDiscoveryIds: newGlobalEventDiscoveryIds.size,
      plantIdsFromNewGlobalEvents: plantIdsFromNewGlobalEvents.size,
      legacyAttributedPlantIds: legacyAttributedPlantIds.size,
      referralCompletions,
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
    
    // 3. Wissenschaftler (Legacy: Fleißiger Sammler) - 50 verschiedene Pflanzenarten
    if (discoveredSpeciesCount >= 50) {
      const scientistAliases = ["Wissenschaftler", "Wissenschafter", "Fleißiger Sammler"];
      const scientistDefinitions = findAllAchievementsByTitles(scientistAliases);

      if (scientistDefinitions.length > 0) {
        // Falls Legacy- und neuer Titel als getrennte Zeilen existieren, beide sauber nachziehen.
        for (const definition of scientistDefinitions) {
          const achievement = await unlockAchievement(definition.title);
          if (achievement) unlockedAchievements.push(achievement);
        }
      } else {
        const achievement = await unlockAchievementByAnyTitle(scientistAliases);
        if (achievement) unlockedAchievements.push(achievement);
      }
    }

    // 4. Naturkind (Legacy: Gattungssammler) - 10 verschiedene Pflanzengattungen
    if (discoveredGenera >= 10 && !hasAchievementByAnyTitle(["Naturkind", "Gattungssammler"])) {
      const achievement = await unlockAchievementByAnyTitle(["Naturkind", "Gattungssammler"]);
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 5. Forstwirt - 10 verschiedene Baumarten scannen
    if (discoveredTreeSpeciesCount >= 10 && !hasAchievementByAnyTitle(["Forstwirt"])) {
      const achievement = await unlockAchievementByAnyTitle(["Forstwirt"]);
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 6. Floristin - 10 verschiedene Blumen scannen
    if (discoveredFlowerSpeciesCount >= 10 && !hasAchievementByAnyTitle(["Floristin"])) {
      const achievement = await unlockAchievementByAnyTitle(["Floristin"]);
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 7. Ab durch die Hecke - 10 verschiedene Sträucher scannen
    if (discoveredShrubSpeciesCount >= 10 && !hasAchievementByAnyTitle(["Ab durch die Hecke"])) {
      const achievement = await unlockAchievementByAnyTitle(["Ab durch die Hecke"]);
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 8. Carl von Linné (Legacy: Jahrhundertsammlung) - 100 verschiedene Pflanzenarten
    if (discoveredSpeciesCount >= 100) {
      const lineeAliases = ["Carl von Linné", "Carl von Linne", "Carl von Linee", "Carl von Linée", "Jahrhundertsammlung"];
      const lineeDefinitions = findAllAchievementsByTitles(lineeAliases);

      if (lineeDefinitions.length > 0) {
        for (const definition of lineeDefinitions) {
          const achievement = await unlockAchievement(definition.title);
          if (achievement) unlockedAchievements.push(achievement);
        }
      } else {
        const achievement = await unlockAchievementByAnyTitle(lineeAliases);
        if (achievement) unlockedAchievements.push(achievement);
      }
    }

    // 9. Pionier - 10 neue Pflanzen zum globalen Floralog hinzugefügt
    if (newPlantsAddedToGlobalDex >= 10 && !hasAchievementByAnyTitle(["Pionier"])) {
      const achievement = await unlockAchievementByAnyTitle(["Pionier"]);
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 9b. Botschafter - 5 erfolgreiche Empfehlungen
    if (referralCompletions >= 5 && !hasAchievementByAnyTitle(["Botschafter"])) {
      const achievement = await unlockAchievementByAnyTitle(["Botschafter"]);
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 10. Floralog Meister - Alle Pflanzen entdeckt
    if (plants.length > 0 && userDiscoveredPlantObjects.length >= plants.length && !hasAchievement("Floralog Meister")) {
      const achievement = await unlockAchievement("Floralog Meister");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // Neuer Freundes-Erfolg "Buddy" (über Reward-Name title_buddy)
    // Bedingung: Mindestens 1 akzeptierte Freundschaft
    if (friends.length >= 1 && !hasAchievementByRewardName('title_buddy')) {
      const achievement = await unlockAchievementByRewardName('title_buddy');
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 11. Glücksfund - Eine Seltene Pflanze entdeckt
    const hasRarePlant = userDiscoveredPlantObjects.some(p => 
      p.rarity === "Selten" || 
      p.rarity === "Sehr Selten" || 
      p.rarity === "Extrem Selten"
    );
    if (hasRarePlant && !hasAchievement("Glücksfund")) {
      const achievement = await unlockAchievement("Glücksfund");
      if (achievement) unlockedAchievements.push(achievement);
    }

    // 12. Gewohnheitstier - 3 Tage hintereinander scannen
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

