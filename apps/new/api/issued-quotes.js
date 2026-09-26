import {
  QUOTE_REPOSITORY_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
  assertIssuedQuote,
} from '../src/lib/quote/quote-repository.js';
import { quoteIdempotencyKey } from '../src/lib/quote/quote-v2.js';

const DEFAULT_COMMAND_PATH = '/v1/commands/freepass-estimate/issued-quotes';

function codedError(message, code, status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalizedUrl(value) {
  return String(value ?? '').trim().replace(/\/$/, '');
}

export function resolveQuotePersistenceConfig(env = process.env) {
  const token = String(env.FREEPASS_DATA_ESTIMATE_TOKEN ?? '').trim();
  const explicitUrl = normalizedUrl(env.FREEPASS_DATA_QUOTE_COMMAND_URL);
  const baseUrl = normalizedUrl(env.FREEPASS_DATA_CONSUMER_BASE_URL);
  const url = explicitUrl || (baseUrl ? baseUrl + DEFAULT_COMMAND_PATH : '');

  if (!url) {
    throw codedError(
      'FreePass Data quote command URL is not configured',
      'QUOTE_REPOSITORY_UNAVAILABLE'
    );
  }
  if (!/^https:\/\//i.test(url) && env.NODE_ENV === 'production') {
    throw codedError(
      'FreePass Data quote command URL must use HTTPS in production',
      'QUOTE_REPOSITORY_CONFIG_INVALID'
    );
  }
  if (token.length < 32) {
    throw codedError(
      'FreePass Data Estimate service token is not configured',
      'QUOTE_REPOSITORY_UNAVAILABLE'
    );
  }

  return Object.freeze({ url, token });
}

function normalizeHeader(value) {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
}

export function assertQuotePersistenceCommand(body, requestIdempotencyKey = '') {
  if (!body || typeof body !== 'object') {
    throw codedError('quote command body is required', 'QUOTE_REPOSITORY_COMMAND_INVALID', 400);
  }
  if (body.command !== 'PUT_ISSUED_QUOTE' || body.contract !== QUOTE_REPOSITORY_CONTRACT) {
    throw codedError('quote command contract mismatch', 'QUOTE_REPOSITORY_COMMAND_INVALID', 400);
  }

  const quote = assertIssuedQuote(body.quote);
  const expectedKey = quoteIdempotencyKey(quote);
  const bodyKey = String(body.idempotencyKey ?? '').trim();
  const headerKey = normalizeHeader(requestIdempotencyKey);

  if (!bodyKey || bodyKey !== expectedKey) {
    throw codedError('quote command idempotency key mismatch', 'QUOTE_REPOSITORY_CONFLICT', 409);
  }
  if (!headerKey || headerKey !== expectedKey) {
    throw codedError('idempotency-key header mismatch', 'QUOTE_REPOSITORY_CONFLICT', 409);
  }

  return Object.freeze({ quote, idempotencyKey: expectedKey });
}

export function assertQuotePersistenceReceipt(body, expected) {
  if (!body || body.contract !== QUOTE_WRITE_RECEIPT_CONTRACT) {
    throw codedError('quote repository receipt contract mismatch', 'QUOTE_REPOSITORY_RECEIPT_INVALID', 502);
  }
  if (!['CREATED', 'EXISTING'].includes(body.status)) {
    throw codedError('quote repository did not confirm persistence', 'QUOTE_REPOSITORY_WRITE_FAILED', 502);
  }
  if (
    body.quoteId !== expected.quote.quoteId ||
    Number(body.quoteVersion) !== expected.quote.quoteVersion ||
    body.snapshotHash !== expected.quote.snapshotHash ||
    body.idempotencyKey !== expected.idempotencyKey
  ) {
    throw codedError('quote repository receipt does not match issued quote', 'QUOTE_REPOSITORY_CONFLICT', 409);
  }
  return Object.freeze({ ...body });
}

export async function forwardIssuedQuoteCommand({
  body,
  requestIdempotencyKey,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const expected = assertQuotePersistenceCommand(body, requestIdempotencyKey);
  const config = resolveQuotePersistenceConfig(env);

  if (typeof fetchImpl !== 'function') {
    throw codedError('fetch is unavailable', 'QUOTE_REPOSITORY_UNAVAILABLE');
  }

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
        command: 'PUT_ISSUED_QUOTE',
        contract: QUOTE_REPOSITORY_CONTRACT,
        idempotencyKey: expected.idempotencyKey,
        quote: expected.quote,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
    });
  } catch (error) {
    throw codedError(
      error?.message || 'FreePass Data quote command request failed',
      'QUOTE_REPOSITORY_UNAVAILABLE'
    );
  }

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw codedError(
      responseBody?.error || responseBody?.code || `FreePass Data quote command response ${response.status}`,
      responseBody?.code || 'QUOTE_REPOSITORY_WRITE_FAILED',
      response.status >= 400 && response.status < 600 ? response.status : 502
    );
  }

  return assertQuotePersistenceReceipt(responseBody, expected);
}

function sendError(res, error) {
  const status = Number(error?.status);
  res.status(Number.isInteger(status) && status >= 400 && status <= 599 ? status : 503).json({
    ok: false,
    code: error?.code || 'QUOTE_REPOSITORY_UNAVAILABLE',
    error: error?.message || 'Quote repository is unavailable',
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, idempotency-key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'POST 만 받습니다' });
    return;
  }

  try {
    const receipt = await forwardIssuedQuoteCommand({
      body: req.body,
      requestIdempotencyKey: req.headers?.['idempotency-key'],
    });
    res.status(200).json(receipt);
  } catch (error) {
    sendError(res, error);
  }
}
