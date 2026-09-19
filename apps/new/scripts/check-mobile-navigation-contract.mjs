import { MOBILE_NAVIGATION_CONTRACT } from '../src/lib/quote/contracts.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('src/components/mobile/MobileApp.vue','utf8');
const e2e=fs.readFileSync('scripts/e2e-mobile-ux.mjs','utf8');

for(const token of [
  'const 하단내비 = computed',
  "mode: 자동전진단계.value ? 'auto' : 'manual'",
  'showNext: !마지막 && !자동전진단계.value',
  'function next()',
  'function prev()',
  'v-show="하단내비.showNext"',
  ':data-nav-mode="하단내비.mode"',
]){
  assert.ok(src.includes(token),'mobile navigation contract missing: '+token);
}

assert.ok(!e2e.includes('.m-header .m-act'),'stale E2E selector detected: header action no longer exists');
assert.ok(e2e.includes(".m-footer button"),'E2E must exercise canonical bottom action area');
assert.ok(e2e.includes('force=mobile&c=welrix'),'E2E provider fixture must remain explicit');

console.log(`PASS ${MOBILE_NAVIGATION_CONTRACT} — Prev/Next state contract + E2E selector freshness`);
