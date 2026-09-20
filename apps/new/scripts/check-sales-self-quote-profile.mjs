import fs from 'node:fs';
import assert from 'node:assert/strict';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const read = (path) => fs.readFileSync(path, 'utf8');

const freepass = readJson('public/data/company-config/freepass.json');
const welrix = readJson('public/data/company-config/welrix.json');
const index = readJson('public/data/freepass-newcar/product-index.json');
const mobile = read('src/mobile.js');
const stepVehicle = read('src/components/mobile/StepVehicle.vue');
const availability = read('src/lib/quote/provider-availability.js');
const externalEngine = read('src/lib/quote/engines/external.js');
const tokens = read('src/styles/tokens.css');

const expectedProvider = { mode: 'external', kind: 'excel', adapter_id: 'welrix' };
assert.deepEqual(freepass.quote_provider, expectedProvider, 'FreePass Sales self quote must use Welrix external provider');
assert.deepEqual(welrix.quote_provider, expectedProvider, 'Welrix reference config must remain on Welrix external provider');

assert.ok(mobile.includes("params.get('c') || 'freepass'"), 'mobile default company profile must be freepass');
assert.ok(tokens.includes('--brand:      #1b2a4a;'), 'FreePass visual token baseline must remain active');
assert.ok(externalEngine.includes("export const 다루는차 = ['신차'];"), 'Sales self quote provider scope must remain new-car only');

for (const marker of [
  '브랜드공급가능',
  '모델공급가능',
  '변형공급가능',
  '트림공급가능',
]) {
  assert.ok(stepVehicle.includes(marker), `provider availability filter missing: ${marker}`);
}
assert.ok(availability.includes("provider.adapter_id === 'welrix'"), 'Welrix availability must be provider-specific');
assert.ok(availability.includes('t._provider_candidates'), 'Welrix unsupported trims must be identified from provider candidates');

const products = Object.values(index.products || {});
const supported = products.filter((p) => Array.isArray(p.providerCandidates) && p.providerCandidates.length > 0).length;
const unsupported = products.length - supported;
assert.ok(products.length > 0, 'new-car product index must not be empty');
assert.ok(supported > 0, 'at least one Welrix-supported product is required');

console.log(JSON.stringify({
  status: 'PASS',
  profile: 'freepass-sales-self-quote/new-car-v1',
  uiAuthority: 'freepass-estimate',
  calculationAuthority: 'welrix',
  provider: 'external:excel:welrix',
  scope: ['신차'],
  productCount: products.length,
  welrixSupported: supported,
  welrixUnsupportedHiddenFromSelection: unsupported,
  silentFallback: false,
}, null, 2));
