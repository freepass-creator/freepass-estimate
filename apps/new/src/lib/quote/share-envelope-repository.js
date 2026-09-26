import {
  SHARE_ENVELOPE_CONTRACT,
  assertShareEnvelope,
  verifyShareEnvelopeIntegrity,
} from './share-envelope.js';

export const SHARE_ENVELOPE_REPOSITORY_CONTRACT = 'freepass-share-envelope-repository/v1';
export const SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT = 'freepass-share-envelope-write-receipt/v1';
export const SHARE_ENVELOPE_READ_RECEIPT_CONTRACT = 'freepass-share-envelope-read-receipt/v1';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function required(value, field) {
  const v = String(value ?? '').trim();
  if (!v) throw codedError(`${field} is required`, 'SHARE_ENVELOPE_QUERY_INVALID');
  return v;
}

export function shareEnvelopeIdempotencyKey(envelope) {
  assertShareEnvelope(envelope);
  return `${envelope.envelopeId}:v${envelope.envelopeVersion}:${envelope.snapshotHash}`;
}

export function assertShareEnvelopeWriter(repository) {
  if (!repository || repository.contract !== SHARE_ENVELOPE_REPOSITORY_CONTRACT || typeof repository.put !== 'function') {
    throw codedError('Share Envelope repository is unavailable', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  }
  return repository;
}

export function assertShareEnvelopeReader(repository) {
  if (!repository || repository.contract !== SHARE_ENVELOPE_REPOSITORY_CONTRACT || typeof repository.get !== 'function') {
    throw codedError('Share Envelope reader is unavailable', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  }
  return repository;
}

export async function persistShareEnvelope(repository, envelope) {
  const repo = assertShareEnvelopeWriter(repository);
  const value = await verifyShareEnvelopeIntegrity(envelope);
  const idempotencyKey = shareEnvelopeIdempotencyKey(value);
  const receipt = await repo.put({ envelope: value, idempotencyKey });

  if (!receipt || receipt.contract !== SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT) {
    throw codedError('Share Envelope write receipt contract mismatch', 'SHARE_ENVELOPE_RECEIPT_INVALID');
  }
  if (!['CREATED', 'EXISTING'].includes(receipt.status)) {
    throw codedError('Share Envelope persistence was not confirmed', 'SHARE_ENVELOPE_WRITE_FAILED');
  }
  if (
    receipt.envelopeId !== value.envelopeId ||
    Number(receipt.envelopeVersion) !== value.envelopeVersion ||
    receipt.snapshotHash !== value.snapshotHash ||
    receipt.idempotencyKey !== idempotencyKey
  ) {
    throw codedError('Share Envelope receipt does not match payload', 'SHARE_ENVELOPE_CONFLICT');
  }

  return Object.freeze({ ...receipt });
}

export async function readShareEnvelope(repository, {
  envelopeId,
  envelopeVersion = null,
} = {}) {
  const repo = assertShareEnvelopeReader(repository);
  const id = required(envelopeId, 'envelopeId');
  const version = envelopeVersion == null ? null : Number(envelopeVersion);
  if (version != null && (!Number.isSafeInteger(version) || version < 1)) {
    throw codedError('envelopeVersion must be a positive integer', 'SHARE_ENVELOPE_QUERY_INVALID');
  }

  const receipt = await repo.get({ envelopeId: id, envelopeVersion: version });

  if (!receipt || receipt.contract !== SHARE_ENVELOPE_READ_RECEIPT_CONTRACT) {
    throw codedError('Share Envelope read receipt contract mismatch', 'SHARE_ENVELOPE_RECEIPT_INVALID');
  }
  if (!['FOUND', 'NOT_FOUND'].includes(receipt.status)) {
    throw codedError('Share Envelope read receipt status is invalid', 'SHARE_ENVELOPE_RECEIPT_INVALID');
  }
  if (receipt.envelopeId !== id) {
    throw codedError('Share Envelope read identity mismatch', 'SHARE_ENVELOPE_CONFLICT');
  }
  if (receipt.status === 'NOT_FOUND') return null;

  const envelope = await verifyShareEnvelopeIntegrity(receipt.envelope);
  if (
    envelope.contract !== SHARE_ENVELOPE_CONTRACT ||
    envelope.envelopeId !== id ||
    Number(receipt.envelopeVersion) !== envelope.envelopeVersion ||
    receipt.snapshotHash !== envelope.snapshotHash
  ) {
    throw codedError('Share Envelope read payload mismatch', 'SHARE_ENVELOPE_CONFLICT');
  }
  if (version != null && envelope.envelopeVersion !== version) {
    throw codedError('Share Envelope version mismatch', 'SHARE_ENVELOPE_CONFLICT');
  }

  return Object.freeze({ ...envelope });
}
