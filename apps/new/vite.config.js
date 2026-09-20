import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

// 빌드 시 영업자 PIN 을 HTML 에 inject — Vercel 환경변수 VITE_AGENT_PIN 으로 변경
// 관리자는 Firebase 로그인 (?admin=1) 사용 — PIN 불필요
function injectGatePins() {
  return {
    name: 'inject-gate-pins',
    transformIndexHtml(html) {
      const agent = process.env.VITE_AGENT_PIN || '1234';
      const tag = `<script>window.__GATE_PINS={agent:${JSON.stringify(agent)}};</script>`;
      return html.replace(/<head>/, '<head>\n' + tag);
    },
  };
}

const BUILD_REVISION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA || null;

export default defineConfig({
  root: '.',
  define: {
    __FREEPASS_BUILD_REVISION__: JSON.stringify(BUILD_REVISION),
  },
  publicDir: 'public',
  plugins: [vue(), injectGatePins()],
  server: {
    port: 5173,
    open: '/index.html',
    /* ★개발용 프록시 — 배포에서는 api/estimate.js(Vercel 함수)가 같은 일을 한다.
       웰릭스 계산 서버는 CORS 가 안 열려 있어 브라우저에서 직접 못 부른다. */
    proxy: {
      '/api/estimate': {
        target: 'https://welrixmobility.netlify.app',
        changeOrigin: true,
        secure: true,
      },
    },
    // 캐시 완전 비활성 — 새로고침만으로 항상 최신 코드 받음
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        mobile: resolve(__dirname, 'mobile.html'),
        home: resolve(__dirname, 'home.html'),
        vehicles: resolve(__dirname, 'vehicles.html'),
        guide: resolve(__dirname, 'guide.html'),
      },
    },
  },
});
