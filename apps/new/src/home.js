// 홈페이지 Vue 엔트리 — 마케팅 랜딩 + 셀프 견적 + 상담 신청
// 견적 엔진(lib/calc.js)·차량 DB(vehicles.json) 는 ERP 와 100% 공유.
// 단, UI 셸은 마케팅 톤에 맞춰 별도. 어느 한쪽 calc 개선하면 양쪽 다 반영됨.
import { createApp } from 'vue';
import { setCompanyConfig } from './lib/calc.js';
import QuoteWidget from './components/home/QuoteWidget.vue';
import LeadForm from './components/home/LeadForm.vue';
import Lineup from './components/home/Lineup.vue';
import HeroBest from './components/home/HeroBest.vue';
import AiRecommender from './components/home/AiRecommender.vue';

// 회사 config(welrix.json = 엑셀 견적기 정책 SSOT) 주입 — 웹 ERP/모바일과 동일 엔진 설정.
// (과거 home 은 이 주입을 안 해서 calc.js 기본값으로 계산 → 포터보험·중신용 수익률 등이 어긋났음)
let __configReady = (async () => {
  try {
    const res = await fetch('/data/company-config/welrix.json');
    setCompanyConfig(await res.json());
  } catch (e) {
    console.warn('[home] company config 로드 실패:', e);
  }
})();

function mountOne(id, Component, label) {
  const target = document.getElementById(id);
  if (!target) { console.warn(`[home] #${id} 없음`); return; }
  createApp(Component).mount(target);
  console.log(`[home] ${label} mounted`);
}

async function mountAll() {
  // config(welrix.json) 주입 완료 + window.VEHICLE_DB 로드까지 대기 후 mount
  await __configReady;
  if (!window.VEHICLE_DB) {
    setTimeout(mountAll, 50);
    return;
  }
  mountOne('hero-best-root', HeroBest, 'HeroBest');
  mountOne('lineup-root', Lineup, 'Lineup');
  mountOne('ai-recommender-root', AiRecommender, 'AiRecommender');
  mountOne('quote-widget-root', QuoteWidget, 'QuoteWidget');
  mountOne('lead-form-root', LeadForm, 'LeadForm');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll);
} else {
  mountAll();
}

// 부드러운 nav scroll
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1).split('?')[0];
  const target = document.getElementById(id);
  if (target) {
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  }
});
