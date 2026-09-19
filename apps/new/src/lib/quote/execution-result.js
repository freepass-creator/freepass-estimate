export const QUOTE_EXECUTION_SCHEMA = 'freepass-quote-execution/v1';
export const QUOTE_EXECUTION_STATUS = Object.freeze({
  SUCCEEDED: 'SUCCEEDED',
  HOLD: 'HOLD',
  FAILED: 'FAILED',
});

const STATUS = new Set(Object.values(QUOTE_EXECUTION_STATUS));
const CHECK_STATUS = new Set(['PASS', 'FAIL', 'SKIP']);

function cleanList(value) {
  return Array.isArray(value) ? value.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : [];
}

function cleanChecks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x) => x && typeof x.name === 'string' && CHECK_STATUS.has(x.status))
    .map((x) => ({ name: x.name, status: x.status, detail: x.detail ?? null }));
}

export function createQuoteExecution({
  status,
  provider = null,
  engine = null,
  startedAt = null,
  endedAt = null,
  revision = null,
  requestId = null,
  evidence = [],
  checks = [],
  blockers = [],
} = {}) {
  if (!STATUS.has(status)) throw new Error('QUOTE_EXECUTION_STATUS_INVALID');
  return Object.freeze({
    schema: QUOTE_EXECUTION_SCHEMA,
    status,
    provider,
    engine,
    subject_revision: revision,
    request_id: requestId,
    started_at: startedAt,
    ended_at: endedAt,
    evidence: Object.freeze(cleanList(evidence)),
    checks: Object.freeze(cleanChecks(checks)),
    blockers: Object.freeze(cleanList(blockers)),
  });
}

export function attachQuoteExecution(error, execution) {
  const target = error instanceof Error ? error : new Error(String(error || '견적 실행 실패'));
  Object.defineProperty(target, 'quoteExecution', {
    value: execution,
    enumerable: false,
    configurable: true,
  });
  return target;
}
