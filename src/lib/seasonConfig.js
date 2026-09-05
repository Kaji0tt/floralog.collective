/**
 * Season configuration for Floralog seasonal collections.
 * Each season defines a time-bounded collection period where scans
 * are tracked separately from the global collection.
 */

export const SEASONS = [
  {
    id: "fruehling-2026",
    title: "Frühling 2026",
    startDate: "2026-03-20",
    endDate: "2026-06-20",
    emoji: "🌸",
  },
  {
    id: "sommer-2026",
    title: "Sommer 2026",
    startDate: "2026-06-21",
    endDate: "2026-09-22",
    emoji: "☀️",
  },
  {
    id: "herbst-2026",
    title: "Herbst 2026",
    startDate: "2026-09-23",
    endDate: "2026-12-21",
    emoji: "🍂",
  },
  {
    id: "winter-2026",
    title: "Winter 2026/27",
    startDate: "2026-12-22",
    endDate: "2027-03-19",
    emoji: "❄️",
  },
];

export const ALL_TIME_SEASON = {
  id: "alltime",
  title: "All-Time",
  startDate: null,
  endDate: null,
  emoji: "🌐",
};

export const LEADERBOARD_SEASONS = [
  ...SEASONS,
  ALL_TIME_SEASON,
];

export function getAllLeaderboardSeasons() {
  return LEADERBOARD_SEASONS;
}

export function getSeasonById(id) {
  if (!id) return null;
  if (id === "alltime") return ALL_TIME_SEASON;
  return SEASONS.find((s) => s.id === id) || null;
}

/**
 * Returns the currently active season based on today's date,
 * or null if no season is active.
 */
export function getActiveSeason(dateStr) {
  const today = dateStr || new Date().toISOString().slice(0, 10);
  return SEASONS.find((s) => {
    if (today < s.startDate) return false;
    if (s.endDate && today > s.endDate) return false;
    return true;
  }) || null;
}

/**
 * Determines the scan type for a plant in the context of a season.
 *
 * @param {object} params
 * @param {boolean} params.isNewGlobal - Plant is completely new to the global floralog
 * @param {boolean} params.alreadyDiscoveredByUser - User has already discovered this plant (ever)
 * @param {boolean} params.discoveredThisSeasonByUser - User already discovered this plant in the current season
 * @param {boolean} params.discoveredThisSeasonByAnyone - Anyone discovered this plant in the current season
 * @returns {"newGlobalScan"|"newSeasonScan"|"seasonRediscovery"|"duplicate"}
 */
export function classifyScan({
  isNewGlobal = false,
  alreadyDiscoveredByUser = false,
  discoveredThisSeasonByUser = false,
  discoveredThisSeasonByAnyone = false,
}) {
  if (isNewGlobal) return "newGlobalScan";
  if (!discoveredThisSeasonByAnyone) return "newSeasonScan";
  if (!discoveredThisSeasonByUser) return "seasonRediscovery";
  return "duplicate";
}
