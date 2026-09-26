import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/external-quote.js';
import { QUOTE_REQUEST_CONTRACT } from '../src/lib/quote/contracts.js';
import { EXTERNAL_PROVIDER_POLICY } from '../src/lib/quote/provider-policy.js';
import { createQuoteConditionCosts } from '../src/lib/quote/condition-cost-contract.js';

assert.equal(EXTERNAL_PROVIDER_POLICY.timeout_ms, 12000);
assert.equal(EXTERNAL_PROVIDER_POLICY.max_attempts, 1);
assert.equal(EXTERNAL_PROVIDER_POLICY.fallback, 'none');
assert.equal(EXTERNAL_PROVIDER_POLICY.retry_mode, 'manual');

const idx = JSON.parse(fs.readFileSync(new URL('../public/data/freepass-newcar/product-index.json', import.meta.url), 'utf8'));
const supported = Object.entries(idx.products || {}).find(([, p]) => (p.providerCandidates || []).length > 0);
assert.ok(supported, 'provider-supported product required');
const [productId, meta] = supported;

const masterPayload = {
  data: [{
    productId,
    status: 'ACTIVE',
    basePrice: { amount: 30000000, currency: 'KRW' },
    priceBefore: { amount: 30000000, currency: 'KRW' },
    priceAfter: { amount: 30000000, currency: 'KRW' },
    priceBasis: '기준가',
    options: [],
    exteriorColors: [{ colorId: 'ext_test', name: '화이트', price: { amount: 0, currency: 'KRW' } }],
    interiorColors: [{ colorId: 'int_test', name: '블랙', price: { amount: 0, currency: 'KRW' } }],
  }],
  meta: {
    contract: 'estimate-newcar-master/v1',
    authority: 'CANONICAL_ACTIVE',
    projectionId: 'estimate-newcar-master',
    schemaVersion: '1.0.0',
    releaseId: 'rel_runtime_policy',
    manifestId: 'manifest_runtime_policy',
    revision: 1,
    inputDigest: 'a'.repeat(64),
    dataDigest: 'b'.repeat(64),
    generatedAt: '2026-09-25T00:00:00.000Z',
    activatedAt: '2026-09-25T00:01:00.000Z',
  },
};

function makeReq(adapterId = 'welrix') {
  const costs=createQuoteConditionCosts();
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
          가격: { 트림: 1, 옵션: 1, 외장색: 1, 내장색: 1, 할인: 0, 표준계산차량가: 4 },
          구성: {
            기본축: meta.baseAxes || {},
            colorExtId: 'ext_test',
            colorIntId: 'int_test',
            선택옵션: [],
          },
        },
        조건: {
          신용: '중신용', 주행: '2만km', 정비: '웰스 Basic',
          대물: '1억', 추가운전자: '없음',
          탁송비: costs.deliveryFee, 썬팅비: costs.tintFee, 블박비: costs.dashcamFee, 내비비:0, 하이패스비:0, 비용:costs, 수수료율: 5,
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

const originalBase = process.env.FREEPASS_DATA_CONSUMER_BASE_URL;
const originalToken = process.env.FREEPASS_DATA_ESTIMATE_TOKEN;
process.env.FREEPASS_DATA_CONSUMER_BASE_URL = 'https://freepass-data.test';
process.env.FREEPASS_DATA_ESTIMATE_TOKEN = 't'.repeat(32);

async function runWithFetch(providerFetch, req = makeReq()) {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('https://freepass-data.test/')) {
      return { ok: true, status: 200, async json() { return masterPayload; } };
    }
    return providerFetch(url, opts);
  };
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

try {
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

  const rejectedPrice = await runWithFetch(async (_url, opts) => {
    const outbound = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          price: outbound.manualPrice + 1,
          results: [{
            monthlyRent: 777000, deposit: 0, prepay: 0,
            acquirePrice: 0, totalCarPrice: 30000000, payFee: 0,
          }],
        };
      },
    };
  });
  assert.equal(rejectedPrice.statusCode, 502);
  assert.equal(rejectedPrice.body?.code, 'PROVIDER_PRICE_OVERRIDE_REJECTED');
  assert.equal(rejectedPrice.body?.retryable, false);

  const mismatchedTotal = await runWithFetch(async (_url, opts) => {
    const outbound = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          price: outbound.manualPrice,
          results: outbound.inputs.map(() => ({
            monthlyRent: 777000,
            deposit: 0,
            prepay: 0,
            acquirePrice: 0,
            totalCarPrice: 99999999,
            payFee: 0,
          })),
        };
      },
    };
  });
  assert.equal(mismatchedTotal.statusCode, 502);
  assert.equal(mismatchedTotal.body?.code, 'PROVIDER_PRICE_OVERRIDE_REJECTED');
  assert.equal(mismatchedTotal.body?.retryable, false);

  const success = await runWithFetch(async (_url, opts) => {
    const outbound = JSON.parse(opts.body);
    assert.equal(outbound.manualPrice, 30000000);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          price: outbound.manualPrice,
          results: outbound.inputs.map(() => ({
            monthlyRent: 777000,
            deposit: 0,
            prepay: 0,
            acquirePrice: 0,
            totalCarPrice: 30000000,
            consumerPrice: 30000000,
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
  assert.equal(success.body?.vehiclePrice, 30000000);
  assert.equal(success.body?.results?.[0]?.totalCarPrice, 30000000);

  const unregistered = await runWithFetch(async () => {
    throw new Error('must not call fetch');
  }, makeReq('not-registered'));
  assert.equal(unregistered.statusCode, 501);
  assert.equal(unregistered.body?.code, 'PROVIDER_ADAPTER_UNREGISTERED');
  assert.equal(unregistered.body?.retryable, false);

  console.log('provider runtime policy: PASS — canonical price override enforced; failure classes separated; no silent fallback');
} finally {
  if (originalBase === undefined) delete process.env.FREEPASS_DATA_CONSUMER_BASE_URL;
  else process.env.FREEPASS_DATA_CONSUMER_BASE_URL = originalBase;
  if (originalToken === undefined) delete process.env.FREEPASS_DATA_ESTIMATE_TOKEN;
  else process.env.FREEPASS_DATA_ESTIMATE_TOKEN = originalToken;
}
