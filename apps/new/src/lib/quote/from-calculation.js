import { buildIssuedQuote } from './quote-v2.js';
import { normalizePricingEngineEvidence } from './pricing-engine.js';

function required(value, field) {
  const v = String(value ?? '').trim();
  if (!v) {
    const error = new Error(`${field} is required to issue a quote`);
    error.code = 'QUOTE_MASTER_IDENTITY_REQUIRED';
    throw error;
  }
  return v;
}

function finite(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const error = new Error(`${field} must be finite`);
    error.code = 'QUOTE_CALCULATION_INVALID';
    throw error;
  }
  return n;
}

function requestSelectedOptions(request) {
  const options = request?.차?.구성?.선택옵션;
  if (!Array.isArray(options)) return [];
  return options.map((option) => ({
    optionId: required(option?.stableId ?? option?.id, 'selectedOption.stableId'),
    price: finite(option?.price_won ?? option?.price ?? 0, 'selectedOption.price'),
  })).sort((a, b) => a.optionId < b.optionId ? -1 : a.optionId > b.optionId ? 1 : 0);
}

function assertMasterSnapshot(master, request) {
  const snap = master?.quoteSnapshot;
  if (!snap || typeof snap !== 'object') {
    const error = new Error('FreePass Data quote snapshot is required');
    error.code = 'QUOTE_MASTER_SNAPSHOT_REQUIRED';
    throw error;
  }
  if (!Array.isArray(snap.selectedOptionIds) || !Array.isArray(snap.optionPriceSnapshot) ||
      !snap.vehiclePriceSnapshot || typeof snap.vehiclePriceSnapshot !== 'object') {
    const error = new Error('FreePass Data quote snapshot is incomplete');
    error.code = 'QUOTE_MASTER_SNAPSHOT_REQUIRED';
    throw error;
  }

  const masterOptions = [...snap.optionPriceSnapshot]
    .map((option) => ({
      optionId: required(option?.optionId, 'masterOption.optionId'),
      name: String(option?.name ?? '').trim(),
      price: finite(option?.price, 'masterOption.price'),
    }))
    .sort((a, b) => a.optionId < b.optionId ? -1 : a.optionId > b.optionId ? 1 : 0);
  const requestOptions = requestSelectedOptions(request);

  if (JSON.stringify(requestOptions.map(({ optionId, price }) => ({ optionId, price }))) !==
      JSON.stringify(masterOptions.map(({ optionId, price }) => ({ optionId, price })))) {
    const error = new Error('selected option IDs/prices do not match FreePass Data master');
    error.code = 'QUOTE_MASTER_OPTION_MISMATCH';
    throw error;
  }

  const price = request?.차?.가격 || {};
  const authoritative = snap.vehiclePriceSnapshot;
  const expected = {
    trimPrice: finite(authoritative.basePrice, 'masterPrice.basePrice'),
    optionPrice: masterOptions.reduce((sum, option) => sum + option.price, 0),
    exteriorColorPrice: finite(authoritative.exteriorColorPrice, 'masterPrice.exteriorColorPrice'),
    interiorColorPrice: finite(authoritative.interiorColorPrice, 'masterPrice.interiorColorPrice'),
    priceBefore: finite(authoritative.priceBefore ?? 0, 'masterPrice.priceBefore'),
    priceAfter: finite(authoritative.priceAfter ?? 0, 'masterPrice.priceAfter'),
    priceBasis: String(authoritative.priceBasis ?? '').trim(),
  };
  const actual = {
    trimPrice: finite(price.트림 ?? 0, 'vehiclePrice.trim'),
    optionPrice: finite(price.옵션 ?? 0, 'vehiclePrice.options'),
    exteriorColorPrice: finite(price.외장색 ?? 0, 'vehiclePrice.exteriorColor'),
    interiorColorPrice: finite(price.내장색 ?? 0, 'vehiclePrice.interiorColor'),
    priceBefore: finite(price.기준전 ?? 0, 'vehiclePrice.priceBefore'),
    priceAfter: finite(price.기준후 ?? 0, 'vehiclePrice.priceAfter'),
    priceBasis: String(price.기준명 ?? '').trim(),
  };

  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) {
      const error = new Error(`${key} does not match FreePass Data master`);
      error.code = 'QUOTE_MASTER_PRICE_MISMATCH';
      throw error;
    }
  }

  const discount = finite(price.할인 ?? 0, 'vehiclePrice.discount');
  const calculated = Math.max(
    0,
    expected.trimPrice + expected.optionPrice + expected.exteriorColorPrice + expected.interiorColorPrice - discount
  );
  const requestCalculated = finite(price.표준계산차량가 ?? 0, 'vehiclePrice.standardCalculatedVehiclePrice');
  if (calculated !== requestCalculated) {
    const error = new Error('calculated vehicle price does not match master price components');
    error.code = 'QUOTE_MASTER_PRICE_MISMATCH';
    throw error;
  }

  return Object.freeze({
    selectedOptionIds: Object.freeze(masterOptions.map((option) => option.optionId)),
    optionPriceSnapshot: Object.freeze(masterOptions),
    vehiclePriceSnapshot: Object.freeze({
      productId: required(snap.productId, 'masterSnapshot.productId'),
      modelYear: finite(snap.modelYear, 'masterSnapshot.modelYear'),
      basePrice: expected.trimPrice,
      optionPrice: expected.optionPrice,
      exteriorColorPrice: expected.exteriorColorPrice,
      interiorColorPrice: expected.interiorColorPrice,
      discount,
      standardCalculatedVehiclePrice: calculated,
      priceBefore: expected.priceBefore,
      priceAfter: expected.priceAfter,
      priceBasis: expected.priceBasis,
      exteriorColorName: String(authoritative.exteriorColorName ?? '').trim(),
      interiorColorName: String(authoritative.interiorColorName ?? '').trim(),
      currency: 'KRW',
    }),
  });
}

function validateCalculation(request, calculation) {
  const scenarios = request?.안들;
  const rows = calculation?.결과;
  if (!Array.isArray(scenarios) || !scenarios.length) {
    const error = new Error('quote scenarios are required');
    error.code = 'QUOTE_REQUEST_INVALID';
    throw error;
  }
  if (!Array.isArray(rows) || rows.length !== scenarios.length) {
    const error = new Error('calculation result must match scenario count');
    error.code = 'QUOTE_RESULT_INVALID';
    throw error;
  }
  return { scenarios, rows };
}

/**
 * Converts one provider calculation execution into immutable issued Quote v2 records.
 * One Quote = one vehicle + one exact contract scenario.
 *
 * masterContext must come from the FreePass Data-backed master resolution layer.
 * This function never invents missing model-year/powertrain/color identities.
 */
export async function issueQuotesFromCalculation({
  request,
  calculation,
  masterContext,
  pricingEngineVersion = null,
  sourceRevision = null,
  createdAt,
  quoteVersion = 1,
} = {}) {
  const { scenarios, rows } = validateCalculation(request, calculation);
  const master = masterContext || {};

  const identity = {
    vehicleModelId: required(master.vehicleModelId, 'vehicleModelId'),
    modelYearId: required(master.modelYearId, 'modelYearId'),
    trimId: required(master.trimId, 'trimId'),
    powertrainId: required(master.powertrainId, 'powertrainId'),
    exteriorColorId: required(master.exteriorColorId, 'exteriorColorId'),
    interiorColorId: required(master.interiorColorId, 'interiorColorId'),
  };

  const engineEvidence = normalizePricingEngineEvidence(calculation?.pricingEngine, { requireVerified: true });
  const engineVersion = engineEvidence.version;
  if (pricingEngineVersion != null && required(pricingEngineVersion, 'pricingEngineVersion') !== engineVersion) {
    const error = new Error('pricingEngineVersion does not match calculation engine evidence');
    error.code = 'QUOTE_PRICING_ENGINE_MISMATCH';
    throw error;
  }
  const revision = required(master.sourceRevision, 'masterContext.sourceRevision');
  if (sourceRevision != null && required(sourceRevision, 'sourceRevision') !== revision) {
    const error = new Error('sourceRevision does not match FreePass Data master evidence');
    error.code = 'QUOTE_MASTER_SOURCE_MISMATCH';
    throw error;
  }
  const issuedAt = required(createdAt, 'createdAt');
  const snapshot = assertMasterSnapshot(master, request);
  const mileage = required(request?.조건?.주행, 'mileageCondition');

  const quotes = [];
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index] || {};
    const row = rows[index];
    if (!row) {
      const error = new Error(`calculation result is missing for scenario ${index}`);
      error.code = 'QUOTE_RESULT_INCOMPLETE';
      throw error;
    }

    const monthlyRental = finite(row.월대여료, 'monthlyRental');
    const totalVehiclePrice = finite(row.총차량가, 'totalVehiclePrice');
    if (!(monthlyRental > 0) || !(totalVehiclePrice > 0)) {
      const error = new Error('issued quote requires positive monthlyRental and totalVehiclePrice');
      error.code = 'QUOTE_RESULT_INVALID';
      throw error;
    }

    quotes.push(await buildIssuedQuote({
      ...identity,
      selectedOptionIds: snapshot.selectedOptionIds,
      contractTerm: finite(scenario.기간, 'contractTerm'),
      mileageCondition: mileage,
      deposit: finite(row.보증금 ?? 0, 'deposit'),
      prepayment: finite(row.선납금 ?? 0, 'prepayment'),
      depositRatePct: finite(scenario.보증금 ?? 0, 'depositRatePct'),
      prepaymentRatePct: finite(scenario.선납 ?? 0, 'prepaymentRatePct'),
      vehiclePriceSnapshot: snapshot.vehiclePriceSnapshot,
      optionPriceSnapshot: snapshot.optionPriceSnapshot,
      totalVehiclePrice,
      monthlyRental,
      pricingEngineVersion: engineVersion,
      sourceRevision: revision,
    }, {
      createdAt: issuedAt,
      quoteVersion,
    }));
  }

  return Object.freeze(quotes);
}
