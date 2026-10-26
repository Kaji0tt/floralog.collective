/** @param {unknown} value */
export const normalizeBotName = (value) => {
  const cleaned = String(value || "")
    .replace(/[^A-Za-z\u00C0-\u017F\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
  return cleaned || null;
};

/** @param {unknown} seedSource */
export const createFallbackBotName = (seedSource) => {
  const text = String(seedSource || "floralog");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const seed = Math.abs(hash >>> 0);
  const consonants = "bcdfghjklmnprstvz";
  const vowels = "aeiou";
  const syllableCount = 2 + (seed % 2);
  let name = "";
  for (let i = 0; i < syllableCount; i += 1) {
    name += consonants[(seed + i * 7) % consonants.length];
    name += vowels[(seed + i * 11) % vowels.length];
  }
  const suffixes = ["ra", "lo", "na", "ri", "ta", "mo"];
  name += suffixes[seed % suffixes.length];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
};

export const createRandomBotName = (previousName = "") => {
  let name;
  do {
    name = createFallbackBotName(crypto.randomUUID());
  } while (name === previousName);
  return name;
};
