// ============================================================================
// 화면 상태 → provider-neutral 견적 요청
// UI는 계산 공급자를 모른다. 차량/조건의 사실만 싣고 provider가 자기 방식으로 해석한다.
// ============================================================================
import { quoteState, vehicleState } from '../../store.js';
import * as Fees from '../compute-fees.js';
import { 탁송, 썬팅값, 블박값 } from '../welrix-rates.js';
import { 담당자인가 } from '../role.js';
import { QUOTE_REQUEST_CONTRACT, LEGACY_QUOTE_VERSION } from './contracts.js';

function 색추가금() {
  const v = quoteState.vehicle || {};
  return Math.round((Number(v.color_price_manwon) || 0) * 10000);
}

export function 계산차량가({ trimPrice = 0, optionPrice = 0, exteriorColorPrice = 0, interiorColorPrice = 0, discount = 0 } = {}) {
  const values = [trimPrice, optionPrice, exteriorColorPrice, interiorColorPrice, discount].map(Number);
  if (!values.every(Number.isFinite)) {
    const error = new Error('차량 가격 구성값이 올바르지 않습니다');
    error.code = 'QUOTE_PRICE_COMPONENT_INVALID';
    throw error;
  }
  return Math.max(0, values[0] + values[1] + values[2] + values[3] - values[4]);
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

  // 차량가 기준은 상품마스터 한 기준으로 다시 조립한다.
  // 트림 + 일반옵션 + 외/내장색 - 할인. 구성축(AWD/인승)이 외부 provider 완성차에
  // 이미 흡수되는지는 adapter가 별도로 처리한다.
  const 표준계산차량가 = 계산차량가({
    trimPrice: 트림가,
    optionPrice: 옵션,
    exteriorColorPrice: 외장색,
    interiorColorPrice: 내장색,
    discount: 할인,
  });

  return {
    계약: QUOTE_REQUEST_CONTRACT,
    버전: LEGACY_QUOTE_VERSION,
    차: {
      종류: '신차',
      키,                              // FreePass product id. 외부 adapter가 자기 key로 번역한다.
      상품키: v._product_id || 키,
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
        기준전: Number(v._price_before_won ?? v._trim_meta?._price_before_won ?? 0),
        기준후: Number(v._price_after_won ?? v._trim_meta?._price_after_won ?? 0),
        기준명: v._price_basis ?? v._trim_meta?._price_basis ?? '',
      },
      구성: {
        기본축: v._base_axes || {},
        canonical: v._canonical || null,
        선택옵션: Array.isArray(v._selected_options) ? v._selected_options : [],
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
