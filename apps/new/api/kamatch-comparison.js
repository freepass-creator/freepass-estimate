import { commissionFromConditions } from '../src/lib/quote/commission-policy.js';
import { authoritativeQuoteRequest } from './_master/authoritative-request.js';
import { calculateKamatchScenario } from './_kamatch/calculate.js';
import { kamatchError, validateReference } from './_kamatch/rates.js';
import { KAMATCH_APP_DIGEST, loadKamatchReference, loadKamatchProfiles, resolveKamatchProfile } from './_kamatch/reference.js';

export function createKamatchComparisonHandler({ loadMaster, loadReference = loadKamatchReference, loadProfiles = loadKamatchProfiles } = {}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST') return res.status(405).json({ok:false,error:'POST 만 받습니다'});
    try {
      const raw=req.body?.request;
      if(raw?.차?.종류!=='신차'||!Array.isArray(raw.안들)||raw.안들.length<1||raw.안들.length>5) throw kamatchError('카매치 견적 입력을 확인해 주세요.','KAMATCH_INPUT_INVALID',400);
      const canonical=await authoritativeQuoteRequest(raw,loadMaster?{loadMaster}:undefined);
      const reference=validateReference(await loadReference(),KAMATCH_APP_DIGEST);
      const profile=resolveKamatchProfile(await loadProfiles(),reference,canonical.request.차.상품키);
      const {차:car,조건:conditions,안들:scenarios}=canonical.request;
      if(conditions.정비!=='정비 제외'||conditions.대물!==profile.insuranceProperty||conditions.추가운전자!=='없음') throw kamatchError('카매치 보험·정비 공통 조건을 확인해 주세요.','KAMATCH_CONDITIONS_UNSUPPORTED',422);
      const commission=commissionFromConditions(conditions);
      const mileage=Number(String(conditions.주행).replace('만km',''))*10000;
      if(!Number.isFinite(mileage)||mileage<=0||!Number.isFinite(conditions.수수료율)||conditions.수수료율 < -10||conditions.수수료율>7) throw kamatchError('주행거리 또는 수수료를 확인해 주세요.','KAMATCH_INPUT_INVALID',400);
      const costs=conditions.비용;
      if(!costs||['deliveryFee','tintFee','dashcamFee','naviFee','hipassFee'].some(k=>!Number.isSafeInteger(costs[k])||costs[k]<0)) throw kamatchError('용품 비용을 확인해 주세요.','KAMATCH_COST_MAPPING_UNAVAILABLE',422);
      const extraOptions=['deliveryFee','tintFee','dashcamFee'].map(k=>({ amount:costs[k],baseline:profile.baselines[k],removed:costs[k]===0 }));
      const creditType=conditions.신용==='저신용'?'low':'general';
      const price=canonical.priceBasis;
      const vehicles=reference.tables['/api/vehicles'].filter(v=>['brand','model','lineup','trim'].every(k=>v[k]===profile[k]));
      if(vehicles.length!==1||vehicles[0].visible===false) throw kamatchError('차량 요율 매핑을 확인해 주세요.','KAMATCH_MAPPING_UNAVAILABLE',422);
      const vehiclePolicy={...vehicles[0],vehicleType:profile.vehicleType};
      const policy=Object.fromEntries(Object.entries(reference.tables).map(([k,v])=>[k.replace('/api/',''),v]));
      policy.settings=policy['commission-settings'];
      const results=scenarios.map(sc=>{
        if(![36,48,60].includes(sc.기간)||[sc.보증금,sc.선납].some(v=>!Number.isFinite(v)||v<0||v>30)) throw kamatchError('기간·보증금·선납금을 확인해 주세요.','KAMATCH_INPUT_INVALID',400);
        const result=calculateKamatchScenario({priceBasis:price,vehiclePolicy,policy,conditions:{
          termMonths:sc.기간,creditType,deliveryType:'dealer',depositPercent:sc.보증금,prepayPercent:sc.선납,
          annualKm:mileage,salesFeeRate:commission.totalPoints,insuranceAge:'만 26세 이상',
          miscAmount:costs.naviFee+costs.hipassFee,extraOptions}});
        const out={monthlyRent:result.monthlyRent,deposit:result.deposit,prepay:result.prepay,acquirePrice:result.residualAmount,totalCarPrice:price.totalVehiclePrice};
        if(Object.values(out).some(v=>!Number.isSafeInteger(v)||v<0)||out.totalCarPrice!==price.totalVehiclePrice) throw kamatchError('카매치 계산 결과를 확인할 수 없습니다.','KAMATCH_RESULT_INVALID',502);
        return out;
      });
      return res.status(200).json({ok:true,mode:'SOURCE_FORMULA_COMPARISON',source:'https://kamatch.kr/',calculatedAt:new Date().toISOString(),ratesCapturedAt:reference.capturedAt,applicationDigest:reference.application.sha256,
        priceBasis:price,priceComponents:{base:price.basePrice,options:price.optionPrice,exterior:price.exteriorColorPrice,interior:price.interiorColorPrice,discount:price.discount,items:car.구성.선택옵션.map(o=>({name:o.name,price:o.price_won}))},results});
    } catch(error) {
      return res.status(error.status||503).json({ok:false,code:error.code||'KAMATCH_UNAVAILABLE',error:error.code?error.message:'카매치 견적을 계산하지 못했습니다.'});
    }
  };
}
export default createKamatchComparisonHandler();
