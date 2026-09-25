import { QUOTE_REQUEST_CONTRACT, QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT } from '../src/lib/quote/contracts.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const idx=JSON.parse(fs.readFileSync(new URL('../public/data/freepass-newcar/product-index.json',import.meta.url),'utf8'));
const products=idx.products||{};

const supported=Object.entries(products).find(([,p])=>(p.providerCandidates||[]).length===1)
  || Object.entries(products).find(([,p])=>(p.providerCandidates||[]).length>0);
assert.ok(supported,'provider-supported product required');

const ev3=Object.entries(products).find(([id,p])=>/ev3/i.test(id+' '+p.model));
assert.ok(ev3,'EV3 product required in FreePass product master');

const [{default:handler}]=await Promise.all([
  import('../api/external-quote.js'),
]);

const [supportedId,supportedMeta]=supported;
const [ev3Id]=ev3;

function masterRecord(productId){
  return {
    productId,
    status:'ACTIVE',
    basePrice:{amount:30000000,currency:'KRW'},
    priceBefore:{amount:30000000,currency:'KRW'},
    priceAfter:{amount:30000000,currency:'KRW'},
    priceBasis:'기준가',
    options:[],
    exteriorColors:[{colorId:'ext_test',name:'화이트',price:{amount:0,currency:'KRW'}}],
    interiorColors:[{colorId:'int_test',name:'블랙',price:{amount:0,currency:'KRW'}}],
  };
}
const masterPayload={
  data:[masterRecord(supportedId),masterRecord(ev3Id)],
  meta:{
    contract:'estimate-newcar-master/v1',
    authority:'CANONICAL_ACTIVE',
    projectionId:'estimate-newcar-master',
    schemaVersion:'1.0.0',
    releaseId:'rel_provider_test',
    manifestId:'manifest_provider_test',
    revision:1,
    inputDigest:'a'.repeat(64),
    dataDigest:'b'.repeat(64),
    generatedAt:'2026-09-25T00:00:00.000Z',
    activatedAt:'2026-09-25T00:01:00.000Z',
  },
};

function makeReq(productId){
  return {
    method:'POST',
    body:{
      kind:'excel',
      adapterId:'welrix',
      request:{
        계약:QUOTE_REQUEST_CONTRACT,
        버전:1,
        차:{
          종류:'신차',
          키:productId,
          상품키:productId,
          가격:{트림:1,옵션:1,외장색:1,내장색:1,할인:0,표준계산차량가:4},
          구성:{
            기본축:products[productId]?.baseAxes||{},
            colorExtId:'ext_test',
            colorIntId:'int_test',
            선택옵션:[],
          },
        },
        조건:{
          신용:'중신용',주행:'2만km',정비:'웰스 Basic',대물:'1억',추가운전자:'없음',
          탁송비:0,썬팅비:0,블박비:0,수수료율:5,
        },
        안들:[{기간:60,보증금:0,선납:0}],
      },
    },
  };
}
function makeRes(){
  const state={statusCode:200,body:null,headers:{}};
  return {
    state,
    setHeader(k,v){state.headers[k]=v},
    status(n){state.statusCode=n;return this},
    json(v){state.body=v;return this},
    end(){return this},
  };
}

const originalFetch=globalThis.fetch;
const originalBase=process.env.FREEPASS_DATA_CONSUMER_BASE_URL;
const originalToken=process.env.FREEPASS_DATA_ESTIMATE_TOKEN;
process.env.FREEPASS_DATA_CONSUMER_BASE_URL='https://freepass-data.test';
process.env.FREEPASS_DATA_ESTIMATE_TOKEN='t'.repeat(32);

let outbound=null;
let upstreamEngineProof=null;
globalThis.fetch=async (url,opts)=>{
  if(String(url).startsWith('https://freepass-data.test/')){
    return {ok:true,status:200,async json(){return masterPayload}};
  }
  outbound=JSON.parse(opts.body);
  return {
    ok:true,status:200,
    async json(){return {ok:true,price:outbound.manualPrice,...(upstreamEngineProof?{pricingEngine:upstreamEngineProof}:{}),results:[{
      monthlyRent:777000,deposit:0,prepay:0,acquirePrice:0,totalCarPrice:99999999,payFee:0,
    }]}}
  };
};

try{
  const res1=makeRes();
  await handler(makeReq(supportedId),res1);
  assert.equal(res1.state.statusCode,200);
  assert.equal(res1.state.body?.ok,true);
  assert.equal(res1.state.body?.contract,QUOTE_RESULT_CONTRACT);
  assert.equal(res1.state.body?.providerContract,QUOTE_PROVIDER_CONTRACT);
  assert.deepEqual(res1.state.body?.pricingEngine,{
    id:'welrix-excel',
    version:'welrix-excel/v6.1',
    evidence:'ADAPTER_PIN_ONLY',
    verified:false,
  });
  assert.ok(outbound?.model,'Welrix API model must be translated');
  assert.notEqual(outbound.model,supportedId,'FreePass product id must not leak as Welrix model key');
  assert.ok((supportedMeta.providerCandidates||[]).some(c=>c.api_model===outbound.model),
    'translated model must come from provider candidates');
  assert.equal(outbound.manualPrice,30000000,'provider must receive FreePass Data canonical base price');
  assert.equal(res1.state.body?.vehiclePrice,30000000,'canonical configured price must remain ours');
  assert.equal(res1.state.body?.results?.[0]?.totalCarPrice,30000000,
    'provider-reported totalCarPrice must not replace FreePass canonical total');

  upstreamEngineProof={
    contract:'welrix-pricing-engine-evidence/v1',
    id:'welrix-excel',
    version:'welrix-excel/v6.1',
    verified:true,
  };
  const resVerified=makeRes();
  await handler(makeReq(supportedId),resVerified);
  assert.deepEqual(resVerified.state.body?.pricingEngine,{
    id:'welrix-excel',
    version:'welrix-excel/v6.1',
    evidence:'UPSTREAM_CONTRACT',
    verified:true,
    upstreamVersion:'welrix-excel/v6.1',
  });
  upstreamEngineProof=null;

  outbound=null;
  assert.equal((products[ev3Id]?.providerCandidates||[]).length,0,'EV3 fixture must currently be unsupported by Welrix');
  const res2=makeRes();
  await handler(makeReq(ev3Id),res2);
  assert.equal(res2.state.statusCode,422);
  assert.equal(res2.state.body?.code,'PROVIDER_UNSUPPORTED');
  assert.equal(outbound,null,'unsupported product must not call upstream provider');

  console.log('PASS provider routing — FreePass Data price authority + translated provider formula; unsupported stays explicit');
} finally {
  globalThis.fetch=originalFetch;
  if(originalBase===undefined) delete process.env.FREEPASS_DATA_CONSUMER_BASE_URL;
  else process.env.FREEPASS_DATA_CONSUMER_BASE_URL=originalBase;
  if(originalToken===undefined) delete process.env.FREEPASS_DATA_ESTIMATE_TOKEN;
  else process.env.FREEPASS_DATA_ESTIMATE_TOKEN=originalToken;
}
