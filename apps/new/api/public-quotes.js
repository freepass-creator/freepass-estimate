import { withLaunchRegion } from '../src/lib/quote/launch-region.js';
import {createQuoteBenchmarkHandler} from './quote-benchmark.js';
import {projectBenchmarkOffers} from './_private/public-offers.js';
export function createPublicQuotesHandler(dependencies={}) {
  const benchmark=createQuoteBenchmarkHandler(dependencies);
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST 만 받습니다.'});
    const result={code:200,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
    await benchmark({ ...req, body: { ...req.body, request: withLaunchRegion(req.body?.request) } },result);
    if(result.code!==200||!result.body?.ok)return res.status(result.code).json({ok:false,code:'PUBLIC_QUOTE_UNAVAILABLE',error:'현재 견적을 조회할 수 없습니다. 잠시 후 다시 확인해 주세요.'});
    return res.status(200).json({ok:true,mode:'PUBLIC_QUOTE_OPTIONS',offers:projectBenchmarkOffers(result.body)});
  };
}
export default createPublicQuotesHandler();
