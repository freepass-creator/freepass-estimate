import { readFileSync } from 'node:fs';
import { computeTerm } from './calc.js';

const DEFAULTS = JSON.parse(readFileSync(new URL('./standard-quote-defaults.snapshot.json', import.meta.url), 'utf8'));
const DELTA = JSON.parse(readFileSync(new URL('./data/residual-delta.json', import.meta.url), 'utf8'));
const ENGINE_FACTS = JSON.parse(readFileSync(new URL('./data/engine-facts.json', import.meta.url), 'utf8'));

const STANDARD = { 1: 85, 2: 75, 3: 66, 4: 58, 5: 51, 6: 44, 7: 38, 8: 33 };
const TERM_YEAR = { 24: 2, 36: 3, 48: 4, 60: 5 };

const S = (v) => String(v ?? '').trim();
const N = (v) => S(v).toLowerCase()
  .replace(/hybrid|electric|하이브리드|일렉트릭|전기차/gi, '')
  .replace(/[\s·,()\[\]{}_\"'’”&+.-]/g, '');

const MAKER_CODE = {
  '현대': 'hyundai',
  '기아': 'kia',
  '제네시스': 'genesis',
  'KG모빌리티': 'kg',
  'KGM': 'kg',
  '쉐보레': 'chevrolet',
  '르노': 'renault',
  '르노코리아': 'renault',
};

export function engineFuel(label) {
  const f = S(label);
  const u = f.toUpperCase();
  if (/수소/.test(f)) return 'hydrogen';
  if (/플러그인/.test(f) || /PHEV/.test(u)) return 'hybrid';
  if (/전기/.test(f) || /ELECTRIC/.test(u) || /(^|[^A-Z])EV([^A-Z]|$)/.test(u)) return 'ev';
  if (/하이브리드/.test(f) || /HEV/.test(u)) return 'hybrid';
  if (/LPG|LPI|바이퓨얼/.test(u)) return 'lpg';
  if (/디젤/.test(f) || /DIESEL/.test(u)) return 'diesel';
  return 'gasoline';
}

function ccFromOfficialFacts(car) {
  const maker=S(car?.브랜드);
  const model=S(car?.모델);
  const fuel=engineFuel(car?.연료 || car?.파워트레인);
  const selected=(car?.구성?.선택옵션 || []).map((o) => S(o?.name)).filter(Boolean).join(' ');
  const trim=S(car?.트림);

  // More specific option rules win over base-model rules.
  const rules=[...(ENGINE_FACTS?.rules || [])].sort((a,b) => Number(!!b.option_regex)-Number(!!a.option_regex));
  for (const r of rules) {
    if (S(r.maker) && S(r.maker)!==maker) continue;
    if (S(r.model_contains) && !model.includes(S(r.model_contains))) continue;
    if (S(r.fuel) && S(r.fuel)!==fuel) continue;
    if (r.option_regex && !(new RegExp(r.option_regex,'i')).test(selected)) continue;
    if (r.trim_regex && !(new RegExp(r.trim_regex,'i')).test(trim)) continue;
    const cc=Number(r.cc||0);
    if (cc>0) return cc;
  }
  return null;
}

export function ccFromRequest(car) {
  const resolved = car?.구성?.canonical;
  const canonical = resolved?.candidate;
  const exact = Number(canonical?.engine_cc || car?.배기량 || 0);
  if (exact > 0) return exact;

  // 후보가 여러 트림/구동으로 갈려도 엔진 cc가 하나로 수렴하면 그 값은 안전한 차량 사실이다.
  const candidateCcs = [...new Set((resolved?.candidates || [])
    .map((x) => Number(x?.engine_cc || 0))
    .filter((x) => x > 0))];
  if (candidateCcs.length === 1) return candidateCcs[0];

  // 제조사 상품키/파워트레인에 배기량이 명시된 경우만 보강한다.
  const text = [car?.파워트레인, car?.연료, car?.상품키, car?.트림].map(S).filter(Boolean).join(' ');
  const m = text.match(/(?:^|[^0-9.])([1-6]\.[0-9])(?![0-9])/);
  if (m) return Math.round(Number(m[1]) * 1000);

  // 마지막 보강은 제조사 공식 제원으로 확인한 facts만 허용한다.
  return ccFromOfficialFacts(car);
}

function deltaKeyFromCanonical(car) {
  const makerCode = MAKER_CODE[S(car?.브랜드)] || '';
  const masterId = S(car?.구성?.canonical?.candidate?.master_id);
  const m = masterId.match(/\.md-(\d+)(?:\.|$)/);
  return makerCode && m ? `${makerCode}/${m[1]}` : '';
}

function modelDelta(car) {
  const direct = deltaKeyFromCanonical(car);
  if (direct && DELTA[direct]) return { key: direct, ...DELTA[direct] };

  const maker = S(car?.브랜드);
  const model = N(car?.모델);
  const matches = Object.entries(DELTA).filter(([, v]) => {
    if (S(v?.maker) !== maker) return false;
    const dm = N(v?.model);
    return dm && model && (dm === model || dm.includes(model) || model.includes(dm));
  });
  if (matches.length === 1) return { key: matches[0][0], ...matches[0][1] };
  return { key: null, maker, model: S(car?.모델), seg: '표준', delta: 0 };
}

export function residualRatesFor(car) {
  const meta = modelDelta(car);
  const adjust = Number(DEFAULTS?.cost_defaults?.residualAdjustPct || 0);
  const rates = {};
  for (const [termRaw, years] of Object.entries(TERM_YEAR)) {
    const term = Number(termRaw);
    const pct = Math.max(5, Math.min(98, (STANDARD[years] ?? STANDARD[5]) + Number(meta.delta || 0) + adjust));
    rates[term] = pct / 100;
  }
  return { rates, meta, adjust };
}

function creditKey(v) {
  const c = S(v);
  if (c === '고신용') return '정상';
  if (c === '저신용' || c === '무신용' || c === '중신용' || c === '정상') return c;
  return '중신용';
}

function saleTax(car, configuredPriceBeforeDiscount) {
  const price = car?.가격 || {};
  const before = Math.max(0, Number(price.기준전 || 0));
  const after = Math.max(0, Number(price.기준후 || 0));
  const baseCredit = before > 0 && after > 0 && before > after ? before - after : 0;
  const fuel = engineFuel(car?.연료 || car?.파워트레인);

  if (!baseCredit) return { credit: 0, rate: 0, baseCredit: 0 };
  if (fuel === 'ev' && before > 0) {
    const rate = baseCredit / before;
    return {
      credit: Math.round(Math.max(0, configuredPriceBeforeDiscount) * rate),
      rate,
      baseCredit,
    };
  }
  return { credit: baseCredit, rate: before > 0 ? baseCredit / before : 0, baseCredit };
}

function turnoverFor(config, credit) {
  const t = config?.turnover || {};
  const retention = typeof t.retention === 'object'
    ? (t.retention?.[credit] ?? t.retention?.[creditKey(credit)] ?? t.retention?.중신용)
    : t.retention;
  return { ...t, retention };
}

function buildInput(request, scenario) {
  const car = request?.차 || {};
  const price = car.가격 || {};
  const cond = request?.조건 || {};
  const credit = creditKey(cond.신용);
  const config = structuredClone(DEFAULTS?.engine_configs?.[credit] || DEFAULTS?.engine_configs?.중신용 || {});
  const fuel = engineFuel(car.연료 || car.파워트레인);
  if (fuel === 'hydrogen') throw new Error('수소차 표준 원가정책이 아직 확정되지 않았습니다');

  const cc = ccFromRequest(car);
  if (fuel !== 'ev' && !(Number(cc) > 0)) {
    throw new Error('내연기관 배기량이 확정되지 않아 표준 견적을 계산할 수 없습니다');
  }

  const trim = Math.max(0, Number(price.트림 || 0));
  const options = Math.max(0, Number(price.옵션 || 0)); // 내장색 포함
  const exterior = Math.max(0, Number(price.외장색 || 0));
  const discount = Math.max(0, Number(price.할인 || 0));
  const grossBeforeDiscount = trim + options + exterior;
  const configuredPrice = Math.max(0, grossBeforeDiscount - discount);
  if (!(configuredPrice > 0)) throw new Error('차량가격이 올바르지 않습니다');

  const tax = saleTax(car, grossBeforeDiscount);
  const customerBase = Math.max(0, configuredPrice - tax.credit);
  const prepayPct = Math.max(0, Number(scenario?.선납 || 0));
  const prepay = customerBase * prepayPct / 100;
  const { rates: residualRates, meta: residualMeta } = residualRatesFor(car);

  const uiFeeRate = Number(cond.수수료율);
  const salesFeeRate = Number.isFinite(uiFeeRate)
    ? { rent: uiFeeRate / 100, sub: uiFeeRate / 100 }
    : config?.setting?.salesFeeRate;

  const input = {
    ...config,
    channel: 'rent',
    type: 'return',
    price: configuredPrice,
    cc: fuel === 'ev' ? 0 : cc,
    fuel,
    credit,
    accident: 'none',
    mileage: null,
    year: null,
    residualRates,
    residualAgeBaked: true,
    residualAdjust: false,
    saleTaxCredit: tax.credit,
    evSubsidy: Number(config.evSubsidy || 0),
    depositRatio: Math.max(0, Number(scenario?.보증금 || 0)) / 100,
    // UI에서 보증금 %를 직접 정하므로 표준엔진의 월납배수 모드를 이 요청에선 쓰지 않는다.
    depositMode: 'rate',
    prepay,
    turnover: turnoverFor(config, credit),
    bondRate: config?.setting?.bondRate,
    regFee: config?.setting?.regFee,
    insYear: config?.insYear ?? config?.setting?.insYear,
    selfInsuredYear: config?.selfInsuredYear,
    selfRate: config?.selfRate ?? config?.setting?.selfRate,
    maintMonthly: config?.setting?.maintMonthly,
    maintRate: config?.setting?.maintRate,
    gpsMonthly: config?.setting?.gpsMonthly,
    parkingMonthly: config?.setting?.parkingMonthly,
    salesFeeRate,
    // 화면에서 고른 실비가 있으면 그 값이 우선한다.
    deliveryFee: Number(cond.탁송비 || config?.setting?.deliveryFee || 0),
    initPrepFee: Number(cond.썬팅비 || 0) + Number(cond.블박비 || 0),
    inspectionFee: config?.setting?.inspectionFee,
    returnDeliveryFee: config?.setting?.returnDeliveryFee,
    disposalFeeRate: config?.setting?.disposalFeeRate,
    ewPerYear: config?.ewPerYear ?? config?.setting?.ewYear,
    overheadRate: config?.overheadRate,
    badDebtRate: config?.badDebtRate,
  };

  return {
    input,
    meta: {
      credit,
      fuel,
      cc,
      configuredPrice,
      grossBeforeDiscount,
      discount,
      saleTaxCredit: tax.credit,
      saleTaxRate: tax.rate,
      baseSaleTaxCredit: tax.baseCredit,
      customerBase,
      prepay,
      residualRates,
      residualMeta,
      priceBasis: S(price.기준명) || (Number(price.기준전) > 0 ? '세제혜택 전' : ''),
    },
  };
}

export async function calculateStandardQuote(request) {
  if (!request?.차?.상품키 && !request?.차?.키) throw new Error('신차 상품ID가 없습니다');
  if (!Array.isArray(request?.안들) || !request.안들.length) throw new Error('견적 기간이 없습니다');
  if (DEFAULTS?.live_override_present) {
    throw new Error('회사 공용 원가설정 override를 FreePass Estimate로 먼저 이관해야 합니다');
  }

  const 결과 = [];
  let sharedMeta = null;
  for (const scenario of request.안들) {
    const { input, meta } = buildInput(request, scenario);
    const r = computeTerm(Number(scenario.기간), input);
    if (r?.incompleteCc) throw new Error('배기량이 확정되지 않아 자동차세를 계산할 수 없습니다');
    if (![r?.payVat, r?.deposit, r?.residualAmt].every(Number.isFinite)) {
      throw new Error('표준 견적 계산 결과가 유효하지 않습니다');
    }
    sharedMeta ||= meta;
    결과.push({
      월대여료: Math.round(r.payVat),
      보증금: Math.round(r.deposit),
      선납금: Math.round(meta.prepay),
      인수가: Math.round(r.residualAmt),
      총차량가: Math.round(meta.configuredPrice),
      수수료: Math.round(r?.cost?.salesFee || 0),
      _원가: Math.round(r?.cost?.totalCost || 0),
      _잔가율: r.residualRate,
    });
  }

  return {
    차량가: sharedMeta?.configuredPrice ?? null,
    결과,
    메타: {
      ...sharedMeta,
      config_source: DEFAULTS?.source || null,
      config_generated_at: DEFAULTS?.generated_at || null,
      live_override_present: !!DEFAULTS?.live_override_present,
    },
  };
}
