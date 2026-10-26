export function scanBaseReward(eventSource: string): number {
  return ({ scan: 10, new_scan: 30, new_season_scan: 40, season_rediscovery: 20, new_global_scan: 50 } as Record<string, number>)[eventSource] ?? 0;
}

export function rarityMultiplier(rarity: string | null): number {
  const key = (rarity || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
  return ({ haufig: 1, haeufig: 1, gelegentlich: 2, selten: 2, sehrselten: 3, extremselten: 3, ausgestorbenoderverschollen: 3 } as Record<string, number>)[key] ?? 1;
}

export function scanRewardTotal(adjustedBase: number, zone: number, rarity: number, novelty: number, care: number, firstScan: number): number {
  return Math.max(1, Math.round(adjustedBase * zone * rarity * novelty * care * firstScan));
}

// A guest has no health, care, area or zone state yet. The reserved reward uses
// the real discovery/rarity rules, without inventing personal stat bonuses.
export function guestReward(isNewGlobal: boolean, rarity: string | null) {
  const eventSource = isNewGlobal ? "new_global_scan" : "new_scan";
  const baseReward = scanBaseReward(eventSource);
  const rarityValue = rarityMultiplier(rarity);
  const finalReward = scanRewardTotal(baseReward, 1, rarityValue, 1, 1, 2);
  return {
    eventSource, isScanReward: true, isInActiveZone: false,
    baseReward, adjustedBaseReward: baseReward,
    healthStateLabel: "", healthStateBonus: 0,
    zoneMultiplier: 1, rarityMultiplier: rarityValue,
    noveltyMultiplier: 1, careMultiplier: 1, firstScanOfDayMultiplier: 2,
    preStreakReward: finalReward, finalReward,
  };
}
