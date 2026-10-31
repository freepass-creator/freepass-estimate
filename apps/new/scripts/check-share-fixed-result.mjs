// 공유 링크는 «계산 결과가 고정된 스냅샷»이다 — 영업 내부값(출고 구분·수수료)은 저장본에 없고,
// 다시 열어도 같은 월 대여료가 나와야 한다.
import assert from 'node:assert/strict';

globalThis.location = { search: '', pathname: '/s/abcd1234', origin: 'https://x', href: 'https://x/s/abcd1234' };
const { 공유주소, 공유풀기 } = await import('../src/lib/share-link.js');

const 결과 = [{ 월대여료: 612300, 보증금: 0, 선납금: 0, 인수가: 9000000, 총차량가: 31000000 }];
const 견적상태 = {
  상태: 'ok', 결과, 공급자: 'standard', 계산기: '표준', 차량가: 31000000,
  계약: {}, 실행: { subject_revision: null },
};
const make = (deliveryType, feeRatePct) => ({
  vehicle: { brand: '기아', model: '니로', variant: '하이브리드 1.6', trim_name: '트렌디', options: [] },
  cond: { km: 2, svc: '웰스 Basic', insProperty: '1억', extraDriver: '없음', deliveryCity: '서울', dep: 0, pre: 0, feeRatePct, deliveryType },
  scenarios: [{ term: 36, dep: 0, pre: 0 }],
  tint: { product: '없음' }, extras: { blackbox: '미설치' },
});

for (const [type, fee] of [['rental', 0], ['agency', 5], ['agency', 0]]) {
  const q = make(type, fee);
  let saved;
  await 공유주소({ manufacturer: 'kia' }, q, 견적상태, async (bundle) => { saved = bundle; return 'https://x/s/abcd1234'; });
  const text = JSON.stringify(saved);
  assert.ok(!/agency|deliveryType|feeRate|수수료/.test(text), `internal fee/delivery value leaked into share payload (${type}/${fee})`);

  const fresh = { options: [] };
  const q2 = { ...make('rental', 0), sharedSnapshot: null };
  await 공유풀기(fresh, q2, async () => saved);
  const terms = q2.sharedSnapshot?.terms;
  assert.equal(terms?.[0]?.monthly, 612300, `reopened share must show the fixed monthly rent (${type}/${fee})`);
}

console.log('PASS share link — fixed result snapshot, no internal fee/delivery values, same monthly rent on reopen');
