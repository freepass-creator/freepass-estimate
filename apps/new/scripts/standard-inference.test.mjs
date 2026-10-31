import test from 'node:test';
import assert from 'node:assert/strict';
import {financialBasis,monthlyPayment,inferMonthlyRate,analyzeQuote,standardFromBenchmarks} from '../api/_standard/quote-inference.js';
test('recovers known rates including zero and negative yield with deposit refund and prepay',()=>{
 for(const rate of [-.001,0,.005,.01,.02])for(const months of [36,48,60])for(const deposit of [0,3500000,10500000])for(const prepay of [0,3500000,10500000]) {
  const b=financialBasis({vehiclePrice:35000000,deposit,prepay,commissionPoints:3.5,upfrontCosts:500000}),terminal=21000000-deposit;
  const monthly=monthlyPayment(rate,months,b.principal,terminal);
  if(monthly<=0)continue;
  assert.ok(Math.abs(inferMonthlyRate({months,principal:b.principal,monthly,terminal})-rate)<1e-11);
 }
});
test('operating-cost assumptions distinguish quote yield from assumed financing IRR',()=>{
 const inputs={vehiclePrice:35000000,deposit:3500000,prepay:0,commissionPoints:3,months:48,acquirePrice:20000000};
 const b=financialBasis(inputs),monthly=monthlyPayment(.01,48,b.principal,16500000);
 const all=analyzeQuote({...inputs,monthlyRent:monthly+150000});
 const net=analyzeQuote({...inputs,monthlyRent:monthly+150000,monthlyCosts:150000,costBasisVerified:true});
 assert.equal(all.classification,'ALL_IN_QUOTE_IMPLIED_YIELD');assert.equal(net.classification,'COST_ASSUMPTION_IRR');assert.ok(all.monthlyRate>net.monthlyRate);assert.ok(Math.abs(net.monthlyRate-.01)<1e-11);
});
test('same-configuration standard uses explicit equal weights, residuals and 100-won rounding',()=>{
 const price=35000000,term=48,deposit=3500000,prepay=1750000,commissionPoints=3.5;
 const b=financialBasis({vehiclePrice:price,deposit,prepay,commissionPoints});
 const sources=[['welrix',.008,.55],['kamatch',.012,.65]].map(([id,rate,residual])=>({id,row:{monthlyRent:monthlyPayment(rate,term,b.principal,price*residual-deposit),deposit,prepay,acquirePrice:price*residual,totalCarPrice:price}}));
 const result=standardFromBenchmarks({price,term,depositPercent:10,prepayPercent:5,commissionPoints,sources});
 assert.ok(Math.abs(result.calibration.monthlyRate-.01)<1e-11);assert.ok(Math.abs(result.calibration.residualRate-.6)<1e-11);assert.equal(result.row.monthlyRent,Math.ceil(monthlyPayment(.01,term,b.principal,price*.6-deposit)/100)*100);
 assert.equal(result.calibration.scope,'CURRENT_CANONICAL_CONFIGURATION_ONLY');assert.equal(result.calibration.lenderIrrIdentified,false);
 assert.throws(()=>standardFromBenchmarks({price,term,depositPercent:10,prepayPercent:5,commissionPoints,sources:[sources[0]]}));
});

test('price sensitivity separates a fixed monthly cost from price-linked finance under stated cost assumptions',async()=>{
 const {fitPriceCurve}=await import('../api/_standard/quote-inference.js');
 const rate=.008,months=60,commissionPoints=3.5,depositRate=.1,prepayRate=.05,rv=.55;
 const slope=monthlyPayment(rate,months,1+commissionPoints/100-depositRate-prepayRate,rv-depositRate);
 const samples=[25000000,30000000,35000000].map(price=>({price,monthlyRent:slope*price+150000,acquirePrice:rv*price}));
 const fit=fitPriceCurve(samples,{commissionPoints,depositRate,prepayRate,months});
 assert.ok(Math.abs(fit.monthlyRate-rate)<1e-11);assert.ok(Math.abs(fit.monthlyFixedIntercept-150000)<1e-6);assert.ok(fit.maxFitErrorWon<1e-6);assert.equal(fit.lenderIrrIdentified,false);
});
