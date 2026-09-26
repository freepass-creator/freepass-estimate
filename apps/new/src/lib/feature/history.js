// FreePass Estimate quote lifecycle + local history domain rules.
// Persistence location (localStorage/Firestore/etc.) belongs to the caller/I layer.

export const QUOTE_LIFECYCLE = Object.freeze({
  EMPTY: 'empty',
  CONFIGURING: 'configuring',
  CALCULATING: 'calculating',
  READY: 'ready',
  SHARED: 'shared',
  ERROR: 'error',
});

export function deriveQuoteLifecycle({
  vehicleSelected = false,
  sharedSnapshot = null,
  calculationStatus = null,
  hasReadyTerms = false,
} = {}) {
  if (sharedSnapshot) return QUOTE_LIFECYCLE.SHARED;
  if (!vehicleSelected) return QUOTE_LIFECYCLE.EMPTY;
  if (calculationStatus === 'pending') return QUOTE_LIFECYCLE.CALCULATING;
  if (calculationStatus === 'error') return QUOTE_LIFECYCLE.ERROR;
  if (calculationStatus === 'ok' && hasReadyTerms) return QUOTE_LIFECYCLE.READY;
  return QUOTE_LIFECYCLE.CONFIGURING;
}

function cloneJson(value, fallback = null) {
  try { return JSON.parse(JSON.stringify(value)); }
  catch { return fallback; }
}

export function buildHistorySnapshot(quoteState, {
  id = null,
  now = Date.now(),
} = {}) {
  const vehicle = quoteState?.vehicle;
  const monthly = Array.isArray(quoteState?.monthly) ? quoteState.monthly : [];
  const scenarios = Array.isArray(quoteState?.scenarios) ? quoteState.scenarios : [];
  if (!vehicle?.total_manwon || !monthly.some((item) => item?.monthly != null)) return null;

  return {
    id: id || `${now}_history`,
    ts: now,
    vehicle: {
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      variant: vehicle.variant || '',
      trim_name: vehicle.trim_name || '',
      total_manwon: vehicle.total_manwon,
      fuel: vehicle.fuel || null,
      displacement_cc: vehicle.displacement_cc ?? null,
    },
    cond: {
      credit: quoteState.cond?.credit,
      km: quoteState.cond?.km,
      dep: quoteState.cond?.dep,
      pre: quoteState.cond?.pre,
      svc: quoteState.cond?.svc,
      insProperty: quoteState.cond?.insProperty,
    },
    vehicleFull: cloneJson(vehicle),
    condFull: cloneJson(quoteState.cond, {}),
    scenarios: cloneJson(scenarios, []),
    send: scenarios.map((_scenario, index) => quoteState.send?.[index] !== false),
    monthly: cloneJson(monthly, []),
    quoteProvider: quoteState.quoteProvider || null,
    quoteEngine: quoteState.quoteEngine || null,
    quotePricingEngine: quoteState.quotePricingEngine || null,
  };
}

export function sameHistoryConfiguration(entry, quoteState) {
  const v = quoteState?.vehicle;
  if (!entry?.vehicle || !v) return false;
  const currentScenarios = Array.isArray(quoteState.scenarios) ? quoteState.scenarios : [];
  const entryScenarios = Array.isArray(entry.scenarios) ? entry.scenarios : [];

  return entry.vehicle.brand === v.brand
    && entry.vehicle.model === v.model
    && entry.vehicle.variant === v.variant
    && entry.vehicle.trim_name === v.trim_name
    && entry.vehicle.total_manwon === v.total_manwon
    && JSON.stringify(entryScenarios) === JSON.stringify(currentScenarios)
    && JSON.stringify(entry.send || []) === JSON.stringify(
      currentScenarios.map((_scenario, index) => quoteState.send?.[index] !== false),
    )
    && entry.cond?.credit === quoteState.cond?.credit
    && entry.cond?.km === quoteState.cond?.km
    && entry.cond?.dep === quoteState.cond?.dep
    && entry.cond?.pre === quoteState.cond?.pre;
}

export function restoreHistorySnapshot(entry, quoteState) {
  if (!entry?.vehicleFull?.total_manwon || !quoteState) {
    return { restored: false, reason: 'legacy_or_invalid' };
  }

  quoteState.sharedSnapshot = null;
  quoteState.vehicle = cloneJson(entry.vehicleFull);

  if (entry.condFull) Object.assign(quoteState.cond, cloneJson(entry.condFull, {}));

  if (Array.isArray(entry.scenarios) && entry.scenarios.length) {
    quoteState.scenarios.splice(
      0,
      quoteState.scenarios.length,
      ...cloneJson(entry.scenarios, []),
    );
  }

  const count = quoteState.scenarios.length;
  const restoredSend = Array.isArray(entry.send)
    ? entry.send.slice(0, count).map((value) => value !== false)
    : Array.from({ length: count }, () => true);
  while (restoredSend.length < count) restoredSend.push(true);
  if (count > 0 && !restoredSend.some(Boolean)) restoredSend[0] = true;
  quoteState.send.splice(0, quoteState.send.length, ...restoredSend);

  quoteState.monthly = cloneJson(entry.monthly, []);
  quoteState.referenceMonthly = [];
  quoteState.quoteProvider = entry.quoteProvider || null;
  quoteState.quoteEngine = entry.quoteEngine || null;
  quoteState.quotePricingEngine = entry.quotePricingEngine || null;

  return { restored: true, reason: null };
}
