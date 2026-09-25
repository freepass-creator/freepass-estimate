function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function required(value, field, code = 'QUOTE_MASTER_IDENTITY_REQUIRED') {
  const v = String(value ?? '').trim();
  if (!v) throw codedError(`${field} is required`, code);
  return v;
}

export const FREEPASS_DATA_AUTHORITY = 'CANONICAL_ACTIVE';

export function sourceRevisionFromFreePassData(meta) {
  if (!meta || meta.authority !== FREEPASS_DATA_AUTHORITY ||
      meta.contract !== 'estimate-newcar-master/v1' ||
      meta.projectionId !== 'estimate-newcar-master' ||
      meta.schemaVersion !== '1.0.0' ||
      !meta.activatedAt || !Number.isFinite(Date.parse(meta.activatedAt))) {
    throw codedError('FreePass Data Estimate Master CANONICAL_ACTIVE release evidence is required', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
  }
  const releaseId = required(meta.releaseId, 'releaseId', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
  const manifestId = required(meta.manifestId, 'manifestId', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
  const revisionNumber = Number(meta.revision);
  if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1) {
    throw codedError('FreePass Data release revision is invalid', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
  }
  const revision = String(revisionNumber);
  const inputDigest = required(meta.inputDigest, 'inputDigest', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
  const dataDigest = required(meta.dataDigest, 'dataDigest', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');

  if (!/^[a-f0-9]{64}$/i.test(inputDigest) || !/^[a-f0-9]{64}$/i.test(dataDigest)) {
    throw codedError('FreePass Data release digests are invalid', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
  }

  return Object.freeze({
    sourceRevision: `freepass-data/${releaseId}@r${revision}`,
    sourceEvidence: Object.freeze({
      authority: FREEPASS_DATA_AUTHORITY,
      releaseId,
      manifestId,
      revision: revisionNumber,
      inputDigest: inputDigest.toLowerCase(),
      dataDigest: dataDigest.toLowerCase(),
      generatedAt: String(meta.generatedAt ?? '').trim() || null,
      activatedAt: String(meta.activatedAt ?? '').trim() || null,
    }),
  });
}

/**
 * Build the stable vehicle identity required by Quote v2.
 *
 * Do not synthesize IDs from labels, sequence numbers or legacy master_id.
 * Those fields may be useful lineage hints, but are not substitutes for
 * FreePass Data stable entity identifiers.
 */
export function masterContextFromCanonical({
  canonical,
  exteriorColor,
  interiorColor,
  releaseMeta,
} = {}) {
  const candidate = canonical?.candidate || canonical;
  if (!candidate || typeof candidate !== 'object') {
    throw codedError('canonical vehicle identity is unresolved', 'QUOTE_MASTER_IDENTITY_REQUIRED');
  }

  const evidence = sourceRevisionFromFreePassData(releaseMeta);
  const context = {
    vehicleModelId: required(candidate.vehicle_model_id ?? candidate.vehicleModelId, 'vehicleModelId'),
    modelYearId: required(candidate.model_year_id ?? candidate.modelYearId, 'modelYearId'),
    trimId: required(candidate.trim_id ?? candidate.trimId, 'trimId'),
    powertrainId: required(candidate.powertrain_id ?? candidate.powertrainId, 'powertrainId'),
    exteriorColorId: required(exteriorColor?.id ?? exteriorColor?.colorId, 'exteriorColorId'),
    interiorColorId: required(interiorColor?.id ?? interiorColor?.colorId, 'interiorColorId'),
    sourceRevision: evidence.sourceRevision,
    sourceEvidence: evidence.sourceEvidence,
  };

  return Object.freeze(context);
}

export function legacyMasterIdentityGap(candidate) {
  if (!candidate || typeof candidate !== 'object') return Object.freeze(['canonicalCandidate']);
  const gaps = [];
  if (!(candidate.vehicle_model_id || candidate.vehicleModelId)) gaps.push('vehicleModelId');
  if (!(candidate.model_year_id || candidate.modelYearId)) gaps.push('modelYearId');
  if (!(candidate.trim_id || candidate.trimId)) gaps.push('trimId');
  if (!(candidate.powertrain_id || candidate.powertrainId)) gaps.push('powertrainId');
  return Object.freeze(gaps);
}


function moneyAmount(value, field) {
  const amount = Number(value?.amount);
  if (!Number.isFinite(amount) || amount < 0 || value?.currency !== 'KRW') {
    throw codedError(`${field} must be non-negative KRW money`, 'QUOTE_MASTER_PRICE_INVALID');
  }
  return amount;
}

function findMasterItem(items, id, idField, field) {
  const wanted = required(id, field);
  const matches = (Array.isArray(items) ? items : []).filter((item) => item?.[idField] === wanted);
  if (matches.length !== 1) {
    throw codedError(`${field} is not uniquely present in FreePass Data master: ${wanted}`, 'QUOTE_MASTER_IDENTITY_REQUIRED');
  }
  return matches[0];
}

export function resolveMasterOptions(record, selectedOptionIds = []) {
  if (!record || typeof record !== 'object') {
    throw codedError('Estimate master record is required', 'QUOTE_MASTER_IDENTITY_REQUIRED');
  }
  const selected = [...new Set((selectedOptionIds || []).map((id) => required(id, 'selectedOptionId')))].sort();
  const optionMap = new Map((record.options || []).map((option) => [option.optionId, option]));

  for (const id of selected) {
    if (!optionMap.has(id)) {
      throw codedError(`selected option is not in FreePass Data master: ${id}`, 'QUOTE_OPTION_UNKNOWN');
    }
  }
  const selectedSet = new Set(selected);
  const groupOwners = new Map();

  for (const id of selected) {
    const option = optionMap.get(id);
    for (const requiredId of option.requires || []) {
      if (!selectedSet.has(requiredId)) {
        throw codedError(`${id} requires ${requiredId}`, 'QUOTE_OPTION_REQUIRES_MISSING');
      }
    }
    for (const excludedId of option.excludes || []) {
      if (selectedSet.has(excludedId)) {
        throw codedError(`${id} excludes ${excludedId}`, 'QUOTE_OPTION_EXCLUDES_CONFLICT');
      }
    }
    if (option.exclusiveGroupId) {
      const prior = groupOwners.get(option.exclusiveGroupId);
      if (prior && prior !== id) {
        throw codedError(`${prior} and ${id} are mutually exclusive`, 'QUOTE_OPTION_EXCLUSIVE_GROUP_CONFLICT');
      }
      groupOwners.set(option.exclusiveGroupId, id);
    }
  }

  return Object.freeze(selected.map((id) => {
    const option = optionMap.get(id);
    return Object.freeze({
      optionId: id,
      name: String(option.name ?? '').trim(),
      price: moneyAmount(option.price, `option ${id} price`),
    });
  }));
}

export function masterContextFromEstimateMasterRecord({
  record,
  selectedOptionIds = [],
  exteriorColorId,
  interiorColorId,
  releaseMeta,
} = {}) {
  if (!record || typeof record !== 'object') {
    throw codedError('Estimate master record is required', 'QUOTE_MASTER_IDENTITY_REQUIRED');
  }
  if (record.status !== 'ACTIVE') {
    const reason = Array.isArray(record.holdReasons) ? record.holdReasons.join(', ') : '';
    throw codedError(
      `Estimate master record is HOLD${reason ? ': ' + reason : ''}`,
      'QUOTE_MASTER_PRODUCT_HOLD'
    );
  }

  required(record.productId, 'productId');
  const modelYear = Number(record.modelYear);
  if (!Number.isSafeInteger(modelYear) || modelYear < 1900 || modelYear > 2200) {
    throw codedError('ACTIVE Estimate master requires a verified modelYear', 'QUOTE_MASTER_MODEL_YEAR_REQUIRED');
  }
  if ((record.options || []).some((option) => !option?.optionId)) {
    throw codedError('ACTIVE Estimate master contains an option without stable ID', 'QUOTE_MASTER_IDENTITY_REQUIRED');
  }
  if ((record.exteriorColors || []).some((color) => !color?.colorId) ||
      (record.interiorColors || []).some((color) => !color?.colorId)) {
    throw codedError('ACTIVE Estimate master contains a color without stable ID', 'QUOTE_MASTER_IDENTITY_REQUIRED');
  }
  const ext = findMasterItem(record.exteriorColors, exteriorColorId, 'colorId', 'exteriorColorId');
  const int = findMasterItem(record.interiorColors, interiorColorId, 'colorId', 'interiorColorId');
  const options = resolveMasterOptions(record, selectedOptionIds);
  const evidence = sourceRevisionFromFreePassData(releaseMeta);

  return Object.freeze({
    vehicleModelId: required(record.vehicleModelId, 'vehicleModelId'),
    modelYearId: required(record.modelYearId, 'modelYearId'),
    trimId: required(record.trimId, 'trimId'),
    powertrainId: required(record.powertrainId, 'powertrainId'),
    exteriorColorId: required(ext.colorId, 'exteriorColorId'),
    interiorColorId: required(int.colorId, 'interiorColorId'),
    sourceRevision: evidence.sourceRevision,
    sourceEvidence: evidence.sourceEvidence,
    quoteSnapshot: Object.freeze({
      productId: record.productId,
      modelYear,
      selectedOptionIds: Object.freeze(options.map((option) => option.optionId)),
      optionPriceSnapshot: options,
      vehiclePriceSnapshot: Object.freeze({
        basePrice: moneyAmount(record.basePrice, 'basePrice'),
        priceBefore: record.priceBefore ? moneyAmount(record.priceBefore, 'priceBefore') : 0,
        priceAfter: record.priceAfter ? moneyAmount(record.priceAfter, 'priceAfter') : 0,
        priceBasis: String(record.priceBasis ?? '').trim(),
        exteriorColorPrice: moneyAmount(ext.price, 'exteriorColorPrice'),
        interiorColorPrice: moneyAmount(int.price, 'interiorColorPrice'),
        exteriorColorName: String(ext.name ?? '').trim(),
        interiorColorName: String(int.name ?? '').trim(),
        currency: 'KRW',
      }),
    }),
  });
}
