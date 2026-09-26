export const QUOTE_CONDITION_COSTS_CONTRACT = 'freepass-quote-condition-costs/v1';
export const QUOTE_CONDITION_COST_POLICY = 'freepass-estimate-condition-costs/2026-09-26';

function codedError(message, code = 'QUOTE_CONDITION_COST_INVALID') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function money(value, field) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw codedError(`${field} must be non-negative finite money`);
  }
  return Math.round(n);
}

function cleanBasis(value = {}) {
  const out = {};
  for (const key of ['delivery', 'tint', 'dashcam', 'navi', 'hipass']) {
    const v = String(value?.[key] ?? '').trim();
    if (v) out[key] = v;
  }
  return Object.freeze(out);
}

export function createQuoteConditionCosts({
  deliveryFee = 0,
  tintFee = 0,
  dashcamFee = 0,
  naviFee = 0,
  hipassFee = 0,
  basis = {},
  policyId = QUOTE_CONDITION_COST_POLICY,
} = {}) {
  const delivery = money(deliveryFee, 'deliveryFee');
  const tint = money(tintFee, 'tintFee');
  const dashcam = money(dashcamFee, 'dashcamFee');
  const navi = money(naviFee, 'naviFee');
  const hipass = money(hipassFee, 'hipassFee');
  const accessoryFee = dashcam + navi + hipass;
  const totalPrepFee = delivery + tint + accessoryFee;
  const policy = String(policyId ?? '').trim();
  if (!policy) throw codedError('condition cost policyId is required');

  return Object.freeze({
    contract: QUOTE_CONDITION_COSTS_CONTRACT,
    policyId: policy,
    deliveryFee: delivery,
    tintFee: tint,
    dashcamFee: dashcam,
    naviFee: navi,
    hipassFee: hipass,
    accessoryFee,
    totalPrepFee,
    basis: cleanBasis(basis),
  });
}

export function assertQuoteConditionCosts(value) {
  if (!value || value.contract !== QUOTE_CONDITION_COSTS_CONTRACT) {
    throw codedError('canonical Quote condition costs are required');
  }
  const normalized = createQuoteConditionCosts(value);
  if (Number(value.accessoryFee) !== normalized.accessoryFee) {
    throw codedError('condition accessoryFee mismatch');
  }
  if (Number(value.totalPrepFee) !== normalized.totalPrepFee) {
    throw codedError('condition totalPrepFee mismatch');
  }
  return normalized;
}

export function conditionCostsFromRequest(request) {
  const cond = request?.조건 || {};
  const costs = assertQuoteConditionCosts(cond.비용);

  const aliases = {
    탁송비: costs.deliveryFee,
    썬팅비: costs.tintFee,
    블박비: costs.dashcamFee,
    내비비: costs.naviFee,
    하이패스비: costs.hipassFee,
  };
  for (const [field, expected] of Object.entries(aliases)) {
    const actual = Number(cond[field] ?? 0);
    if (!Number.isFinite(actual) || Math.round(actual) !== expected) {
      throw codedError(`condition alias mismatch: ${field}`);
    }
  }
  return costs;
}
