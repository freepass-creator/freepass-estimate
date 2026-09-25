import { buildIssuedQuote } from './quote-v2.js';

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

function selectedOptions(request) {
  const options = request?.차?.구성?.선택옵션;
  if (!Array.isArray(options)) return [];
  return options.map((option) => ({
    optionId: required(option?.id, 'selectedOption.id'),
    name: String(option?.name ?? '').trim(),
    price: finite(option?.price_won ?? option?.price ?? 0, 'selectedOption.price'),
  }));
}

function vehiclePriceSnapshot(request) {
  const price = request?.차?.가격 || {};
  return {
    trimPrice: finite(price.트림 ?? 0, 'vehiclePrice.trim'),
    optionPrice: finite(price.옵션 ?? 0, 'vehiclePrice.options'),
    exteriorColorPrice: finite(price.외장색 ?? 0, 'vehiclePrice.exteriorColor'),
    interiorColorPrice: finite(price.내장색 ?? 0, 'vehiclePrice.interiorColor'),
    discount: finite(price.할인 ?? 0, 'vehiclePrice.discount'),
    standardCalculatedVehiclePrice: finite(price.표준계산차량가 ?? 0, 'vehiclePrice.standardCalculatedVehiclePrice'),
    priceBefore: finite(price.기준전 ?? 0, 'vehiclePrice.priceBefore'),
    priceAfter: finite(price.기준후 ?? 0, 'vehiclePrice.priceAfter'),
    priceBasis: String(price.기준명 ?? '').trim(),
  };
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
  pricingEngineVersion,
  sourceRevision,
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

  const engineVersion = required(pricingEngineVersion, 'pricingEngineVersion');
  const revision = required(sourceRevision, 'sourceRevision');
  const issuedAt = required(createdAt, 'createdAt');
  const options = selectedOptions(request);
  const priceSnapshot = vehiclePriceSnapshot(request);
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
      selectedOptionIds: options.map((option) => option.optionId),
      contractTerm: finite(scenario.기간, 'contractTerm'),
      mileageCondition: mileage,
      deposit: finite(row.보증금 ?? 0, 'deposit'),
      prepayment: finite(row.선납금 ?? 0, 'prepayment'),
      depositRatePct: finite(scenario.보증금 ?? 0, 'depositRatePct'),
      prepaymentRatePct: finite(scenario.선납 ?? 0, 'prepaymentRatePct'),
      vehiclePriceSnapshot: priceSnapshot,
      optionPriceSnapshot: options,
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
