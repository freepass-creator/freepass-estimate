import { QUOTE_REQUEST_CONTRACT, QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT, QUOTE_EXECUTION_CONTRACT } from '../src/lib/quote/contracts.js';
import { 견적계산 } from '../src/lib/quote/calculate.js';
import { QUOTE_EXECUTION_SCHEMA } from '../src/lib/quote/execution-result.js';

function need(condition, message) {
  if (!condition) throw new Error(message);
}

globalThis.window = {
  __welrix_companyConfig: {
    company_id: 'freepass',
    quote_provider: { mode: 'standard', adapter_id: 'freepass-standard' },
  },
};

const request = {
  계약: QUOTE_REQUEST_CONTRACT,
  버전: 1,
  차: { 종류: '신차', 키: 'TEST-CAR', 차량가: 30000000, 옵션가: 0, 색추가금: 0, 할인: 0 },
  조건: {},
  안들: [{ 기간: 60, 보증금: 0, 선납: 0 }],
};

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    ok: true,
    contract: QUOTE_RESULT_CONTRACT,
    providerContract: QUOTE_PROVIDER_CONTRACT,
    priceBasis: {
      contract: 'freepass-price-basis/v1',
      authority: 'FREEPASS_DATA_CANONICAL_ACTIVE',
      masterContract: 'estimate-newcar-master/v1',
      currency: 'KRW',
      productId: 'TEST-CAR',
      sourceRevision: 'freepass-data/test@r1',
      basePrice: 30000000,
      optionPrice: 0,
      exteriorColorPrice: 0,
      interiorColorPrice: 0,
      discount: 0,
      totalVehiclePrice: 30000000,
      priceBefore: 30000000,
      priceAfter: 30000000,
      priceBasisName: '기준가',
    },
    pricingEngine: {
    "id": "freepass-standard-newcar",
    "version": "freepass-standard/newcar@1.0.0+src.c5b7f1bfb22c.policy.db0186b10720",
    "evidence": "LOCAL_SOURCE_POLICY_MANIFEST",
    "verified": true,
    "sourceDigest": "c5b7f1bfb22cb812ff2a6cf623ba4285a93c85af10b65ede8477e923948846fa",
    "policyDigest": "db0186b10720b013fb9fa3095660e1d88b6176599442218a4f6306b05b56227c"
},
    차량가: 30000000,
    결과: [{ 월대여료: 500000, 보증금: 0, 선납금: 0, 인수가: 0, 총차량가: 30000000, 수수료: 0 }],
  }),
});

const success = await 견적계산(request);
need(success.실행?.schema === QUOTE_EXECUTION_SCHEMA, 'execution schema missing');
need(success.실행?.schema === QUOTE_EXECUTION_CONTRACT, 'execution contract id mismatch');
need(success.계약?.request === QUOTE_REQUEST_CONTRACT, 'request contract provenance missing');
need(success.계약?.result === QUOTE_RESULT_CONTRACT, 'result contract provenance missing');
need(success.계약?.provider === QUOTE_PROVIDER_CONTRACT, 'provider contract provenance missing');
need(success.실행?.status === 'SUCCEEDED', 'success status missing');
need(success.실행?.request_id?.startsWith('quote-'), 'success request id missing');
need(success.실행?.provider === 'standard', 'provider proof missing');
need(success.pricingEngine?.verified === true, 'verified pricing engine evidence missing');
need(success.priceBasis?.authority === 'FREEPASS_DATA_CANONICAL_ACTIVE', 'canonical price basis missing');
need(success.실행?.evidence?.some((x) => x.includes('PRICING_ENGINE:freepass-standard-newcar:')), 'pricing engine execution evidence missing');
need(success.실행?.evidence?.includes('PRICE_BASIS:freepass-data/test@r1:TEST-CAR'), 'price basis execution evidence missing');
need(success.실행?.checks?.some((x) => x.name === 'price-basis' && x.status === 'PASS'), 'price basis execution check missing');
need(success.실행?.checks?.some((x) => x.name === 'quote-result-contract' && x.status === 'PASS'), 'result check proof missing');

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    ok: true,
    contract: QUOTE_RESULT_CONTRACT,
    providerContract: QUOTE_PROVIDER_CONTRACT,
    priceBasis: {
      contract: 'freepass-price-basis/v1',
      authority: 'FREEPASS_DATA_CANONICAL_ACTIVE',
      masterContract: 'estimate-newcar-master/v1',
      currency: 'KRW',
      productId: 'TEST-CAR',
      sourceRevision: 'freepass-data/test@r1',
      basePrice: 30000000,
      optionPrice: 0,
      exteriorColorPrice: 0,
      interiorColorPrice: 0,
      discount: 0,
      totalVehiclePrice: 30000000,
      priceBefore: 30000000,
      priceAfter: 30000000,
      priceBasisName: '기준가',
    },
    차량가: 30000000,
    결과: [{ 월대여료: 500000, 보증금: 0, 선납금: 0, 인수가: 0, 총차량가: 30000000, 수수료: 0 }],
  }),
});

let missingEngine = null;
try {
  await 견적계산(request);
} catch (error) {
  missingEngine = error;
}
need(missingEngine?.code === 'PRICING_ENGINE_EVIDENCE_REQUIRED', 'missing pricing engine evidence must fail closed');

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    ok: true,
    contract: QUOTE_RESULT_CONTRACT,
    providerContract: QUOTE_PROVIDER_CONTRACT,
    priceBasis: {
      contract: 'freepass-price-basis/v1',
      authority: 'FREEPASS_DATA_CANONICAL_ACTIVE',
      masterContract: 'estimate-newcar-master/v1',
      currency: 'KRW',
      productId: 'TEST-CAR',
      sourceRevision: 'freepass-data/test@r1',
      basePrice: 30000000,
      optionPrice: 0,
      exteriorColorPrice: 0,
      interiorColorPrice: 0,
      discount: 0,
      totalVehiclePrice: 30000000,
      priceBefore: 30000000,
      priceAfter: 30000000,
      priceBasisName: '기준가',
    },
    pricingEngine: {
      id: 'welrix-excel',
      version: 'welrix-excel/v6.1',
      evidence: 'ADAPTER_PIN_ONLY',
      verified: false,
    },
    차량가: 30000000,
    결과: [{ 월대여료: 500000, 보증금: 0, 선납금: 0, 인수가: 0, 총차량가: 30000000, 수수료: 0 }],
  }),
});

let unverified = null;
try {
  await 견적계산(request);
} catch (error) {
  unverified = error;
}
need(unverified?.code === 'PRICING_ENGINE_VERSION_UNVERIFIED', 'unverified pricing engine must fail closed');
need(unverified?.quoteExecution?.status === 'HOLD', 'unverified pricing engine must produce HOLD execution');

const diagnostic = await 견적계산(request, { allowUnverifiedPricingEngine: true });
need(diagnostic.pricingEngine?.verified === false, 'diagnostic mode must preserve unverified evidence');
need(diagnostic.실행?.status === 'HOLD', 'diagnostic unverified execution must never be SUCCEEDED');
need(diagnostic.실행?.blockers?.includes('PRICING_ENGINE_VERSION_UNVERIFIED'), 'diagnostic HOLD blocker missing');

globalThis.fetch = async () => ({
  ok: false,
  status: 503,
  json: async () => ({ ok: false, error: 'provider unavailable', code: 'PROVIDER_UNAVAILABLE' }),
});

let failed = null;
try {
  await 견적계산(request);
} catch (error) {
  failed = error;
}
need(failed, 'provider failure must throw');
need(failed.code === 'PROVIDER_UNAVAILABLE', 'provider error code not preserved');
need(failed.quoteExecution?.status === 'FAILED', 'failure execution proof missing');
need(failed.quoteExecution?.request_id?.startsWith('quote-'), 'failure request id missing');
need(failed.quoteExecution?.blockers?.includes('PROVIDER_UNAVAILABLE'), 'failure blocker missing');

// Credit routing must select the same provider for execution and provenance.
const fs = await import('node:fs');
globalThis.window.__welrix_companyConfig = JSON.parse(fs.readFileSync(
  new URL('../public/data/company-config/freepass.json', import.meta.url), 'utf8',
));
const routedCalls = [];
globalThis.fetch = async (url, options) => {
  routedCalls.push({ url, body: JSON.parse(options.body) });
  return { ok: true, status: 200, json: async () => ({
    ok: true,
    contract: QUOTE_RESULT_CONTRACT,
    providerContract: QUOTE_PROVIDER_CONTRACT,
    priceBasis: success.priceBasis,
    pricingEngine: { id: 'welrix-excel', version: 'welrix-excel/v6.1', evidence: 'UPSTREAM_CONTRACT', verified: true },
    vehiclePrice: 30000000,
    results: [{ monthlyRent: 777000, deposit: 0, prepay: 0, acquirePrice: 0, totalCarPrice: 30000000, payFee: 0 }],
  }) };
};
const mediumRequest = { ...request, 조건: { 신용: '중신용' } };
const mediumResult = await 견적계산(mediumRequest);
need(routedCalls.length === 1 && routedCalls[0].url === '/api/external-quote', 'medium credit must execute the external adapter');
need(routedCalls[0].body.adapterId === 'welrix', 'medium credit must select Welrix');
need(mediumResult.공급자 === 'external:excel:welrix', 'credit route provenance must match execution');
need(mediumResult.결과[0].월대여료 === 777000, 'Welrix result must reach the quote');
routedCalls.length = 0;
globalThis.fetch = async (url) => {
  routedCalls.push({ url });
  return { ok: false, status: 503, json: async () => ({ ok: false, code: 'PROVIDER_UNAVAILABLE' }) };
};
let mediumFailure;
try { await 견적계산(mediumRequest); } catch (error) { mediumFailure = error; }
need(mediumFailure?.code === 'PROVIDER_UNAVAILABLE', 'Welrix failure must remain visible');
need(routedCalls.length === 1 && routedCalls[0].url === '/api/external-quote', 'Welrix failure must not fall back to standard');

const { calculateStandardPreviewBatch } = await import('../src/lib/quote/preview-calculate.js');
routedCalls.length = 0;
const previewFailures = await calculateStandardPreviewBatch([mediumRequest]);
need(previewFailures[0]?.code === 'PROVIDER_UNAVAILABLE', 'preview must surface the Welrix error');
need(routedCalls.length === 1 && routedCalls[0].url === '/api/external-quote', 'medium-credit preview must not use the standard batch API');

console.log('quote execution contract: PASS');
