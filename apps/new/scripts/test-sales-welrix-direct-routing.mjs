import fs from 'node:fs';
import assert from 'node:assert/strict';
import handler from '../api/external-quote.js';
import { QUOTE_REQUEST_CONTRACT, QUOTE_RESULT_CONTRACT } from '../src/lib/quote/contracts.js';

const catalog = JSON.parse(fs.readFileSync('public/data/freepass-newcar/sales-welrix-trim-ids.json', 'utf8'));
assert.equal(catalog.trim_count, 443);
assert.equal(catalog.trim_ids.length, 443);
assert.equal(new Set(catalog.trim_ids).size, 443);

const model = catalog.trim_ids[0];
let outbound = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, opts) => {
  outbound = JSON.parse(opts.body);
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        price: 15460000,
        results: [{
          monthlyRent: 408000,
          deposit: 0,
          prepay: 0,
          acquirePrice: 0,
          totalCarPrice: 15460000,
          payFee: 0,
        }],
      };
    },
  };
};

const req = {
  method: 'POST',
  body: {
    kind: 'excel',
    adapterId: 'welrix',
    request: {
      계약: QUOTE_REQUEST_CONTRACT,
      버전: 1,
      차: {
        종류: '신차',
        키: model,
        상품키: model,
        가격: { 옵션: 1200000, 외장색: 100000, 할인: 500000 },
        구성: { 기본축: {}, 선택옵션: [] },
      },
      조건: {
        신용: '중신용',
        주행: '2만km',
        정비: '웰스 Basic',
        대물: '1억',
        추가운전자: '배우자',
        탁송비: 120000,
        썬팅비: 300000,
        블박비: 100000,
        수수료율: 7,
      },
      안들: [{ 기간: 60, 보증금: 10, 선납: 5 }],
    },
  },
};
const state = { statusCode: 200, body: null, headers: {} };
const res = {
  setHeader(k, v) { state.headers[k] = v; },
  status(n) { state.statusCode = n; return this; },
  json(v) { state.body = v; return this; },
  end() { return this; },
};

try {
  await handler(req, res);
  assert.equal(state.statusCode, 200);
  assert.equal(state.body?.ok, true);
  assert.equal(state.body?.contract, QUOTE_RESULT_CONTRACT);
  assert.equal(outbound?.model, model, 'Sales provider-native trim id must reach Welrix unchanged');
  assert.equal(outbound?.old, false);
  assert.equal(outbound?.manualPrice, 0);
  assert.equal(outbound?.inputs?.length, 1);
  const input = outbound.inputs[0];
  assert.deepEqual(input, {
    credit: '중신용',
    termMonths: 60,
    mileage: '2만km',
    optionPrice: 1300000,
    stockDiscount: 500000,
    deliveryFee: 120000,
    tintFee: 300000,
    dashcamFee: 100000,
    deposit_pct: 0.1,
    prepay_pct: 0.05,
    liability: '1억',
    extraDriver: '배우자',
    maintenance: '웰스 Basic',
    feeRate: 0.07,
  });
  console.log(JSON.stringify({
    status: 'PASS',
    catalog: 'welrix-sales-443',
    model,
    directProviderRouting: true,
    remapping: false,
    requestBodyParity: true,
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
