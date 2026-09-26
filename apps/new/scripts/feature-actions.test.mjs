import test from 'node:test';
import assert from 'node:assert/strict';

import {
  quoteActionReadiness,
  resetForRequote,
  selectedDesktopQuoteTerms,
  selectedLiveQuoteTerms,
} from '../src/lib/feature/actions.js';

test('live mobile share only uses included periods with actual results', () => {
  const state = {
    scenarios: [{ term: 12 }, { term: 36 }, { term: 60 }],
    send: [false, true, true],
  };
  const results = [
    { 월대여료: 100 },
    { 월대여료: 200 },
    { 월대여료: null },
  ];
  const terms = selectedLiveQuoteTerms(state, results);
  assert.deepEqual(terms.map((x) => x.scenario.term), [36]);
  assert.equal(quoteActionReadiness({
    quoteState: state,
    vehicleSelected: true,
    calculationStatus: 'ok',
    calculationResults: results,
  }).ready, true);
});

test('desktop readiness requires an included calculated term', () => {
  const state = {
    scenarios: [{ term: 12 }, { term: 36 }],
    send: [false, true],
    monthly: [{ monthly: 100 }, { monthly: null }],
  };
  assert.equal(selectedDesktopQuoteTerms(state).length, 0);
  assert.deepEqual(quoteActionReadiness({
    quoteState: state,
    vehicleSelected: true,
    surface: 'desktop',
  }), {
    ready: false,
    reason: 'included_result_required',
    source: 'live',
    terms: [],
  });
});

test('shared snapshot is ready only when it contains a valid term', () => {
  const state = { sharedSnapshot: { terms: [{ term: 36, monthly: 300 }] } };
  const result = quoteActionReadiness({ quoteState: state, vehicleSelected: true });
  assert.equal(result.ready, true);
  assert.equal(result.source, 'shared');
  assert.equal(result.terms.length, 1);
});

test('pending live calculation cannot be sent or shared', () => {
  const state = { scenarios: [{ term: 36 }], send: [true] };
  const result = quoteActionReadiness({
    quoteState: state,
    vehicleSelected: true,
    calculationStatus: 'pending',
    calculationResults: [{ 월대여료: 300 }],
  });
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'calculation_pending');
});

test('requote clears snapshot and normalizes send length without allowing zero included', () => {
  const state = {
    sharedSnapshot: { terms: [{ term: 36, monthly: 300 }] },
    scenarios: [{ term: 12 }, { term: 36 }],
    send: [false, false, true, true],
  };
  const result = resetForRequote(state);
  assert.equal(result.changed, true);
  assert.equal(state.sharedSnapshot, null);
  assert.deepEqual(state.send, [true, false]);
});
