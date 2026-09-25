export const PRICING_ENGINE_EVIDENCE_CONTRACT = 'freepass-pricing-engine-evidence/v1';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function normalizePricingEngineEvidence(value, { requireVerified = false } = {}) {
  if (!value || typeof value !== 'object') {
    throw codedError('pricing engine evidence is required', 'PRICING_ENGINE_EVIDENCE_REQUIRED');
  }
  const id = String(value.id ?? '').trim();
  const version = String(value.version ?? '').trim();
  const evidence = String(value.evidence ?? '').trim();
  if (!id || !version || !evidence) {
    throw codedError('pricing engine identity/version/evidence is incomplete', 'PRICING_ENGINE_EVIDENCE_INVALID');
  }
  if (typeof value.verified !== 'boolean') {
    throw codedError('pricing engine verified flag is required', 'PRICING_ENGINE_EVIDENCE_INVALID');
  }
  if (requireVerified && value.verified !== true) {
    throw codedError('pricing engine version is not verified', 'PRICING_ENGINE_VERSION_UNVERIFIED');
  }
  return Object.freeze({
    contract: PRICING_ENGINE_EVIDENCE_CONTRACT,
    id,
    version,
    evidence,
    verified: value.verified === true,
    ...(value.sourceDigest ? { sourceDigest: String(value.sourceDigest).trim() } : {}),
    ...(value.policyDigest ? { policyDigest: String(value.policyDigest).trim() } : {}),
    ...(value.upstreamVersion ? { upstreamVersion: String(value.upstreamVersion).trim() } : {}),
  });
}
