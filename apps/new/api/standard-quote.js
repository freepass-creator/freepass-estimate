import { calculateStandardQuote } from './_standard/standard-service.js';

function bad(res,status,error){
  res.status(status).json({ok:false,error});
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Headers','content-type');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  if(req.method==='OPTIONS'){res.status(204).end();return}
  if(req.method!=='POST')return bad(res,405,'POST 만 받습니다');

  try{
    const answer=await calculateStandardQuote(req.body);
    res.status(200).json({ok:true,...answer});
  }catch(e){
    res.status(422).json({ok:false,error:e?.message||'표준 견적을 계산할 수 없습니다'});
  }
}
