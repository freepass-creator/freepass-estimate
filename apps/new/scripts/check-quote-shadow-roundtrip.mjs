import assert from 'node:assert/strict';
import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_REPOSITORY_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import { verifyQuoteShadowRoundTrip } from '../src/lib/quote/shadow-roundtrip.js';
import { evaluateQuoteCutoverReadiness } from '../src/lib/quote/cutover-readiness.js';

const quote = {
  contract: 'freepass-quote/v2',
  quoteId: 'q_shadow_001',
  quoteVersion: 1,
  snapshotHash: 'd'.repeat(64),
};

let stored = null;
const repository = {
  contract: QUOTE_REPOSITORY_CONTRACT,
  async put({ quote: value, idempotencyKey }) {
    stored = value;
    return {
      contract: QUOTE_WRITE_RECEIPT_CONTRACT,
      status: 'CREATED',
      quoteId: value.quoteId,
      quoteVersion: value.quoteVersion,
      snapshotHash: value.snapshotHash,
      idempotencyKey,
    };
  },
  async get({ quoteId, quoteVersion }) {
    if (!stored || stored.quoteId !== quoteId || stored.quoteVersion !== quoteVersion) {
      return {
        contract: QUOTE_READ_RECEIPT_CONTRACT,
        status: 'NOT_FOUND',
        quoteId,
        quoteVersion,
      };
    }
    return {
      contract: QUOTE_READ_RECEIPT_CONTRACT,
      status: 'FOUND',
      quoteId,
      quoteVersion,
      snapshotHash: stored.snapshotHash,
      quote: stored,
    };
  },
};

const times = [
  '2026-09-26T05:30:00.000Z',
  '2026-09-26T05:30:01.000Z',
];
const proof = await verifyQuoteShadowRoundTrip({
  repository,
  quote,
  now: () => times.shift(),
});

assert.equal(proof.quoteId, quote.quoteId);
assert.equal(proof.writeProbe.verified, true);
assert.equal(proof.readProbe.verified, true);
assert.equal(proof.readProbe.receipt.quote.snapshotHash, quote.snapshotHash);

const master = {
  meta: {
    contract: 'estimate-newcar-master/v1',
    projectionId: 'estimate-newcar-master',
    schemaVersion: '1.0.0',
    authority: 'CANONICAL_ACTIVE',
    releaseId: 'rel_shadow_001',
    manifestId: 'manifest_shadow_001',
    revision: 1,
    inputDigest: 'a'.repeat(64),
    dataDigest: 'b'.repeat(64),
    activatedAt: '2026-09-26T05:29:00.000Z',
  },
};

const readiness = evaluateQuoteCutoverReadiness({
  master,
  writeProbe: proof.writeProbe,
  readProbe: proof.readProbe,
  canonicalViewerReady: true,
  legacyWriteBlockReady: true,
});
assert.equal(readiness.status, 'READY');

let legacyCalled = false;
await assert.rejects(
  () => verifyQuoteShadowRoundTrip({
    repository: {
      contract: QUOTE_REPOSITORY_CONTRACT,
      async put() {
        throw Object.assign(new Error('canonical write unavailable'), {
          code: 'QUOTE_REPOSITORY_UNAVAILABLE',
        });
      },
      async get() {
        legacyCalled = true;
        throw new Error('must not read after failed write');
      },
    },
    quote,
  }),
  (error) => error?.code === 'QUOTE_REPOSITORY_UNAVAILABLE'
);
assert.equal(legacyCalled, false);

await assert.rejects(
  () => verifyQuoteShadowRoundTrip({
    repository: {
      contract: QUOTE_REPOSITORY_CONTRACT,
      async put({ quote: value, idempotencyKey }) {
        return {
          contract: QUOTE_WRITE_RECEIPT_CONTRACT,
          status: 'CREATED',
          quoteId: value.quoteId,
          quoteVersion: value.quoteVersion,
          snapshotHash: value.snapshotHash,
          idempotencyKey,
        };
      },
      async get({ quoteId, quoteVersion }) {
        return {
          contract: QUOTE_READ_RECEIPT_CONTRACT,
          status: 'NOT_FOUND',
          quoteId,
          quoteVersion,
        };
      },
    },
    quote,
  }),
  (error) => error?.code === 'QUOTE_SHADOW_ROUNDTRIP_FAILED'
);

console.log('PASS Quote shadow round-trip: canonical write -> canonical read -> readiness evidence');
