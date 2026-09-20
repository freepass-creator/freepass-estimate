// 견적 비용 산출 — 4개 컴포넌트(StickyQuote / SendSheet / StepConditions / StepExtras 등)
// 가 모두 같은 로직을 복제하던 것을 통합. quoteState 를 받아 순수 함수로 계산만 수행.
// (Vue computed 와 호환 — 각 컴포넌트가 computed(() => optPrice(state)) 식으로 호출)

import { DELIVERY_REGIONS, ACCESSORIES, TINT_PRICES } from '../data/lookups.js';

/**
 * 옵션가 (원 단위)
 * options_price_manwon (만원) × 10,000 + colorIntPrice (원)
 */
export function optPrice(state) {
  const v = state?.vehicle;
  return (v?.options_price_manwon || 0) * 10000 + (state?.cond?.colorIntPrice || 0);
}

/** 탁송비 — 지역/도시 조합 lookup */
export function deliveryFee(state) {
  const r = state?.cond?.deliveryRegion;
  const c = state?.cond?.deliveryCity;
  return DELIVERY_REGIONS[r]?.[c] || 0;
}

/** 선팅비 — 제품 × 부위 합산 */
export function tintFee(state) {
  const product = state?.tint?.product;
  const areas = state?.tint?.areas;
  if (!product || !areas?.size) return 0;
  const map = TINT_PRICES[product];
  if (!map) return 0;
  let total = 0;
  areas.forEach((a) => { total += map[a] || 0; });
  return total;
}

/** 용품비 — 블랙박스 + 내비 + 하이패스 */
export function accessoryFee(state) {
  const e = state?.extras || {};
  return (ACCESSORIES.blackbox[e.blackbox] || 0)
       + (ACCESSORIES.navi[e.navi] || 0)
       + (ACCESSORIES.hipass[e.hipass] || 0);
}

/** 영업 필수 부가품 합 — 선팅 + 용품 (calc.js 의 itemsFee 인자) */
export function itemsFee(state) {
  return tintFee(state) + accessoryFee(state);
}
