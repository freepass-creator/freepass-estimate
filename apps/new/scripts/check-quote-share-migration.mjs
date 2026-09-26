import assert from 'node:assert/strict';
import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_REPOSITORY_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import {
  buildCanonicalQuoteUrl,
  classifyQuoteLink,
  loadQuoteFromMigratingLink,
} from '../src/lib/quote/share-migration.js';
import { makeIssuedQuote } from './fixtures/issued-quote.mjs';

const quote = await makeIssuedQuote({
  contractTerm: 36,
  createdAt: '2026-09-26T02:00:00.000Z',
});

assert.deepEqual(
  classifyQuoteLink(`?quote=${quote.quoteId}&quoteVersion=${quote.quoteVersion}`),
  { kind: 'CANONICAL_V2', quoteId: quote.quoteId, quoteVersion: quote.quoteVersion }
);
assert.deepEqual(
  classifyQuoteLink('?q=abc123'),
  { kind: 'LEGACY', legacyId: 'abc123' }
);
assert.deepEqual(classifyQuoteLink(''), { kind: 'NONE' });
assert.throws(
  () => classifyQuoteLink('?quote=q_share_test&q=abc123'),
  (error) => error?.code === 'QUOTE_LINK_AMBIGUOUS'
);
assert.throws(
  () => classifyQuoteLink('?quote=q_share_test&quoteVersion=0'),
  (error) => error?.code === 'QUOTE_LINK_INVALID'
);

const built = buildCanonicalQuoteUrl({
  quoteId: quote.quoteId,
  quoteVersion: quote.quoteVersion,
  locationLike: { origin: 'https://estimate.example.test', pathname: '/mobile.html' },
});
assert.equal(
  built,
  `https://estimate.example.test/mobile.html?quote=${quote.quoteId}&quoteVersion=${quote.quoteVersion}`
);

let legacyCalls = 0;
const canonicalRepo = {
  contract: QUOTE_REPOSITORY_CONTRACT,
  async get({ quoteId, quoteVersion }) {
    return {
      contract: QUOTE_READ_RECEIPT_CONTRACT,
      status: 'FOUND',
      quoteId,
      quoteVersion,
      snapshotHash: quote.snapshotHash,
      quote,
    };
  },
};

const canonical = await loadQuoteFromMigratingLink({
  search: `?quote=${quote.quoteId}&quoteVersion=${quote.quoteVersion}`,
  repository: canonicalRepo,
  legacyLoader: async () => {
    legacyCalls += 1;
    return { legacy: true };
  },
});
assert.equal(canonical.kind, 'CANONICAL_V2');
assert.equal(canonical.quote.quoteId, quote.quoteId);
assert.equal(legacyCalls, 0, 'canonical links must never touch legacy reader');

const canonicalMissing = await loadQuoteFromMigratingLink({
  search: '?quote=q_missing',
  repository: {
    contract: QUOTE_REPOSITORY_CONTRACT,
    async get({ quoteId }) {
      return {
        contract: QUOTE_READ_RECEIPT_CONTRACT,
        status: 'NOT_FOUND',
        quoteId,
        quoteVersion: null,
      };
    },
  },
  legacyLoader: async () => {
    legacyCalls += 1;
    return { legacy: true };
  },
});
assert.equal(canonicalMissing.status, 'NOT_FOUND');
assert.equal(legacyCalls, 0, 'canonical NOT_FOUND must not fallback to legacy');

await assert.rejects(
  () => loadQuoteFromMigratingLink({
    search: '?quote=q_down',
    repository: {
      contract: QUOTE_REPOSITORY_CONTRACT,
      async get() {
        throw Object.assign(new Error('canonical read unavailable'), {
          code: 'QUOTE_REPOSITORY_UNAVAILABLE',
        });
      },
    },
    legacyLoader: async () => {
      legacyCalls += 1;
      return { legacy: true };
    },
  }),
  (error) => error?.code === 'QUOTE_REPOSITORY_UNAVAILABLE'
);
assert.equal(legacyCalls, 0, 'canonical errors must not fallback to legacy');

const legacy = await loadQuoteFromMigratingLink({
  search: '?q=abc123',
  repository: canonicalRepo,
  legacyLoader: async (id) => {
    legacyCalls += 1;
    return { quote_id: id, legacy: true };
  },
});
assert.equal(legacy.kind, 'LEGACY');
assert.equal(legacy.quote.quote_id, 'abc123');
assert.equal(legacyCalls, 1);

console.log('PASS share migration seam: explicit canonical/legacy routing with no cross-store fallback');
