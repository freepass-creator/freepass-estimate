import assert from 'node:assert/strict';
import { persistCalculatedQuotes } from '../src/lib/quote/persistence-runtime.js';
import {
  QUOTE_REPOSITORY_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import { quoteIdempotencyKey } from '../src/lib/quote/quote-v2.js';

const meta = {
  contract: 'estimate-newcar-master/v1',
  projectionId: 'estimate-newcar-master',
  schemaVersion: '1.0.0',
  authority: 'CANONICAL_ACTIVE',
  releaseId: 'rel_runtime_001',
  manifestId: 'manifest_runtime_001',
  revision: 7,
  inputDigest: 'a'.repeat(64),
  dataDigest: 'b'.repeat(64),
  generatedAt: '2026-09-26T03:00:00.000Z',
  activatedAt: '2026-09-26T03:01:00.000Z',
};

const record = {
  productId: 'prod_runtime',
  vehicleModelId: 'vm_runtime',
  modelYearId: 'my_2026',
  trimId: 'trim_runtime',
  powertrainId: 'pt_runtime',
  modelYear: 2026,
  status: 'ACTIVE',
  holdReasons: [],
  basePrice: { amount: 30000000, currency: 'KRW' },
  priceBefore: { amount: 31200000, currency: 'KRW' },
  priceAfter: { amount: 30700000, currency: 'KRW' },
  priceBasis: '세제혜택 후',
  options: [
    {
      optionId: 'opt_runtime',
      name: '옵션',
      price: { amount: 500000, currency: 'KRW' },
      requires: [],
      excludes: [],
    },
  ],
  exteriorColors: [
    { colorId: 'ext_runtime', name: '화이트', price: { amount: 100000, currency: 'KRW' } },
  ],
  interiorColors: [
    { colorId: 'int_runtime', name: '블랙', price: { amount: 100000, currency: 'KRW' } },
  ],
};

const master = {
  meta,
  byProductId: new Map([[record.productId, record]]),
};

const vehicle = {
  _product_id: 'prod_runtime',
  _selected_options: [{ id: 'legacy_opt_1', stableId: 'opt_runtime' }],
  colorExtId: 'ext_runtime',
  colorIntId: 'int_runtime',
};

const request = {
  차: {
    상품키: 'prod_runtime',
    가격: {
      트림: 30000000,
      옵션: 500000,
      외장색: 100000,
      내장색: 100000,
      할인: 0,
      표준계산차량가: 30700000,
      기준전: 31200000,
      기준후: 30700000,
      기준명: '세제혜택 후',
    },
    구성: {
      선택옵션: [{ id: 'legacy_opt_1', name: '옵션', price_won: 500000 }],
    },
  },
  조건: { 주행: '2만km' },
  안들: [
    { 기간: 36, 보증금: 10, 선납: 0 },
    { 기간: 60, 보증금: 20, 선납: 5 },
  ],
};

const engine = {
  id: 'freepass-standard-newcar',
  version: 'freepass-standard/newcar@1.0.0+src.' + 'c'.repeat(12) + '.policy.' + 'd'.repeat(12),
  evidence: 'LOCAL_SOURCE_POLICY_MANIFEST',
  verified: true,
  sourceDigest: 'c'.repeat(64),
  policyDigest: 'd'.repeat(64),
};

const calculation = {
  pricingEngine: engine,
  priceBasis: {
    contract: 'freepass-price-basis/v1',
    authority: 'FREEPASS_DATA_CANONICAL_ACTIVE',
    masterContract: 'estimate-newcar-master/v1',
    currency: 'KRW',
    productId: 'prod_runtime',
    sourceRevision: 'freepass-data/rel_runtime_001@r7',
    basePrice: 30000000,
    optionPrice: 500000,
    exteriorColorPrice: 100000,
    interiorColorPrice: 100000,
    discount: 0,
    totalVehiclePrice: 30700000,
    priceBefore: 31200000,
    priceAfter: 30700000,
    priceBasisName: '세제혜택 후',
  },
  결과: [
    { 월대여료: 700000, 보증금: 3070000, 선납금: 0, 총차량가: 30700000 },
    { 월대여료: 600000, 보증금: 6140000, 선납금: 1535000, 총차량가: 30700000 },
  ],
};

const writes = [];
const repository = {
  contract: QUOTE_REPOSITORY_CONTRACT,
  async put({ quote, idempotencyKey }) {
    writes.push({ quote, idempotencyKey });
    return {
      contract: QUOTE_WRITE_RECEIPT_CONTRACT,
      status: 'CREATED',
      quoteId: quote.quoteId,
      quoteVersion: quote.quoteVersion,
      snapshotHash: quote.snapshotHash,
      idempotencyKey,
    };
  },
};

const result = await persistCalculatedQuotes({
  request,
  calculation,
  vehicle,
  condition: { colorIntId: 'int_runtime' },
  master,
  repository,
  now: () => '2026-09-26T03:10:00.000Z',
});

assert.equal(result.quotes.length, 2);
assert.equal(result.receipts.length, 2);
assert.equal(writes.length, 2);
assert.equal(result.sourceRevision, 'freepass-data/rel_runtime_001@r7');
assert.equal(writes[0].idempotencyKey, quoteIdempotencyKey(result.quotes[0]));
assert.equal(result.receipts[1].quoteId, result.quotes[1].quoteId);

let repositoryCalled = false;
await assert.rejects(
  () => persistCalculatedQuotes({
    request,
    calculation,
    vehicle,
    condition: {},
    loadMaster: async () => {
      throw Object.assign(new Error('master unavailable'), { code: 'ESTIMATE_MASTER_UNAVAILABLE' });
    },
    createRepository: () => {
      repositoryCalled = true;
      return repository;
    },
  }),
  (error) => error?.code === 'ESTIMATE_MASTER_UNAVAILABLE'
);
assert.equal(repositoryCalled, false, 'repository must not be used when authoritative master is unavailable');

await assert.rejects(
  () => persistCalculatedQuotes({
    request,
    calculation,
    vehicle: { ...vehicle, _selected_options: [{ id: 'legacy_opt_1', stableId: null }] },
    condition: {},
    master,
    repository,
  }),
  /stableId/
);
assert.equal(writes.length, 2, 'identity failure must occur before any additional write');

const badReceiptRepository = {
  contract: QUOTE_REPOSITORY_CONTRACT,
  async put({ quote, idempotencyKey }) {
    return {
      contract: QUOTE_WRITE_RECEIPT_CONTRACT,
      status: 'CREATED',
      quoteId: quote.quoteId,
      quoteVersion: quote.quoteVersion,
      snapshotHash: 'e'.repeat(64),
      idempotencyKey,
    };
  },
};

await assert.rejects(
  () => persistCalculatedQuotes({
    request,
    calculation,
    vehicle,
    condition: {},
    master,
    repository: badReceiptRepository,
    now: () => '2026-09-26T03:10:00.000Z',
  }),
  /receipt does not match/
);

let legacyFallbackCalled = false;
await assert.rejects(
  () => persistCalculatedQuotes({
    request,
    calculation,
    vehicle,
    condition: {},
    master,
    repository: {
      contract: QUOTE_REPOSITORY_CONTRACT,
      async put() {
        throw Object.assign(new Error('canonical repository unavailable'), {
          code: 'QUOTE_REPOSITORY_UNAVAILABLE',
        });
      },
    },
    createRepository: () => {
      legacyFallbackCalled = true;
      throw new Error('must not fallback');
    },
  }),
  (error) => error?.code === 'QUOTE_REPOSITORY_UNAVAILABLE'
);
assert.equal(legacyFallbackCalled, false, 'runtime must never fallback to a second/legacy repository');

console.log('PASS Quote persistence runtime: authoritative master -> Quote v2 -> receipt, fail-closed');
