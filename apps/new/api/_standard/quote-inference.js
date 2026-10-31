// Inference from observable quote cashflows. This is an all-in implied yield;
// the lender's financing IRR additionally requires actual acquisition/service costs.
function invalid(message) { return Object.assign(new Error(message), {code:'STANDARD_INFERENCE_INVALID',status:422}); }
function amount(v,name) { if(!Number.isFinite(v)||v<0)throw invalid(`${name} 금액을 확인해 주세요.`);return v; }
export function financialBasis({vehiclePrice,deposit,prepay,commissionPoints,upfrontCosts=0,monthlyCosts=0,acquisitionCost=vehiclePrice}) {
  [vehiclePrice,deposit,prepay,upfrontCosts,monthlyCosts,acquisitionCost].forEach((v,i)=>amount(v,['차량가','보증금','선납금','초기비용','월비용','취득비용'][i]));
  if(vehiclePrice<=0||!Number.isFinite(commissionPoints)||commissionPoints<0||commissionPoints>6)throw invalid('차량가격과 수수료를 확인해 주세요.');
  const commission=vehiclePrice*commissionPoints/100;
  const principal=acquisitionCost+commission+upfrontCosts-deposit-prepay;
  if(principal<=0)throw invalid('초기 금융 원금이 0 이하입니다.');
  return {principal,monthlyCosts,commission,acquisitionCost,upfrontCosts,deposit,prepay,vehiclePrice,commissionPoints};
}
export function monthlyPayment(rate,months,principal,terminal) {
  if(!Number.isFinite(rate)||rate<=-1||!Number.isInteger(months)||months<1||months>120)throw invalid('기간 또는 수익률을 확인해 주세요.');
  if(Math.abs(rate)<1e-14)return(principal-terminal)/months;
  const growth=Math.pow(1+rate,months);
  return rate*(principal*growth-terminal)/(growth-1);
}
function pv(rate,months,monthly,terminal) {
  let value=-0,discount=1;
  for(let m=1;m<=months;m++){discount/=1+rate;value+=monthly*discount;}
  return value+terminal*discount;
}
export function inferMonthlyRate({months,principal,monthly,terminal}) {
  if(!Number.isInteger(months)||months<1||months>120||principal<=0||monthly<=0||!Number.isFinite(terminal)||monthly+terminal<0)throw invalid('현금흐름에서 단일 수익률을 구할 수 없습니다.');
  let low=-.95,high=5;
  if(pv(low,months,monthly,terminal)<principal||pv(high,months,monthly,terminal)>principal)throw invalid('수익률 탐색 범위를 벗어났습니다.');
  for(let i=0;i<180;i++) { const mid=(low+high)/2;if(pv(mid,months,monthly,terminal)>principal)low=mid;else high=mid; }
  return(low+high)/2;
}
export function analyzeQuote({months,monthlyRent,acquirePrice,...input}) {
  const basis=financialBasis(input);
  const monthly=amount(monthlyRent,'월 렌트료')-basis.monthlyCosts;
  const terminal=amount(acquirePrice,'만기 인수가')-basis.deposit;
  const rate=inferMonthlyRate({months,principal:basis.principal,monthly,terminal});
  return {classification:input.costBasisVerified===true?'COST_ASSUMPTION_IRR':'ALL_IN_QUOTE_IMPLIED_YIELD',
    residualRate:acquirePrice/basis.vehiclePrice,monthlyRate:rate,annualNominalRate:rate*12,annualEffectiveRate:Math.pow(1+rate,12)-1,
    assumptions:{basis:'GROSS_KRW_CASHFLOWS',commissionPaidUpfront:true,depositRefundedAtEnd:true,prepayReceivedUpfront:true,monthlyCosts:basis.monthlyCosts,acquisitionCost:basis.acquisitionCost,upfrontCosts:basis.upfrontCosts},
    reconstructedMonthly:monthlyPayment(rate,months,basis.principal,terminal)+basis.monthlyCosts};
}
export function standardFromBenchmarks({price,term,depositPercent,prepayPercent,commissionPoints,upfrontCosts=0,sources}) {
  if(!Array.isArray(sources)||sources.length<2)throw invalid('두 제휴 견적을 조회한 뒤 표준 추정 견적을 계산합니다.');
  for(const source of sources)if(source.row?.totalCarPrice!==price)throw invalid('제휴 견적의 차량가격이 서로 다릅니다.');
  const analyses=sources.map(({id,row})=>({id,...analyzeQuote({vehiclePrice:price,months:term,monthlyRent:row.monthlyRent,acquirePrice:row.acquirePrice,deposit:row.deposit,prepay:row.prepay,commissionPoints,upfrontCosts})}));
  const monthlyRate=analyses.reduce((sum,a)=>sum+a.monthlyRate,0)/analyses.length;
  const residualRate=analyses.reduce((sum,a)=>sum+a.residualRate,0)/analyses.length;
  const deposit=Math.round(price*depositPercent/100),prepay=Math.round(price*prepayPercent/100),acquirePrice=Math.round(price*residualRate);
  const basis=financialBasis({vehiclePrice:price,deposit,prepay,commissionPoints,upfrontCosts});
  const monthlyRaw=monthlyPayment(monthlyRate,term,basis.principal,acquirePrice-deposit);
  if(!Number.isFinite(monthlyRaw)||monthlyRaw<=0)throw invalid('표준 추정 월 렌트료를 확인해 주세요.');
  return {row:{monthlyRent:Math.ceil(monthlyRaw/100)*100,deposit,prepay,acquirePrice,totalCarPrice:price},
    calibration:{method:'EQUAL_WEIGHT_QUOTE_IMPLIED_YIELD_AND_RESIDUAL/v1',status:'DRAFT_SAME_CONFIGURATION',monthlyRate,residualRate,annualEffectiveRate:Math.pow(1+monthlyRate,12)-1,roundingWon:100,analyses,
      scope:'CURRENT_CANONICAL_CONFIGURATION_ONLY',lenderIrrIdentified:false}};
}

export function fitPriceCurve(samples,{commissionPoints,depositRate,prepayRate,acquisitionFactor=1,months}) {
  if(!Array.isArray(samples)||samples.length<3)throw invalid('가격 민감도 추정에는 3개 이상 관측점이 필요합니다.');
  const mean=key=>samples.reduce((sum,s)=>sum+s[key],0)/samples.length;
  const x=mean('price'),y=mean('monthlyRent'),r=mean('acquirePrice');
  const denominator=samples.reduce((sum,s)=>sum+(s.price-x)**2,0);
  if(denominator<=0)throw invalid('서로 다른 차량가격 관측점이 필요합니다.');
  const slope=samples.reduce((sum,s)=>sum+(s.price-x)*(s.monthlyRent-y),0)/denominator;
  const residualSlope=samples.reduce((sum,s)=>sum+(s.price-x)*(s.acquirePrice-r),0)/denominator;
  const intercept=y-slope*x,residualIntercept=r-residualSlope*x;
  const principal=acquisitionFactor+commissionPoints/100-depositRate-prepayRate;
  const terminal=residualSlope-depositRate;
  const monthlyRate=inferMonthlyRate({months,principal,monthly:slope,terminal});
  const errors=samples.map(s=>slope*s.price+intercept-s.monthlyRent);
  return {classification:'PRICE_SLOPE_IMPLIED_YIELD',months,slope,monthlyFixedIntercept:intercept,residualSlope,residualIntercept,monthlyRate,annualEffectiveRate:Math.pow(1+monthlyRate,12)-1,
    acquisitionFactorAssumption:acquisitionFactor,lenderIrrIdentified:false,sampleCount:samples.length,maxFitErrorWon:Math.max(...errors.map(Math.abs)),trainingRange:{min:Math.min(...samples.map(s=>s.price)),max:Math.max(...samples.map(s=>s.price))}};
}
