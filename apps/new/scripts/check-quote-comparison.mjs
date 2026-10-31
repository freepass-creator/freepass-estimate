import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COMPARISON_TYPES, comparisonRequest, observedComparison } from '../src/lib/quote/comparison.js';

const source = fs.readFileSync(new URL('../../../docs/references/kamatch/observations.json', import.meta.url));
const publicCopy = fs.readFileSync(new URL('../public/data/references/kamatch/observations.json', import.meta.url));
assert.deepEqual(publicCopy, source, 'browser evidence must remain identical to the Work source');
const evidence = JSON.parse(source);
let count = 0;
for (const row of evidence.rows) {
  for (const result of row.results) {
    const observation = observedComparison(evidence, row.id, result.termMonths);
    assert.deepEqual(observation.input, row.input);
    assert.deepEqual(observation.result, result);
    assert.equal(observation.status, 'OBSERVATION_REPLAY_ONLY');
    observation.result.monthlyRent = 0;
    assert.equal(observedComparison(evidence, row.id, result.termMonths).result.monthlyRent, result.monthlyRent);
    count++;
  }
}
assert.equal(count, 39);
assert.throws(() => observedComparison(evidence, 'unknown', 60));
assert.throws(() => observedComparison(evidence, evidence.rows[0].id, 72));
const request = { 차: { 키: 'test', 구성: { colorId: 'c' } }, 조건: { 신용: '중신용', 주행: '3만km' }, 안들: [{ 기간: 60, 보증금: 5, 선납: 10 }] };
const original = structuredClone(request);
for (const type of COMPARISON_TYPES.filter((item) => item.engine)) {
  const next = comparisonRequest(request, type.id, 60);
  assert.equal(next.조건.신용, type.credit);
  assert.deepEqual(next.차, request.차);
  assert.deepEqual(next.안들, request.안들);
  next.차.구성.colorId = 'changed';
  assert.deepEqual(request, original, 'comparison must not change the live quote selection');
}
assert.equal(comparisonRequest(request, 'kamatch-low', 60).조건.신용, '저신용');
assert.throws(() => comparisonRequest(request, 'unknown', 60), 'unknown providers must not receive a quote');
assert.throws(() => comparisonRequest(request, 'standard-low', 36), 'unselected periods must not receive invented conditions');
console.log('PASS quote comparison: 39 exact observations, missing-case rejection, independent credit routes, immutable live selection');
