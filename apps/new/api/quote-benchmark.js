import { fetchFreePassDataMaster } from './freepass-data-master.js';
import { canonicalizeQuoteRequestFromMaster } from './_master/authoritative-request.js';
import { createWelrixComparisonHandler } from './welrix-comparison.js';
import { createKamatchComparisonHandler } from './kamatch-comparison.js';
import { commissionFromConditions } from '../src/lib/quote/commission-policy.js';
import { analyzeQuote, standardFromBenchmarks } from './_standard/quote-inference.js';
async function invoke(handler,request) {
  const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
  await handler({method:'POST',body:{request}},res);
  return {ok:res.statusCode===200&&res.body?.ok===true,...(res.statusCode===200?{data:res.body}:{error:res.body?.error||'견적 조회 오류',code:res.body?.code})};
}
export function createQuoteBenchmarkHandler({loadMaster=fetchFreePassDataMaster,welrixLookup,kamatchLookup,loadReference,loadProfiles}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST 만 받습니다.'});
    try {
      const master=await loadMaster();
      const canonical=canonicalizeQuoteRequestFromMaster(req.body?.request,master);
      const request=canonical.request;
      const commission=commissionFromConditions(request.조건);
      if(!Array.isArray(request.안들)||request.안들.length<1||request.안들.length>5)throw new Error('견적 기간을 확인해 주세요.');
      const pinnedMaster=async()=>master;
      const lookup=(credit)=>({...request,조건:{...request.조건,신용:credit}});
      const [welrix,kamatch]=await Promise.all([
        welrixLookup?welrixLookup(lookup('중신용')):invoke(createWelrixComparisonHandler({loadMaster:pinnedMaster}),lookup('중신용')),
        kamatchLookup?kamatchLookup(lookup('저신용')):invoke(createKamatchComparisonHandler({loadMaster:pinnedMaster,loadReference,loadProfiles}),lookup('저신용')),
      ]);
      const costs=request.조건.비용;
      const upfrontCosts=['deliveryFee','tintFee','dashcamFee','naviFee','hipassFee'].reduce((sum,k)=>sum+Number(costs?.[k]||0),0);
      for (const source of [welrix,kamatch]) {
        if (!source.ok) continue;
        source.data.inference = request.안들.map((sc,i) => {
          try { const row=source.data.results[i];return analyzeQuote({vehiclePrice:canonical.priceBasis.totalVehiclePrice,months:sc.기간,monthlyRent:row.monthlyRent,acquirePrice:row.acquirePrice,deposit:row.deposit,prepay:row.prepay,commissionPoints:commission.totalPoints,upfrontCosts}); }
          catch { return null; }
        });
      }
      let standard={status:'BLOCKED',error:'웰릭스와 카매치의 같은 조건 견적을 조회한 뒤 표준 추정 견적을 계산합니다.'};
      if(welrix.ok&&kamatch.ok) {
        try {
          if([welrix,kamatch].some(s=>s.data.results.length!==request.안들.length||s.data.priceBasis?.sourceRevision!==canonical.priceBasis.sourceRevision))throw new Error('제휴 견적의 차량 데이터 기준이 다릅니다.');
          const rows=request.안들.map((sc,i)=>standardFromBenchmarks({price:canonical.priceBasis.totalVehiclePrice,term:sc.기간,depositPercent:sc.보증금,prepayPercent:sc.선납,commissionPoints:commission.totalPoints,upfrontCosts,
            sources:[{id:'welrix',row:welrix.data.results[i]},{id:'kamatch',row:kamatch.data.results[i]}]}));
          standard={status:'DRAFT',results:rows.map(r=>r.row),calibration:rows.map(r=>r.calibration),priceBasis:canonical.priceBasis,priceComponents:welrix.data.priceComponents};
        } catch(error){standard={status:'BLOCKED',error:error.message};}
      }
      return res.status(200).json({ok:true,mode:'THREE_QUOTE_BENCHMARK',sources:{welrix,kamatch},standard});
    } catch(error) {return res.status(error.status||503).json({ok:false,code:error.code||'QUOTE_BENCHMARK_UNAVAILABLE',error:error.message});}
  };
}
export default createQuoteBenchmarkHandler();
