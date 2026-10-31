// Kamatch's published 2026-10-31 multi-term quote equations, independently expressed.
// No vehicle catalogue is read here. A caller must supply canonical FreePass price
// evidence plus reviewed provider-policy mappings. This module is not a live adapter.
import { normalizePriceBasis } from '../../src/lib/quote/price-basis.js';

function fail(message) {
  throw Object.assign(new Error(message), { code: 'KAMATCH_POLICY_UNSUPPORTED' });
}

export function pmt(rate, months, present, future) {
  if (rate === 0) return -(present + future) / months;
  const growth = Math.pow(1 + rate, months);
  return -rate * (present * growth + future) / (growth - 1);
}

function nearest(value, allowed) {
  return allowed.includes(value) ? value : allowed.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best, allowed[0]);
}

export function calculateKamatchScenario({ priceBasis, vehiclePolicy: v, conditions: c, policy }) {
  const basis = normalizePriceBasis(priceBasis);
  const settings = policy?.settings;
  if (!v || !settings || ![36, 48, 60].includes(c?.termMonths)) fail('차량 요율 또는 계약기간을 확인해 주세요.');
  const term = c.termMonths;
  const grossPrice = basis.basePrice + basis.optionPrice + basis.exteriorColorPrice + basis.interiorColorPrice;
  const discountedPrice = grossPrice - basis.discount;
  if (discountedPrice <= 0) fail('할인 후 차량가격이 유효하지 않습니다.');
  const credit = c.creditType;
  const delivery = c.deliveryType;
  if (!['general', 'low'].includes(credit) || !['dealer', 'special'].includes(delivery)) fail('지원하지 않는 상품 구분입니다.');
  const general = credit === 'general';
  const vat = 1 + settings.vatRate / 100;
  const manualDeposit = c.manualDepositAmount;
  const depositRate = manualDeposit != null
    ? (manualDeposit / grossPrice * 100 >= 30 ? 30 : manualDeposit / grossPrice * 100 >= 20 ? 20 : manualDeposit / grossPrice * 100 >= 10 ? 10 : 5)
    : c.depositPercent;
  if (!Number.isFinite(depositRate) || depositRate < 0 || depositRate > 30) fail('보증금 비율을 확인해 주세요.');
  const rateBucket = nearest(depositRate, general ? [0, 5, 10, 20, 30] : [5, 10, 20, 30]);
  const interestRow = policy['commission-rates'].find(row => row.creditType === credit && row.deliveryType === delivery && row.depositRate === rateBucket);
  const interest = interestRow?.rate ?? settings.productInterestRate;
  const grade = (general ? v.residualGradeGeneral ?? v.residualGrade : v.residualGrade) || 'A';
  const mileageNumber = c.annualKm === '무제한' ? 30000 : Number(c.annualKm) || 30000;
  const mileageBucket = nearest(mileageNumber, [20000, 30000]);
  const residualRow = policy['residual-grade-rates'].find(row => row.grade === grade && row.term === term && row.mileage === mileageBucket)
    ?? policy['residual-rates'].find(row => row.vehicleType === v.vehicleType && row.term === term);
  if (!residualRow || !(interest > 0)) fail('금리 또는 잔가표가 없습니다.');
  const valueForCredit = key => general ? v[`${key}General`] ?? v[key] : v[key];
  const gaesoIndex = Number(valueForCredit('gaesoIndex')) || 0;
  if (!(gaesoIndex > 0)) fail('개소지수 없는 차량은 동일 견적을 보장할 수 없습니다.');
  const depositBase = settings.depositBaseDiscounted ? discountedPrice : grossPrice;
  const deposit = manualDeposit != null ? Math.round(manualDeposit) : Math.round(depositBase * depositRate / 100);
  const prepay = c.manualPrepayAmount != null ? Math.round(c.manualPrepayAmount)
    : c.prepayPercent > 0 ? Math.round(grossPrice * c.prepayPercent / 100) : 0;
  const kia = (v.brand || '').trim().startsWith('기아');
  const special = delivery === 'special';
  const acquisitionConstant = kia
    ? (special ? settings.acqConstKiaSpecial : settings.acqConstKia)
    : (special ? settings.acqConstDefaultSpecial : settings.acqConstDefault);
  const discountRate = (special ? v.specialDiscountRate : null)
    ?? (special ? kia ? settings.specialDiscountRateKia : settings.specialDiscountRate
      : kia ? settings.dealerDiscountRateKia : settings.dealerDiscountRate);
  const taxExcludedPrice = discountedPrice / gaesoIndex * vat;
  const acquisitionSupply = (taxExcludedPrice + acquisitionConstant - taxExcludedPrice * discountRate / 100) / vat;
  const registrationRate = policy['gaeso-reg-rates'].find(row => Math.abs(row.gaesoIndex - gaesoIndex) < 0.0001)?.regFeeRate ?? settings.regFeeRate;
  const acquisitionCost = acquisitionSupply + acquisitionSupply * registrationRate / 100 + settings.regFeeFixed;
  const supplyRate = Math.abs(depositRate - 5) <= Math.abs(depositRate - 10)
    ? settings.commissionSupplyRate5 : settings.commissionSupplyRate10;
  const supplyCommission = discountedPrice * supplyRate / 100 / vat;
  const salesFeeRate = c.salesFeeRate;
  if (!Number.isFinite(salesFeeRate)) fail('영업 수수료율이 필요합니다.');
  const salesFeeBase = settings.salesFeeBaseDiscounted ? discountedPrice : grossPrice;
  const additionalSalesSupply = salesFeeBase * (salesFeeRate - supplyRate) / 100 / vat;
  const depositForPmt = deposit * settings.depositPmtRatio / 100;
  const calculationResidual = Math.round(discountedPrice * (residualRow.rate + settings.residualAdjust) / 100);
  const pureRental = pmt(interest / 100 / 12, term,
    -acquisitionCost + depositForPmt - supplyCommission - additionalSalesSupply,
    calculationResidual / vat - depositForPmt) * vat;
  const autoTax = valueForCredit('autoTax') ?? 0;
  const insuranceValue = valueForCredit('insurance') ?? 0;
  const insurance = insuranceValue > 0 ? insuranceValue : settings.defaultInsurance;
  const termCost = valueForCredit(`etcCost${term}`) ?? 0;
  const fixedOther = termCost > 0 ? termCost : settings.defaultEtcCost;
  const accessoryDelta = (c.extraOptions || []).reduce((sum, option) => option.removed
    ? sum - (Number(option.baseline) || 0)
    : sum + Math.max(0, (Number(option.amount) || 0) - (Number(option.baseline) || 0)), 0);
  const corporationBucket = Math.abs(depositRate - 5) <= Math.abs(depositRate - 10) ? 5 : 10;
  const corporationKey = `corpCommission${general ? 'General' : 'Low'}${corporationBucket}${special ? 'Special' : ''}`;
  const corporationRate = settings[corporationKey] ?? 0;
  const corporationCommission = Math.floor(grossPrice * corporationRate / 100);
  const age = c.insuranceAge || '';
  const ageSurcharge = age.includes('21') ? Math.round(settings.insuranceSurcharge2123)
    : age.includes('24') ? Math.round(settings.insuranceSurcharge2425) : 0;
  const cardCharge = settings.showCardPayment !== false && c.cardPayment
    ? Math.floor(deposit * 0.12 / term / 10) * 10 : 0;
  // Source uses Number(raw mileage), not the residual-table mileage bucket, here.
  const mileageCharge = Number(c.annualKm) >= 30000 ? v.extraMonthlyFee || 0 : 0;
  const rawMonthly = pureRental + autoTax + insurance + fixedOther
    + ((c.miscAmount || 0) + accessoryDelta) / term
    + corporationCommission / term - prepay / term + ageSurcharge + cardCharge + mileageCharge;
  const displayResidualRate = settings.forceResidualDisplay
    ? Math.max(residualRow.rate, term === 36 ? 50 : 45) : residualRow.rate;
  return {
    monthlyRent: Math.ceil(rawMonthly / 100) * 100,
    deposit, prepay, acquisitionCost: discountedPrice, totalVehiclePrice: grossPrice,
    residualPercent: displayResidualRate,
    residualAmount: Math.round(discountedPrice * displayResidualRate / 100),
    trace: { interest, residualGrade: grade, calculationResidual, acquisitionSupply,
      internalAcquisitionCost: acquisitionCost, pureRental, accessoryDelta,
      corporationRate, corporationCommission, cardCharge, rawMonthly },
  };
}
