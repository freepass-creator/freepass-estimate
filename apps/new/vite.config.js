import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import standardQuoteHandler from './api/standard-quote.js';

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

// Vercel Functions는 `vite` 개발 서버에 자동으로 붙지 않는다. 운영과 같은
// handler를 로컬 미들웨어에 연결해 /api/standard-quote 404를 막는다.
function localStandardQuoteApi() {
  return {
    name: 'freepass-local-standard-quote-api',
    configureServer(server) {
      server.middlewares.use('/api/standard-quote', async (req, res) => {
        const startedAt = Date.now();
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString('utf8');
          req.body = raw ? JSON.parse(raw) : {};
          res.status = (statusCode) => { res.statusCode = statusCode; return res; };
          res.json = (payload) => {
            if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
          };
          console.log('[local-standard-quote] request', {
            method: req.method,
            scenarios: Array.isArray(req.body?.안들) ? req.body.안들.length : 0,
          });
          await standardQuoteHandler(req, res);
          console.log('[local-standard-quote] complete', {
            status: res.statusCode,
            elapsedMs: Date.now() - startedAt,
          });
        } catch (error) {
          console.error('[local-standard-quote] failed', {
            error: String(error?.message || error),
            elapsedMs: Date.now() - startedAt,
          });
          if (!res.headersSent) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
          if (!res.writableEnded) res.end(JSON.stringify({
            ok: false,
            error: '표준 견적 요청을 읽을 수 없습니다',
            code: 'STANDARD_QUOTE_BAD_REQUEST',
          }));
        }
      });
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
  plugins: [vue(), injectGatePins(), localStandardQuoteApi()],
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
