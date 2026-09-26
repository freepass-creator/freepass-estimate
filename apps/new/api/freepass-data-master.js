const CONTRACT = 'estimate-newcar-master/v1';
const AUTHORITY = 'CANONICAL_ACTIVE';
const CONSUMER_PATH = '/v1/consumers/freepass-estimate/estimate-newcar-master';

function codedError(message, code, status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function resolveFreePassDataMasterConfig(env = process.env) {
  const baseUrl = String(env.FREEPASS_DATA_CONSUMER_BASE_URL ?? '').trim().replace(/\/$/, '');
  const token = String(env.FREEPASS_DATA_ESTIMATE_TOKEN ?? '').trim();
  if (!baseUrl) throw codedError('FreePass Data consumer URL is not configured', 'FREEPASS_DATA_MASTER_UNAVAILABLE');
  if (!/^https:\/\//i.test(baseUrl) && env.NODE_ENV === 'production') {
    throw codedError('FreePass Data consumer URL must use HTTPS in production', 'FREEPASS_DATA_MASTER_CONFIG_INVALID');
  }
  if (token.length < 32) {
    throw codedError('FreePass Data Estimate service token is not configured', 'FREEPASS_DATA_MASTER_UNAVAILABLE');
  }
  return Object.freeze({ url: baseUrl + CONSUMER_PATH, token });
}

function validDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

export function assertMasterResponse(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.data) || !body.data.length) {
    throw codedError('FreePass Data master payload is incomplete', 'FREEPASS_DATA_MASTER_INVALID');
  }
  const meta = body.meta;
  if (!meta || meta.contract !== CONTRACT || meta.authority !== AUTHORITY) {
    throw codedError('FreePass Data master contract/evidence mismatch', 'FREEPASS_DATA_MASTER_INVALID');
  }
  if (!meta.releaseId || !meta.manifestId ||
      !Number.isSafeInteger(meta.revision) || meta.revision < 1 ||
      meta.projectionId !== 'estimate-newcar-master' ||
      meta.schemaVersion !== '1.0.0' ||
      !meta.activatedAt || !Number.isFinite(Date.parse(meta.activatedAt)) ||
      !validDigest(meta.inputDigest) || !validDigest(meta.dataDigest)) {
    throw codedError('FreePass Data master release evidence is incomplete', 'FREEPASS_DATA_MASTER_INVALID');
  }
  return body;
}

export async function fetchFreePassDataMaster({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = resolveFreePassDataMasterConfig(env);
  if (typeof fetchImpl !== 'function') {
    throw codedError('fetch is unavailable', 'FREEPASS_DATA_MASTER_UNAVAILABLE');
  }

  let response;
  try {
    response = await fetchImpl(config.url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${config.token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
    });
  } catch (error) {
    throw codedError(error?.message || 'FreePass Data master request failed', 'FREEPASS_DATA_MASTER_UNAVAILABLE');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw codedError(
      body?.code || body?.error || `FreePass Data master response ${response.status}`,
      body?.code || 'FREEPASS_DATA_MASTER_UNAVAILABLE',
      response.status >= 400 && response.status < 600 ? response.status : 503
    );
  }
  return assertMasterResponse(body);
}

function sendError(res, error) {
  const status = Number(error?.status);
  res.status(Number.isInteger(status) && status >= 400 && status <= 599 ? status : 503).json({
    ok: false,
    code: error?.code || 'FREEPASS_DATA_MASTER_UNAVAILABLE',
    error: error?.message || 'FreePass Data master is unavailable',
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
    const master = await fetchFreePassDataMaster();
    res.status(200).json({ ok: true, ...master });
  } catch (error) {
    sendError(res, error);
  }
}
