import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const tokens = read('src/styles/tokens.css');
const mobile = read('src/components/mobile/MobileApp.vue');
const conditions = read('src/components/mobile/StepConditions.vue');
const extras = read('src/components/mobile/StepExtras.vue');
const desktop = read('index.html');
const approved = read('src/styles/approved-language.css');

assert.match(tokens, /--r-chip:\s*6px;[\s\S]*--r-card:\s*12px;/,
  'control and content-card corner roles must stay separate');
assert.match(tokens, /--fs-title:\s*18px;\s*--fs-main:\s*14px;\s*--fs-support:\s*12px;/,
  'approved Title/Main/Support role tokens must remain 18/14/12');
assert.match(tokens, /--h-chip:\s*44px;\s*--h-input:\s*44px;\s*--h-cta:\s*44px;/,
  'approved control/action heights must remain 44px');
assert.match(mobile, /\.m-btn\s*\{[\s\S]*height:\s*var\(--h-cta\);[\s\S]*border-radius:\s*var\(--r-chip\);/,
  'mobile footer actions must use the approved action token');
assert.match(mobile, /\.m-btn--primary\s*\{[\s\S]*font-size:\s*var\(--fs-main\);/,
  'mobile primary action text must use the approved Main role');
assert.match(conditions, /\.sc-chip\s*\{[\s\S]*min-height:\s*var\(--h-chip\);[\s\S]*border:\s*0;/,
  'condition choices must share the 44px button grammar');
assert.match(conditions, /\.sc-chip\.is-selected\s*\{[\s\S]*background:\s*var\(--brand-50\);[\s\S]*color:\s*var\(--brand\);/,
  'condition selection must use the approved soft selected surface');
assert.match(extras, /\.se-chip\s*\{[\s\S]*min-height:\s*var\(--h-chip\);[\s\S]*border-radius:\s*var\(--r-chip\);/,
  'service choices must match condition choices');
assert.match(extras, /\.se-select\s*\{[\s\S]*height:\s*var\(--h-input\);[\s\S]*padding:\s*0 32px 0 14px;[\s\S]*border-radius:\s*var\(--r-chip\);/,
  'mobile selects must use the approved 6px control radius');
assert.match(desktop, /<style id="freepass-control-grammar">[\s\S]*\.cdd \.cdd__btn\s*\{[\s\S]*height:\s*44px;[\s\S]*padding:\s*0 34px 0 14px;[\s\S]*font-size:\s*14px;/,
  'desktop custom dropdown base must retain the field rhythm');
assert.match(approved, /\.bottom-action\s*\{[\s\S]*height:\s*44px !important;[\s\S]*font-size:\s*14px !important;/,
  'desktop bottom actions must stay 44px / 14px');
assert.match(approved, /\.term-card__term-dd\s*\{[\s\S]*height:\s*44px !important;[\s\S]*font-size:\s*14px !important;/,
  'term selectors must stay on the approved 44px / 14px scale');
assert.match(approved, /:focus-visible\s*\{[\s\S]*outline:\s*3px solid #1d4ed8 !important;/,
  'desktop keyboard focus must remain visible');
assert.match(desktop, /\.qc-field > input, \.cs-field input \{ padding: 0 14px !important; \}/,
  'desktop text fields must not render text against the boundary');
assert.match(desktop, /\.quote-panel \.qc-pct input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\s*\{[\s\S]*border:\s*0 !important;[\s\S]*background:\s*transparent !important;/,
  'nested percent inputs must not gain a second field boundary');

console.log('PASS Admin-approved FreePass design language — control rhythm only; Estimate flow remains independent');
