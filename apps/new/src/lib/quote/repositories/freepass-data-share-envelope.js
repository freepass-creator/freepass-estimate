import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
} from '../share-envelope-repository.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createFreePassDataShareEnvelopeRepository({
  endpoint = '/api/share-envelopes',
  readEndpoint = '/api/share-envelope',
  fetchImpl = globalThis.fetch,
  authToken = null,
  authTokenProvider = null,
} = {}) {
  const writeUrl = String(endpoint ?? '').trim();
  const readUrl = String(readEndpoint ?? '').trim();
  if (!writeUrl || !readUrl) {
    throw codedError('Share Envelope gateway endpoint is not configured', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  }
  if (typeof fetchImpl !== 'function') {
    throw codedError('fetch is unavailable', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  }

  const authHeaders = async () => {
    const supplied = String(authToken ?? '').trim();
    const token = supplied || (typeof authTokenProvider === 'function'
      ? String(await authTokenProvider() ?? '').trim()
      : '');
    return token ? { authorization: `Bearer ${token}` } : {};
  };

  return Object.freeze({
    contract: SHARE_ENVELOPE_REPOSITORY_CONTRACT,

    async put({ envelope, idempotencyKey }) {
      let response;
      try {
        response = await fetchImpl(writeUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': idempotencyKey,
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            command: 'PUT_SHARE_ENVELOPE',
            contract: SHARE_ENVELOPE_REPOSITORY_CONTRACT,
            idempotencyKey,
            envelope,
          }),
        });
      } catch (error) {
        throw codedError(error?.message || 'Share Envelope write request failed', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = codedError(body?.error || `Share Envelope write response ${response.status}`, body?.code || 'SHARE_ENVELOPE_WRITE_FAILED');
        error.status = response.status;
        throw error;
      }
      if (body?.contract !== SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT) {
        throw codedError('Share Envelope write receipt contract mismatch', 'SHARE_ENVELOPE_RECEIPT_INVALID');
      }
      return body;
    },

    async get({ envelopeId, envelopeVersion = null }) {
      const params = new URLSearchParams({ envelopeId: String(envelopeId ?? '') });
      if (envelopeVersion != null) params.set('envelopeVersion', String(envelopeVersion));

      let response;
      try {
        response = await fetchImpl(`${readUrl}?${params.toString()}`, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            ...(await authHeaders()),
          },
          cache: 'no-store',
        });
      } catch (error) {
        throw codedError(error?.message || 'Share Envelope read request failed', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = codedError(body?.error || `Share Envelope read response ${response.status}`, body?.code || 'SHARE_ENVELOPE_READ_FAILED');
        error.status = response.status;
        throw error;
      }
      if (body?.contract !== SHARE_ENVELOPE_READ_RECEIPT_CONTRACT) {
        throw codedError('Share Envelope read receipt contract mismatch', 'SHARE_ENVELOPE_RECEIPT_INVALID');
      }
      return body;
    },
  });
}
