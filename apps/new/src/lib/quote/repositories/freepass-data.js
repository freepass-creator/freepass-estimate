import {
  QUOTE_REPOSITORY_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
  QUOTE_READ_RECEIPT_CONTRACT,
} from '../quote-repository.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Browser-side QuoteRepository adapter.
 *
 * Write and read both terminate at same-origin Estimate gateways. Browser code
 * never receives the FreePass Data service token or knows Firestore paths.
 */
export function createFreePassDataQuoteRepository({
  endpoint = '/api/issued-quotes',
  readEndpoint = '/api/issued-quote',
  fetchImpl = globalThis.fetch,
  authToken = null,
} = {}) {
  const writeUrl = String(endpoint ?? '').trim();
  const readUrl = String(readEndpoint ?? '').trim();
  if (!writeUrl) throw codedError('FreePass Data quote command endpoint is not configured', 'QUOTE_REPOSITORY_UNAVAILABLE');
  if (!readUrl) throw codedError('FreePass Data quote read endpoint is not configured', 'QUOTE_REPOSITORY_UNAVAILABLE');
  if (typeof fetchImpl !== 'function') throw codedError('fetch is unavailable', 'QUOTE_REPOSITORY_UNAVAILABLE');

  const authHeaders = () => authToken ? { authorization: `Bearer ${authToken}` } : {};

  return Object.freeze({
    contract: QUOTE_REPOSITORY_CONTRACT,
    async put({ quote, idempotencyKey }) {
      const headers = {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        ...authHeaders(),
      };

      let response;
      try {
        response = await fetchImpl(writeUrl, {
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

    async get({ quoteId, quoteVersion = null }) {
      const params = new URLSearchParams({ quoteId: String(quoteId ?? '') });
      if (quoteVersion != null) params.set('quoteVersion', String(quoteVersion));

      let response;
      try {
        response = await fetchImpl(`${readUrl}?${params.toString()}`, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            ...authHeaders(),
          },
          cache: 'no-store',
        });
      } catch (error) {
        throw codedError(error?.message || 'quote reader request failed', 'QUOTE_REPOSITORY_UNAVAILABLE');
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = codedError(body?.error || `quote reader response ${response.status}`, body?.code || 'QUOTE_REPOSITORY_READ_FAILED');
        error.status = response.status;
        throw error;
      }
      if (body?.contract !== QUOTE_READ_RECEIPT_CONTRACT) {
        throw codedError('quote reader receipt contract mismatch', 'QUOTE_REPOSITORY_RECEIPT_INVALID');
      }
      return body;
    },
  });
}
