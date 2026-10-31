import { encodeCommissionMark } from './_private/commission-mark.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST 만 받습니다.'});
  try{return res.status(200).json({ok:true,reference:encodeCommissionMark(req.body?.agentPoints)});}
  catch(error){return res.status(error.status||400).json({ok:false,code:error.code||'COMMISSION_MARK_INVALID',error:error.message});}
}
