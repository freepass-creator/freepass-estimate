import { QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT } from '../contracts.js';


// FreePass standard new-car quote engine client.
// Proprietary cost logic stays server-side in /api/standard-quote.

export const 이름 = 'FreePass 표준';
export const 다루는차 = ['신차'];

export async function 계산(요청, { 신호 } = {}) {
  const r = await fetch('/api/standard-quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(요청),
    signal: 신호,
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok || !Array.isArray(j.결과) || j.contract !== QUOTE_RESULT_CONTRACT || j.providerContract !== QUOTE_PROVIDER_CONTRACT) {
    const error = new Error(j?.error || `표준 견적 서버 응답 ${r.status}`);
    error.code = j?.code || (r.status >= 500 ? 'PROVIDER_ERROR' : 'STANDARD_QUOTE_INVALID');
    throw error;
  }
  return {
    차량가: j.차량가 ?? null,
    결과: j.결과,
    메타: j.메타 || null,
    결과계약: j.contract,
    공급자계약: j.providerContract,
    pricingEngine: j.pricingEngine || null,
  };
}
