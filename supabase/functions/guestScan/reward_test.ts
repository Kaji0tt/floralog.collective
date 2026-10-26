import { guestReward, rarityMultiplier, scanBaseReward, scanRewardTotal } from "../_shared/scanReward.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}

Deno.test("guest reward is a real discovery reward with no fabricated health or zone", () => {
  const reward = guestReward(false, "Häufig");
  equal(reward.baseReward, scanBaseReward("new_scan"));
  equal(reward.finalReward, 60);
  equal(reward.healthStateBonus, 0);
  equal(reward.careMultiplier, 1);
  equal(reward.isInActiveZone, false);
  equal(reward.zoneMultiplier, 1);
});
Deno.test("rarity and new-global rewards use the same formula as authenticated scans", () => {
  equal(guestReward(true, "Sehr selten").finalReward, 300);
  equal(guestReward(false, "Gelegentlich").finalReward, 120);
  equal(rarityMultiplier("Ausgestorben oder verschollen"), 3);
  equal(scanRewardTotal(45, 1.5, 2, 1, 1.72, 2), 464);
});
