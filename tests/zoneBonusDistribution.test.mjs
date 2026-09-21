import test from 'node:test';
import assert from 'node:assert/strict';

const loadModule = async () => {
  const mod = await import('../supabase/functions/robotPlantDailyZones/zoneBonusMultiplier.js');
  return mod.pickZoneBonusMultiplier;
};

test('zone bonus multiplier stays within 1.5..2.5 and makes very high values rare', async () => {
  const pickZoneBonusMultiplier = await loadModule();

  const samples = Array.from({ length: 10000 }, () => pickZoneBonusMultiplier(() => Math.random()));

  assert.ok(samples.every((value) => value >= 1.5 && value <= 2.5));
  assert.ok(samples.filter((value) => value < 2.0).length > 7000, 'mehr als 70 % sollten unter 2.0 liegen');
  assert.ok(samples.filter((value) => value >= 2.0).length < 3000, 'oberhalb von 2.0 sollte deutlich seltener sein');
  assert.ok(samples.filter((value) => value >= 2.5).length === 0, '2.5 darf nur sehr selten bzw. im Randfall erreicht werden');
});
