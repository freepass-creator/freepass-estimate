// 견적 입력 조립 — 단일 SSOT
// 웹 ERP(quote.js recompute)·모바일(StickyQuote/SendSheet)·홈(QuoteWidget) 가
// calcQuote 에 넘기는 입력 객체를 각자 따로 만들던 것을 통합.
// ⚠️ 이 파일이 "정답" = quote.js(영업 ERP, 운영 중) 의 입력 조립 로직을 1:1 포팅.
//    어느 한 화면이라도 calcQuote 직접 호출 시 반드시 이 함수를 거칠 것 (드리프트 방지).
//
// 과거 모바일이 웹과 달랐던 원인(이 함수로 모두 제거):
//   1) 용품: 모바일은 내비/하이패스까지 취득원가(C14)에 가산 → 엑셀/웹은 썬팅+블박만.
//   2) 차량가 base: 모바일은 _src(퍼지매칭 DB행) price + 옵션가 → 웹은 total_manwon 직접.
//   3) 메타: 모바일은 StepVehicle 퍼지매칭 → 가격 정확매칭(findVehicleMeta)으로 통일.
//   4) strategic(전략차종 가산): 엑셀 v5.5 는 신용등급에 반영 → forward 가 정답.
//      (웹 quote.js 가 과거 미전달이라 신용 견적이 엑셀보다 높았음 → 같이 forward 로 교정)

import { FLAT_DELIVERY, TINT_PRICES, ACCESSORIES } from '../data/lookups.js';

// === 차량 메타 정확 매칭 ===
// 가격(trim_price_won) 정확 매칭 최우선 → 텍스트 매칭 → brand+model 폴백
// 효율화: 같은 vehicles 배열·같은 쿼리는 캐시 (시나리오 3~6회 반복 호출 시 476배열 재탐색 방지)
const _metaCache = new WeakMap(); // vehicles[] → Map<queryKey, meta>
export function findVehicleMeta(vehicles, brand, model, trim_name, variant, trim_price_won) {
  if (!vehicles?.length) return {};
  let byKey = _metaCache.get(vehicles);
  if (!byKey) { byKey = new Map(); _metaCache.set(vehicles, byKey); }
  const key = `${brand}|${model}|${trim_name}|${variant}|${trim_price_won}`;
  if (byKey.has(key)) return byKey.get(key);
  const result = resolveVehicleMeta(vehicles, brand, model, trim_name, variant, trim_price_won);
  byKey.set(key, result);
  return result;
}

function resolveVehicleMeta(vehicles, brand, model, trim_name, variant, trim_price_won) {
  const isHEV = /하이브리드|HEV/i.test(variant || '');
  const modelCandidates = isHEV ? [`${model} Hybrid`, model] : [model];

  // 0) 가격 정확 매칭 (Excel 차량DB 가격과 1:1) — 최우선
  if (trim_price_won) {
    for (const m of modelCandidates) {
      const exact = vehicles.filter(v =>
        v.brand === brand && v.model === m && v.price === trim_price_won
      );
      if (exact.length === 1) return exact[0];
      if (exact.length > 1) {
        const tokens = [...(variant || '').split(/[\s·,()/]+/), ...(trim_name || '').split(/[\s·,()/]+/)]
          .filter(t => t && t.length >= 1)
          .map(t => t.toLowerCase());
        if (tokens.length) {
          const scored = exact.map(mm => ({
            m: mm,
            score: tokens.reduce((s, t) => s + ((mm.trim || '').toLowerCase().includes(t) ? 1 : 0), 0),
          }));
          scored.sort((a, b) => b.score - a.score);
          if (scored[0].score > 0 && scored[0].score > (scored[1]?.score ?? 0)) return scored[0].m;
          if (trim_name) {
            const tn = exact.find(v => (v.trim || '').includes(trim_name));
            if (tn) return tn;
          }
        }
        return exact[0];
      }
    }
  }
  // 1) 텍스트 매칭 — brand + model + variant + trim_name
  if (trim_name) {
    const variantTokens = (variant || '').split(/[\s·,()]+/).filter(t => t.length > 1);
    for (const m of modelCandidates) {
      const matches = vehicles.filter(v =>
        v.brand === brand &&
        (v.model === m || (v.trim || '').includes(m)) &&
        (v.trim || '').includes(trim_name)
      );
      if (matches.length === 1) return matches[0];
      if (matches.length > 1 && variantTokens.length) {
        const scored = matches.map(mm => ({
          m: mm, score: variantTokens.reduce((s, t) => s + ((mm.trim || '').includes(t) ? 1 : 0), 0)
        }));
        scored.sort((a, b) => b.score - a.score);
        if (scored[0].score > 0) return scored[0].m;
      }
      if (matches.length) return matches[0];
    }
  }
  // 2) 폴백 — brand + model 만
  for (const m of modelCandidates) {
    const f = vehicles.find(v => v.brand === brand && v.model === m);
    if (f) return f;
  }
  return {};
}

// === 용품 취득원가(C14) 합 — 썬팅 + 블박만 (엑셀 C14=ROUND((BC15+BC17)/1.1)) ===
// ⚠️ 내비/하이패스는 엑셀 어디에도 참조 안 됨 → calc 입력에서 제외 (견적서 표시는 별도).
function itemsFeeForCalc(state) {
  const tintProduct = state?.tint?.product;
  const tintAreas = state?.tint?.areas;
  let tintFee = 0;
  if (tintProduct && tintAreas?.size) {
    const map = TINT_PRICES[tintProduct] || {};
    tintAreas.forEach((a) => { tintFee += map[a] || 0; });
  }
  const blackboxFee = ACCESSORIES.blackbox[state?.extras?.blackbox] || 0;
  return tintFee + blackboxFee;
}

// === calcQuote 입력 객체 1벌 생성 (quote.js recompute 와 100% 동일) ===
// @param state    quoteState (웹·모바일 공유 store)
// @param sc       시나리오 { term, dep, pre }
// @param vehicles vehicles.json 배열 (웹=VEHICLES, 모바일=window.__welrix_vehicles)
export function buildCalcInput(state, sc, vehicles) {
  const v = state.vehicle || {};
  const cond = state.cond || {};
  const meta = findVehicleMeta(
    vehicles || [], v.brand, v.model, v.trim_name, v.variant,
    (v.trim_price_manwon || 0) * 10000
  );

  // 차량가 = total_manwon(트림+옵션) × 1만 + 내장색상가 (웹과 동일, optPrice=0)
  const totalKrw = (v.total_manwon || 0) * 10000 + (cond.colorIntPrice || 0);

  const vehicleRow = {
    brand: meta.brand || v.brand,
    model: meta.model || v.model,
    trim: meta.trim || `${v.brand} ${v.model} ${v.trim_name}`,
    price: totalKrw,
    disp: meta.disp || 2000,
    fuel: meta.fuel || '가솔린',
    tax_exempt: v.tax_rate === '5%' ? '과세' : (meta.tax_exempt || '과세'),
    group: meta.group || 'A군',
    multi_seat: meta.multi_seat,
    r24: meta.r24 ?? 0.65, r36: meta.r36 ?? 0.55, r48: meta.r48 ?? 0.48, r60: meta.r60 ?? 0.40,
    // strategic(전략차종 잔가가산) 전달 — 엑셀 차량DB col O. 신용등급에만 반영됨. (col P '인수가적용'은 calc 미사용)
    strategic: meta.strategic ?? 0,
  };

  return {
    vehicle: vehicleRow,
    options: {
      optPrice: 0,
      discount: (cond.discount || 0) * 10000,
      deliveryFee: FLAT_DELIVERY[cond.deliveryCity] || 0,
      itemsFee: itemsFeeForCalc(state),
      etc: 0,
    },
    contract: {
      term: sc.term,
      km: (cond.km ?? 2) + '만km',
      dep: +sc.dep || 0,
      pre: +sc.pre || 0,
    },
    customer: { creditGrade: cond.credit || '중신용' },
    insurance: {
      property: cond.insProperty || '1억',
      extraDriver: cond.extraDriver || '없음',
      exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
      deductible: '30만원~', emergency: '가입',
    },
    fees: { feeRatePct: cond.feeRatePct ?? 5.0, svc: cond.svc || '웰스 Basic' },
  };
}
