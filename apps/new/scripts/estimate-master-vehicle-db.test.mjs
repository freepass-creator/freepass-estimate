import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVehicleDbFromEstimateMaster } from '../src/lib/master/vehicle-db-projection.js';

function money(amount) { return { amount, currency: 'KRW' }; }

const meta = {
  authority: 'CANONICAL_ACTIVE',
  projectionId: 'estimate-newcar-master',
  releaseId: 'rel_1',
  manifestId: 'manifest_1',
  revision: 3,
  dataDigest: 'a'.repeat(64),
  activatedAt: '2026-09-26T00:00:00.000Z',
};

function record(overrides = {}) {
  return {
    productId: 'prod_niro_signature',
    vehicleModelId: 'vm_niro',
    modelYearId: 'my_niro_2026',
    trimId: 'trim_niro_signature',
    powertrainId: 'pt_niro_hev',
    maker: '기아',
    model: '니로',
    modelYear: 2026,
    trimName: '시그니처',
    powertrainName: '1.6 하이브리드',
    basePrice: money(35020000),
    priceBefore: money(35020000),
    priceAfter: money(34520000),
    priceBasis: '세제혜택 후',
    options: [{
      optionId: 'opt_drivewise',
      name: '드라이브 와이즈',
      price: money(700000),
      requires: [],
      excludes: [],
      exclusiveGroupId: null,
    }],
    exteriorColors: [{ colorId: 'ext_white', name: '스노우 화이트 펄', code: 'SWP', price: money(80000) }],
    interiorColors: [{ colorId: 'int_black', name: '블랙', code: 'BLK', price: money(0) }],
    configuration: { drivetrain: 'FWD', seats: 5, bodyConfiguration: null },
    status: 'ACTIVE',
    holdReasons: [],
    ...overrides,
  };
}

test('projects verified FreePass Data master into legacy VEHICLE_DB shape without inventing IDs', () => {
  const master = {
    meta,
    records: [
      record(),
      record({
        productId: 'prod_niro_prestige',
        trimId: 'trim_niro_prestige',
        trimName: '프레스티지',
        basePrice: money(33000000),
        options: [{
          optionId: 'opt_drivewise',
          name: '드라이브 와이즈',
          price: money(650000),
          requires: [],
          excludes: [],
          exclusiveGroupId: null,
        }],
      }),
      record({
        productId: 'hold_legacy',
        vehicleModelId: null,
        modelYearId: null,
        trimId: null,
        powertrainId: null,
        modelYear: null,
        status: 'HOLD',
        holdReasons: ['MODEL_YEAR_UNVERIFIED'],
      }),
    ],
  };

  const projected = buildVehicleDbFromEstimateMaster(master);
  assert.equal(projected.meta.source, 'freepass-data/estimate-newcar-master');
  assert.equal(projected.meta.release_id, 'rel_1');
  assert.equal(projected.meta.active_product_count, 2);
  assert.equal(projected.meta.hold_product_count, 1);

  const maker = projected.vehicleDb.manufacturers[0];
  assert.equal(maker.manufacturer_name, '기아');
  const model = maker.models[0];
  assert.equal(model.model_id, 'vm_niro');
  assert.equal(model.model_year_id, 'my_niro_2026');

  const powertrain = model.variants[0];
  assert.equal(powertrain.variant_id, 'pt_niro_hev');
  assert.equal(powertrain.trims.length, 2);
  assert.equal(powertrain.trims[0].trim_id, 'prod_niro_signature');
  assert.equal(powertrain.trims[0]._stable_trim_id, 'trim_niro_signature');
  assert.equal(powertrain.trims[0].base_price_5, 3502);

  assert.equal(powertrain.options_master.opt_drivewise._stable_option_id, 'opt_drivewise');
  assert.equal(powertrain.options_master.opt_drivewise.trim_prices.prod_niro_signature, 70);
  assert.equal(powertrain.options_master.opt_drivewise.trim_prices.prod_niro_prestige, 65);
  assert.equal(powertrain.trims[0]._exterior_colors[0]._stable_color_id, 'ext_white');
});

test('fails closed when one vehicle model would need a model-year UI axis', () => {
  assert.throws(
    () => buildVehicleDbFromEstimateMaster({
      meta,
      records: [
        record(),
        record({
          productId: 'prod_niro_2027',
          modelYearId: 'my_niro_2027',
          modelYear: 2027,
          trimId: 'trim_niro_2027',
        }),
      ],
    }),
    (error) => error?.code === 'ESTIMATE_MASTER_UI_MODEL_YEAR_AXIS_REQUIRED'
  );
});

test('rejects unverified release metadata and empty ACTIVE sets', () => {
  assert.throws(
    () => buildVehicleDbFromEstimateMaster({ meta: { ...meta, authority: 'STATIC' }, records: [record()] }),
    (error) => error?.code === 'ESTIMATE_MASTER_UI_PROJECTION_UNAVAILABLE'
  );
  assert.throws(
    () => buildVehicleDbFromEstimateMaster({
      meta,
      records: [record({
        status: 'HOLD',
        vehicleModelId: null,
        modelYearId: null,
        trimId: null,
        powertrainId: null,
        modelYear: null,
        holdReasons: ['MODEL_YEAR_UNVERIFIED'],
      })],
    }),
    (error) => error?.code === 'ESTIMATE_MASTER_UI_PROJECTION_EMPTY'
  );
});
