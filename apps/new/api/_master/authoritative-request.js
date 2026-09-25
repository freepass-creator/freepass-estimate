import { fetchFreePassDataMaster } from '../freepass-data-master.js';
import { createPriceBasis } from '../../src/lib/quote/price-basis.js';

const MASTER_CONTRACT = 'estimate-newcar-master/v1';
const MASTER_AUTHORITY = 'CANONICAL_ACTIVE';

function codedError(message, code, status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function requiredText(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw codedError(`${field} is required for authoritative pricing`, 'FREEPASS_DATA_SELECTION_INCOMPLETE');
  }
  return normalized;
}

function krw(value, field) {
  if (!value || value.currency !== 'KRW') {
    throw codedError(`${field} must be KRW money`, 'FREEPASS_DATA_PRICE_INVALID');
  }
  const amount = Number(value.amount);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw codedError(`${field} must be a non-negative integer`, 'FREEPASS_DATA_PRICE_INVALID');
  }
  return amount;
}

function finiteNonNegative(value, field) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw codedError(`${field} must be a non-negative finite number`, 'FREEPASS_DATA_PRICE_INVALID');
  }
  return Math.round(amount);
}

function uniqueById(items, idField, id, field) {
  const matches = (Array.isArray(items) ? items : []).filter((item) => item?.[idField] === id);
  if (matches.length !== 1) {
    throw codedError(
      `${field} is not uniquely present in FreePass Data master: ${id}`,
      'FREEPASS_DATA_SELECTION_MISMATCH'
    );
  }
  return matches[0];
}

function assertReleaseMeta(meta) {
  if (!meta || meta.contract !== MASTER_CONTRACT || meta.authority !== MASTER_AUTHORITY ||
      meta.projectionId !== 'estimate-newcar-master' || meta.schemaVersion !== '1.0.0' ||
      !meta.releaseId || !Number.isSafeInteger(meta.revision) || meta.revision < 1) {
    throw codedError(
      'FreePass Data CANONICAL_ACTIVE Estimate master evidence is required',
      'FREEPASS_DATA_MASTER_EVIDENCE_INVALID',
      503
    );
  }
  return meta;
}

function validateOptionSelection(masterOptions, selectedIds) {
  const map = new Map(masterOptions.map((option) => [option.optionId, option]));
  const selected = new Set(selectedIds);
  const groups = new Map();

  for (const id of selectedIds) {
    const option = map.get(id);
    if (!option) {
      throw codedError(`selected option is not in FreePass Data master: ${id}`, 'FREEPASS_DATA_SELECTION_MISMATCH');
    }
    for (const requiredId of option.requires || []) {
      if (!selected.has(requiredId)) {
        throw codedError(`${id} requires ${requiredId}`, 'FREEPASS_DATA_OPTION_RULE_VIOLATION');
      }
    }
    for (const excludedId of option.excludes || []) {
      if (selected.has(excludedId)) {
        throw codedError(`${id} excludes ${excludedId}`, 'FREEPASS_DATA_OPTION_RULE_VIOLATION');
      }
    }
    if (option.exclusiveGroupId) {
      const prior = groups.get(option.exclusiveGroupId);
      if (prior && prior !== id) {
        throw codedError(
          `${prior} and ${id} are mutually exclusive`,
          'FREEPASS_DATA_OPTION_RULE_VIOLATION'
        );
      }
      groups.set(option.exclusiveGroupId, id);
    }
  }
}

/**
 * Replace all vehicle price facts in a QuoteRequest with the authoritative
 * CANONICAL_ACTIVE FreePass Data Estimate master values.
 *
 * The browser may carry display prices, but they are never trusted by a pricing engine.
 * Only mutable commercial inputs such as an explicit staff discount remain request-owned.
 */
export function canonicalizeQuoteRequestFromMaster(request, masterPayload) {
  const meta = assertReleaseMeta(masterPayload?.meta);
  if (!Array.isArray(masterPayload?.data) || !masterPayload.data.length) {
    throw codedError('FreePass Data Estimate master is empty', 'FREEPASS_DATA_MASTER_INVALID', 503);
  }

  const car = request?.차 || {};
  const productId = requiredText(car.상품키 || car.키, 'productId');
  const records = masterPayload.data.filter((record) => record?.productId === productId);
  if (records.length !== 1) {
    throw codedError(
      `FreePass Data product is not uniquely available: ${productId}`,
      'FREEPASS_DATA_PRODUCT_NOT_FOUND'
    );
  }
  const record = records[0];
  if (record.status !== 'ACTIVE') {
    throw codedError(
      `FreePass Data product is HOLD: ${productId}`,
      'FREEPASS_DATA_PRODUCT_HOLD'
    );
  }

  const configuration = car.구성 || {};
  const rawSelected = Array.isArray(configuration.선택옵션) ? configuration.선택옵션 : [];
  const selectedIds = rawSelected.map((option) =>
    requiredText(option?.stableId, `selected option stableId (${option?.id || '?'})`)
  );
  if (new Set(selectedIds).size !== selectedIds.length) {
    throw codedError('duplicate selected option stableId', 'FREEPASS_DATA_SELECTION_MISMATCH');
  }

  const masterOptions = Array.isArray(record.options) ? record.options : [];
  validateOptionSelection(masterOptions, selectedIds);
  const optionMap = new Map(masterOptions.map((option) => [option.optionId, option]));
  const selectedOptions = rawSelected.map((option, index) => {
    const stableId = selectedIds[index];
    const masterOption = optionMap.get(stableId);
    const price = krw(masterOption.price, `option ${stableId} price`);
    return {
      ...option,
      stableId,
      name: String(masterOption.name ?? option?.name ?? '').trim(),
      price_won: price,
    };
  });
  const optionPrice = selectedOptions.reduce((sum, option) => sum + option.price_won, 0);

  const colorExtId = requiredText(configuration.colorExtId ?? car.colorExtId, 'colorExtId');
  const colorIntId = requiredText(configuration.colorIntId ?? car.colorIntId, 'colorIntId');
  const ext = uniqueById(record.exteriorColors, 'colorId', colorExtId, 'colorExtId');
  const int = uniqueById(record.interiorColors, 'colorId', colorIntId, 'colorIntId');

  const trimPrice = krw(record.basePrice, 'basePrice');
  const exteriorColorPrice = krw(ext.price, 'exteriorColorPrice');
  const interiorColorPrice = krw(int.price, 'interiorColorPrice');
  const discount = finiteNonNegative(car?.가격?.할인 ?? car?.할인 ?? 0, 'discount');
  const standardCalculatedVehiclePrice = Math.max(
    0,
    trimPrice + optionPrice + exteriorColorPrice + interiorColorPrice - discount
  );

  const priceBefore = record.priceBefore ? krw(record.priceBefore, 'priceBefore') : 0;
  const priceAfter = record.priceAfter ? krw(record.priceAfter, 'priceAfter') : 0;
  const sourceRevision = `freepass-data/${meta.releaseId}@r${meta.revision}`;
  const priceBasis = createPriceBasis({
    productId,
    sourceRevision,
    basePrice: trimPrice,
    optionPrice,
    exteriorColorPrice,
    interiorColorPrice,
    discount,
    totalVehiclePrice: standardCalculatedVehiclePrice,
    priceBefore,
    priceAfter,
    priceBasisName: String(record.priceBasis ?? '').trim(),
  });

  return Object.freeze({
    request: {
      ...request,
      차: {
        ...car,
        상품키: productId,
        가격: {
          ...(car.가격 || {}),
          트림: trimPrice,
          옵션: optionPrice,
          외장색: exteriorColorPrice,
          내장색: interiorColorPrice,
          할인: discount,
          표준계산차량가: standardCalculatedVehiclePrice,
          기준전: priceBefore,
          기준후: priceAfter,
          기준명: String(record.priceBasis ?? '').trim(),
        },
        구성: {
          ...configuration,
          colorExtId,
          colorIntId,
          선택옵션: selectedOptions,
        },
        마스터: {
          contract: MASTER_CONTRACT,
          authority: MASTER_AUTHORITY,
          productId,
          sourceRevision,
          releaseId: meta.releaseId,
          revision: meta.revision,
        },
      },
    },
    record,
    meta,
    sourceRevision,
    priceBasis,
  });
}

export async function authoritativeQuoteRequest(request, {
  loadMaster = fetchFreePassDataMaster,
} = {}) {
  if (typeof loadMaster !== 'function') {
    throw codedError('FreePass Data master loader is unavailable', 'FREEPASS_DATA_MASTER_UNAVAILABLE', 503);
  }
  const master = await loadMaster();
  return canonicalizeQuoteRequestFromMaster(request, master);
}
