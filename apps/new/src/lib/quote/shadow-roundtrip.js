import {
  persistIssuedQuote,
  readIssuedQuote,
} from './quote-repository.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Executes one canonical write/read shadow round-trip for an already-issued
 * immutable Quote v2. This function never touches legacy storage.
 *
 * The returned evidence is shaped for evaluateQuoteCutoverReadiness().
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
  const writeVerifiedAt = String(now() ?? '').trim();
  if (!writeVerifiedAt || !Number.isFinite(Date.parse(writeVerifiedAt))) {
    throw codedError('write verification timestamp is invalid', 'QUOTE_SHADOW_INVALID');
  }

  const loaded = await readIssuedQuote(repository, {
    quoteId: quote.quoteId,
    quoteVersion: quote.quoteVersion,
  });
  const readVerifiedAt = String(now() ?? '').trim();
  if (!readVerifiedAt || !Number.isFinite(Date.parse(readVerifiedAt))) {
    throw codedError('read verification timestamp is invalid', 'QUOTE_SHADOW_INVALID');
  }
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
