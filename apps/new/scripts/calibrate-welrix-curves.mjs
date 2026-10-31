// Read-only controlled supplier-formula experiments, never manufacturer price facts.
import {writeFile} from 'node:fs/promises';
import {fitPriceCurve} from '../api/_standard/quote-inference.js';
const endpoint='https://welrixmobility.netlify.app/api/estimate';
const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
const model=args.includes('--model')?value('--model'):'디 올 뉴 아반떼 2.0 가솔린 Modern';
const terms=[36,48,60],agentPoints=[0,2.5,5];
function input(term,agent){return{credit:'중신용',termMonths:term,mileage:'2만km',optionPrice:0,stockDiscount:0,deliveryFee:0,tintFee:0,dashcamFee:0,etcFee:0,deposit_pct:.1,prepay_pct:.05,liability:'1억',extraDriver:'없음',maintenance:'웰스 Self',feeRate:(1+agent)/100}}
async function quote(price,agent){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,old:price>0,manualPrice:price,inputs:terms.map(t=>input(t,agent))}),signal:AbortSignal.timeout(15000)});const b=await r.json();if(!r.ok||!b.ok||b.model!==model||!Array.isArray(b.results)||b.results.length!==3||(price>0&&b.price!==price))throw new Error('원본 가격/조건 응답 확인 실패');return b;}
const baseline=await quote(0,2.5),base=baseline.price;
const prices=[base-1000000,base,base+1000000,base+500000,base+1500000];
if(prices.some(p=>p<=0))throw new Error('실험 가격 범위를 확인해 주세요.');
const curves=[];
for(const agent of agentPoints){
 const observations=[];
 // Small bounded batches; no quote save or issuance endpoints are used.
 for(let i=0;i<prices.length;i+=2){observations.push(...await Promise.all(prices.slice(i,i+2).map(p=>quote(p,agent))));}
 for(let termIndex=0;termIndex<terms.length;termIndex++){
  const samples=observations.map(q=>({price:q.price,monthlyRent:q.results[termIndex].monthlyRent,acquirePrice:q.results[termIndex].acquirePrice}));
  const curve=fitPriceCurve(samples.slice(0,3),{commissionPoints:1+agent,depositRate:.1,prepayRate:.05,months:terms[termIndex]});
  const holdout=samples.slice(3).map(s=>({price:s.price,actualMonthly:s.monthlyRent,predictedMonthly:curve.slope*s.price+curve.monthlyFixedIntercept,errorWon:curve.slope*s.price+curve.monthlyFixedIntercept-s.monthlyRent}));
  curves.push({model,agentPoints:agent,totalCommissionPoints:1+agent,...curve,holdout,maxHoldoutErrorWon:Math.max(...holdout.map(r=>Math.abs(r.errorWon)))});
 }
}
const report={schema:'welrix-price-sensitivity-calibration/v1',capturedAt:new Date().toISOString(),source:endpoint,mode:'READ_ONLY_FORMULA_EXPERIMENT_NOT_OPERATIONAL_QUOTE',manufacturerPriceEvidence:false,conditions:{credit:'중신용',mileage:'2만km',maintenance:'정비 제외',liability:'1억',depositPercent:10,prepayPercent:5},requestCount:16,curves};
if(args.includes('--out'))await writeFile(value('--out'),JSON.stringify(report,null,2),{mode:0o600});
console.log(JSON.stringify({mode:report.mode,sourceModel:model,curves:curves.map(c=>({term:c.months,agentPoints:c.agentPoints,residualPct:c.residualSlope*100,annualYieldPct:c.annualEffectiveRate*100,fixedMonthly:Math.round(c.monthlyFixedIntercept),maxHoldoutErrorWon:c.maxHoldoutErrorWon})),lenderIrrIdentified:false},null,2));
