export const ESTIMATE_NEWCAR_MASTER_CONTRACT = 'estimate-newcar-master/v1';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function required(value, field) {
  const v = String(value ?? '').trim();
  if (!v) throw codedError(`${field} is required`, 'ESTIMATE_MASTER_INVALID');
  return v;
}

function validDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

export function normalizeEstimateMasterResponse(body) {
  if (!body || body.ok !== true || !Array.isArray(body.data) || !body.data.length) {
    throw codedError('Estimate master payload is unavailable', body?.code || 'ESTIMATE_MASTER_UNAVAILABLE');
  }
  const meta = body.meta || {};
  if (meta.contract !== ESTIMATE_NEWCAR_MASTER_CONTRACT || meta.authority !== 'CANONICAL_ACTIVE') {
    throw codedError('Estimate master release authority is invalid', 'ESTIMATE_MASTER_EVIDENCE_INVALID');
  }
  if (!required(meta.releaseId, 'releaseId') ||
      !required(meta.manifestId, 'manifestId') ||
      !Number.isInteger(Number(meta.revision)) ||
      !validDigest(meta.inputDigest) ||
      !validDigest(meta.dataDigest)) {
    throw codedError('Estimate master release evidence is incomplete', 'ESTIMATE_MASTER_EVIDENCE_INVALID');
  }

  const byProductId = new Map();
  for (const raw of body.data) {
    if (!raw || typeof raw !== 'object') throw codedError('Estimate master record is invalid', 'ESTIMATE_MASTER_INVALID');
    const productId = required(raw.productId, 'productId');
    if (byProductId.has(productId)) throw codedError(`duplicate Estimate master productId: ${productId}`, 'ESTIMATE_MASTER_INVALID');
    for (const field of ['vehicleModelId', 'modelYearId', 'trimId', 'powertrainId']) required(raw[field], field);
    if (!Number.isInteger(Number(raw.modelYear))) throw codedError('modelYear must be an integer', 'ESTIMATE_MASTER_INVALID');
    if (!Array.isArray(raw.options) || !Array.isArray(raw.exteriorColors) || !Array.isArray(raw.interiorColors)) {
      throw codedError('Estimate master option/color arrays are required', 'ESTIMATE_MASTER_INVALID');
    }
    byProductId.set(productId, Object.freeze({ ...raw }));
  }

  return Object.freeze({
    records: Object.freeze([...byProductId.values()]),
    byProductId,
    meta: Object.freeze({ ...meta }),
  });
}

export async function loadEstimateNewcarMaster({
  fetchImpl = globalThis.fetch,
  endpoint = '/api/freepass-data-master',
} = {}) {
  if (typeof fetchImpl !== 'function') throw codedError('fetch is unavailable', 'ESTIMATE_MASTER_UNAVAILABLE');

  let response;
  try {
    response = await fetchImpl(endpoint, { method: 'GET', headers: { accept: 'application/json' }, cache: 'no-store' });
  } catch (error) {
    throw codedError(error?.message || 'Estimate master request failed', 'ESTIMATE_MASTER_UNAVAILABLE');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw codedError(body?.error || body?.code || `Estimate master response ${response.status}`, body?.code || 'ESTIMATE_MASTER_UNAVAILABLE');
  }
  return normalizeEstimateMasterResponse(body);
}

export function getActiveEstimateMasterRecord(master, productId) {
  const id = required(productId, 'productId');
  const record = master?.byProductId?.get?.(id);
  if (!record) throw codedError(`Estimate master product not found: ${id}`, 'ESTIMATE_MASTER_PRODUCT_NOT_FOUND');
  if (record.status !== 'ACTIVE') {
    const reason = Array.isArray(record.holdReasons) ? record.holdReasons.join(', ') : '';
    throw codedError(`Estimate master product is HOLD${reason ? ': ' + reason : ''}`, 'ESTIMATE_MASTER_PRODUCT_HOLD');
  }
  return record;
}
