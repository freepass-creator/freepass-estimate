import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { resolveCanonicalIdentity } from '../src/lib/newcar/configuration-resolver.js';
import { calculateStandardQuote } from '../api/_standard/standard-service.js';
import { QUOTE_TERMS } from '../src/lib/quote/terms.js';

const ctx={window:{},console:{log(){},warn(){},error(){}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/vehicle-db.js','utf8'),ctx);
const db=ctx.window.VEHICLE_DB;

function findProduct(id){
  for(const mf of db.manufacturers||[])for(const md of mf.models||[])for(const v of md.variants||[]){
    const t=(v.trims||[]).find(x=>x.trim_id===id);
    if(t)return{mf,md,v,t};
  }
  throw new Error('product not found: '+id);
}

function req(id,credit='중신용'){
  const {mf,md,v,t}=findProduct(id);
  const canonical=resolveCanonicalIdentity(t,v.options_master||{},[]);
  const trimWon=Math.round(Number(t.base_price_5||0)*10000);
  return {
    버전:1,
    차:{
      종류:'신차',키:id,상품키:id,
      브랜드:mf.manufacturer_name,
      모델:md.model_name,
      파워트레인:v.variant_name,
      트림:[t.group,t.name].filter(Boolean).join(' '),
      배기량:v.displacement_cc||canonical?.candidate?.engine_cc||0,
      연료:v.fuel||v.variant_name,
      가격:{
        트림:trimWon,옵션:0,외장색:0,내장색:0,할인:0,표준계산차량가:trimWon,
        기준전:Number(t._price_before_won||0),
        기준후:Number(t._price_after_won||0),
        기준명:t._price_basis||'',
      },
      구성:{기본축:t._base_axes||{},canonical,선택옵션:[]},
    },
    조건:{
      신용:credit,주행:'2만km',정비:'웰스 Basic',대물:'1억',추가운전자:'없음',
      탁송비:250000,썬팅비:0,블박비:0,수수료율:3,
    },
    안들:QUOTE_TERMS.map((기간)=>({기간,보증금:0,선납:0})),
  };
}

const cases=[
  ['hybrid','kia_niro_하이브리드_시그니처'],
  ['ev','kia_ev3_전기_어스롱레인지'],
];
const allIds=[];
for(const mf of db.manufacturers||[])for(const md of mf.models||[])for(const v of md.variants||[])for(const t of v.trims||[])allIds.push(t.trim_id);
const grandeur=allIds.find(id=>/grandeur|그랜저/i.test(id));
if(grandeur)cases.push(['gasoline',grandeur]);

for(const [label,id] of cases){
  const request=req(id);
  const answer=await calculateStandardQuote(request);
  assert.equal(answer.결과.length,5,label+' result length');
  assert.equal(answer.pricingEngine?.verified,true,label+' engine evidence verified');
  assert.match(answer.pricingEngine?.version||'',/^freepass-standard\/newcar@1\.0\.0\+src\.[a-f0-9]{12}\.policy\.[a-f0-9]{12}$/,label+' engine version');
  for(const row of answer.결과){
    assert.ok(Number.isFinite(row.월대여료)&&row.월대여료>0,label+' monthly');
    assert.ok(Number.isFinite(row.보증금)&&row.보증금>=0,label+' deposit');
    assert.ok(Number.isFinite(row.인수가)&&row.인수가>0,label+' residual');
    assert.ok(Number.isFinite(row.총차량가)&&row.총차량가>0,label+' vehicle price');
  }
  assert.ok(answer.결과[4].월대여료 <= answer.결과[0].월대여료*1.25,
    label+' 60m monthly unexpectedly explodes');
  console.log('PASS STANDARD',label,id,JSON.stringify({
    months:answer.결과.map((x,i)=>[request.안들[i].기간,x.월대여료]),
    saleTaxCredit:answer.메타.saleTaxCredit,
    fuel:answer.메타.fuel,
    residual:answer.메타.residualRates,
  }));
}


{
  const id='kia_niro_하이브리드_시그니처';
  const base=req(id);
  const withInterior=structuredClone(base);
  withInterior.차.가격.내장색=500000;
  withInterior.차.가격.표준계산차량가+=500000;
  const normal=await calculateStandardQuote(base);
  const colored=await calculateStandardQuote(withInterior);
  assert.equal(colored.결과[0].총차량가-normal.결과[0].총차량가,500000,'interior color must be included in total vehicle price');
  assert.ok(colored.결과[0].월대여료>=normal.결과[0].월대여료,'paid interior color must not reduce monthly rent');
  console.log('PASS STANDARD interior-color pricing',JSON.stringify({
    base:normal.결과[0].총차량가,
    colored:colored.결과[0].총차량가,
  }));
}

// 신용 리스크는 잔가를 바꾸지 않고 월납 쪽으로만 반영되어야 한다.
{
  const id='kia_niro_하이브리드_시그니처';
  const normal=await calculateStandardQuote(req(id,'정상'));
  const low=await calculateStandardQuote(req(id,'저신용'));
  assert.deepEqual(normal.메타.residualRates,low.메타.residualRates,'credit must not change residual');
  const term48=QUOTE_TERMS.indexOf(48);
  assert.ok(low.결과[term48].월대여료>=normal.결과[term48].월대여료,'low credit should not be cheaper under turnover-risk defaults');
  console.log('PASS STANDARD credit-risk separation',JSON.stringify({
    normal48:normal.결과[term48].월대여료,low48:low.결과[term48].월대여료,
  }));
}

// 수소차는 정책 미확정 상태에서 가솔린처럼 조용히 계산하면 안 된다.
const nexo=allIds.find(id=>/nexo|넥쏘/i.test(id));
if(nexo){
  await assert.rejects(()=>calculateStandardQuote(req(nexo)),/수소차 표준 원가정책/);
  console.log('PASS STANDARD hydrogen fail-closed',nexo);
}

console.log('PASS FreePass standard new-car engine regression');
