import assert from 'node:assert/strict';
import {
  buildCatalogPreviewRequest,
  resolveCatalogPreviewContext,
} from '../src/lib/quote/preview-request.js';

const manufacturer = {
  manufacturer_id: 'hyundai',
  manufacturer_name: '현대',
  models: [{
    model_id: 'm1',
    model_name: '캐스퍼',
    variants: [{
      variant_id: 'v1',
      variant_name: '가솔린 1.0',
      displacement_cc: 998,
      fuel: '가솔린',
      options_master: {
        o_b: { name: 'B 옵션', price: 20, _stable_option_id: 'trim-1::opt:b' },
        o_a: { name: 'A 옵션', price: 10, _stable_option_id: 'trim-1::opt:a' },
      },
      trims: [{
        trim_id: 'product-1',
        _product_id: 'product-1',
        name: '스마트',
        engine: '가솔린 1.0',
        base_price_5: 1493,
        operating: true,
        _base_axes: { drivetrain: 'two', seats: 4 },
        _exterior_colors: [
          { name: '유료', _stable_color_id: 'ext-z', _price_won: 100000 },
          { name: '기본2', _stable_color_id: 'ext-b', _price_won: 0 },
          { name: '기본1', _stable_color_id: 'ext-a', _price_won: 0 },
        ],
        _interior_colors: [
          { name: '기본', _stable_color_id: 'int-a', _price_won: 0 },
        ],
      }],
    }],
  }],
};
const db = { manufacturers: [manufacturer] };
const legacy = {
  brand: '현대',
  model: '더 뉴 캐스퍼',
  name: '캐스퍼',
  trim: '1.0 가솔린 스마트',
  price: 14930000,
  fuel: '가솔린',
  engine_label: '가솔린 1.0',
};

const context = resolveCatalogPreviewContext(legacy, db);
assert.equal(context.trim._product_id, 'product-1');

const args = {
  ...context,
  selectedOptionIds: ['o_b', 'o_a'],
  scenarios: [
    { term: 36, depositPct: 10, prepaymentPct: 0 },
    { term: 60, depositPct: 20, prepaymentPct: 10 },
  ],
  conditions: {
    credit: '중신용',
    mileage: '2만km',
    feeRatePct: 5,
  },
};

const first = buildCatalogPreviewRequest(args);
const second = buildCatalogPreviewRequest(args);
assert.deepEqual(first, second);
assert.equal(first.차.상품키, 'product-1');
assert.equal(first.차.가격.트림, 0);
assert.equal(first.차.가격.표준계산차량가, 0);
assert.equal(first.차.구성.colorExtId, 'ext-a');
assert.equal(first.차.구성.colorIntId, 'int-a');
assert.deepEqual(first.차.구성.선택옵션.map((o) => o.stableId), [
  'trim-1::opt:a',
  'trim-1::opt:b',
]);
assert.deepEqual(first.안들.map((s) => s.기간), [36, 60]);
assert.equal(first.조건.비용?.contract, 'freepass-quote-condition-costs/v1');
assert.equal(first.조건.탁송비, first.조건.비용.deliveryFee);
assert.equal(first.조건.썬팅비, first.조건.비용.tintFee);
assert.equal(first.조건.블박비, first.조건.비용.dashcamFee);

const ambiguousDb = structuredClone(db);
ambiguousDb.manufacturers[0].models[0].variants[0].trims.push({
  ...structuredClone(context.trim),
  trim_id: 'product-2',
  _product_id: 'product-2',
});
assert.throws(
  () => resolveCatalogPreviewContext(legacy, ambiguousDb),
  (error) => error?.code === 'QUOTE_PREVIEW_IDENTITY_AMBIGUOUS'
);

const noStableColor = structuredClone(context);
noStableColor.trim._exterior_colors = [{ name: '기본', _price_won: 0 }];
assert.throws(
  () => buildCatalogPreviewRequest({ ...args, ...noStableColor }),
  (error) => error?.code === 'QUOTE_PREVIEW_COLOR_UNRESOLVED'
);

console.log(JSON.stringify({
  status: 'PASS',
  assertions: [
    'legacy-row-to-product fail-closed resolution',
    'deterministic preview request',
    'stable option ordering',
    'stable zero-price color identity',
    'browser price is not authoritative',
  ],
}));
