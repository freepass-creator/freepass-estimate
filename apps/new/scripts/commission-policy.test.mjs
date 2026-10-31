import test from 'node:test';
import assert from 'node:assert/strict';
import { commissionForAgent,commissionFromConditions,COMMISSION_POLICY } from '../src/lib/quote/commission-policy.js';
import { encodeCommissionMark,decodeCommissionMark } from '../api/_private/commission-mark.js';
test('all 51 agent selections retain fixed company 1P and round-trip through two letters',()=>{
  for(let n=0;n<=50;n++){
    const agent=n/10,p=commissionForAgent(agent),mark=encodeCommissionMark(agent);
    assert.equal(p.companyPoints,1);assert.equal(p.totalPoints,(n+10)/10);assert.deepEqual(decodeCommissionMark(mark),p);
  }
  assert.equal(encodeCommissionMark(0),'AA');assert.equal(encodeCommissionMark(.1),'AB');assert.equal(encodeCommissionMark(1),'BA');assert.equal(encodeCommissionMark(2.5),'CF');assert.equal(encodeCommissionMark(5),'FA');
});
test('invalid increments and values above the agent pool are rejected',()=>{
  for(const value of [-.1,5.1,6,.01,NaN,'3'])assert.throws(()=>commissionForAgent(value));
  for(const mark of ['FJ','FB','ZZ','A','Q1-'])assert.throws(()=>decodeCommissionMark(mark));
  assert.throws(()=>commissionFromConditions({영업수수료P:2.5}));
  assert.equal(commissionFromConditions({수수료정책:COMMISSION_POLICY,영업수수료P:2.5,수수료율:99}).totalPoints,3.5);
});
