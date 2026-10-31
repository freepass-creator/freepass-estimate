// 출고 구분(대리점/렌트사)은 견적·월 대여료를 바꾸지 않는다 — 계산 서버로 가는 요청이 똑같아야 한다.
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
globalThis.location = { search: '', pathname: '/', origin: 'https://x', href: 'https://x/' };
const { quoteState, vehicleState } = await import('../src/store.js');
const { 요청만들기 } = await import('../src/lib/quote/build-request.js');
const { payoutFeeRate, appliedFeeRate } = await import('../src/lib/feature/conditions.js');

vehicleState.manufacturer = 'kia'; vehicleState.model = 'md_0c35196eeebc';
vehicleState.variant = '하이브리드 1.6'; vehicleState.trim = 'kia_niro_하이브리드_트렌디';

const out = [];
for (const fee of [0, 1, 3, 5]) {
  const req = {};
  for (const type of ['rental', 'agency']) {
    quoteState.cond.feeRatePct = fee; quoteState.cond.deliveryType = type;
    req[type] = JSON.stringify(요청만들기());
  }
  assert.equal(req.rental, req.agency, `delivery type must not change the quote request (fee ${fee})`);
  assert.equal(JSON.parse(req.rental).조건.수수료율, appliedFeeRate(fee), `request fee must be 1% + sales share (fee ${fee})`);
  out.push(`몫 ${fee}% → 견적 ${appliedFeeRate(fee)}% · 지급 렌트사 ${payoutFeeRate(fee, 'rental')}% / 대리점 ${payoutFeeRate(fee, 'agency')}%`);
}
console.log(out.join('\n'));
console.log('PASS delivery type — identical quote request for rental/agency; only the payout display differs');
