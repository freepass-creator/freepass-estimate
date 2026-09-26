import assert from 'node:assert/strict';
import {
  assertQuotePersistenceCommand,
  assertQuotePersistenceReceipt,
  forwardIssuedQuoteCommand,
  resolveQuotePersistenceConfig,
} from '../api/issued-quotes.js';
import {
  QUOTE_REPOSITORY_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/quote-repository.js';

const token = 'x'.repeat(40);
const quote = Object.freeze({
  contract: 'freepass-quote/v2',
  quoteId: 'q_test',
  quoteVersion: 1,
  snapshotHash: 'a'.repeat(64),
});
const key = `${quote.quoteId}:v${quote.quoteVersion}:${quote.snapshotHash}`;
const command = {
  command: 'PUT_ISSUED_QUOTE',
  contract: QUOTE_REPOSITORY_CONTRACT,
  idempotencyKey: key,
  quote,
};
const receipt = {
  contract: QUOTE_WRITE_RECEIPT_CONTRACT,
  status: 'CREATED',
  quoteId: quote.quoteId,
  quoteVersion: quote.quoteVersion,
  snapshotHash: quote.snapshotHash,
  idempotencyKey: key,
};

assert.throws(
  () => resolveQuotePersistenceConfig({ NODE_ENV: 'production' }),
  /not configured/
);
assert.throws(
  () => resolveQuotePersistenceConfig({
    NODE_ENV: 'production',
    FREEPASS_DATA_QUOTE_COMMAND_URL: 'http://data.example.test/quote-command',
    FREEPASS_DATA_ESTIMATE_TOKEN: token,
  }),
  /HTTPS/
);

const cfg = resolveQuotePersistenceConfig({
  NODE_ENV: 'production',
  FREEPASS_DATA_CONSUMER_BASE_URL: 'https://data.example.test/',
  FREEPASS_DATA_ESTIMATE_TOKEN: token,
});
assert.equal(
  cfg.url,
  'https://data.example.test/v1/commands/freepass-estimate/issued-quotes'
);
assert.equal(cfg.token, token);

assert.equal(
  assertQuotePersistenceCommand(command, key).idempotencyKey,
  key
);
assert.throws(
  () => assertQuotePersistenceCommand({ ...command, idempotencyKey: 'wrong' }, key),
  /idempotency key mismatch/
);
assert.throws(
  () => assertQuotePersistenceCommand(command, 'wrong'),
  /header mismatch/
);
assert.throws(
  () => assertQuotePersistenceCommand({ ...command, contract: 'wrong/v1' }, key),
  /contract mismatch/
);

assert.equal(
  assertQuotePersistenceReceipt(receipt, { quote, idempotencyKey: key }).status,
  'CREATED'
);
assert.throws(
  () => assertQuotePersistenceReceipt(
    { ...receipt, snapshotHash: 'b'.repeat(64) },
    { quote, idempotencyKey: key }
  ),
  /does not match/
);

let captured = null;
const forwarded = await forwardIssuedQuoteCommand({
  body: command,
  requestIdempotencyKey: key,
  env: {
    NODE_ENV: 'production',
    FREEPASS_DATA_QUOTE_COMMAND_URL: 'https://data.example.test/v1/quote-command',
    FREEPASS_DATA_ESTIMATE_TOKEN: token,
  },
  fetchImpl: async (url, init) => {
    captured = { url, init };
    return {
      ok: true,
      status: 200,
      json: async () => receipt,
    };
  },
});

assert.equal(forwarded.quoteId, quote.quoteId);
assert.equal(captured.url, 'https://data.example.test/v1/quote-command');
assert.equal(captured.init.method, 'POST');
assert.equal(captured.init.headers.authorization, `Bearer ${token}`);
assert.equal(captured.init.headers['idempotency-key'], key);
assert.ok(!JSON.stringify(forwarded).includes(token), 'service token must never leak in receipt');

const upstreamBody = JSON.parse(captured.init.body);
assert.equal(upstreamBody.contract, QUOTE_REPOSITORY_CONTRACT);
assert.equal(upstreamBody.idempotencyKey, key);
assert.equal(upstreamBody.quote.quoteId, quote.quoteId);

await assert.rejects(
  () => forwardIssuedQuoteCommand({
    body: command,
    requestIdempotencyKey: key,
    env: {
      NODE_ENV: 'production',
      FREEPASS_DATA_QUOTE_COMMAND_URL: 'https://data.example.test/v1/quote-command',
      FREEPASS_DATA_ESTIMATE_TOKEN: token,
    },
    fetchImpl: async () => ({
      ok: false,
      status: 409,
      json: async () => ({ code: 'QUOTE_REPOSITORY_CONFLICT', error: 'conflict' }),
    }),
  }),
  (error) => error?.code === 'QUOTE_REPOSITORY_CONFLICT' && error?.status === 409
);

console.log('PASS Quote persistence gateway: server-only token + idempotent receipt boundary');
