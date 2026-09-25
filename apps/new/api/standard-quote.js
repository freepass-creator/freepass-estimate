import { QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT } from '../src/lib/quote/contracts.js';
import { calculateStandardQuote } from './_standard/standard-service.js';
import { authoritativeQuoteRequest } from './_master/authoritative-request.js';

function bad(res,status,error,code=null){
  res.status(status).json({ok:false,error,...(code?{code}:{})});
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Headers','content-type');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  if(req.method==='OPTIONS'){res.status(204).end();return}
  if(req.method!=='POST')return bad(res,405,'POST 만 받습니다','METHOD_NOT_ALLOWED');

  try{
    const authoritative=await authoritativeQuoteRequest(req.body);
    const answer=await calculateStandardQuote(authoritative.request);
    res.status(200).json({
      ok:true,
      contract:QUOTE_RESULT_CONTRACT,
      providerContract:QUOTE_PROVIDER_CONTRACT,
      ...answer,
      priceBasis:authoritative.priceBasis,
    });
  }catch(e){
    const requestedStatus=Number(e?.status);
    const status=Number.isInteger(requestedStatus)&&requestedStatus>=400&&requestedStatus<=599
      ? requestedStatus
      : 422;
    res.status(status).json({
      ok:false,
      error:e?.message||'표준 견적을 계산할 수 없습니다',
      code:e?.code||'STANDARD_QUOTE_INVALID',
    });
  }
}
