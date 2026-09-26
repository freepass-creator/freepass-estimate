import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const tokens = read('src/styles/tokens.css');
const mobile = read('src/components/mobile/MobileApp.vue');
const conditions = read('src/components/mobile/StepConditions.vue');
const extras = read('src/components/mobile/StepExtras.vue');
const result = read('src/components/mobile/StepResult.vue');
const desktop = read('index.html');
const mobileHtml = read('mobile.html');
const desktopAlignment = read('src/styles/admin-desktop-alignment.css');
const finalUi = read('src/styles/admin-alignment.css');

const canonicalScale = [
  /--fp-fs-kpi:\s*24px;/,
  /--fp-fs-screen:\s*20px;/,
  /--fp-fs-panel:\s*18px;/,
  /--fp-fs-section:\s*16px;/,
  /--fp-fs-body:\s*14px;/,
  /--fp-fs-support:\s*12px;/,
  /--fp-control-sm:\s*32px;/,
  /--fp-control:\s*36px;/,
  /--fp-row:\s*40px;/,
  /--fp-topbar:\s*56px;/,
  /--fp-mobile-control:\s*44px;/,
  /--fp-mobile-action:\s*44px;/,
  /--fp-r-control:\s*6px;/,
  /--fp-r-panel:\s*8px;/,
];
for (const pattern of canonicalScale) {
  assert.match(tokens, pattern, `Admin PR92 canonical token missing: ${pattern}`);
}

assert.match(tokens, /--fp-canvas:\s*#F2F6FC;/,
  'desktop canvas must use the Admin PR92 canvas');
assert.match(tokens, /--fp-surface:\s*#FFFFFF;/,
  'panel surface must use the Admin PR92 surface');
assert.match(tokens, /--fp-elevation-base:\s*0 1px 2px rgba\(16, 24, 40, 0\.05\);/,
  'line-free components need the Admin PR92 base elevation');
assert.match(tokens, /--fp-focus-halo:\s*0 0 0 3px rgba\(29, 78, 216, 0\.14\);/,
  'line-free focus must retain a visible halo');

assert.match(mobile, /\.m-btn\s*\{[\s\S]*height:\s*var\(--h-cta\);[\s\S]*border-radius:\s*var\(--r-chip\);/,
  'mobile footer actions must remain on the 44px mobile action token');
assert.match(conditions, /\.sc-chip\s*\{[\s\S]*min-height:\s*var\(--h-chip\);[\s\S]*border:\s*0;/,
  'mobile condition choices must preserve the 44px touch floor');
assert.match(extras, /\.se-chip\s*\{[\s\S]*min-height:\s*var\(--h-chip\);[\s\S]*border-radius:\s*var\(--r-chip\);/,
  'mobile service choices must preserve the canonical control geometry');

assert.match(desktop, /<link rel="stylesheet" href="\/src\/styles\/tokens\.css"\s*\/>/,
  'desktop must consume the same canonical token authority as mobile');
assert.match(desktop, /window\.innerWidth <= 1024/,
  'desktop entry must hand <=1024px viewports to the mobile shell');
assert.match(mobileHtml, /window\.innerWidth > 1024/,
  'mobile entry must hand >1024px viewports to the desktop shell');
assert.match(desktop, /<style id="freepass-control-grammar">[\s\S]*grid-template-rows:\s*var\(--fp-topbar\)[\s\S]*column-gap:\s*12px;/,
  'desktop workspace must project the PR92 shell density');
assert.match(desktop, /\.cdd \.cdd__btn\s*\{[\s\S]*height:\s*var\(--fp-control\)[\s\S]*border-color:\s*transparent !important;[\s\S]*box-shadow:\s*var\(--fp-elevation-base\)/,
  'desktop dropdowns must use the 36px line-free control grammar');
assert.match(desktop, /\.wrap \.step-dd\s*\{[\s\S]*height:\s*var\(--fp-control\) !important;[\s\S]*border:\s*1px solid transparent !important;[\s\S]*font-size:\s*var\(--fp-fs-body\) !important;/,
  'vehicle configuration dropdowns must use PR92 desktop density');
assert.match(desktop, /\.wrap :is\(\.step-title, \.step-title-text\)\s*\{[\s\S]*font-size:\s*var\(--fp-fs-support\) !important;[\s\S]*color:\s*var\(--fp-text-muted\) !important;/,
  'vehicle configuration labels must use the PR92 support scale');
assert.match(desktop, /\.wrap \.option-row \.o-name\s*\{[\s\S]*font-size:\s*var\(--fp-fs-body\) !important;/,
  'vehicle option identities must use the PR92 body scale');
assert.match(desktop, /\.wrap \.footnote\s*\{[\s\S]*border-top:\s*0 !important;[\s\S]*font-size:\s*var\(--fp-fs-support\) !important;/,
  'vehicle panel footnotes must use spacing instead of dividers');
assert.match(desktop, /\.bottom-action\s*\{[\s\S]*height:\s*var\(--fp-control\)[\s\S]*border:\s*1px solid transparent !important;[\s\S]*box-shadow:\s*var\(--fp-elevation-base\)/,
  'desktop actions must use Admin PR92 line-free controls');
assert.match(desktop, /section\.is-current \.step-dd,[\s\S]*border-bottom-color:\s*transparent !important;[\s\S]*animation:\s*none !important;/,
  'legacy current-field underline pulse must stay disabled under PR92 line-free grammar');
assert.match(desktop, /\.term-card__monthly\s*\{[\s\S]*font-size:\s*var\(--fp-fs-kpi\) !important;/,
  'desktop monthly quote hero must use the PR92 KPI scale');
assert.match(desktop, /\.terms-grid\s*\{[\s\S]*border:\s*1px solid transparent !important;[\s\S]*background:\s*var\(--fp-primary-weak\) !important;/,
  'customer quote block must remain a tinted line-free surface');
assert.match(desktop, /\.term-card__row \+ \.term-card__row\s*\{[\s\S]*border-top:\s*0 !important;/,
  'quote fact rows must not reintroduce dashed separators');
assert.match(desktop, /details\.qp-extras\[open\] > summary\s*\{[\s\S]*border-bottom:\s*0 !important;[\s\S]*background:\s*var\(--fp-surface-soft\);/,
  'extras accordion must use surface hierarchy instead of dividers');
assert.match(desktop, /\.customer-output\s*\{[\s\S]*border:\s*1px solid transparent !important;[\s\S]*box-shadow:\s*var\(--fp-elevation-base\);/,
  'runtime quote preview shell must stay line-free');
assert.match(desktop, /\.quote-modal__head\s*\{[\s\S]*min-height:\s*var\(--fp-panel-head\);[\s\S]*border-bottom:\s*0 !important;/,
  'quote modal header must use the PR92 panel-head grammar');
assert.match(desktop, /\.quote-panel :is\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select\),[\s\S]*min-height:\s*var\(--fp-control\);[\s\S]*border:\s*1px solid transparent !important;[\s\S]*background:\s*var\(--fp-surface-soft\) !important;/,
  'desktop fields must use surface/elevation rather than visible borders');

assert.match(desktopAlignment, /height:\s*var\(--fp-control\);/,
  'desktop alignment stylesheet must use the 36px canonical control token');
assert.doesNotMatch(desktopAlignment, /height:\s*44px|min-height:\s*44px/,
  'desktop alignment must not reintroduce the old unified 44px Sales density');

assert.match(finalUi, /\.sr-term\s*\{[\s\S]*padding:\s*12px;/,
  'quote result term cards must keep the compact mobile density');
assert.match(finalUi, /\.sq-table__term-select\s*\{[\s\S]*min-height:\s*var\(--h-touch-min\);/,
  'mobile quote controls must preserve the 44px touch floor');
assert.match(finalUi, /#gate-submit,[\s\S]*#gate-admin\s*\{[\s\S]*height:\s*var\(--h-cta\);/,
  'staff gate actions must remain mobile 44px controls');
assert.match(finalUi, /\.sv-pc__in, \.sc-pct, \.se-discount\)\s*\{[\s\S]*border-color:\s*transparent !important;[\s\S]*box-shadow:\s*var\(--fp-elevation-base\);/,
  'mobile composite fields must use PR92 line-free surfaces');
assert.match(finalUi, /\.se-select, \.sq-pct-input\)\s*\{[\s\S]*border-color:\s*transparent !important;[\s\S]*background-color:\s*var\(--fp-surface-soft\) !important;/,
  'mobile select and quote inputs must use neutral surfaces instead of visible borders');
assert.match(finalUi, /\.sv-pc__in, \.sc-pct, \.se-discount\):focus-within,[\s\S]*box-shadow:\s*var\(--fp-focus-halo\), var\(--fp-elevation-hover\) !important;/,
  'mobile fields must preserve visible focus through the shared halo');
assert.doesNotMatch(finalUi, /:root\s*\{[\s\S]*--fp-/,
  'alignment stylesheet must not create a second token authority');

assert.match(result, /\.sr-term\s*\{[^}]*flex-wrap:\s*wrap;[^}]*padding:\s*var\(--sp-3\);/,
  'result cards must wrap safely with shared spacing');
assert.match(result, /\.sr-term__monthly\s*\{[^}]*text-align:\s*right;[^}]*overflow-wrap:\s*anywhere;/,
  'monthly amounts must remain right-aligned without forcing overflow');

console.log('PASS FreePass Admin PR92 design authority — desktop 36 / mobile 44 / line-free');
