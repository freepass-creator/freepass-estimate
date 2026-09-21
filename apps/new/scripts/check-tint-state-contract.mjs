import assert from 'node:assert/strict';
import { quoteState } from '../src/store.js';

assert.ok(
  quoteState.tint?.areas instanceof Set,
  'quoteState.tint.areas must be initialized as a Set before desktop and mobile components render',
);

const probe = '__tint_state_contract_probe__';
quoteState.tint.areas.add(probe);
assert.ok(quoteState.tint.areas.has(probe), 'tint area selection must support Set add/has');
quoteState.tint.areas.delete(probe);
assert.ok(!quoteState.tint.areas.has(probe), 'tint area selection must support Set delete');

console.log('PASS tint state contract — selection areas exist before first render');
