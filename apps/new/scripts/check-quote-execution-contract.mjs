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
need(success.실행?.checks?.some((x) => x.name === 'quote-result-contract' && x.status === 'PASS'), 'result check proof missing');

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

console.log('quote execution contract: PASS');
