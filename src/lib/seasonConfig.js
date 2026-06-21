/**
 * Season configuration for Floralog seasonal collections.
 * Each season defines a time-bounded collection period where scans
 * are tracked separately from the global collection.
 */

export const SEASONS = [
  {
    id: "sommer-2026",
    title: "Sommer 2026",
    startDate: "2026-06-21",
    endDate: null, // open-ended for now
    emoji: "☀️",
  },
];

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
