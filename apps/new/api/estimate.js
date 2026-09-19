// ============================================================================
//  웰릭스 계산 서버 proxy — 우리 화면이 «웰릭스 로직 그대로» 계산한다
// ----------------------------------------------------------------------------
//  ★대표 2026-09-18 「우리 견적 뼈대에 웰릭스 거를 로직 삼아서 그대로 보내주려고 하는 거니까.
//    외형은 다른데 내부는 똑같은 로직이어야 되는 거야. 똑같은 조건을 놓고 똑같으면
//    완벽하게 맞아야 돼. 몇천 원 차이가 나면 안 돼」
//
//  ★왜 우리가 계산하지 않나
//    우리 엔진(src/lib/calc.js)은 웰릭스 실측 60점 격자에서 «53/60 정확 일치,
//    나머지 7건도 1,000원 이내»까지 왔다(금리 7.14% 보정). 훌륭하지만 «0» 은 아니다.
//    0 을 보장하는 길은 «웰릭스가 계산한 값을 그대로 받는 것»뿐이다.
//
//  ★왜 프록시가 필요한가
//    welrixmobility.netlify.app/api/estimate 는 CORS 가 안 열려 있다
//    (OPTIONS 프리플라이트 405 · Access-Control-Allow-Origin 없음).
//    브라우저에서 직접 못 부른다. 서버를 한 번 거치면 된다 — api/stock.js 와 같은 방식이다.
//
//  ★보내는 몸통 (웰릭스 견적기 compute() 와 «글자 그대로» 같아야 한다)
//    { model, old, manualPrice, inputs:[{ credit, termMonths, mileage, optionPrice,
//      stockDiscount, deliveryFee, tintFee, dashcamFee, deposit_pct, prepay_pct,
//      liability, extraDriver, maintenance, feeRate }] }
//    ⚠ deposit_pct·prepay_pct 는 «비율»이다(10% = 0.1). feeRate 도 «비율»이다(7% = 0.07).
//      퍼센트 숫자를 그대로 보내면 400 「수수료율이 올바르지 않습니다」 가 돌아온다.
//
//  ★받는 것
//    { ok, model, price, results:[{ monthlyRent, prepay, deposit, acquirePrice,
//      totalCarPrice, taxExcludedPrice, payFee, consumerPrice }] }
//    ⚠ payFee(지급수수료)는 «영업 몫»이다 — 손님 화면에 내보내지 않는다.
// ============================================================================

const 위 = 'https://welrixmobility.netlify.app/api/estimate';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST 만 받는다' }); return; }

  try {
    const 몸통 = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const 끊개 = AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
    const r = await fetch(위, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 몸통,
      signal: 끊개,
    });
    const 글 = await r.text();
    // ★계산값은 캐시하지 않는다 — 웰릭스가 가격·정책을 바꾸면 «그 즉시» 따라가야 한다
    res.setHeader('Cache-Control', 'no-store');
    res.status(r.status).send(글);
  } catch (e) {
    // 여기서 우리 엔진으로 «대신 계산»하지 않는다 — 값이 달라지면 그게 더 나쁘다.
    // 화면은 「지금 계산할 수 없다」고 말하고 상담으로 넘긴다.
    res.status(502).json({ ok: false, error: '계산 서버에 연결할 수 없습니다', detail: String(e) });
  }
}
