import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures/kamatch-test-reference.mjs';
import { resolveKamatchRates,validateReference } from '../api/_kamatch/rates.js';
import { KAMATCH_APP_DIGEST,resolveKamatchProfile } from '../api/_kamatch/reference.js';
const base={term:36,mileage:30000,depositRate:5,creditType:'low',deliveryType:'dealer'};
test('original rate selection keeps deposit ties, credit-specific vehicle costs and mileage brackets',()=>{
  const {reference,profile}=fixture();
  const low=resolveKamatchRates(reference,profile,base);
  assert.equal(low.productInterestRate,7.5);assert.equal(low.commissionRatePercent,3);assert.equal(low.residualRatePercent,79);assert.equal(low.insuranceYearly,110000);assert.equal(low.gaesoIndex,1.1715);
  const tie=resolveKamatchRates(reference,profile,{...base,depositRate:7.5});assert.equal(tie.productInterestRate,7.5);assert.equal(tie.commissionRatePercent,3);
  const gen=resolveKamatchRates(reference,profile,{...base,term:48,creditType:'general',mileage:25000});assert.equal(gen.insuranceYearly,120000);assert.equal(gen.etcCostTotal,14000);assert.equal(gen.gaesoIndex,1.072);assert.equal(gen.extraMonthlyFee,0);
  const special=resolveKamatchRates(reference,profile,{...base,deliveryType:'special'});assert.equal(special.commissionRatePercent,2.5);
});
test('no missing tables, unreviewed app version, unknown mapping or missing original residual rates',()=>{
  const {reference,profile,profiles}=fixture();
  assert.equal(validateReference(reference,KAMATCH_APP_DIGEST),reference);
  const missing=structuredClone(reference);delete missing.tables['/api/commission-rates'];assert.throws(()=>validateReference(missing,KAMATCH_APP_DIGEST));
  assert.throws(()=>validateReference(reference,'wrong-app'));
  assert.throws(()=>resolveKamatchProfile(profiles,reference,'unknown'));
  reference.tables['/api/residual-grade-rates']=[];assert.throws(()=>resolveKamatchRates(reference,profile,base));
  assert.throws(()=>resolveKamatchProfile(profiles,reference,'FNJS4RMT1'),e=>e.code==='KAMATCH_MAPPING_VERSION_MISMATCH');
});
