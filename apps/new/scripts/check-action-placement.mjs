import fs from 'node:fs';
import assert from 'node:assert/strict';

const mobile=fs.readFileSync('src/components/mobile/MobileApp.vue','utf8');
const index=fs.readFileSync('index.html','utf8');

function between(src,start,end,label){
  const a=src.indexOf(start);
  const b=src.indexOf(end,a+start.length);
  assert.ok(a>=0 && b>a, label+' region not found');
  return src.slice(a,b);
}

const mobileHeader=between(mobile,'<header class="m-header">','</header>','mobile header');
assert.ok(!/<button\b/i.test(mobileHeader),'mobile header must be display-only; CTA button found');
assert.ok(!/m-header__actions/.test(mobileHeader),'mobile header action container must not exist');

const desktopTop=between(index,'<div class="global-topbar">','<div class="desktop-action-bar"','desktop topbar');
assert.ok(!/<button\b/i.test(desktopTop),'desktop topbar must be display-only; CTA button found');

const desktopBottom=between(index,'<div class="desktop-action-bar"','<div class="wrap">','desktop bottom action bar');
for(const id of ['reset-btn','btn-copy-sign-link','btn-standard-price','btn-add-to-cart','btn-preview-quote','btn-open-cart']){
  assert.ok(desktopBottom.includes(`id="${id}"`), 'desktop bottom action missing: '+id);
}

const modalHead=between(index,'<div class="quote-modal__head">','<div class="quote-modal__body"','quote modal header');
assert.ok(!/<button\b/i.test(modalHead),'quote modal header must be display-only; CTA button found');

const modalFoot=between(index,'<div class="quote-modal__foot"','</div>','quote modal footer');
for(const id of ['btn-modal-close','btn-modal-copy-text','btn-modal-save-image','btn-modal-copy-image','btn-modal-print','btn-modal-send-link']){
  assert.ok(modalFoot.includes(`id="${id}"`), 'modal footer action missing: '+id);
}

console.log('PASS FreePass action placement — top is informational, bottom is actionable');
