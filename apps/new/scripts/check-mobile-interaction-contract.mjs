import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('mobile.html', 'utf8');
const app = fs.readFileSync('src/components/mobile/MobileApp.vue', 'utf8');
const mobile = fs.readFileSync('src/mobile.js', 'utf8');
const haptics = fs.readFileSync('src/lib/haptics.js', 'utf8');
const tokens = fs.readFileSync('src/styles/tokens.css', 'utf8');
const e2e = fs.readFileSync('scripts/e2e-mobile-ux.mjs', 'utf8');

assert.ok(html.includes('height: 100dvh'), 'mobile viewport must use 100dvh');
assert.ok(html.includes('overflow: hidden'), 'document must not compete with app scroll owner');
assert.ok(html.includes('touch-action: pan-y'), '#m-app pan-y contract missing');

assert.ok(app.includes('overflow-y: auto'), '.m-main must own vertical scrolling');
assert.ok(app.includes('-webkit-overflow-scrolling: touch'), 'iOS momentum scrolling missing');
assert.ok(app.includes('touch-action: pan-y'), '.m-main pan-y contract missing');
assert.ok(app.includes('min-height: 0'), 'flex scroll child min-height:0 missing');
assert.ok(app.includes("document.querySelector('.m-main')"), 'step changes must reset the actual scroll owner');

assert.ok(mobile.includes('installMobileHaptics(document)'), 'mobile haptics are not installed');
assert.ok(haptics.includes('navigator.vibrate'), 'Android vibration integration missing');
assert.ok(haptics.includes('selection: 12'), 'selection haptic strength drift');
assert.ok(haptics.includes('primary: 18'), 'primary CTA haptic strength drift');
assert.ok(haptics.includes("addEventListener('pointerdown'"), 'haptic must fire on pointerdown for immediate response');
assert.ok(haptics.includes("classList.add('fp-pressed')"), 'manual pressed-state feedback missing');
assert.ok(haptics.includes('72 - elapsed'), 'pressed state minimum hold drift');

assert.ok(tokens.includes(':active'), 'press feedback missing');
assert.ok(tokens.includes('scale(.975)'), 'press scale feedback drift');
assert.ok(tokens.includes('@keyframes fp-step-in'), 'step transition feedback missing');

assert.ok(e2e.includes("document.querySelector('.m-main')"), 'E2E still targets window scrolling');
assert.ok(e2e.includes('hapticCount > 0'), 'E2E does not prove haptic call');

console.log(JSON.stringify({
  status: 'PASS',
  scrollOwner: '.m-main',
  viewport: '100dvh',
  touchAction: 'pan-y',
  haptics: 'navigator.vibrate 7/12/18ms by action weight',
  pressScale: 0.975,
  stepMotionMs: 120,
}, null, 2));
