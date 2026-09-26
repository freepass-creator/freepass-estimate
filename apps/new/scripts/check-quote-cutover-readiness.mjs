import assert from 'node:assert/strict';
import {
  QUOTE_CUTOVER_READINESS_CONTRACT,
  evaluateQuoteCutoverReadiness,
} from '../src/lib/quote/cutover-readiness.js';
import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/quote-repository.js';

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

const writeProbe = {
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

const readProbe = {
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

const empty = evaluateQuoteCutoverReadiness();
assert.equal(empty.contract, QUOTE_CUTOVER_READINESS_CONTRACT);
assert.equal(empty.status, 'HOLD');
assert.deepEqual(
  empty.blockers.map((x) => x.code),
  [
    'MASTER_ACTIVE_RELEASE_REQUIRED',
    'QUOTE_WRITE_SHADOW_PROOF_REQUIRED',
    'QUOTE_READ_SHADOW_PROOF_REQUIRED',
    'CANONICAL_VIEWER_CUTOVER_NOT_READY',
    'LEGACY_WRITE_BLOCK_NOT_READY',
  ]
);

const partial = evaluateQuoteCutoverReadiness({
  master,
  writeProbe,
  readProbe,
});
assert.equal(partial.status, 'HOLD');
assert.equal(partial.gates.masterActiveRelease, true);
assert.equal(partial.gates.writeShadowVerified, true);
assert.equal(partial.gates.readShadowVerified, true);
assert.equal(partial.gates.shadowRoundTripMatched, true);
assert.deepEqual(
  partial.blockers.map((x) => x.code),
  ['CANONICAL_VIEWER_CUTOVER_NOT_READY', 'LEGACY_WRITE_BLOCK_NOT_READY']
);

const mismatch = evaluateQuoteCutoverReadiness({
  master,
  writeProbe,
  readProbe: {
    ...readProbe,
    receipt: {
      ...readProbe.receipt,
      quoteId: 'q_other',
      quote: { ...quote, quoteId: 'q_other' },
    },
  },
  canonicalViewerReady: true,
  legacyWriteBlockReady: true,
});
assert.equal(mismatch.status, 'HOLD');
assert.ok(mismatch.blockers.some((x) => x.code === 'QUOTE_SHADOW_ROUNDTRIP_MISMATCH'));

const ready = evaluateQuoteCutoverReadiness({
  master,
  writeProbe,
  readProbe,
  canonicalViewerReady: true,
  legacyWriteBlockReady: true,
});
assert.equal(ready.status, 'READY');
assert.equal(ready.blockers.length, 0);
assert.ok(Object.values(ready.gates).every(Boolean));

const badMaster = evaluateQuoteCutoverReadiness({
  master: { meta: { ...master.meta, authority: 'STATIC' } },
  writeProbe,
  readProbe,
  canonicalViewerReady: true,
  legacyWriteBlockReady: true,
});
assert.equal(badMaster.status, 'HOLD');
assert.ok(badMaster.blockers.some((x) => x.code === 'MASTER_ACTIVE_RELEASE_REQUIRED'));

console.log('PASS Quote cutover readiness: ACTIVE master + round-trip shadow + viewer/write-block gates');
