import {reactive} from 'vue';
import {요청만들기} from './build-request.js';
import {calculatePublicQuotes} from './benchmark.js';
import {PUBLIC_OFFERS} from './public-offers.js';
export const 표시견적=reactive({상태:'idle',결과:[],견적들:[],오류:'',서명:'',출처:'',가격구성:null,계산기:'freepass'});
let sequence=0,timer,controller;
export function 다시표시계산(){
  const current=++sequence;clearTimeout(timer);controller?.abort();
  표시견적.가격구성=null;표시견적.결과=[];표시견적.오류='';표시견적.서명='';
  표시견적.견적들=PUBLIC_OFFERS.map(offer=>({...offer,status:'pending',results:[]}));
  let request;
  try{request=요청만들기();}catch{표시견적.상태='error';표시견적.오류='견적 조건을 확인해 주세요.';return;}
  if(!request){표시견적.상태='idle';return;}
  const input=JSON.parse(JSON.stringify(request));표시견적.상태='pending';
  timer=setTimeout(async()=>{
    controller=new AbortController();
    try{
      const answer=await calculatePublicQuotes(input,{signal:controller.signal});
      if(current!==sequence)return;
      const offers=answer.offers,preferred=offers.find(offer=>offer.status==='ready');
      표시견적.견적들=offers;
      표시견적.결과=preferred?.results||[];표시견적.가격구성=preferred?.priceComponents||null;
      표시견적.출처='신차 장기렌트 견적';표시견적.서명=JSON.stringify(input);
      표시견적.상태=preferred?'ok':'error';표시견적.오류=preferred?'':'현재 견적을 조회할 수 없습니다. 잠시 후 다시 확인해 주세요.';
    }catch{
      if(current!==sequence)return;
      표시견적.견적들=PUBLIC_OFFERS.map(offer=>({...offer,status:'unavailable',results:[]}));
      표시견적.상태='error';표시견적.오류='현재 견적을 조회할 수 없습니다. 잠시 후 다시 확인해 주세요.';
    }
  },200);
}
