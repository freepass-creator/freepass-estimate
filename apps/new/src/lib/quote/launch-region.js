import { 탁송 } from '../welrix-rates.js';
import { createQuoteConditionCosts } from './condition-cost-contract.js';

// New quotations use one delivery basis until regional quoting is opened.
// Saved quotation snapshots remain immutable.
export const QUOTE_REGION = '수도권';
export const QUOTE_DELIVERY_FEE = 탁송[QUOTE_REGION];
export const QUOTE_DELIVERY_BASIS = `LAUNCH_REGION:${QUOTE_REGION}`;
export function withLaunchRegion(request) {
  const conditions = request?.조건;
  if (!conditions?.비용) return request;
  const costs = createQuoteConditionCosts({ ...conditions.비용, deliveryFee: QUOTE_DELIVERY_FEE,
    basis: { ...conditions.비용.basis, delivery: QUOTE_DELIVERY_BASIS } });
  return { ...request, 조건: { ...conditions, 탁송지역: QUOTE_REGION, 탁송비: costs.deliveryFee, 비용: costs } };
}
