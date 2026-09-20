import assert from 'node:assert/strict';
import handler from '../api/provider-health.js';
import { PROVIDER_HEALTH_CONTRACT } from '../src/lib/quote/contracts.js';

function makeRes() {
  const state = { statusCode: 200, body: null, headers: {}, ended: false };
  return {
    state,
    setHeader(k, v) { state.headers[String(k).toLowerCase()] = String(v); },
    status(n) { state.statusCode = n; return this; },
    json(v) { state.body = v; state.ended = true; return this; },
    end() { state.ended = true; return this; },
  };
}

function run(company, method = 'GET') {
  const res = makeRes();
  handler({ method, query: { company } }, res);
  return res.state;
}

const freepass = run('freepass');
assert.equal(freepass.statusCode, 200);
assert.equal(freepass.body?.contract, PROVIDER_HEALTH_CONTRACT);
assert.equal(freepass.body?.provider_key, 'standard');
assert.equal(freepass.body?.configuration_status, 'CONFIGURED');
assert.equal(freepass.body?.live_status, 'UNOBSERVED');
assert.equal(freepass.body?.live_verified, false);
assert.equal(freepass.body?.reason, 'NO_RUNTIME_PROBE_EXECUTED');

const welrix = run('welrix');
assert.equal(welrix.statusCode, 200);
assert.equal(welrix.body?.provider_key, 'external:excel:welrix');
assert.equal(welrix.body?.configuration_status, 'CONFIGURED');
assert.equal(welrix.body?.live_status, 'UNOBSERVED');
assert.equal(welrix.body?.live_verified, false);
assert.equal(welrix.body?.reason, 'NO_NONINVASIVE_LIVE_PROBE');
assert.equal(welrix.body?.policy?.fallback, 'none');
assert.equal(welrix.body?.policy?.max_attempts, 1);

const head = run('welrix', 'HEAD');
assert.equal(head.statusCode, 200);
assert.equal(head.headers['x-freepass-provider'], 'external:excel:welrix');
assert.equal(head.headers['x-freepass-live-status'], 'UNOBSERVED');

const invalid = run('../secret');
assert.equal(invalid.statusCode, 400);
assert.equal(invalid.body?.code, 'COMPANY_CONFIG_ID_INVALID');

const missing = run('not-a-company');
assert.equal(missing.statusCode, 404);
assert.equal(missing.body?.code, 'COMPANY_CONFIG_NOT_FOUND');

for (const state of [freepass, welrix]) {
  assert.notEqual(state.body?.live_status, 'VERIFIED_UP',
    'configuration must never be presented as verified live health');
}

console.log('provider health contract: PASS — configured != live verified; external health stays UNOBSERVED without safe probe');
