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
          가격:{옵션:0,외장색:0,할인:0},
          구성:{기본축:products[productId]?.baseAxes||{},선택옵션:[]},
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
let outbound=null;
globalThis.fetch=async (_url,opts)=>{
  outbound=JSON.parse(opts.body);
  return {
    ok:true,status:200,
    async json(){return {ok:true,price:outbound.manualPrice||0,results:[{
      monthlyRent:777000,deposit:0,prepay:0,acquirePrice:0,totalCarPrice:0,payFee:0,
    }]}}
  };
};

try{
  const [supportedId,supportedMeta]=supported;
  const res1=makeRes();
  await handler(makeReq(supportedId),res1);
  assert.equal(res1.state.statusCode,200);
  assert.equal(res1.state.body?.ok,true);
  assert.equal(res1.state.body?.contract,QUOTE_RESULT_CONTRACT);
  assert.equal(res1.state.body?.providerContract,QUOTE_PROVIDER_CONTRACT);
  assert.ok(outbound?.model,'Welrix API model must be translated');
  assert.notEqual(outbound.model,supportedId,'FreePass product id must not leak as Welrix model key');
  assert.ok((supportedMeta.providerCandidates||[]).some(c=>c.api_model===outbound.model),
    'translated model must come from provider candidates');

  outbound=null;
  const [ev3Id]=ev3;
  assert.equal((products[ev3Id]?.providerCandidates||[]).length,0,'EV3 fixture must currently be unsupported by Welrix');
  const res2=makeRes();
  await handler(makeReq(ev3Id),res2);
  assert.equal(res2.state.statusCode,422);
  assert.equal(res2.state.body?.code,'PROVIDER_UNSUPPORTED');
  assert.equal(outbound,null,'unsupported product must not call upstream provider');

  console.log('PASS provider routing — supported product translated; EV3 exits as explicit unsupported without upstream call');
} finally {
  globalThis.fetch=originalFetch;
}
