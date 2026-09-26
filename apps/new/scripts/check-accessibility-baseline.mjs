import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function need(condition, message) {
  if (!condition) throw new Error(message);
}
function px(token) {
  const m = css.match(new RegExp('--' + token + ':\\s*(\\d+(?:\\.\\d+)?)px'));
  return m ? Number(m[1]) : null;
}

need(px('fp-mobile-touch') === 44, '44px mobile touch-target floor token missing');
need(px('fp-mobile-control') === 44, '44px mobile input/control token missing');
need(px('fp-mobile-action') === 44, '44px mobile action token missing');
need(/--h-touch-min:\s*var\(--fp-mobile-touch\);/.test(css),
  'legacy touch target alias must point to canonical mobile token');
need(/--h-input:\s*var\(--fp-mobile-control\);/.test(css),
  'legacy input alias must point to canonical mobile control token');
need(/--h-cta:\s*var\(--fp-mobile-action\);/.test(css),
  'legacy CTA alias must point to canonical mobile action token');

need(/:focus-visible\s*\{/.test(css), 'focus-visible rule missing');
need(/outline:\s*2px\s+solid\s+var\(--focus-ring\)/.test(css),
  'visible focus treatment missing');
need(/--fp-focus-halo:/.test(css), 'line-free focus halo token missing');
need(/prefers-reduced-motion:\s*reduce/.test(css), 'reduced-motion rule missing');

console.log('accessibility baseline: PASS — Admin PR92 mobile 44px floor + visible focus');
