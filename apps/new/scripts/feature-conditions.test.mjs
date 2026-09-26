import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyScenarioPercent,
  normalizeCredit,
  normalizeFeeRate,
  normalizeKm,
  normalizePercent,
  toggleQuoteTerm,
} from '../src/lib/feature/conditions.js';

test('deposit and prepayment share the same 0..30 rule', () => {
  assert.equal(normalizePercent('dep', 35), 30);
  assert.equal(normalizePercent('dep', -4), 0);
  assert.equal(normalizePercent('pre', '12.5'), 12.5);
});

test('fee rate is rounded to 0.1 and clamped', () => {
  assert.equal(normalizeFeeRate(7.06), 7);
  assert.equal(normalizeFeeRate(-10.7), -10);
  assert.equal(normalizeFeeRate(3.26), 3.3);
});

test('credit and annual mileage reject unsupported values', () => {
  assert.equal(normalizeCredit('고신용'), '고신용');
  assert.equal(normalizeCredit('신용'), '중신용');
  assert.equal(normalizeKm(4), 4);
  assert.equal(normalizeKm(8), 2);
});

test('changing deposit/prepayment updates every active scenario', () => {
  const state = {
    cond: { dep: 0, pre: 0 },
    scenarios: [{ term: 12, dep: 0, pre: 0 }, { term: 36, dep: 0, pre: 0 }],
  };
  assert.equal(applyScenarioPercent(state, 'dep', 50), 30);
  assert.deepEqual(state.scenarios.map((s) => s.dep), [30, 30]);
  assert.equal(applyScenarioPercent(state, 'pre', -1), 0);
  assert.deepEqual(state.scenarios.map((s) => s.pre), [0, 0]);
});

test('term toggle preserves zero deposit and canonical term order', () => {
  const state = {
    cond: { dep: 0, pre: 0 },
    scenarios: [{ term: 12, dep: 0, pre: 0 }, { term: 60, dep: 0, pre: 0 }],
    send: [true, true],
  };
  assert.equal(toggleQuoteTerm(state, 36), true);
  assert.deepEqual(state.scenarios.map((s) => s.term), [12, 36, 60]);
  assert.equal(state.scenarios[1].dep, 0);
  assert.equal(toggleQuoteTerm(state, 12), true);
  assert.deepEqual(state.scenarios.map((s) => s.term), [36, 60]);
});

test('last remaining term cannot be removed', () => {
  const state = {
    cond: { dep: 10, pre: 0 },
    scenarios: [{ term: 36, dep: 10, pre: 0 }],
    send: [true],
  };
  assert.equal(toggleQuoteTerm(state, 36), false);
  assert.equal(state.scenarios.length, 1);
});
