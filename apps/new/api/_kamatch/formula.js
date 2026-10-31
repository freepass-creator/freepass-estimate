// Arithmetic port of the publicly served Kamatch application on 2026-10-31.
// Tables and account policy are resolved separately; no fitted rates live here.
export function payment(rate, months, present, future = 0, timing = 0) {
  if (rate === 0) return -(present + future) / months;
  const growth = Math.pow(1 + rate, months);
  return -rate * (present * growth + future) / ((1 + rate * timing) * (growth - 1));
}
export function registrationRate(index, rows, fallback) {
  if (index && rows && rows.length > 0) {
    const match = rows.find(row => Math.abs(row.gaesoIndex - index) < 1e-4);
    if (match) return match.regFeeRate;
  }
  return fallback;
}
function ageSurcharge(age, surcharge21, surcharge24) {
  const label = age || '';
  return label.includes('21') ? Math.round(surcharge21 ?? 70000)
    : label.includes('24') ? Math.round(surcharge24 ?? 30000) : 0;
}
export function loanRental(s) {
  const price = s.vehiclePrice, months = s.term, undiscounted = s.depositVehiclePrice ?? price;
  const delivery = s.deliveryType || 'dealer';
  const kia = (s.brand || '').trim().startsWith('기아');
  const vehicleDiscount = delivery === 'special' ? s.vehicleSpecialDiscountRate : s.vehicleDealerDiscountRate;
  const dealerDiscount = vehicleDiscount ?? (delivery === 'special'
    ? kia ? s.specialDiscountRateKia ?? 0 : s.specialDiscountRate ?? 0
    : kia ? s.dealerDiscountRateKia ?? 0 : s.dealerDiscountRate ?? 0);
  const depositBase = s.depositBaseDiscounted ? price : undiscounted;
  const deposit = s.manualDepositAmount != null ? Math.round(s.manualDepositAmount) : Math.round(depositBase * (s.depositRate / 100));
  const index = s.gaesoIndex && s.gaesoIndex > 0 ? s.gaesoIndex : 0;
  const kiaConst = s.acqConstKia ?? -200000, normalConst = s.acqConstDefault ?? 300000;
  const specialKia = s.acqConstKiaSpecial ?? kiaConst, specialNormal = s.acqConstDefaultSpecial ?? normalConst;
  const regRate = registrationRate(index, s.gaesoRegRates, s.regFeeRate ?? 8.55) / 100;
  const regFixed = s.regFeeFixed ?? 77500;
  const supply5 = (s.commissionSupplyRate5 ?? 3) / 100, supply10 = (s.commissionSupplyRate10 ?? 4) / 100;
  const residualAdjustment = s.residualAdjust ?? -5, depositRatio = (s.depositPmtRatio ?? 50) / 100;
  const vat = 1 + (s.vatRate ?? 10) / 100;
  const commissionRate = s.commissionRate > 0 ? s.commissionRate / 100 : .025;
  const commission = Math.floor(price * commissionRate), commissionMonthly = months > 0 ? commission / months : 0;
  const residual = Math.round(price * ((s.residualRate + residualAdjustment) / 100));
  const depositCredit = deposit * depositRatio;
  const supply = Math.abs(s.depositRate - 5) <= Math.abs(s.depositRate - 10) ? supply5 : supply10;
  const supplyAmount = price * supply / vat;
  let acquisition = price;
  if (index > 0) {
    const beforeTax = price / index * vat;
    const isSpecial = delivery === 'special';
    const adjustment = kia ? isSpecial ? specialKia : kiaConst : isSpecial ? specialNormal : normalConst;
    const discount = beforeTax * (dealerDiscount / 100);
    const net = (beforeTax + adjustment - discount) / vat;
    const registration = net * regRate + regFixed;
    acquisition = net + registration;
  }
  const salesRate = s.salesFeeRate ?? 3;
  const salesAdjustment = (s.salesFeeBaseDiscounted ? price : undiscounted) * ((salesRate - supply * 100) / 100) / vat;
  const interest = s.productInterestRate / 100 / 12;
  const principal = -acquisition + depositCredit - supplyAmount - salesAdjustment;
  const future = residual / vat - depositCredit;
  const monthly = (months > 0 && interest > 0 ? payment(interest, months, principal, future) : 0) * vat;
  const tax = s.autoTax || 0, insurance = s.insurance || 0, other = s.etcCost || 0;
  const advanceMonthly = months > 0 ? (s.advancePayment || 0) / months : 0;
  const total = monthly + tax + insurance + other + commissionMonthly - advanceMonthly;
  return { monthlyTotal: Math.ceil(total / 100) * 100, pureRentalTotal: Math.round(monthly * months),
    autoTaxTotal: Math.round(tax * months), insuranceTotal: Math.round(insurance * months), etcTotal: Math.round(other * months),
    advancePaymentTotal: Math.round(s.advancePayment || 0), commissionMonthly: Math.round(commissionMonthly),
    commissionTotal: commission, depositAmount: deposit, residualValue: residual };
}
function miscellaneous(s) {
  return (s.miscAmount || 0) + (s.extraOptions || []).reduce((sum, item) => item.removed
    ? sum - (Number(item.baseline) || 0)
    : sum + Math.max(0, (Number(item.amount) || 0) - (Number(item.baseline) || 0)), 0);
}
function agencyCommission(price, rate, brand) {
  if (!rate || rate <= 0) return 0;
  const net = price / 1.1715, factor = brand.includes('기아') ? .75 : .65;
  return Math.round(net * rate * factor);
}
export function calculateKamatch(s) {
  const gross = s.vehiclePrice + s.optionPrice;
  const age = ageSurcharge(s.insuranceAge, s.insuranceSurcharge2123, s.insuranceSurcharge2425);
  const discount = s.discountAmount || 0, net = gross - discount;
  const misc = miscellaneous(s), salesRate = s.salesFeeRate ?? 3;
  const feeBase = s.salesFeeBaseDiscounted ? net : gross;
  const depositBase = s.depositBaseDiscounted ? net : gross;
  if (s.productInterestRate !== undefined && s.commissionRatePercent !== undefined && s.residualRatePercent !== undefined) {
    const advanceRate = s.advanceRate ?? 0;
    const advance = s.manualAdvanceAmount != null ? Math.round(s.manualAdvanceAmount) : advanceRate > 0 ? Math.round(gross * (advanceRate / 100)) : 0;
    const out = loanRental({ ...s, vehiclePrice: net, residualRate: s.residualRatePercent, advancePayment: advance,
      commissionRate: s.commissionRatePercent, autoTax: s.autoTaxYearly ?? 0, insurance: s.insuranceYearly ?? 0,
      etcCost: (s.etcCostTotal ?? 0) + (s.term > 0 ? misc / s.term : 0), depositVehiclePrice: gross });
    const monthly = out.monthlyTotal + age + Math.round(s.extraMonthlyFee ?? 0);
    return { monthlyRent: monthly, totalAcquisition: net, residualRate: s.residualRatePercent, residualValue: out.residualValue,
      depositAmount: out.depositAmount, depositRateActual: s.depositRate, advancePayment: advance, discountAmount: discount,
      miscAmount: misc, deliveryFee: out.depositAmount, vat: Math.floor(monthly * ((s.vatRate ?? 10) / 100)),
      commission: { agency: agencyCommission(gross, s.modelFeeRate ?? .07, s.brand ?? ''), sales: Math.floor(feeBase * (salesRate / 100)) } };
  }
  if (s.feeRatePercent !== undefined && s.feeRatePercent > 0) {
    const advanceRate = s.advanceRate ?? 0;
    const advance = s.manualAdvanceAmount != null ? Math.round(s.manualAdvanceAmount) : advanceRate > 0 ? Math.round(gross * (advanceRate / 100) / 100000) * 100000 : 0;
    const extraSales = Math.max(0, salesRate - 3), sales = Math.floor(net * (extraSales / 100));
    const principal = net + sales + misc - advance;
    const monthly = Math.round(principal * s.feeRatePercent / s.term / 1000) * 1000 + age + Math.round(s.extraMonthlyFee ?? 0);
    const deposit = s.manualDepositAmount != null ? Math.round(s.manualDepositAmount) : s.depositRate > 0 ? Math.round(depositBase * (s.depositRate / 100)) : 0;
    const residualRate = s.residualRatePercent !== undefined ? s.residualRatePercent : 60;
    return { monthlyRent: monthly, totalAcquisition: net, residualRate, residualValue: Math.floor(net * (residualRate / 100)),
      depositAmount: deposit, depositRateActual: s.depositRate, advancePayment: advance, discountAmount: discount, miscAmount: misc,
      deliveryFee: deposit, vat: Math.floor(monthly * ((s.vatRate ?? 10) / 100)),
      commission: { agency: agencyCommission(gross, s.modelFeeRate ?? .07, s.brand ?? ''), sales: Math.floor(feeBase * (salesRate / 100)) } };
  }
  let residualRatio = .6;
  if (s.residualRatePercent !== undefined) residualRatio = s.residualRatePercent / 100;
  else {
    switch (s.term) { case 24: residualRatio = .7; break; case 36: residualRatio = .65; break; case 48: residualRatio = .6; break; case 60: residualRatio = .55; break; default: residualRatio = .6; }
    if (typeof s.mileage === 'number') { if (s.mileage > 20000) residualRatio -= .03; if (s.mileage > 30000) residualRatio -= .05; }
    else residualRatio -= .1;
  }
  const residual = Math.floor(gross * residualRatio), advanceRate = s.advanceRate ?? 0;
  const advance = s.manualAdvanceAmount != null ? Math.round(s.manualAdvanceAmount) : advanceRate > 0 ? Math.round(gross * (advanceRate / 100) / 100000) * 100000 : 0;
  const deposit = s.manualDepositAmount != null ? Math.round(s.manualDepositAmount) : s.depositRate > 0 ? Math.round(depositBase * (s.depositRate / 100)) : 0;
  const agency = Math.floor(gross * ((s.agencyFeeRate ?? 4) / 100)), sales = Math.floor(feeBase * (salesRate / 100));
  const depreciation = net - residual + misc - advance;
  const interest = (net + residual) / 2 * .065 * (s.term / 12);
  const beforeVat = (depreciation + interest + agency + sales) / s.term + 150000 - 0;
  const tax = Math.floor(beforeVat * ((s.vatRate ?? 10) / 100));
  return { monthlyRent: Math.floor((beforeVat + tax) / 1000) * 1000 + age + Math.round(s.extraMonthlyFee ?? 0),
    totalAcquisition: net, residualRate: residualRatio * 100, residualValue: residual, depositAmount: deposit,
    depositRateActual: Math.round(s.depositRate * 10) / 10, advancePayment: advance, discountAmount: discount,
    miscAmount: misc, deliveryFee: deposit, vat: tax, commission: { agency, sales } };
}
