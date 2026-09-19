// Server-side external quote adapter router.
// Never exposes partner Excel files, ERP credentials or upstream auth to the browser.

const WELRIX_URL = 'https://welrixmobility.netlify.app/api/estimate';

function bad(res, status, error) {
  res.status(status).json({ ok: false, error });
}

function welrixBody(request) {
  const 차 = request?.차 || {};
  const 가격 = 차.가격 || {};
  const 조건 = request?.조건 || {};
  const 안들 = request?.안들 || [];

  return {
    model: 차.키,
    old: false,
    manualPrice: 차.차량가 || 0,
    inputs: 안들.map((a) => ({
      credit: 조건.신용,
      termMonths: a.기간,
      mileage: 조건.주행,
      optionPrice: (가격.옵션 || 차.옵션가 || 0) + (가격.외장색 || 차.색추가금 || 0),
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
    return bad(res, 400, '견적 요청 형식이 올바르지 않습니다');
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

    res.status(200).json({ ok: true, ...out });
  } catch (e) {
    res.status(502).json({
      ok: false,
      error: e?.message || '외부 견적 공급자에 연결할 수 없습니다',
    });
  }
}
