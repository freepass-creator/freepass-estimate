import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('src/components/mobile/MobileApp.vue','utf8');

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

console.log('PASS mobile navigation contract — Prev/Next remain implemented; auto steps hide Next, manual steps expose it');
