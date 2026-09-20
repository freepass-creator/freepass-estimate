// wel2 견적 모듈 — wel 의 데이터/로직 활용 + estimator_4 톤
import { setCompanyConfig } from './src/lib/calc.js';
import { 요청만들기 } from './src/lib/quote/build-request.js';
import { applyProductTheme } from './src/lib/brand-theme.js';
import { 견적계산 } from './src/lib/quote/calculate.js';
import { resolveCanonicalIdentity } from './src/lib/newcar/configuration-resolver.js';
// 룩업 데이터 SSOT — Vue 컴포넌트와 공유 (이전에는 quote.js 에 박혀있고 window.__welrix_data 로 노출,
// 모듈 로드 순서로 컴포넌트가 빈 옵션 보던 문제 → 직접 import 으로 해결)
import {
  DELIVERY_REGIONS, FLAT_DELIVERY,
  TINT_AREAS, TINT_PRICES,
  ACCESSORIES, COLOR_INT,
} from './src/data/lookups.js';

// ============ 유틸 ============
import { fmt, krw, fmtTel, guessColor } from './src/lib/format.js';
const $ = (id) => document.getElementById(id);
function setSwatch(el, hex) {
  if (!el) return;
  if (hex.startsWith('linear-gradient')) {
    el.style.background = hex;
  } else {
    el.style.backgroundColor = hex;
    el.style.backgroundImage = 'none';
  }
}
// 외장 swatch 갱신 (estimator_4 의 state.color 인덱스 기반)
window.__welrix_updateExtSwatch = (name) => setSwatch($('swatch-ext'), guessColor(name));
window.__welrix_updateIntSwatch = (name) => setSwatch($('swatch-int'), guessColor(name));
// 색상 hex 추정기를 글로벌로 노출 (CustomDropdown 에서 사용)
window.__welrix_guessColor = guessColor;
// Vue 컴포넌트가 사용할 데이터 상수
window.__welrix_data = {
  get DELIVERY_REGIONS() { return DELIVERY_REGIONS; },
  get FLAT_DELIVERY() { return FLAT_DELIVERY; },
  get TINT_AREAS() { return TINT_AREAS; },
  get TINT_PRICES() { return TINT_PRICES; },
  get ACCESSORIES() { return ACCESSORIES; },
};

// ============ 상태 — Vue 반응형 store와 공유 (마이그레이션 1단계) ============
import { quoteState as state, cartStore, addToCart, removeFromCart, clearCart, findCartItem } from './src/store.js';
import { saveQuote, buildQuoteUrl } from './src/firebase/quotes.js';
import { buildOfficialQuoteHtml } from './src/lib/build-quote-html.js';
import { logQuoteSent } from './src/firebase/chat.js';
import { initEmbedBridge } from './src/lib/embed-bridge.js';
let VEHICLES = [];
// ERP4 임베드 브리지 핸들 (스탠드얼론이면 no-op) + 임베드 프리필 딜코드
let __embed = { embedded: false, emitQuote() {} };
let __embedDealCode = null;

// ============ 초기 로드 ============
async function loadCompanyConfig() {
  const params = new URLSearchParams(location.search);
  const id = params.get('c') || 'freepass';
  try {
    const r = await fetch(`./data/company-config/${id}.json?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) {
      const cfg = await r.json();
      setCompanyConfig(cfg);
      window.__welrix_companyConfig = cfg;
      applyProductTheme(cfg);
      applyExcelVersion(cfg);
      return cfg;
    }
  } catch {}
  return null;
}

// 상단바에 적용된 엑셀 견적기 버전 표시 (welrix.json 의 excel_version 이 SSOT)
function applyExcelVersion(cfg) {
  const el = document.getElementById('excel-ver-top');
  if (!el) return;
  const ver = cfg?.excel_version;
  if (!ver) { el.hidden = true; return; }
  el.textContent = '엑셀 ' + ver;
  el.hidden = false;
}

// 회사별 브랜드 색을 CSS 변수로 주입 — :root 의 --brand/--brand-700/--brand-100/--brand-50 덮어씀
function applyCompanyTheme(cfg) {
  const brand = cfg?.brand_color;
  if (!brand) return;
  const r = document.documentElement;
  r.style.setProperty('--brand', brand);
  // hex → tone variants (간단 산정, alpha mix 대신 색 조정)
  r.style.setProperty('--brand-700', shadeColor(brand, -0.18));
  r.style.setProperty('--brand-100', mixWithWhite(brand, 0.82));
  r.style.setProperty('--brand-50',  mixWithWhite(brand, 0.94));
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : null;
}
function rgbToHex(r,g,b) {
  return '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function shadeColor(hex, pct) {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  return rgbToHex(...rgb.map(v => v * (1 + pct)));
}
function mixWithWhite(hex, white) {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  return rgbToHex(...rgb.map(v => v + (255 - v) * white));
}
async function loadVehicles() {
  try {
    const r = await fetch(`./data/vehicles.json?t=${Date.now()}`);
    VEHICLES = await r.json();
  } catch {}
}
// findVehicleMeta 는 src/lib/build-calc-input.js 로 이동(공용 SSOT). 호출 시 VEHICLES 배열을 넘김.

// ============ UI 초기화 — Vue가 대부분 처리. 아직 남은 vanilla 만 ============
function initDropdowns() {
  // 탁송/선팅/용품/색상은 Vue 컴포넌트가 처리 — DOM 없으면 skip
  const dReg = $('q-delivery-region');
  if (dReg) {
    dReg.innerHTML = '<option value="">선택</option>' +
      Object.keys(DELIVERY_REGIONS).map((r) => `<option ${r === state.cond.deliveryRegion ? 'selected' : ''}>${r}</option>`).join('');
    rebuildDeliveryCity();
  }
  const tProd = $('q-tint-product');
  if (tProd) {
    tProd.innerHTML = '<option value="">없음</option>' +
      Object.keys(TINT_PRICES).map((p) => `<option value="${p}" ${p === state.tint.product ? 'selected' : ''}>${p}</option>`).join('');
    renderTintChips();
  }
  const bb = $('q-blackbox');
  if (bb) bb.innerHTML = '<option value="">없음</option>' +
    Object.entries(ACCESSORIES.blackbox).map(([k, v]) => `<option value="${k}">${k} (+${fmt(v)}원)</option>`).join('');
  const nv = $('q-navi');
  if (nv) nv.innerHTML = '<option value="">없음</option>' +
    Object.entries(ACCESSORIES.navi).map(([k, v]) => `<option value="${k}">${k} (+${fmt(v)}원)</option>`).join('');
  const hp = $('q-hipass');
  if (hp) hp.innerHTML = '<option value="">없음</option>' +
    Object.entries(ACCESSORIES.hipass).map(([k, v]) => `<option value="${k}">${k} (+${fmt(v)}원)</option>`).join('');
  const ddInt = $('dd-color-int');
  if (ddInt) {
    ddInt.innerHTML = COLOR_INT.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');
    ddInt.disabled = true;
  }
}

function rebuildDeliveryCity() {
  const reg = $('q-delivery-region');
  if (!reg) return;  // Vue가 처리
  const region = reg.value;
  const sel = $('q-delivery-city');
  if (!sel) return;
  if (!region) { sel.innerHTML = '<option value="">시/군 선택</option>'; return; }
  const cities = DELIVERY_REGIONS[region] || {};
  sel.innerHTML = '<option value="">시/군 선택</option>' +
    Object.entries(cities).map(([c, fee]) =>
      `<option value="${c}" ${c === state.cond.deliveryCity ? 'selected' : ''}>${c} (${fee > 0 ? '+' + fmt(fee) + '원' : '무료'})</option>`
    ).join('');
}

function renderTintChips() {
  const wrap = $('tint-chips');
  const product = $('q-tint-product').value;
  if (!wrap) return;
  if (!product) { wrap.innerHTML = '<span style="font-size:11px; color:#aaa;">제품을 선택하면 부위가 표시됩니다</span>'; return; }
  const priceMap = TINT_PRICES[product] || {};
  wrap.innerHTML = TINT_AREAS.map((a) => {
    const price = priceMap[a.key] || 0;
    const checked = state.tint.areas.has(a.key);
    const tip = a.desc ? `${a.desc} · ${price > 0 ? '+' + fmt(price) + '원' : '무료'}` : '';
    return `<label class="tint-chip ${checked ? 'on' : ''}" title="${tip}">
      <input type="checkbox" data-tint-area="${a.key}" ${checked ? 'checked' : ''} />
      <span class="tn">${a.label}</span>
      <em class="tp">${price > 0 ? '+' + fmt(price) : '무료'}</em>
    </label>`;
  }).join('');
}

// ============ estimator_4 가격 변경 hook ============
window.__welrix_onPriceChange = (data) => {
  const canonical = data?._trim_meta
    ? resolveCanonicalIdentity(data._trim_meta, data._options_master || {}, data._selected_option_ids || [])
    : null;
  const can = canonical?.candidate || null;
  state.vehicle = {
    ...data,
    _canonical: canonical,
    _src: can ? {
      brand: data.brand,
      model: data.model,
      trim: can.trim || data.trim_name,
      disp: can.engine_cc || data.displacement_cc,
      fuel: can.fuel || data.fuel,
      multi_seat: can.seats && Number(can.seats) > 5 ? '다인승' : undefined,
    } : null,
  };
  recompute();
};

// ============ 견적 계산 ============
// renderSummary는 Vue SummaryPanel 컴포넌트가 자동으로 렌더링 (마이그레이션 1단계)
// 빈 함수로 유지 — 기존 호출처(recompute, renderQuoteDoc, renderEmpty)는 그대로 호출하지만 no-op
function renderSummary() { /* Vue가 처리 */ }


let __quoteSeq = 0;
let __quoteTimer = null;

function 결과를화면형식으로(답, 안들) {
  return 안들.map((sc, idx) => {
    const g = 답.결과[idx];
    return {
      idx,
      term: sc.기간,
      dep: sc.보증금,
      pre: sc.선납,
      monthly: g?.월대여료 ?? null,
      residualAmt: g?.인수가 ?? null,
      residualPct: (g?.인수가 != null && g?.총차량가) ? g.인수가 / g.총차량가 : null,
      depAmt: g?.보증금 ?? null,
      preAmt: g?.선납금 ?? null,
    };
  });
}

function recompute() {
  renderSummary();
  clearTimeout(__quoteTimer);
  const 내순번 = ++__quoteSeq;

  if (!state.vehicle || !state.vehicle.total_manwon) {
    renderEmpty();
    return;
  }

  // 연속 입력은 마지막 값만 provider에 보낸다. UI 반응은 즉시 유지한다.
  __quoteTimer = setTimeout(() => recomputeProvider(내순번), 150);
}

async function recomputeProvider(내순번) {
  const 요청 = 요청만들기();
  if (!요청) { renderEmpty(); return; }

  const v = state.vehicle;
  const tintPrice = TINT_PRICES[state.tint.product] || {};
  const tintFee = [...state.tint.areas].reduce((sum, k) => sum + (tintPrice[k] || 0), 0);
  const deliveryFee = FLAT_DELIVERY[state.cond.deliveryCity] || 0;
  const blackboxFee = ACCESSORIES.blackbox[state.extras.blackbox] || 0;
  const naviFee = ACCESSORIES.navi[state.extras.navi] || 0;
  const hipassFee = ACCESSORIES.hipass[state.extras.hipass] || 0;
  const itemsFee = tintFee + blackboxFee + naviFee + hipassFee;
  const totalKrw = v.total_manwon * 10000 + state.cond.colorIntPrice;

  const refDep = +state.cond.dep || 0;
  const refPre = +state.cond.pre || 0;
  const REF_SCENARIOS = [
    { 기간: 60, 보증금: refDep, 선납: refPre },
    { 기간: 48, 보증금: refDep, 선납: refPre },
    { 기간: 36, 보증금: refDep, 선납: refPre },
  ];
  const referenceRequest = { ...요청, 안들: REF_SCENARIOS };

  try {
    const [답, 기준답] = await Promise.all([
      견적계산(요청),
      견적계산(referenceRequest),
    ]);
    if (내순번 !== __quoteSeq) return;

    const monthly = 결과를화면형식으로(답, 요청.안들);
    const referenceMonthly = 결과를화면형식으로(기준답, REF_SCENARIOS);

    state.monthly = monthly;
    state.referenceMonthly = referenceMonthly;
    state.quoteProvider = 답.공급자;
    state.quoteEngine = 답.계산기;
    renderQuoteDoc(monthly, totalKrw, tintFee, deliveryFee, itemsFee - tintFee);
  } catch (e) {
    if (내순번 !== __quoteSeq) return;
    console.error('[quote-provider]', e);
    state.monthly = [];
    state.referenceMonthly = [];
    const doc = $('quote-doc');
    if (doc) doc.innerHTML = '<div class="quote-doc__empty">지금은 견적을 계산할 수 없습니다.<br><small>' +
      String(e?.message || e) + '</small></div>';
  }
}

// 외부(Vue 컴포넌트)에서 호출 가능하도록 노출
window.__welrix_recompute = recompute;

// === 현재 차량 → 장바구니 담기 ===
function snapshotCurrentVehicle() {
  if (!state.vehicle || !state.vehicle.total_manwon || !state.monthly?.length) return null;
  const v = state.vehicle;
  const tintPrice = TINT_PRICES[state.tint.product] || {};
  const tintFee = [...state.tint.areas].reduce((s, k) => s + (tintPrice[k] || 0), 0);
  const deliveryFee = FLAT_DELIVERY[state.cond.deliveryCity] || 0;
  const blackboxFee = ACCESSORIES.blackbox[state.extras.blackbox] || 0;
  const naviFee = ACCESSORIES.navi[state.extras.navi] || 0;
  const hipassFee = ACCESSORIES.hipass[state.extras.hipass] || 0;
  const accessoryFee = blackboxFee + naviFee + hipassFee;
  const totalKrw = v.total_manwon * 10000 + (state.cond.colorIntPrice || 0);
  return {
    brand: v.brand, model: v.model, variant: v.variant, trim_name: v.trim_name,
    options: [...(v.options || [])],
    colorExt: v.colorExt, colorInt: state.cond.colorInt,
    tax_rate: v.tax_rate,
    total_manwon: v.total_manwon,
    trim_price_manwon: v.trim_price_manwon,
    options_price_manwon: v.options_price_manwon,
    totalKrw,
    monthly: state.monthly.map(m => ({ ...m })),
    snapshot: {
      tint: { product: state.tint.product, areas: [...state.tint.areas] },
      extras: { ...state.extras },
      deliveryFee, deliveryCity: state.cond.deliveryCity,
      tintFee, accessoryFee,
    },
  };
}
/**
 * 현재 차량을 견적바구니에 담기.
 * @param {object} opts.silent — true 면 중복 confirm 안 띄우고 바로 갱신
 * @returns {{ id, updated, skipped }}
 *   - skipped: 중복이라 사용자가 취소함
 *   - updated: 같은 차종 있어서 옵션/조건 갱신
 *   - id: cart 안 항목 id
 */
window.__welrix_addCurrentToCart = (opts = {}) => {
  const snap = snapshotCurrentVehicle();
  if (!snap) { alert('차량을 선택하고 견적이 산출된 후 담을 수 있습니다'); return null; }
  const existing = findCartItem(snap);
  if (existing && !opts.silent) {
    const ok = confirm(
      `이미 견적바구니에 담긴 차종입니다.\n\n` +
      `${snap.brand} ${snap.model} ${snap.trim_name}\n\n` +
      `현재 옵션·조건으로 갱신할까요?`
    );
    if (!ok) return { skipped: true };
  }
  const result = addToCart(snap);
  return { ...result, skipped: false };
};
window.__welrix_removeCart = removeFromCart;
window.__welrix_clearCart = clearCart;

function renderEmpty() {
  // 카드는 Vue TermsGrid / ReferenceGrid 가 자동 렌더 (state.monthly 비면 placeholder)
  state.monthly = [];
  state.referenceMonthly = [];
  $('quote-doc').innerHTML = '<div class="quote-doc__empty">차량과 트림을 선택하면 견적서가 생성됩니다.</div>';
  return;
}
// 페이지 로드 시 즉시 빈 상태 그리기
renderEmpty();
// renderSummary는 renderEmpty와 별도로 항상 노출 (초기 차량 미선택 텍스트 표시)
if (typeof renderSummary === 'function') renderSummary();


// ============ 견적서 HTML v2 — 모바일 세로형 카드 레이아웃 (카톡 이미지용) ============
function renderQuoteDoc(monthly, totalKrw, tintFee, deliveryFee, accessoryFee = 0) {
  const v = state.vehicle;
  const today = new Date();
  const todayStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s/g,'.').replace(/\.$/,'');
  const expire = new Date(today.getTime() + 7*86400000);
  const expireStr = expire.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s/g,'.').replace(/\.$/,'');
  const quoteNo = todayStr.replace(/\./g,'') + '-' + String(Date.now()).slice(-4);
  // 체크된 시나리오
  const sent = monthly.filter((m) => state.send[m.idx] !== false);
  // best = 최저 월대여료 시나리오
  const bestIdx = sent.length ? sent.reduce((b, m) => m.monthly < b.monthly ? m : b, sent[0]).idx : -1;
  // 옵션 칩
  const opts = (v.options && v.options.length) ? v.options : [];
  // 색상 hex (외장)
  const extColorHex = guessColor(v.colorExt);
  const intColorHex = guessColor(state.cond.colorInt);

  const cfg = window.__welrix_companyConfig || {};
  const logoUrl = cfg.logo_url;
  const showLogo = state.send_options?.showLogo !== false; // 기본 true, "CI 제외" 체크 시 false
  const html = `
    <div class="quote-doc">
      <!-- 헤더 -->
      <div class="qd-hero">
        ${showLogo && logoUrl ? `<img class="qd-hero__logo" src="${logoUrl}" alt="${cfg.name || ''}" />` : ''}
        <div class="qd-hero__title">신차 장기렌터카 견적서</div>
        <div class="qd-hero__meta">
          <span><b>견적번호</b> ${quoteNo}</span>
          <span><b>유효기간</b> ${expireStr}까지</span>
        </div>
      </div>

      <!-- 손님 / 담당자 -->
      <div class="qd-section">
        <div class="qd-people">
          <div class="qd-people__col">
            <h4>고객</h4>
            <div class="name">${[state.cust.name ? `${state.cust.name} 님` : '', fmtTel(state.cust.tel)].filter(Boolean).join(' · ') || '-'}</div>
          </div>
          <div class="qd-people__col">
            <h4>담당자</h4>
            <div class="name">${[state.staff.name, fmtTel(state.staff.tel)].filter(Boolean).join(' · ') || '-'}</div>
          </div>
        </div>
      </div>

      <!-- 차량 카드 -->
      <div class="qd-section">
        <div class="qd-section__label">VEHICLE</div>
        <div class="qd-vehicle">
          <div class="qd-vehicle__top">
            <div>
              <div class="qd-vehicle__title">${v.brand || ''}</div>
              <div class="qd-vehicle__name">${v.model || ''} ${v.trim_name || ''}</div>
              <div class="qd-vehicle__sub">${[v.variant, v.fuel, v.displacement_cc ? v.displacement_cc + 'cc' : null].filter(Boolean).join(' · ')}</div>
            </div>
            <div class="qd-vehicle__price">
              <div class="label">TOTAL</div>
              <div class="value">${krw(totalKrw)}</div>
            </div>
          </div>
          <div class="qd-vehicle__rows">
            <div class="qd-vehicle__row"><span class="k">외장</span><span class="v color"><span class="swatch" style="background:${extColorHex}"></span>${v.colorExt || '-'}</span></div>
            <div class="qd-vehicle__row"><span class="k">내장</span><span class="v color"><span class="swatch" style="background:${intColorHex}"></span>${state.cond.colorInt || '-'}</span></div>
            ${tintFee ? `<div class="qd-vehicle__row"><span class="k">선팅</span><span class="v">${state.tint.product}</span></div>` : ''}
            ${deliveryFee ? `<div class="qd-vehicle__row"><span class="k">탁송</span><span class="v">${state.cond.deliveryCity}</span></div>` : ''}
            ${accessoryFee ? `<div class="qd-vehicle__row"><span class="k">용품</span><span class="v">${[state.extras.blackbox, state.extras.navi, state.extras.hipass].filter(Boolean).length}종</span></div>` : ''}
          </div>
          ${opts.length ? `
            <div class="qd-vehicle__opts">
              <div class="qd-vehicle__opts-label">옵션</div>
              ${opts.map(o => `<span class="opt-chip">${o}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 월 대여료 (핵심) -->
      <div class="qd-section">
        <div class="qd-section__label">MONTHLY PAYMENT · ${state.cond.km}만km/년 · ${state.cond.credit}</div>
        <div class="qd-monthly">
          ${sent.map(m => `
            <div class="qd-monthly__row ${m.idx === bestIdx && sent.length > 1 ? 'best' : ''}">
              ${m.idx === bestIdx && sent.length > 1 ? '<span class="qd-monthly__badge">BEST</span>' : ''}
              <div class="qd-monthly__term">${m.term}<em>개월</em></div>
              <div class="qd-monthly__cond">
                보증금 <b>${m.dep}%</b> · 선납 <b>${m.pre}%</b><br>
                만기인수 ${(m.residualPct*100).toFixed(0)}%
              </div>
              <div class="qd-monthly__price">
                <span class="price">${fmt(m.monthly)}</span><span class="unit">원</span>
                <div class="residual">만기 ${fmt(m.residualAmt)}원</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 보험 + 정비 -->
      <div class="qd-section">
        <div class="qd-section__label">INSURANCE · SERVICE</div>
        <div class="qd-info-grid">
          <div class="qd-info-card">
            <h5>보험</h5>
            <div class="kv"><span class="k">대인 Ⅰ/Ⅱ</span><span class="v">무한</span></div>
            <div class="kv"><span class="k">대물</span><span class="v">${state.cond.insProperty || '1억'}</span></div>
            <div class="kv"><span class="k">자손</span><span class="v">1억</span></div>
            <div class="kv"><span class="k">자상</span><span class="v">2억</span></div>
            <div class="kv"><span class="k">면책금</span><span class="v">30만원~</span></div>
            <div class="kv"><span class="k">추가운전자</span><span class="v">${state.cond.extraDriver || '없음'}</span></div>
          </div>
          <div class="qd-info-card">
            <h5>정비</h5>
            <div class="kv"><span class="k">상품</span><span class="v">${state.cond.svc}</span></div>
            <div class="kv"><span class="k">방식</span><span class="v">${state.cond.svc === '웰스 Self' ? '고객 자체정비' : '방문 점검'}</span></div>
            <div class="kv"><span class="k">주기</span><span class="v">${state.cond.svc === '웰스 Self' ? '없음' : '6개월 1회'}</span></div>
            <div class="kv"><span class="k">검사대행</span><span class="v">포함</span></div>
            <div class="kv"><span class="k">긴급출동</span><span class="v">5회/년</span></div>
            <div class="kv"><span class="k">사고처리</span><span class="v">1544-3871</span></div>
          </div>
        </div>
      </div>

      <!-- 주요 계약사항 -->
      <div class="qd-section">
        <div class="qd-section__label">NOTES</div>
        <ul class="qd-notes">
          <li>상기 견적은 제조사 사정·조세정책 등에 의해 변경될 수 있습니다.</li>
          <li>당사 심사결과에 따라 보증계약(보증/선납금, 공동임차인)이 추가될 수 있습니다.</li>
          <li>월 대여료에 자동차보험·정비·검사·자동차세가 모두 포함됩니다.</li>
          <li>중도해지 시 수수료가 발생됩니다 (기간별 상이, 약정서 참고).</li>
        </ul>
      </div>

      <!-- 제출서류 -->
      <div class="qd-section">
        <div class="qd-section__label">REQUIRED DOCUMENTS</div>
        <div class="qd-docs">
          <div class="qd-docs__item"><b>공통</b>주민등록등본 · 운전면허증 사본 · 운전경력증명원 · 인감증명서 · 소득/재산 증빙 · 자동이체통장 사본</div>
          <div class="qd-docs__item"><b>사업자</b>사업자등록증 사본 · 법인등기부등본 · 법인인감증명서</div>
          <div class="qd-docs__item"><b>추가운전자</b>주민등록등본 · 운전면허증 사본 · 운전경력증명원</div>
        </div>
      </div>

      <!-- 푸터 — CI 제외 시 계좌도 숨김 -->
      ${showLogo ? `<div class="qd-footer">
        <div class="qd-footer__bank">
          <span class="label">계약금 입금</span> <b>신한은행 140-013-750928 웰릭스모빌리티㈜</b>
        </div>
      </div>` : ''}
    </div>
  `;
  $('quote-doc').innerHTML = html;
  renderSummary();
}

// ============================================================
// 정식 견적서 (엑셀 「견적서_고객」 시트 동일 양식, 웹 캡쳐용)
// 정보 위계: 회사 → 손님 → 담당 → 차량 → 기간별 가격
// 부가: 보험 · 정비 서비스 · 제출서류
// 다중 차종: 차량정보+월대여료 블록을 차종마다 반복
// ============================================================
function renderOfficialQuoteDoc(vehicles) {
  window.__welrix_lastQuoteSnaps = vehicles;
  const today = new Date();
  const todayStr = today.toLocaleDateString('ko-KR');
  const expire = new Date(today.getTime() + 7*86400000);
  const expireStr = expire.toLocaleDateString('ko-KR');
  const quoteNo = today.toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Date.now()).slice(-4);

  $('quote-modal-body').innerHTML = buildOfficialQuoteHtml({
    vehicles,
    customer: { name: state.cust.name, tel: state.cust.tel },
    staff:    { name: state.staff.name, tel: state.staff.tel },
    cond:     state.cond,
    send:     state.send,
    quoteMeta:{ quoteNo, todayStr, expireStr },
    companyConfig: window.__welrix_companyConfig || {},
    showLogo: state.send_options?.showLogo !== false,
  });
}


// 텍스트 형식 (카톡 전송용)
function buildPlainText(monthly, totalKrw) {
  const v = state.vehicle;
  const lines = [];
  lines.push('【 웰릭스 모빌리티 견적 】');
  lines.push('');
  lines.push(`▣ 차량: ${v.brand} ${v.model} ${v.variant || ''}`);
  lines.push(`▣ 트림: ${v.trim_name}`);
  if (state.cond.colorInt) lines.push(`▣ 내장: ${state.cond.colorInt}`);
  lines.push(`▣ 차량가격: ${krw(totalKrw)}`);
  lines.push('');
  lines.push(`▣ 조건: 신용 ${state.cond.credit} / 약정 ${state.cond.km}만km`);
  lines.push('');
  lines.push('▣ 월 대여료');
  monthly.forEach((m) => {
    if (state.send[m.idx] === false) return;
    lines.push(`  · ${m.term}개월 (보${m.dep}%/선${m.pre}%): ${fmt(m.monthly)}원 (만기 ${fmt(m.residualAmt)})`);
  });
  lines.push('');
  lines.push('— 웰릭스 모빌리티');
  return lines.join('\n');
}

// ============ 이벤트 ============
function attach() {
  // 공통 조건 변경 (신용/약정/서비스/보험/추가운전자)
  ['q-credit','q-km','q-svc','q-ins','q-extra'].forEach((id) => {
    const el = $(id); if (!el) return;
    const key = id.replace('q-','');
    const map = { 'credit':'credit','km':'km','svc':'svc','ins':'insProperty','extra':'extraDriver' };
    const handler = () => { state.cond[map[key]] = el.value; recompute(); };
    el.addEventListener('change', handler);
    el.addEventListener('input', handler);
  });
  // 손님 / 담당자 입력 — state에만 저장 (계산엔 영향 없음, 견적서/카톡 텍스트에 활용)
  [['q-cust-name','cust','name'], ['q-cust-tel','cust','tel'],
   ['q-staff-name','staff','name'], ['q-staff-tel','staff','tel']].forEach(([id, role, field]) => {
    $(id)?.addEventListener('input', (e) => { state[role][field] = e.target.value; });
  });
  // 전체 보증금/선납금 — 입력시 4기간 시나리오 일괄 적용
  $('q-dep')?.addEventListener('change', (e) => {
    const v = Math.max(0, Math.min(100, +e.target.value || 0));
    e.target.value = v;
    state.cond.dep = v;
    state.scenarios.forEach((sc) => { sc.dep = v; });
    if (state.vehicle && state.vehicle.total_manwon) recompute();
    else renderEmpty();
  });
  $('q-pre')?.addEventListener('change', (e) => {
    const v = Math.max(0, Math.min(100, +e.target.value || 0));
    e.target.value = v;
    state.cond.pre = v;
    state.scenarios.forEach((sc) => { sc.pre = v; });
    if (state.vehicle && state.vehicle.total_manwon) recompute();
    else renderEmpty();
  });
  // 탁송 cascade
  $('q-delivery-region')?.addEventListener('change', () => {
    state.cond.deliveryRegion = $('q-delivery-region').value;
    state.cond.deliveryCity = '';
    rebuildDeliveryCity();
    recompute();
  });
  $('q-delivery-city')?.addEventListener('change', () => {
    state.cond.deliveryCity = $('q-delivery-city').value;
    recompute();
  });
  // 선팅 제품
  $('q-tint-product')?.addEventListener('change', () => {
    state.tint.product = $('q-tint-product').value;
    state.tint.areas = new Set();  // 제품 변경 시 부위 초기화
    renderTintChips();
    recompute();
  });
  // 선팅 부위 (위임) — 측후면은 쿠폰X/O 배타그룹
  const SIDE_REAR_GROUP = ['side_rear_no_coupon', 'side_rear_with_coupon'];
  $('tint-chips')?.addEventListener('change', (e) => {
    if (!e.target.matches('input[data-tint-area]')) return;
    const k = e.target.dataset.tintArea;
    if (e.target.checked) {
      if (SIDE_REAR_GROUP.includes(k)) {
        SIDE_REAR_GROUP.filter((x) => x !== k).forEach((x) => state.tint.areas.delete(x));
      }
      state.tint.areas.add(k);
    } else {
      state.tint.areas.delete(k);
    }
    renderTintChips();
    recompute();
  });
  // 용품 — 블박/내비/하이패스
  ['blackbox','navi','hipass'].forEach((k) => {
    const el = $(`q-${k}`);
    if (!el) return;
    el.addEventListener('change', () => {
      state.extras[k] = el.value;
      recompute();
    });
  });

  // 손님 · 담당자 입력
  ['cust-name','cust-tel','staff-name','staff-tel'].forEach((k) => {
    const el = $(`q-${k}`); if (!el) return;
    el.addEventListener('input', () => {
      const [who, field] = k.split('-');
      state[who][field === 'name' ? 'name' : 'tel'] = el.value;
      recompute();
    });
  });

  // === 견적바구니 카운트 뱃지 (Vue reactive 브릿지) ===
  function syncCartBadge() {
    const badge = $('cart-badge');
    if (!badge) return;
    const n = cartStore.vehicles.length;
    badge.textContent = n;
    badge.style.display = 'inline-flex';
    badge.classList.toggle('is-empty', n === 0);
  }
  syncCartBadge();
  // Vue reactive는 inline JS에서 watch 못 하니까 가벼운 polling 유지 (250ms)
  setInterval(syncCartBadge, 250);

  $('btn-add-to-cart')?.addEventListener('click', () => {
    const result = window.__welrix_addCurrentToCart?.();
    if (!result) return;  // 차량 미선택
    const btn = $('btn-add-to-cart');
    const orig = btn._origHTML || (btn._origHTML = btn.innerHTML);
    if (result.skipped) {
      // 사용자가 confirm 취소 — 피드백 없음
      return;
    }
    if (result.updated) {
      btn.innerHTML = '<i class="ph ph-arrow-clockwise"></i>갱신됨';
      btn.style.color = '#f59e0b';
    } else {
      btn.innerHTML = '<i class="ph ph-check"></i>담김';
      btn.style.color = '#10b981';
    }
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 1400);
    syncCartBadge();
  });

  // === [현재 견적] — 화면에서 본 차종 1대만 즉시 미리보기 (cart 미경유) ===
  $('btn-preview-quote')?.addEventListener('click', () => {
    const currentSnap = snapshotCurrentVehicle();
    if (!currentSnap) {
      alert('차량을 선택하고 견적이 산출된 후 미리보기 가능합니다');
      return;
    }
    renderOfficialQuoteDoc([currentSnap]);
    $('quote-modal-bd').classList.add('open');
  });

  // === [견적바구니] 열기 — CartPanel.vue ===
  $('btn-open-cart')?.addEventListener('click', () => {
    if (typeof window.__welrix_openCart === 'function') {
      window.__welrix_openCart();
    } else {
      console.warn('[cart] CartPanel not ready yet');
    }
  });

  // === CartPanel 에서 호출: 통합 발송 액션 핸들러 ===
  // action: 'preview' | 'image-save' | 'image-copy' | 'text-copy' | 'link-send'
  window.__welrix_cartAction = async (action, selectedVehicles) => {
    if (!selectedVehicles || !selectedVehicles.length) {
      alert('발송할 차종을 1개 이상 체크하세요');
      return;
    }
    // 견적서 모달 N차종으로 렌더 + 열기 (영업이 결과 확인 가능)
    renderOfficialQuoteDoc(selectedVehicles);
    $('quote-modal-bd').classList.add('open');
    // DOM/이미지 안정 대기
    await new Promise(r => setTimeout(r, 80));
    // 액션별 자동 트리거 — 영업이 한 번 클릭으로 발송 완료
    switch (action) {
      case 'preview':
        // 그대로 모달 열어두기 (사용자가 직접 확인 후 추가 액션)
        break;
      case 'image-save':
        $('btn-modal-save-image')?.click();
        break;
      case 'image-copy':
        $('btn-modal-copy-image')?.click();
        break;
      case 'text-copy':
        $('btn-modal-copy-text')?.click();
        break;
      case 'link-send':
        $('btn-modal-send-link')?.click();
        setTimeout(() => {
          const sendBtn = $('btn-modal-send-link');
          if (sendBtn) sendBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
        break;
    }
  };
  $('btn-modal-close')?.addEventListener('click', () => $('quote-modal-bd').classList.remove('open'));

  // 견적서 출력 — html2canvas 로 캡쳐 후 이미지로 인쇄 (이미지 복사와 동일한 안정성)
  $('btn-modal-print')?.addEventListener('click', async () => {
    const btn = $('btn-modal-print');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner"></i> 준비 중...';
    btn.disabled = true;
    try {
      const canvas = await captureQuoteImage();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      // 기존 print iframe 정리
      const oldIf = document.getElementById('__print-iframe');
      if (oldIf) oldIf.remove();
      // 숨겨진 iframe 에 이미지 1장만 넣고 print
      const iframe = document.createElement('iframe');
      iframe.id = '__print-iframe';
      iframe.style.cssText = 'position:fixed; left:-9999px; top:-9999px; width:210mm; height:297mm; border:0;';
      document.body.appendChild(iframe);
      // canvas 비율 기반으로 A4 안에 정확히 fit 되는 dimensions 계산
      const ratio = canvas.height / canvas.width;
      let imgW = 210, imgH = 210 * ratio;  // mm
      if (imgH > 297) { imgH = 297; imgW = 297 / ratio; }
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>견적서 출력</title>
<style>
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; width: 210mm; height: 297mm; overflow: hidden; }
img { display: block; width: ${imgW}mm; height: ${imgH}mm; margin: 0 auto; }
</style></head><body><img src="${dataUrl}"></body></html>`);
      doc.close();
      // 이미지 로드 대기 후 print
      const img = iframe.contentDocument.querySelector('img');
      const doPrint = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          alert('출력 실패: ' + e.message);
        }
        setTimeout(() => iframe.remove(), 2000);
      };
      if (img.complete) doPrint();
      else img.addEventListener('load', doPrint, { once: true });
    } catch (e) {
      console.error('[print]', e);
      alert('출력 준비 실패: ' + (e.message || e));
    } finally {
      btn.innerHTML = orig;
      btn.disabled = false;
    }
  });

  // === 모달 옵션: 로고 제외 토글 ===
  const optExcludeLogo = $('opt-exclude-logo');
  if (optExcludeLogo) {
    if (!state.send_options) state.send_options = { showLogo: true };
    optExcludeLogo.checked = state.send_options.showLogo === false;
    optExcludeLogo.addEventListener('change', () => {
      state.send_options.showLogo = !optExcludeLogo.checked;
      // 현재 모달이 열려있으면 즉시 재렌더
      if ($('quote-modal-bd').classList.contains('open')) {
        // cart 또는 single preview 어느 쪽이든 마지막 source 로 재렌더
        const snap = window.__welrix_lastQuoteSnaps || (state.vehicle ? [snapshotCurrentVehicle()].filter(Boolean) : []);
        if (snap.length) renderOfficialQuoteDoc(snap);
      }
    });
  }
  $('quote-modal-bd')?.addEventListener('click', (e) => {
    if (e.target === $('quote-modal-bd')) $('quote-modal-bd').classList.remove('open');
  });

  // 텍스트 복사 (모달 안)
  $('btn-modal-copy-text')?.addEventListener('click', () => $('btn-copy-text')?.click());

  // 견적서 이미지 캡처 — html2canvas (실제 quote-doc 폭으로 캡쳐, scale=2 로 고해상도)
  async function captureQuoteImage() {
    const el = document.querySelector('#quote-modal-body .quote-doc');
    if (!el) { alert('견적서가 아직 생성되지 않았습니다'); return null; }
    if (typeof html2canvas !== 'function') { alert('이미지 라이브러리 로딩 중입니다. 잠시 후 다시 시도하세요.'); return null; }
    const body = $('quote-modal-body');
    const prevScroll = body.scrollTop;
    body.scrollTop = 0;
    const elWidth = el.offsetWidth || 820;  // 엑셀 양식(official) 820, 카드형 540
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        width: elWidth,
        windowWidth: elWidth,
        logging: false,
      });
      return canvas;
    } finally {
      body.scrollTop = prevScroll;
    }
  }

  // 이미지 저장 (다운로드)
  $('btn-modal-save-image')?.addEventListener('click', async () => {
    const btn = $('btn-modal-save-image');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner"></i> 처리중...';
    btn.disabled = true;
    try {
      const canvas = await captureQuoteImage();
      if (!canvas) return;
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const name = state.cust.name || '견적서';
        const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
        a.href = url;
        a.download = `welrix_견적서_${name}_${today}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch (e) {
      console.error(e); alert('이미지 저장 실패: ' + e.message);
    } finally {
      btn.innerHTML = orig; btn.disabled = false;
    }
  });

  // 링크 발송 — Firebase 저장 → URL + 카톡 메시지 클립보드 복사
  $('btn-modal-send-link')?.addEventListener('click', async () => {
    const btn = $('btn-modal-send-link');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner"></i> 저장 중...';
    btn.disabled = true;
    try {
      // payload 구성: 현재 cart 또는 현재 차량 1대
      const cartHas = cartStore.vehicles.length > 0;
      const currentSnap = snapshotCurrentVehicle();
      const vehicles = cartHas ? cartStore.vehicles : (currentSnap ? [currentSnap] : []);
      if (!vehicles.length) { alert('차량을 먼저 선택하세요'); return; }
      const payload = {
        customer: { name: state.cust.name || '', tel: state.cust.tel || '' },
        staff:    { name: state.staff.name || '', tel: state.staff.tel || '' },
        cond:     { ...state.cond },
        scenarios: state.scenarios.map(s => ({ ...s })),
        send:     [...state.send],
        vehicles,
      };
      const { id, url } = await saveQuote(payload);
      // 채팅에 시스템 메시지 자동 push — "📤 견적 발송 — ..."
      const summary = vehicles.map(v => `${v.model} ${v.trim_name}`).join(', ');
      logQuoteSent(id, summary).catch(() => {});
      // ERP4 임베드 시 결과 전달 (id/url/dealCode/summary) — 스탠드얼론이면 no-op
      __embed.emitQuote({ id, url, dealCode: __embedDealCode, summary });
      // 카톡 메시지 본문 — 손님이 받는 텍스트
      const custName = state.cust.name || 'VIP 고객';
      const vNames = vehicles.map(v => `· ${v.model} ${v.trim_name}`).join('\n');
      const text =
`[웰릭스모빌리티 견적서]
${custName}님, 안녕하세요. 요청하신 견적을 보내드립니다.

${vNames}

상세 견적 확인하기 ↓
${url}

— ${state.staff.name || '웰릭스 모빌리티'} (${state.staff.tel || ''})`;
      await navigator.clipboard.writeText(text);
      btn.innerHTML = '<i class="ph ph-check-circle"></i> 카톡 메시지 복사됨';
      btn.style.color = '#10b981';
      // 발송 후 견적 ID 표시 (영업사원 확인용)
      const noteEl = document.createElement('div');
      noteEl.style.cssText = 'padding:10px 14px; background:#10b98115; color:#0e8d62; font-size:11.5px; border-bottom:1px solid #d6f0e3;';
      noteEl.innerHTML = `<b>발송 준비 완료</b> · ID: <code>${id}</code> · 카톡에 붙여넣기(Ctrl+V) 하세요`;
      const body = $('quote-modal-body');
      body.insertBefore(noteEl, body.firstChild);
      setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; btn.disabled = false; }, 3000);
    } catch (e) {
      console.error('[send-link]', e);
      alert('링크 발송 실패: ' + (e.message || e));
      btn.innerHTML = orig; btn.disabled = false;
    }
  });

  // 이미지 클립보드 복사 (카톡 붙여넣기용)
  $('btn-modal-copy-image')?.addEventListener('click', async () => {
    const btn = $('btn-modal-copy-image');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner"></i> 처리중...';
    btn.disabled = true;
    try {
      const canvas = await captureQuoteImage();
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          btn.innerHTML = '<i class="ph ph-check"></i> 복사됨';
          btn.style.color = '#10b981';
          setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; btn.disabled = false; }, 1500);
        } catch (err) {
          alert('클립보드 복사 실패 — 브라우저가 지원하지 않거나 권한 거부됨.\n"이미지 저장"으로 다운로드 후 첨부하세요.');
          btn.innerHTML = orig; btn.disabled = false;
        }
      }, 'image/png');
    } catch (e) {
      console.error(e); alert('이미지 캡처 실패: ' + e.message);
      btn.innerHTML = orig; btn.disabled = false;
    }
  });

  // [링크 저장] 버튼 제거됨 — 견적바구니 → 손님 발송 으로 통합 (Firebase 저장 + 링크 발송)

  // 조회동의 링크 복사 — 매번 호출 가능, 명확한 피드백 (영업 도구로 자주 씀)
  let signLinkResetTimer = null;
  $('btn-copy-sign-link')?.addEventListener('click', async () => {
    const url = window.__welrix_companyConfig?.signature_link;
    if (!url) { alert('이 회사는 조회동의 링크가 설정되어 있지 않습니다.'); return; }
    const btn = $('btn-copy-sign-link');
    if (!btn._origHTML) btn._origHTML = btn.innerHTML;
    try {
      await navigator.clipboard.writeText(url);
      btn.innerHTML = '<i class="ph ph-check-circle"></i>복사 완료 (재복사 가능)';
      btn.style.color = '#10b981';
      btn.style.fontWeight = '500';
      if (signLinkResetTimer) clearTimeout(signLinkResetTimer);
      signLinkResetTimer = setTimeout(() => {
        btn.innerHTML = btn._origHTML;
        btn.style.color = '';
        btn.style.fontWeight = '';
        signLinkResetTimer = null;
      }, 3500);
    } catch (err) {
      prompt('아래 링크를 복사해 손님께 전달하세요:', url);
    }
  });

  // 내장 색상
  $('dd-color-int')?.addEventListener('change', () => {
    const v = $('dd-color-int').value;
    const [name, price] = v.split('|');
    state.cond.colorInt = name || '';
    state.cond.colorIntPrice = +price || 0;
    window.__welrix_updateIntSwatch?.(name);
    recompute();
  });
  // 외장 색상 swatch 갱신 (estimator_4 가 dd-color-ext change 처리하므로 hook 추가)
  $('dd-color-ext')?.addEventListener('change', () => {
    const sel = $('dd-color-ext');
    const text = sel.options[sel.selectedIndex]?.text || '';
    const name = text.split('·')[0].trim();
    window.__welrix_updateExtSwatch?.(name);
  });
  // 복사 (텍스트)
  $('btn-copy-text')?.addEventListener('click', async () => {
    if (!state.vehicle) return alert('차량을 먼저 선택하세요');
    const v = state.vehicle;
    const totalKrw = v.total_manwon * 10000 + state.cond.colorIntPrice;
    // 화면에 확정된 provider 결과를 그대로 쓴다.
    // 텍스트 복사 때 다시 계산하면 Excel/ERP 응답과 화면 금액이 달라질 수 있다.
    const monthly = (state.monthly || []).map((m) => ({ ...m }));
    if (!monthly.length) return alert('견적 계산이 완료된 후 복사해 주세요.');
    const text = buildPlainText(monthly, totalKrw);
    try { await navigator.clipboard.writeText(text); alert('견적 텍스트가 복사되었습니다.'); }
    catch { alert('복사 실패'); }
  });
  // 이미지 복사 (자리만 — html2canvas 필요)
  $('btn-copy-image')?.addEventListener('click', () => {
    alert('이미지 저장은 다음 버전에서 지원 예정입니다.');
  });
}

// ============ Init ============
(async function init() {
  // ERP4 임베드 시 프리필 수신 (스탠드얼론이면 no-op). 차량 프리필은 후속(캐스케이드 구동) 예정.
  __embed = initEmbedBridge({
    onPrefill: (p) => {
      if (p.custName != null) state.cust.name = p.custName;
      if (p.custTel != null) state.cust.tel = p.custTel;
      if (p.staffName != null) state.staff.name = p.staffName;
      if (p.staffTel != null) state.staff.tel = p.staffTel;
      if (p.dealCode != null) __embedDealCode = p.dealCode;
    },
  });
  await loadCompanyConfig();
  await loadVehicles();
  initDropdowns();
  attach();
  renderEmpty();
  console.log('[wel2] quote module ready');
})();
