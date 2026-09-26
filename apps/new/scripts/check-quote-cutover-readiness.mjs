import assert from 'node:assert/strict';
import {
  QUOTE_CUTOVER_READINESS_CONTRACT,
  evaluateQuoteCutoverReadiness,
} from '../src/lib/quote/cutover-readiness.js';
import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';

const secureWriteAccessPolicy = {
  contract: 'freepass-estimate-write-access/v1',
  serverVerifiedFirebaseIdTokenRequired: true,
  anonymousWritesAllowed: false,
  requiredRoles: ['staff', 'admin'],
};
const weakWriteAccessPolicy = {
  contract: 'freepass-estimate-write-access/v1',
  serverVerifiedFirebaseIdTokenRequired: true,
  anonymousWritesAllowed: true,
  requiredRoles: [],
};

const blockedPolicy = {
  contract: 'freepass-legacy-quote-write-policy/v1',
  mode: 'CANONICAL_ONLY',
  legacyNewQuoteWriteBlocked: true,
};
const allowedPolicy = {
  contract: 'freepass-legacy-quote-write-policy/v1',
  mode: 'LEGACY_ALLOWED',
  legacyNewQuoteWriteBlocked: false,
};

const master = {
  meta: {
    contract: 'estimate-newcar-master/v1',
    projectionId: 'estimate-newcar-master',
    schemaVersion: '1.0.0',
    authority: 'CANONICAL_ACTIVE',
    releaseId: 'rel_ready_001',
    manifestId: 'manifest_ready_001',
    revision: 9,
    inputDigest: 'a'.repeat(64),
    dataDigest: 'b'.repeat(64),
    activatedAt: '2026-09-26T05:20:00.000Z',
  },
};

const quote = {
  contract: 'freepass-quote/v2',
  quoteId: 'q_probe_001',
  quoteVersion: 1,
  snapshotHash: 'c'.repeat(64),
};

const quoteWriteProbe = {
  verified: true,
  verifiedAt: '2026-09-26T05:21:00.000Z',
  receipt: {
    contract: QUOTE_WRITE_RECEIPT_CONTRACT,
    status: 'CREATED',
    quoteId: quote.quoteId,
    quoteVersion: quote.quoteVersion,
    snapshotHash: quote.snapshotHash,
    idempotencyKey: `${quote.quoteId}:v1:${quote.snapshotHash}`,
  },
};

const quoteReadProbe = {
  verified: true,
  verifiedAt: '2026-09-26T05:22:00.000Z',
  receipt: {
    contract: QUOTE_READ_RECEIPT_CONTRACT,
    status: 'FOUND',
    quoteId: quote.quoteId,
    quoteVersion: quote.quoteVersion,
    snapshotHash: quote.snapshotHash,
    quote,
  },
};

const envelope = {
  contract: 'freepass-share-envelope/v1',
  envelopeId: 'se_probe_001',
  envelopeVersion: 1,
  createdAt: '2026-09-26T05:23:00.000Z',
  expiresAt: '2026-10-03T05:23:00.000Z',
  quoteRefs: [
    {
      quoteId: quote.quoteId,
      quoteVersion: quote.quoteVersion,
      snapshotHash: quote.snapshotHash,
    },
  ],
  snapshotHash: 'd'.repeat(64),
};

const envelopeWriteProbe = {
  verified: true,
  verifiedAt: '2026-09-26T05:24:00.000Z',
  receipt: {
    contract: SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
    status: 'CREATED',
    envelopeId: envelope.envelopeId,
    envelopeVersion: envelope.envelopeVersion,
    snapshotHash: envelope.snapshotHash,
    idempotencyKey: `${envelope.envelopeId}:v1:${envelope.snapshotHash}`,
  },
};

const envelopeReadProbe = {
  verified: true,
  verifiedAt: '2026-09-26T05:25:00.000Z',
  receipt: {
    contract: SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
    status: 'FOUND',
    envelopeId: envelope.envelopeId,
    envelopeVersion: envelope.envelopeVersion,
    snapshotHash: envelope.snapshotHash,
    envelope,
  },
};

const empty = evaluateQuoteCutoverReadiness();
assert.equal(empty.contract, QUOTE_CUTOVER_READINESS_CONTRACT);
assert.equal(empty.status, 'HOLD');
assert.deepEqual(
  empty.blockers.map((x) => x.code),
  [
    'MASTER_ACTIVE_RELEASE_REQUIRED',
    'QUOTE_WRITE_SHADOW_PROOF_REQUIRED',
    'QUOTE_READ_SHADOW_PROOF_REQUIRED',
    'SHARE_ENVELOPE_WRITE_SHADOW_PROOF_REQUIRED',
    'SHARE_ENVELOPE_READ_SHADOW_PROOF_REQUIRED',
    'CANONICAL_VIEWER_CUTOVER_NOT_READY',
    'LEGACY_WRITE_BLOCK_NOT_READY',
    'CANONICAL_WRITE_AUTH_POLICY_NOT_READY',
  ]
);

const partial = evaluateQuoteCutoverReadiness({
  master,
  quoteWriteProbe,
  quoteReadProbe,
  envelopeWriteProbe,
  envelopeReadProbe,
  writeAccessPolicy: secureWriteAccessPolicy,
});
assert.equal(partial.status, 'HOLD');
assert.equal(partial.gates.masterActiveRelease, true);
assert.equal(partial.gates.quoteShadowRoundTripMatched, true);
assert.equal(partial.gates.envelopeShadowRoundTripMatched, true);
assert.equal(partial.gates.envelopeReferencesVerifiedQuote, true);
assert.deepEqual(
  partial.blockers.map((x) => x.code),
  ['CANONICAL_VIEWER_CUTOVER_NOT_READY', 'LEGACY_WRITE_BLOCK_NOT_READY']
);

const quoteMismatch = evaluateQuoteCutoverReadiness({
  master,
  quoteWriteProbe,
  quoteReadProbe: {
    ...quoteReadProbe,
    receipt: {
      ...quoteReadProbe.receipt,
      quoteId: 'q_other',
      quote: { ...quote, quoteId: 'q_other' },
    },
  },
  envelopeWriteProbe,
  envelopeReadProbe,
  canonicalViewerReady: true,
  legacyWritePolicy: blockedPolicy,
  writeAccessPolicy: secureWriteAccessPolicy,
});
assert.equal(quoteMismatch.status, 'HOLD');
assert.ok(quoteMismatch.blockers.some((x) => x.code === 'QUOTE_SHADOW_ROUNDTRIP_MISMATCH'));

const envelopeMismatch = evaluateQuoteCutoverReadiness({
  master,
  quoteWriteProbe,
  quoteReadProbe,
  envelopeWriteProbe,
  envelopeReadProbe: {
    ...envelopeReadProbe,
    receipt: {
      ...envelopeReadProbe.receipt,
      envelopeId: 'se_other',
      envelope: { ...envelope, envelopeId: 'se_other' },
    },
  },
  canonicalViewerReady: true,
  legacyWritePolicy: blockedPolicy,
  writeAccessPolicy: secureWriteAccessPolicy,
});
assert.equal(envelopeMismatch.status, 'HOLD');
assert.ok(envelopeMismatch.blockers.some((x) => x.code === 'SHARE_ENVELOPE_SHADOW_ROUNDTRIP_MISMATCH'));

const refMismatch = evaluateQuoteCutoverReadiness({
  master,
  quoteWriteProbe,
  quoteReadProbe,
  envelopeWriteProbe,
  envelopeReadProbe: {
    ...envelopeReadProbe,
    receipt: {
      ...envelopeReadProbe.receipt,
      envelope: {
        ...envelope,
        quoteRefs: [
          { quoteId: 'q_other', quoteVersion: 1, snapshotHash: 'e'.repeat(64) },
        ],
      },
    },
  },
  canonicalViewerReady: true,
  legacyWritePolicy: blockedPolicy,
  writeAccessPolicy: secureWriteAccessPolicy,
});
assert.equal(refMismatch.status, 'HOLD');
assert.ok(refMismatch.blockers.some((x) => x.code === 'SHARE_ENVELOPE_QUOTE_REFERENCE_MISMATCH'));

const ready = evaluateQuoteCutoverReadiness({
  master,
  quoteWriteProbe,
  quoteReadProbe,
  envelopeWriteProbe,
  envelopeReadProbe,
  canonicalViewerReady: true,
  legacyWritePolicy: blockedPolicy,
  writeAccessPolicy: secureWriteAccessPolicy,
});
assert.equal(ready.status, 'READY');
assert.equal(ready.blockers.length, 0);
assert.ok(Object.values(ready.gates).every(Boolean));

const badMaster = evaluateQuoteCutoverReadiness({
  master: { meta: { ...master.meta, authority: 'STATIC' } },
  quoteWriteProbe,
  quoteReadProbe,
  envelopeWriteProbe,
  envelopeReadProbe,
  canonicalViewerReady: true,
  legacyWritePolicy: blockedPolicy,
  writeAccessPolicy: secureWriteAccessPolicy,
});
assert.equal(badMaster.status, 'HOLD');
assert.ok(badMaster.blockers.some((x) => x.code === 'MASTER_ACTIVE_RELEASE_REQUIRED'));

console.log('PASS cutover readiness v4: master + Quote round-trip + Envelope round-trip + viewer/write-block gates');

const wrongPolicy = evaluateQuoteCutoverReadiness({
  master,
  quoteWriteProbe,
  quoteReadProbe,
  envelopeWriteProbe,
  envelopeReadProbe,
  canonicalViewerReady: true,
  legacyWritePolicy: allowedPolicy,
  writeAccessPolicy: secureWriteAccessPolicy,
});
assert.equal(wrongPolicy.status, 'HOLD');
assert.ok(wrongPolicy.blockers.some((x) => x.code === 'LEGACY_WRITE_BLOCK_NOT_READY'));

const weakAuth = evaluateQuoteCutoverReadiness({
  master,
  quoteWriteProbe,
  quoteReadProbe,
  envelopeWriteProbe,
  envelopeReadProbe,
  canonicalViewerReady: true,
  legacyWritePolicy: blockedPolicy,
  writeAccessPolicy: weakWriteAccessPolicy,
});
assert.equal(weakAuth.status, 'HOLD');
assert.ok(weakAuth.blockers.some((x) => x.code === 'CANONICAL_WRITE_AUTH_POLICY_NOT_READY'));
