import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function need(condition, message) {
  if (!condition) throw new Error(message);
}
function px(token) {
  const m = css.match(new RegExp('--' + token + ':\\s*(\\d+(?:\\.\\d+)?)px'));
  return m ? Number(m[1]) : null;
}

need(px('h-touch-min') === 44, '44px touch-target floor token missing');
need((px('h-input') ?? 0) >= 44, 'input height below 44px');
need((px('h-cta') ?? 0) >= 44, 'CTA height below 44px');
need(/:focus-visible\s*\{/.test(css), 'focus-visible rule missing');
need(/outline:\s*3px\s+solid\s+var\(--focus-ring\)/.test(css), 'focus ring missing');
need(/prefers-reduced-motion:\s*reduce/.test(css), 'reduced-motion rule missing');

console.log('accessibility baseline: PASS');
