import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

const LOCAL_API_MODULES = Object.freeze({
  '/api/estimate': './api/estimate.js',
  '/api/external-quote': './api/external-quote.js',
  '/api/freepass-data-master': './api/freepass-data-master.js',
  '/api/issued-quote': './api/issued-quote.js',
  '/api/issued-quotes': './api/issued-quotes.js',
  '/api/provider-health': './api/provider-health.js',
  '/api/share-envelope': './api/share-envelope.js',
  '/api/share-envelopes': './api/share-envelopes.js',
  '/api/standard-quote': './api/standard-quote.js',
  '/api/standard-quote-batch': './api/standard-quote-batch.js',
  '/api/stock': './api/stock.js',
  '/api/version': './api/version.js',
});

function queryObject(searchParams) {
  const out = {};
  for (const [key, value] of searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

function cookieObject(rawCookie = '') {
  const out = {};
  for (const pair of String(rawCookie || '').split(';')) {
    const at = pair.indexOf('=');
    if (at <= 0) continue;
    const key = pair.slice(0, at).trim();
    const value = pair.slice(at + 1).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  }
  return out;
}

async function readRequestBody(req) {
  if (req.body !== undefined) return req.body;
  if (['GET', 'HEAD', 'OPTIONS'].includes(String(req.method || 'GET').toUpperCase())) {
    return undefined;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) return JSON.parse(raw);
  return raw;
}

function attachVercelResponseCompat(res) {
  res.status = (statusCode) => {
    res.statusCode = Number(statusCode) || 200;
    return res;
  };
  res.json = (payload) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!res.writableEnded) res.end(JSON.stringify(payload));
    return res;
  };
  res.send = (payload) => {
    if (payload != null && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
      return res.json(payload);
    }
    if (!res.writableEnded) res.end(payload == null ? '' : String(payload));
    return res;
  };
  return res;
}

// npm run dev에서도 apps/new/api/*의 실제 Vercel handler를 그대로 실행한다.
// 로컬 전용 계산식/저장소를 만들지 않아 Local Windows와 Vercel의 경계를 일치시킨다.
function localVercelApi() {
  return {
    name: 'freepass-local-vercel-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const modulePath = LOCAL_API_MODULES[url.pathname];
        if (!modulePath) return next();

        const startedAt = Date.now();
        try {
          req.query = queryObject(url.searchParams);
          req.cookies = cookieObject(req.headers?.cookie);
          req.body = await readRequestBody(req);
          attachVercelResponseCompat(res);

          const mod = await import(modulePath);
          if (typeof mod.default !== 'function') {
            throw new Error(`Vercel handler default export missing: ${modulePath}`);
          }

          await mod.default(req, res);
          if (!res.writableEnded && !res.headersSent) res.end();

          console.log('[local-vercel-api]', {
            path: url.pathname,
            method: req.method,
            status: res.statusCode,
            elapsedMs: Date.now() - startedAt,
          });
        } catch (error) {
          console.error('[local-vercel-api] failed', {
            path: url.pathname,
            error: String(error?.message || error),
            elapsedMs: Date.now() - startedAt,
          });
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
          if (!res.writableEnded) {
            res.end(JSON.stringify({
              ok: false,
              code: 'LOCAL_VERCEL_API_FAILED',
              error: '로컬 API 실행에 실패했습니다',
            }));
          }
        }
      });
    },
  };
}

// 영업자 PIN은 UX gate일 뿐 보안 인증 수단이 아니다.
// Vercel Production에서는 check-deploy-env가 명시 설정을 요구하며,
// 로컬 개발에서만 편의를 위해 1234를 fallback으로 사용한다.
function injectGatePins() {
  return {
    name: 'inject-gate-pins',
    transformIndexHtml(html) {
      const configured = String(process.env.VITE_AGENT_PIN || '').trim();
      const agent = configured || (process.env.VERCEL_ENV ? '' : '1234');
      const tag = `<script>window.__GATE_PINS={agent:${JSON.stringify(agent)}};</script>`;
      return html.replace(/<head>/, '<head>\n' + tag);
    },
  };
}

const BUILD_REVISION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA || null;

export default defineConfig(({ mode }) => {
  // Vite only exposes VITE_* values to browser code. Local server handlers also need
  // server-only FREEPASS_* values from .env.local, so load all keys into this Node
  // process without overriding variables already supplied by the shell/CI.
  const localEnv = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(localEnv)) {
    if (process.env[key] == null) process.env[key] = value;
  }

  return {
  root: '.',
  define: {
    __FREEPASS_BUILD_REVISION__: JSON.stringify(BUILD_REVISION),
  },
  publicDir: 'public',
  plugins: [vue(), injectGatePins(), localVercelApi()],
  server: {
    port: 5173,
    open: '/index.html',
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
  };
});
