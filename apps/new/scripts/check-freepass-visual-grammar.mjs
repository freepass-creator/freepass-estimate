import fs from 'node:fs';
import assert from 'node:assert/strict';

const files={
  vehicle:fs.readFileSync('src/components/mobile/StepVehicle.vue','utf8'),
  extras:fs.readFileSync('src/components/mobile/StepExtras.vue','utf8'),
  web:fs.readFileSync('index.html','utf8'),
};

function block(src,selector){
  const i=src.indexOf(selector);
  assert.ok(i>=0,selector+' block missing');
  const a=src.indexOf('{',i);
  let depth=0;
  for(let p=a;p<src.length;p++){
    if(src[p]==='{') depth++;
    else if(src[p]==='}') { depth--; if(depth===0) return src.slice(a+1,p); }
  }
  throw new Error(selector+' block not closed');
}
function noVisibleBorder(src,selector){
  const b=block(src,selector);
  assert.ok(/border\s*:\s*0\s*;/.test(b),selector+' must be borderless');
}
for(const sel of ['.sv-brand-card','.sv-row','.sv-trim-card','.sv-opt','.sv-color-card']) noVisibleBorder(files.vehicle,sel);
for(const sel of ['.se-card','.se-chip','.se-tint-area']) noVisibleBorder(files.extras,sel);
for(const sel of ['.card','.trim-row','.color-card','.bottom-action','.quote-modal__foot button']) noVisibleBorder(files.web,sel);

const chipSelected=block(files.extras,'.se-chip.is-selected');
assert.ok(/background\s*:\s*var\(--brand-50\)/.test(chipSelected),'selected chip must use soft tint');
assert.ok(!/background\s*:\s*var\(--brand\)/.test(chipSelected),'selected chip must not use solid brand fill');

const webSecondary=block(files.web,'.bottom-action.secondary');
assert.ok(/background\s*:\s*transparent/.test(webSecondary),'secondary action must stay flat');

console.log('PASS FreePass visual grammar — borderless actions/selections, soft selected surfaces, inputs own the boundaries');
