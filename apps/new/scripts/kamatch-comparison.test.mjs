import test from 'node:test';
import assert from 'node:assert/strict';
import { createKamatchComparisonHandler } from '../api/kamatch-comparison.js';
import { calculateKamatchScenario } from '../api/_kamatch/calculate.js';
import { fixture } from './fixtures/kamatch-test-reference.mjs';
function response(){return{code:200,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}}
function setup(){const f=fixture();return{...f,handler:createKamatchComparisonHandler({loadMaster:async()=>f.master,loadReference:async()=>f.reference,loadProfiles:async()=>f.profiles})}}
test('factory configuration and 1–5% fees reach the original formula without browser-price or commission leaks',async()=>{
  const f=setup();
  for(const fee of [0,1,2,3,4,5]) for(const deposit of [0,5,7.5,10,20,30]) for(const prepay of [0,10,30]) {
    f.request.조건.영업수수료P=fee;f.request.조건.수수료율=fee+1;for(const sc of f.request.안들){sc.보증금=deposit;sc.선납=prepay;}
    const res=response();await f.handler({method:'POST',body:{request:f.request}},res);assert.equal(res.code,200,JSON.stringify(res.body));
    assert.equal(res.body.priceBasis.basePrice,23980000);assert.equal(res.body.priceBasis.optionPrice,450000);assert.equal(res.body.priceBasis.exteriorColorPrice,110000);assert.equal(res.body.priceBasis.interiorColorPrice,220000);
    for(const [i,sc]of f.request.안들.entries()){
      const policy=Object.fromEntries(Object.entries(f.reference.tables).map(([k,v])=>[k.replace('/api/',''),v]));policy.settings=policy['commission-settings'];
      const out=calculateKamatchScenario({priceBasis:res.body.priceBasis,vehiclePolicy:{...f.reference.tables['/api/vehicles'][0],vehicleType:f.profile.vehicleType},policy,conditions:{termMonths:sc.기간,annualKm:30000,depositPercent:deposit,prepayPercent:prepay,creditType:'low',deliveryType:'dealer',salesFeeRate:fee+1,insuranceAge:'만 26세 이상',extraOptions:[]}});
      assert.deepEqual(res.body.results[i],{monthlyRent:out.monthlyRent,deposit:out.deposit,prepay:out.prepay,acquirePrice:out.residualAmount,totalCarPrice:24760000});
    }
    assert.equal(res.body.results[0].commission,undefined);assert.equal(res.body.feeRatePct,undefined);
  }
});
test('mapping/version errors and unavailable authenticated rates never use observations or another calculator',async()=>{
  const f=setup();f.profiles.applicationDigest='wrong';let res=response();await f.handler({method:'POST',body:{request:f.request}},res);assert.equal(res.body.code,'KAMATCH_MAPPING_VERSION_MISMATCH');
  const missing=createKamatchComparisonHandler({loadMaster:async()=>f.master,loadReference:async()=>{throw Object.assign(new Error('reference unavailable'),{code:'KAMATCH_REFERENCE_UNAVAILABLE',status:503})}});
  res=response();await missing({method:'POST',body:{request:f.request}},res);assert.equal(res.code,503);assert.equal(res.body.code,'KAMATCH_REFERENCE_UNAVAILABLE');assert.equal(res.body.results,undefined);
});
test('option rules and public insurance/maintenance conditions are checked before issuing numbers',async()=>{
  const f=setup();f.master.data[0].options[0].requires=['other'];let res=response();await f.handler({method:'POST',body:{request:f.request}},res);assert.equal(res.body.code,'FREEPASS_DATA_OPTION_RULE_VIOLATION');
  f.master.data[0].options[0].requires=[];f.request.조건.정비='포함';res=response();await f.handler({method:'POST',body:{request:f.request}},res);assert.equal(res.body.code,'KAMATCH_CONDITIONS_UNSUPPORTED');
});
