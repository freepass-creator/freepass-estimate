// External quote provider (Excel or ERP/API).
// Browser sends only normalized quote facts + adapter id.
// Credentials, Excel execution and ERP details stay server-side.

import { 공급자설정 } from '../provider-config.js';
import { QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT } from '../contracts.js';

export const 이름 = '외부 연동';
export const 다루는차 = ['신차'];

export async function 계산(요청, { 신호 } = {}) {
  const provider = 공급자설정();
  if (provider.mode !== 'external') {
    const error = new Error('외부 견적 공급자가 아닙니다');
    error.code = 'PROVIDER_MODE_MISMATCH';
    throw error;
  }

  const r = await fetch('/api/external-quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: provider.kind,
      adapterId: provider.adapter_id,
      request: 요청,
    }),
    signal: 신호,
  });

  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok || !Array.isArray(j.results) || j.contract !== QUOTE_RESULT_CONTRACT || j.providerContract !== QUOTE_PROVIDER_CONTRACT) {
    const error = new Error(j?.error || `외부 계산 서버 응답 ${r.status}`);
    error.code = j?.code || (r.status >= 500 ? 'PROVIDER_ERROR' : 'PROVIDER_RESPONSE_INVALID');
    throw error;
  }

  return {
    차량가: j.vehiclePrice ?? null,
    결과계약: j.contract,
    공급자계약: j.providerContract,
    결과: j.results.map((g) => (g == null ? null : {
      월대여료: g.monthlyRent,
      보증금: g.deposit,
      선납금: g.prepay,
      인수가: g.acquirePrice,
      총차량가: g.totalCarPrice,
      수수료: g.payFee,
    })),
  };
}
