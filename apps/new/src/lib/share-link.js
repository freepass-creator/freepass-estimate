import { SHARE_SNAPSHOT_CONTRACT, CURRENT_SHARE_SNAPSHOT_VERSION, LEGACY_SHARE_SNAPSHOT_VERSION, QUOTE_REQUEST_CONTRACT, QUOTE_RESULT_CONTRACT, QUOTE_EXECUTION_CONTRACT } from './quote/contracts.js';
import { includedScenarioIndexes, selectedLiveQuoteTerms } from './feature/actions.js';

// ============================================================================
//  공유 링크 — «고른 것 + 확정 견적 Snapshot» 을 주소에 담는다
// ----------------------------------------------------------------------------
//  ★같은 견적을 나·직원·고객이 함께 쓴다.
//    - 평소에는 지금처럼 웰릭스 API 로 실시간 계산한다.
//    - 공유할 때는 그 순간 웰릭스가 돌려준 결과를 Snapshot 으로 같이 싣는다.
//    - 받은 사람은 Snapshot 금액을 그대로 본다. 링크를 여는 순간 재계산해서 금액이 바뀌지 않는다.
//    - 「조건 변경해서 다시 견적」을 시작할 때만 Snapshot 을 버리고 실시간 계산으로 돌아간다.
//
//  ★공유 데이터에는 고객에게 보여도 되는 값만 넣는다.
//    신용구분·수수료율·내부할인 같은 영업 내부값은 넣지 않는다.
// ============================================================================

/* 주소 글자를 아끼려고 한 글자 키를 쓴다 */
const 키 = {
  b: 'manufacturer',
  m: 'model',
  v: 'variant',
  t: 'trim',
};

function 인코드(값) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(값));
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch { return ''; }
}

function 디코드(글) {
  if (!글) return null;
  try {
    const base64 = 글.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

function 안전한스냅샷(값) {
  const legacy = 값?.v === LEGACY_SHARE_SNAPSHOT_VERSION && !값?.contract;
  const current = 값?.v === CURRENT_SHARE_SNAPSHOT_VERSION && 값?.contract === SHARE_SNAPSHOT_CONTRACT;
  if (!값 || (!legacy && !current) || !Array.isArray(값.terms) || !값.terms.length) return null;
  const terms = 값.terms
    .filter((x) => x && Number.isFinite(+x.term))
    .map((x) => ({
      term: +x.term,
      monthly: Number.isFinite(+x.monthly) ? +x.monthly : null,
      acquire: Number.isFinite(+x.acquire) ? +x.acquire : null,
      totalCarPrice: Number.isFinite(+x.totalCarPrice) ? +x.totalCarPrice : null,
      deposit: Number.isFinite(+x.deposit) ? +x.deposit : null,
      prepay: Number.isFinite(+x.prepay) ? +x.prepay : null,
      depPct: Number.isFinite(+x.depPct) ? +x.depPct : 0,
      prePct: Number.isFinite(+x.prePct) ? +x.prePct : 0,
    }));
  if (!terms.some((x) => x.monthly != null)) return null;

  const c = 값.conditions || {};
  const car = 값.vehicle || {};
  return {
    v: current ? CURRENT_SHARE_SNAPSHOT_VERSION : LEGACY_SHARE_SNAPSHOT_VERSION,
    contract: current ? SHARE_SNAPSHOT_CONTRACT : null,
    quoteContract: current && typeof 값.quoteContract === 'string' ? 값.quoteContract : null,
    resultContract: current && typeof 값.resultContract === 'string' ? 값.resultContract : null,
    executionContract: current && typeof 값.executionContract === 'string' ? 값.executionContract : null,
    sourceRevision: current && /^[0-9a-f]{40}$/i.test(값.sourceRevision || '') ? 값.sourceRevision : null,
    providerMode: current && ['standard','external','forced'].includes(값.providerMode) ? 값.providerMode : null,
    at: typeof 값.at === 'string' ? 값.at : null,
    engine: typeof 값.engine === 'string' ? 값.engine : '웰릭스',
    vehiclePrice: 값.vehiclePrice != null && Number.isFinite(+값.vehiclePrice) ? +값.vehiclePrice : null,
    vehicle: {
      brand: typeof car.brand === 'string' ? car.brand : '',
      model: typeof car.model === 'string' ? car.model : '',
      variant: typeof car.variant === 'string' ? car.variant : '',
      trim_name: typeof car.trim_name === 'string' ? car.trim_name : '',
      options: Array.isArray(car.options) ? car.options.filter((v) => typeof v === 'string').slice(0, 30) : [],
      colorExt: typeof car.colorExt === 'string' ? car.colorExt : null,
      colorInt: typeof car.colorInt === 'string' ? car.colorInt : null,
    },
    terms,
    conditions: {
      km: Number.isFinite(+c.km) ? +c.km : 2,
      svc: typeof c.svc === 'string' ? c.svc : '웰스 Basic',
      insProperty: typeof c.insProperty === 'string' ? c.insProperty : '1억',
      extraDriver: typeof c.extraDriver === 'string' ? c.extraDriver : '없음',
      deliveryCity: typeof c.deliveryCity === 'string' ? c.deliveryCity : '서울',
      tint: typeof c.tint === 'string' ? c.tint : '없음',
      blackbox: typeof c.blackbox === 'string' ? c.blackbox : '미설치',
    },
  };
}

/** 지금 웰릭스 계산 결과를 «고객에게 공개 가능한» Snapshot 으로 만든다. */
function 스냅샷만들기(quoteState, 견적상태) {
  if (!견적상태 || 견적상태.상태 !== 'ok' || !Array.isArray(견적상태.결과)) return null;
  const selected = selectedLiveQuoteTerms(quoteState, 견적상태.결과);
  const terms = selected.map(({ scenario: sc, result: r }) => ({
    term: +sc.term,
    monthly: r.월대여료 ?? null,
    acquire: r.인수가 ?? null,
    totalCarPrice: r.총차량가 ?? null,
    deposit: r.보증금 ?? null,
    prepay: r.선납금 ?? null,
    depPct: +sc.dep || 0,
    prePct: +sc.pre || 0,
  }));
  if (!terms.length) return null;

  const c = quoteState?.cond || {};
  const car = quoteState?.vehicle || {};
  const providerKey = String(견적상태.공급자 || '');
  const providerMode = providerKey.startsWith('external:') ? 'external'
    : providerKey.startsWith('forced:') ? 'forced'
      : providerKey === 'standard' ? 'standard' : null;
  return {
    v: CURRENT_SHARE_SNAPSHOT_VERSION,
    contract: SHARE_SNAPSHOT_CONTRACT,
    quoteContract: 견적상태.계약?.request || QUOTE_REQUEST_CONTRACT,
    resultContract: 견적상태.계약?.result || QUOTE_RESULT_CONTRACT,
    executionContract: 견적상태.계약?.execution || QUOTE_EXECUTION_CONTRACT,
    sourceRevision: 견적상태.실행?.subject_revision || null,
    providerMode,
    at: new Date().toISOString(),
    engine: 견적상태.계산기 || '웰릭스',
    vehiclePrice: 견적상태.차량가 ?? null,
    vehicle: {
      brand: car.brand || '',
      model: car.model || '',
      variant: car.variant || '',
      trim_name: car.trim_name || '',
      options: Array.isArray(car.options) ? [...car.options] : [],
      colorExt: car.colorExt || null,
      colorInt: car.colorInt || null,
    },
    terms,
    conditions: {
      km: +c.km || 2,
      svc: c.svc || '웰스 Basic',
      insProperty: c.insProperty || '1억',
      extraDriver: c.extraDriver || '없음',
      deliveryCity: c.deliveryCity || '서울',
      tint: quoteState?.tint?.product || '없음',
      blackbox: quoteState?.extras?.blackbox || '미설치',
    },
  };
}

/** 지금 고른 것을 주소 뒤에 붙일 문자열로 — 아무것도 안 골랐으면 빈 문자열 */
export function 담기(vehicleState, quoteState) {
  const p = new URLSearchParams();
  for (const [짧, 긴] of Object.entries(키)) {
    const v = vehicleState?.[긴];
    if (v) p.set(짧, String(v));
  }
  const 옵 = [...(vehicleState?.options || [])];
  if (옵.length) p.set('o', 옵.join('.'));
  if (vehicleState?.color != null && vehicleState.color !== '') p.set('c', String(vehicleState.color));

  const c = quoteState?.cond || {};
  if (c.km && c.km !== 2) p.set('k', String(c.km));
  if (c.colorInt) p.set('ci', c.colorInt);
  if (c.svc) p.set('s', c.svc);
  if (c.insProperty) p.set('ip', c.insProperty);
  if (c.extraDriver) p.set('xd', c.extraDriver);
  if (c.deliveryCity) p.set('dc', c.deliveryCity);
  if (quoteState?.tint?.product) p.set('ti', quoteState.tint.product);
  if (quoteState?.extras?.blackbox) p.set('bb', quoteState.extras.blackbox);

  /* 기간·보증금·선납은 각 시나리오마다 같이 보존한다. 내부 수수료/신용은 넣지 않는다. */
  const scenarios = quoteState?.scenarios || [];
  const included = includedScenarioIndexes(quoteState);
  if (included.length) {
    const selectedScenarios = included.map((index) => scenarios[index]).filter(Boolean);
    p.set('y', selectedScenarios.map((s) => +s.term || 0).join('.'));
    p.set('dp', selectedScenarios.map((s) => +s.dep || 0).join('.'));
    p.set('pp', selectedScenarios.map((s) => +s.pre || 0).join('.'));
  }

  return p.toString();
}

function 공개조건적용(quoteState, p, snap) {
  const sc = snap?.conditions || {};
  const km = snap ? sc.km : +(p.get('k') || 0);
  if (km) quoteState.cond.km = km;

  const 서비스 = snap ? sc.svc : p.get('s');
  if (서비스) quoteState.cond.svc = 서비스;
  const 대물 = snap ? sc.insProperty : p.get('ip');
  if (대물) quoteState.cond.insProperty = 대물;
  const 추가운전자 = snap ? sc.extraDriver : p.get('xd');
  if (추가운전자) quoteState.cond.extraDriver = 추가운전자;
  const 탁송 = snap ? sc.deliveryCity : p.get('dc');
  if (탁송) {
    quoteState.cond.deliveryCity = 탁송;
    quoteState.cond.deliveryRegion = 탁송;
  }
  const 썬팅 = snap ? sc.tint : p.get('ti');
  if (썬팅) quoteState.tint.product = 썬팅;
  const 블박 = snap ? sc.blackbox : p.get('bb');
  if (블박) quoteState.extras.blackbox = 블박;

  const ci = p.get('ci');
  if (ci) quoteState.cond.colorInt = ci;

  if (snap?.terms?.length) {
    quoteState.scenarios.splice(0, quoteState.scenarios.length,
      ...snap.terms.map((t) => ({ term: t.term, dep: t.depPct || 0, pre: t.prePct || 0 })));
    if (snap.terms[0]) {
      quoteState.cond.dep = snap.terms[0].depPct || 0;
      quoteState.cond.pre = snap.terms[0].prePct || 0;
    }
    return;
  }

  const years = (p.get('y') || '').split('.').map(Number).filter(Boolean);
  const deps = (p.get('dp') || '').split('.').map(Number);
  const pres = (p.get('pp') || '').split('.').map(Number);
  if (years.length) {
    quoteState.scenarios.splice(0, quoteState.scenarios.length,
      ...years.map((term, i) => ({
        term,
        dep: Number.isFinite(deps[i]) ? deps[i] : (quoteState.cond.dep || 0),
        pre: Number.isFinite(pres[i]) ? pres[i] : (quoteState.cond.pre || 0),
      })));
  }
}

/** 주소에 담겨 온 것을 상태에 푼다. 푼 게 있으면 true */
export function 풀기(vehicleState, quoteState, 주소 = location.search) {
  let p;
  try { p = new URLSearchParams(주소); } catch { return false; }
  if (!p.get('b') && !p.get('m')) return false;

  for (const [짧, 긴] of Object.entries(키)) {
    const v = p.get(짧);
    if (v) vehicleState[긴] = v;
  }

  /* ★파워트레인 id 는 차 목록을 다시 만들면 바뀔 수 있다.
     트림(=웰릭스 model 키)은 안 바뀌므로 트림으로 파워트레인을 거꾸로 찾는다. */
  if (vehicleState.trim) {
    try {
      const 모델 = window.VEHICLE_DB?.manufacturers?.find((b) => b.manufacturer_id === vehicleState.manufacturer)
        ?.models?.find((m) => m.model_id === vehicleState.model);
      const 갈래 = 모델?.variants?.find((v) => v.trims.some((t) => t.trim_id === vehicleState.trim));
      if (갈래) {
        vehicleState.variant = 갈래.variant_id;
        const 트림 = 갈래.trims.find((t) => t.trim_id === vehicleState.trim);
        vehicleState.trimGroup = 트림?.group || null;
      }
    } catch { /* 못 찾으면 링크 값 그대로 */ }
  }

  const o = p.get('o');
  vehicleState.options = new Set(o ? o.split('.').filter(Boolean) : []);
  const color = p.get('c');
  if (color != null && color !== '') vehicleState.color = isNaN(+color) ? color : +color;

  /* Snapshot 이 있으면 그것이 «보낸 당시 견적»의 정본이다. */
  const snap = 안전한스냅샷(디코드(p.get('qs')));
  quoteState.sharedSnapshot = snap;
  if (snap?.vehicle?.trim_name) quoteState.vehicle = { ...snap.vehicle };
  공개조건적용(quoteState, p, snap);

  vehicleState.subStep = vehicleState.trim ? 'options' : 'brand';
  vehicleState.견적부터 = !!vehicleState.trim;
  return true;
}

/** 지금 화면을 그대로 여는 주소.
 *  - staff 표시는 role.js 의 손님링크() 가 마지막에 떼어 낸다.
 *  - 이미 공유받은 Snapshot 을 재공유하면 원본 Snapshot 을 그대로 이어 보낸다.
 */
export function 지금주소(vehicleState, quoteState, 견적상태 = null) {
  const u = new URL(location.href);
  u.search = 담기(vehicleState, quoteState);
  const snap = quoteState?.sharedSnapshot || 스냅샷만들기(quoteState, 견적상태);
  if (snap) u.searchParams.set('qs', 인코드(snap));
  u.searchParams.set('force', 'mobile');
  return u.toString();
}
