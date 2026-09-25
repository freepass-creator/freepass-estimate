import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const vehicle = readFileSync(new URL('../src/components/mobile/StepVehicle.vue', import.meta.url), 'utf8');
const conditions = readFileSync(new URL('../src/components/mobile/StepConditions.vue', import.meta.url), 'utf8');
const extras = readFileSync(new URL('../src/components/mobile/StepExtras.vue', import.meta.url), 'utf8');
const mobileApp = readFileSync(new URL('../src/components/mobile/MobileApp.vue', import.meta.url), 'utf8');

function need(condition, message) {
  if (!condition) throw new Error(message);
}
function px(token) {
  const m = css.match(new RegExp('--' + token + ':\\s*(\\d+(?:\\.\\d+)?)px'));
  return m ? Number(m[1]) : null;
}

need(px('h-touch-min') === 44, '44px touch-target floor token missing');
need((px('h-chip') ?? 0) >= 44, 'choice control height below 44px');
need((px('h-input') ?? 0) >= 44, 'input height below 44px');
need((px('h-cta') ?? 0) >= 44, 'CTA height below 44px');
need(/:focus-visible\s*\{/.test(css), 'focus-visible rule missing');
need(/outline:\s*3px\s+solid\s+var\(--focus-ring\)/.test(css), 'focus ring missing');
need(/prefers-reduced-motion:\s*reduce/.test(css), 'reduced-motion rule missing');

need((vehicle.match(/:aria-pressed=/g) || []).length >= 8, 'vehicle selected-state aria-pressed coverage regressed');
need((conditions.match(/:aria-pressed=/g) || []).length >= 3, 'condition selected-state aria-pressed coverage regressed');
need((extras.match(/:aria-pressed=/g) || []).length >= 5, 'extras selected-state aria-pressed coverage regressed');
need(/role="progressbar"/.test(mobileApp) && /:aria-valuenow=/.test(mobileApp), 'mobile progress semantics missing');
need(/aria-hidden="true"/.test(mobileApp), 'progress segment decoration must stay hidden from assistive tech');

console.log('accessibility baseline: PASS');
