// Canonical issued-quote contract for FreePass Estimate.
// This module is intentionally UI/store independent.

export const QUOTE_CONTRACT_V2 = 'freepass-quote/v2';
export const QUOTE_SNAPSHOT_CONTRACT_V2 = 'freepass-quote-snapshot/v2';

function normalizeNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw codedError(`${field} must be finite`, 'QUOTE_V2_INVALID');
  return Object.is(n, -0) ? 0 : n;
}

function requiredString(value, field) {
  const v = String(value ?? '').trim();
  if (!v) throw codedError(`${field} is required`, 'QUOTE_V2_INVALID');
  return v;
}

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function stableValue(value) {
  if (value === undefined) throw codedError('undefined cannot be hashed', 'QUOTE_V2_NON_DETERMINISTIC');
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw codedError('unsupported value cannot be hashed', 'QUOTE_V2_NON_DETERMINISTIC');
  }
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw codedError('non-finite number cannot be hashed', 'QUOTE_V2_NON_DETERMINISTIC');
    return Object.is(value, -0) ? 0 : value;
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    throw codedError('WebCrypto SHA-256 is unavailable', 'QUOTE_V2_HASH_UNAVAILABLE');
  }
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : stableStringify(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeIds(values) {
  return [...new Set((values || []).map((value) => requiredString(value, 'selectedOptionId')))].sort();
}

function priceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw codedError('vehiclePriceSnapshot is required', 'QUOTE_V2_INVALID');
  return stableValue(snapshot);
}

function optionSnapshot(snapshot) {
  if (!Array.isArray(snapshot)) throw codedError('optionPriceSnapshot must be an array', 'QUOTE_V2_INVALID');
  const byId = new Map();
  for (const raw of snapshot) {
    if (!raw || typeof raw !== 'object') throw codedError('optionPriceSnapshot item must be an object', 'QUOTE_V2_INVALID');
    const optionId = requiredString(raw.optionId, 'optionPriceSnapshot.optionId');
    const normalized = stableValue({ ...raw, optionId });
    const previous = byId.get(optionId);
    if (previous && stableStringify(previous) !== stableStringify(normalized)) {
      throw codedError(`conflicting option snapshot: ${optionId}`, 'QUOTE_V2_INVALID');
    }
    byId.set(optionId, normalized);
  }
  return [...byId.values()].sort((a, b) => a.optionId < b.optionId ? -1 : a.optionId > b.optionId ? 1 : 0);
}

export function buildQuoteSnapshotPayload(input) {
  const payload = {
    contract: QUOTE_SNAPSHOT_CONTRACT_V2,
    vehicleModelId: requiredString(input.vehicleModelId, 'vehicleModelId'),
    modelYearId: requiredString(input.modelYearId, 'modelYearId'),
    trimId: requiredString(input.trimId, 'trimId'),
    powertrainId: requiredString(input.powertrainId, 'powertrainId'),
    selectedOptionIds: normalizeIds(input.selectedOptionIds),
    exteriorColorId: requiredString(input.exteriorColorId, 'exteriorColorId'),
    interiorColorId: requiredString(input.interiorColorId, 'interiorColorId'),
    contractTerm: normalizeNumber(input.contractTerm, 'contractTerm'),
    mileageCondition: requiredString(input.mileageCondition, 'mileageCondition'),
    deposit: normalizeNumber(input.deposit ?? 0, 'deposit'),
    prepayment: normalizeNumber(input.prepayment ?? 0, 'prepayment'),
    depositRatePct: normalizeNumber(input.depositRatePct ?? 0, 'depositRatePct'),
    prepaymentRatePct: normalizeNumber(input.prepaymentRatePct ?? 0, 'prepaymentRatePct'),
    vehiclePriceSnapshot: priceSnapshot(input.vehiclePriceSnapshot),
    optionPriceSnapshot: optionSnapshot(input.optionPriceSnapshot),
    totalVehiclePrice: normalizeNumber(input.totalVehiclePrice, 'totalVehiclePrice'),
    monthlyRental: normalizeNumber(input.monthlyRental, 'monthlyRental'),
    pricingEngineVersion: requiredString(input.pricingEngineVersion, 'pricingEngineVersion'),
    sourceRevision: requiredString(input.sourceRevision, 'sourceRevision'),
  };

  if (payload.contractTerm <= 0) throw codedError('contractTerm must be positive', 'QUOTE_V2_INVALID');
  if (payload.deposit < 0 || payload.prepayment < 0 || payload.depositRatePct < 0 || payload.prepaymentRatePct < 0 || payload.totalVehiclePrice < 0 || payload.monthlyRental < 0) {
    throw codedError('money fields cannot be negative', 'QUOTE_V2_INVALID');
  }
  return Object.freeze(payload);
}

export async function sealQuoteSnapshot(input) {
  const payload = buildQuoteSnapshotPayload(input);
  const snapshotHash = await sha256Hex(payload);
  return Object.freeze({ ...payload, snapshotHash });
}

export async function buildIssuedQuote(input, {
  createdAt,
  quoteVersion = 1,
  quoteId = null,
} = {}) {
  const snapshot = await sealQuoteSnapshot(input);
  const version = normalizeNumber(quoteVersion, 'quoteVersion');
  if (!Number.isInteger(version) || version < 1) throw codedError('quoteVersion must be a positive integer', 'QUOTE_V2_INVALID');

  // quoteId defaults to content identity. Reissuing changed content creates a new id;
  // revisions of the same logical quote may explicitly retain quoteId and increment quoteVersion.
  const id = quoteId ? requiredString(quoteId, 'quoteId') : `q_${snapshot.snapshotHash.slice(0, 24)}`;
  const at = requiredString(createdAt, 'createdAt');

  return Object.freeze({
    contract: QUOTE_CONTRACT_V2,
    quoteId: id,
    quoteVersion: version,
    createdAt: at,
    vehicleModelId: snapshot.vehicleModelId,
    modelYearId: snapshot.modelYearId,
    trimId: snapshot.trimId,
    powertrainId: snapshot.powertrainId,
    selectedOptionIds: snapshot.selectedOptionIds,
    exteriorColorId: snapshot.exteriorColorId,
    interiorColorId: snapshot.interiorColorId,
    contractTerm: snapshot.contractTerm,
    mileageCondition: snapshot.mileageCondition,
    deposit: snapshot.deposit,
    prepayment: snapshot.prepayment,
    depositRatePct: snapshot.depositRatePct,
    prepaymentRatePct: snapshot.prepaymentRatePct,
    vehiclePriceSnapshot: snapshot.vehiclePriceSnapshot,
    optionPriceSnapshot: snapshot.optionPriceSnapshot,
    totalVehiclePrice: snapshot.totalVehiclePrice,
    monthlyRental: snapshot.monthlyRental,
    pricingEngineVersion: snapshot.pricingEngineVersion,
    sourceRevision: snapshot.sourceRevision,
    snapshotHash: snapshot.snapshotHash,
  });
}

export function quoteIdempotencyKey(quote) {
  if (quote?.contract !== QUOTE_CONTRACT_V2) throw codedError('quote contract mismatch', 'QUOTE_V2_INVALID');
  return `${quote.quoteId}:v${quote.quoteVersion}:${quote.snapshotHash}`;
}
