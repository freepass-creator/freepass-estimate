import { FLAT_DELIVERY, TINT_PRICES, ACCESSORIES } from '../../data/lookups.js';
import { 탁송, 썬팅들, 블박들 } from '../welrix-rates.js';
import { createQuoteConditionCosts } from './condition-cost-contract.js';

function codedError(message, code = 'QUOTE_CONDITION_COST_UNRESOLVED') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value) {
  return String(value ?? '').trim();
}

function money(value, field) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw codedError(`${field} must resolve to non-negative money`, 'QUOTE_CONDITION_COST_INVALID');
  }
  return Math.round(n);
}

function selectedAreas(value) {
  if (value instanceof Set) return [...value];
  if (Array.isArray(value)) return [...value];
  return [];
}

export function resolveDeliveryCost({ deliveryRegion = '', deliveryCity = '' } = {}) {
  const region = text(deliveryRegion);
  const city = text(deliveryCity);

  // FreePass fine-grained city catalog is the canonical first choice.
  if (city && Object.prototype.hasOwnProperty.call(FLAT_DELIVERY, city)) {
    return Object.freeze({ amount: money(FLAT_DELIVERY[city], 'deliveryFee'), basis: `FREEPASS_CITY:${city}` });
  }

  // Coarse provider-era region labels are compatibility inputs only.
  if (city && Object.prototype.hasOwnProperty.call(탁송, city)) {
    return Object.freeze({ amount: money(탁송[city], 'deliveryFee'), basis: `COMPAT_REGION:${city}` });
  }
  if (region && Object.prototype.hasOwnProperty.call(FLAT_DELIVERY, region)) {
    return Object.freeze({ amount: money(FLAT_DELIVERY[region], 'deliveryFee'), basis: `FREEPASS_CITY:${region}` });
  }
  if (region && Object.prototype.hasOwnProperty.call(탁송, region)) {
    return Object.freeze({ amount: money(탁송[region], 'deliveryFee'), basis: `COMPAT_REGION:${region}` });
  }

  if (!region && !city) return Object.freeze({ amount: 0, basis: 'NONE' });
  throw codedError(`delivery selection is not priced: ${region}/${city}`);
}

export function resolveTintCost({ product = '', areas = [] } = {}) {
  const name = text(product);
  if (!name || name === '없음') return Object.freeze({ amount: 0, basis: 'NONE' });

  const compat = 썬팅들.find((item) => item.name === name);
  if (compat) {
    return Object.freeze({ amount: money(compat.price, 'tintFee'), basis: `COMPAT_FIXED:${name}` });
  }

  const table = TINT_PRICES[name];
  if (!table) throw codedError(`tint selection is not priced: ${name}`);

  const keys = [...new Set(selectedAreas(areas).map(text).filter(Boolean))].sort();
  let total = 0;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(table, key)) {
      throw codedError(`tint area is not priced: ${name}/${key}`);
    }
    total += money(table[key], `tintFee.${key}`);
  }
  return Object.freeze({
    amount: money(total, 'tintFee'),
    basis: `FREEPASS_AREAS:${name}:${keys.join(',') || 'none'}`,
  });
}

function fixedCompat(items, name) {
  return items.find((item) => item.name === name)?.price;
}

export function resolveAccessoryCost(kind, selection) {
  const name = text(selection);
  if (!name || name === '미설치' || name === '없음') {
    return Object.freeze({ amount: 0, basis: 'NONE' });
  }

  if (kind === 'blackbox') {
    const compat = fixedCompat(블박들, name);
    if (compat != null) {
      return Object.freeze({ amount: money(compat, 'dashcamFee'), basis: `COMPAT_FIXED:${name}` });
    }
  }

  const table = ACCESSORIES[kind];
  if (!table || !Object.prototype.hasOwnProperty.call(table, name)) {
    throw codedError(`${kind} selection is not priced: ${name}`);
  }
  return Object.freeze({ amount: money(table[name], kind), basis: `FREEPASS_ACCESSORY:${kind}:${name}` });
}

export function resolveQuoteConditionCosts(state) {
  const cond = state?.cond || {};
  const tint = state?.tint || {};
  const extras = state?.extras || {};

  const delivery = resolveDeliveryCost({
    deliveryRegion: cond.deliveryRegion,
    deliveryCity: cond.deliveryCity,
  });
  const tintCost = resolveTintCost({ product: tint.product, areas: tint.areas });
  const dashcam = resolveAccessoryCost('blackbox', extras.blackbox);
  const navi = resolveAccessoryCost('navi', extras.navi);
  const hipass = resolveAccessoryCost('hipass', extras.hipass);

  const accessoryFee = dashcam.amount + navi.amount + hipass.amount;
  const totalPrepFee = delivery.amount + tintCost.amount + accessoryFee;

  return createQuoteConditionCosts({
    deliveryFee: delivery.amount,
    tintFee: tintCost.amount,
    dashcamFee: dashcam.amount,
    naviFee: navi.amount,
    hipassFee: hipass.amount,
    basis: {
      delivery: delivery.basis,
      tint: tintCost.basis,
      dashcam: dashcam.basis,
      navi: navi.basis,
      hipass: hipass.basis,
    },
  });
}
