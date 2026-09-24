import test from 'node:test';
import assert from 'node:assert/strict';

const { buildRewardUnlockDescription } = await import('../src/lib/rewardUnlockDescription.js');

test('custom descriptions are shown for locked rewards', () => {
  const result = buildRewardUnlockDescription({
    custom_description: 'Erhältlich in der Wasser-Zone-Lootbox. Chance ca. 3.5%.',
  });

  assert.equal(result, 'Erhältlich in der Wasser-Zone-Lootbox. Chance ca. 3.5%.');
});

test('lootbox metadata generates a source and chance summary', () => {
  const result = buildRewardUnlockDescription({
    id: 'reward-42',
    name: 'Test-Reward',
  }, {
    lootboxMetadata: [{
      poolName: 'Wald-Knospe',
      weight: 12,
      totalWeight: 600,
      selectionGroup: 'bonus',
    }],
  });

  assert.match(result, /Wald-Knospe/);
  assert.match(result, /2\.?00%|2%/);
});
