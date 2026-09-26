import {
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
  shareEnvelopeIdempotencyKey,
} from '../src/lib/quote/share-envelope-repository.js';
import { verifyShareEnvelopeIntegrity } from '../src/lib/quote/share-envelope.js';
import { authorizeEstimateWriteRequest } from './_auth/estimate-write-access.js';

const DEFAULT_COMMAND_PATH = '/v1/commands/freepass-estimate/share-envelopes';

function codedError(message, code, status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalizedUrl(value) {
  return String(value ?? '').trim().replace(/\/$/, '');
}

export function resolveShareEnvelopeWriteConfig(env = process.env) {
  const token = String(env.FREEPASS_DATA_ESTIMATE_TOKEN ?? '').trim();
  const explicitUrl = normalizedUrl(env.FREEPASS_DATA_SHARE_ENVELOPE_COMMAND_URL);
  const baseUrl = normalizedUrl(env.FREEPASS_DATA_CONSUMER_BASE_URL);
  const url = explicitUrl || (baseUrl ? baseUrl + DEFAULT_COMMAND_PATH : '');

  if (!url) throw codedError('Share Envelope command URL is not configured', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  if (!/^https:\/\//i.test(url) && env.NODE_ENV === 'production') {
    throw codedError('Share Envelope command URL must use HTTPS in production', 'SHARE_ENVELOPE_REPOSITORY_CONFIG_INVALID');
  }
  if (token.length < 32) {
    throw codedError('FreePass Data Estimate service token is not configured', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  }
  return Object.freeze({ url, token });
}

function normalizeHeader(value) {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
}

export async function assertShareEnvelopeCommand(body, headerIdempotencyKey = '') {
  if (!body || typeof body !== 'object') {
    throw codedError('Share Envelope command body is required', 'SHARE_ENVELOPE_COMMAND_INVALID', 400);
  }
  if (body.command !== 'PUT_SHARE_ENVELOPE' || body.contract !== SHARE_ENVELOPE_REPOSITORY_CONTRACT) {
    throw codedError('Share Envelope command contract mismatch', 'SHARE_ENVELOPE_COMMAND_INVALID', 400);
  }

  const envelope = await verifyShareEnvelopeIntegrity(body.envelope);
  const expectedKey = shareEnvelopeIdempotencyKey(envelope);
  const bodyKey = String(body.idempotencyKey ?? '').trim();
  const headerKey = normalizeHeader(headerIdempotencyKey);

  if (bodyKey !== expectedKey || headerKey !== expectedKey) {
    throw codedError('Share Envelope idempotency key mismatch', 'SHARE_ENVELOPE_CONFLICT', 409);
  }

  return Object.freeze({ envelope, idempotencyKey: expectedKey });
}

export function assertShareEnvelopeWriteReceipt(body, expected) {
  if (!body || body.contract !== SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT) {
    throw codedError('Share Envelope write receipt contract mismatch', 'SHARE_ENVELOPE_RECEIPT_INVALID', 502);
  }
  if (!['CREATED', 'EXISTING'].includes(body.status)) {
    throw codedError('Share Envelope write status is invalid', 'SHARE_ENVELOPE_WRITE_FAILED', 502);
  }
  if (
    body.envelopeId !== expected.envelope.envelopeId ||
    Number(body.envelopeVersion) !== expected.envelope.envelopeVersion ||
    body.snapshotHash !== expected.envelope.snapshotHash ||
    body.idempotencyKey !== expected.idempotencyKey
  ) {
    throw codedError('Share Envelope write receipt mismatch', 'SHARE_ENVELOPE_CONFLICT', 409);
  }
  return Object.freeze({ ...body });
}

export async function forwardShareEnvelopeCommand({
  body,
  requestIdempotencyKey,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const expected = await assertShareEnvelopeCommand(body, requestIdempotencyKey);
  const config = resolveShareEnvelopeWriteConfig(env);

  let response;
  try {
    response = await fetchImpl(config.url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${config.token}`,
        'idempotency-key': expected.idempotencyKey,
      },
      body: JSON.stringify({
        command: 'PUT_SHARE_ENVELOPE',
        contract: SHARE_ENVELOPE_REPOSITORY_CONTRACT,
        idempotencyKey: expected.idempotencyKey,
        envelope: expected.envelope,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
    });
  } catch (error) {
    throw codedError(error?.message || 'Share Envelope command failed', 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE');
  }

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw codedError(
      responseBody?.error || responseBody?.code || `Share Envelope command response ${response.status}`,
      responseBody?.code || 'SHARE_ENVELOPE_WRITE_FAILED',
      response.status >= 400 && response.status < 600 ? response.status : 502
    );
  }

  return assertShareEnvelopeWriteReceipt(responseBody, expected);
}

function sendError(res, error) {
  const status = Number(error?.status);
  res.status(Number.isInteger(status) && status >= 400 && status <= 599 ? status : 503).json({
    ok: false,
    code: error?.code || 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE',
    error: error?.message || 'Share Envelope repository is unavailable',
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, idempotency-key, authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'POST 만 받습니다' });
    return;
  }

  try {
    await authorizeEstimateWriteRequest(req);
    const receipt = await forwardShareEnvelopeCommand({
      body: req.body,
      requestIdempotencyKey: req.headers?.['idempotency-key'],
    });
    res.status(200).json(receipt);
  } catch (error) {
    sendError(res, error);
  }
}
