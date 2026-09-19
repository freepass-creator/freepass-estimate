import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configurationAxes, resolveProviderCandidate, absorbedAxisOptionIds } from '../src/lib/newcar/configuration-resolver.js';
import { QUOTE_REQUEST_CONTRACT, QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT } from '../src/lib/quote/contracts.js';

// Server-side external quote adapter router.
// Never exposes partner Excel files, ERP credentials or upstream auth to the browser.

const WELRIX_URL = 'https://welrixmobility.netlify.app/api/estimate';

let PRODUCT_INDEX = null;
function productIndex() {
  if (PRODUCT_INDEX) return PRODUCT_INDEX;
  const path = join(process.cwd(), 'public', 'data', 'freepass-newcar', 'product-index.json');
  PRODUCT_INDEX = JSON.parse(readFileSync(path, 'utf8'));
  return PRODUCT_INDEX;
}

function welrixProviderResolution(request) {
  const productId = request?.차?.상품키 || request?.차?.키;
  const p = productIndex()?.products?.[productId];
  if (!p) throw new ProviderUnsupportedError('이 신차 상품은 현재 계산 공급자 매핑이 없습니다');

  const selected = Array.isArray(request?.차?.구성?.선택옵션) ? request.차.구성.선택옵션 : [];
  const optionsMaster = Object.fromEntries(selected.map((o) => [
    o.id,
    { name: o.name, price: Number(o.price_won || 0) / 10000 },
  ]));
  const selectedIds = selected.map((o) => o.id);
  const trim = { _base_axes: p.baseAxes || request?.차?.구성?.기본축 || {} };
  const axes = configurationAxes(trim, optionsMaster, selectedIds);
  const candidate = resolveProviderCandidate(p.providerCandidates || [], axes);
  if (!candidate) {
    throw new ProviderUnsupportedError('선택한 차량 구성은 현재 Welrix 계산 공급자에서 지원하지 않습니다');
  }
  const absorbed = new Set(absorbedAxisOptionIds(trim, optionsMaster, selectedIds, candidate));
  const absorbedWon = selected
    .filter((o) => absorbed.has(o.id))
    .reduce((sum, o) => sum + Number(o.price_won || 0), 0);

  return { productId, candidate, absorbedWon, axes };
}

function bad(res, status, error, code = null) {
  res.status(status).json({ ok: false, error, ...(code ? { code } : {}) });
}

class ProviderUnsupportedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderUnsupportedError';
    this.code = 'PROVIDER_UNSUPPORTED';
  }
}

function welrixBody(request) {
  const 차 = request?.차 || {};
  const 가격 = 차.가격 || {};
  const 조건 = request?.조건 || {};
  const 안들 = request?.안들 || [];
  const resolved = welrixProviderResolution(request);

  return {
    model: resolved.candidate.api_model,
    old: false,
    manualPrice: 0,
    inputs: 안들.map((a) => ({
      credit: 조건.신용,
      termMonths: a.기간,
      mileage: 조건.주행,
      // AWD/인승처럼 provider의 완성차 row에 이미 포함된 구성 옵션은 다시 더하지 않는다.
      optionPrice: Math.max(0,
        (가격.옵션 || 차.옵션가 || 0) - resolved.absorbedWon
        + (가격.외장색 || 차.색추가금 || 0)
      ),
      stockDiscount: 가격.할인 || 차.할인 || 0,
      deliveryFee: 조건.탁송비,
      tintFee: 조건.썬팅비,
      dashcamFee: 조건.블박비,
      deposit_pct: (a.보증금 || 0) / 100,
      prepay_pct: (a.선납 || 0) / 100,
      liability: 조건.대물,
      extraDriver: 조건.추가운전자,
      maintenance: 조건.정비,
      feeRate: (조건.수수료율 || 0) / 100,
    })),
  };
}

async function welrixExcel(request) {
  const r = await fetch(WELRIX_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(welrixBody(request)),
    signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined,
  });

  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok || !Array.isArray(j.results)) {
    throw new Error(j?.error || `Welrix 계산 서버 응답 ${r.status}`);
  }

  return {
    vehiclePrice: j.price ?? null,
    results: j.results.map((g) => (g == null ? null : {
      monthlyRent: g.monthlyRent,
      deposit: g.deposit,
      prepay: g.prepay,
      acquirePrice: g.acquirePrice,
      totalCarPrice: g.totalCarPrice,
      payFee: g.payFee,
    })),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return bad(res, 405, 'POST 만 받습니다');

  const { kind, adapterId, request } = req.body || {};
  if (!request?.차?.키 || !Array.isArray(request?.안들)) {
    return bad(res, 400, '견적 요청 형식이 올바르지 않습니다', 'QUOTE_REQUEST_INVALID');
  }
  if (request?.계약 && request.계약 !== QUOTE_REQUEST_CONTRACT) {
    return bad(res, 400, `지원하지 않는 견적 요청 계약입니다: ${request.계약}`, 'QUOTE_REQUEST_CONTRACT_UNSUPPORTED');
  }

  try {
    let out;
    if (kind === 'excel' && adapterId === 'welrix') {
      out = await welrixExcel(request);
    } else if (kind === 'excel') {
      return bad(res, 501, `등록되지 않은 Excel adapter: ${adapterId || '-'}`);
    } else if (kind === 'erp') {
      return bad(res, 501, `등록되지 않은 ERP adapter: ${adapterId || '-'}`);
    } else {
      return bad(res, 400, '외부 견적 종류가 올바르지 않습니다');
    }

    res.status(200).json({ ok: true, contract: QUOTE_RESULT_CONTRACT, providerContract: QUOTE_PROVIDER_CONTRACT, ...out });
  } catch (e) {
    if (e?.code === 'PROVIDER_UNSUPPORTED') {
      return bad(res, 422, e?.message || '현재 계산 공급자에서 지원하지 않는 차량입니다', 'PROVIDER_UNSUPPORTED');
    }
    res.status(502).json({
      ok: false,
      error: e?.message || '외부 견적 공급자에 연결할 수 없습니다',
      code: 'PROVIDER_ERROR',
    });
  }
}
