import assert from 'node:assert/strict';
import {
  QUOTE_CONTRACT_V2,
  buildIssuedQuote,
  sealQuoteSnapshot,
  stableStringify,
  quoteIdempotencyKey,
} from '../src/lib/quote/quote-v2.js';

const base = {
  vehicleModelId: 'vm_kia_niro',
  modelYearId: 'my_2026',
  trimId: 'trim_signature',
  powertrainId: 'pt_hev',
  selectedOptionIds: ['opt_b', 'opt_a', 'opt_a'],
  exteriorColorId: 'ext_white',
  interiorColorId: 'int_black',
  contractTerm: 60,
  mileageCondition: '20000km',
  deposit: 10,
  prepayment: 0,
  vehiclePriceSnapshot: { basePrice: 35020000, colorPrice: 100000 },
  optionPriceSnapshot: [
    { optionId: 'opt_a', price: 500000 },
    { optionId: 'opt_b', price: 700000 },
  ],
  totalVehiclePrice: 36320000,
  monthlyRental: 746000,
  pricingEngineVersion: 'welrix-v6.1',
  sourceRevision: 'freepass-data/release-123',
};

const shuffled = {
  ...base,
  vehiclePriceSnapshot: { colorPrice: 100000, basePrice: 35020000 },
  selectedOptionIds: ['opt_a', 'opt_b'],
};

const a = await sealQuoteSnapshot(base);
const b = await sealQuoteSnapshot(shuffled);
assert.equal(a.snapshotHash, b.snapshotHash, 'key order and duplicate option IDs must not change hash');
assert.equal(stableStringify(a.vehiclePriceSnapshot), stableStringify(b.vehiclePriceSnapshot));

const q1 = await buildIssuedQuote(base, { createdAt: '2026-09-25T07:30:00.000Z' });
const q2 = await buildIssuedQuote(shuffled, { createdAt: '2026-09-25T08:30:00.000Z' });
assert.equal(q1.contract, QUOTE_CONTRACT_V2);
assert.equal(q1.quoteId, q2.quoteId, 'same content must derive same default quote identity');
assert.equal(q1.snapshotHash, q2.snapshotHash);
assert.notEqual(q1.createdAt, q2.createdAt, 'issuance metadata must not contaminate content hash');
assert.equal(quoteIdempotencyKey(q1), quoteIdempotencyKey(q2));

const changed = await buildIssuedQuote({ ...base, monthlyRental: 747000 }, { createdAt: '2026-09-25T07:30:00.000Z' });
assert.notEqual(q1.snapshotHash, changed.snapshotHash);
assert.notEqual(q1.quoteId, changed.quoteId);

await assert.rejects(
  () => buildIssuedQuote({ ...base, monthlyRental: Number.NaN }, { createdAt: '2026-09-25T07:30:00.000Z' }),
  /monthlyRental must be finite/
);

console.log('PASS Quote v2 deterministic snapshot/hash/idempotency contract');
