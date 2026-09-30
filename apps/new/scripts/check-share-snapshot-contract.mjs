import assert from 'node:assert/strict';
import { 지금주소, 풀기, 공유주소, 공유풀기 } from '../src/lib/share-link.js';
import {
  SHARE_SNAPSHOT_CONTRACT,
  QUOTE_REQUEST_CONTRACT,
  QUOTE_RESULT_CONTRACT,
  QUOTE_EXECUTION_CONTRACT,
} from '../src/lib/quote/contracts.js';

globalThis.window = { VEHICLE_DB: null };
globalThis.location = { href: 'https://example.com/mobile.html?force=mobile', search: '' };

const vehicleState = {
  manufacturer: 'hyundai',
  model: 'model-1',
  variant: 'variant-1',
  trim: 'trim-1',
  options: new Set(),
  color: null,
};
const quoteState = {
  cond: { km: 2, svc: '웰스 Basic', insProperty: '1억', extraDriver: '없음', deliveryCity: '서울' },
  scenarios: [{ term: 60, dep: 0, pre: 0 }],
  tint: { product: '없음' },
  extras: { blackbox: '미설치' },
  vehicle: {
    brand: '현대', model: '테스트', variant: '가솔린', trim_name: '프리미엄',
    options: [], colorExt: null, colorInt: null,
  },
  sharedSnapshot: null,
};
const quoteRuntime = {
  상태: 'ok',
  결과: [{ 월대여료: 500000, 인수가: 10000000, 총차량가: 30000000, 보증금: 0, 선납금: 0 }],
  차량가: 30000000,
  계산기: 'FreePass 표준',
  공급자: 'standard',
  계약: {
    request: QUOTE_REQUEST_CONTRACT,
    result: QUOTE_RESULT_CONTRACT,
    execution: QUOTE_EXECUTION_CONTRACT,
  },
  실행: { subject_revision: 'a'.repeat(40) },
};

const url = 지금주소(vehicleState, quoteState, quoteRuntime);
const qs = new URL(url).searchParams.get('qs');
assert.ok(qs, 'v2 snapshot query missing');
const raw = JSON.parse(Buffer.from(qs.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

assert.equal(raw.v, 2);
assert.equal(raw.contract, SHARE_SNAPSHOT_CONTRACT);
assert.equal(raw.quoteContract, QUOTE_REQUEST_CONTRACT);
assert.equal(raw.resultContract, QUOTE_RESULT_CONTRACT);
assert.equal(raw.executionContract, QUOTE_EXECUTION_CONTRACT);
assert.equal(raw.sourceRevision, 'a'.repeat(40));
assert.equal(raw.providerMode, 'standard');
assert.ok(!JSON.stringify(raw).includes('freepass-standard'), 'private adapter id leaked into share snapshot');

function encode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

const legacy = {
  v: 1,
  at: '2026-09-19T00:00:00.000Z',
  engine: '웰릭스',
  vehiclePrice: 30000000,
  vehicle: { brand: '현대', model: '테스트', variant: '', trim_name: '프리미엄', options: [] },
  terms: [{ term: 60, monthly: 500000, acquire: 0, totalCarPrice: 30000000, deposit: 0, prepay: 0, depPct: 0, prePct: 0 }],
  conditions: { km: 2, svc: '웰스 Basic', insProperty: '1억', extraDriver: '없음', deliveryCity: '서울', tint: '없음', blackbox: '미설치' },
};
const legacyVehicle = { options: new Set() };
const legacyQuote = {
  cond: {}, scenarios: [], tint: {}, extras: {}, vehicle: {}, sharedSnapshot: null,
};
assert.equal(
  풀기(legacyVehicle, legacyQuote, '?b=hyundai&m=model-1&t=trim-1&qs=' + encode(legacy)),
  true
);
assert.equal(legacyQuote.sharedSnapshot?.v, 1, 'legacy v1 snapshot no longer readable');
assert.equal(legacyQuote.sharedSnapshot?.contract, null, 'legacy snapshot must remain identifiable as legacy');

const unknown = { ...legacy, v: 2, contract: 'freepass-quote-snapshot/v999' };
const unknownQuote = { cond: {}, scenarios: [], tint: {}, extras: {}, vehicle: {}, sharedSnapshot: null };
풀기({ options: new Set() }, unknownQuote, '?b=hyundai&m=model-1&t=trim-1&qs=' + encode(unknown));
assert.equal(unknownQuote.sharedSnapshot, null, 'unknown future snapshot contract must fail closed');

console.log('share snapshot contract: PASS — v2 provenance + v1 compatibility + unknown-version fail-closed');

let stored;
quoteState.cust = { name: 'PRIVATE_CUSTOMER', tel: 'PRIVATE_PHONE' };
quoteState.cond.credit = 'PRIVATE_CREDIT';
quoteState.cond.fee = 'PRIVATE_FEE';
const shortUrl = await 공유주소(vehicleState, quoteState, quoteRuntime, async bundle => {
  stored = structuredClone(bundle);
  return 'https://welrixtable.vercel.app/s/abcd1234';
});
assert.equal(shortUrl.length, 41);
assert.equal(new URL(shortUrl).search, '');
assert.ok(!JSON.stringify(stored).includes('PRIVATE_'));
location.pathname = '/s/abcd1234';
const restoredVehicle = { options: new Set() };
const restoredQuote = { cond: {}, scenarios: [], tint: {}, extras: {} };
assert.equal(await 공유풀기(restoredVehicle, restoredQuote, async id => {
  assert.equal(id, 'abcd1234');
  return stored;
}), true);
assert.equal(restoredVehicle.trim, vehicleState.trim);
assert.deepEqual(restoredQuote.sharedSnapshot, stored[1]);
assert.equal(restoredQuote.sharedSnapshot.terms[0].monthly, 500000);
const reshared = await 공유주소(restoredVehicle, restoredQuote, null, async bundle => bundle);
assert.deepEqual(reshared[1], stored[1], 're-sharing must retain original snapshot');
await assert.rejects(공유주소(vehicleState, quoteState, quoteRuntime, async () => { throw new Error('offline'); }), /offline/);
await assert.rejects(공유풀기({}, {}, async () => null), /저장된/);
await assert.rejects(공유풀기({}, {}, async () => ['b=x', { ...legacy, v: 999 }]), /저장된/);
location.pathname = '/s/invalid';
await assert.rejects(공유풀기({}, {}), /올바르지/);
location.pathname = '/mobile.html';
console.log('short self quote: PASS — immutable snapshot round-trip, privacy, re-share, failure states');

if (process.env.FREEPASS_LEGACY_RUNTIME_ROOT) {
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  const runtime = await import(pathToFileURL(resolve(process.env.FREEPASS_LEGACY_RUNTIME_ROOT, 'src/lib/share-link.js')).href);
  location.pathname = '/s/abcd1234';
  const targetVehicle = { options: new Set() };
  const targetQuote = { cond: {}, scenarios: [], tint: {}, extras: {} };
  window.__FREEPASS_SALES_MAIN_AXIS_BRIDGE = {
    redirect_provider_trim_ids: { 'trim-1': { base_provider_trim_id: 'changed-trim', axis_option_ids: ['changed-option'] } },
  };
  await runtime.공유풀기(targetVehicle, targetQuote, async () => stored);
  assert.deepEqual(targetQuote.sharedSnapshot, stored[1], 'canonical v2 must open unchanged in operational runtime');
  assert.equal(targetVehicle.trim, 'trim-1', 'frozen share must not redirect its original trim');
  assert.deepEqual([...targetVehicle.options], [], 'frozen share must not add bridge options');
  const backToCanonical = await runtime.공유주소(targetVehicle, targetQuote, null, async bundle => bundle);
  const roundtripQuote = { cond: {}, scenarios: [], tint: {}, extras: {} };
  await 공유풀기({ options: new Set() }, roundtripQuote, async () => backToCanonical);
  assert.deepEqual(roundtripQuote.sharedSnapshot, stored[1]);
  const selectedQuote = { ...quoteState, sharedSnapshot: null, scenarios: [{ term: 36 }, { term: 60 }], send: [false, true] };
  const selected = await runtime.공유주소(vehicleState, selectedQuote, { ...quoteRuntime, 결과: [quoteRuntime.결과[0], quoteRuntime.결과[0]] }, async bundle => bundle);
  assert.deepEqual(selected[1].terms.map(t => t.term), [60]);
  console.log('operational share interoperability: PASS — v2, original trim/options, re-share and selected periods');
}

// Run the real inline entry guard: bare /s paths must not redirect to themselves.
{
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const html = readFileSync(new URL('../mobile.html', import.meta.url), 'utf8');
  const entry = [...html.matchAll(/<script>[\s\S]*?<\/script>/g)].map(m => m[0]).find(t => t.includes('PC viewport'));
  assert.ok(entry, 'desktop entry guard present');
  const script = entry.replace(/^<script>|<\/script>$/g, '');
  for (const pathname of ['/s/abcd1234', '/mobile.html']) {
    const redirects = [];
    runInNewContext(script, { URLSearchParams, location: { pathname, search: '', hash: '', replace: url => redirects.push(url) }, window: { innerWidth: 1280 }, document: { documentElement: { classList: { add() {} } } } });
    assert.deepEqual(redirects, pathname.startsWith('/s/') ? [] : ['/index.html']);
  }
}
