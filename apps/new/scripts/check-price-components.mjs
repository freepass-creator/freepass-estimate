import assert from 'node:assert/strict';
import { 계산차량가 } from '../src/lib/quote/build-request.js';
import { externalOptionPrice } from '../api/external-quote.js';

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

assert.equal(
  externalOptionPrice(
    { 옵션: 1200000, 외장색: 100000, 내장색: 300000 },
    {},
    200000
  ),
  1400000,
  'external provider option price must include interior color and subtract absorbed axis option'
);

assert.throws(
  () => 계산차량가({ trimPrice: Number.NaN }),
  /가격 구성값이 올바르지 않습니다/
);

console.log('PASS new-car price component assembly');
