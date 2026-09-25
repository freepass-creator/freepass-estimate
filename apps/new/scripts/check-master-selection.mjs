import assert from 'node:assert/strict';
import { masterContextFromSelection } from '../src/lib/quote/master-selection.js';

const master = {
  meta: {
    contract: 'estimate-newcar-master/v1',
    projectionId: 'estimate-newcar-master',
    schemaVersion: '1.0.0',
    authority: 'CANONICAL_ACTIVE',
    releaseId: 'rel_master_1',
    manifestId: 'manifest_master_1',
    revision: 3,
    inputDigest: 'a'.repeat(64),
    dataDigest: 'b'.repeat(64),
    generatedAt: '2026-09-25T08:00:00.000Z',
    activatedAt: '2026-09-25T08:01:00.000Z',
  },
  byProductId: new Map([['prod_1', {
    productId: 'prod_1',
    vehicleModelId: 'vm_1',
    modelYearId: 'my_2026',
    trimId: 'trim_permanent',
    powertrainId: 'pt_1',
    modelYear: 2026,
    status: 'ACTIVE',
    holdReasons: [],
    basePrice: { amount: 40000000, currency: 'KRW' },
    priceBefore: { amount: 40000000, currency: 'KRW' },
    priceAfter: { amount: 39700000, currency: 'KRW' },
    priceBasis: '세제혜택 후',
    options: [
      { optionId: 'trim_permanent::opt:raw_a', name: '옵션A', price: { amount: 500000, currency: 'KRW' }, requires: [], excludes: [] },
    ],
    exteriorColors: [
      { colorId: 'trim_permanent::ext:SWP', name: '화이트', price: { amount: 80000, currency: 'KRW' } },
    ],
    interiorColors: [
      { colorId: 'trim_permanent::int:BLK', name: '블랙', price: { amount: 0, currency: 'KRW' } },
    ],
  }]]),
};

const vehicle = {
  _product_id: 'prod_1',
  colorExtId: 'trim_permanent::ext:SWP',
  colorIntId: 'trim_permanent::int:BLK',
  _selected_options: [{
    id: 'o_ui_hash_that_may_change',
    stableId: 'trim_permanent::opt:raw_a',
    sourceId: 'raw_a',
    name: '옵션A',
    price_won: 500000,
  }],
};

const context = masterContextFromSelection({ master, vehicle, condition: {} });
assert.equal(context.trimId, 'trim_permanent');
assert.deepEqual(context.quoteSnapshot.selectedOptionIds, ['trim_permanent::opt:raw_a']);
assert.equal(context.exteriorColorId, 'trim_permanent::ext:SWP');
assert.equal(context.interiorColorId, 'trim_permanent::int:BLK');

assert.throws(
  () => masterContextFromSelection({
    master,
    vehicle: {
      ...vehicle,
      _selected_options: [{ ...vehicle._selected_options[0], stableId: null }],
    },
    condition: {},
  }),
  /stableId/
);

assert.throws(
  () => masterContextFromSelection({
    master,
    vehicle: { ...vehicle, colorExtId: null },
    condition: {},
  }),
  /colorExtId/
);

console.log('PASS stable selection provenance -> Quote master context');
