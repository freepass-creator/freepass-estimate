import assert from 'node:assert/strict';
import { issueQuotesFromCalculation } from '../src/lib/quote/from-calculation.js';
import {
  QUOTE_REPOSITORY_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
  persistIssuedQuote,
} from '../src/lib/quote/quote-repository.js';
import { createFreePassDataQuoteRepository } from '../src/lib/quote/repositories/freepass-data.js';
import { quoteIdempotencyKey } from '../src/lib/quote/quote-v2.js';

const request = {
  차: {
    가격: {
      트림: 35000000,
      옵션: 1200000,
      외장색: 100000,
      내장색: 300000,
      할인: 500000,
      표준계산차량가: 36100000,
      기준전: 36400000,
      기준후: 36100000,
      기준명: '세제혜택 후',
    },
    구성: {
      선택옵션: [
        { id: 'opt_b', name: 'B', price_won: 700000 },
        { id: 'opt_a', name: 'A', price_won: 500000 },
      ],
    },
  },
  조건: { 주행: '2만km' },
  안들: [
    { 기간: 36, 보증금: 10, 선납: 0 },
    { 기간: 60, 보증금: 20, 선납: 5 },
  ],
};
const calculation = {
  결과: [
    { 월대여료: 820000, 보증금: 3600000, 선납금: 0, 총차량가: 36100000 },
    { 월대여료: 690000, 보증금: 7200000, 선납금: 1805000, 총차량가: 36100000 },
  ],
};
const masterContext = {
  vehicleModelId: 'vm_niro',
  modelYearId: 'my_2026',
  trimId: 'trim_signature',
  powertrainId: 'pt_hev',
  exteriorColorId: 'ext_white',
  interiorColorId: 'int_black',
};

const common = {
  request,
  calculation,
  masterContext,
  pricingEngineVersion: 'welrix-v6.1',
  sourceRevision: 'freepass-data/release-123',
  createdAt: '2026-09-25T07:40:00.000Z',
};

const quotes = await issueQuotesFromCalculation(common);
assert.equal(quotes.length, 2);
assert.notEqual(quotes[0].quoteId, quotes[1].quoteId, 'different terms must create different quote identities');
assert.equal(quotes[0].deposit, 3600000);
assert.equal(quotes[0].depositRatePct, 10);
assert.equal(quotes[1].prepayment, 1805000);
assert.equal(quotes[1].prepaymentRatePct, 5);
assert.deepEqual(quotes[0].selectedOptionIds, ['opt_a', 'opt_b']);
assert.equal(quotes[0].vehiclePriceSnapshot.interiorColorPrice, 300000);

const again = await issueQuotesFromCalculation({
  ...common,
  request: {
    ...request,
    차: {
      ...request.차,
      구성: { 선택옵션: [...request.차.구성.선택옵션].reverse() },
    },
  },
});
assert.equal(quotes[0].snapshotHash, again[0].snapshotHash, 'option selection order must not change content identity');

const revised = await issueQuotesFromCalculation({ ...common, sourceRevision: 'freepass-data/release-124' });
assert.notEqual(quotes[0].snapshotHash, revised[0].snapshotHash, 'master source revision must be sealed');

await assert.rejects(
  () => issueQuotesFromCalculation({ ...common, masterContext: { ...masterContext, modelYearId: '' } }),
  /modelYearId is required/
);

const memory = new Map();
const repository = {
  contract: QUOTE_REPOSITORY_CONTRACT,
  async put({ quote, idempotencyKey }) {
    const existing = memory.get(idempotencyKey);
    if (!existing) memory.set(idempotencyKey, quote);
    return {
      contract: QUOTE_WRITE_RECEIPT_CONTRACT,
      status: existing ? 'EXISTING' : 'CREATED',
      quoteId: quote.quoteId,
      quoteVersion: quote.quoteVersion,
      snapshotHash: quote.snapshotHash,
      idempotencyKey,
    };
  },
};
const first = await persistIssuedQuote(repository, quotes[0]);
const second = await persistIssuedQuote(repository, quotes[0]);
assert.equal(first.status, 'CREATED');
assert.equal(second.status, 'EXISTING');
assert.equal(first.idempotencyKey, quoteIdempotencyKey(quotes[0]));

await assert.rejects(
  () => persistIssuedQuote({
    contract: QUOTE_REPOSITORY_CONTRACT,
    async put({ quote, idempotencyKey }) {
      return {
        contract: QUOTE_WRITE_RECEIPT_CONTRACT,
        status: 'EXISTING',
        quoteId: quote.quoteId,
        quoteVersion: quote.quoteVersion,
        snapshotHash: 'different',
        idempotencyKey,
      };
    },
  }, quotes[0]),
  /receipt does not match/
);

assert.throws(
  () => createFreePassDataQuoteRepository({ endpoint: '' }),
  /endpoint is not configured/
);

let posted = null;
const httpRepo = createFreePassDataQuoteRepository({
  endpoint: 'https://freepass-data.invalid/commands/quotes',
  fetchImpl: async (_url, init) => {
    posted = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          contract: QUOTE_WRITE_RECEIPT_CONTRACT,
          status: 'CREATED',
          quoteId: quotes[0].quoteId,
          quoteVersion: quotes[0].quoteVersion,
          snapshotHash: quotes[0].snapshotHash,
          idempotencyKey: quoteIdempotencyKey(quotes[0]),
        };
      },
    };
  },
});
const httpReceipt = await persistIssuedQuote(httpRepo, quotes[0]);
assert.equal(httpReceipt.status, 'CREATED');
assert.equal(posted.command, 'PUT_ISSUED_QUOTE');
assert.equal(posted.quote.snapshotHash, quotes[0].snapshotHash);

console.log('PASS Quote factory + repository idempotency/control-plane contract');
