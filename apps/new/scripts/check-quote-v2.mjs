import assert from 'node:assert/strict';
import {
  QUOTE_CONTRACT_V2,
  QUOTE_REVISION_CONTRACT_V1,
  buildIssuedQuote,
  sealQuoteSnapshot,
  stableStringify,
  quoteIdempotencyKey,
  reviseIssuedQuote,
  verifyIssuedQuoteIntegrity,
  verifyQuoteRevision,
} from '../src/lib/quote/quote-v2.js';

const engineVersion = 'freepass-standard/newcar@1.0.0+src.aaa.policy.bbb';

const base = {
  vehicleModelId: 'vm_kia_niro',
  modelYearId: 'my_2026',
  trimId: 'trim_signature',
  powertrainId: 'pt_hev',
  selectedOptionIds: ['opt_b', 'opt_a', 'opt_a'],
  exteriorColorId: 'ext_white',
  interiorColorId: 'int_black',
  contractTerm: 60,
  mileageCondition: '2만km',
  conditionSnapshot: {
    credit: '중신용',
    mileageCondition: '2만km',
    maintenance: '웰스 Basic',
    liability: '1억',
    extraDriver: '없음',
    feeRatePct: 5,
    costs: {
      policyId: 'freepass-estimate-condition-costs/2026-09-26',
      deliveryFee: 120000,
      tintFee: 105000,
      dashcamFee: 180000,
      naviFee: 0,
      hipassFee: 0,
    },
  },
  deposit: 3500000,
  prepayment: 0,
  depositRatePct: 10,
  prepaymentRatePct: 0,
  vehiclePriceSnapshot: { basePrice: 35020000, colorPrice: 100000 },
  optionPriceSnapshot: [
    { optionId: 'opt_a', price: 500000 },
    { optionId: 'opt_b', price: 700000 },
  ],
  totalVehiclePrice: 36320000,
  monthlyRental: 746000,
  pricingEngineVersion: engineVersion,
  calculationProvenance: {
    providerKey: 'standard',
    engineId: 'freepass-standard-newcar',
    engineVersion,
    evidence: 'LOCAL_SOURCE_POLICY_MANIFEST',
    verified: true,
    sourceDigest: 'a'.repeat(64),
    policyDigest: 'b'.repeat(64),
  },
  sourceRevision: 'freepass-data/release-123',
};

const shuffled = {
  ...base,
  vehiclePriceSnapshot: { colorPrice: 100000, basePrice: 35020000 },
  selectedOptionIds: ['opt_a', 'opt_b'],
  optionPriceSnapshot: [...base.optionPriceSnapshot].reverse(),
};

const a = await sealQuoteSnapshot(base);
const b = await sealQuoteSnapshot(shuffled);
assert.equal(a.snapshotHash, b.snapshotHash, 'key order and duplicate option IDs must not change hash');
assert.equal(stableStringify(a.vehiclePriceSnapshot), stableStringify(b.vehiclePriceSnapshot));
assert.equal(a.conditionSnapshot.costs.totalPrepFee, 405000);

const q1 = await buildIssuedQuote(base, { createdAt: '2026-09-25T07:30:00.000Z' });
const q2 = await buildIssuedQuote(shuffled, { createdAt: '2026-09-25T08:30:00.000Z' });
assert.equal(q1.contract, QUOTE_CONTRACT_V2);
assert.equal(q1.quoteVersion, 1);
assert.equal(q1.quoteId, q2.quoteId, 'same content must derive same default quote identity');
assert.equal(q1.snapshotHash, q2.snapshotHash);
assert.notEqual(q1.createdAt, q2.createdAt, 'issuance metadata must not contaminate content hash');
assert.equal(quoteIdempotencyKey(q1), quoteIdempotencyKey(q2));
await verifyIssuedQuoteIntegrity(q1);

for (const [name, changed] of [
  ['monthly rental', { monthlyRental: 747000 }],
  ['credit', { conditionSnapshot: { ...base.conditionSnapshot, credit: '저신용' } }],
  ['signed fee rate', { conditionSnapshot: { ...base.conditionSnapshot, feeRatePct: -1.5 } }],
  ['delivery cost', {
    conditionSnapshot: {
      ...base.conditionSnapshot,
      costs: { ...base.conditionSnapshot.costs, deliveryFee: 99000 },
    },
  }],
  ['condition cost policy', {
    conditionSnapshot: {
      ...base.conditionSnapshot,
      costs: { ...base.conditionSnapshot.costs, policyId: 'freepass-estimate-condition-costs/next' },
    },
  }],
  ['maintenance', { conditionSnapshot: { ...base.conditionSnapshot, maintenance: '웰스 Self' } }],
  ['liability', { conditionSnapshot: { ...base.conditionSnapshot, liability: '2억' } }],
  ['extra driver', { conditionSnapshot: { ...base.conditionSnapshot, extraDriver: '1명' } }],
  ['engine id', {
    calculationProvenance: { ...base.calculationProvenance, engineId: 'different-engine' },
  }],
  ['engine digest', {
    calculationProvenance: { ...base.calculationProvenance, sourceDigest: 'c'.repeat(64) },
  }],
]) {
  const quote = await buildIssuedQuote({ ...base, ...changed }, { createdAt: '2026-09-25T07:30:00.000Z' });
  assert.notEqual(q1.snapshotHash, quote.snapshotHash, `${name} must change snapshotHash`);
  assert.notEqual(q1.quoteId, quote.quoteId, `${name} must change default quoteId`);
}

await assert.rejects(
  () => buildIssuedQuote({
    ...base,
    conditionSnapshot: { ...base.conditionSnapshot, feeRatePct: 7.1 },
  }, { createdAt: '2026-09-25T07:30:00.000Z' }),
  /feeRatePct must be -10\.\.7/
);

await assert.rejects(
  () => buildIssuedQuote({
    ...base,
    calculationProvenance: { ...base.calculationProvenance, verified: false },
  }, { createdAt: '2026-09-25T07:30:00.000Z' }),
  /verified calculation provenance/
);

await assert.rejects(
  () => buildIssuedQuote(base, {
    createdAt: '2026-09-25T07:30:00.000Z',
    quoteId: q1.quoteId,
    quoteVersion: 2,
  }),
  (error) => error?.code === 'QUOTE_REVISION_EXPLICIT_API_REQUIRED'
);

const revised = await reviseIssuedQuote({
  previousQuote: q1,
  nextSnapshotInput: { ...base, monthlyRental: 747000 },
  createdAt: '2026-09-25T09:00:00.000Z',
});
assert.equal(revised.quoteId, q1.quoteId);
assert.equal(revised.quoteVersion, 2);
assert.equal(revised.revision.contract, QUOTE_REVISION_CONTRACT_V1);
assert.equal(revised.revision.previousQuoteVersion, 1);
assert.equal(revised.revision.previousSnapshotHash, q1.snapshotHash);
assert.notEqual(revised.snapshotHash, q1.snapshotHash);
assert.notEqual(quoteIdempotencyKey(revised), quoteIdempotencyKey(q1));
await verifyIssuedQuoteIntegrity(revised);
await verifyQuoteRevision(q1, revised);

const sameContentRevision = await reviseIssuedQuote({
  previousQuote: q1,
  nextSnapshotInput: base,
  createdAt: '2026-09-25T09:10:00.000Z',
});
assert.equal(sameContentRevision.snapshotHash, q1.snapshotHash, 'explicit business revision may retain content');
assert.equal(sameContentRevision.quoteVersion, 2);
await verifyQuoteRevision(q1, sameContentRevision);

const revision3 = await reviseIssuedQuote({
  previousQuote: revised,
  nextSnapshotInput: { ...base, monthlyRental: 748000 },
  createdAt: '2026-09-25T10:00:00.000Z',
});
assert.equal(revision3.quoteId, q1.quoteId);
assert.equal(revision3.quoteVersion, 3);
assert.equal(revision3.revision.previousQuoteVersion, 2);
assert.equal(revision3.revision.previousSnapshotHash, revised.snapshotHash);
assert.equal(revision3.revision.previousRevisionHash, revised.revisionHash);
await verifyQuoteRevision(revised, revision3);

await assert.rejects(
  () => verifyIssuedQuoteIntegrity({ ...revision3, revisionHash: '0'.repeat(64) }),
  /revisionHash/
);

await assert.rejects(
  () => verifyIssuedQuoteIntegrity({ ...q1, snapshotHash: '0'.repeat(64) }),
  /snapshotHash does not match content/
);

await assert.rejects(
  () => verifyQuoteRevision(q1, {
    ...revised,
    revision: { ...revised.revision, previousSnapshotHash: '0'.repeat(64) },
  }),
  /revision/
);

await assert.rejects(
  () => buildIssuedQuote({ ...base, monthlyRental: Number.NaN }, { createdAt: '2026-09-25T07:30:00.000Z' }),
  /monthlyRental must be finite/
);

await assert.rejects(
  () => buildIssuedQuote({
    ...base,
    vehiclePriceSnapshot: { ...base.vehiclePriceSnapshot, accidentalUndefined: undefined },
  }, { createdAt: '2026-09-25T07:30:00.000Z' }),
  /undefined cannot be hashed/
);

console.log('PASS Quote v2 calculation provenance + deterministic identity + revision lineage');
