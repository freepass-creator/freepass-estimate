import assert from 'node:assert/strict';
import {
  SHARE_ENVELOPE_CONTRACT,
  SHARE_ENVELOPE_SNAPSHOT_CONTRACT,
  assertShareEnvelope,
  buildShareEnvelope,
  buildShareEnvelopeSnapshot,
} from '../src/lib/quote/share-envelope.js';

const refs = [
  { quoteId: 'q_term_36', quoteVersion: 1, snapshotHash: 'a'.repeat(64) },
  { quoteId: 'q_term_60', quoteVersion: 1, snapshotHash: 'b'.repeat(64) },
];

const snapshot = buildShareEnvelopeSnapshot({
  quoteRefs: refs,
  expiresAt: '2026-10-03T06:00:00.000Z',
});
assert.equal(snapshot.contract, SHARE_ENVELOPE_SNAPSHOT_CONTRACT);
assert.equal(snapshot.quoteRefs.length, 2);

const first = await buildShareEnvelope({
  quoteRefs: refs,
  createdAt: '2026-09-26T06:00:00.000Z',
  expiresAt: '2026-10-03T06:00:00.000Z',
});
const second = await buildShareEnvelope({
  quoteRefs: refs,
  createdAt: '2026-09-26T06:10:00.000Z',
  expiresAt: '2026-10-03T06:00:00.000Z',
});
assert.equal(first.contract, SHARE_ENVELOPE_CONTRACT);
assert.equal(first.snapshotHash, second.snapshotHash, 'createdAt must not change envelope content identity');
assert.equal(first.envelopeId, second.envelopeId);
assert.equal(first.quoteRefs[0].quoteId, 'q_term_36');
assert.equal(assertShareEnvelope(first), first);

const reordered = await buildShareEnvelope({
  quoteRefs: [...refs].reverse(),
  createdAt: '2026-09-26T06:00:00.000Z',
  expiresAt: '2026-10-03T06:00:00.000Z',
});
assert.notEqual(
  first.snapshotHash,
  reordered.snapshotHash,
  'presentation order of Quote references is part of the Share Envelope'
);

const laterExpiry = await buildShareEnvelope({
  quoteRefs: refs,
  createdAt: '2026-09-26T06:00:00.000Z',
  expiresAt: '2026-10-04T06:00:00.000Z',
});
assert.notEqual(first.snapshotHash, laterExpiry.snapshotHash, 'expiry is sealed into envelope identity');

await assert.rejects(
  () => buildShareEnvelope({
    quoteRefs: [refs[0], { ...refs[0], quoteVersion: 2 }],
    createdAt: '2026-09-26T06:00:00.000Z',
    expiresAt: '2026-10-03T06:00:00.000Z',
  }),
  /duplicate quoteId/
);

await assert.rejects(
  () => buildShareEnvelope({
    quoteRefs: [{ ...refs[0], snapshotHash: 'not-a-hash' }],
    createdAt: '2026-09-26T06:00:00.000Z',
    expiresAt: '2026-10-03T06:00:00.000Z',
  }),
  /snapshotHash is invalid/
);

await assert.rejects(
  () => buildShareEnvelope({
    quoteRefs: refs,
    createdAt: '2026-09-26T06:00:00.000Z',
    expiresAt: '2026-09-26T05:59:59.000Z',
  }),
  /expiresAt must be after createdAt/
);

assert.equal('customer' in first, false, 'I-01 envelope must not invent customer presentation fields');
assert.equal('staff' in first, false, 'I-01 envelope must not invent staff presentation fields');
assert.equal('vehicle' in first, false, 'I-01 envelope must not duplicate vehicle master facts');

console.log('PASS Share Envelope v1: immutable Quote refs only, no duplicated master/UI authority');
