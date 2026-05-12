const BAD_WORD_PATTERNS = [
  /\bfuck(?:er|ing|ed|s)?\b/i,
  /\bshit(?:ty|head|hole|s)?\b/i,
  /\bbitch(?:es|y)?\b/i,
  /\basshole\b/i,
  /\bcunt\b/i,
  /\bdick(?:head)?\b/i,
  /\bslut\b/i,
  /\bwhore\b/i,
  /\bmotherfucker\b/i,
  /\bschei(?:ss|s)e\b/i,
  /\bschei(?:ss|s)\b/i,
  /\barschloch\b/i,
  /\bwichser\b/i,
  /\bfotze\b/i,
  /\bfick(?:en|er|e|t)?\b/i,
  /\bhurensohn\b/i,
  /\bmissgeburt\b/i,
];

const normalizeForModeration = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const hasProfanityInTileClaimName = (value) => {
  const normalized = normalizeForModeration(value);
  if (!normalized) return false;
  return BAD_WORD_PATTERNS.some((pattern) => pattern.test(normalized));
};
