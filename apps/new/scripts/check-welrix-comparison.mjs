import assert from 'node:assert/strict';
import { createWelrixComparisonHandler } from '../api/welrix-comparison.js';
import { createQuoteConditionCosts } from '../src/lib/quote/condition-cost-contract.js';

const request = {
  차: { 종류: '신차', 키: 'FNJS4RMT1', 상품키: 'FNJS4RMT1', 가격: { 트림: 23980000, 옵션: 0, 외장색: 0, 내장색: 0, 할인: 0, 표준계산차량가: 23980000 }, 구성: { colorExtId: 'ext', colorIntId: 'int', 선택옵션: [] } },
  조건: { 신용: '중신용', 주행: '3만km', 정비: '웰스 Basic', 대물: '1억', 추가운전자: '없음', 수수료정책: 'company-1-agent-5/v1', 영업수수료P: 4, 수수료율: 5, 비용: createQuoteConditionCosts() },
  안들: [36, 48, 60].map((기간) => ({ 기간, 보증금: 5, 선납: 0 })),
};
function response() {
  return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(body) { this.body = body; return this; } };
}
const fixtureMaster = { meta: { contract: 'estimate-newcar-master/v1', authority: 'CANONICAL_ACTIVE', projectionId: 'estimate-newcar-master', schemaVersion: '1.0.0', releaseId: 'TEST_FIXTURE_NOT_OPERATIONAL', revision: 1 }, data: [{ productId: 'FNJS4RMT1', status: 'ACTIVE', basePrice: { amount: 23980000, currency: 'KRW' }, options: [], exteriorColors: [{ colorId: 'ext', price: { amount: 0, currency: 'KRW' } }], interiorColors: [{ colorId: 'int', price: { amount: 0, currency: 'KRW' } }] }] };
const handler = createWelrixComparisonHandler({ loadMaster: async () => fixtureMaster });
const originalFetch = globalThis.fetch;
const live = process.argv.includes('--live');
let sent;
if (!live) {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://welrixmobility.netlify.app/api/estimate', 'must call Welrix directly without a master fetch');
    sent = JSON.parse(options.body);
    return { ok: true, json: async () => ({ ok: true, model: sent.model, price: 23980000,
      results: sent.inputs.map(() => ({ monthlyRent: 538000, deposit: 1200000, prepay: 0, acquirePrice: 12229800, totalCarPrice: 23980000, payFee: 1143000 })) }) };
  };
}
try {
  const res = response();
  await handler({ method: 'POST', body: { request } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.mode, 'DIRECT_COMPARISON_ONLY');
  assert.equal(res.body.results.length, 3);
  assert.equal(res.body.priceBasis.basePrice, 23980000, 'price components come from the supplied master, never browser prices');
  assert.equal(res.body.results[0].payFee, undefined, 'internal commission must not leak into comparison');
  assert.ok(res.body.results.every((row) => Number.isSafeInteger(row.monthlyRent) && row.monthlyRent > 0));
  if (live) {
    console.log(JSON.stringify({ testMode: 'LIVE_PROVIDER_WITH_TEST_MASTER_NOT_PRODUCTION_MASTER', source: res.body.source, model: res.body.model, price: res.body.price, results: res.body.results }, null, 2));
  } else {
    assert.equal(sent.inputs[0].credit, '중신용');
    assert.equal(sent.old, true, 'upstream manual prices must activate the same price-override flag as its own UI');
    assert.equal(sent.inputs[0].deposit_pct, 0.05);
    assert.equal(sent.inputs[0].feeRate, 0.05);
    assert.ok(sent.inputs.every((input) => input.maintenance === '웰스 Self'), 'all direct partner requests must use its maintenance-excluded code even when callers submit an old included-service value');
    assert.equal(sent.manualPrice, 23980000, 'the provider must use the selected vehicle base');
    assert.equal(res.body.selectedBasePrice, 23980000);
    assert.equal(res.body.basePriceSource, 'FREEPASS_DATA_CANONICAL_ACTIVE');
    const stale = response();
    await handler({ method: 'POST', body: { request: {
      ...request, 차: { ...request.차, 가격: { ...request.차.가격, 트림: 23000000, 표준계산차량가: 23000000 } },
    } } }, stale);
    assert.equal(stale.statusCode, 200);
    assert.equal(stale.body.selectedBasePrice, 23980000, 'browser tampering must be replaced by the master base');
    const ignored = createWelrixComparisonHandler({ loadMaster: async () => ({ ...fixtureMaster, data: [{ ...fixtureMaster.data[0], basePrice: { amount: 23000000, currency: 'KRW' } }] }) });
    const ignoredResponse = response(); await ignored({ method: 'POST', body: { request } }, ignoredResponse);
    assert.equal(ignoredResponse.body.code, 'WELRIX_PRICE_MISMATCH');
    const missing = createWelrixComparisonHandler({ loadMaster: async () => { throw Object.assign(new Error('master unavailable'), { code: 'FREEPASS_DATA_MASTER_UNAVAILABLE', status: 503 }); } });
    const missingResponse = response(); await missing({ method: 'POST', body: { request } }, missingResponse);
    assert.equal(missingResponse.statusCode, 503);
    assert.equal(missingResponse.body.code, 'FREEPASS_DATA_MASTER_UNAVAILABLE');
    assert.deepEqual(res.body.results.map((row) => row.monthlyRent), [538000, 538000, 538000]);
    const bad = response();
    await handler({ method: 'POST', body: { request: { ...request, 조건: { ...request.조건, 신용: '저신용' } } } }, bad);
    assert.equal(bad.statusCode, 400);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, model: 'wrong car', price: 23980000, results: [] }) });
    const mismatch = response();
    await handler({ method: 'POST', body: { request } }, mismatch);
    assert.equal(mismatch.body.code, 'WELRIX_RESPONSE_INVALID');
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); };
    const timeout = response();
    await handler({ method: 'POST', body: { request } }, timeout);
    assert.equal(timeout.statusCode, 504);
    assert.equal(calls, 1, 'must not retry via another calculator');
  }
  console.log(`PASS Welrix direct comparison${live ? ' (live API)' : ''}`);
} finally { globalThis.fetch = originalFetch; }
