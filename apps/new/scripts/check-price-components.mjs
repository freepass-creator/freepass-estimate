import assert from 'node:assert/strict';
import { 계산차량가 } from '../src/lib/quote/build-request.js';
import {
  externalCanonicalVehiclePrice,
  externalManualVehiclePrice,
  externalOptionPrice,
} from '../api/external-quote.js';
import { canonicalizeQuoteRequestFromMaster } from '../api/_master/authoritative-request.js';

const master = {
  meta: {
    contract: 'estimate-newcar-master/v1',
    authority: 'CANONICAL_ACTIVE',
    projectionId: 'estimate-newcar-master',
    schemaVersion: '1.0.0',
    releaseId: 'rel_price_1',
    revision: 7,
  },
  data: [{
    productId: 'prod_price_1',
    status: 'ACTIVE',
    basePrice: { amount: 35000000, currency: 'KRW' },
    priceBefore: { amount: 35000000, currency: 'KRW' },
    priceAfter: { amount: 34700000, currency: 'KRW' },
    priceBasis: '세제혜택 후',
    options: [{
      optionId: 'opt_a',
      name: '옵션 A',
      price: { amount: 1200000, currency: 'KRW' },
      requires: [],
      excludes: [],
      exclusiveGroupId: null,
    }],
    exteriorColors: [{
      colorId: 'ext_white',
      name: '화이트',
      price: { amount: 100000, currency: 'KRW' },
    }],
    interiorColors: [{
      colorId: 'int_black',
      name: '블랙',
      price: { amount: 300000, currency: 'KRW' },
    }],
  }],
};

const rawRequest = {
  차: {
    종류: '신차',
    키: 'prod_price_1',
    상품키: 'prod_price_1',
    // Deliberately stale/browser-owned price values. Canonicalization must replace them.
    가격: {
      트림: 1,
      옵션: 2,
      외장색: 3,
      내장색: 4,
      할인: 500000,
      표준계산차량가: 10,
    },
    구성: {
      colorExtId: 'ext_white',
      colorIntId: 'int_black',
      선택옵션: [{
        id: 'ui_opt_a',
        stableId: 'opt_a',
        name: 'stale label',
        price_won: 1,
      }],
    },
  },
  조건: {},
  안들: [{ 기간: 60, 보증금: 0, 선납: 0 }],
};

const { request: canonical } = canonicalizeQuoteRequestFromMaster(rawRequest, master);

assert.deepEqual(canonical.차.가격, {
  트림: 35000000,
  옵션: 1200000,
  외장색: 100000,
  내장색: 300000,
  할인: 500000,
  표준계산차량가: 36100000,
  기준전: 35000000,
  기준후: 34700000,
  기준명: '세제혜택 후',
});
assert.equal(canonical.차.구성.선택옵션[0].price_won, 1200000);
assert.equal(canonical.차.마스터.authority, 'CANONICAL_ACTIVE');
assert.equal(canonical.차.마스터.sourceRevision, 'freepass-data/rel_price_1@r7');

assert.equal(
  계산차량가({
    trimPrice: 35000000,
    optionPrice: 1200000,
    exteriorColorPrice: 100000,
    interiorColorPrice: 300000,
    discount: 500000,
  }),
  36100000,
  'request price assembly must include paid interior color'
);

const absorbedWon = 200000;
const manualPrice = externalManualVehiclePrice(canonical.차.가격, absorbedWon);
const providerOptionPrice = externalOptionPrice(canonical.차.가격, {}, absorbedWon);
const canonicalTotal = externalCanonicalVehiclePrice(canonical.차.가격);

assert.equal(manualPrice, 35200000,
  'provider manual base must be canonical trim plus axis price absorbed in provider row');
assert.equal(providerOptionPrice, 1400000,
  'external provider option price must include colors and subtract absorbed axis option');
assert.equal(
  manualPrice + providerOptionPrice - canonical.차.가격.할인,
  canonicalTotal,
  'provider input equation must exactly reproduce FreePass Data canonical configured vehicle price'
);
assert.equal(canonicalTotal, 36100000);

assert.throws(
  () => 계산차량가({ trimPrice: Number.NaN }),
  /가격 구성값이 올바르지 않습니다/
);
assert.throws(
  () => canonicalizeQuoteRequestFromMaster({
    ...rawRequest,
    차: {
      ...rawRequest.차,
      구성: { ...rawRequest.차.구성, colorExtId: null },
    },
  }, master),
  /colorExtId/
);

console.log('PASS FreePass Data authoritative new-car price assembly + external provider price equation');
