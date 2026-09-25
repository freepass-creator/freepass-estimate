import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configurationAxes, resolveProviderCandidate, absorbedAxisOptionIds } from '../src/lib/newcar/configuration-resolver.js';
import { QUOTE_REQUEST_CONTRACT, QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT } from '../src/lib/quote/contracts.js';
import { EXTERNAL_PROVIDER_POLICY, providerPublicMessage, providerRetryable } from '../src/lib/quote/provider-policy.js';

// Server-side external quote adapter router.
// Never exposes partner Excel files, ERP credentials or upstream auth to the browser.

const WELRIX_URL = 'https://welrixmobility.netlify.app/api/estimate';
const WELRIX_EXPECTED_ENGINE_VERSION = 'welrix-excel/v6.1';
const WELRIX_ENGINE_EVIDENCE_CONTRACT = 'welrix-pricing-engine-evidence/v1';

function welrixPricingEngineEvidence(upstream) {
  const proof = upstream?.pricingEngine;
  if (proof?.contract === WELRIX_ENGINE_EVIDENCE_CONTRACT &&
      proof?.id === 'welrix-excel' &&
      proof?.verified === true &&
      typeof proof?.version === 'string' &&
      proof.version.trim()) {
    const upstreamVersion = proof.version.trim();
    return Object.freeze({
      id: 'welrix-excel',
      version: upstreamVersion,
      evidence: 'UPSTREAM_CONTRACT',
      verified: true,
      upstreamVersion,
    });
  }
  return Object.freeze({
    id: 'welrix-excel',
    version: WELRIX_EXPECTED_ENGINE_VERSION,
    evidence: 'ADAPTER_PIN_ONLY',
    verified: false,
  });
}

let PRODUCT_INDEX = null;
function productIndex() {
  if (PRODUCT_INDEX) return PRODUCT_INDEX;
  const path = join(process.cwd(), 'public', 'data', 'freepass-newcar', 'product-index.json');
  PRODUCT_INDEX = JSON.parse(readFileSync(path, 'utf8'));
  return PRODUCT_INDEX;
}

class ProviderRuntimeError extends Error {
  constructor(code, { status = 502, retryable = providerRetryable(code), diagnostic = null } = {}) {
    super(providerPublicMessage(code));
    this.name = 'ProviderRuntimeError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.diagnostic = diagnostic;
  }
}

class ProviderUnsupportedError extends ProviderRuntimeError {
  constructor() {
    super('PROVIDER_UNSUPPORTED', { status: 422, retryable: false });
    this.name = 'ProviderUnsupportedError';
  }
}

function welrixProviderResolution(request) {
  const productId = request?.차?.상품키 || request?.차?.키;
  const p = productIndex()?.products?.[productId];
  if (!p) throw new ProviderUnsupportedError();

  const selected = Array.isArray(request?.차?.구성?.선택옵션) ? request.차.구성.선택옵션 : [];
  const optionsMaster = Object.fromEntries(selected.map((o) => [
    o.id,
    { name: o.name, price: Number(o.price_won || 0) / 10000 },
  ]));
  const selectedIds = selected.map((o) => o.id);
  const trim = { _base_axes: p.baseAxes || request?.차?.구성?.기본축 || {} };
  const axes = configurationAxes(trim, optionsMaster, selectedIds);
  const candidate = resolveProviderCandidate(p.providerCandidates || [], axes);
  if (!candidate) throw new ProviderUnsupportedError();

  const absorbed = new Set(absorbedAxisOptionIds(trim, optionsMaster, selectedIds, candidate));
  const absorbedWon = selected
    .filter((o) => absorbed.has(o.id))
    .reduce((sum, o) => sum + Number(o.price_won || 0), 0);

  return { productId, candidate, absorbedWon, axes };
}

function bad(res, status, error, code = null, retryable = false) {
  res.status(status).json({
    ok: false,
    error,
    ...(code ? { code } : {}),
    retryable: retryable === true,
  });
}

function logProviderFailure({ kind, adapterId, error }) {
  const payload = {
    event: 'EXTERNAL_QUOTE_PROVIDER_FAILURE',
    kind: kind || null,
    adapter_id: adapterId || null,
    code: error?.code || 'PROVIDER_ERROR',
    status: error?.status || 502,
    retryable: error?.retryable === true,
    diagnostic: error?.diagnostic || null,
  };
  // Do not include request/customer/price/formula payloads in provider failure logs.
  console.error('[external-quote]', JSON.stringify(payload));
}

export function externalOptionPrice(price = {}, car = {}, absorbedWon = 0) {
  const option = Number(price.옵션 ?? car.옵션가 ?? 0);
  const exterior = Number(price.외장색 ?? car.색추가금 ?? 0);
  const interior = Number(price.내장색 ?? 0);
  const absorbed = Number(absorbedWon ?? 0);
  if (![option, exterior, interior, absorbed].every(Number.isFinite)) {
    throw new ProviderRuntimeError('PROVIDER_RESPONSE_INVALID', {
      status: 422,
      retryable: false,
      diagnostic: { cause_name: 'PRICE_COMPONENT_INVALID' },
    });
  }
  return Math.max(0, option - absorbed + exterior + interior);
}

function welrixBody(request) {
  const 차 = request?.차 || {};
  const 가격 = 차.가격 || {};
  const 조건 = request?.조건 || {};
  const 안들 = request?.안들 || [];
  const resolved = welrixProviderResolution(request);

  return {
    model: resolved.candidate.api_model,
    old: false,
    manualPrice: 0,
    inputs: 안들.map((a) => ({
      credit: 조건.신용,
      termMonths: a.기간,
      mileage: 조건.주행,
      // AWD/인승처럼 provider의 완성차 row에 이미 포함된 구성 옵션은 다시 더하지 않는다.
      optionPrice: externalOptionPrice(가격, 차, resolved.absorbedWon),
      stockDiscount: 가격.할인 || 차.할인 || 0,
      deliveryFee: 조건.탁송비,
      tintFee: 조건.썬팅비,
      dashcamFee: 조건.블박비,
      deposit_pct: (a.보증금 || 0) / 100,
      prepay_pct: (a.선납 || 0) / 100,
      liability: 조건.대물,
      extraDriver: 조건.추가운전자,
      maintenance: 조건.정비,
      feeRate: (조건.수수료율 || 0) / 100,
    })),
  };
}

async function welrixExcel(request) {
  let r;
  try {
    r = await fetch(WELRIX_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(welrixBody(request)),
      signal: AbortSignal.timeout
        ? AbortSignal.timeout(EXTERNAL_PROVIDER_POLICY.timeout_ms)
        : undefined,
    });
  } catch (error) {
    // Mapping/unsupported failures are domain/provider decisions, not network failures.
    if (error instanceof ProviderRuntimeError) throw error;
    const name = error?.name || null;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ProviderRuntimeError('PROVIDER_TIMEOUT', {
        status: 504,
        retryable: true,
        diagnostic: { cause_name: name },
      });
    }
    throw new ProviderRuntimeError('PROVIDER_UNAVAILABLE', {
      status: 502,
      retryable: true,
      diagnostic: { cause_name: name || 'Error' },
    });
  }

  const j = await r.json().catch(() => null);

  if (!r.ok) {
    throw new ProviderRuntimeError('PROVIDER_UNAVAILABLE', {
      status: 502,
      retryable: true,
      diagnostic: { upstream_status: r.status },
    });
  }

  if (!j?.ok || !Array.isArray(j.results)) {
    throw new ProviderRuntimeError('PROVIDER_RESPONSE_INVALID', {
      status: 502,
      retryable: false,
      diagnostic: { upstream_status: r.status },
    });
  }

  return {
    vehiclePrice: j.price ?? null,
    pricingEngine: welrixPricingEngineEvidence(j),
    results: j.results.map((g) => (g == null ? null : {
      monthlyRent: g.monthlyRent,
      deposit: g.deposit,
      prepay: g.prepay,
      acquirePrice: g.acquirePrice,
      totalCarPrice: g.totalCarPrice,
      payFee: g.payFee,
    })),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return bad(res, 405, 'POST 만 받습니다', 'METHOD_NOT_ALLOWED', false);

  const { kind, adapterId, request } = req.body || {};
  if (!request?.차?.키 || !Array.isArray(request?.안들)) {
    return bad(res, 400, '견적 요청 형식이 올바르지 않습니다', 'QUOTE_REQUEST_INVALID', false);
  }
  if (request?.계약 && request.계약 !== QUOTE_REQUEST_CONTRACT) {
    return bad(res, 400, '지원하지 않는 견적 요청 계약입니다', 'QUOTE_REQUEST_CONTRACT_UNSUPPORTED', false);
  }

  try {
    let out;
    if (kind === 'excel' && adapterId === 'welrix') {
      out = await welrixExcel(request);
    } else if (kind === 'excel' || kind === 'erp') {
      return bad(res, 501, providerPublicMessage('PROVIDER_ADAPTER_UNREGISTERED'), 'PROVIDER_ADAPTER_UNREGISTERED', false);
    } else {
      return bad(res, 400, providerPublicMessage('PROVIDER_KIND_INVALID'), 'PROVIDER_KIND_INVALID', false);
    }

    res.status(200).json({
      ok: true,
      contract: QUOTE_RESULT_CONTRACT,
      providerContract: QUOTE_PROVIDER_CONTRACT,
      providerPolicy: {
        timeout_ms: EXTERNAL_PROVIDER_POLICY.timeout_ms,
        max_attempts: EXTERNAL_PROVIDER_POLICY.max_attempts,
        fallback: EXTERNAL_PROVIDER_POLICY.fallback,
      },
      ...out,
    });
  } catch (rawError) {
    const error = rawError instanceof ProviderRuntimeError
      ? rawError
      : new ProviderRuntimeError('PROVIDER_ERROR', {
        status: 502,
        retryable: false,
        diagnostic: { cause_name: rawError?.name || 'Error' },
      });

    logProviderFailure({ kind, adapterId, error });
    return bad(
      res,
      error.status,
      providerPublicMessage(error.code),
      error.code,
      error.retryable,
    );
  }
}
