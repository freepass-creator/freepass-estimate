// ============================================================================
// 화면 상태 → provider-neutral 견적 요청
// UI는 계산 공급자를 모른다. 차량/조건의 사실만 싣고 provider가 자기 방식으로 해석한다.
// ============================================================================
import { quoteState, vehicleState } from '../../store.js';
import * as Fees from '../compute-fees.js';
import { 탁송, 썬팅값, 블박값 } from '../welrix-rates.js';
import { 담당자인가 } from '../role.js';

function 색추가금() {
  try {
    const DB = window.VEHICLE_DB;
    const b = DB?.manufacturers?.find((m) => m.manufacturer_id === vehicleState.manufacturer);
    const md = b?.models?.find((m) => m.model_id === vehicleState.model);
    return (md?.exterior_colors?.[vehicleState.color]?.price || 0) * 10000;
  } catch { return 0; }
}

/** @returns {object|null} provider-neutral quote request */
export function 요청만들기() {
  const c = quoteState.cond || {};
  const v = quoteState.vehicle || {};
  const src = v._src || {};
  const 키 = vehicleState.trim;
  if (!키) return null;

  const 옵션 = Fees.optPrice(quoteState);
  const 외장색 = 색추가금();
  const 내장색 = c.colorIntPrice || 0;
  const 할인 = 담당자인가() ? (c.discount || 0) * 10000 : 0;
  const 트림가 = (v.trim_price_manwon || 0) * 10000;

  // 현재 FreePass 표준 calc 후보가 historically 사용하던 가격 기준을 그대로 보존한다.
  // UI/Provider 구조 정리 단계에서 계산 기준까지 동시에 바꾸지 않는다.
  const 표준계산차량가 = (v.total_manwon || 0) * 10000 + 내장색;

  return {
    버전: 1,
    차: {
      종류: '신차',
      키,                              // 외부 adapter가 차량을 식별할 때 쓰는 canonical key
      브랜드: v.brand || src.brand || '',
      모델: v.model || src.model || '',
      파워트레인: v.variant || '',
      트림: v.trim_name || src.trim || '',
      배기량: src.disp || v.displacement_cc || 0,
      연료: src.fuel || v.fuel || '',
      과세구분: src.tax_exempt || '과세',
      그룹: src.group || 'A군',
      다인승: src.multi_seat,
      전략차종: src.strategic ?? 0,
      잔가: {
        24: src.r24,
        36: src.r36,
        48: src.r48,
        60: src.r60,
      },
      가격: {
        트림: 트림가,
        옵션,
        외장색,
        내장색,
        할인,
        표준계산차량가,
      },

      // v1 compatibility aliases — 기존 Welrix adapter와 과거 검사기를 깨지 않는다.
      차량가: 0,
      옵션가: 옵션,
      색추가금: 외장색,
      할인,
    },
    조건: {
      신용: c.credit || '중신용',
      주행: (c.km ?? 2) + '만km',
      정비: c.svc || '웰스 Basic',
      대물: c.insProperty || '1억',
      추가운전자: c.extraDriver || '없음',
      탁송비: 탁송[c.deliveryCity] ?? 탁송['서울'],
      썬팅비: 썬팅값(quoteState.tint?.product),
      블박비: 블박값(quoteState.extras?.blackbox),
      수수료율: +c.feeRatePct || 0,
    },
    안들: (quoteState.scenarios || []).map((sc) => ({
      기간: sc.term,
      보증금: +sc.dep || 0,
      선납: +sc.pre || 0,
    })),
  };
}
