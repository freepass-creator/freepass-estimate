import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const read = (path) => fs.readFileSync(path, 'utf8');

function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body]))
    .digest('hex');
}

const freepass = readJson('public/data/company-config/freepass.json');
const welrix = readJson('public/data/company-config/welrix.json');
const catalogMeta = readJson('public/data/freepass-newcar/sales-welrix-trim-ids.json');
const salesDbSource = read('public/sales-welrix-db.js');
const mobile = read('src/mobile.js');
const stepVehicle = read('src/components/mobile/StepVehicle.vue');
const availability = read('src/lib/quote/provider-availability.js');
const externalEngine = read('src/lib/quote/engines/external.js');
const externalApi = read('api/external-quote.js');
const tokens = read('src/styles/tokens.css');

const expectedProvider = { mode: 'external', kind: 'excel', adapter_id: 'welrix' };
assert.deepEqual(freepass.quote_provider, expectedProvider, 'FreePass Sales self quote must use Welrix external provider');
assert.deepEqual(welrix.quote_provider, expectedProvider, 'Welrix reference config must remain on Welrix external provider');

assert.ok(mobile.includes("params.get('c') || 'freepass'"), 'mobile default company profile must be freepass');
assert.ok(mobile.includes("return companyProfileId() === 'freepass' ? '/sales-welrix-db.js' : '/vehicle-db.js'"), 'FreePass Sales profile must load pinned Welrix catalog');
assert.ok(tokens.includes('--brand:      #1b2a4a;'), 'FreePass visual token baseline must remain active');
assert.ok(externalEngine.includes("export const 다루는차 = ['신차'];"), 'Sales self quote provider scope must remain new-car only');

assert.equal(catalogMeta.schema, 'freepass-sales-welrix-catalog/v1');
assert.equal(catalogMeta.source_repository, 'freepass-creator/welrixtable');
assert.equal(catalogMeta.source_blob_sha, '2b2731fefe34facd9c16ff8295d4cefd1ac30437');
assert.equal(gitBlobSha(salesDbSource), catalogMeta.source_blob_sha, 'Pinned Sales Welrix DB must stay byte-identical to verified upstream blob');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(salesDbSource, ctx);
const db = ctx.window.VEHICLE_DB;
assert.ok(db?.manufacturers?.length, 'Sales Welrix VEHICLE_DB must load');

const trimIds = [];
for (const mf of db.manufacturers || []) {
  for (const model of mf.models || []) {
    for (const variant of model.variants || []) {
      for (const trim of variant.trims || []) trimIds.push(trim.trim_id);
    }
  }
}
assert.equal(trimIds.length, 443, 'Sales Welrix catalog must keep 443 trims');
assert.equal(new Set(trimIds).size, 443, 'Sales Welrix trim ids must be unique');
assert.equal(catalogMeta.trim_count, 443);
assert.deepEqual(new Set(catalogMeta.trim_ids), new Set(trimIds), 'Server allowlist must exactly match browser Sales catalog');

for (const marker of ['브랜드공급가능','모델공급가능','변형공급가능','트림공급가능']) {
  assert.ok(stepVehicle.includes(marker), `provider availability filter missing: ${marker}`);
}
assert.ok(availability.includes("provider.adapter_id === 'welrix'"), 'Welrix availability must be provider-specific');
assert.ok(availability.includes("Object.prototype.hasOwnProperty.call(t, '_provider_candidates')"), 'Canonical catalog support must remain fail-closed');
assert.ok(availability.includes("typeof t.trim_id === 'string'"), 'Provider-native Sales trims must be accepted');
assert.ok(externalApi.includes('sales-welrix-trim-ids.json'), 'External API must validate provider-native Sales ids server-side');
assert.ok(externalApi.includes('salesWelrixTrimIds().has(productId)'), 'External API must route only allowlisted direct Welrix ids');

console.log(JSON.stringify({
  status: 'PASS',
  profile: 'freepass-sales-self-quote/new-car-v1',
  uiAuthority: 'freepass-estimate',
  calculationAuthority: 'welrix',
  provider: 'external:excel:welrix',
  scope: ['신차'],
  catalog: {
    source: 'freepass-creator/welrixtable',
    blob: catalogMeta.source_blob_sha,
    trims: trimIds.length,
  },
  silentFallback: false,
}, null, 2));
