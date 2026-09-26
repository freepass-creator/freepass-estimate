import assert from 'node:assert/strict';
import {
  resolveDeliveryCost,
  resolveQuoteConditionCosts,
} from '../src/lib/quote/condition-costs.js';
import {
  QUOTE_CONDITION_COSTS_CONTRACT,
  QUOTE_CONDITION_COST_POLICY,
  assertQuoteConditionCosts,
  conditionCostsFromRequest,
} from '../src/lib/quote/condition-cost-contract.js';

const mobileDefault = resolveQuoteConditionCosts({
  cond: { deliveryRegion: '서울', deliveryCity: '서울' },
  tint: { product: '루마 일반', areas: new Set() },
  extras: { blackbox: '파인뷰 SF500' },
});
assert.equal(mobileDefault.contract, QUOTE_CONDITION_COSTS_CONTRACT);
assert.equal(mobileDefault.policyId, QUOTE_CONDITION_COST_POLICY);
assert.equal(mobileDefault.deliveryFee, 99000, 'FreePass Seoul city price must win over compatibility 120k');
assert.equal(mobileDefault.tintFee, 105000);
assert.equal(mobileDefault.dashcamFee, 180000);
assert.equal(mobileDefault.naviFee, 0);
assert.equal(mobileDefault.hipassFee, 0);
assert.equal(mobileDefault.accessoryFee, 180000);
assert.equal(mobileDefault.totalPrepFee, 384000);
assert.equal(assertQuoteConditionCosts(mobileDefault).totalPrepFee, 384000);
assert.equal(conditionCostsFromRequest({
  조건: {
    탁송비: mobileDefault.deliveryFee,
    썬팅비: mobileDefault.tintFee,
    블박비: mobileDefault.dashcamFee,
    내비비: mobileDefault.naviFee,
    하이패스비: mobileDefault.hipassFee,
    비용: mobileDefault,
  },
}).totalPrepFee, 384000);

const desktop = resolveQuoteConditionCosts({
  cond: { deliveryRegion: '경기도', deliveryCity: '수원' },
  tint: { product: '루마 GG', areas: new Set(['side_rear_with_coupon', 'front']) },
  extras: {
    blackbox: 'DF7 (딥플라이)',
    navi: 'RG-i8 (아이나비)',
    hipass: 'SET-550 (엠피온)',
  },
});
assert.equal(desktop.deliveryFee, 77000);
assert.equal(desktop.tintFee, 105000);
assert.equal(desktop.dashcamFee, 175000);
assert.equal(desktop.naviFee, 220000);
assert.equal(desktop.hipassFee, 110000);
assert.equal(desktop.accessoryFee, 505000);
assert.equal(desktop.totalPrepFee, 687000);

const coarse = resolveDeliveryCost({ deliveryRegion: '충북', deliveryCity: '충북' });
assert.equal(coarse.amount, 140000);
assert.match(coarse.basis, /^COMPAT_REGION:/);

assert.throws(
  () => resolveQuoteConditionCosts({
    cond: { deliveryRegion: '미확인', deliveryCity: '미확인' },
    tint: { product: '루마 일반', areas: new Set() },
    extras: { blackbox: '파인뷰 SF500' },
  }),
  (error) => error?.code === 'QUOTE_CONDITION_COST_UNRESOLVED'
);

assert.throws(
  () => resolveQuoteConditionCosts({
    cond: { deliveryRegion: '서울', deliveryCity: '서울' },
    tint: { product: 'UNKNOWN TINT', areas: new Set() },
    extras: {},
  }),
  (error) => error?.code === 'QUOTE_CONDITION_COST_UNRESOLVED'
);

assert.throws(
  () => conditionCostsFromRequest({
    조건: {
      탁송비: 120000,
      썬팅비: mobileDefault.tintFee,
      블박비: mobileDefault.dashcamFee,
      내비비: 0,
      하이패스비: 0,
      비용: mobileDefault,
    },
  }),
  /alias mismatch/
);

console.log('PASS canonical Quote condition cost resolution');
