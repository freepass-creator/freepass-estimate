import { readIssuedQuote } from './quote-repository.js';
import { readShareEnvelope } from './share-envelope-repository.js';

export const CANONICAL_SHARE_BUNDLE_CONTRACT = 'freepass-canonical-share-bundle/v1';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validNow(value) {
  const v = String(value ?? '').trim();
  if (!v || !Number.isFinite(Date.parse(v))) {
    throw codedError('now must be an ISO timestamp', 'CANONICAL_SHARE_BUNDLE_INVALID');
  }
  return v;
}

function assertQuoteMatchesRef(quote, ref, index) {
  if (!quote) {
    throw codedError(
      `Share Envelope quoteRefs[${index}] was not found`,
      'CANONICAL_SHARE_QUOTE_NOT_FOUND'
    );
  }
  if (
    quote.quoteId !== ref.quoteId ||
    quote.quoteVersion !== ref.quoteVersion ||
    quote.snapshotHash !== ref.snapshotHash
  ) {
    throw codedError(
      `Share Envelope quoteRefs[${index}] does not match canonical Quote`,
      'CANONICAL_SHARE_QUOTE_MISMATCH'
    );
  }
  return quote;
}

/**
 * Resolves one canonical customer-share data bundle:
 * Share Envelope -> ordered immutable Quote v2 records.
 *
 * No UI presentation data is invented here and no legacy reader is consulted.
 */
export async function loadCanonicalShareBundle({
  envelopeRepository,
  quoteRepository,
  envelopeId,
  envelopeVersion = null,
  now = () => new Date().toISOString(),
} = {}) {
  if (!envelopeRepository || !quoteRepository) {
    throw codedError(
      'canonical Share Envelope and Quote repositories are required',
      'CANONICAL_SHARE_BUNDLE_REPOSITORY_REQUIRED'
    );
  }
  if (typeof now !== 'function') {
    throw codedError('clock is unavailable', 'CANONICAL_SHARE_BUNDLE_INVALID');
  }

  const envelope = await readShareEnvelope(envelopeRepository, {
    envelopeId,
    envelopeVersion,
  });

  if (!envelope) {
    return Object.freeze({
      contract: CANONICAL_SHARE_BUNDLE_CONTRACT,
      status: 'NOT_FOUND',
      envelope: null,
      quotes: Object.freeze([]),
    });
  }

  const checkedAt = validNow(now());
  if (Date.parse(envelope.expiresAt) <= Date.parse(checkedAt)) {
    return Object.freeze({
      contract: CANONICAL_SHARE_BUNDLE_CONTRACT,
      status: 'EXPIRED',
      envelope,
      quotes: Object.freeze([]),
      checkedAt,
    });
  }

  const quotes = [];
  for (let index = 0; index < envelope.quoteRefs.length; index += 1) {
    const ref = envelope.quoteRefs[index];
    const quote = await readIssuedQuote(quoteRepository, {
      quoteId: ref.quoteId,
      quoteVersion: ref.quoteVersion,
    });
    quotes.push(assertQuoteMatchesRef(quote, ref, index));
  }

  return Object.freeze({
    contract: CANONICAL_SHARE_BUNDLE_CONTRACT,
    status: 'FOUND',
    envelope,
    quotes: Object.freeze(quotes),
    checkedAt,
  });
}
