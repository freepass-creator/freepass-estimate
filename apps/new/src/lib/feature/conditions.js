// FreePass Estimate feature/domain rules for contract conditions.
// UI surfaces consume these helpers; calculation remains owned by E.

import { QUOTE_TERMS } from '../quote/terms.js';

export const CONDITION_LIMITS = Object.freeze({
  dep: Object.freeze({ min: 0, max: 30 }),
  pre: Object.freeze({ min: 0, max: 30 }),
  feeRatePct: Object.freeze({ min: -10, max: 7, step: 0.1 }),
});

export const CREDIT_OPTIONS = Object.freeze([
  Object.freeze({ value: '고신용', label: '고신용' }),
  Object.freeze({ value: '중신용', label: '중신용' }),
  Object.freeze({ value: '저신용', label: '저신용' }),
]);

export const KM_OPTIONS = Object.freeze([1, 2, 3, 4]);

const CREDIT_VALUES = new Set(CREDIT_OPTIONS.map((item) => item.value));
const TERM_ORDER = new Map(QUOTE_TERMS.map((term, index) => [term, index]));

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizePercent(key, value) {
  const rule = CONDITION_LIMITS[key];
  if (!rule || (key !== 'dep' && key !== 'pre')) {
    throw new Error(`unsupported percent condition: ${key}`);
  }
  return clamp(finiteNumber(value, 0), rule.min, rule.max);
}

export function normalizeFeeRate(value) {
  const rule = CONDITION_LIMITS.feeRatePct;
  const rounded = Math.round(finiteNumber(value, 0) / rule.step) * rule.step;
  return clamp(Number(rounded.toFixed(1)), rule.min, rule.max);
}

export function normalizeCredit(value, fallback = '중신용') {
  return CREDIT_VALUES.has(value) ? value : fallback;
}

export function normalizeKm(value, fallback = 2) {
  const n = finiteNumber(value, fallback);
  return KM_OPTIONS.includes(n) ? n : fallback;
}

export function applyScenarioPercent(quoteState, key, rawValue) {
  if (!quoteState?.cond) throw new Error('quoteState.cond is required');
  const value = normalizePercent(key, rawValue);
  quoteState.cond[key] = value;
  for (const scenario of quoteState.scenarios || []) scenario[key] = value;
  return value;
}

export function toggleQuoteTerm(quoteState, term) {
  if (!quoteState?.cond) throw new Error('quoteState.cond is required');
  if (!QUOTE_TERMS.includes(term)) return false;

  if (!Array.isArray(quoteState.scenarios)) quoteState.scenarios = [];
  const list = quoteState.scenarios;
  const index = list.findIndex((scenario) => scenario.term === term);

  if (index >= 0) {
    if (list.length <= 1) return false;
    list.splice(index, 1);
  } else {
    list.push({
      term,
      dep: normalizePercent('dep', quoteState.cond.dep ?? 0),
      pre: normalizePercent('pre', quoteState.cond.pre ?? 0),
    });
  }

  list.sort((a, b) => (TERM_ORDER.get(a.term) ?? 999) - (TERM_ORDER.get(b.term) ?? 999));

  if (!Array.isArray(quoteState.send)) quoteState.send = [];
  while (quoteState.send.length < list.length) quoteState.send.push(true);
  if (quoteState.send.length > list.length) quoteState.send.splice(list.length);

  return true;
}
