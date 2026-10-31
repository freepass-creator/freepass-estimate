import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCustomerReference, readCustomerReference } from '../api/_private/customer-reference.js';
const env = { FREEPASS_CUSTOMER_REFERENCE_KEY: 'ab'.repeat(32) };
const quoteText = 'freepass 표준 견적 · 아반떼 · 60개월 · 보증금10% · 선납5% · 정비 제외';
test('1–5% commissions are privately recoverable and bound to the public conditions', () => {
  for (const feeRatePct of [1, 2, 3, 4, 5]) {
    const code = createCustomerReference({ feeRatePct, quoteText }, { env });
    const decoded = readCustomerReference(code, { env, quoteText });
    assert.equal(decoded.feeRatePct, feeRatePct);
    assert.throws(() => readCustomerReference(code, { env, quoteText: quoteText + ' changed' }));
    assert.throws(() => readCustomerReference(code, { env: { FREEPASS_CUSTOMER_REFERENCE_KEY: 'cd'.repeat(32) } }));
  }
});
test('the same commission produces unrelated codes; changing ciphertext is rejected', () => {
  const first = createCustomerReference({ feeRatePct: 3, quoteText }, { env });
  const second = createCustomerReference({ feeRatePct: 3, quoteText }, { env });
  assert.notEqual(first, second);
  const index = 20; const tampered = first.slice(0, index) + (first[index] === 'A' ? 'B' : 'A') + first.slice(index + 1);
  assert.throws(() => readCustomerReference(tampered, { env }));
});
test('missing private keys or invalid fee inputs cannot create customer codes', () => {
  assert.throws(() => createCustomerReference({ feeRatePct: 3, quoteText }, { env: {} }), { code: 'CUSTOMER_REFERENCE_UNAVAILABLE' });
  for (const feeRatePct of [NaN, 8, -11, 3.33, '3']) assert.throws(() => createCustomerReference({ feeRatePct, quoteText }, { env }));
  const code = createCustomerReference({ feeRatePct: 3.3, quoteText }, { env });
  assert.equal(readCustomerReference(code, { env }).feeRatePct, 3.3);
});
