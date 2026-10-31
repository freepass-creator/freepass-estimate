import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { calculateKamatch, loanRental } from '../api/_kamatch/formula.js';
const require = createRequire(import.meta.url);
const source = require('./fixtures/kamatch-public-arithmetic.cjs');
let seed = 20261031;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const choose = a => a[Math.floor(random() * a.length)];
function input() {
  return { vehiclePrice: choose([20620000, 27709996, 23980000, 35000001, 70000000]), optionPrice: choose([0,400000,900000,1300000]), term: choose([24,36,48,60]),
    depositRate: choose([0,5,7.5,10,20,30]), advanceRate: choose([0,5,10,20,30]), salesFeeRate: choose([-1,0,1,2,3,4,5,7]),
    insuranceAge: choose(['만26세','만21세','만24세']), mileage: choose([10000,20000,30000,40000,'무제한']),
    brand: choose(['현대','기아','기아 전기차','제네시스']), deliveryType: choose(['dealer','special']),
    productInterestRate: choose([0,3.1,7.7,12]), commissionRatePercent: choose([0,2,3,4,5]), residualRatePercent: choose([54,64,74]),
    feeRatePercent: choose([0,1.1,1.5]), modelFeeRate: choose([0,.05,.07]), discountAmount: choose([0,100000,1000000]),
    gaesoIndex: choose([0,1,1.072,1.1715]), autoTaxYearly: 18000, insuranceYearly: 120000, etcCostTotal: 15000,
    gaesoRegRates: [{gaesoIndex:1.1715,regFeeRate:8.1}], extraMonthlyFee: choose([0,1000,1234.5]),
    depositBaseDiscounted: choose([true,false]), salesFeeBaseDiscounted: choose([true,false]),
    vehicleSpecialDiscountRate: choose([null,0,2.5]), vehicleDealerDiscountRate: null,
    dealerDiscountRate:1, specialDiscountRate:2, dealerDiscountRateKia:3, specialDiscountRateKia:4,
    acqConstKia: -200000, acqConstDefault: 300000, acqConstKiaSpecial: -100000, acqConstDefaultSpecial: 100000,
    regFeeRate:8.55, regFeeFixed:77500, commissionSupplyRate5:3, commissionSupplyRate10:4, residualAdjust:-5, depositPmtRatio:50, vatRate:10,
    miscAmount:choose([0,10000]), extraOptions:[{amount:100000,baseline:50000},{amount:0,baseline:10000,removed:true}],
    ...(random()<.2?{manualDepositAmount:1234567.5}:{}),...(random()<.2?{manualAdvanceAmount:765432.5}:{}),
  };
}
for (const branch of ['loan','fee','legacy']) test(`exact original arithmetic: ${branch}, 4000 configurations`, () => {
  for(let i=0;i<4000;i++) {
    const s=input();
    if(branch!=='loan') delete s.productInterestRate;
    if(branch==='legacy') { delete s.feeRatePercent; if(i%2)delete s.residualRatePercent; }
    assert.deepEqual(calculateKamatch(s),source.calculate(s),JSON.stringify({branch,i,s}));
  }
});
test('loan rounding remains identical at 100-won boundaries and deposit bucket ties',()=>{
  for(const depositRate of [4.999999,5,7.499999,7.5,7.500001,10,29.999999,30]) {
    for(const price of [19999999,20000000,20000001,27709996]) {
      const s={...input(),vehiclePrice:price,depositRate,residualRate:64,commissionRate:3,advancePayment:123456,autoTax:17000,insurance:120000,etcCost:9876};
      assert.deepEqual(loanRental(s),source.loan(s));
    }
  }
});
