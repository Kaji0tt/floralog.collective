// XP-System mit umgekehrter Kurve - flach am Start, steiler in der Mitte, flach zum Ende

export function getXPForLevel(level) {
  if (level <= 1) return 0;
  
  let xp;
  
  // Level 1-10: Langsamer linearer Start
  if (level <= 10) {
    xp = 100 + (level - 1) * 50;
  }
  // Level 11-20: Exponentieller Anstieg
  else if (level <= 20) {
    xp = 550 + Math.pow(level - 10, 2.2) * 20;
  }
  // Level 21-30: Flacher werdend bis max 1.500
  else if (level <= 30) {
    const progress = (level - 20) / 10; // 0 bis 1
    const startXP = 1200;
    const endXP = 1500;
    xp = startXP + (endXP - startXP) * progress;
  }
  // Ab Level 30: Konstant bei 1.500
  else {
    xp = 1500;
  }
  
  // Runde auf nächsten 50er
  return Math.round(xp / 50) * 50;
}

export function getTotalXPForLevel(level) {
  let totalXP = 0;
  for (let i = 1; i <= level; i++) {
    totalXP += getXPForLevel(i);
  }
  return totalXP;
}

export function getLevelFromXP(xp) {
  let level = 1;
  let accumulatedXP = 0;
  
  while (accumulatedXP + getXPForLevel(level + 1) <= xp) {
    accumulatedXP += getXPForLevel(level + 1);
    level++;
    
    // Sicherheits-Cap bei Level 100
    if (level >= 100) break;
  }
  
  return level;
}

export function getXPProgressInLevel(xp, level) {
  const xpForPreviousLevels = getTotalXPForLevel(level);
  const currentLevelXP = xp - xpForPreviousLevels;
  const xpNeededForNextLevel = getXPForLevel(level + 1);
  
  return {
    current: Math.max(0, currentLevelXP),
    needed: xpNeededForNextLevel,
    percentage: Math.min(100, Math.max(0, (currentLevelXP / xpNeededForNextLevel) * 100))
  };
}

export function getTitleForLevel(level) {
  if (level >= 30) return "Pflanzen-Legende 🌟";
  if (level >= 25) return "Meister der Flora 🌳";
  if (level >= 20) return "Pflanzen-Meister 🌿";
  if (level >= 15) return "Natur-Experte 🍃";
  if (level >= 10) return "Flora-Kenner 🌱";
  if (level >= 5) return "Pflanzen-Forscher 🔍";
  return "Pflanzen-Anfänger 🌾";
}

export function awardXP(currentXP, amount) {
  const newTotalXP = currentXP + amount;
  const newLevel = getLevelFromXP(newTotalXP);
  const newTitle = getTitleForLevel(newLevel);
  
  return {
    xp: newTotalXP,
    level: newLevel,
    title: newTitle
  };
}