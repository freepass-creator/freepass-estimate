import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QUOTE_LIFECYCLE,
  buildHistorySnapshot,
  deriveQuoteLifecycle,
  restoreHistorySnapshot,
  sameHistoryConfiguration,
} from '../src/lib/feature/history.js';

test('quote lifecycle derives shared and live states deterministically', () => {
  assert.equal(deriveQuoteLifecycle({}), QUOTE_LIFECYCLE.EMPTY);
  assert.equal(deriveQuoteLifecycle({ vehicleSelected: true }), QUOTE_LIFECYCLE.CONFIGURING);
  assert.equal(deriveQuoteLifecycle({ vehicleSelected: true, calculationStatus: 'pending' }), QUOTE_LIFECYCLE.CALCULATING);
  assert.equal(deriveQuoteLifecycle({ vehicleSelected: true, calculationStatus: 'ok', hasReadyTerms: true }), QUOTE_LIFECYCLE.READY);
  assert.equal(deriveQuoteLifecycle({ vehicleSelected: true, calculationStatus: 'error' }), QUOTE_LIFECYCLE.ERROR);
  assert.equal(deriveQuoteLifecycle({ sharedSnapshot: { terms: [{}] } }), QUOTE_LIFECYCLE.SHARED);
});

test('history snapshot captures scenarios, send mask and calculation metadata', () => {
  const state = {
    vehicle: { brand: '현대', model: '그랜저', variant: '2.5', trim_name: '프리미엄', total_manwon: 4000 },
    cond: { credit: '중신용', km: 2, dep: 10, pre: 0 },
    scenarios: [{ term: 12, dep: 10, pre: 0 }, { term: 36, dep: 20, pre: 0 }],
    send: [false, true],
    monthly: [{ idx: 0, term: 12, monthly: 100 }, { idx: 1, term: 36, monthly: 80 }],
    quoteProvider: 'standard',
    quoteEngine: 'freepass',
    quotePricingEngine: 'v2',
  };
  const entry = buildHistorySnapshot(state, { id: 'h1', now: 1 });
  assert.equal(entry.id, 'h1');
  assert.deepEqual(entry.scenarios, state.scenarios);
  assert.deepEqual(entry.send, [false, true]);
  assert.equal(entry.quoteProvider, 'standard');
});

test('history snapshot refuses incomplete calculations', () => {
  assert.equal(buildHistorySnapshot({ vehicle: { total_manwon: 1 }, monthly: [] }), null);
  assert.equal(buildHistorySnapshot({ vehicle: { total_manwon: 1 }, monthly: [{ monthly: null }] }), null);
});

test('same configuration includes scenario and send-state differences', () => {
  const state = {
    vehicle: { brand: '현대', model: '그랜저', variant: '2.5', trim_name: '프리미엄', total_manwon: 4000 },
    cond: { credit: '중신용', km: 2, dep: 10, pre: 0 },
    scenarios: [{ term: 36, dep: 10, pre: 0 }],
    send: [true],
    monthly: [{ monthly: 80 }],
  };
  const entry = buildHistorySnapshot(state, { id: 'h1', now: 1 });
  assert.equal(sameHistoryConfiguration(entry, state), true);
  state.send[0] = false;
  assert.equal(sameHistoryConfiguration(entry, state), false);
});

test('restore returns quote to live mode and restores exact scenario/send state', () => {
  const target = {
    vehicle: { old: true },
    sharedSnapshot: { terms: [{ term: 12, monthly: 999 }] },
    cond: { credit: '고신용', km: 4, dep: 0, pre: 0 },
    scenarios: [{ term: 60, dep: 0, pre: 0 }],
    send: [true],
    monthly: [],
    referenceMonthly: [1],
    quoteProvider: null,
    quoteEngine: null,
    quotePricingEngine: null,
  };
  const entry = {
    vehicleFull: { brand: '기아', total_manwon: 3000 },
    condFull: { credit: '중신용', km: 2, dep: 20, pre: 0 },
    scenarios: [{ term: 24, dep: 20, pre: 0 }, { term: 48, dep: 20, pre: 0 }],
    send: [false, true],
    monthly: [{ term: 24, monthly: 90 }, { term: 48, monthly: 70 }],
    quoteProvider: 'standard',
    quoteEngine: 'freepass',
    quotePricingEngine: 'v2',
  };
  const result = restoreHistorySnapshot(entry, target);
  assert.equal(result.restored, true);
  assert.equal(target.sharedSnapshot, null);
  assert.deepEqual(target.scenarios, entry.scenarios);
  assert.deepEqual(target.send, [false, true]);
  assert.deepEqual(target.monthly, entry.monthly);
  assert.equal(target.quoteProvider, 'standard');
});
