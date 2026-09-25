import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(process.cwd(), '..', '..');
const workflowsDir = path.join(root, '.github', 'workflows');

const forbiddenWorkflowNames = new Set([
  'sync-freepass-newcar-source.yml',
  'build-freepass-newcar-db.yml',
  'newcar-master-audit.yml',
  'audit-master-gaps.yml',
  'audit-freepass-newcar-feed.yml',
  'newcar-readiness-audit.yml',
  'build-freepass-newcar-maps.yml',
  'sync-newcar-master-map.yml',
  'import-newcar-baseline.yml',
]);

const workflowNames = fs.readdirSync(workflowsDir).filter((name) => /\.ya?ml$/i.test(name));
for (const name of forbiddenWorkflowNames) {
  assert.ok(!workflowNames.includes(name), `Estimate must not own vehicle-master workflow: ${name}`);
}

for (const name of workflowNames) {
  const text = fs.readFileSync(path.join(workflowsDir, name), 'utf8');
  assert.ok(
    !/repository:\s*freepass-creator\/freepasserp4\b/.test(text),
    `${name}: Estimate workflow must not import vehicle/master or pricing source from ERP4`
  );
  assert.ok(
    !/git\s+add[^\n]*(?:public\/data\/freepass-newcar|public\/vehicle-db\.js|vehicle-trim-master\.json)/i.test(text),
    `${name}: Estimate workflow must not publish a shadow vehicle master`
  );
}

const standardApi = fs.readFileSync(path.join(process.cwd(), 'api', 'standard-quote.js'), 'utf8');
const externalApi = fs.readFileSync(path.join(process.cwd(), 'api', 'external-quote.js'), 'utf8');
const requestBuilder = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'quote', 'build-request.js'), 'utf8');
const authoritative = fs.readFileSync(path.join(process.cwd(), 'api', '_master', 'authoritative-request.js'), 'utf8');

assert.ok(
  standardApi.includes("authoritativeQuoteRequest"),
  'Standard pricing must resolve FreePass Data master before calculation'
);
assert.ok(
  externalApi.includes("authoritativeQuoteRequest"),
  'External pricing must resolve FreePass Data master before provider calculation'
);
assert.ok(
  !/manualPrice\s*:\s*0\b/.test(externalApi),
  'External provider must not calculate from provider-owned default vehicle price'
);
assert.ok(
  externalApi.includes('PROVIDER_PRICE_OVERRIDE_REJECTED'),
  'External provider must fail closed when canonical manual price is ignored'
);
assert.ok(
  requestBuilder.includes('colorExtId') && requestBuilder.includes('colorIntId'),
  'QuoteRequest must carry stable color IDs to the server authority boundary'
);
assert.ok(
  authoritative.includes("CANONICAL_ACTIVE") &&
  authoritative.includes('stableId') &&
  authoritative.includes('basePrice'),
  'Authority boundary must rebuild price from CANONICAL_ACTIVE FreePass Data facts'
);

console.log('PASS authority boundary — FreePass Data owns vehicle facts; Estimate owns pricing only');
