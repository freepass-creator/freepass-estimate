import { commissionFromConditions } from '../src/lib/quote/commission-policy.js';
import { authoritativeQuoteRequest } from './_master/authoritative-request.js';
import { welrixBody } from './external-quote.js';

const UPSTREAM = 'https://welrixmobility.netlify.app/api/estimate';

// A direct, read-only partner comparison. Never returns canonical Quote evidence
// or enters quote issuance/storage; the normal external-quote contract stays intact.
export function createWelrixComparisonHandler({ loadMaster } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST 만 받습니다' });
  try {
    const request = req.body?.request;
    if (request?.차?.종류 !== '신차' || !['중신용','고신용'].includes(request?.조건?.신용) ||
        !Array.isArray(request?.안들) || !request.안들.length || request.안들.length > 5) {
      return res.status(400).json({ ok: false, error: '중신용 신차 비교 요청을 확인해 주세요', code: 'WELRIX_COMPARISON_INPUT_INVALID' });
    }
    const canonical = await authoritativeQuoteRequest(request, loadMaster ? { loadMaster } : undefined);
    const commission = commissionFromConditions(canonical.request.조건);
    const body = welrixBody({ ...canonical.request, 조건: { ...canonical.request.조건, 수수료율: commission.totalPoints } });
    const selectedBasePrice = body.manualPrice;
    // Keep the selected vehicle price fixed across both provider calculations.
    // Never silently replace it with the provider's own vehicle catalogue price.
    const response = await fetch(UPSTREAM, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      return res.status(502).json({ ok: false, error: result?.error || '웰릭스 계산 서버에 연결할 수 없습니다', code: 'WELRIX_UPSTREAM_FAILED' });
    }
    if (result.model !== body.model || !Number.isSafeInteger(result.price) || result.price <= 0 ||
        !Array.isArray(result.results) || result.results.length !== body.inputs.length ||
        result.results.some((row) => !row || ['monthlyRent', 'deposit', 'prepay', 'acquirePrice', 'totalCarPrice'].some((key) => !Number.isSafeInteger(row[key]) || row[key] < 0))) {
      return res.status(502).json({ ok: false, error: '웰릭스 차량·가격·계산 응답을 확인할 수 없습니다', code: 'WELRIX_RESPONSE_INVALID' });
    }
    if (result.price !== selectedBasePrice || result.results.some(row => row.totalCarPrice !== canonical.priceBasis.totalVehiclePrice)) {
      return res.status(502).json({ ok: false, code: 'WELRIX_PRICE_MISMATCH', error: '선택한 차량가격과 견적 응답의 기준가격이 다릅니다. 가격 확인이 필요합니다.' });
    }
    // Preserve the partner's numbers, including its own deposit and fee rounding.
    return res.status(200).json({
      ok: true,
      mode: 'DIRECT_COMPARISON_ONLY',
      source: UPSTREAM,
      calculatedAt: new Date().toISOString(),
      model: result.model,
      price: result.price,
      selectedBasePrice,
      basePriceSource: 'FREEPASS_DATA_CANONICAL_ACTIVE',
      priceBasis: canonical.priceBasis,
      priceComponents: {
        base: canonical.priceBasis.basePrice,
        options: canonical.priceBasis.optionPrice,
        exterior: canonical.priceBasis.exteriorColorPrice,
        interior: canonical.priceBasis.interiorColorPrice,
        discount: canonical.priceBasis.discount,
        items: canonical.request.차.구성.선택옵션.map(o => ({ name: o.name, price: o.price_won })),
      },
      results: result.results.map(({ monthlyRent, deposit, prepay, acquirePrice, totalCarPrice }) => ({
        monthlyRent, deposit, prepay, acquirePrice, totalCarPrice,
      })),
    });
  } catch (error) {
    const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
    return res.status(timeout ? 504 : error.status || 502).json({
      ok: false,
      error: timeout ? '웰릭스 응답 시간이 초과됐습니다. 다시 조회해 주세요.' : error.message || '웰릭스 견적을 조회할 수 없습니다',
      code: timeout ? 'WELRIX_TIMEOUT' : error.code || 'WELRIX_UNAVAILABLE',
    });
  }
}

}
export default createWelrixComparisonHandler();
