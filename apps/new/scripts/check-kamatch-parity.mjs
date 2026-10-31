import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { calculateKamatchScenario } from '../api/_kamatch/calculate.js';
import { createPriceBasis } from '../src/lib/quote/price-basis.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const policy = read('../api/_kamatch/policy.snapshot.json');
const observations = read('../../../docs/references/kamatch/observations.json');
const catalogue = JSON.parse(gunzipSync(readFileSync(new URL('../../../docs/references/kamatch/catalog.snapshot.json.gz', import.meta.url))));
let passed = 0;
const failures = [];
for (const observation of observations.rows) {
  const input = observation.input;
  const vehicle = catalogue.rows.find(v => v.brand === input.maker && v.model === input.model && v.lineup === input.lineup && v.trim === input.trim);
  assert.ok(vehicle, observation.id);
  const priceBasis = createPriceBasis({ productId: `TEST-${observation.id}`, sourceRevision: 'freepass-data/parity-test@r1', basePrice: input.vehiclePrice,
    optionPrice: input.factoryOptions.reduce((sum, o) => sum + o.price, 0), exteriorColorPrice: 0, interiorColorPrice: 0,
    discount: input.discount, totalVehiclePrice: input.vehiclePrice + input.factoryOptions.reduce((sum, o) => sum + o.price, 0) - input.discount });
  const extraOptions = [];
  if (input.dashcam === null) extraOptions.push({ removed: true, baseline: 154000 });
  for (const tint of input.sunroofTints) extraOptions.push({ amount: tint.startsWith('파노라마') ? 121000 : 55000, baseline: 0 });
  for (const expected of observation.results) {
    const result = calculateKamatchScenario({ priceBasis, vehiclePolicy: vehicle, policy,
      conditions: { termMonths: expected.termMonths, creditType: 'low', deliveryType: 'dealer', depositPercent: input.depositPercent,
        prepayPercent: input.prepayPercent, annualKm: input.annualKm, insuranceAge: input.insuranceAge || '만 26세 이상', salesFeeRate: 3.3, extraOptions } });
    for (const key of ['monthlyRent', 'deposit', 'prepay', 'residualPercent', 'residualAmount', 'acquisitionCost']) {
      if (result[key] !== expected[key]) failures.push({ id: observation.id, term: expected.termMonths, field: key, expected: expected[key], actual: result[key] });
    }
    passed++;
  }
}
if (failures.length) console.log(JSON.stringify(failures, null, 2));
assert.equal(failures.length, 0, 'independent equation must match each displayed amount with zero-won tolerance');
console.log(`PASS: independently calculated ${passed} real UI observations; zero-won error across six output fields.`);
