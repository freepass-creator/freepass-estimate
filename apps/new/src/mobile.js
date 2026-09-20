// 모바일 전용 entry — index.js 와 분리된 별도 번들
// 기존 store/calc/firebase 는 재사용, UI 만 모바일 전용 컴포넌트로 새로 작성
import { createApp } from 'vue';
import MobileApp from './components/mobile/MobileApp.vue';
import { setCompanyConfig } from './lib/calc.js';
import { quoteState, 역할기본조건동기화 } from './store.js';
import { 담당자인가, 담당자로, 담당자로들어왔나 } from './lib/role.js';
import { 풀기 } from './lib/share-link.js';
import { vehicleState } from './store.js';
import { applyProductTheme } from './lib/brand-theme.js';
import { installMobileHaptics } from './lib/haptics.js';

function companyProfileId() {
  const params = new URLSearchParams(location.search);
  return params.get('c') || 'freepass';
}

function vehicleCatalogUrl() {
  const params = new URLSearchParams(location.search);
  const explicit = params.get('catalog');
  if (explicit === 'freepass') return '/vehicle-db.js';
  if (explicit === 'welrix-sales') return '/sales-welrix-db.js';
  return companyProfileId() === 'freepass' ? '/sales-welrix-db.js' : '/vehicle-db.js';
}

async function loadVehicleDb() {
  if (window.VEHICLE_DB) return;
  const src = vehicleCatalogUrl();
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`차량 DB 로드 실패: ${src}`));
    document.head.appendChild(script);
  });
  window.__FREEPASS_ACTIVE_CATALOG = src;
}

// 회사 config 로드 — calc/provider 설정과 FreePass theme 주입
async function loadCompanyConfig() {
  try {
    const id = companyProfileId();
    const res = await fetch(`/data/company-config/${id}.json`);
    const cfg = await res.json();
    setCompanyConfig(cfg);
    window.__welrix_companyConfig = cfg;
    applyProductTheme(cfg);
  } catch (e) {
    console.warn('[mobile] company config 로드 실패:', e);
  }
}

// vehicles.json (잔가율 매칭용) — 트림 선택 즉시 monthly 계산되도록 mount 전 로드
async function loadVehicles() {
  try {
    const res = await fetch('/data/vehicles.json');
    window.__welrix_vehicles = await res.json();
  } catch (e) {
    console.warn('[mobile] vehicles 로드 실패:', e);
    window.__welrix_vehicles = [];
  }
}

// 현대차 재고 (재고차 자동 할인 매칭용) — proxy /api/stock 통해 CORS 우회
async function loadStock() {
  try {
    const res = await fetch('/api/stock');
    if (!res.ok) throw new Error('http ' + res.status);
    const json = await res.json();
    window.__welrix_stock = json.data || [];
  } catch (e) {
    console.warn('[mobile] stock 로드 실패:', e);
    window.__welrix_stock = [];
  }
}

// profile에 맞는 catalog script 로드 뒤 VEHICLE_DB 준비 상태 확인
async function waitForVehicleDb(timeoutMs = 5000) {
  if (window.VEHICLE_DB) return;
  const start = Date.now();
  while (!window.VEHICLE_DB) {
    if (Date.now() - start > timeoutMs) {
      console.warn('[mobile] VEHICLE_DB 로드 타임아웃');
      return;
    }
    await new Promise(r => setTimeout(r, 30));
  }
}

/** ★`?staff=1` 로 들어왔고 아직 담당자가 아니면 PIN 을 한 번 묻는다.
 *   맞히면 그 «폰에» 기억한다 — 다음부터는 그냥 열어도 담당자 화면이다.
 *   손님은 이 화면을 볼 일이 없다(주소에 staff=1 이 없으니). */
function 담당자문(){
  return new Promise((끝) => {
    const 벽 = document.createElement('div');
    벽.className = 'gate-bg';
    벽.innerHTML = `
      <div class="gate-card">
        <img class="gate-ci" src="${companyProfileId()==='freepass'?'/freepass-wordmark.svg':'/welrix-ci.png'}" alt="">
        <h1 class="gate-title">담당자 확인</h1>
        <p class="gate-sub">이 기기를 담당자용으로 기억합니다</p>
        <input id="gate-pin" inputmode="numeric" autocomplete="off" placeholder="PIN">
        <div id="gate-err" style="display:none">PIN 이 맞지 않습니다</div>
        <button id="gate-submit" type="button">확인</button>
        <button id="gate-admin" type="button">손님 화면으로 보기</button>
      </div>`;
    document.body.appendChild(벽);
    const 칸 = 벽.querySelector('#gate-pin');
    const 틀림 = 벽.querySelector('#gate-err');
    const 닫기 = () => { 벽.remove(); 끝(); };
    const 해보기 = () => {
      if (담당자로(칸.value)) return 닫기();
      틀림.style.display = 'block'; 칸.value = ''; 칸.focus();
    };
    벽.querySelector('#gate-submit').onclick = 해보기;
    벽.querySelector('#gate-admin').onclick = 닫기;
    칸.onkeydown = (e) => { if (e.key === 'Enter') 해보기(); };
    setTimeout(() => 칸.focus(), 50);
  });
}

async function boot() {
  if (담당자로들어왔나() && !담당자인가()) {
    await 담당자문();
    역할기본조건동기화();
  }
  await loadVehicleDb();
  await waitForVehicleDb();
  await Promise.all([loadCompanyConfig(), loadVehicles()]);
  // 재고는 비동기 — mount 후에도 늦게 도착해도 OK
  loadStock();
  /* ★공유 링크로 들어왔으면 고른 것을 먼저 풀어 놓고 그린다.
     VEHICLE_DB·vehicles.json 이 다 온 뒤라야 트림·옵션이 살아난다. */
  try { 풀기(vehicleState, quoteState); }
  catch (e) { console.warn('[mobile] 공유 링크 풀기 실패:', e); }

  installMobileHaptics(document);
  const app = createApp(MobileApp);
  app.mount('#m-app');
}

boot();

// 모바일에서도 window.__welrix_recompute 가 호출되니 noop 으로 등록 (Vue 컴포넌트가 reactive 로 재계산)
window.__welrix_recompute = () => {};
