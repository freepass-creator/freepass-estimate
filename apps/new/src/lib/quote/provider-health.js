import { PROVIDER_HEALTH_CONTRACT } from './contracts.js';
import { EXTERNAL_PROVIDER_POLICY } from './provider-policy.js';

export const PROVIDER_LIVE_STATUS = Object.freeze({
  VERIFIED_UP: 'VERIFIED_UP',
  VERIFIED_DOWN: 'VERIFIED_DOWN',
  UNOBSERVED: 'UNOBSERVED',
});

export function createProviderHealth({
  providerKey,
  mode,
  kind = null,
  adapterId = null,
  configured = false,
  liveStatus = PROVIDER_LIVE_STATUS.UNOBSERVED,
  observedAt = null,
  evidence = [],
  reason = null,
} = {}) {
  if (!providerKey) throw new Error('PROVIDER_HEALTH_KEY_REQUIRED');
  if (!Object.values(PROVIDER_LIVE_STATUS).includes(liveStatus)) {
    throw new Error('PROVIDER_HEALTH_LIVE_STATUS_INVALID');
  }
  return Object.freeze({
    contract: PROVIDER_HEALTH_CONTRACT,
    provider_key: providerKey,
    mode,
    kind,
    adapter_id: adapterId,
    configuration_status: configured ? 'CONFIGURED' : 'UNKNOWN',
    live_status: liveStatus,
    live_verified: liveStatus !== PROVIDER_LIVE_STATUS.UNOBSERVED,
    observed_at: observedAt,
    reason,
    evidence: Array.isArray(evidence) ? evidence.filter(Boolean) : [],
    policy: mode === 'external' ? {
      timeout_ms: EXTERNAL_PROVIDER_POLICY.timeout_ms,
      max_attempts: EXTERNAL_PROVIDER_POLICY.max_attempts,
      fallback: EXTERNAL_PROVIDER_POLICY.fallback,
      retry_mode: EXTERNAL_PROVIDER_POLICY.retry_mode,
    } : {
      fallback: 'none',
    },
  });
}

export function configuredProviderHealth(provider) {
  if (!provider?.mode) {
    return createProviderHealth({
      providerKey: 'unknown',
      mode: null,
      configured: false,
      reason: 'PROVIDER_CONFIG_MISSING',
    });
  }

  const providerKey = provider.mode === 'standard'
    ? 'standard'
    : `external:${provider.kind || 'unknown'}:${provider.adapter_id || 'unknown'}`;

  return createProviderHealth({
    providerKey,
    mode: provider.mode,
    kind: provider.kind ?? null,
    adapterId: provider.adapter_id ?? null,
    configured: true,
    liveStatus: PROVIDER_LIVE_STATUS.UNOBSERVED,
    reason: provider.mode === 'external'
      ? 'NO_NONINVASIVE_LIVE_PROBE'
      : 'NO_RUNTIME_PROBE_EXECUTED',
    evidence: ['CONFIG_SOURCE:company-config'],
  });
}
