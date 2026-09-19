import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/external-quote.js';
import { QUOTE_REQUEST_CONTRACT } from '../src/lib/quote/contracts.js';
import { EXTERNAL_PROVIDER_POLICY } from '../src/lib/quote/provider-policy.js';

assert.equal(EXTERNAL_PROVIDER_POLICY.timeout_ms, 12000);
assert.equal(EXTERNAL_PROVIDER_POLICY.max_attempts, 1);
assert.equal(EXTERNAL_PROVIDER_POLICY.fallback, 'none');
assert.equal(EXTERNAL_PROVIDER_POLICY.retry_mode, 'manual');

const idx = JSON.parse(fs.readFileSync(new URL('../public/data/freepass-newcar/product-index.json', import.meta.url), 'utf8'));
const supported = Object.entries(idx.products || {}).find(([, p]) => (p.providerCandidates || []).length > 0);
assert.ok(supported, 'provider-supported product required');
const [productId, meta] = supported;

function makeReq(adapterId = 'welrix') {
  return {
    method: 'POST',
    body: {
      kind: 'excel',
      adapterId,
      request: {
        계약: QUOTE_REQUEST_CONTRACT,
        버전: 1,
        차: {
          종류: '신차',
          키: productId,
          상품키: productId,
          가격: { 옵션: 0, 외장색: 0, 할인: 0 },
          구성: { 기본축: meta.baseAxes || {}, 선택옵션: [] },
        },
        조건: {
          신용: '중신용', 주행: '2만km', 정비: '웰스 Basic',
          대물: '1억', 추가운전자: '없음',
          탁송비: 0, 썬팅비: 0, 블박비: 0, 수수료율: 5,
        },
        안들: [{ 기간: 60, 보증금: 0, 선납: 0 }],
      },
    },
  };
}

function makeRes() {
  const state = { statusCode: 200, body: null, headers: {} };
  return {
    state,
    setHeader(k, v) { state.headers[k] = v; },
    status(n) { state.statusCode = n; return this; },
    json(v) { state.body = v; return this; },
    end() { return this; },
  };
}

async function runWithFetch(fetchImpl, req = makeReq()) {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  globalThis.fetch = fetchImpl;
  console.error = (...args) => logs.push(args.join(' '));
  try {
    const res = makeRes();
    await handler(req, res);
    return { ...res.state, logs };
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
}

const timeout = await runWithFetch(async () => {
  const e = new Error('SECRET_TIMEOUT_DETAIL');
  e.name = 'TimeoutError';
  throw e;
});
assert.equal(timeout.statusCode, 504);
assert.equal(timeout.body?.code, 'PROVIDER_TIMEOUT');
assert.equal(timeout.body?.retryable, true);
assert.ok(!JSON.stringify(timeout.body).includes('SECRET_TIMEOUT_DETAIL'));
assert.ok(!timeout.logs.join('\n').includes('SECRET_TIMEOUT_DETAIL'));

const unavailable = await runWithFetch(async () => {
  const e = new Error('SECRET_UPSTREAM_HOST');
  e.name = 'FetchError';
  throw e;
});
assert.equal(unavailable.statusCode, 502);
assert.equal(unavailable.body?.code, 'PROVIDER_UNAVAILABLE');
assert.equal(unavailable.body?.retryable, true);
assert.ok(!JSON.stringify(unavailable.body).includes('SECRET_UPSTREAM_HOST'));
assert.ok(!unavailable.logs.join('\n').includes('SECRET_UPSTREAM_HOST'));

const invalid = await runWithFetch(async () => ({
  ok: true,
  status: 200,
  async json() { return { ok: false, error: 'SECRET_FORMULA_DETAIL' }; },
}));
assert.equal(invalid.statusCode, 502);
assert.equal(invalid.body?.code, 'PROVIDER_RESPONSE_INVALID');
assert.equal(invalid.body?.retryable, false);
assert.ok(!JSON.stringify(invalid.body).includes('SECRET_FORMULA_DETAIL'));
assert.ok(!invalid.logs.join('\n').includes('SECRET_FORMULA_DETAIL'));

const success = await runWithFetch(async (_url, opts) => {
  const outbound = JSON.parse(opts.body);
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        price: 30000000,
        results: outbound.inputs.map(() => ({
          monthlyRent: 777000,
          deposit: 0,
          prepay: 0,
          acquirePrice: 0,
          totalCarPrice: 30000000,
          payFee: 0,
        })),
      };
    },
  };
});
assert.equal(success.statusCode, 200);
assert.equal(success.body?.providerPolicy?.timeout_ms, 12000);
assert.equal(success.body?.providerPolicy?.max_attempts, 1);
assert.equal(success.body?.providerPolicy?.fallback, 'none');

const unregistered = await runWithFetch(async () => {
  throw new Error('must not call fetch');
}, makeReq('not-registered'));
assert.equal(unregistered.statusCode, 501);
assert.equal(unregistered.body?.code, 'PROVIDER_ADAPTER_UNREGISTERED');
assert.equal(unregistered.body?.retryable, false);

console.log('provider runtime policy: PASS — timeout/network/invalid separated; no upstream detail leak; no silent fallback');
