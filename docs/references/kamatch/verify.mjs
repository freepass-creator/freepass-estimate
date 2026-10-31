import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayQuote } from './replay-quote.mjs';

const data = JSON.parse(readFileSync(new URL('./observations.json', import.meta.url), 'utf8'));
assert.equal(data.rows.length, 13);
assert.equal(new Set(data.rows.map(row => row.id)).size, data.rows.length);
let checked = 0;
for (const row of data.rows) {
  assert.deepEqual(row.results.map(r => r.termMonths), [36, 48, 60]);
  for (const result of row.results) {
    for (const key of ['monthlyRent', 'acquisitionCost', 'deposit', 'prepay', 'residualAmount']) {
      assert.ok(Number.isSafeInteger(result[key]) && result[key] >= 0, `${row.id}: ${key}`);
    }
    assert.equal(result.acquisitionCost, row.input.vehiclePrice + row.input.factoryOptions.reduce((sum, o) => sum + o.price, 0));
    assert.deepEqual(replayQuote(row.input, result.termMonths).result, result);
    checked++;
  }
}
const byId = id => data.rows.find(row => row.id === id);
const rents = id => byId(id).results.map(result => result.monthlyRent);
const delta = (after, before) => rents(after).map((value, i) => value - rents(before)[i]);
assert.deepEqual(delta('all-new-avante-premium-wide-sunroof', 'all-new-avante-premium-base'), [18400, 17500, 16700]);
assert.deepEqual(delta('all-new-avante-premium-smartsense', 'all-new-avante-premium-base'), [8200, 7800, 7400]);
// Combined-option evidence rejects independently rounded option addition.
assert.deepEqual(delta('all-new-avante-premium-sunroof-smartsense', 'all-new-avante-premium-base'), [26500, 25200, 24100]);
assert.deepEqual(delta('all-new-avante-modern-no-dashcam', 'all-new-avante-modern-base'), [-4300, -3200, -2600]);

const baseline = byId('all-new-avante-premium-base');
for (const input of [
  { ...baseline.input, annualKm: 20000 },
  { ...baseline.input, vehiclePrice: 27710000 },
  { ...baseline.input, unrecordedSetting: true },
  { model: baseline.input.model, trim: baseline.input.trim },
]) {
  assert.throws(() => replayQuote(input, 60), { code: 'KAMATCH_OBSERVATION_NOT_FOUND' });
}
assert.throws(() => replayQuote(baseline.input, 72), { code: 'KAMATCH_OBSERVATION_NOT_FOUND' });
// Callers cannot modify source evidence by mutating a returned result.
const copy = replayQuote(baseline.input, 60);
copy.result.monthlyRent = 0;
assert.equal(replayQuote(baseline.input, 60).result.monthlyRent, 664700);
console.log(`Verified ${checked} displayed quote results; option deltas; exact-input rejection; immutable replay outputs.`);
