import { 요청검사, 결과검사 } from './spec.js';
import { 공급자설정, 공급자키 } from './provider-config.js';
import { createQuoteExecution, attachQuoteExecution } from './execution-result.js';
import { QUOTE_REQUEST_CONTRACT, QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT, QUOTE_EXECUTION_CONTRACT, buildRevision } from './contracts.js';
import * as 표준 from './engines/freepass-standard.js';
import * as 외부 from './engines/external.js';
import { normalizePricingEngineEvidence } from './pricing-engine.js';
import { normalizePriceBasis } from './price-basis.js';

export const 계산기들 = Object.freeze({ 표준, 외부 });

export function 활성계산기이름(강제계산기 = null) {
  if (강제계산기) {
    if (!계산기들[강제계산기]) {
      const error = new Error(`그런 계산기가 없다: ${강제계산기}`);
      error.code = 'QUOTE_ENGINE_UNKNOWN';
      throw error;
    }
    return 강제계산기;
  }
  return 공급자설정().mode === 'standard' ? '표준' : '외부';
}

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function executionRequestId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `quote-${uuid}`;
  return `quote-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function 견적계산(요청, { 신호, 강제계산기 = null, allowUnverifiedPricingEngine = false } = {}) {
  const startedAt = new Date().toISOString();
  const requestId = executionRequestId();
  let 이름 = null;
  let providerKey = null;

  try {
    const 탈 = 요청검사(요청);
    if (탈) throw codedError(탈, 'QUOTE_REQUEST_INVALID');

    이름 = 활성계산기이름(강제계산기);
    const 계산기 = 계산기들[이름];
    providerKey = 강제계산기 ? `forced:${강제계산기}` : 공급자키();

    if (!계산기.다루는차.includes(요청.차.종류)) {
      throw codedError(`${계산기.이름} 계산기는 ${요청.차.종류}를 다루지 않습니다`, 'QUOTE_ENGINE_UNSUPPORTED');
    }

    const 답 = await 계산기.계산(요청, { 신호 });
    const 탈2 = 결과검사(답?.결과, 요청.안들);
    if (탈2) throw codedError(탈2, 'QUOTE_RESULT_INVALID');
    const pricingEngine = normalizePricingEngineEvidence(답?.pricingEngine, { requireVerified: !allowUnverifiedPricingEngine });
    const priceBasis = normalizePriceBasis(답?.priceBasis, {
      expectedProductId: 요청?.차?.상품키 || 요청?.차?.키,
    });

    return {
      ...답,
      pricingEngine,
      priceBasis,
      계산기: 계산기.이름,
      공급자: providerKey,
      계약: {
        request: 요청?.계약 || QUOTE_REQUEST_CONTRACT,
        result: 답?.결과계약 || QUOTE_RESULT_CONTRACT,
        provider: 답?.공급자계약 || QUOTE_PROVIDER_CONTRACT,
        execution: QUOTE_EXECUTION_CONTRACT,
      },
      실행: createQuoteExecution({
        status: pricingEngine.verified ? 'SUCCEEDED' : 'HOLD',
        provider: providerKey,
        engine: 계산기.이름,
        startedAt,
        endedAt: new Date().toISOString(),
        revision: buildRevision(),
        requestId,
        evidence: [
          `QUOTE_PROVIDER:${providerKey}`,
          `PRICING_ENGINE:${pricingEngine.id}:${pricingEngine.version}:${pricingEngine.verified ? 'VERIFIED' : 'UNVERIFIED'}`,
          `PRICE_BASIS:${priceBasis.sourceRevision}:${priceBasis.productId}`,
        ],
        checks: [
          { name: 'quote-request-contract', status: 'PASS' },
          { name: 'quote-result-contract', status: 'PASS' },
          { name: 'pricing-engine-evidence', status: pricingEngine.verified ? 'PASS' : 'FAIL', detail: pricingEngine.verified ? 'VERIFIED' : 'UNVERIFIED' },
          { name: 'price-basis', status: 'PASS', detail: priceBasis.sourceRevision },
        ],
        blockers: pricingEngine.verified ? [] : ['PRICING_ENGINE_VERSION_UNVERIFIED'],
      }),
    };
  } catch (rawError) {
    const error = rawError instanceof Error ? rawError : new Error(String(rawError || '견적 실행 실패'));
    if (!error.code) error.code = 'QUOTE_PROVIDER_FAILED';

    if (!error.quoteExecution) {
      attachQuoteExecution(error, createQuoteExecution({
        status: ['PROVIDER_UNSUPPORTED', 'PRICING_ENGINE_VERSION_UNVERIFIED'].includes(error.code) ? 'HOLD' : 'FAILED',
        provider: providerKey,
        engine: 이름 ? 계산기들[이름]?.이름 || 이름 : null,
        startedAt,
        endedAt: new Date().toISOString(),
        revision: buildRevision(),
        requestId,
        evidence: providerKey ? [`QUOTE_PROVIDER:${providerKey}`] : [],
        checks: [
          { name: 'quote-request-contract', status: error.code === 'QUOTE_REQUEST_INVALID' ? 'FAIL' : 'PASS' },
          { name: 'quote-result-contract', status: 'FAIL', detail: error.code },
        ],
        blockers: [error.code],
      }));
    }
    throw error;
  }
}
