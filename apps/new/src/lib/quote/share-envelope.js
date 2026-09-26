import { sha256Hex } from './quote-v2.js';

export const SHARE_ENVELOPE_CONTRACT = 'freepass-share-envelope/v1';
export const SHARE_ENVELOPE_SNAPSHOT_CONTRACT = 'freepass-share-envelope-snapshot/v1';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requiredString(value, field) {
  const v = String(value ?? '').trim();
  if (!v) throw codedError(`${field} is required`, 'SHARE_ENVELOPE_INVALID');
  return v;
}

function positiveInteger(value, field) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw codedError(`${field} must be a positive integer`, 'SHARE_ENVELOPE_INVALID');
  }
  return n;
}

function iso(value, field) {
  const v = requiredString(value, field);
  if (!Number.isFinite(Date.parse(v))) {
    throw codedError(`${field} must be an ISO timestamp`, 'SHARE_ENVELOPE_INVALID');
  }
  return v;
}

function quoteRef(value, index) {
  if (!value || typeof value !== 'object') {
    throw codedError(`quoteRefs[${index}] is invalid`, 'SHARE_ENVELOPE_INVALID');
  }
  const quoteId = requiredString(value.quoteId, `quoteRefs[${index}].quoteId`);
  const quoteVersion = positiveInteger(value.quoteVersion, `quoteRefs[${index}].quoteVersion`);
  const snapshotHash = requiredString(value.snapshotHash, `quoteRefs[${index}].snapshotHash`).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(snapshotHash)) {
    throw codedError(`quoteRefs[${index}].snapshotHash is invalid`, 'SHARE_ENVELOPE_INVALID');
  }
  return Object.freeze({ quoteId, quoteVersion, snapshotHash });
}

export function normalizeShareEnvelopeQuoteRefs(values) {
  if (!Array.isArray(values) || !values.length) {
    throw codedError('at least one Quote v2 reference is required', 'SHARE_ENVELOPE_INVALID');
  }
  const out = [];
  const ids = new Set();

  values.forEach((value, index) => {
    const ref = quoteRef(value, index);
    if (ids.has(ref.quoteId)) {
      throw codedError(`duplicate quoteId in Share Envelope: ${ref.quoteId}`, 'SHARE_ENVELOPE_INVALID');
    }
    ids.add(ref.quoteId);
    out.push(ref);
  });

  return Object.freeze(out);
}

export function buildShareEnvelopeSnapshot({
  quoteRefs,
  expiresAt,
} = {}) {
  return Object.freeze({
    contract: SHARE_ENVELOPE_SNAPSHOT_CONTRACT,
    quoteRefs: normalizeShareEnvelopeQuoteRefs(quoteRefs),
    expiresAt: iso(expiresAt, 'expiresAt'),
  });
}

export async function buildShareEnvelope({
  quoteRefs,
  createdAt,
  expiresAt,
  envelopeVersion = 1,
  envelopeId = null,
} = {}) {
  const created = iso(createdAt, 'createdAt');
  const expires = iso(expiresAt, 'expiresAt');
  if (Date.parse(expires) <= Date.parse(created)) {
    throw codedError('expiresAt must be after createdAt', 'SHARE_ENVELOPE_INVALID');
  }

  const snapshot = buildShareEnvelopeSnapshot({ quoteRefs, expiresAt: expires });
  const snapshotHash = await sha256Hex(snapshot);
  const version = positiveInteger(envelopeVersion, 'envelopeVersion');
  const id = envelopeId
    ? requiredString(envelopeId, 'envelopeId')
    : `se_${snapshotHash.slice(0, 24)}`;

  return Object.freeze({
    contract: SHARE_ENVELOPE_CONTRACT,
    envelopeId: id,
    envelopeVersion: version,
    createdAt: created,
    expiresAt: snapshot.expiresAt,
    quoteRefs: snapshot.quoteRefs,
    snapshotHash,
  });
}

export function assertShareEnvelope(envelope) {
  if (!envelope || envelope.contract !== SHARE_ENVELOPE_CONTRACT) {
    throw codedError('Share Envelope v1 is required', 'SHARE_ENVELOPE_INVALID');
  }
  requiredString(envelope.envelopeId, 'envelopeId');
  positiveInteger(envelope.envelopeVersion, 'envelopeVersion');
  iso(envelope.createdAt, 'createdAt');
  iso(envelope.expiresAt, 'expiresAt');
  normalizeShareEnvelopeQuoteRefs(envelope.quoteRefs);
  const hash = requiredString(envelope.snapshotHash, 'snapshotHash').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw codedError('snapshotHash is invalid', 'SHARE_ENVELOPE_INVALID');
  }
  return envelope;
}


export async function verifyShareEnvelopeIntegrity(envelope) {
  const value = assertShareEnvelope(envelope);
  const snapshot = buildShareEnvelopeSnapshot({
    quoteRefs: value.quoteRefs,
    expiresAt: value.expiresAt,
  });
  const expectedHash = await sha256Hex(snapshot);
  if (expectedHash !== value.snapshotHash) {
    throw codedError('Share Envelope snapshotHash does not match content', 'SHARE_ENVELOPE_INTEGRITY_MISMATCH');
  }
  return value;
}
