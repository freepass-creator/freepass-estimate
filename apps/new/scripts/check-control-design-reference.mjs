import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const tokens = read('src/styles/tokens.css');
const mobile = read('src/components/mobile/MobileApp.vue');
const conditions = read('src/components/mobile/StepConditions.vue');
const extras = read('src/components/mobile/StepExtras.vue');
const desktop = read('index.html');

assert.match(tokens, /--r-chip:\s*6px;[\s\S]*--r-card:\s*12px;/,
  'action and field/card corner roles must stay separate');
assert.match(tokens, /--h-chip:\s*40px;\s*--h-input:\s*44px;\s*--h-cta:\s*48px;/,
  'provisional control heights must match the approved Sales design reference');
assert.match(mobile, /\.m-btn\s*\{[\s\S]*height:\s*var\(--h-cta\);[\s\S]*border-radius:\s*var\(--r-chip\);/,
  'mobile footer actions must use the provisional action token');
assert.match(conditions, /\.sc-chip\s*\{[\s\S]*min-height:\s*var\(--h-chip\);[\s\S]*border:\s*0;/,
  'condition choices must share the compact button grammar');
assert.match(extras, /\.se-chip\s*\{[\s\S]*min-height:\s*var\(--h-chip\);[\s\S]*border-radius:\s*var\(--r-chip\);/,
  'service choices must match condition choices');
assert.match(extras, /\.se-select\s*\{[\s\S]*height:\s*var\(--h-input\);[\s\S]*padding:\s*0 32px 0 14px;[\s\S]*border-radius:\s*var\(--r-card\);/,
  'mobile selects must preserve field padding and field corners');
assert.match(desktop, /<style id="freepass-control-grammar">[\s\S]*\.cdd \.cdd__btn\s*\{[\s\S]*height:\s*44px;[\s\S]*padding:\s*0 34px 0 14px;[\s\S]*font-size:\s*14px;/,
  'desktop custom dropdowns must use the provisional field rhythm');
assert.match(desktop, /\.qc-field > input, \.cs-field input \{ padding: 0 14px !important; \}/,
  'desktop text fields must not render text against the boundary');
assert.match(desktop, /\.quote-panel \.qc-pct input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\s*\{[\s\S]*border:\s*0 !important;[\s\S]*background:\s*transparent !important;/,
  'nested percent inputs must not gain a second field boundary');

console.log('PASS provisional Sales design reference — control rhythm only; Estimate flow remains independent');
