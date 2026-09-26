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
  if (!vehicleSelected) {
    return { ready: false, reason: 'vehicle_required', source: null, terms: [] };
  }

  const sharedTerms = selectedSharedQuoteTerms(quoteState?.sharedSnapshot);
  if (quoteState?.sharedSnapshot) {
    if (!sharedTerms.length) {
      return { ready: false, reason: 'shared_terms_required', source: 'shared', terms: [] };
    }
    return { ready: true, reason: null, source: 'shared', terms: sharedTerms };
  }

  if (calculationStatus && calculationStatus !== 'ok') {
    return {
      ready: false,
      reason: calculationStatus === 'pending' ? 'calculation_pending' : 'calculation_required',
      source: 'live',
      terms: [],
    };
  }

  const terms = surface === 'desktop'
    ? selectedDesktopQuoteTerms(quoteState)
    : selectedLiveQuoteTerms(quoteState, calculationResults);

  if (!terms.length) {
    return { ready: false, reason: 'included_result_required', source: 'live', terms: [] };
  }

  return { ready: true, reason: null, source: 'live', terms };
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
