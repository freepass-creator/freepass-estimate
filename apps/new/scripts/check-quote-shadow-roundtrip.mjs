import assert from 'node:assert/strict';
import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_REPOSITORY_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';
import { buildShareEnvelope } from '../src/lib/quote/share-envelope.js';
import {
  verifyQuoteShadowRoundTrip,
  verifyShareEnvelopeShadowRoundTrip,
} from '../src/lib/quote/shadow-roundtrip.js';
import { evaluateQuoteCutoverReadiness } from '../src/lib/quote/cutover-readiness.js';

const quote = {
  contract: 'freepass-quote/v2',
  quoteId: 'q_shadow_001',
  quoteVersion: 1,
  snapshotHash: 'd'.repeat(64),
};

let storedQuote = null;
const quoteRepository = {
  contract: QUOTE_REPOSITORY_CONTRACT,
  async put({ quote: value, idempotencyKey }) {
    storedQuote = value;
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
    if (!storedQuote || storedQuote.quoteId !== quoteId || storedQuote.quoteVersion !== quoteVersion) {
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
      snapshotHash: storedQuote.snapshotHash,
      quote: storedQuote,
    };
  },
};

const quoteTimes = [
  '2026-09-26T05:30:00.000Z',
  '2026-09-26T05:30:01.000Z',
];
const quoteProof = await verifyQuoteShadowRoundTrip({
  repository: quoteRepository,
  quote,
  now: () => quoteTimes.shift(),
});

assert.equal(quoteProof.quoteId, quote.quoteId);
assert.equal(quoteProof.writeProbe.verified, true);
assert.equal(quoteProof.readProbe.verified, true);
assert.equal(quoteProof.readProbe.receipt.quote.snapshotHash, quote.snapshotHash);

const envelope = await buildShareEnvelope({
  quoteRefs: [{
    quoteId: quote.quoteId,
    quoteVersion: quote.quoteVersion,
    snapshotHash: quote.snapshotHash,
  }],
  createdAt: '2026-09-26T05:31:00.000Z',
  expiresAt: '2026-10-03T05:31:00.000Z',
});

let storedEnvelope = null;
const envelopeRepository = {
  contract: SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  async put({ envelope: value, idempotencyKey }) {
    storedEnvelope = value;
    return {
      contract: SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
      status: 'CREATED',
      envelopeId: value.envelopeId,
      envelopeVersion: value.envelopeVersion,
      snapshotHash: value.snapshotHash,
      idempotencyKey,
    };
  },
  async get({ envelopeId, envelopeVersion }) {
    if (!storedEnvelope ||
        storedEnvelope.envelopeId !== envelopeId ||
        storedEnvelope.envelopeVersion !== envelopeVersion) {
      return {
        contract: SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
        status: 'NOT_FOUND',
        envelopeId,
        envelopeVersion,
      };
    }
    return {
      contract: SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
      status: 'FOUND',
      envelopeId,
      envelopeVersion,
      snapshotHash: storedEnvelope.snapshotHash,
      envelope: storedEnvelope,
    };
  },
};

const envelopeTimes = [
  '2026-09-26T05:32:00.000Z',
  '2026-09-26T05:32:01.000Z',
];
const envelopeProof = await verifyShareEnvelopeShadowRoundTrip({
  repository: envelopeRepository,
  envelope,
  now: () => envelopeTimes.shift(),
});

assert.equal(envelopeProof.envelopeId, envelope.envelopeId);
assert.equal(envelopeProof.writeProbe.verified, true);
assert.equal(envelopeProof.readProbe.verified, true);
assert.equal(envelopeProof.readProbe.receipt.envelope.snapshotHash, envelope.snapshotHash);

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
  quoteWriteProbe: quoteProof.writeProbe,
  quoteReadProbe: quoteProof.readProbe,
  envelopeWriteProbe: envelopeProof.writeProbe,
  envelopeReadProbe: envelopeProof.readProbe,
  canonicalViewerReady: true,
  legacyWriteBlockReady: true,
});
assert.equal(readiness.status, 'READY');
assert.equal(readiness.gates.envelopeReferencesVerifiedQuote, true);

let quoteLegacyCalled = false;
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
        quoteLegacyCalled = true;
        throw new Error('must not read after failed write');
      },
    },
    quote,
  }),
  (error) => error?.code === 'QUOTE_REPOSITORY_UNAVAILABLE'
);
assert.equal(quoteLegacyCalled, false);

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

let envelopeLegacyCalled = false;
await assert.rejects(
  () => verifyShareEnvelopeShadowRoundTrip({
    repository: {
      contract: SHARE_ENVELOPE_REPOSITORY_CONTRACT,
      async put() {
        throw Object.assign(new Error('canonical envelope write unavailable'), {
          code: 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE',
        });
      },
      async get() {
        envelopeLegacyCalled = true;
        throw new Error('must not read after failed write');
      },
    },
    envelope,
  }),
  (error) => error?.code === 'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE'
);
assert.equal(envelopeLegacyCalled, false);

await assert.rejects(
  () => verifyShareEnvelopeShadowRoundTrip({
    repository: {
      contract: SHARE_ENVELOPE_REPOSITORY_CONTRACT,
      async put({ envelope: value, idempotencyKey }) {
        return {
          contract: SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
          status: 'CREATED',
          envelopeId: value.envelopeId,
          envelopeVersion: value.envelopeVersion,
          snapshotHash: value.snapshotHash,
          idempotencyKey,
        };
      },
      async get({ envelopeId, envelopeVersion }) {
        return {
          contract: SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
          status: 'NOT_FOUND',
          envelopeId,
          envelopeVersion,
        };
      },
    },
    envelope,
  }),
  (error) => error?.code === 'SHARE_ENVELOPE_SHADOW_ROUNDTRIP_FAILED'
);

console.log('PASS canonical shadow round-trips: Quote + Share Envelope -> readiness v2 evidence');
