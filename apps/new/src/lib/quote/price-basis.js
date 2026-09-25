export const PRICE_BASIS_CONTRACT = 'freepass-price-basis/v1';
export const PRICE_BASIS_AUTHORITY = 'FREEPASS_DATA_CANONICAL_ACTIVE';

function codedError(message, code = 'QUOTE_PRICE_BASIS_INVALID') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw codedError(`${field} is required`);
  return normalized;
}

function won(value, field) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw codedError(`${field} must be a non-negative KRW integer`);
  }
  return amount;
}

export function createPriceBasis({
  productId,
  sourceRevision,
  basePrice,
  optionPrice,
  exteriorColorPrice,
  interiorColorPrice,
  discount,
  totalVehiclePrice,
  priceBefore = 0,
  priceAfter = 0,
  priceBasisName = '',
} = {}) {
  return normalizePriceBasis({
    contract: PRICE_BASIS_CONTRACT,
    authority: PRICE_BASIS_AUTHORITY,
    masterContract: 'estimate-newcar-master/v1',
    currency: 'KRW',
    productId,
    sourceRevision,
    basePrice,
    optionPrice,
    exteriorColorPrice,
    interiorColorPrice,
    discount,
    totalVehiclePrice,
    priceBefore,
    priceAfter,
    priceBasisName,
  });
}

export function normalizePriceBasis(value, {
  expectedSourceRevision = null,
  expectedProductId = null,
} = {}) {
  if (!value || typeof value !== 'object') {
    throw codedError('priceBasis is required', 'QUOTE_PRICE_BASIS_REQUIRED');
  }
  if (value.contract !== PRICE_BASIS_CONTRACT ||
      value.authority !== PRICE_BASIS_AUTHORITY ||
      value.masterContract !== 'estimate-newcar-master/v1' ||
      value.currency !== 'KRW') {
    throw codedError('priceBasis authority/contract is invalid');
  }

  const productId = text(value.productId, 'priceBasis.productId');
  const sourceRevision = text(value.sourceRevision, 'priceBasis.sourceRevision');
  if (!/^freepass-data\/.+@r[1-9]\d*$/.test(sourceRevision)) {
    throw codedError('priceBasis sourceRevision is invalid');
  }
  if (expectedSourceRevision != null && sourceRevision !== text(expectedSourceRevision, 'expectedSourceRevision')) {
    throw codedError('priceBasis sourceRevision does not match master evidence', 'QUOTE_PRICE_BASIS_SOURCE_MISMATCH');
  }
  if (expectedProductId != null && productId !== text(expectedProductId, 'expectedProductId')) {
    throw codedError('priceBasis productId does not match master product', 'QUOTE_PRICE_BASIS_PRODUCT_MISMATCH');
  }

  const basePrice = won(value.basePrice, 'priceBasis.basePrice');
  const optionPrice = won(value.optionPrice, 'priceBasis.optionPrice');
  const exteriorColorPrice = won(value.exteriorColorPrice, 'priceBasis.exteriorColorPrice');
  const interiorColorPrice = won(value.interiorColorPrice, 'priceBasis.interiorColorPrice');
  const discount = won(value.discount, 'priceBasis.discount');
  const totalVehiclePrice = won(value.totalVehiclePrice, 'priceBasis.totalVehiclePrice');
  const priceBefore = won(value.priceBefore ?? 0, 'priceBasis.priceBefore');
  const priceAfter = won(value.priceAfter ?? 0, 'priceBasis.priceAfter');
  const calculated = Math.max(
    0,
    basePrice + optionPrice + exteriorColorPrice + interiorColorPrice - discount
  );
  if (calculated !== totalVehiclePrice) {
    throw codedError('priceBasis total does not equal canonical price components');
  }

  return Object.freeze({
    contract: PRICE_BASIS_CONTRACT,
    authority: PRICE_BASIS_AUTHORITY,
    masterContract: 'estimate-newcar-master/v1',
    currency: 'KRW',
    productId,
    sourceRevision,
    basePrice,
    optionPrice,
    exteriorColorPrice,
    interiorColorPrice,
    discount,
    totalVehiclePrice,
    priceBefore,
    priceAfter,
    priceBasisName: String(value.priceBasisName ?? '').trim(),
  });
}
