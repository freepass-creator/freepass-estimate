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
const finalUi = read('src/styles/admin-alignment.css');

const repoRoot = new URL('../../../', import.meta.url);
const postMergeVisualQa = fs.readFileSync(new URL('.github/workflows/newcar-ui-screenshots.yml', repoRoot), 'utf8');

assert.equal(
  fs.existsSync(new URL('../src/styles/admin-desktop-alignment.css', import.meta.url)),
  false,
  'duplicate desktop alignment authority must not be recreated'
);
assert.equal(
  fs.existsSync(new URL('../scripts/capture-ui.mjs', import.meta.url)),
  false,
  'duplicate screenshot harness must not be recreated'
);
assert.match(
  postMergeVisualQa,
  /run:\s*node scripts\/e2e-ui-visual-audit\.mjs/,
  'post-merge visual QA must use the canonical e2e-ui-visual-audit harness'
);
assert.doesNotMatch(
  postMergeVisualQa,
  /capture-ui\.mjs/,
  'post-merge workflow must not reference the retired screenshot harness'
);

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
assert.match(desktop, /body\s*\{[\s\S]*grid-template-rows:\s*var\(--fp-topbar\) minmax\(0, 1fr\) var\(--fp-panel-foot\);/,
  'desktop base shell must own the PR92 row density');
assert.match(desktop, /<style id="freepass-control-grammar">[\s\S]*body\s*\{\s*column-gap:\s*12px;/,
  'desktop guardrails must only refine viewport composition');
const quoteRuntimeStart = desktop.indexOf('<!-- ===== wel 견적 계산');
const quoteDocumentStart = desktop.indexOf('/* 실제 견적서 영역 */', quoteRuntimeStart);
assert.ok(quoteRuntimeStart >= 0 && quoteDocumentStart > quoteRuntimeStart,
  'runtime quote style boundary markers must remain discoverable');
const quoteRuntimeCss = desktop.slice(quoteRuntimeStart, quoteDocumentStart);
assert.doesNotMatch(
  quoteRuntimeCss,
  /font-size:\s*(?:10|10\.5|11|11\.5|12\.5|13|13\.5|15|17|22|30)px\s*;/,
  'runtime Estimate UI must use the canonical PR92 typography scale; exported quote document is exempt'
);
assert.match(desktop, /\.cdd__btn\s*\{[\s\S]*height:\s*var\(--fp-control\);[\s\S]*border:\s*1px solid transparent;[\s\S]*box-shadow:\s*var\(--fp-elevation-base\);/,
  'desktop dropdown base must own the 36px line-free control grammar');
assert.match(desktop, /\.step-dd\s*\{[\s\S]*height:\s*var\(--fp-control\);[\s\S]*border:\s*1px solid transparent;[\s\S]*font-size:\s*var\(--fp-fs-body\);/,
  'vehicle configuration dropdown base must use PR92 desktop density');
assert.match(desktop, /\.wrap \.step-dd\s*\{[\s\S]*display:\s*block !important;[\s\S]*height:\s*var\(--fp-control\) !important;/,
  'desktop guardrail must only force vehicle dropdown visibility and density');
assert.match(desktop, /\.wrap :is\(\.step-title, \.step-title-text\)\s*\{[\s\S]*font-size:\s*var\(--fp-fs-support\) !important;[\s\S]*color:\s*var\(--fp-text-muted\) !important;/,
  'vehicle configuration labels must use the PR92 support scale');
assert.match(desktop, /\.wrap \.option-row \.o-name\s*\{[\s\S]*font-size:\s*var\(--fp-fs-body\) !important;/,
  'vehicle option identities must use the PR92 body scale');
assert.match(desktop, /\.wrap \.footnote\s*\{[\s\S]*border-top:\s*0 !important;[\s\S]*font-size:\s*var\(--fp-fs-support\) !important;/,
  'vehicle panel footnotes must use spacing instead of dividers');
assert.match(desktop, /\.bottom-action\s*\{[\s\S]*height:\s*var\(--fp-control\);[\s\S]*border:\s*1px solid transparent;[\s\S]*box-shadow:\s*var\(--fp-elevation-base\);/,
  'desktop action base must use Admin PR92 line-free controls');
assert.doesNotMatch(quoteRuntimeCss, /wel-input-pulse|border-bottom-color:\s*var\(--brand\)/,
  'legacy underline/pulse field grammar must not exist in runtime Estimate UI');
assert.match(desktop, /\.term-card__monthly\s*\{[\s\S]*font-size:\s*var\(--fp-fs-kpi\);/,
  'desktop monthly quote base must use the PR92 KPI scale');
assert.match(desktop, /\.terms-grid\s*\{[\s\S]*background:\s*var\(--fp-surface-soft\);[\s\S]*border:\s*0;/,
  'customer quote block must be a neutral line-free surface');
assert.match(desktop, /\.term-card__row \+ \.term-card__row\s*\{\s*border-top:\s*0;\s*\}/,
  'quote fact rows must not reintroduce dashed separators');
assert.match(desktop, /details\.qp-extras\[open\] > summary\s*\{[\s\S]*border-bottom:\s*0 !important;[\s\S]*background:\s*var\(--fp-surface-soft\);/,
  'extras accordion must use surface hierarchy instead of dividers');
assert.match(desktop, /\.customer-output\s*\{[\s\S]*border:\s*0;[\s\S]*box-shadow:\s*var\(--fp-elevation-base\);/,
  'runtime quote preview base must stay line-free');
assert.match(desktop, /\.quote-modal__head\s*\{[\s\S]*min-height:\s*var\(--fp-panel-head\);[\s\S]*border-bottom:\s*0;/,
  'quote modal base header must use the PR92 panel-head grammar');
assert.match(desktop, /\.quote-panel :is\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select\),[\s\S]*min-height:\s*var\(--fp-control\);[\s\S]*border:\s*1px solid transparent !important;[\s\S]*background:\s*var\(--fp-surface-soft\) !important;/,
  'desktop fields must use surface/elevation rather than visible borders');

assert.match(finalUi, /\.sr-term\s*\{[\s\S]*padding:\s*12px;/,
  'quote result term cards must keep the compact mobile density');
assert.match(finalUi, /\.sq-table__term-select\s*\{[\s\S]*min-height:\s*var\(--h-touch-min\);/,
  'mobile quote controls must preserve the 44px touch floor');
const sticky = read('src/components/mobile/StickyQuote.vue');
assert.match(sticky, /\.sq-detail\s*\{[\s\S]*border-top:\s*0;/,
  'expanded mobile quote detail must stay line-free');
assert.match(sticky, /\.sq-table th, \.sq-table td\s*\{[\s\S]*border-bottom:\s*0;/,
  'expanded mobile quote rows must not reintroduce separators');
assert.match(sticky, /\.sq-table thead th\s*\{[\s\S]*font-size:\s*var\(--fs-sm\);[\s\S]*border-bottom:\s*0;/,
  'expanded mobile quote headers must use support scale without divider lines');
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
const vehicle = read('src/components/mobile/StepVehicle.vue');
assert.match(vehicle, /class="sv-empty" role="status"/,
  'mobile empty state must expose status semantics');
assert.match(vehicle, /\.sv-empty\s*\{[\s\S]*background:\s*var\(--fp-surface-soft\);[\s\S]*box-shadow:\s*var\(--fp-elevation-base\);/,
  'mobile empty state must use the PR92 neutral surface grammar');

console.log('PASS FreePass Admin PR92 design authority — desktop 36 / mobile 44 / line-free');
