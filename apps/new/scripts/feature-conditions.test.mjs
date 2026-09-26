import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyScenarioPercent,
  normalizeCredit,
  normalizeFeeRate,
  normalizeKm,
  normalizePercent,
  toggleQuoteTerm,
  setScenarioIncluded,
  setScenarioPercent,
  setScenarioTerm,
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


test('scenario-specific deposit/prepayment obey the same 0..30 rule', () => {
  const state = { cond: {}, scenarios: [{ term: 36, dep: 10, pre: 0 }], send: [true] };
  assert.deepEqual(setScenarioPercent(state, 0, 'dep', 100), { changed: true, value: 30 });
  assert.equal(state.scenarios[0].dep, 30);
  assert.deepEqual(setScenarioPercent(state, 0, 'pre', -5), { changed: false, value: 0 });
});

test('scenario terms stay canonical and unique', () => {
  const state = {
    cond: {},
    scenarios: [{ term: 12 }, { term: 36 }, { term: 60 }],
    send: [true, true, true],
  };
  assert.equal(setScenarioTerm(state, 1, 60).accepted, false);
  assert.equal(state.scenarios[1].term, 36);
  assert.equal(setScenarioTerm(state, 1, 24).accepted, true);
  assert.equal(state.scenarios[1].term, 24);
  assert.equal(setScenarioTerm(state, 1, 18).accepted, false);
  assert.equal(state.scenarios[1].term, 24);
});

test('at least one quote term must remain included for send/share', () => {
  const state = {
    cond: {},
    scenarios: [{ term: 12 }, { term: 36 }],
    send: [true, true],
  };
  assert.equal(setScenarioIncluded(state, 0, false).accepted, true);
  assert.deepEqual(state.send, [false, true]);
  assert.equal(setScenarioIncluded(state, 1, false).accepted, false);
  assert.deepEqual(state.send, [false, true]);
  assert.equal(setScenarioIncluded(state, 0, true).accepted, true);
  assert.deepEqual(state.send, [true, true]);
});
