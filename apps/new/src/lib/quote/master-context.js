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
  if (!meta || meta.authority !== FREEPASS_DATA_AUTHORITY) {
    throw codedError('FreePass Data CANONICAL_ACTIVE release evidence is required', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
  }
  const releaseId = required(meta.releaseId, 'releaseId', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
  const manifestId = required(meta.manifestId, 'manifestId', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
  const revision = required(meta.revision, 'revision', 'QUOTE_MASTER_SOURCE_EVIDENCE_REQUIRED');
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
      revision,
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
