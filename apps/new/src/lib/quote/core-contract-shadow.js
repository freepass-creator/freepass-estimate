import { QUOTE_EXECUTION_CONTRACT, QUOTE_PROVIDER_CONTRACT } from './contracts.js';
import { providerRetryable } from './provider-policy.js';

export const CORE_ADAPTER_RESULT_CONTRACT = 'core-adapter-result/v1';
export const CORE_QUOTE_ADAPTER_ID = 'freepass-estimate.quote-provider';

const MACHINE_CODE = /^[A-Z][A-Z0-9_]*$/;

function issueFromBlocker(blocker, status) {
  const text = String(blocker || '').trim();
  return {
    code: MACHINE_CODE.test(text) ? text : 'PROJECT_BLOCKER',
    severity: status === 'HOLD' ? 'BLOCKING' : 'ERROR',
    message: text || 'quote execution blocked',
  };
}

export function toCoreAdapterResult(execution, { data = null } = {}) {
  if (!execution || execution.schema !== QUOTE_EXECUTION_CONTRACT) {
    throw new Error('CORE_SHADOW_EXECUTION_CONTRACT_INVALID');
  }
  if (!execution.request_id) throw new Error('CORE_SHADOW_REQUEST_ID_REQUIRED');
  if (!execution.started_at || !execution.ended_at) throw new Error('CORE_SHADOW_EXECUTION_TIME_REQUIRED');

  const blockers = Array.isArray(execution.blockers) ? execution.blockers : [];
  const failedChecks = Array.isArray(execution.checks)
    ? execution.checks.filter((check) => check?.status === 'FAIL')
    : [];

  const issues = [
    ...blockers.map((blocker) => issueFromBlocker(blocker, execution.status)),
    ...failedChecks
      .filter((check) => !blockers.includes(check?.detail))
      .map((check) => ({
        code: MACHINE_CODE.test(String(check?.detail || '')) ? String(check.detail) : 'PROJECT_CHECK_FAILED',
        severity: 'ERROR',
        field: check?.name || undefined,
        message: String(check?.detail || check?.name || 'quote contract check failed'),
      })),
  ];

  return Object.freeze({
    schema_version: CORE_ADAPTER_RESULT_CONTRACT,
    adapter_id: CORE_QUOTE_ADAPTER_ID,
    adapter_version: QUOTE_PROVIDER_CONTRACT,
    provider_id: execution.provider ?? null,
    source_revision: execution.subject_revision ?? null,
    correlation_id: execution.request_id,
    status: execution.status,
    retryable: blockers.some((code) => providerRetryable(String(code))),
    data,
    issues: Object.freeze(issues),
    evidence_refs: Object.freeze([...(execution.evidence || [])]),
    started_at: execution.started_at,
    ended_at: execution.ended_at,
  });
}
