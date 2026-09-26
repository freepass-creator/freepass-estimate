import {
  QUOTE_READ_RECEIPT_CONTRACT,
  assertIssuedQuote,
} from '../src/lib/quote/quote-repository.js';

const DEFAULT_READ_PATH = '/v1/consumers/freepass-estimate/issued-quotes';

function codedError(message, code, status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalizedUrl(value) {
  return String(value ?? '').trim().replace(/\/$/, '');
}

function requiredQuoteId(value) {
  const id = String(value ?? '').trim();
  if (!id) throw codedError('quoteId is required', 'QUOTE_REPOSITORY_QUERY_INVALID', 400);
  return id;
}

function normalizedVersion(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw codedError('quoteVersion must be a positive integer', 'QUOTE_REPOSITORY_QUERY_INVALID', 400);
  }
  return n;
}

export function resolveQuoteReadConfig(env = process.env) {
  const token = String(env.FREEPASS_DATA_ESTIMATE_TOKEN ?? '').trim();
  const explicitUrl = normalizedUrl(env.FREEPASS_DATA_QUOTE_READ_BASE_URL);
  const baseUrl = normalizedUrl(env.FREEPASS_DATA_CONSUMER_BASE_URL);
  const url = explicitUrl || (baseUrl ? baseUrl + DEFAULT_READ_PATH : '');

  if (!url) {
    throw codedError('FreePass Data quote read URL is not configured', 'QUOTE_REPOSITORY_UNAVAILABLE');
  }
  if (!/^https:\/\//i.test(url) && env.NODE_ENV === 'production') {
    throw codedError('FreePass Data quote read URL must use HTTPS in production', 'QUOTE_REPOSITORY_CONFIG_INVALID');
  }
  if (token.length < 32) {
    throw codedError('FreePass Data Estimate service token is not configured', 'QUOTE_REPOSITORY_UNAVAILABLE');
  }
  return Object.freeze({ url, token });
}

export function assertQuoteReadReceipt(body, {
  quoteId,
  quoteVersion = null,
} = {}) {
  const id = requiredQuoteId(quoteId);
  const version = normalizedVersion(quoteVersion);

  if (!body || body.contract !== QUOTE_READ_RECEIPT_CONTRACT) {
    throw codedError('quote read receipt contract mismatch', 'QUOTE_REPOSITORY_RECEIPT_INVALID', 502);
  }
  if (!['FOUND', 'NOT_FOUND'].includes(body.status)) {
    throw codedError('quote read receipt status is invalid', 'QUOTE_REPOSITORY_RECEIPT_INVALID', 502);
  }
  if (body.quoteId !== id) {
    throw codedError('quote read receipt identity mismatch', 'QUOTE_REPOSITORY_CONFLICT', 409);
  }
  if (body.status === 'NOT_FOUND') {
    return Object.freeze({
      contract: QUOTE_READ_RECEIPT_CONTRACT,
      status: 'NOT_FOUND',
      quoteId: id,
      quoteVersion: version,
    });
  }

  const quote = assertIssuedQuote(body.quote);
  if (quote.quoteId !== id ||
      Number(body.quoteVersion) !== quote.quoteVersion ||
      body.snapshotHash !== quote.snapshotHash) {
    throw codedError('quote read receipt payload mismatch', 'QUOTE_REPOSITORY_CONFLICT', 409);
  }
  if (version != null && quote.quoteVersion !== version) {
    throw codedError('quote read receipt version mismatch', 'QUOTE_REPOSITORY_CONFLICT', 409);
  }

  return Object.freeze({
    contract: QUOTE_READ_RECEIPT_CONTRACT,
    status: 'FOUND',
    quoteId: id,
    quoteVersion: quote.quoteVersion,
    snapshotHash: quote.snapshotHash,
    quote,
  });
}

export async function fetchIssuedQuoteReceipt({
  quoteId,
  quoteVersion = null,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const id = requiredQuoteId(quoteId);
  const version = normalizedVersion(quoteVersion);
  const config = resolveQuoteReadConfig(env);

  if (typeof fetchImpl !== 'function') {
    throw codedError('fetch is unavailable', 'QUOTE_REPOSITORY_UNAVAILABLE');
  }

  const url = new URL(config.url + '/' + encodeURIComponent(id));
  if (version != null) url.searchParams.set('quoteVersion', String(version));

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
    throw codedError(error?.message || 'FreePass Data quote read request failed', 'QUOTE_REPOSITORY_UNAVAILABLE');
  }

  const body = await response.json().catch(() => null);

  if (response.status === 404) {
    return Object.freeze({
      contract: QUOTE_READ_RECEIPT_CONTRACT,
      status: 'NOT_FOUND',
      quoteId: id,
      quoteVersion: version,
    });
  }
  if (!response.ok) {
    throw codedError(
      body?.error || body?.code || `FreePass Data quote read response ${response.status}`,
      body?.code || 'QUOTE_REPOSITORY_READ_FAILED',
      response.status >= 400 && response.status < 600 ? response.status : 502
    );
  }

  return assertQuoteReadReceipt(body, { quoteId: id, quoteVersion: version });
}

function sendError(res, error) {
  const status = Number(error?.status);
  res.status(Number.isInteger(status) && status >= 400 && status <= 599 ? status : 503).json({
    ok: false,
    code: error?.code || 'QUOTE_REPOSITORY_UNAVAILABLE',
    error: error?.message || 'Quote reader is unavailable',
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'GET 만 받습니다' });
    return;
  }

  try {
    const receipt = await fetchIssuedQuoteReceipt({
      quoteId: req.query?.quoteId,
      quoteVersion: req.query?.quoteVersion,
    });
    res.status(200).json(receipt);
  } catch (error) {
    sendError(res, error);
  }
}
