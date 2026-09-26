import { createVerify } from 'node:crypto';

export const FIREBASE_SECURETOKEN_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certCache = {
  expiresAt: 0,
  certs: null,
};

function codedError(message, code, status = 401) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function decodeBase64Url(value) {
  try {
    return Buffer.from(String(value || ''), 'base64url');
  } catch {
    throw codedError('Firebase ID token base64url is invalid', 'FIREBASE_ID_TOKEN_INVALID');
  }
}

function decodeJson(value, field) {
  try {
    return JSON.parse(decodeBase64Url(value).toString('utf8'));
  } catch {
    throw codedError(`Firebase ID token ${field} is invalid`, 'FIREBASE_ID_TOKEN_INVALID');
  }
}

function parseBearer(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = /^Bearer\s+(.+)$/i.exec(String(raw || '').trim());
  if (!match) {
    throw codedError('Firebase ID token is required', 'FIREBASE_ID_TOKEN_REQUIRED');
  }
  return match[1].trim();
}

function cacheMaxAge(headers) {
  const raw = headers?.get?.('cache-control') || '';
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(raw);
  const seconds = match ? Number(match[1]) : 300;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 300;
}

async function getFirebaseCerts({
  fetchImpl = globalThis.fetch,
  nowMs = Date.now(),
} = {}) {
  if (certCache.certs && certCache.expiresAt > nowMs) return certCache.certs;
  if (typeof fetchImpl !== 'function') {
    throw codedError('fetch is unavailable for Firebase key verification', 'FIREBASE_CERTS_UNAVAILABLE', 503);
  }

  let response;
  try {
    response = await fetchImpl(FIREBASE_SECURETOKEN_CERT_URL, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (error) {
    throw codedError(error?.message || 'Firebase signing keys unavailable', 'FIREBASE_CERTS_UNAVAILABLE', 503);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object') {
    throw codedError('Firebase signing keys unavailable', 'FIREBASE_CERTS_UNAVAILABLE', 503);
  }

  const ttl = cacheMaxAge(response.headers);
  certCache = {
    certs: body,
    expiresAt: nowMs + ttl * 1000,
  };
  return body;
}

export function resolveFirebaseProjectId(env = process.env) {
  const value = String(
    env.FREEPASS_FIREBASE_PROJECT_ID ||
    env.GCLOUD_PROJECT ||
    env.GOOGLE_CLOUD_PROJECT ||
    'freepasserp3'
  ).trim();
  if (!value) {
    throw codedError('Firebase project ID is not configured', 'FIREBASE_AUTH_CONFIG_INVALID', 503);
  }
  return value;
}

export function decodeFirebaseIdTokenUnverified(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw codedError('Firebase ID token format is invalid', 'FIREBASE_ID_TOKEN_INVALID');
  }
  return Object.freeze({
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: decodeBase64Url(parts[2]),
    header: decodeJson(parts[0], 'header'),
    payload: decodeJson(parts[1], 'payload'),
  });
}

export async function verifyFirebaseIdToken(token, {
  projectId = resolveFirebaseProjectId(),
  fetchImpl = globalThis.fetch,
  nowMs = Date.now(),
  clockSkewSeconds = 30,
  certs = null,
} = {}) {
  const decoded = decodeFirebaseIdTokenUnverified(token);
  const { header, payload } = decoded;

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw codedError('Firebase ID token header is invalid', 'FIREBASE_ID_TOKEN_INVALID');
  }

  const keyMap = certs || await getFirebaseCerts({ fetchImpl, nowMs });
  const certificate = keyMap?.[header.kid];
  if (!certificate) {
    throw codedError('Firebase ID token signing key is unknown', 'FIREBASE_ID_TOKEN_INVALID');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(decoded.signingInput);
  verifier.end();
  if (!verifier.verify(certificate, decoded.signature)) {
    throw codedError('Firebase ID token signature is invalid', 'FIREBASE_ID_TOKEN_INVALID');
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  const skew = Number(clockSkewSeconds) || 0;
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (payload.aud !== projectId || payload.iss !== expectedIssuer) {
    throw codedError('Firebase ID token project claims are invalid', 'FIREBASE_ID_TOKEN_INVALID');
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds - skew) {
    throw codedError('Firebase ID token has expired', 'FIREBASE_ID_TOKEN_EXPIRED');
  }
  if (!Number.isFinite(payload.iat) || payload.iat > nowSeconds + skew) {
    throw codedError('Firebase ID token issued-at time is invalid', 'FIREBASE_ID_TOKEN_INVALID');
  }
  if (!Number.isFinite(payload.auth_time) || payload.auth_time > nowSeconds + skew) {
    throw codedError('Firebase ID token auth_time is invalid', 'FIREBASE_ID_TOKEN_INVALID');
  }
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
    throw codedError('Firebase ID token subject is invalid', 'FIREBASE_ID_TOKEN_INVALID');
  }

  return Object.freeze({
    uid: payload.sub,
    projectId,
    isAnonymous: payload.firebase?.sign_in_provider === 'anonymous',
    signInProvider: payload.firebase?.sign_in_provider || null,
    claims: Object.freeze({ ...payload }),
  });
}

export async function verifyFirebaseRequest(req, options = {}) {
  const token = parseBearer(req?.headers?.authorization);
  return verifyFirebaseIdToken(token, options);
}

export function resetFirebaseCertCacheForTests() {
  certCache = { expiresAt: 0, certs: null };
}
