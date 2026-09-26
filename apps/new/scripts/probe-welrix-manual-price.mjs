import fs from 'node:fs';

const URL='https://welrixmobility.netlify.app/api/estimate';
const idx=JSON.parse(fs.readFileSync('public/data/freepass-newcar/product-index.json','utf8'));
const first=Object.entries(idx.products||{}).find(([,p])=>Array.isArray(p.providerCandidates)&&p.providerCandidates.length);
if(!first)throw new Error('provider candidate가 하나도 없습니다');
const [productId,p]=first;
const knownModel=p.providerCandidates[0].api_model;

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

console.log('KNOWN_PRODUCT',JSON.stringify({productId,knownModel}));
const known=await call('KNOWN_PROVIDER_PRICE',{
 model:knownModel,old:false,manualPrice:0,inputs:[baseInput]
});
if(!known.r.ok||!known.j?.ok||!known.j?.results?.[0]?.monthlyRent){
 throw new Error('known provider model probe failed');
}

const overridePrice=40000000;
const manual=await call('KNOWN_MODEL_FREEPASS_PRICE_OVERRIDE',{
 model:knownModel,old:false,manualPrice:overridePrice,inputs:[baseInput]
});
if(!manual.r.ok||!manual.j?.ok||!manual.j?.results?.[0]?.monthlyRent){
 throw new Error('MANUAL_PRICE_CAPABILITY=NOT_SUPPORTED');
}
if(Number(manual.j?.price)!==overridePrice){
 console.log(`MANUAL_PRICE_CAPABILITY=NOT_SUPPORTED expected=${overridePrice} reported=${manual.j?.price}`);
 console.log('PASS Welrix capability probe: provider does not honor FreePass manual price; Estimate adapter must remain fail-closed');
 process.exit(0);
}

console.log('MANUAL_PRICE_CAPABILITY=SUPPORTED_AND_ECHOED');
