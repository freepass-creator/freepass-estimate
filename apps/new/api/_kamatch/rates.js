// Exact selector semantics observed in the pinned Kamatch public app.
// No vehicle prices are imported from this provider into FreePass Data.
export const REQUIRED_TABLES = Object.freeze(['vehicles','fee-rates','commission-settings','model-fee-rates','commission-rates','residual-grade-rates','gaeso-reg-rates','residual-rates','supplies-prices']);
export function kamatchError(message, code = 'KAMATCH_REFERENCE_INVALID', status = 503) {
  return Object.assign(new Error(message), { code, status });
}
const SETTINGS_DEFAULTS = Object.freeze({ acqConstKia:-200000, acqConstDefault:300000, acqConstKiaSpecial:-200000, acqConstDefaultSpecial:300000,
  regFeeRate:8.55, regFeeFixed:77500, commissionSupplyRate5:3, commissionSupplyRate10:4, residualAdjust:-5, depositPmtRatio:50, vatRate:10,
  dealerDiscountRate:0, specialDiscountRate:0, dealerDiscountRateKia:0, specialDiscountRateKia:0,
  salesFeeBaseDiscounted:false, depositBaseDiscounted:false, insuranceSurcharge2123:70000, insuranceSurcharge2425:30000 });
function closest(value, choices) {
  return choices.includes(value) ? value : choices.reduce((best, next) => Math.abs(next-value)<Math.abs(best-value)?next:best,choices[0]);
}
export function validateReference(reference, expectedDigest) {
  if (reference?.schema !== 'kamatch-authenticated-reference/v1' || reference.source !== 'https://kamatch.kr' ||
      reference.application?.sha256 !== expectedDigest) throw kamatchError('카매치 앱과 요율 자료 버전이 일치하지 않습니다.');
  for (const name of REQUIRED_TABLES) {
    const table = reference.tables?.['/api/'+name];
    if (table == null || (name !== 'commission-settings' && name !== 'supplies-prices' && !Array.isArray(table))) throw kamatchError(`카매치 ${name} 원본 자료를 확인할 수 없습니다.`);
  }
  return reference;
}
export function resolveKamatchRates(reference, identity, { term, mileage, depositRate, creditType, deliveryType }) {
  const t = reference.tables;
  const settings = t['/api/commission-settings'];
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw kamatchError('카매치 계정 요율 설정을 확인할 수 없습니다.');
  const matches = t['/api/vehicles'].filter(v => ['brand','model','lineup','trim'].every(k=>v[k]===identity[k]));
  if (matches.length !== 1 || matches[0].visible === false) throw kamatchError('카매치 차량 매핑을 확인해 주세요.','KAMATCH_MAPPING_UNAVAILABLE',422);
  const vehicle = matches[0];
  const bucket = closest(depositRate,creditType==='general'?[0,5,10,20,30]:[5,10,20,30]);
  const interestRow = t['/api/commission-rates'].find(r=>r.creditType===creditType&&r.deliveryType===deliveryType&&r.depositRate===bucket);
  const productInterestRate = interestRow ? interestRow.rate : settings.productInterestRate;
  const commissionBucket = Math.abs(depositRate-5)<=Math.abs(depositRate-10)?5:10;
  const commissionKey = 'corpCommission'+(creditType==='low'?'Low':'General')+commissionBucket+(deliveryType==='special'?'Special':'');
  const commissionRatePercent = settings[commissionKey] ?? 0;
  const mileageValue = mileage==='무제한'?30000:Number(mileage)||30000;
  const mileageBucket = closest(mileageValue,[20000,30000]);
  const general = creditType==='general';
  const grade = (general?vehicle.residualGradeGeneral??vehicle.residualGrade:vehicle.residualGrade)||'A';
  const gradeRow = t['/api/residual-grade-rates'].find(r=>r.term===term&&r.mileage===mileageBucket&&r.grade===grade);
  const residualRatePercent = gradeRow ? gradeRow.rate : t['/api/residual-rates'].find(r=>r.vehicleType===identity.vehicleType&&r.term===term)?.rate;
  const modelFeeRate = t['/api/model-fee-rates'].find(r=>r.model===identity.model)?.rate;
  const creditField = key => general ? vehicle[key+'General']??vehicle[key] : vehicle[key];
  const insurance = creditField('insurance')??0;
  const periodCost = creditField('etcCost'+term)??0;
  const out = { ...Object.fromEntries(Object.entries(SETTINGS_DEFAULTS).map(([k,v])=>[k,settings[k]??v])),
    productInterestRate, commissionRatePercent, residualRatePercent, modelFeeRate,
    autoTaxYearly:creditField('autoTax')??0,
    insuranceYearly:insurance>0?insurance:settings.defaultInsurance??0,
    etcCostTotal:periodCost>0?periodCost:settings.defaultEtcCost??0,
    gaesoIndex:Number(creditField('gaesoIndex'))||0,
    vehicleDealerDiscountRate:null, vehicleSpecialDiscountRate:vehicle.specialDiscountRate??null,
    extraMonthlyFee:Number(mileage)>=30000?vehicle.extraMonthlyFee??0:0,
    gaesoRegRates:t['/api/gaeso-reg-rates'],
  };
  // A usable original rate must be present before this adapter can quote.
  for (const k of ['productInterestRate','commissionRatePercent','residualRatePercent','autoTaxYearly','insuranceYearly','etcCostTotal','gaesoIndex','extraMonthlyFee']) {
    if (!Number.isFinite(out[k])) throw kamatchError(`카매치 ${k} 원본 요율을 확인할 수 없습니다.`);
  }
  return out;
}
