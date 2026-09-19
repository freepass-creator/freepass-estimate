// ============================================================================
//  계산기 ①  웰릭스   —   신차. 계산은 그쪽 서버가 한다.
// ----------------------------------------------------------------------------
//  ★대표 2026-09-18 「차량 선택하는 방법만 우리 방법으로 하고,
//    그 차량 금액에 따른 대여료 산출은 웰릭스 API를 써야지」
//
//  ★실패하면 «우리가 대신 계산»하지 않는다. 값이 달라지는 게 멈추는 것보다 나쁘다.
//    대표 「그쪽이 죽거나 막히면 어차피 못하는 거지」
//
//  ⚠ 웰릭스는 비율을 «소수»로 받는다 (10% = 0.1). 규격은 퍼센트(10)이므로 여기서 나눈다.
//     이 환산을 뼈대로 올리면 다른 계산기까지 웰릭스 규칙을 따라야 한다 — 여기 가둔다.
// ============================================================================

export const 이름 = '웰릭스';
export const 다루는차 = ['신차'];

/** @param {object} 요청  spec.js 규격
 *  @returns {Promise<Array>}  안들과 같은 차례의 결과
 *  @throws  못 내면 던진다 — 뼈대가 받아 「계산할 수 없습니다」로 말한다 */
export async function 계산(요청, { 신호 } = {}) {
  const { 차, 조건, 안들 } = 요청;

  const 몸 = {
    model: 차.키,
    old: false,
    manualPrice: 차.차량가 || 0,
    inputs: 안들.map((a) => ({
      credit: 조건.신용,
      termMonths: a.기간,
      mileage: 조건.주행,
      optionPrice: (차.옵션가 || 0) + (차.색추가금 || 0),
      stockDiscount: 차.할인 || 0,
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

  const r = await fetch('/api/estimate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(몸), signal: 신호,
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok || !Array.isArray(j.results)) {
    throw new Error(j?.error || `계산 서버 응답 ${r.status}`);
  }

  return {
    차량가: j.price,
    결과: j.results.map((g) => (g == null ? null : {
      월대여료: g.monthlyRent,
      보증금: g.deposit,
      선납금: g.prepay,
      인수가: g.acquirePrice,
      총차량가: g.totalCarPrice,
      수수료: g.payFee,
    })),
  };
}
