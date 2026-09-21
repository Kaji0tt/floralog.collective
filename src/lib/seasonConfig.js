/**
 * Season configuration for Floralog seasonal collections.
 * Each season starts on the 21st day of the quarter season month
 * (March, June, September, December) and ends the day before the next one.
 */

const SEASON_DEFINITIONS = [
  { slug: "fruehling", title: "Frühling Saison", monthIndex: 2, emoji: "🌸" },
  { slug: "sommer", title: "Sommer Saison", monthIndex: 5, emoji: "☀️" },
  { slug: "herbst", title: "Herbst Saison", monthIndex: 8, emoji: "🍂" },
  { slug: "winter", title: "Winter Saison", monthIndex: 11, emoji: "❄️" },
];

const SEASON_START_DAY = 21;
const FIRST_AUTOMATED_SEASON_YEAR = 2026;
const FUTURE_SEASON_YEARS = 4;

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildSeason(definition, year) {
  const nextDefinitionIndex = (SEASON_DEFINITIONS.indexOf(definition) + 1) % SEASON_DEFINITIONS.length;
  const nextDefinition = SEASON_DEFINITIONS[nextDefinitionIndex];
  const nextYear = definition.slug === "winter" ? year + 1 : year;
  const startDate = new Date(Date.UTC(year, definition.monthIndex, SEASON_START_DAY));
  const nextStartDate = new Date(Date.UTC(nextYear, nextDefinition.monthIndex, SEASON_START_DAY));
  const endDate = new Date(nextStartDate);
  endDate.setUTCDate(endDate.getUTCDate() - 1);

  const displayYear = definition.slug === "winter"
    ? `${year}/${String(year + 1).slice(2)}`
    : String(year);

  return {
    id: `${definition.slug}-${year}`,
    title: `${definition.title} ${displayYear}`,
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
    emoji: definition.emoji,
  };
}

function buildSeasons(referenceDate = new Date()) {
  const referenceYear = referenceDate.getUTCFullYear();
  const finalYear = referenceYear + FUTURE_SEASON_YEARS;
  const seasons = [];

  for (let year = FIRST_AUTOMATED_SEASON_YEAR; year <= finalYear; year += 1) {
    SEASON_DEFINITIONS.forEach((definition) => {
      seasons.push(buildSeason(definition, year));
    });
  }

  return seasons;
}

export const SEASONS = buildSeasons();

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
