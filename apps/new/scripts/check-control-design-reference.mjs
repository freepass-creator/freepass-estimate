import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const corners = /--r-chip:\s*6px;[\s\S]*--r-card:\s*6px;/;
const heights = /--h-chip:\s*44px;\s*--h-input:\s*44px;\s*--h-cta:\s*44px;/;

// Guard the validators themselves against escaped-whitespace regressions.
assert.match('--r-chip: 6px;\n--r-card: 6px;', corners);
assert.doesNotMatch('--r-chip: 6px;\n--r-card: 12px;', corners);
assert.match('--h-chip: 44px;\n--h-input: 44px; --h-cta: 44px;', heights);
for (const legacy of [
  '--h-chip: 40px; --h-input: 44px; --h-cta: 44px;',
  '--h-chip: 44px; --h-input: 40px; --h-cta: 44px;',
  '--h-chip: 44px; --h-input: 44px; --h-cta: 48px;',
]) assert.doesNotMatch(legacy, heights);

const tokens = read('src/styles/tokens.css');
const mobile = read('src/components/mobile/MobileApp.vue');
const conditions = read('src/components/mobile/StepConditions.vue');
const extras = read('src/components/mobile/StepExtras.vue');
const result = read('src/components/mobile/StepResult.vue');
const desktop = read('index.html');
const finalUi = read('src/styles/admin-alignment.css');

assert.match(tokens, corners,
  'Admin baseline requires compact 6px control and card corners');
assert.match(tokens, heights,
  'Admin baseline requires a unified 44px control rhythm');
assert.match(mobile, /\.m-btn\s*\{[\s\S]*height:\s*var\(--h-cta\);[\s\S]*border-radius:\s*var\(--r-chip\);/,
  'mobile footer actions must use the Admin action token');
assert.match(conditions, /\.sc-chip\s*\{[\s\S]*min-height:\s*var\(--h-chip\);[\s\S]*border:\s*0;/,
  'condition choices must share the compact button grammar');
assert.match(extras, /\.se-chip\s*\{[\s\S]*min-height:\s*var\(--h-chip\);[\s\S]*border-radius:\s*var\(--r-chip\);/,
  'service choices must match condition choices');
assert.match(extras, /\.se-select\s*\{[^}]*height:\s*var\(--h-input\);[^}]*padding:\s*0 32px 0 12px;[^}]*border-radius:\s*var\(--r-card\);/,
  'mobile selects must use compact Admin field padding and corners');
assert.match(desktop, /<style id="freepass-control-grammar">[\s\S]*\.cdd \.cdd__btn\s*\{[\s\S]*height:\s*44px;[\s\S]*padding:\s*0 34px 0 14px;[\s\S]*font-size:\s*14px;/,
  'desktop custom dropdowns must use the Admin field rhythm');
assert.match(desktop, /\.qc-field > input, \.cs-field input \{ padding: 0 14px !important; \}/,
  'desktop text fields must not render text against the boundary');
assert.match(desktop, /\.quote-panel \.qc-pct input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\s*\{[\s\S]*border:\s*0 !important;[\s\S]*background:\s*transparent !important;/,
  'nested percent inputs must not gain a second field boundary');
assert.match(tokens, /--r-panel:\s*4px;[\s\S]*--r-control:\s*6px;[\s\S]*--fs-mobile-input:\s*16px;/,
  'Admin role tokens must live in the shared token authority');
assert.match(finalUi, /\.sr-term\s*\{[\s\S]*padding:\s*12px;[\s\S]*border-radius:\s*var\(--r-panel\);/,
  'quote result term cards must use compact Admin surface density');
assert.match(finalUi, /\.sq-table__term-select\s*\{[\s\S]*min-height:\s*var\(--h-touch-min\);/,
  'live quote term controls must preserve the 44px touch floor');
assert.match(finalUi, /#gate-submit,[\s\S]*#gate-admin\s*\{[\s\S]*height:\s*var\(--h-cta\);/,
  'staff gate actions must use the common 44px action height');
assert.doesNotMatch(finalUi, /:root\s*\{[\s\S]*--r-panel:/,
  'Admin alignment stylesheet must not create a second token authority');

// Confine each assertion to its own rule; do not pass via unrelated later CSS.
assert.match(result, /\.sr-term\s*\{[^}]*flex-wrap:\s*wrap;[^}]*padding:\s*var\(--sp-3\);[^}]*border-radius:\s*var\(--r-card\);/,
  'result cards must wrap safely and use the shared spacing/corner tokens');
assert.match(result, /\.sr-term__monthly\s*\{[^}]*text-align:\s*right;[^}]*overflow-wrap:\s*anywhere;/,
  'monthly amounts must remain right-aligned without forcing horizontal overflow');
const conditionValueRule = result.match(/\.sr-cond__row b\s*\{([^}]*)\}/)?.[1] || '';
assert.match(conditionValueRule, /white-space:\s*normal;[\s\S]*overflow-wrap:\s*anywhere;/,
  'long quote conditions must remain readable');
assert.doesNotMatch(conditionValueRule, /text-overflow:\s*ellipsis|overflow:\s*hidden/,
  'quote conditions must not be silently truncated');

console.log('PASS FreePass Admin design baseline — source checks only; browser conformance is separate');
