import { persistCalculatedQuotes } from './persistence-runtime.js';
import { createCanonicalShareDelivery } from './delivery-runtime.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * End-to-end I-01 handoff seam for F/UI:
 * calculation -> immutable Quote v2 persistence -> immutable Share Envelope
 * persistence -> canonical public URL.
 *
 * This module owns no UI rendering and performs no legacy fallback.
 */
export async function createCanonicalQuoteDelivery({
  request,
  calculation,
  vehicle,
  condition,
  quoteRepository,
  envelopeRepository,
  master = null,
  loadMaster,
  createdAt,
  expiresAt,
  locationLike = globalThis.location,
  persistQuotes = persistCalculatedQuotes,
  createShare = createCanonicalShareDelivery,
} = {}) {
  if (typeof persistQuotes !== 'function' || typeof createShare !== 'function') {
    throw codedError('canonical delivery dependencies are invalid', 'CANONICAL_DELIVERY_SESSION_INVALID');
  }
  if (!quoteRepository || !envelopeRepository) {
    throw codedError(
      'canonical Quote and Share Envelope repositories are required',
      'CANONICAL_DELIVERY_SESSION_REPOSITORY_REQUIRED'
    );
  }

  const persisted = await persistQuotes({
    request,
    calculation,
    vehicle,
    condition,
    repository: quoteRepository,
    master,
    ...(loadMaster ? { loadMaster } : {}),
    now: () => createdAt,
  });

  const share = await createShare({
    quotes: persisted.quotes,
    quoteReceipts: persisted.receipts,
    envelopeRepository,
    createdAt,
    expiresAt,
    locationLike,
  });

  return Object.freeze({
    contract: 'freepass-canonical-quote-delivery/v1',
    sourceRevision: persisted.sourceRevision,
    quotes: persisted.quotes,
    quoteReceipts: persisted.receipts,
    envelope: share.envelope,
    envelopeReceipt: share.receipt,
    url: share.url,
  });
}
