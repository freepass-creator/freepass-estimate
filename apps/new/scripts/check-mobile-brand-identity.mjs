import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('mobile.html', 'utf8');
const mobile = fs.readFileSync('src/mobile.js', 'utf8');
const theme = fs.readFileSync('src/lib/brand-theme.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/freepass-manifest.webmanifest', 'utf8'));

assert.match(html, /<title>프리패스모빌리티 · 신차 장기렌터카 견적<\/title>/,
  'mobile static title must identify FreePass before JavaScript loads');
assert.match(html, /<link rel="manifest" href="\/freepass-manifest\.webmanifest"/,
  'mobile default manifest must be FreePass');
assert.doesNotMatch(html, /apple-touch-icon[^>]+welrix|apple-mobile-web-app-title" content="웰릭스/,
  'mobile head must not expose Welrix as the default install identity');
assert.match(mobile, /companyProfileId\(\) === 'freepass' \? '\/freepass-wordmark\.svg' : '\/welrix-ci\.png'/,
  'staff gate must choose its logo from the requested company profile before config fetch');
assert.ok(
  mobile.indexOf('await loadCompanyConfig();') < mobile.indexOf('if (담당자로들어왔나()'),
  'company identity must load before the staff gate opens',
);
assert.match(theme, /freepass\?'\/freepass-manifest\.webmanifest':'\/manifest\.webmanifest'/,
  'runtime theme must preserve explicit Welrix co-brand links while FreePass remains default');
assert.equal(manifest.start_url, '/mobile.html?force=mobile');
assert.equal(manifest.theme_color, '#1b2a4a');

console.log('PASS mobile brand identity — refresh starts FreePass and explicit Welrix remains supported');
