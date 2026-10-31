import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { calculateKamatchScenario } from '../api/_kamatch/calculate.js';
import { createPriceBasis } from '../src/lib/quote/price-basis.js';
const root=fileURLToPath(new URL('../../../', import.meta.url));
const policy=JSON.parse(fs.readFileSync(root+'apps/new/api/_kamatch/policy.snapshot.json'));
const rows=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'docs/references/kamatch/catalog.snapshot.json.gz'))).rows;
if (!process.argv[2]) throw new Error('Pass the pinned public JS bundle path as the first argument; do not supply credentials.');
const source=fs.readFileSync(process.argv[2],'utf8');
if(createHash('sha256').update(source).digest('hex')!==policy.sourceBundleSha256)throw new Error('Pinned source bundle hash mismatch');
const pure=source.slice(source.indexOf('function Pm('),source.indexOf('const XE=',source.indexOf('function Pm(')));
const helperStart=source.indexOf('Cd=(L,Q,Ce,Je,mt)=>',710000);
const helper=source.slice(helperStart,source.indexOf(';function bh(',helperStart));
const activeStart=source.indexOf('const wt=[36,48,60],',helperStart);
const active=source.slice(activeStart,source.indexOf(';Y(ms)',activeStart));
if(!pure||!helper||!active)throw Error('Reference boundaries changed');
const script=new vm.Script(`(function(){${pure};const Oe=[vehicle],Ft=vehicle.brand,Ms=vehicle.model,zs=vehicle.lineup,ws=vehicle.trim,un=vehicle.vehicleType,We=policy.settings,Ee=We,vt=1+Ee.vatRate/100,pt=policy['commission-rates'],et=policy['residual-grade-rates'],ds=policy['residual-rates'],Re=policy['model-fee-rates'],Kt=policy['gaeso-reg-rates'],fn=form.salesFeeRate,Vs=4,de={getValues:()=>form,watch:()=>form};const ${helper};const L=de.getValues(),Q=hl(L),Ce=xh(L);${active};return ms.map(x=>({term:x.term,monthlyRent:Math.ceil(x.result.monthlyRent/100)*100}));})()`);
const context=vm.createContext({policy,Math});
let compared=0,vehicles=0,rejected=0;const mismatches=[];const exclusions=[];
const checkpoints=[];
for(const vehicle of rows){
 if(vehicle.visible===false)continue; if(!(Number(vehicle.gaesoIndex)>0)){exclusions.push({id:vehicle.id,reason:'GAESO_INDEX_MISSING'});continue;}
 vehicles++;
 let opts=[];try{opts=JSON.parse(vehicle.optionPrices||'[]');}catch{}
 const option=opts.find(o=>Number.isSafeInteger(o.price)&&o.price>0)?.price||0;
 for(const dep of [5,10,20,30])for(const km of [20000,30000])for(const pre of [0,10]){
  const optionPrice=(dep===20?option:0);
  const base=vehicle.price;
  if(!Number.isSafeInteger(base)||base<=0){rejected++;if(!exclusions.some(x=>x.id===vehicle.id))exclusions.push({id:vehicle.id,reason:'INVALID_BASE_PRICE',price:base});continue;}
  const form={vehiclePrice:base,optionPrice,term:48,depositRate:dep,manualDeposit:false,advanceRate:pre,manualAdvance:false,discountAmount:0,miscAmount:0,extraOptions:[],creditType:'low',deliveryType:'dealer',mileage:String(km),insuranceAge:dep===30?'만 21세 이상':'만 26세 이상',salesFeeRate:policy.settings.lowSalesFeeRate,cardPayment:false};
  Object.assign(context,{vehicle,form});
  const expected=script.runInContext(context,{timeout:1000});
  const priceBasis=createPriceBasis({productId:'TEST-'+vehicle.id,sourceRevision:'freepass-data/source-parity@r1',basePrice:base,optionPrice,exteriorColorPrice:0,interiorColorPrice:0,discount:0,totalVehiclePrice:base+optionPrice});
  for(const reference of expected){
   const conditions={termMonths:reference.term,creditType:'low',deliveryType:'dealer',depositPercent:dep,prepayPercent:pre,annualKm:String(km),insuranceAge:form.insuranceAge,salesFeeRate:form.salesFeeRate,extraOptions:[]};
   try{const result=calculateKamatchScenario({priceBasis,vehiclePolicy:vehicle,conditions,policy});compared++;if(result.monthlyRent!==reference.monthlyRent)mismatches.push({id:vehicle.id,dep,km,pre,optionPrice,term:reference.term,expected:reference.monthlyRent,actual:result.monthlyRent});}
   catch(e){rejected++;if(e.code!=='KAMATCH_POLICY_UNSUPPORTED')throw e;}
  }
 }
 if(vehicles%100===0)console.log(JSON.stringify({vehicles,compared,mismatches:mismatches.length}));
}
const summary={reference:'published browser multi-term source, executed as isolated pure equations; no authenticated requests or credentials',vehicles,validVehicles:compared/48,compared,rejected,exclusions,mismatches:mismatches.length,examples:mismatches.slice(0,8)};
fs.writeFileSync(root+'docs/references/kamatch/source-parity-report.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
if(mismatches.length)process.exitCode=1;
