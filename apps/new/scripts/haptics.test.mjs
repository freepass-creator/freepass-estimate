import test from 'node:test';
import assert from 'node:assert/strict';
import { installMobileHaptics } from '../src/lib/haptics.js';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function setup() {
  const handlers = new Map();
  const root = { addEventListener(name, fn) { handlers.set(name, fn); } };
  const classes = new Set();
  const el = { disabled: false, dataset: {}, getAttribute: () => null,
    closest() { return this; }, matches: () => false,
    classList: { add: c => classes.add(c), remove: c => classes.delete(c) } };
  installMobileHaptics(root);
  const fire = (type, props = {}) => handlers.get(type)?.({type, target:el,
    pointerId:1, clientX:0, clientY:0, button:0, ...props});
  return {el, fire, pressed:()=>classes.has('fp-pressed')};
}
test('release outside original target clears pressed state', () => {
 const s=setup();s.fire('pointerdown');assert.ok(s.pressed());
 s.fire('pointerup',{target:{}});assert.equal(s.pressed(),false);
});
test('drag and scroll clear pressed state immediately', () => {
 const s=setup();s.fire('pointerdown');s.fire('pointermove',{clientY:25});assert.equal(s.pressed(),false);
 s.fire('pointerdown');s.fire('scroll');assert.equal(s.pressed(),false);
});
test('pointer cancel clears state and secondary pointer is ignored', () => {
 const s=setup();s.fire('pointerdown',{isPrimary:false});assert.equal(s.pressed(),false);
 s.fire('pointerdown');s.fire('pointercancel');assert.equal(s.pressed(),false);
});
test('previous release timer cannot clear a new press', async () => {
 const s=setup();s.fire('pointerdown');s.fire('pointerup');
 s.fire('pointerdown');await sleep(90);assert.ok(s.pressed());s.fire('pointercancel');
});
test('keyboard release clears original control after focus changes', async () => {
 const s=setup();s.fire('keydown',{key:' '});assert.ok(s.pressed());
 s.fire('keyup',{key:' ',target:{}});await sleep(90);assert.equal(s.pressed(),false);
});
test('disabled and opt-out controls do not show feedback', () => {
 const s=setup();s.el.disabled=true;s.fire('pointerdown');assert.equal(s.pressed(),false);
 s.el.disabled=false;s.el.dataset.haptic='off';s.fire('pointerdown');assert.equal(s.pressed(),false);
});

test('vibration happens only once on completed trusted activation', () => {
 const prior=Object.getOwnPropertyDescriptor(navigator,'vibrate');const calls=[];
 Object.defineProperty(navigator,'vibrate',{configurable:true,value:ms=>{calls.push(ms);return true;}});
 try {
  const s=setup();s.fire('pointerdown');assert.equal(calls.length,0);
  s.fire('pointercancel');assert.equal(calls.length,0);
  s.fire('click',{isTrusted:true,detail:1});assert.equal(calls.length,0);
  s.fire('pointerdown');s.fire('pointerup');
  s.fire('click',{isTrusted:true,detail:1});assert.equal(calls.length,1);
  s.fire('click',{isTrusted:false,detail:1});assert.equal(calls.length,1);
  s.el.disabled=true;s.fire('click',{isTrusted:true});assert.equal(calls.length,1);
 } finally { if(prior)Object.defineProperty(navigator,'vibrate',prior);else delete navigator.vibrate; }
});
