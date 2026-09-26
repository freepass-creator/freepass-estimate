import fs from 'node:fs';
import vm from 'node:vm';
import { resolveCanonicalIdentity } from '../src/lib/newcar/configuration-resolver.js';
import { calculateStandardQuote } from '../api/_standard/standard-service.js';
import { createQuoteConditionCosts } from '../src/lib/quote/condition-cost-contract.js';

const ctx={window:{},console:{log(){},warn(){},error(){}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/vehicle-db.js','utf8'),ctx);
const db=ctx.window.VEHICLE_DB;

const failures=[];
const successes=[];
const byMaker={};
function addMaker(name,key){byMaker[name]||={total:0,ok:0,fail:0};byMaker[name].total++;byMaker[name][key]++}

for(const mf of db.manufacturers||[])for(const md of mf.models||[])for(const v of md.variants||[])for(const t of v.trims||[]){
  const canonical=resolveCanonicalIdentity(t,v.options_master||{},[]);
  const trimWon=Math.round(Number(t.base_price_5||0)*10000);
  const costs=createQuoteConditionCosts({deliveryFee:250000});
  const req={
    버전:1,
    차:{
      종류:'신차',키:t.trim_id,상품키:t.trim_id,
      브랜드:mf.manufacturer_name,모델:md.model_name,파워트레인:v.variant_name,
      트림:[t.group,t.name].filter(Boolean).join(' '),
      배기량:v.displacement_cc||canonical?.candidate?.engine_cc||0,
      연료:v.fuel||v.variant_name,
      가격:{
        트림:trimWon,옵션:0,외장색:0,내장색:0,할인:0,표준계산차량가:trimWon,
        기준전:Number(t._price_before_won||0),기준후:Number(t._price_after_won||0),기준명:t._price_basis||'',
      },
      구성:{기본축:t._base_axes||{},canonical,선택옵션:[]},
    },
    조건:{신용:'중신용',주행:'2만km',정비:'웰스 Basic',대물:'1억',추가운전자:'없음',탁송비:costs.deliveryFee,썬팅비:0,블박비:0,내비비:0,하이패스비:0,비용:costs,수수료율:3},
    안들:[{기간:48,보증금:0,선납:0}],
  };
  try{
    const ans=await calculateStandardQuote(req);
    const rent=ans?.결과?.[0]?.월대여료;
    if(!(Number.isFinite(rent)&&rent>0))throw new Error('월대여료가 유효하지 않습니다');
    successes.push({id:t.trim_id,maker:mf.manufacturer_name,model:md.model_name,variant:v.variant_name,trim:t.name,rent});
    addMaker(mf.manufacturer_name,'ok');
  }catch(e){
    failures.push({id:t.trim_id,maker:mf.manufacturer_name,model:md.model_name,variant:v.variant_name,trim:t.name,reason:e?.message||String(e)});
    addMaker(mf.manufacturer_name,'fail');
  }
}

const reasons={};
for(const x of failures)reasons[x.reason]=(reasons[x.reason]||0)+1;
console.log('=== STANDARD ENGINE FULL COVERAGE ===');
console.log(JSON.stringify({
  total:successes.length+failures.length,
  ok:successes.length,
  fail:failures.length,
  coverage:Math.round(successes.length*1000/(successes.length+failures.length))/10,
  byMaker,reasons
},null,2));
for(const x of failures.slice(0,120))console.log('FAIL '+JSON.stringify(x));

const rents=successes.map(x=>x.rent).sort((a,b)=>a-b);
console.log('RENT_DISTRIBUTION '+JSON.stringify({
  min:rents[0],p25:rents[Math.floor(rents.length*.25)],median:rents[Math.floor(rents.length*.5)],
  p75:rents[Math.floor(rents.length*.75)],max:rents[rents.length-1]
}));
