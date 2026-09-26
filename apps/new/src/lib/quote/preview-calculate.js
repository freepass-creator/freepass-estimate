import { QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT, STANDARD_QUOTE_BATCH_CONTRACT } from './contracts.js';
import { normalizePricingEngineEvidence } from './pricing-engine.js';
import { normalizePriceBasis } from './price-basis.js';

export async function calculateStandardPreviewBatch(requests, { signal } = {}) {
  if (!Array.isArray(requests) || !requests.length) return [];

  const response = await fetch('/api/standard-quote-batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requests }),
    signal,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.ok || body?.contract !== STANDARD_QUOTE_BATCH_CONTRACT || !Array.isArray(body?.results)) {
    const error = new Error(body?.error || `표준 견적 배치 응답 ${response.status}`);
    error.code = body?.code || 'STANDARD_QUOTE_BATCH_INVALID';
    throw error;
  }
  if (body.results.length !== requests.length) {
    const error = new Error('표준 견적 배치 결과 개수가 요청과 다릅니다');
    error.code = 'STANDARD_QUOTE_BATCH_INVALID';
    throw error;
  }

  return body.results.map((item, index) => {
    if (!item?.ok) {
      return Object.freeze({
        ok: false,
        code: item?.code || 'STANDARD_QUOTE_INVALID',
        error: item?.error || '표준 견적을 계산할 수 없습니다',
      });
    }
    if (item.contract !== QUOTE_RESULT_CONTRACT || item.providerContract !== QUOTE_PROVIDER_CONTRACT || !Array.isArray(item.결과)) {
      return Object.freeze({
        ok: false,
        code: 'STANDARD_QUOTE_BATCH_ITEM_INVALID',
        error: '표준 견적 결과 계약이 올바르지 않습니다',
      });
    }

    const expectedProductId = requests[index]?.차?.상품키 || requests[index]?.차?.키;
    return Object.freeze({
      ok: true,
      차량가: item.차량가 ?? null,
      결과: item.결과,
      메타: item.메타 || null,
      pricingEngine: normalizePricingEngineEvidence(item.pricingEngine),
      priceBasis: normalizePriceBasis(item.priceBasis, { expectedProductId }),
    });
  });
}
