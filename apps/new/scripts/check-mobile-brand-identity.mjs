import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('mobile.html', 'utf8');
const desktopHtml = fs.readFileSync('index.html', 'utf8');
const mobile = fs.readFileSync('src/mobile.js', 'utf8');
const theme = fs.readFileSync('src/lib/brand-theme.js', 'utf8');
const mobileApp = fs.readFileSync('src/components/mobile/MobileApp.vue', 'utf8');
const sendSheet = fs.readFileSync('src/components/mobile/SendSheet.vue', 'utf8');
const result = fs.readFileSync('src/components/mobile/StepResult.vue', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/freepass-manifest.webmanifest', 'utf8'));
const desktopManifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const desktopHead = desktopHtml.match(/<head>[\s\S]*?<\/head>/i)?.[0] || '';

assert.match(html, /<title>프리패스모빌리티 · 신차 장기렌터카 견적<\/title>/,
  'mobile static title must identify FreePass before JavaScript loads');
assert.match(html, /<link rel="manifest" href="\/freepass-manifest\.webmanifest"/,
  'mobile default manifest must be FreePass');
assert.doesNotMatch(html, /apple-touch-icon[^>]+welrix|apple-mobile-web-app-title" content="웰릭스/,
  'mobile head must not expose a legacy brand');
assert.match(mobile, /fetch\('\/data\/company-config\/freepass\.json'\)/,
  'mobile must always load the FreePass product profile');
assert.doesNotMatch(mobile, /companyProfileId|params\.get\('c'\)|welrix-ci\.png/,
  'query parameters must not switch the FreePass product identity');
assert.match(mobile, /<img class="gate-ci" src="\/freepass-wordmark\.svg" alt="프리패스모빌리티">/,
  'staff gate must always show the FreePass wordmark');
assert.ok(
  mobile.indexOf('await loadCompanyConfig();') < mobile.indexOf('if (담당자로들어왔나()'),
  'company identity must load before the staff gate opens',
);
assert.match(theme, /manifest\.setAttribute\('href','\/freepass-manifest\.webmanifest'\)/,
  'runtime theme must keep the FreePass manifest');
assert.doesNotMatch(theme, /웰릭스|welrix-ci|\/manifest\.webmanifest/,
  'runtime theme must not contain a legacy product identity fallback');
assert.doesNotMatch(mobileApp, /웰컴저축은행 × 웰릭스모빌리티/,
  'mobile header must not expose a legacy product identity');
assert.doesNotMatch(sendSheet, /welrix-견적서|웰릭스 CI 제외하고 발송/,
  'mobile exports and labels must use FreePass-neutral naming');
assert.doesNotMatch(result, /공유 당시 웰릭스 계산 결과/,
  'quote result copy must not present a legacy brand as the product');
assert.equal(manifest.start_url, '/mobile.html?force=mobile');
assert.equal(manifest.theme_color, '#1b2a4a');

assert.match(desktopHead, /<title>프리패스모빌리티 — 신차 장기렌터카 견적<\/title>/,
  'desktop static title must identify FreePass');
assert.match(desktopHead, /<meta property="og:site_name" content="프리패스모빌리티" \/>/,
  'desktop Open Graph identity must be FreePass');
assert.match(desktopHead, /<link rel="icon" type="image\/svg\+xml" href="\/freepass-wordmark\.svg" \/>/,
  'desktop favicon must use a FreePass asset');
assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/freepass-wordmark\.svg" \/>/,
  'mobile favicon must use a FreePass asset');
assert.doesNotMatch(desktopHead, /웰릭스|welrix-icon|og-image\.png|\[email protected\]/,
  'desktop head must not expose legacy Welrix branding or the broken font source');
assert.equal(desktopManifest.name, '프리패스모빌리티 — 신차 장기렌터카 견적');
assert.equal(desktopManifest.short_name, '프리패스 견적');
assert.equal(desktopManifest.start_url, '/index.html');
assert.equal(desktopManifest.theme_color, '#1b2a4a');

console.log('PASS FreePass brand identity — mobile and desktop heads/manifests remain FreePass-only');
