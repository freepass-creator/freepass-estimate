import assert from 'node:assert/strict';
import { 지금주소, 풀기 } from '../src/lib/share-link.js';
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
  cond: { credit: '중신용', feeRatePct: 7, discount: 123, km: 2, svc: '웰스 Basic', insProperty: '1억', extraDriver: '없음', deliveryCity: '서울' },
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
  계산기: '웰릭스',
  공급자: 'external:excel:welrix',
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
assert.equal(raw.providerMode, 'external');
const serialized = JSON.stringify(raw);
assert.ok(!serialized.includes('external:excel:welrix'), 'private adapter id leaked into share snapshot');
assert.ok(!serialized.includes('중신용'), 'customer credit class leaked into share snapshot');
assert.ok(!serialized.includes('feeRatePct'), 'staff fee rate leaked into share snapshot');
assert.ok(!serialized.includes('discount'), 'internal discount leaked into share snapshot');

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
