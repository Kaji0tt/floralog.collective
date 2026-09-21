export function pickZoneBonusMultiplier(rng = Math.random) {
  const roll = Number(rng?.() ?? Math.random());

  if (roll <= 0.75) {
    return 1.5 + (roll / 0.75) * 0.5;
  }

  const tailProgress = (roll - 0.75) / 0.25;
  return 2.0 + Math.pow(tailProgress, 3) * 0.5;
}
