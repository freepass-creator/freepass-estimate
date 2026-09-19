// ============================================================================
//  엑셀 v6.1 검증 기준값 (SSOT)  —  check-sync.mjs 가 읽어서 회귀 검사
// ----------------------------------------------------------------------------
//  새 엑셀이 오면 ⟶ 여기 expect 값(과 cell 참조)만 갱신하면 됨.
//  검사 실행 로직(러너)은 check-sync.mjs 에, 기준 데이터는 여기에 분리.
// ============================================================================
import { TINT_PRICES, FLAT_DELIVERY } from '../src/data/lookups.js';

// (A) 엔진 직접 검증 — calcQuote 입력을 엑셀 셀과 1:1로 박아서 검증(차량DB 매칭 영향 배제)
export const ENGINE_CASES = [
  {
    label: 'K5 2.0 HEV 베스트셀렉션 / 60M / 보증0 / 중신용 / 블박+썬팅',
    cell: '견적1!H34',
    expectMonthly: 746000,        // 엑셀 v6.1 최종 월대여료 (개소세 3.5%→5% + H34 기간가산 H33기준 반영; v6=740,000)
    input: {
      vehicle: { brand: '기아', model: 'K5', trim: 'K5 2.0 하이브리드 베스트 셀렉션', price: 35020000,
        disp: 1999, fuel: 'HEV.', tax_exempt: '과세', group: 'A군', multi_seat: null,
        r24: 0.66, r36: 0.57, r48: 0.5, r60: 0.42, strategic: 0, buyback_apply: 0.04 },
      options: { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 280000, etc: 0 },
      contract: { term: 60, km: '2만km', dep: 0, pre: 0 },
      customer: { creditGrade: '중신용' },
      insurance: { property: '1억', extraDriver: '없음', exec: '미가입', injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
      fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
    },
  },
];

// (C) 보증금 v6.1 — 저신용=CEILING(50만 올림), 그 외(무신용 포함)=ROUND(10만 반올림), [500k,10M] 클램프
//     calcQuote(depositAmt) = 엑셀 F13 IF(BC6="저신용",CEILING,ROUND). price=소비자가(C20), dep=%, credit=신용등급.
export const DEPOSIT_CASES = [
  { price: 25150000, dep: 10, credit: '중신용', expect: 2500000, note: 'ROUND 10만 (raw 2,515,000→2,500,000)' },
  { price: 25150000, dep: 10, credit: '저신용', expect: 3000000, note: 'v6.1 CEILING 50만 올림 (raw 2,515,000→3,000,000)' },
  { price: 25150000, dep: 10, credit: '무신용', expect: 2500000, note: 'v6.1 무신용=ROUND (raw 2,515,000→2,500,000; v6=CEILING 3,000,000)' },
  { price: 30000000, dep: 1,  credit: '중신용', expect: 500000,  note: '하한 클램프 (raw 300,000→500,000)' },
];

// (B) 입력조립 검증 — buildCalcInput(state) 경로. 탁송/썬팅 엑셀 수식 + 내비/하이패스 제외 가드.
const _tint = (TINT_PRICES['버텍스 300'].front || 0) + (TINT_PRICES['버텍스 300'].side_rear_with_coupon || 0);
const _blackbox = 175000;
export const ASSEMBLY_CASES = [
  {
    label: '탁송·썬팅 처리 (엑셀 수식 C14/C32 + 내비/하이패스 제외)',
    state: {
      vehicle: { brand: '기아', model: 'K5', variant: '하이브리드', trim_name: '베스트 셀렉션',
        total_manwon: 3502, trim_price_manwon: 3502, options_price_manwon: 0 },
      cond: { credit: '중신용', km: 2, dep: 0, pre: 0, feeRatePct: 5, deliveryCity: '부산',
        svc: '웰스 Basic', insProperty: '1억', extraDriver: '없음', colorIntPrice: 0, discount: 0 },
      tint: { product: '버텍스 300', areas: new Set(['front', 'side_rear_with_coupon']) },
      extras: { blackbox: 'DF7 (딥플라이)', navi: 'RG-i8 (아이나비)', hipass: 'SET-550 (엠피온)' }, // 내비/하이패스 = calc 제외 대상
    },
    scenario: { term: 60, dep: 0, pre: 0 },
    expect: {
      itemsFee: _tint + _blackbox,                       // 썬팅+블박 (내비/하이패스 빠진 값)
      C14: Math.round((_tint + _blackbox) / 1.1),         // 엑셀 C14 = (썬팅+블박)/1.1
      C32: Math.round(FLAT_DELIVERY['부산'] / 1.1),       // 엑셀 C32 = 탁송/1.1
    },
  },
];
