import { QUOTE_LIFECYCLE, deriveQuoteLifecycle } from './history.js';

// Quote action/readiness rules shared by mobile and desktop.
// This layer decides whether a finished quote may be previewed/shared/sent.
// It does not calculate prices and does not persist anything.

function validMonthly(value) {
  return value != null && Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function includedScenarioIndexes(quoteState) {
  const scenarios = Array.isArray(quoteState?.scenarios) ? quoteState.scenarios : [];
  const send = Array.isArray(quoteState?.send) ? quoteState.send : [];
  return scenarios
    .map((_scenario, index) => index)
    .filter((index) => send[index] !== false);
}

export function selectedLiveQuoteTerms(quoteState, calculationResults) {
  const scenarios = Array.isArray(quoteState?.scenarios) ? quoteState.scenarios : [];
  const results = Array.isArray(calculationResults) ? calculationResults : [];
  return includedScenarioIndexes(quoteState)
    .map((index) => {
      const scenario = scenarios[index];
      const result = results[index];
      if (!scenario || !result || !validMonthly(result.월대여료 ?? result.monthly)) return null;
      return { index, scenario, result };
    })
    .filter(Boolean);
}

export function selectedDesktopQuoteTerms(quoteState) {
  const scenarios = Array.isArray(quoteState?.scenarios) ? quoteState.scenarios : [];
  const monthly = Array.isArray(quoteState?.monthly) ? quoteState.monthly : [];
  return includedScenarioIndexes(quoteState)
    .map((index) => {
      const scenario = scenarios[index];
      const result = monthly[index];
      if (!scenario || !result || !validMonthly(result.monthly)) return null;
      return { index, scenario, result };
    })
    .filter(Boolean);
}

export function selectedSharedQuoteTerms(sharedSnapshot) {
  const terms = Array.isArray(sharedSnapshot?.terms) ? sharedSnapshot.terms : [];
  return terms.filter((term) => term && validMonthly(term.monthly));
}

export function quoteActionReadiness({
  quoteState,
  vehicleSelected = false,
  calculationStatus = null,
  calculationResults = null,
  surface = 'mobile',
} = {}) {
  const sharedTerms = selectedSharedQuoteTerms(quoteState?.sharedSnapshot);
  const liveTerms = surface === 'desktop'
    ? selectedDesktopQuoteTerms(quoteState)
    : selectedLiveQuoteTerms(quoteState, calculationResults);

  const lifecycle = deriveQuoteLifecycle({
    vehicleSelected,
    sharedSnapshot: quoteState?.sharedSnapshot,
    calculationStatus,
    hasReadyTerms: liveTerms.length > 0,
  });

  if (lifecycle === QUOTE_LIFECYCLE.EMPTY) {
    return { ready: false, reason: 'vehicle_required', source: null, terms: [], lifecycle };
  }

  if (lifecycle === QUOTE_LIFECYCLE.SHARED) {
    if (!sharedTerms.length) {
      return { ready: false, reason: 'shared_terms_required', source: 'shared', terms: [], lifecycle };
    }
    return { ready: true, reason: null, source: 'shared', terms: sharedTerms, lifecycle };
  }

  if (lifecycle === QUOTE_LIFECYCLE.CALCULATING) {
    return { ready: false, reason: 'calculation_pending', source: 'live', terms: [], lifecycle };
  }

  if (lifecycle === QUOTE_LIFECYCLE.ERROR || lifecycle === QUOTE_LIFECYCLE.CONFIGURING) {
    return { ready: false, reason: 'calculation_required', source: 'live', terms: [], lifecycle };
  }

  if (!liveTerms.length) {
    return { ready: false, reason: 'included_result_required', source: 'live', terms: [], lifecycle };
  }

  return { ready: true, reason: null, source: 'live', terms: liveTerms, lifecycle };
}

export function resetForRequote(quoteState) {
  if (!quoteState) throw new Error('quoteState is required');
  const hadSnapshot = Boolean(quoteState.sharedSnapshot);
  quoteState.sharedSnapshot = null;

  const scenarioCount = Array.isArray(quoteState.scenarios) ? quoteState.scenarios.length : 0;
  if (!Array.isArray(quoteState.send)) quoteState.send = [];
  while (quoteState.send.length < scenarioCount) quoteState.send.push(true);
  if (quoteState.send.length > scenarioCount) quoteState.send.splice(scenarioCount);

  if (scenarioCount > 0 && !quoteState.send.some((value) => value !== false)) {
    quoteState.send[0] = true;
  }

  return { changed: hadSnapshot, scenarioCount };
}
