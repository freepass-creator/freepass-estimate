import { getVercelOidcToken } from '@vercel/oidc';

const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const ACCESS_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';
const JWT_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:jwt';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const tokenCache = new Map();

function text(value) {
  return String(value ?? '').trim();
}

function codedError(message, code, status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(text(value).toLowerCase());
}

export function resolveCloudRunAudience(url, env = process.env) {
  const explicit = text(env.FREEPASS_DATA_CLOUD_RUN_AUDIENCE);
  if (explicit) return explicit.replace(/\/+$/, '');
  try {
    return new URL(url).origin;
  } catch {
    throw codedError('FreePass Data Cloud Run URL is invalid', 'FREEPASS_DATA_CLOUD_RUN_CONFIG_INVALID');
  }
}

export async function createFreePassDataHeaders({
  url,
  consumerToken,
  env = process.env,
  fetchImpl = globalThis.fetch,
  getOidcToken = getVercelOidcToken,
} = {}) {
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${consumerToken}`,
  };
  const required = env.NODE_ENV === 'production'
    || enabled(env.FREEPASS_DATA_REQUIRE_CLOUD_RUN_ID_TOKEN);
  const staticIdToken = required
    ? ''
    : text(env.FREEPASS_DATA_CLOUD_RUN_ID_TOKEN);
  if (staticIdToken) {
    headers['x-serverless-authorization'] = `Bearer ${staticIdToken}`;
    return headers;
  }

  const wifAudience = text(env.FREEPASS_DATA_GCP_WIF_AUDIENCE);
  const callerServiceAccount = text(env.FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL);
  if (!wifAudience || !callerServiceAccount) {
    if (!required) return headers;
    throw codedError(
      'FreePass Data private Cloud Run identity is not configured',
      'FREEPASS_DATA_CLOUD_RUN_IDENTITY_UNAVAILABLE'
    );
  }
  const audience = resolveCloudRunAudience(url, env);
  const destinationOrigin = resolveCloudRunAudience(url, {});
  const cacheKey = `${callerServiceAccount}|${wifAudience}|${audience}|${destinationOrigin}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    headers['x-serverless-authorization'] = `Bearer ${cached.token}`;
    return headers;
  }

  const vercelOidc = text(await getOidcToken().catch(() => '')) || text(env.VERCEL_OIDC_TOKEN);
  if (!vercelOidc) {
    if (!required) return headers;
    throw codedError(
      'FreePass Data private Cloud Run identity is not configured',
      'FREEPASS_DATA_CLOUD_RUN_IDENTITY_UNAVAILABLE'
    );
  }
  if (typeof fetchImpl !== 'function') {
    throw codedError('fetch is unavailable', 'FREEPASS_DATA_CLOUD_RUN_IDENTITY_UNAVAILABLE');
  }

  const timeoutValue = Number(env.FREEPASS_DATA_CLOUD_RUN_IDENTITY_TIMEOUT_MS || 5000);
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue >= 500 && timeoutValue <= 15000
    ? Math.trunc(timeoutValue)
    : 5000;
  const timeoutSignal = () => AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;

  let stsResponse;
  try {
    stsResponse = await fetchImpl('https://sts.googleapis.com/v1/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        audience: wifAudience,
        grant_type: TOKEN_EXCHANGE_GRANT,
        requested_token_type: ACCESS_TOKEN_TYPE,
        scope: CLOUD_PLATFORM_SCOPE,
        subject_token_type: JWT_TOKEN_TYPE,
        subject_token: vercelOidc,
      }),
      cache: 'no-store',
      signal: timeoutSignal(),
    });
  } catch (error) {
    throw codedError(
      `FreePass Data STS exchange unavailable (${error?.name || 'network'})`,
      'FREEPASS_DATA_CLOUD_RUN_STS_UNAVAILABLE'
    );
  }
  if (!stsResponse.ok) {
    throw codedError(`FreePass Data STS exchange failed (${stsResponse.status})`, 'FREEPASS_DATA_CLOUD_RUN_STS_FAILED');
  }
  const stsBody = await stsResponse.json();
  const accessToken = text(stsBody?.access_token);
  if (!accessToken) {
    throw codedError('FreePass Data STS token is missing', 'FREEPASS_DATA_CLOUD_RUN_STS_FAILED');
  }

  let idResponse;
  try {
    idResponse = await fetchImpl(
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(callerServiceAccount)}:generateIdToken`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ audience, includeEmail: true }),
        cache: 'no-store',
        signal: timeoutSignal(),
      }
    );
  } catch (error) {
    throw codedError(
      `FreePass Data ID token mint unavailable (${error?.name || 'network'})`,
      'FREEPASS_DATA_CLOUD_RUN_ID_TOKEN_UNAVAILABLE'
    );
  }
  if (!idResponse.ok) {
    throw codedError(`FreePass Data ID token mint failed (${idResponse.status})`, 'FREEPASS_DATA_CLOUD_RUN_ID_TOKEN_FAILED');
  }
  const idBody = await idResponse.json();
  const idToken = text(idBody?.token);
  if (!idToken) {
    throw codedError('FreePass Data Cloud Run ID token is missing', 'FREEPASS_DATA_CLOUD_RUN_ID_TOKEN_FAILED');
  }

  const seconds = Number(stsBody?.expires_in);
  const ttlMs = Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, 45 * 60 * 1000)
    : 45 * 60 * 1000;
  tokenCache.set(cacheKey, { token: idToken, expiresAt: Date.now() + ttlMs });
  headers['x-serverless-authorization'] = `Bearer ${idToken}`;
  return headers;
}

export function clearFreePassDataIdentityCacheForTest() {
  tokenCache.clear();
}
