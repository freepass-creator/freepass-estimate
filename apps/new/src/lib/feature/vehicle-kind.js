// FreePass Estimate vehicle-kind feature contract.
// Selection/data identity belongs to FreePass Data; pricing engine support belongs to E.
// F owns which functional workflow/capabilities a vehicle kind may use.

export const VEHICLE_KIND = Object.freeze({
  NEW: '신차',
  USED: '중고차',
});

export const USED_QUOTE_MODE = Object.freeze({
  RENT: '렌트',
  SUBSCRIPTION: '구독',
});

const USED_MODES = new Set(Object.values(USED_QUOTE_MODE));

export function normalizeVehicleKind(value) {
  if (value === VEHICLE_KIND.USED) return VEHICLE_KIND.USED;
  return VEHICLE_KIND.NEW;
}

export function normalizeUsedQuoteMode(value) {
  return USED_MODES.has(value) ? value : null;
}

export function vehicleKindPolicy(kind) {
  const normalized = normalizeVehicleKind(kind);
  const used = normalized === VEHICLE_KIND.USED;

  return Object.freeze({
    kind: normalized,
    usesVehicleModelMaster: true,
    usesVehicleAsset: used,
    selectionFlow: used
      ? Object.freeze(['inventory', 'conditions'])
      : Object.freeze(['manufacturer', 'model', 'variant', 'trim', 'colors', 'options']),
    supportsOptionConfiguration: !used,
    supportsColorConfiguration: !used,
    supportsQuoteConditions: true,
    supportsCart: true,
    supportsHistory: true,
    supportsShare: true,
    supportsOfficialSend: true,
    quoteModeRequired: used,
  });
}

export function validateVehicleKindSelection({
  kind,
  productId = null,
  vehicleAssetId = null,
  quoteMode = null,
} = {}) {
  const policy = vehicleKindPolicy(kind);

  if (policy.kind === VEHICLE_KIND.NEW) {
    if (!String(productId ?? '').trim()) {
      return Object.freeze({ valid: false, code: 'NEWCAR_PRODUCT_REQUIRED' });
    }
    return Object.freeze({ valid: true, code: null });
  }

  if (!String(vehicleAssetId ?? '').trim()) {
    return Object.freeze({ valid: false, code: 'USEDCAR_ASSET_REQUIRED' });
  }
  if (!normalizeUsedQuoteMode(quoteMode)) {
    return Object.freeze({ valid: false, code: 'USEDCAR_QUOTE_MODE_REQUIRED' });
  }

  return Object.freeze({ valid: true, code: null });
}

export function assertEngineSupportsVehicleKind(kind, supportedKinds = []) {
  const normalized = normalizeVehicleKind(kind);
  if (!Array.isArray(supportedKinds) || !supportedKinds.includes(normalized)) {
    const error = new Error(`quote engine does not support vehicle kind: ${normalized}`);
    error.code = 'QUOTE_ENGINE_UNSUPPORTED';
    throw error;
  }
  return normalized;
}
