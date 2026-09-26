import { buildShareEnvelopeFromPersistedQuotes } from './share-envelope.js';
import { persistShareEnvelope } from './share-envelope-repository.js';
import { buildCanonicalShareUrl } from './share-migration.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validIso(value, field) {
  const v = String(value ?? '').trim();
  if (!v || !Number.isFinite(Date.parse(v))) {
    throw codedError(`${field} must be an ISO timestamp`, 'CANONICAL_DELIVERY_INVALID');
  }
  return v;
}

/**
 * Integration-only delivery runtime.
 *
 * Input Quotes must already be persisted and accompanied by matching write
 * receipts. The runtime creates one immutable Share Envelope, persists it,
 * and returns the canonical public ?share= URL.
 *
 * UI/customer/staff presentation fields do not enter this boundary.
 */
export async function createCanonicalShareDelivery({
  quotes,
  quoteReceipts,
  envelopeRepository,
  createdAt,
  expiresAt,
  locationLike = globalThis.location,
} = {}) {
  if (!envelopeRepository) {
    throw codedError('Share Envelope repository is required', 'CANONICAL_DELIVERY_REPOSITORY_REQUIRED');
  }

  const created = validIso(createdAt, 'createdAt');
  const expires = validIso(expiresAt, 'expiresAt');
  if (Date.parse(expires) <= Date.parse(created)) {
    throw codedError('expiresAt must be after createdAt', 'CANONICAL_DELIVERY_INVALID');
  }

  const envelope = await buildShareEnvelopeFromPersistedQuotes({
    quotes,
    receipts: quoteReceipts,
    createdAt: created,
    expiresAt: expires,
  });

  const receipt = await persistShareEnvelope(envelopeRepository, envelope);

  const url = buildCanonicalShareUrl({
    envelopeId: envelope.envelopeId,
    envelopeVersion: envelope.envelopeVersion,
    locationLike,
  });

  return Object.freeze({
    contract: 'freepass-canonical-share-delivery/v1',
    envelope,
    receipt,
    url,
    quoteRefs: envelope.quoteRefs,
  });
}
