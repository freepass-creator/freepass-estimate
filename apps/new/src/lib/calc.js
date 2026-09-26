// LEGACY REGRESSION ASSET ONLY — runtime authority가 아니다.
// 운영 견적 정본은 api/_standard/calc.js + src/lib/quote/* Quote Core다.
// 이 파일을 화면/runtime에서 다시 import하면 check-quote-core-convergence가 실패해야 한다.
// welrix 견적 계산 엔진 v1.0 — 과거 엑셀 견적1 시트 121개 수식 정밀 포팅
// 출력 H34 (최종 월 대여료) = ROUNDDOWN((H27+H28-H32),-3) + 추가운전자 + 기간가산절사

// ============ Excel PMT/IPMT 함수 정확 구현 ============
export function pmt(rate, nper, pv, fv = 0, type = 0) {
  if (rate === 0) return -(pv + fv) / nper;
  const pvif = Math.pow(1 + rate, nper);
  return -(rate * (pv * pvif + fv)) / ((1 + rate * type) * (pvif - 1));
}

// 엑셀 IPMT — per번째 회차의 이자 부분
export function ipmt(rate, per, nper, pv, fv = 0, type = 0) {
  if (rate === 0) return 0;
  const pmtVal = pmt(rate, nper, pv, fv, type);
  const pvif = Math.pow(1 + rate, per - 1);
  let ipmtVal = -(pv * pvif * rate + pmtVal * (pvif - 1));
  if (type === 1) {
    if (per === 1) return 0;
    ipmtVal = ipmtVal / (1 + rate);
  }
  return ipmtVal;
}

// 누적 이자 = sum(IPMT(per)) for per=1..nper (엑셀 AL5와 동일)
export function totalInterest(rate, nper, pv) {
  let sum = 0;
  for (let per = 1; per <= nper; per++) {
    sum += -ipmt(rate, per, nper, pv);  // 엑셀: -IPMT(rate, per, nper, pv)
  }
  return sum;
}

// 엑셀 ROUNDDOWN(x, -3) — 0 방향 절사 (양수는 내림, 음수는 올림)
// Math.floor는 음수일 때 더 작은 정수로 가버리므로 trunc 사용
const floor1k = (n) => Math.trunc(n / 1000) * 1000;
const round = (n) => Math.round(n);

// ============ 회사별 정책 (외부 주입 가능) ============
// 기본 정책 = 웰릭스 모빌리티 (현재 운영 정책)
// 다른 회사용 견적기는 calcQuote(input, companyConfig) 호출 시 companyConfig 로 오버라이드
const DEFAULT_CFG = {
  credit_lookup: {
    '신용':   { interest: 0.064, profit: 0.019, deposit: 0.05 },
    '고신용': { interest: 0.064, profit: 0.019, deposit: 0.05 },
    '중신용': { interest: 0.064, profit: 0.043, deposit: 0.20 },
    '저신용': { interest: 0.064, profit: 0.084, deposit: 0.30 },
    '무신용': { interest: 0.064, profit: 0.084, deposit: 0.30 },
  },
  costs: {
    registration_fee: 200000,
    acquisition_tax_rate: 0.04,
    acquisition_tax_rate_porter: 0.05,
    delivery_first: 500000,
    repair_rate_annual: 0.02,
  },
  fees: {
    deposit_discount_rate: 0.03,
    default_fee_rate_pct: 5.0,
    payback_table: [
      [0,   700000], [0.5, 630000], [1.0, 560000], [1.5, 490000],
      [2.0, 420000], [2.5, 350000], [3.0, 280000], [3.5, 210000],
      [4.0, 140000], [4.5,  70000], [5.0,      0],
    ],
    commission: { low_credit_cap: 3000000 },
  },
  services: {
    wells_basic_monthly: 12900,
    wells_self_yearly: 96000,
    gps_monthly: 11000,
    inspection_fee_yearly: 76000,  // 정기검사비 (1~2년차 면제, 3년차 이후 적용)
  },
  residuals: {
    km_adjustment: { '1만km': 0.02, '2만km': 0, '3만km': -0.04, '4만km': -0.10 },
    term_surcharge: {
      // Excel I22 제외조건은 AW10/AW11 cell ref 오류로 사실상 항상 false → 모든 차에 기간가산.
      // welrix.json(런타임 SSOT)과 동일하게 exclude 비움. (제네시스/K9/하이리무진은 brand_adjustment 로 별도 반영)
      exclude: { brands: [], models: [] },
      by_term_code: { 3: 0.05, 4: -0.005, 5: -0.03 },
    },
    brand_adjustment: { '제네시스': -0.18, 'K9': -0.15, '하이리무진': -0.15 },  // v6.1: 제네시스 -20% → -18%
    buyback_rate_add: {
      // Excel I6: IF(고신용,0%, IF(중신용,2%, 4%)) — 신용/저신용/무신용은 cascade default 4%
      by_credit: { '신용': 0.04, '고신용': 0, '중신용': 0.02, '저신용': 0.04, '무신용': 0.04 },
      by_brand: { '제네시스': 0.23 },  // v6.1: 제네시스 인수가율 가산 25% → 23%
      by_model: { 'K9': 0.20, '하이리무진': 0.20 },
    },
    credit_premium: { '신용': 0, '고신용': 0, '중신용': 0.03, '저신용': 0.05, '무신용': 0 },
  },
  insurance: {
    base_normal: 820750,
    base_multi_seat: 732880,
    base_porter: 2000000,  // v5.5: 1,400,000 → 2,000,000
    property_extra: { '1억': 0, '2억': 10000, '3억': 20000, '5억': 30000 },
  },
  extra_driver: { '없음': 0, '1명': 50000, '2명': 100000, '3명': 150000 },
  deposit_buckets_step: 500000,
  deposit_buckets_max: 10000000,  // v6.1: 보증금 클램프 상한 750만 → 1,000만
};

// 모듈 레벨 활성 정책 (setCompanyConfig 로 교체 가능)
let CFG = DEFAULT_CFG;
// 동기화 검사 도구(scripts/check-sync.mjs)용 — 기본정책/활성정책 조회
export function getDefaultConfig() { return DEFAULT_CFG; }
export function getActiveConfig() { return CFG; }
export function setCompanyConfig(cfg) {
  // 회사 config 를 DEFAULT 와 deep merge (누락 필드는 default 유지)
  if (!cfg || !cfg.financial) { CFG = DEFAULT_CFG; return; }
  const f = cfg.financial;
  CFG = {
    credit_lookup: f.credit_lookup || DEFAULT_CFG.credit_lookup,
    costs: { ...DEFAULT_CFG.costs, ...(f.costs || {}) },
    fees: {
      ...DEFAULT_CFG.fees, ...(f.fees || {}),
      payback_table: (f.fees?.payback_table || []).length
        ? f.fees.payback_table.map((p) => [p.rate, p.payback])
        : DEFAULT_CFG.fees.payback_table,
    },
    services: { ...DEFAULT_CFG.services, ...(f.services || {}) },
    residuals: { ...DEFAULT_CFG.residuals, ...(f.residuals || {}) },
    insurance: { ...DEFAULT_CFG.insurance, ...(f.insurance || {}) },
    extra_driver: { ...DEFAULT_CFG.extra_driver, ...(f.extra_driver || {}) },
    deposit_buckets_step: f.deposit_buckets_step || DEFAULT_CFG.deposit_buckets_step,
    deposit_buckets_max: f.deposit_buckets_max || DEFAULT_CFG.deposit_buckets_max,
  };
}

// 포터 차종 판별 (보험료/취득세율 분기 공용)
function isPorterVehicle(v) {
  return /포터/.test(v.trim || '') || /포터/.test(v.model || '');
}

// 정기검사 (3~8년차 동일 / 1~2년차 면제, 신차 2년까지 유예)
// 엑셀 F11(termCode): 2=24M=0회, 3=36M=1회, 4=48M=2회, 5=60M=3회
function inspectionFee(termCode) {
  const fee = CFG.services.inspection_fee_yearly ?? 76000;
  if (termCode === 5) return fee * 3;
  if (termCode === 4) return fee * 2;
  if (termCode === 3) return fee;
  return 0;
}

// 페이백 (수수료율에 따른 슬라이딩 테이블, 회사 config)
function payback(feeRatePct) {
  const table = CFG.fees.payback_table;
  if (feeRatePct >= table[table.length - 1][0]) return 0;
  for (const [r, p] of table) {
    if (feeRatePct <= r) return p;
  }
  return 0;
}

// 자동차세 = 배기량 × (cc당 단가) × 1.3 (지방교육세 30%)
function autoTax(disp) {
  const perCC = disp <= 1600 ? 18 : disp < 2500 ? 19 : 24;
  return disp * perCC * 1.3;
}

// 보증금 계산 (F13) — Excel v6.1:
//   MEDIAN(500000, 10000000, IF(BC6="저신용", CEILING(C20*dep, 500000), ROUND(C20*dep, -5)))
//   · 저신용 = 50만원 단위 '올림'(CEILING)  · 그 외 = 10만원 단위 반올림(ROUND)  · [500k,10M] 클램프
function depositAmount(C20, depositRate, creditGrade) {
  const v = C20 * depositRate;
  if (v === 0) return 0;
  const inner = creditGrade === '저신용'
    ? Math.ceil(v / 500000) * 500000      // CEILING(v, 500000) — 저신용은 올림(높은 쪽)
    : Math.round(v / 100000) * 100000;     // ROUND(v, -5)
  return Math.max(500000, Math.min(10000000, inner));
}

// 약정주행거리 → 잔가율 보정 (회사 config)
function kmAdj(kmStr) {
  return CFG.residuals.km_adjustment[kmStr] ?? 0;
}

// 기간 가산 (I22)
function termSurcharge(termCode, brand, model) {
  const ts = CFG.residuals.term_surcharge;
  const exBrands = ts.exclude?.brands || ts.exclude_brands || [];
  const exModels = ts.exclude?.models || ts.exclude_models || [];
  if (exBrands.includes(brand) || exModels.includes(model)) return 0;
  return ts.by_term_code[termCode] ?? 0;
}

// 인수가율 가산 (I6) — 신용등급별 + 차종별
function buybackRateAdd(creditGrade, brand, model) {
  const r = CFG.residuals.buyback_rate_add;
  let v = r.by_credit[creditGrade] ?? r.by_credit['중신용'] ?? 0;
  v += r.by_brand[brand] ?? 0;
  v += r.by_model[model] ?? 0;
  return v;
}

// 잔가율 가산 (제네시스/K9/하이리무진 차감)
function residualBrandAdj(brand, model) {
  const adj = CFG.residuals.brand_adjustment;
  return (adj[brand] ?? 0) + (adj[model] ?? 0);
}

// 자동차보험 기본 (I10)
function baseInsurance(vehicle, insuranceProperty) {
  const ins = CFG.insurance;
  if (isPorterVehicle(vehicle)) return ins.base_porter;
  const isMulti = vehicle.multi_seat === '다인승';
  const base = isMulti ? ins.base_multi_seat : ins.base_normal;
  return base + (ins.property_extra[insuranceProperty] ?? 0);
}

// 추가운전자 (F31/H31)
function extraDriverFee(extra) {
  return CFG.extra_driver[extra] ?? 0;
}

// ============ 메인 견적 계산 ============
/**
 * @param {object} input
 * @param {object} input.vehicle  — { brand, model, trim, price, disp, fuel, tax_exempt, group, r24, r36, r48, r60, strategic, multi_seat }
 * @param {object} input.options  — { optPrice, discount, deliveryFee, tintFee, blackboxFee, etc }
 * @param {object} input.contract — { term: 24|36|48|60, km: '1만km'|'2만km'|'3만km'|'4만km', dep: %, pre: % }
 * @param {object} input.customer — { creditGrade: '신용'|'중신용'|'저신용'|'무신용' }
 * @param {object} input.insurance — { property: '1억'|'2억'|..., extraDriver: '없음'|'1명'|... }
 * @param {object} input.fees     — { feeRatePct: 5.0, svc: '웰스 Basic'|'웰스 Self' }
 * @returns {{ monthly, supply, vat, totalPrice, netPrice, residualPct, residualAmt, depositAmt, prePayAmt, feeAmount }}
 */
export function calcQuote(input) {
  const v = input.vehicle;
  const o = input.options || {};
  const c = input.contract;
  const cu = input.customer || {};
  const ins = input.insurance || {};
  const fees = input.fees || {};

  const termCode = c.term / 12;       // F11
  const term = c.term;                // 개월수
  const M8 = 1.141041;                // 총액 계수 (엑셀 v6.1도 이 값 유지 — 개소세율만 5%로 상향, M8은 미변경)
  const credit = CFG.credit_lookup[cu.creditGrade] || CFG.credit_lookup['중신용'];

  // ====== 1. 차량 가격 ======
  const C5 = v.price || 0;
  const C6 = (o.optPrice || 0) - (o.discount || 0);
  const C7 = C5 + C6;                                       // 소비자가
  const C20 = C7;
  const isExempt = v.tax_exempt === '면세';

  // ====== 2. 공장도가/과세표준/개소세/부가세 ======
  const C8 = isExempt ? round(C7 / 1.1) : round(C7 / M8);   // 공급가액
  const F8 = round(C8 * 0.82);                              // 과세표준
  const C9 = isExempt ? 0 : round(F8 * 0.05 + F8 * 0.05 * 0.3);  // 개소세(v6.1: 5%)+교육세(30%)
  const C10 = isExempt ? round(C8 * 0.1) : (C8 + C9) * 0.1; // 부가세
  const isPorter = isPorterVehicle(v);

  // ====== 3. 취득가/취득원가 ======
  const C11 = C8 + C9;                                      // 취득가액
  const acqRate = isPorter ? CFG.costs.acquisition_tax_rate_porter : CFG.costs.acquisition_tax_rate;
  const C12 = round(C11 * acqRate);                         // 취득세 (회사 config)
  const C13 = CFG.costs.registration_fee;                   // 등록비 (회사 config)
  // 용품 합계 (블박/썬팅/내비/하이패스 등) — C14 취득원가 (VAT 제외)
  const itemsFee = (o.itemsFee != null)
    ? o.itemsFee
    : ((o.blackboxFee || 0) + (o.tintFee || 0) + (o.naviFee || 0) + (o.hipassFee || 0));
  const C14 = round(itemsFee / 1.1);
  const C15 = C11 + C12 + C13 + C14;                        // 취득원가
  const C22 = C15;
  const F22 = C22;

  // ====== 4. 잔가율 ======
  // ⭐ Excel 차량DB col O = "전략차종" (가솔린/하이브리드 0.08, LPG 0). col P "인수가적용" 은 사용 안 함.
  // vehicles.json mapping: col O → v.strategic, col P → v.buyback_apply (legacy 이름, 실제 calc 미사용)
  const strategicBonus = v.strategic || 0;

  // I3: 차량별 잔가율 + 전략차종 가산(신용만) + 제네시스/K9/하이리무진 가산
  // Excel: VLOOKUP D:O col 12 = 전략차종 + IF("신용", strategic, 0)
  const residualBase = (v[`r${term}`] ?? 0.5) +
    (cu.creditGrade === '신용' ? strategicBonus : 0) +
    residualBrandAdj(v.brand, v.model);

  // I4: 주행거리 보정
  const I4 = residualBase + kmAdj(c.km || '2만km');

  // I5: 매각잔가 가산 (Excel: IF("신용", strategic, 4%))
  const I5 = cu.creditGrade === '신용'
    ? strategicBonus
    : 0.04;

  // I6: 인수가율 가산
  const I6 = buybackRateAdd(cu.creditGrade, v.brand, v.model);

  // C23: 만기인수금액 = C20 × (I4+I5+I6)  — 엑셀: ROUND 없음 (부동소수)
  const C23 = C20 * (I4 + I5 + I6);
  const residualPct = I4 + I5 + I6;

  // C24: 차량잔가 = C22 × (I4+I5)  — 엑셀: ROUND 없음 (PMT 인자로 부동소수 유지)
  const C24 = C22 * (I4 + I5);
  const C25 = C22 - C24;

  // ====== 5. 가산원가 항목 (C26~C37) ======
  const I7 = round((C22 + C10) * 0.9);                      // 대출액 = (취득원가+부가세)×90%
  const I8 = credit.interest;                               // 대출이자율 (예 6.4%)
  // I9: 대출이자 — 엑셀 목록박스_정리필요!AL5 = SUM(-IPMT(I8/12, per, nper, I7))
  // 회차별 IPMT 누적 (엑셀과 동일한 부동소수 누적 순서)
  // 엑셀 IPMT 4번째 인자: 양수 pv (대출액 I7), 결과 음수 → -IPMT로 양수화
  const I9 = totalInterest(I8 / 12, termCode * 12, I7);

  const I10 = baseInsurance(v, ins.property);
  const I14 = CFG.costs.repair_rate_annual;                 // 자동차 수리 (회사 config)
  const I15 = autoTax(v.disp || 1600);
  const I16 = inspectionFee(termCode);
  const I17 = fees.svc === '웰스 Self' ? CFG.services.wells_self_yearly
                                       : CFG.services.wells_basic_monthly * 12;
  const I18 = o.deliveryFee || 0;
  const I19 = CFG.services.gps_monthly * 12;                // GPS (회사 config)
  const feeRatePct = fees.feeRatePct ?? CFG.fees.default_fee_rate_pct;
  const feeRate = feeRatePct / 100;

  // I20: 영업수당 (회사 config — 저신용 cap)
  let I20 = 0;
  if (cu.creditGrade === '저신용') I20 = Math.min(C20 * feeRate, CFG.fees.commission.low_credit_cap);
  else if (cu.creditGrade === '중신용') I20 = C20 * feeRate;
  // 고신용/신용/무신용: I20 = 0 (또는 빈값) → 가산원가 미반영

  // I21: 신용 가산 (회사 config)
  const I21 = CFG.residuals.credit_premium[cu.creditGrade] ?? 0;

  // I22: 기간 가산
  const I22 = termSurcharge(termCode, v.brand, v.model);

  // F13: 보증금 (신용등급별 — 저신용 올림)
  const F13 = depositAmount(C20, c.dep / 100, cu.creditGrade);
  const F14 = c.pre / 100;                                  // 선납금률

  // 가산원가 항목들 (5년 누적 또는 1회성)
  const C26 = I9;                                           // 대출이자
  const C27 = I10 / 1.1 * termCode;                         // 자동차보험 (5년분)
  const C28 = C22 * I14 * termCode;                         // 자동차 수리 (5년분)
  const C29 = I15 * termCode;                               // 자동차세 (5년분)
  const C30 = I16;                                          // 정기검사
  const C31 = I17 / 1.1 * termCode;                         // 정비 (5년분)
  const C32 = I18 / 1.1;                                    // 탁송 (가산원가 부분)
  const C33 = I19 / 1.1 * termCode;                         // GPS (5년분)
  const C34 = I20;                                          // 영업수당
  const C35 = CFG.costs.delivery_first;                     // 1차탁송료 (회사 config)
  const C36 = payback(feeRatePct);                          // 페이백 (회사 config)
  const C37 = -F13 * CFG.fees.deposit_discount_rate * termCode;  // 보증금할인 (회사 config)

  const F23 = C26 + C27 + C28 + C29 + C30 + C31 + C32 + C33 + C34 + C35 + C36 + C37;
  const F21 = F22 + F23;

  // ====== 6. PMT 산출대여료 ======
  const F20 = credit.profit;                                // 수익률 (월별로 분배)
  const F25 = pmt(F20 / 12, termCode * 12, -F22, C24, 0);   // 산출대여료 (취득원가 환산)
  const F26 = F23 / (termCode * 12);                        // 가산원가 환산
  const F27 = F25 + F26;                                    // 산출대여료
  const H27 = F27 + F27 * I21;                              // 신용가산 산출대여료
  const H28 = H27 * 0.1;

  // 선납차감
  const C41 = F14 * C20;                                    // 선수금
  const C42 = C41 / (termCode * 12);                        // 선수금 월계산
  const H32 = C42;

  // 추가운전자
  const H31 = extraDriverFee(ins.extraDriver);

  // H33: 선납차감 후 청구액(절사)
  const H33 = floor1k(H27 + H28 - H32) + H31;

  // H34: 최종 월 대여료 (기간가산 적용)
  // 엑셀 v6.1: H34 = H33 + ROUNDDOWN(H33*I22,-3) — 기간가산 기준 = 청구액(VAT포함·절사) H33.
  // (엑셀 캐시값 정밀 대조 확인: 아반떼 샘플 H33 기준=477,000 = 엑셀 일치 / 과거 H27 기준=478,000 오차)
  const H34 = H33 + floor1k(H33 * I22);

  // ====== 7. 최종 출력 ======
  // 개소세제외 차량가격 = 총가 - 개소세교육세 (면세시 = 총가)
  const netPriceCar = C7 - C9;
  return {
    monthly: H34,                          // 최종 월 대여료
    supply: round(H27),                    // 공급가액 (신용가산)
    vat: round(H28),                       // 부가세
    totalPrice: C7,                        // 총 차량가
    netPrice: netPriceCar,                 // 개소세제외 차량가격 (수수료 기준)
    residualPct,                           // 잔가율 (I4+I5+I6)
    residualAmt: C23,                      // 만기인수금액
    depositAmt: F13,                       // 보증금 액수 (= 엑셀 F13, 반올림·올림·클램프 반영)
    prePayAmt: round(C20 * c.pre / 100),   // 선납금 액수
    feeAmount: round(netPriceCar * feeRate), // 지급 수수료 = (총가-개소세) × 수수료율
    // 디버그
    _debug: {
      C7, C8, C9, C10, C11, C12, C13, C14, C15,
      C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37,
      F8, F13, F22, F23, F25, F26, F27, H27, H28, H32, H33, H34,
      I4, I5, I6, I9, I10, I20, I21, I22,
      _I15: I15,
    },
  };
}
