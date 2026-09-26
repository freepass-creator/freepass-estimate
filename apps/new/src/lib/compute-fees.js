// 견적 비용 산출 compatibility facade.
// 차량 옵션가는 기존 화면 상태에서 조립하고, 계약 부대비용은 Quote Core의
// canonical condition-cost resolver 한 곳에서만 금액을 확정한다.

import { resolveQuoteConditionCosts } from './quote/condition-costs.js';

/** 옵션가 (원 단위): 차량 옵션 + 유료 내장색 */
export function optPrice(state) {
  const v = state?.vehicle;
  return (v?.options_price_manwon || 0) * 10000 + (state?.cond?.colorIntPrice || 0);
}

export function deliveryFee(state) {
  return resolveQuoteConditionCosts(state).deliveryFee;
}

export function tintFee(state) {
  return resolveQuoteConditionCosts(state).tintFee;
}

export function accessoryFee(state) {
  return resolveQuoteConditionCosts(state).accessoryFee;
}

/** 영업 부가품 합 — 선팅 + 블박/내비/하이패스. 탁송은 별도. */
export function itemsFee(state) {
  const costs = resolveQuoteConditionCosts(state);
  return costs.tintFee + costs.accessoryFee;
}
