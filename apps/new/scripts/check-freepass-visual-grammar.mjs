import fs from 'node:fs';
import assert from 'node:assert/strict';

const files={
  vehicle:fs.readFileSync('src/components/mobile/StepVehicle.vue','utf8'),
  extras:fs.readFileSync('src/components/mobile/StepExtras.vue','utf8'),
  web:fs.readFileSync('index.html','utf8'),
  finalUi:fs.readFileSync('src/styles/admin-alignment.css','utf8'),
};

function block(src,selector){
  const css = src.includes('<template>') && src.includes('<style')
    ? src.slice(src.lastIndexOf('<style'))
    : src;
  const needle = selector + ' {';
  const i=css.indexOf(needle);
  assert.ok(i>=0,selector+' block missing');
  const a=css.indexOf('{',i);
  let depth=0;
  for(let p=a;p<css.length;p++){
    if(css[p]==='{') depth++;
    else if(css[p]==='}') { depth--; if(depth===0) return css.slice(a+1,p); }
  }
  throw new Error(selector+' block not closed');
}
function noVisibleBorder(src,selector){
  const b=block(src,selector);
  const borderless=/border\s*:\s*0\s*;/.test(b);
  const transparentGeometry=/border\s*:\s*1px\s+solid\s+transparent\s*;/.test(b);
  assert.ok(borderless || transparentGeometry,selector+' must not render a visible border');
}
for(const sel of ['.sv-brand-card','.sv-row','.sv-trim-card','.sv-opt','.sv-color-card']) noVisibleBorder(files.vehicle,sel);
for(const sel of ['.se-card','.se-chip','.se-tint-area']) noVisibleBorder(files.extras,sel);
for(const sel of ['.card','.trim-row','.color-card','.bottom-action','.quote-modal__foot button']) noVisibleBorder(files.web,sel);

const cardSelected=block(files.vehicle,'.sv-brand-card.is-selected');
assert.ok(/background\s*:\s*var\(--brand-50\)/.test(cardSelected),
  'selected entity cards must use a soft tint in the component layer');

assert.match(
  files.finalUi,
  /\.sc-chip\.is-selected, \.se-chip\.is-selected\)\s*\{[\s\S]*background:\s*var\(--fp-primary\) !important;[\s\S]*color:\s*#fff !important;/,
  'compact selected controls must resolve to solid FreePass primary with white text'
);

const webSecondary=block(files.web,'.bottom-action.secondary');
assert.ok(/background\s*:\s*var\(--fp-surface-soft\)/.test(webSecondary),
  'secondary actions must use the neutral soft surface');

console.log('PASS FreePass visual grammar — PR92 line-free geometry, typed selection semantics, neutral secondary actions');
