// 홈페이지 Vue 엔트리 — 마케팅 랜딩 + 셀프 견적 + 상담 신청
// 차량 선택 카탈로그는 브라우저에 적재하되, 가격 계산은 각 화면에서 canonical Quote Core API를 사용한다.
import { createApp } from 'vue';
import QuoteWidget from './components/home/QuoteWidget.vue';
import LeadForm from './components/home/LeadForm.vue';
import Lineup from './components/home/Lineup.vue';
import HeroBest from './components/home/HeroBest.vue';
import AiRecommender from './components/home/AiRecommender.vue';

function mountOne(id, Component, label) {
  const target = document.getElementById(id);
  if (!target) { console.warn(`[home] #${id} 없음`); return; }
  createApp(Component).mount(target);
  console.log(`[home] ${label} mounted`);
}

async function mountAll() {
  // canonical preview request가 stable vehicle identity를 해석할 수 있도록 카탈로그 적재까지 기다린다.
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
