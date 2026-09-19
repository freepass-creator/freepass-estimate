const URL='https://welrixmobility.netlify.app/api/estimate';
const baseInput={
  credit:'중신용',termMonths:60,mileage:'2만km',
  optionPrice:0,stockDiscount:0,deliveryFee:0,tintFee:0,dashcamFee:0,
  deposit_pct:0,prepay_pct:0,liability:'1억',extraDriver:'없음',
  maintenance:'웰스 Basic',feeRate:0.05
};
async function call(name,body){
 const r=await fetch(URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const text=await r.text();
 let j=null;try{j=JSON.parse(text)}catch{}
 console.log(name,JSON.stringify({status:r.status,ok:r.ok,body:j||text.slice(0,500)}));
 return {r,j,text};
}
const known=await call('KNOWN',{
 model:'K5 2.0 HEV 노블레스',old:false,manualPrice:0,inputs:[baseInput]
});
const manual=await call('MANUAL_UNKNOWN',{
 model:'__FREEPASS_MANUAL_PRICE_PROBE__',old:false,manualPrice:40000000,inputs:[baseInput]
});
if(!known.r.ok)throw new Error('known model probe failed');
if(manual.r.ok&&manual.j?.ok&&manual.j?.results?.[0]?.monthlyRent){
 console.log('MANUAL_PRICE_CAPABILITY=SUPPORTED');
}else{
 console.log('MANUAL_PRICE_CAPABILITY=NOT_SUPPORTED');
}
