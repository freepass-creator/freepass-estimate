// ============================================================================
//  화면 상태 → 견적 요청   (계산기와 무관한 «뼈대» 몫)
// ----------------------------------------------------------------------------
//  여기서는 «어디 탁송인지»·«무슨 썬팅인지» 같은 고름을 금액으로 다 풀어 놓는다.
//  계산기는 금액만 받는다 — 그래야 계산기가 우리 요율표를 몰라도 된다.
// ============================================================================
import { quoteState, vehicleState } from '../../store.js';
import * as Fees from '../compute-fees.js';
import { 탁송, 썬팅값, 블박값 } from '../welrix-rates.js';
import { 담당자인가 } from '../role.js';

/** 고른 외장색의 추가금 (원) */
function 색추가금() {
  try {
    const DB = window.VEHICLE_DB;
    const b = DB?.manufacturers?.find((m) => m.manufacturer_id === vehicleState.manufacturer);
    const md = b?.models?.find((m) => m.model_id === vehicleState.model);
    return (md?.exterior_colors?.[vehicleState.color]?.price || 0) * 10000;
  } catch { return 0; }
}

/** @returns {object|null} 규격(spec.js)에 맞는 요청. 차를 안 골랐으면 null */
export function 요청만들기() {
  const c = quoteState.cond || {};
  const 키 = vehicleState.trim;      // ★welrix-db 의 trim_id = 웰릭스 model 문자열
  if (!키) return null;

  return {
    차: {
      종류: '신차',                   // 중고차 뼈대가 붙으면 여기서 갈린다
      키,
      차량가: 0,                      // ★신차는 계산기(웰릭스)가 키로 값을 안다. 중고차는 여기에 실린다
      옵션가: Fees.optPrice(quoteState),
      색추가금: 색추가금(),
      /* ★손님은 할인을 못 넣는다 — 칸이 없어도 예전 값이 남아 있을 수 있어 여기서 한 번 더 막는다 */
      할인: 담당자인가() ? (c.discount || 0) * 10000 : 0,
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
