import { verifyFirebaseRequest } from './firebase-id-token.js';

export const ESTIMATE_WRITE_ACCESS_CONTRACT = 'freepass-estimate-write-access/v1';

function codedError(message, code, status = 403) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

export function resolveEstimateWriteAccessPolicy(env = process.env) {
  const allowAnonymous = enabled(env.FREEPASS_ESTIMATE_ALLOW_ANONYMOUS_WRITES);
  const requiredRoles = String(env.FREEPASS_ESTIMATE_REQUIRED_WRITE_ROLES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return Object.freeze({
    contract: ESTIMATE_WRITE_ACCESS_CONTRACT,
    serverVerifiedFirebaseIdTokenRequired: true,
    anonymousWritesAllowed: allowAnonymous,
    requiredRoles: Object.freeze([...new Set(requiredRoles)]),
  });
}

export function assertEstimateWriteIdentity(identity, policy = resolveEstimateWriteAccessPolicy()) {
  if (!identity?.uid) {
    throw codedError('verified Firebase identity is required', 'ESTIMATE_WRITE_UNAUTHENTICATED', 401);
  }
  if (identity.isAnonymous && policy.anonymousWritesAllowed !== true) {
    throw codedError('anonymous Firebase users cannot write canonical Quote data', 'ESTIMATE_WRITE_ANONYMOUS_FORBIDDEN');
  }

  if (policy.requiredRoles.length) {
    const role = String(identity.claims?.role || '').trim();
    if (!policy.requiredRoles.includes(role)) {
      throw codedError('Firebase user lacks required Estimate write role', 'ESTIMATE_WRITE_ROLE_FORBIDDEN');
    }
  }

  return Object.freeze({
    contract: ESTIMATE_WRITE_ACCESS_CONTRACT,
    uid: identity.uid,
    anonymous: identity.isAnonymous === true,
    role: String(identity.claims?.role || '').trim() || null,
    policy,
  });
}

export async function authorizeEstimateWriteRequest(req, {
  env = process.env,
  verifyRequest = verifyFirebaseRequest,
} = {}) {
  const policy = resolveEstimateWriteAccessPolicy(env);
  const identity = await verifyRequest(req, {
    projectId: String(env.FREEPASS_FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || 'freepasserp3').trim(),
  });
  return assertEstimateWriteIdentity(identity, policy);
}
