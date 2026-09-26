import assert from 'node:assert/strict';
import {
  LEGACY_QUOTE_WRITE_MODE,
  assertLegacyQuoteWriteAllowed,
  legacyQuoteWriteBlockEvidence,
  resolveLegacyQuoteWriteMode,
} from '../src/lib/quote/legacy-write-policy.js';

assert.equal(
  resolveLegacyQuoteWriteMode({ globalMode: '', viteMode: '' }),
  LEGACY_QUOTE_WRITE_MODE.LEGACY_ALLOWED
);
assert.equal(
  resolveLegacyQuoteWriteMode({ globalMode: 'canonical_only' }),
  LEGACY_QUOTE_WRITE_MODE.CANONICAL_ONLY
);
assert.throws(
  () => resolveLegacyQuoteWriteMode({ globalMode: 'dual-write' }),
  (error) => error?.code === 'LEGACY_QUOTE_WRITE_MODE_INVALID'
);

assert.equal(
  assertLegacyQuoteWriteAllowed({ globalMode: 'LEGACY_ALLOWED' }),
  LEGACY_QUOTE_WRITE_MODE.LEGACY_ALLOWED
);
assert.throws(
  () => assertLegacyQuoteWriteAllowed({ globalMode: 'CANONICAL_ONLY' }),
  (error) => error?.code === 'LEGACY_QUOTE_WRITE_BLOCKED'
);

assert.deepEqual(
  legacyQuoteWriteBlockEvidence({ globalMode: 'CANONICAL_ONLY' }),
  {
    contract: 'freepass-legacy-quote-write-policy/v1',
    mode: 'CANONICAL_ONLY',
    legacyNewQuoteWriteBlocked: true,
  }
);
assert.equal(
  legacyQuoteWriteBlockEvidence({ globalMode: 'LEGACY_ALLOWED' }).legacyNewQuoteWriteBlocked,
  false
);

console.log('PASS legacy Quote write policy: default compatible + explicit canonical-only block');
