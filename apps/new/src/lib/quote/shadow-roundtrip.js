import {
  persistIssuedQuote,
  readIssuedQuote,
} from './quote-repository.js';
import {
  persistShareEnvelope,
  readShareEnvelope,
} from './share-envelope-repository.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function verifiedAt(now, label) {
  const value = String(now() ?? '').trim();
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw codedError(`${label} verification timestamp is invalid`, 'SHADOW_EVIDENCE_INVALID');
  }
  return value;
}

/**
 * Executes one canonical write/read shadow round-trip for an already-issued
 * immutable Quote v2. This function never touches legacy storage.
 */
export async function verifyQuoteShadowRoundTrip({
  repository,
  quote,
  now = () => new Date().toISOString(),
} = {}) {
  if (!repository) {
    throw codedError('canonical quote repository is required', 'QUOTE_SHADOW_REPOSITORY_REQUIRED');
  }
  if (!quote || quote.contract !== 'freepass-quote/v2') {
    throw codedError('issued Quote v2 is required', 'QUOTE_SHADOW_QUOTE_REQUIRED');
  }
  if (typeof now !== 'function') {
    throw codedError('clock is unavailable', 'QUOTE_SHADOW_INVALID');
  }

  const writeReceipt = await persistIssuedQuote(repository, quote);
  const writeVerifiedAt = verifiedAt(now, 'Quote write');

  const loaded = await readIssuedQuote(repository, {
    quoteId: quote.quoteId,
    quoteVersion: quote.quoteVersion,
  });
  const readVerifiedAt = verifiedAt(now, 'Quote read');

  if (!loaded) {
    throw codedError('canonical quote was not readable after write', 'QUOTE_SHADOW_ROUNDTRIP_FAILED');
  }
  if (
    loaded.quoteId !== quote.quoteId ||
    loaded.quoteVersion !== quote.quoteVersion ||
    loaded.snapshotHash !== quote.snapshotHash
  ) {
    throw codedError('canonical quote changed during write/read round-trip', 'QUOTE_SHADOW_ROUNDTRIP_FAILED');
  }

  return Object.freeze({
    quoteId: quote.quoteId,
    quoteVersion: quote.quoteVersion,
    snapshotHash: quote.snapshotHash,
    writeProbe: Object.freeze({
      verified: true,
      verifiedAt: writeVerifiedAt,
      receipt: writeReceipt,
    }),
    readProbe: Object.freeze({
      verified: true,
      verifiedAt: readVerifiedAt,
      receipt: Object.freeze({
        contract: 'freepass-quote-read-receipt/v1',
        status: 'FOUND',
        quoteId: loaded.quoteId,
        quoteVersion: loaded.quoteVersion,
        snapshotHash: loaded.snapshotHash,
        quote: loaded,
      }),
    }),
  });
}

/**
 * Executes one canonical Share Envelope write/read shadow round-trip.
 *
 * The envelope must already contain immutable Quote v2 references.
 * No legacy store is consulted on failure or NOT_FOUND.
 */
export async function verifyShareEnvelopeShadowRoundTrip({
  repository,
  envelope,
  now = () => new Date().toISOString(),
} = {}) {
  if (!repository) {
    throw codedError('canonical Share Envelope repository is required', 'SHARE_ENVELOPE_SHADOW_REPOSITORY_REQUIRED');
  }
  if (!envelope || envelope.contract !== 'freepass-share-envelope/v1') {
    throw codedError('Share Envelope v1 is required', 'SHARE_ENVELOPE_SHADOW_REQUIRED');
  }
  if (typeof now !== 'function') {
    throw codedError('clock is unavailable', 'SHARE_ENVELOPE_SHADOW_INVALID');
  }

  const writeReceipt = await persistShareEnvelope(repository, envelope);
  const writeVerifiedAt = verifiedAt(now, 'Share Envelope write');

  const loaded = await readShareEnvelope(repository, {
    envelopeId: envelope.envelopeId,
    envelopeVersion: envelope.envelopeVersion,
  });
  const readVerifiedAt = verifiedAt(now, 'Share Envelope read');

  if (!loaded) {
    throw codedError(
      'canonical Share Envelope was not readable after write',
      'SHARE_ENVELOPE_SHADOW_ROUNDTRIP_FAILED'
    );
  }
  if (
    loaded.envelopeId !== envelope.envelopeId ||
    loaded.envelopeVersion !== envelope.envelopeVersion ||
    loaded.snapshotHash !== envelope.snapshotHash
  ) {
    throw codedError(
      'canonical Share Envelope changed during write/read round-trip',
      'SHARE_ENVELOPE_SHADOW_ROUNDTRIP_FAILED'
    );
  }

  return Object.freeze({
    envelopeId: envelope.envelopeId,
    envelopeVersion: envelope.envelopeVersion,
    snapshotHash: envelope.snapshotHash,
    writeProbe: Object.freeze({
      verified: true,
      verifiedAt: writeVerifiedAt,
      receipt: writeReceipt,
    }),
    readProbe: Object.freeze({
      verified: true,
      verifiedAt: readVerifiedAt,
      receipt: Object.freeze({
        contract: 'freepass-share-envelope-read-receipt/v1',
        status: 'FOUND',
        envelopeId: loaded.envelopeId,
        envelopeVersion: loaded.envelopeVersion,
        snapshotHash: loaded.snapshotHash,
        envelope: loaded,
      }),
    }),
  });
}
