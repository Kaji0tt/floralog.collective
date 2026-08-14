// Unified 1-6 plant rarity scale, derived from Red List data (Bestand + Gefaehrdung).
// Mirrors src/lib/plantRarity.js - MUST be kept in sync (no cross-import between
// supabase/functions/* (Deno) and src/* (Vite/browser) is possible in this repo).

type LevelEntry = { key: string; matchers: RegExp[] };

const POPULATION_LEVELS: (LevelEntry & { unifiedLevel: number })[] = [
  { key: "ausgestorben_oder_verschollen", unifiedLevel: 6, matchers: [/ausgestorben/, /verschollen/, /extinct/, /missing/] },
  { key: "extrem_selten", unifiedLevel: 5, matchers: [/extrem\s*selten/, /aeusserst\s*selten/, /auserst\s*selten/] },
  { key: "sehr_selten", unifiedLevel: 4, matchers: [/sehr\s*selten/, /very\s*rare/] },
  { key: "selten", unifiedLevel: 3, matchers: [/\bselten\b/, /rare/] },
  { key: "maessig_haeufig", unifiedLevel: 2, matchers: [/maessig\s*haeufig/, /massig\s*haeufig/, /mittel\s*haeufig/, /noch\s*haeufig/, /moderate/] },
  { key: "haeufig", unifiedLevel: 2, matchers: [/^haeufig$/, /^common$/, /^regular$/] },
  { key: "sehr_haeufig", unifiedLevel: 1, matchers: [/sehr\s*haeufig/, /very\s*common/, /abundant/] },
];

const THREAT_LEVELS: (LevelEntry & { unifiedLevel: number })[] = [
  { key: "ausgestorben_oder_verschollen", unifiedLevel: 6, matchers: [/ausgestorben/, /verschollen/, /extinct/, /missing/] },
  { key: "vom_aussterben_bedroht", unifiedLevel: 5, matchers: [/vom\s*aussterben\s*bedroht/, /critically\s*endangered/, /\bcr\b/] },
  { key: "stark_gefaehrdet", unifiedLevel: 4, matchers: [/stark\s*gefaehrdet/, /highly\s*endangered/, /\ben\b/] },
  { key: "gefaehrdet", unifiedLevel: 3, matchers: [/\bgefaehrdet\b/, /threatened/, /vulnerable/, /\bvu\b/] },
  { key: "vorwarnliste", unifiedLevel: 2, matchers: [/vorwarnliste/, /near\s*threatened/, /watch\s*list/, /\bnt\b/] },
  { key: "ungefaehrdet", unifiedLevel: 1, matchers: [/ungefaehrdet/, /nicht\s*gefaehrdet/, /least\s*concern/, /\blc\b/] },
];

const RARITY_LEVEL_LABELS: Record<number, string> = {
  1: "Häufig",
  2: "Gelegentlich",
  3: "Selten",
  4: "Sehr selten",
  5: "Extrem selten",
  6: "Ausgestorben oder verschollen",
};

const normalizeConservationText = (value: unknown): string =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9&,/;|\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitAlternatives = (value: unknown): string[] => {
  const normalized = normalizeConservationText(value);
  if (!normalized) return [];
  return normalized
    .split(/\s*(?:&&|\||\/|,|;)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const matchUnifiedLevel = (
  rawValue: unknown,
  levels: (LevelEntry & { unifiedLevel: number })[],
  fallbackLevel: number,
): number => {
  const normalized = normalizeConservationText(rawValue);
  if (!normalized) return fallbackLevel;

  const alternatives = splitAlternatives(rawValue);
  const candidates = alternatives.length > 0 ? alternatives : [normalized];

  for (const candidate of candidates) {
    for (const level of levels) {
      if (level.matchers.some((matcher) => matcher.test(candidate))) {
        return level.unifiedLevel;
      }
    }
  }

  for (const level of levels) {
    if (level.matchers.some((matcher) => matcher.test(normalized))) {
      return level.unifiedLevel;
    }
  }

  return fallbackLevel;
};

export const getPopulationUnifiedLevel = (populationRaw: unknown): number =>
  matchUnifiedLevel(populationRaw, POPULATION_LEVELS, 1);

export const getThreatUnifiedLevel = (threatRaw: unknown): number =>
  matchUnifiedLevel(threatRaw, THREAT_LEVELS, 1);

/** rarity level = max(Bestand-Level, Gefaehrdungs-Level), volle Kopplung */
export const computeRarityLevel = (populationRaw: unknown, threatRaw: unknown): number =>
  Math.max(getPopulationUnifiedLevel(populationRaw), getThreatUnifiedLevel(threatRaw));

export const getRarityLabelFromLevel = (level: number): string => {
  const clamped = Math.max(1, Math.min(6, Math.round(level) || 1));
  return RARITY_LEVEL_LABELS[clamped];
};

export const computeRarityLabel = (populationRaw: unknown, threatRaw: unknown): string =>
  getRarityLabelFromLevel(computeRarityLevel(populationRaw, threatRaw));

const normalizeRarityText = (value: unknown): string =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Robuste, case-insensitive Rueckwaertskonvertierung eines gespeicherten plant.rarity-Labels -> Level (1-6). */
export const getRarityLevelFromLabel = (labelValue: unknown): number => {
  const normalized = normalizeRarityText(labelValue);
  if (!normalized) return 1;

  if (/ausgestorben|verschollen/.test(normalized)) return 6;
  if (/extrem\s*selten/.test(normalized)) return 5;
  if (/sehr\s*selten/.test(normalized)) return 4;
  if (/\bselten\b/.test(normalized)) return 3;
  if (/gelegentlich|ungewohnlich/.test(normalized)) return 2;
  if (/haufig|common/.test(normalized)) return 1;
  return 1;
};
