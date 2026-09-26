// Canonical issued-quote contract for FreePass Estimate.
// This module is intentionally UI/store independent.

export const QUOTE_CONTRACT_V2 = 'freepass-quote/v2';
export const QUOTE_SNAPSHOT_CONTRACT_V2 = 'freepass-quote-snapshot/v2';
export const QUOTE_REVISION_CONTRACT_V1 = 'freepass-quote-revision/v1';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw codedError(`${field} must be finite`, 'QUOTE_V2_INVALID');
  return Object.is(n, -0) ? 0 : n;
}

function nonNegativeNumber(value, field) {
  const n = normalizeNumber(value ?? 0, field);
  if (n < 0) throw codedError(`${field} cannot be negative`, 'QUOTE_V2_INVALID');
  return n;
}

function requiredString(value, field) {
  const v = String(value ?? '').trim();
  if (!v) throw codedError(`${field} is required`, 'QUOTE_V2_INVALID');
  return v;
}

function optionalString(value) {
  const v = String(value ?? '').trim();
  return v || null;
}

function positiveInteger(value, field) {
  const n = normalizeNumber(value, field);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw codedError(`${field} must be a positive integer`, 'QUOTE_V2_INVALID');
  }
  return n;
}

function sha256String(value, field) {
  const v = requiredString(value, field).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(v)) throw codedError(`${field} must be SHA-256 hex`, 'QUOTE_V2_INVALID');
  return v;
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

function conditionSnapshot(value, fallbackMileage) {
  if (!value || typeof value !== 'object') {
    throw codedError('conditionSnapshot is required', 'QUOTE_V2_INVALID');
  }
  const feeRatePct = normalizeNumber(value.feeRatePct, 'conditionSnapshot.feeRatePct');
  if (feeRatePct < -10 || feeRatePct > 7 || Math.abs(feeRatePct * 10 - Math.round(feeRatePct * 10)) > 1e-8) {
    throw codedError('conditionSnapshot.feeRatePct must be -10..7 in 0.1 steps', 'QUOTE_V2_INVALID');
  }

  const costs = value.costs;
  if (!costs || typeof costs !== 'object') {
    throw codedError('conditionSnapshot.costs is required', 'QUOTE_V2_INVALID');
  }
  const normalizedCosts = {
    deliveryFee: nonNegativeNumber(costs.deliveryFee ?? 0, 'conditionSnapshot.costs.deliveryFee'),
    tintFee: nonNegativeNumber(costs.tintFee ?? 0, 'conditionSnapshot.costs.tintFee'),
    dashcamFee: nonNegativeNumber(costs.dashcamFee ?? 0, 'conditionSnapshot.costs.dashcamFee'),
    naviFee: nonNegativeNumber(costs.naviFee ?? 0, 'conditionSnapshot.costs.naviFee'),
    hipassFee: nonNegativeNumber(costs.hipassFee ?? 0, 'conditionSnapshot.costs.hipassFee'),
  };
  const expectedTotal = Object.values(normalizedCosts).reduce((sum, amount) => sum + amount, 0);
  if (costs.totalPrepFee != null && normalizeNumber(costs.totalPrepFee, 'conditionSnapshot.costs.totalPrepFee') !== expectedTotal) {
    throw codedError('conditionSnapshot.costs.totalPrepFee mismatch', 'QUOTE_V2_INVALID');
  }

  const mileageCondition = requiredString(value.mileageCondition ?? fallbackMileage, 'conditionSnapshot.mileageCondition');
  return Object.freeze({
    credit: requiredString(value.credit, 'conditionSnapshot.credit'),
    mileageCondition,
    maintenance: requiredString(value.maintenance, 'conditionSnapshot.maintenance'),
    liability: requiredString(value.liability, 'conditionSnapshot.liability'),
    extraDriver: requiredString(value.extraDriver, 'conditionSnapshot.extraDriver'),
    feeRatePct,
    costs: Object.freeze({
      ...normalizedCosts,
      totalPrepFee: expectedTotal,
    }),
  });
}

function calculationProvenance(value, fallbackVersion) {
  if (!value || typeof value !== 'object') {
    throw codedError('calculationProvenance is required', 'QUOTE_V2_INVALID');
  }
  if (value.verified !== true) {
    throw codedError('issued Quote requires verified calculation provenance', 'QUOTE_PRICING_ENGINE_UNVERIFIED');
  }

  const engineVersion = requiredString(value.engineVersion ?? fallbackVersion, 'calculationProvenance.engineVersion');
  const provenance = {
    providerKey: requiredString(value.providerKey, 'calculationProvenance.providerKey'),
    engineId: requiredString(value.engineId, 'calculationProvenance.engineId'),
    engineVersion,
    evidence: requiredString(value.evidence, 'calculationProvenance.evidence'),
    verified: true,
  };

  for (const [key, raw] of [
    ['sourceDigest', value.sourceDigest],
    ['policyDigest', value.policyDigest],
    ['upstreamVersion', value.upstreamVersion],
  ]) {
    const normalized = optionalString(raw);
    if (normalized) provenance[key] = normalized;
  }
  return Object.freeze(provenance);
}

export function buildQuoteSnapshotPayload(input) {
  const conditions = conditionSnapshot(input.conditionSnapshot, input.mileageCondition);
  const provenance = calculationProvenance(input.calculationProvenance, input.pricingEngineVersion);

  if (input.mileageCondition != null &&
      requiredString(input.mileageCondition, 'mileageCondition') !== conditions.mileageCondition) {
    throw codedError('mileageCondition does not match conditionSnapshot', 'QUOTE_V2_INVALID');
  }
  if (input.pricingEngineVersion != null &&
      requiredString(input.pricingEngineVersion, 'pricingEngineVersion') !== provenance.engineVersion) {
    throw codedError('pricingEngineVersion does not match calculationProvenance', 'QUOTE_V2_INVALID');
  }

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
    mileageCondition: conditions.mileageCondition,
    conditionSnapshot: conditions,
    deposit: nonNegativeNumber(input.deposit ?? 0, 'deposit'),
    prepayment: nonNegativeNumber(input.prepayment ?? 0, 'prepayment'),
    depositRatePct: nonNegativeNumber(input.depositRatePct ?? 0, 'depositRatePct'),
    prepaymentRatePct: nonNegativeNumber(input.prepaymentRatePct ?? 0, 'prepaymentRatePct'),
    vehiclePriceSnapshot: priceSnapshot(input.vehiclePriceSnapshot),
    optionPriceSnapshot: optionSnapshot(input.optionPriceSnapshot),
    totalVehiclePrice: nonNegativeNumber(input.totalVehiclePrice, 'totalVehiclePrice'),
    monthlyRental: nonNegativeNumber(input.monthlyRental, 'monthlyRental'),
    pricingEngineVersion: provenance.engineVersion,
    calculationProvenance: provenance,
    sourceRevision: requiredString(input.sourceRevision, 'sourceRevision'),
  };

  if (payload.contractTerm <= 0) throw codedError('contractTerm must be positive', 'QUOTE_V2_INVALID');
  if (payload.depositRatePct > 30 || payload.prepaymentRatePct > 30) {
    throw codedError('deposit/prepayment rate must be 0..30', 'QUOTE_V2_INVALID');
  }
  return Object.freeze(payload);
}

export async function sealQuoteSnapshot(input) {
  const payload = buildQuoteSnapshotPayload(input);
  const snapshotHash = await sha256Hex(payload);
  return Object.freeze({ ...payload, snapshotHash });
}

function issuedFromSnapshot(snapshot, {
  quoteId,
  quoteVersion,
  createdAt,
  revision = null,
  revisionHash = null,
} = {}) {
  return Object.freeze({
    contract: QUOTE_CONTRACT_V2,
    quoteId,
    quoteVersion,
    createdAt,
    vehicleModelId: snapshot.vehicleModelId,
    modelYearId: snapshot.modelYearId,
    trimId: snapshot.trimId,
    powertrainId: snapshot.powertrainId,
    selectedOptionIds: snapshot.selectedOptionIds,
    exteriorColorId: snapshot.exteriorColorId,
    interiorColorId: snapshot.interiorColorId,
    contractTerm: snapshot.contractTerm,
    mileageCondition: snapshot.mileageCondition,
    conditionSnapshot: snapshot.conditionSnapshot,
    deposit: snapshot.deposit,
    prepayment: snapshot.prepayment,
    depositRatePct: snapshot.depositRatePct,
    prepaymentRatePct: snapshot.prepaymentRatePct,
    vehiclePriceSnapshot: snapshot.vehiclePriceSnapshot,
    optionPriceSnapshot: snapshot.optionPriceSnapshot,
    totalVehiclePrice: snapshot.totalVehiclePrice,
    monthlyRental: snapshot.monthlyRental,
    pricingEngineVersion: snapshot.pricingEngineVersion,
    calculationProvenance: snapshot.calculationProvenance,
    sourceRevision: snapshot.sourceRevision,
    snapshotHash: snapshot.snapshotHash,
    revision,
    revisionHash,
  });
}

export async function buildIssuedQuote(input, {
  createdAt,
  quoteVersion = 1,
  quoteId = null,
} = {}) {
  if (quoteId != null || Number(quoteVersion) !== 1) {
    throw codedError(
      'explicit quoteId/version requires reviseIssuedQuote',
      'QUOTE_REVISION_EXPLICIT_API_REQUIRED'
    );
  }
  const snapshot = await sealQuoteSnapshot(input);
  const at = requiredString(createdAt, 'createdAt');
  return issuedFromSnapshot(snapshot, {
    quoteId: `q_${snapshot.snapshotHash.slice(0, 24)}`,
    quoteVersion: 1,
    createdAt: at,
  });
}

function snapshotInputFromQuote(quote) {
  return {
    vehicleModelId: quote.vehicleModelId,
    modelYearId: quote.modelYearId,
    trimId: quote.trimId,
    powertrainId: quote.powertrainId,
    selectedOptionIds: quote.selectedOptionIds,
    exteriorColorId: quote.exteriorColorId,
    interiorColorId: quote.interiorColorId,
    contractTerm: quote.contractTerm,
    mileageCondition: quote.mileageCondition,
    conditionSnapshot: quote.conditionSnapshot,
    deposit: quote.deposit,
    prepayment: quote.prepayment,
    depositRatePct: quote.depositRatePct,
    prepaymentRatePct: quote.prepaymentRatePct,
    vehiclePriceSnapshot: quote.vehiclePriceSnapshot,
    optionPriceSnapshot: quote.optionPriceSnapshot,
    totalVehiclePrice: quote.totalVehiclePrice,
    monthlyRental: quote.monthlyRental,
    pricingEngineVersion: quote.pricingEngineVersion,
    calculationProvenance: quote.calculationProvenance,
    sourceRevision: quote.sourceRevision,
  };
}

export async function verifyIssuedQuoteIntegrity(quote) {
  if (!quote || quote.contract !== QUOTE_CONTRACT_V2) {
    throw codedError('Quote v2 is required', 'QUOTE_V2_INVALID');
  }
  const version = positiveInteger(quote.quoteVersion, 'quoteVersion');
  requiredString(quote.quoteId, 'quoteId');
  requiredString(quote.createdAt, 'createdAt');
  const snapshot = await sealQuoteSnapshot(snapshotInputFromQuote(quote));
  if (snapshot.snapshotHash !== sha256String(quote.snapshotHash, 'snapshotHash')) {
    throw codedError('Quote snapshotHash does not match content', 'QUOTE_V2_INTEGRITY_MISMATCH');
  }

  if (version === 1) {
    const expectedId = `q_${snapshot.snapshotHash.slice(0, 24)}`;
    if (quote.quoteId !== expectedId) {
      throw codedError('initial Quote id must be content-derived', 'QUOTE_V2_INTEGRITY_MISMATCH');
    }
    if (quote.revision != null || quote.revisionHash != null) {
      throw codedError('initial Quote cannot contain revision lineage', 'QUOTE_REVISION_INVALID');
    }
  } else {
    if (!quote.revision || quote.revision.contract !== QUOTE_REVISION_CONTRACT_V1) {
      throw codedError('revision lineage is required for quoteVersion > 1', 'QUOTE_REVISION_INVALID');
    }
    if (positiveInteger(quote.revision.previousQuoteVersion, 'revision.previousQuoteVersion') !== version - 1) {
      throw codedError('revision must reference the immediately previous version', 'QUOTE_REVISION_INVALID');
    }
    sha256String(quote.revision.previousSnapshotHash, 'revision.previousSnapshotHash');
    if (quote.revision.previousRevisionHash != null) {
      sha256String(quote.revision.previousRevisionHash, 'revision.previousRevisionHash');
    }
    const actualRevisionHash = sha256String(quote.revisionHash, 'revisionHash');
    const expectedRevisionHash = await sha256Hex({
      contract: QUOTE_REVISION_CONTRACT_V1,
      quoteId: quote.quoteId,
      quoteVersion: version,
      snapshotHash: snapshot.snapshotHash,
      revision: quote.revision,
    });
    if (actualRevisionHash !== expectedRevisionHash) {
      throw codedError('Quote revisionHash does not match lineage', 'QUOTE_REVISION_INVALID');
    }
  }
  return Object.freeze({ ...quote });
}

export async function reviseIssuedQuote({
  previousQuote,
  nextSnapshotInput,
  createdAt,
} = {}) {
  const previous = await verifyIssuedQuoteIntegrity(previousQuote);
  const nextSnapshot = await sealQuoteSnapshot(nextSnapshotInput);
  const nextVersion = previous.quoteVersion + 1;
  const revision = Object.freeze({
    contract: QUOTE_REVISION_CONTRACT_V1,
    previousQuoteVersion: previous.quoteVersion,
    previousSnapshotHash: previous.snapshotHash,
    ...(previous.revisionHash ? { previousRevisionHash: previous.revisionHash } : {}),
  });
  const revisionHash = await sha256Hex({
    contract: QUOTE_REVISION_CONTRACT_V1,
    quoteId: previous.quoteId,
    quoteVersion: nextVersion,
    snapshotHash: nextSnapshot.snapshotHash,
    revision,
  });

  return issuedFromSnapshot(nextSnapshot, {
    quoteId: previous.quoteId,
    quoteVersion: nextVersion,
    createdAt: requiredString(createdAt, 'createdAt'),
    revision,
    revisionHash,
  });
}

export async function verifyQuoteRevision(previousQuote, nextQuote) {
  const previous = await verifyIssuedQuoteIntegrity(previousQuote);
  const next = await verifyIssuedQuoteIntegrity(nextQuote);
  if (next.quoteId !== previous.quoteId ||
      next.quoteVersion !== previous.quoteVersion + 1 ||
      next.revision?.previousQuoteVersion !== previous.quoteVersion ||
      next.revision?.previousSnapshotHash !== previous.snapshotHash ||
      (previous.revisionHash || null) !== (next.revision?.previousRevisionHash || null)) {
    throw codedError('Quote revision lineage mismatch', 'QUOTE_REVISION_INVALID');
  }
  const expectedRevisionHash = await sha256Hex({
    contract: QUOTE_REVISION_CONTRACT_V1,
    quoteId: next.quoteId,
    quoteVersion: next.quoteVersion,
    snapshotHash: next.snapshotHash,
    revision: next.revision,
  });
  if (expectedRevisionHash !== next.revisionHash) {
    throw codedError('Quote revisionHash mismatch', 'QUOTE_REVISION_INVALID');
  }
  return next;
}

export function quoteIdempotencyKey(quote) {
  if (quote?.contract !== QUOTE_CONTRACT_V2) throw codedError('quote contract mismatch', 'QUOTE_V2_INVALID');
  const version = positiveInteger(quote.quoteVersion, 'quoteVersion');
  const id = requiredString(quote.quoteId, 'quoteId');
  const hash = sha256String(quote.snapshotHash, 'snapshotHash');
  return `${id}:v${version}:${hash}`;
}
