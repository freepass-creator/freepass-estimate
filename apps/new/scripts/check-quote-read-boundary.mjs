import assert from 'node:assert/strict';
import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_REPOSITORY_CONTRACT,
  readIssuedQuote,
} from '../src/lib/quote/quote-repository.js';
import { createFreePassDataQuoteRepository } from '../src/lib/quote/repositories/freepass-data.js';
import {
  assertQuoteReadReceipt,
  fetchIssuedQuoteReceipt,
  resolveQuoteReadConfig,
} from '../api/issued-quote.js';

const token = 'x'.repeat(40);
const quote = {
  contract: 'freepass-quote/v2',
  quoteId: 'q_read_test',
  quoteVersion: 3,
  snapshotHash: 'f'.repeat(64),
};

const receipt = {
  contract: QUOTE_READ_RECEIPT_CONTRACT,
  status: 'FOUND',
  quoteId: quote.quoteId,
  quoteVersion: quote.quoteVersion,
  snapshotHash: quote.snapshotHash,
  quote,
};

assert.throws(
  () => resolveQuoteReadConfig({ NODE_ENV: 'production' }),
  /not configured/
);
assert.throws(
  () => resolveQuoteReadConfig({
    NODE_ENV: 'production',
    FREEPASS_DATA_QUOTE_READ_BASE_URL: 'http://data.example.test/quotes',
    FREEPASS_DATA_ESTIMATE_TOKEN: token,
  }),
  /HTTPS/
);

const cfg = resolveQuoteReadConfig({
  NODE_ENV: 'production',
  FREEPASS_DATA_CONSUMER_BASE_URL: 'https://data.example.test/',
  FREEPASS_DATA_ESTIMATE_TOKEN: token,
});
assert.equal(
  cfg.url,
  'https://data.example.test/v1/consumers/freepass-estimate/issued-quotes'
);

assert.equal(
  assertQuoteReadReceipt(receipt, { quoteId: quote.quoteId, quoteVersion: 3 }).quote.quoteId,
  quote.quoteId
);
assert.throws(
  () => assertQuoteReadReceipt({ ...receipt, snapshotHash: 'e'.repeat(64) }, { quoteId: quote.quoteId }),
  /payload mismatch/
);

let captured = null;
const found = await fetchIssuedQuoteReceipt({
  quoteId: quote.quoteId,
  quoteVersion: 3,
  env: {
    NODE_ENV: 'production',
    FREEPASS_DATA_QUOTE_READ_BASE_URL: 'https://data.example.test/issued-quotes',
    FREEPASS_DATA_ESTIMATE_TOKEN: token,
  },
  fetchImpl: async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 200, json: async () => receipt };
  },
});
assert.equal(found.status, 'FOUND');
assert.equal(captured.init.headers.authorization, `Bearer ${token}`);
assert.ok(captured.url.includes('/issued-quotes/q_read_test'));
assert.ok(captured.url.includes('quoteVersion=3'));

const missing = await fetchIssuedQuoteReceipt({
  quoteId: 'q_missing',
  env: {
    NODE_ENV: 'production',
    FREEPASS_DATA_QUOTE_READ_BASE_URL: 'https://data.example.test/issued-quotes',
    FREEPASS_DATA_ESTIMATE_TOKEN: token,
  },
  fetchImpl: async () => ({
    ok: false,
    status: 404,
    json: async () => ({ code: 'NOT_FOUND' }),
  }),
});
assert.equal(missing.status, 'NOT_FOUND');
assert.equal(missing.quoteId, 'q_missing');

const repo = {
  contract: QUOTE_REPOSITORY_CONTRACT,
  async get() { return receipt; },
};
const loaded = await readIssuedQuote(repo, { quoteId: quote.quoteId, quoteVersion: 3 });
assert.equal(loaded.snapshotHash, quote.snapshotHash);

const notFound = await readIssuedQuote({
  contract: QUOTE_REPOSITORY_CONTRACT,
  async get({ quoteId, quoteVersion }) {
    return {
      contract: QUOTE_READ_RECEIPT_CONTRACT,
      status: 'NOT_FOUND',
      quoteId,
      quoteVersion,
    };
  },
}, { quoteId: 'q_missing' });
assert.equal(notFound, null);

let readUrl = null;
const browserRepo = createFreePassDataQuoteRepository({
  endpoint: '/api/issued-quotes',
  readEndpoint: '/api/issued-quote',
  fetchImpl: async (url) => {
    readUrl = String(url);
    return { ok: true, status: 200, json: async () => receipt };
  },
});
const viaAdapter = await readIssuedQuote(browserRepo, { quoteId: quote.quoteId, quoteVersion: 3 });
assert.equal(viaAdapter.quoteVersion, 3);
assert.ok(readUrl.startsWith('/api/issued-quote?'));
assert.ok(readUrl.includes('quoteId=q_read_test'));
assert.ok(readUrl.includes('quoteVersion=3'));

await assert.rejects(
  () => readIssuedQuote({
    contract: QUOTE_REPOSITORY_CONTRACT,
    async get() {
      return { ...receipt, quoteId: 'q_other' };
    },
  }, { quoteId: quote.quoteId }),
  /does not match/
);

console.log('PASS Quote read boundary: canonical receipt + 404 normalization + no RTDB dependency');
