import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';
import { verifyShareEnvelopeIntegrity } from '../src/lib/quote/share-envelope.js';

const DEFAULT_READ_PATH = '/v1/consumers/freepass-estimate/share-envelopes';

function codedError(message, code, status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalizedUrl(value) {
  return String(value ?? '').trim().replace(/\/$/, '');
}

function required(value, field) {
  const v = String(value ?? '').trim();
  if (!v) throw codedError(`${field} is required`, 'SHARE_ENVELOPE_QUERY_INVALID', 400);
  return v;
}

function version(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw codedError('envelopeVersion must be a positive integer', 'SHARE_ENVELOPE_QUERY_INVALID', 400);
  }
  return n;
}

export function resolveShareEnvelopeReadConfig(env = process.env) {
  const token = String(env.FREEPASS_DATA_ESTIMATE_TOKEN ?? '').trim();
  const explicitUrl = normalizedUrl(env.FREEPASS_DATA_SHARE_ENVELOPE_READ_BASE_URL);
  const baseUrl = normalizedUrl(env.FREEPASS_DATA_CONSUMER_BASE_URL);
  const url = explicitUrl || (baseUrl ? baseUrl + DEFAULT_READ_PATH : '');

  if (!url) throw codedError('Share Envelope read URL is not configured', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  if (!/^https:\/\//i.test(url) && env.NODE_ENV === 'production') {
    throw codedError('Share Envelope read URL must use HTTPS in production', 'SHARE_ENVELOPE_REPOSITORY_CONFIG_INVALID');
  }
  if (token.length < 32) {
    throw codedError('FreePass Data Estimate service token is not configured', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  }
  return Object.freeze({ url, token });
}

export async function assertShareEnvelopeReadReceipt(body, {
  envelopeId,
  envelopeVersion = null,
} = {}) {
  const id = required(envelopeId, 'envelopeId');
  const requestedVersion = version(envelopeVersion);

  if (!body || body.contract !== SHARE_ENVELOPE_READ_RECEIPT_CONTRACT) {
    throw codedError('Share Envelope read receipt contract mismatch', 'SHARE_ENVELOPE_RECEIPT_INVALID', 502);
  }
  if (!['FOUND', 'NOT_FOUND'].includes(body.status)) {
    throw codedError('Share Envelope read status is invalid', 'SHARE_ENVELOPE_RECEIPT_INVALID', 502);
  }
  if (body.envelopeId !== id) {
    throw codedError('Share Envelope read identity mismatch', 'SHARE_ENVELOPE_CONFLICT', 409);
  }
  if (body.status === 'NOT_FOUND') {
    return Object.freeze({
      contract: SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
      status: 'NOT_FOUND',
      envelopeId: id,
      envelopeVersion: requestedVersion,
    });
  }

  const envelope = await verifyShareEnvelopeIntegrity(body.envelope);
  if (
    envelope.envelopeId !== id ||
    Number(body.envelopeVersion) !== envelope.envelopeVersion ||
    body.snapshotHash !== envelope.snapshotHash
  ) {
    throw codedError('Share Envelope read payload mismatch', 'SHARE_ENVELOPE_CONFLICT', 409);
  }
  if (requestedVersion != null && requestedVersion !== envelope.envelopeVersion) {
    throw codedError('Share Envelope read version mismatch', 'SHARE_ENVELOPE_CONFLICT', 409);
  }

  return Object.freeze({
    contract: SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
    status: 'FOUND',
    envelopeId: id,
    envelopeVersion: envelope.envelopeVersion,
    snapshotHash: envelope.snapshotHash,
    envelope,
  });
}

export async function fetchShareEnvelopeReceipt({
  envelopeId,
  envelopeVersion = null,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const id = required(envelopeId, 'envelopeId');
  const requestedVersion = version(envelopeVersion);
  const config = resolveShareEnvelopeReadConfig(env);
  const url = new URL(config.url + '/' + encodeURIComponent(id));
  if (requestedVersion != null) url.searchParams.set('envelopeVersion', String(requestedVersion));

  let response;
  try {
    response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${config.token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
    });
  } catch (error) {
    throw codedError(error?.message || 'Share Envelope read failed', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  }

  const body = await response.json().catch(() => null);
  if (response.status === 404) {
    return Object.freeze({
      contract: SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
      status: 'NOT_FOUND',
      envelopeId: id,
      envelopeVersion: requestedVersion,
    });
  }
  if (!response.ok) {
    throw codedError(
      body?.error || body?.code || `Share Envelope read response ${response.status}`,
      body?.code || 'SHARE_ENVELOPE_READ_FAILED',
      response.status >= 400 && response.status < 600 ? response.status : 502
    );
  }

  return assertShareEnvelopeReadReceipt(body, {
    envelopeId: id,
    envelopeVersion: requestedVersion,
  });
}

function sendError(res, error) {
  const status = Number(error?.status);
  res.status(Number.isInteger(status) && status >= 400 && status <= 599 ? status : 503).json({
    ok: false,
    code: error?.code || 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE',
    error: error?.message || 'Share Envelope reader is unavailable',
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'GET 만 받습니다' });
    return;
  }

  try {
    const receipt = await fetchShareEnvelopeReceipt({
      envelopeId: req.query?.envelopeId,
      envelopeVersion: req.query?.envelopeVersion,
    });
    res.status(200).json(receipt);
  } catch (error) {
    sendError(res, error);
  }
}
