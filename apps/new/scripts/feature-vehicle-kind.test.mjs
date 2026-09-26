import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VEHICLE_KIND,
  USED_QUOTE_MODE,
  assertEngineSupportsVehicleKind,
  normalizeVehicleKind,
  normalizeUsedQuoteMode,
  validateVehicleKindSelection,
  vehicleKindPolicy,
} from '../src/lib/feature/vehicle-kind.js';

test('unknown vehicle kind fails safely to current new-car workflow', () => {
  assert.equal(normalizeVehicleKind('something'), VEHICLE_KIND.NEW);
  assert.equal(vehicleKindPolicy('something').usesVehicleAsset, false);
});

test('new car consumes product identity and configurable option/color flow', () => {
  const policy = vehicleKindPolicy(VEHICLE_KIND.NEW);
  assert.equal(policy.usesVehicleModelMaster, true);
  assert.equal(policy.usesVehicleAsset, false);
  assert.equal(policy.supportsOptionConfiguration, true);
  assert.equal(policy.supportsColorConfiguration, true);
  assert.deepEqual([...policy.selectionFlow], ['manufacturer', 'model', 'variant', 'trim', 'colors', 'options']);
  assert.deepEqual(validateVehicleKindSelection({ kind: VEHICLE_KIND.NEW }), {
    valid: false,
    code: 'NEWCAR_PRODUCT_REQUIRED',
  });
  assert.equal(validateVehicleKindSelection({ kind: VEHICLE_KIND.NEW, productId: 'product-1' }).valid, true);
});

test('used car requires authoritative asset identity and rent/subscription mode', () => {
  const policy = vehicleKindPolicy(VEHICLE_KIND.USED);
  assert.equal(policy.usesVehicleModelMaster, true);
  assert.equal(policy.usesVehicleAsset, true);
  assert.equal(policy.supportsOptionConfiguration, false);
  assert.equal(policy.supportsColorConfiguration, false);
  assert.equal(policy.quoteModeRequired, true);
  assert.deepEqual([...policy.selectionFlow], ['inventory', 'conditions']);

  assert.deepEqual(validateVehicleKindSelection({
    kind: VEHICLE_KIND.USED,
    quoteMode: USED_QUOTE_MODE.RENT,
  }), {
    valid: false,
    code: 'USEDCAR_ASSET_REQUIRED',
  });

  assert.deepEqual(validateVehicleKindSelection({
    kind: VEHICLE_KIND.USED,
    vehicleAssetId: 'asset-1',
  }), {
    valid: false,
    code: 'USEDCAR_QUOTE_MODE_REQUIRED',
  });

  assert.equal(validateVehicleKindSelection({
    kind: VEHICLE_KIND.USED,
    vehicleAssetId: 'asset-1',
    quoteMode: USED_QUOTE_MODE.SUBSCRIPTION,
  }).valid, true);
});

test('used quote mode is limited to rent or subscription', () => {
  assert.equal(normalizeUsedQuoteMode('렌트'), USED_QUOTE_MODE.RENT);
  assert.equal(normalizeUsedQuoteMode('구독'), USED_QUOTE_MODE.SUBSCRIPTION);
  assert.equal(normalizeUsedQuoteMode('리스'), null);
});

test('engine support is fail-closed by vehicle kind', () => {
  assert.equal(assertEngineSupportsVehicleKind(VEHICLE_KIND.NEW, ['신차']), VEHICLE_KIND.NEW);
  assert.throws(
    () => assertEngineSupportsVehicleKind(VEHICLE_KIND.USED, ['신차']),
    (error) => error?.code === 'QUOTE_ENGINE_UNSUPPORTED',
  );
});
