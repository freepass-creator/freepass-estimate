import {
  QUOTE_REPOSITORY_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from '../quote-repository.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Browser-side QuoteRepository adapter.
 *
 * The default endpoint is the same-origin Estimate gateway. Browser code must
 * never receive the FreePass Data service token or know Firestore paths.
 * authToken, when supplied, is only a caller/session token for the Estimate
 * gateway; it must never be FREEPASS_DATA_ESTIMATE_TOKEN.
 */
export function createFreePassDataQuoteRepository({
  endpoint = '/api/issued-quotes',
  fetchImpl = globalThis.fetch,
  authToken = null,
} = {}) {
  const url = String(endpoint ?? '').trim();
  if (!url) throw codedError('FreePass Data quote command endpoint is not configured', 'QUOTE_REPOSITORY_UNAVAILABLE');
  if (typeof fetchImpl !== 'function') throw codedError('fetch is unavailable', 'QUOTE_REPOSITORY_UNAVAILABLE');

  return Object.freeze({
    contract: QUOTE_REPOSITORY_CONTRACT,
    async put({ quote, idempotencyKey }) {
      const headers = {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      };
      if (authToken) headers.authorization = `Bearer ${authToken}`;

      let response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            command: 'PUT_ISSUED_QUOTE',
            contract: QUOTE_REPOSITORY_CONTRACT,
            idempotencyKey,
            quote,
          }),
        });
      } catch (error) {
        throw codedError(error?.message || 'quote repository request failed', 'QUOTE_REPOSITORY_UNAVAILABLE');
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = codedError(body?.error || `quote repository response ${response.status}`, body?.code || 'QUOTE_REPOSITORY_WRITE_FAILED');
        error.status = response.status;
        throw error;
      }
      if (body?.contract !== QUOTE_WRITE_RECEIPT_CONTRACT) {
        throw codedError('quote repository receipt contract mismatch', 'QUOTE_REPOSITORY_RECEIPT_INVALID');
      }
      return body;
    },
  });
}
