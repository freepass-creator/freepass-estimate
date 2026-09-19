// FreePass standard new-car quote engine.
// This uses the current local calculation asset as the initial standard-engine candidate.
// It is NOT the production default until regression parity and policy review pass.

import { calcQuote } from '../../calc.js';

export const 이름 = 'FreePass 표준';
export const 다루는차 = ['신차'];

function 입력(요청, 안) {
  const 차 = 요청.차 || {};
  const 가격 = 차.가격 || {};
  const 잔가 = 차.잔가 || {};
  const 조건 = 요청.조건 || {};

  return {
    vehicle: {
      brand: 차.브랜드 || '',
      model: 차.모델 || '',
      trim: 차.트림 || 차.키 || '',
      price: 가격.표준계산차량가 || 0,
      disp: 차.배기량 || 2000,
      fuel: 차.연료 || '가솔린',
      tax_exempt: 차.과세구분 || '과세',
      group: 차.그룹 || 'A군',
      multi_seat: 차.다인승,
      r24: 잔가[24] ?? 0.65,
      r36: 잔가[36] ?? 0.55,
      r48: 잔가[48] ?? 0.48,
      r60: 잔가[60] ?? 0.40,
      strategic: 차.전략차종 ?? 0,
    },
    options: {
      // Current FreePass candidate calc historically receives configured vehicle price
      // with trim/options already included. Keep optPrice=0 to preserve that baseline.
      optPrice: 0,
      discount: 가격.할인 || 0,
      deliveryFee: 조건.탁송비 || 0,
      itemsFee: (조건.썬팅비 || 0) + (조건.블박비 || 0),
      etc: 0,
    },
    contract: {
      term: 안.기간,
      km: 조건.주행 || '2만km',
      dep: +안.보증금 || 0,
      pre: +안.선납 || 0,
    },
    customer: { creditGrade: 조건.신용 || '중신용' },
    insurance: {
      property: 조건.대물 || '1억',
      extraDriver: 조건.추가운전자 || '없음',
      exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
      deductible: '30만원~', emergency: '가입',
    },
    fees: {
      feeRatePct: 조건.수수료율 ?? 5,
      svc: 조건.정비 || '웰스 Basic',
    },
  };
}

export async function 계산(요청) {
  const 결과 = 요청.안들.map((안) => {
    const r = calcQuote(입력(요청, 안));
    return {
      월대여료: r.monthly,
      보증금: r.depositAmt,
      선납금: r.prePayAmt,
      인수가: r.residualAmt,
      총차량가: r.totalPrice,
      수수료: r.feeAmount,
    };
  });

  return {
    차량가: 요청.차?.가격?.표준계산차량가 ?? null,
    결과,
  };
}
