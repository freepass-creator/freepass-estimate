// 차종 가이드 페이지 엔트리 — URL 파라미터 ?slug=g80 으로 차종 결정
import { createApp } from 'vue';
import GuideDetail from './components/guide/GuideDetail.vue';
import { ALL_SLUGS } from './lib/slug.js';

function getSlug() {
  // 1순위: ?slug=g80 쿼리
  const params = new URLSearchParams(location.search);
  const q = params.get('slug');
  if (q && ALL_SLUGS.includes(q)) return q;
  // 2순위: /guide/{slug}.html 또는 /guide/{slug} 경로
  const m = location.pathname.match(/\/guide\/?([a-z0-9-]+)(\.html)?$/i);
  if (m && ALL_SLUGS.includes(m[1])) return m[1];
  // 3순위: # 해시
  const h = location.hash.replace(/^#/, '');
  if (h && ALL_SLUGS.includes(h)) return h;
  return null;
}

function mountAll() {
  if (!window.VEHICLE_DB) {
    setTimeout(mountAll, 50);
    return;
  }
  const slug = getSlug();
  const target = document.getElementById('guide-root');
  if (!target) return;
  const app = createApp(GuideDetail, { slug });
  app.mount(target);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll);
} else {
  mountAll();
}
