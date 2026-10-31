// Read-only verification of the actual deployed user flow; no browser mocks.
import { defaultColorIndex } from '../src/lib/exterior-paint.js';
import { COMMISSION_POLICY, commissionForAgent, DEFAULT_AGENT_POINTS } from '../src/lib/quote/commission-policy.js';
import { QUOTE_REGION, QUOTE_DELIVERY_FEE, QUOTE_DELIVERY_BASIS } from '../src/lib/quote/launch-region.js';
import { createQuoteConditionCosts } from '../src/lib/quote/condition-cost-contract.js';
import { 웰릭스기본, 썬팅값, 블박값 } from '../src/lib/welrix-rates.js';
const base = new URL(process.env.BASE_URL || 'https://freepass-estimator.vercel.app/');
const evidence = { base:base.origin, checks:[], status:'BLOCKED' };
async function json(path, request) {
  const response = await fetch(new URL(path,base), { ...request, signal:AbortSignal.timeout(30000) });
  const body = await response.json().catch(()=>null);
  if (!response.ok || !body?.ok) throw Object.assign(new Error(body?.code || `HTTP_${response.status}`),{code:body?.code || `HTTP_${response.status}`,endpoint:path});
  return body;
}
try {
  const master = await json('/api/freepass-data-master');
  if (master.meta?.authority !== 'CANONICAL_ACTIVE') throw new Error('MASTER_AUTHORITY_INVALID');
  const car = master.data?.find(row => row.status === 'ACTIVE' && ['현대','기아','제네시스'].includes(row.maker));
  if (!car) throw new Error('NO_LAUNCH_VEHICLE_AVAILABLE');
  evidence.checks.push({ boundary:'canonical-master',status:'PASS',releaseId:master.meta.releaseId,activeCount:master.data.filter(row=>row.status==='ACTIVE').length });
  const basicColor = colors => {
    const index=defaultColorIndex(colors.map(color=>({price:color.price?.amount})));
    return index == null ? null : colors[index].colorId;
  };
  const costs=createQuoteConditionCosts({deliveryFee:QUOTE_DELIVERY_FEE,tintFee:썬팅값(웰릭스기본.tint),dashcamFee:블박값(웰릭스기본.blackbox),basis:{delivery:QUOTE_DELIVERY_BASIS,tint:'COMPAT_FIXED:루마 일반',dashcam:'COMPAT_FIXED:파인뷰 SF500'}});
  const request={차:{종류:'신차',키:car.productId,상품키:car.productId,가격:{할인:0},구성:{선택옵션:[],colorExtId:basicColor(car.exteriorColors),colorIntId:basicColor(car.interiorColors)}},
    조건:{신용:'중신용',주행:'2만km',정비:'정비 제외',대물:'1억',추가운전자:'없음',탁송지역:QUOTE_REGION,수수료정책:COMMISSION_POLICY,영업수수료P:DEFAULT_AGENT_POINTS,수수료율:commissionForAgent(DEFAULT_AGENT_POINTS).totalPoints,
      비용:costs,탁송비:costs.deliveryFee,썬팅비:costs.tintFee,블박비:costs.dashcamFee,내비비:0,하이패스비:0},안들:[36,48,60].map(기간=>({기간,보증금:0,선납:0}))};
  const answer=await json('/api/public-quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request})});
  for(const id of ['no-credit','income-check','credit-required']) {
    const offer=answer.offers?.find(row=>row.id===id);
    if(offer?.status!=='ready'||offer.results?.length!==3||offer.results.some(row=>!Number.isSafeInteger(row.월대여료)||row.월대여료<=0)) throw Object.assign(new Error('PUBLIC_OFFER_UNAVAILABLE'),{code:'PUBLIC_OFFER_UNAVAILABLE',offer:id});
    evidence.checks.push({boundary:id,status:'PASS',terms:3});
  }
  evidence.status='PASS';
} catch(error) {
  evidence.error={code:error.code || error.message,endpoint:error.endpoint || null,offer:error.offer || null};
  process.exitCode=2;
}
console.log(JSON.stringify(evidence,null,2));
