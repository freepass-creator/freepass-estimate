import {PUBLIC_OFFERS} from '../../src/lib/quote/public-offers.js';
export function projectBenchmarkOffers(answer){
  const results=[answer?.standard,answer?.sources?.kamatch?.data,answer?.sources?.welrix?.data];
  const ready=[answer?.standard?.status==='DRAFT',answer?.sources?.kamatch?.ok===true,answer?.sources?.welrix?.ok===true];
  return PUBLIC_OFFERS.map((offer,i)=>({...offer,status:ready[i]&&Array.isArray(results[i]?.results)&&results[i].results.length?'ready':'unavailable',
    estimated:offer.id==='no-credit',results:ready[i]?(results[i]?.results||[]).map(row=>({월대여료:row.monthlyRent,보증금:row.deposit,선납금:row.prepay,인수가:row.acquirePrice,총차량가:row.totalCarPrice})):[],
    analysis:ready[i]?(offer.id==='no-credit'?results[i]?.calibration:results[i]?.inference)?.map(a=>a?{residualRate:a.residualRate,annualEffectiveRate:a.annualEffectiveRate}:null):[],
    priceComponents:ready[i]?results[i]?.priceComponents:null}));
}
