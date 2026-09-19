// External quote provider runtime policy.
// Price/contract-like outputs prefer accuracy and provenance over silent continuity.

export const EXTERNAL_PROVIDER_POLICY = Object.freeze({
  timeout_ms: 12000,
  max_attempts: 1,
  fallback: 'none',
  retry_mode: 'manual',
});

const PUBLIC_MESSAGES = Object.freeze({
  PROVIDER_UNSUPPORTED: '선택한 차량 구성은 현재 견적 계산 공급자에서 지원하지 않습니다.',
  PROVIDER_TIMEOUT: '견적 계산 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
  PROVIDER_UNAVAILABLE: '현재 견적 계산 공급자에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  PROVIDER_RESPONSE_INVALID: '견적 계산 결과를 확인할 수 없습니다.',
  PROVIDER_ADAPTER_UNREGISTERED: '등록되지 않은 견적 계산 연결입니다.',
  PROVIDER_KIND_INVALID: '견적 계산 연결 설정을 확인해 주세요.',
  PROVIDER_ERROR: '현재 견적을 계산할 수 없습니다.',
});

export function providerPublicMessage(code) {
  return PUBLIC_MESSAGES[code] || PUBLIC_MESSAGES.PROVIDER_ERROR;
}

export function providerRetryable(code) {
  return code === 'PROVIDER_TIMEOUT' || code === 'PROVIDER_UNAVAILABLE';
}
