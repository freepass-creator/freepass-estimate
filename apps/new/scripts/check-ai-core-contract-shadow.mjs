import { QUOTE_REQUEST_CONTRACT, QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT } from '../src/lib/quote/contracts.js';
import { 견적계산 } from '../src/lib/quote/calculate.js';
import { CORE_ADAPTER_RESULT_CONTRACT, CORE_QUOTE_ADAPTER_ID, toCoreAdapterResult } from '../src/lib/quote/core-contract-shadow.js';

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
  차: { 종류: '신차', 키: 'CORE-SHADOW-CAR', 차량가: 30000000, 옵션가: 0, 색추가금: 0, 할인: 0 },
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
need(success.실행?.request_id?.startsWith('quote-'), 'quote execution request id missing');
const successCore = toCoreAdapterResult(success.실행);
need(successCore.schema_version === CORE_ADAPTER_RESULT_CONTRACT, 'Core adapter-result contract missing');
need(successCore.adapter_id === CORE_QUOTE_ADAPTER_ID, 'Core quote adapter id mismatch');
need(successCore.adapter_version === QUOTE_PROVIDER_CONTRACT, 'Core adapter version must bind provider contract');
need(successCore.correlation_id === success.실행.request_id, 'Core correlation id must preserve quote request id');
need(successCore.status === 'SUCCEEDED', 'Core success status drift');
need(successCore.retryable === false, 'Successful quote must not be retryable');
need(successCore.evidence_refs.includes('QUOTE_PROVIDER:standard'), 'Core evidence projection drift');
need(successCore.evidence_refs.some((x) => x.includes('PRICING_ENGINE:freepass-standard-newcar:')), 'Core pricing engine evidence drift');

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
need(failed?.quoteExecution, 'provider failure execution proof missing');
need(failed.quoteExecution.request_id?.startsWith('quote-'), 'failure request id missing');
const failedCore = toCoreAdapterResult(failed.quoteExecution);
need(failedCore.status === 'FAILED', 'Core failure status drift');
need(failedCore.retryable === true, 'PROVIDER_UNAVAILABLE retryability drift');
need(failedCore.issues.some((issue) => issue.code === 'PROVIDER_UNAVAILABLE'), 'provider error code not preserved in Core issues');
need(failedCore.correlation_id === failed.quoteExecution.request_id, 'failure correlation id drift');

console.log('AI Core adapter-result shadow: PASS — actual quote execution preserves status/provider/correlation/evidence');
