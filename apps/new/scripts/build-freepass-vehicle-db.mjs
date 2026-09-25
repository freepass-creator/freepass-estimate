import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const S=v=>String(v??'').trim();
const N=v=>S(v).toLowerCase().replace(/[\s·,()\[\]{}_\"'’”&+.-]/g,'');
const hash=v=>crypto.createHash('sha1').update(String(v)).digest('hex').slice(0,12);

const feed=JSON.parse(fs.readFileSync('public/data/freepass-newcar/current-feed.snapshot.json','utf8'));
const master=JSON.parse(fs.readFileSync('public/data/freepass-newcar/vehicle-trim-master.json','utf8'));
const aliases=JSON.parse(fs.readFileSync('public/data/freepass-newcar/model-aliases.json','utf8'));
const legacyWelrixMap=JSON.parse(fs.readFileSync('public/data/freepass-newcar/welrix-id-map.json','utf8')).map||{};
const providerPath=process.env.WELRIX_DB_PATH;
let providerDb={manufacturers:[]};
if(providerPath&&fs.existsSync(providerPath)){
  const ctx={window:{},console:{log(){},warn(){},error(){}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(providerPath,'utf8'),ctx);
  providerDb=ctx.window.VEHICLE_DB||providerDb;
}

const aliasToKo=new Map();
for(const [ko,arr] of Object.entries(aliases)) for(const a of [ko,...(arr||[])]) aliasToKo.set(N(a),ko);
const ko=v=>aliasToKo.get(N(v))||S(v);

const makerId={
  '현대':'hyundai','기아':'kia','제네시스':'genesis','르노':'renault',
  '쉐보레':'chevrolet','KG모빌리티':'kgm','KGM':'kgm'
};
const fuelWord=v=>{
  const s=S(v);
  if(/수소/.test(s))return'수소';
  if(/전기|electric|\bev\b/i.test(s))return'전기';
  if(/플러그인|phev/i.test(s))return'플러그인 하이브리드';
  if(/하이브리드|hev/i.test(s))return'하이브리드';
  if(/lpg|lpi/i.test(s))return'LPG';
  if(/디젤|diesel/i.test(s))return'디젤';
  if(/가솔린|gasoline|gdi/i.test(s))return'가솔린';
  return S(v).split('·')[0].trim();
};
const liter=v=>{const m=S(v).match(/(?:^|[^0-9.])([1-6]\.[0-9])(?![0-9])/);return m?Number(m[1]).toFixed(1):''};
const turbo=v=>/터보|turbo|t-gdi|[1-6]\.[0-9]t\b/i.test(S(v));
const driveClass=v=>{
  const s=S(v).toUpperCase();
  if(/AWD|4WD|4MATIC|4MOTION|XDRIVE|QUATTRO|HTRAC|사륜/.test(s))return'all';
  if(/FWD|전륜/.test(s))return'front';
  if(/RWD|후륜/.test(s))return'rear';
  if(/2WD/.test(s))return'two';
  return'';
};
const seat=v=>{const m=S(v).match(/(\d{1,2})\s*인승/);return m?Number(m[1]):null};
const cleanEngine=v=>S(v)
  .replace(/\s*·\s*\d{1,2}\s*인승/gi,'')
  .replace(/\s*·\s*(?:2WD|4WD|AWD|HTRAC)/gi,'')
  .replace(/\b(FWD|RWD|AWD|2WD|4WD|HTRAC)\b/gi,'')
  .replace(/([1-6]\.[0-9])T\b/gi,'$1 터보')
  .replace(/\s+/g,' ').trim();
const engineKey=v=>[fuelWord(v),liter(v),turbo(v)?'T':''].filter(Boolean).join('|');

const commonTrim={
 premium:'프리미엄',exclusive:'익스클루시브',calligraphy:'캘리그래피',honors:'아너스',
 trendy:'트렌디',signature:'시그니처',noblesse:'노블레스',prestige:'프레스티지',
 gravity:'그래비티',smart:'스마트',modern:'모던',inspiration:'인스퍼레이션',
 earth:'어스',air:'에어',light:'라이트',standard:'스탠다드',business:'비즈니스',
 black:'블랙',basic:'기본형'
};
const translate=v=>{
 let s=S(v);for(const [en,ko2] of Object.entries(commonTrim))s=s.replace(new RegExp(en,'gi'),ko2);return s;
};
const trimForms=v=>{
 const raw=translate(v);
 return new Set([
  raw,
  raw.replace(/\([^)]*(?:\d{1,2}\s*인승|밴|2WD|4WD|AWD|전자식\s*4WD|하이루프)[^)]*\)/gi,''),
  raw.replace(/\b(2WD|4WD|AWD|HTRAC)\b/gi,''),
  raw.replace(/\d{1,2}\s*인승/gi,'')
 ].map(N).filter(Boolean));
};
const rowForms=r=>new Set([r.trim,...(r.trim_aliases||[]),...(r.source_aliases||[])].flatMap(x=>[...trimForms(x)]));

function optionEffectName(name){
 const n=S(name);
 const sm=/^(\d{1,2})\s*인승(?:\b|\s|\(|$)/.exec(n);
 if(sm)return{axis:'seats',value:Number(sm[1])};
 if(/^(?:전자식\s*)?(?:AWD|4WD)\b/i.test(n)||/^HTRAC\b/i.test(n)||/^(?:듀얼\s*모터\s*)4WD\b/i.test(n))
   return{axis:'drivetrain',value:'all'};
 if(/^2WD\b/i.test(n))return{axis:'drivetrain',value:'two'};
 return null;
}
const rawOptions=r=>r.optionsMaster&&typeof r.optionsMaster==='object'?r.optionsMaster:{};
const availableRaw=r=>Array.isArray(r.availableOptions)?r.availableOptions:Object.keys(rawOptions(r));
const availableAxisEffects=r=>availableRaw(r).map(id=>optionEffectName(rawOptions(r)[id]?.name)).filter(Boolean);
const fixedAxes=r=>{
 const full=[r.fuel,r.body,r.sourceName,r.trim].filter(Boolean).join(' ');
 const effects=availableAxisEffects(r);
 const hasDriveOption=effects.some(x=>x.axis==='drivetrain');
 const hasSeatOption=effects.some(x=>x.axis==='seats');
 const explicitTrimDrive=driveClass(r.trim);
 const explicitTrimSeat=seat(r.trim);
 const sourceDrive=driveClass(r.sourceName||r.fuel);
 const sourceSeat=seat(r.fuel)||seat(r.body);
 let drivetrain=explicitTrimDrive||(!hasDriveOption?sourceDrive:'');
 let seats=explicitTrimSeat??(!hasSeatOption?sourceSeat:null);
 let body_configuration=/밴/.test(full)?(/1\s*인승/.test(full)?'1인승 밴':/2\s*인승/.test(full)?'2인승 밴':'밴'):'';
 if(!drivetrain&&hasDriveOption)drivetrain='two';
 if(seats==null&&hasSeatOption){
   for(const id of availableRaw(r)){
     const sub=S(rawOptions(r)[id]?.sub);
     const m=/(\d{1,2})\s*인승\s*기본/.exec(sub);
     if(m){seats=Number(m[1]);break}
   }
 }
 return{drivetrain,seats,body_configuration,hasDriveOption,hasSeatOption};
};
function refineBaseAxes(r,axes,candidates){
 const out={...axes};
 const effects=availableAxisEffects(r);
 const optionSeatValues=new Set(effects.filter(x=>x.axis==='seats').map(x=>Number(x.value)));
 const candidateSeats=[...new Set(candidates.map(c=>Number(c.seats)).filter(n=>Number.isFinite(n)&&n>0))];
 const full=[r.id,r.trim,r.body,r.sourceName,r.fuel].filter(Boolean).join(' ');

 // If seats are selectable options, the base seat count is the one candidate
 // not represented by any seat option (Sorento 5 base + 6/7 options, EV9 7 base + 6 option).
 if(out.seats==null&&axes.hasSeatOption&&candidateSeats.length){
   const remain=candidateSeats.filter(n=>!optionSeatValues.has(n));
   if(remain.length===1)out.seats=remain[0];
 }

 // Passenger vs van: no "밴" marker means the passenger configuration when
 // the same trim name exists in both passenger and 1/2-seat van families.
 if(!/밴/.test(full)){
   const bodies=[...new Set(candidates.map(c=>S(c.body_configuration)).filter(Boolean))];
   if(bodies.some(b=>/승용/.test(b))&&bodies.some(b=>/밴/.test(b)))out.body_configuration='승용';
   if(out.seats==null&&!axes.hasSeatOption){
     const low=candidateSeats.filter(n=>n<=2);
     const passenger=candidateSeats.filter(n=>n>2);
     if(low.length&&passenger.length===1)out.seats=passenger[0];
   }
 }

 return out;
}

const groupLabel=(r,axes)=>{
 const fixed=[];
 if(!axes.hasSeatOption){
   const st=seat(r.trim)||seat(r.fuel);
   if(st)fixed.push(st+'인승');
 }
 if(!axes.hasDriveOption){
   const d=driveClass(r.trim)||driveClass(r.fuel)||driveClass(r.sourceName);
   if(d==='all')fixed.push(/AWD/i.test([r.trim,r.fuel,r.sourceName].join(' '))?'AWD':'4WD');
   else if(d==='two')fixed.push('2WD');
 }
 const all=[r.trim,r.body,r.sourceName].join(' ');
 if(/하이루프/.test(all)&&!fixed.some(x=>/하이루프/.test(x)))fixed.unshift('하이루프');
 if(/밴/.test(all)&&!fixed.some(x=>/밴/.test(x)))fixed.unshift('밴');
 if(/렌터카|business|비즈니스/i.test(all))fixed.unshift('렌터카');
 if(/쿠페|coupe/i.test(all))fixed.unshift('쿠페');
 return [...new Set(fixed)].join(' ');
};
const displayTrim=(r,g)=>{
 let s=translate(r.trim)||'기본형';
 if(g){
   s=s.replace(/\([^)]*(?:\d{1,2}\s*인승|밴|2WD|4WD|AWD|전자식\s*4WD|하이루프)[^)]*\)\s*$/i,'').trim();
   if(!s)s='기본형';
 }
 return s;
};
const modelName=r=>ko(r.carType||r.sub_model)
  // Hybrid/Electric은 모델명이 아니라 파워트레인 축이다.
  .replace(/\s+(?:Hybrid|Electric|HEV|EV)$/i,'')
  .trim();
const modelCandidates=(r,name)=>{
 const want=N(name), sm=N(ko(r.sub_model));
 return master.records.filter(x=>x.market_status==='신차'&&x.usage_tier!=='blocked'&&S(x.maker)===S(r.maker)
   && [x.model,x.sub_model,x.generation_name,...(x.source_aliases||[])].map(N).filter(Boolean)
      .some(n=>n===want||n===sm||n.includes(want)||want.includes(n)||n.includes(sm)||sm.includes(n)));
};
const masterCandidates=(r,name,engine,trimName)=>{
 let xs=modelCandidates(r,name);
 const f=fuelWord(engine);
 if(f){const q=xs.filter(x=>fuelWord(x.fuel||x.powertrain)===f);if(q.length)xs=q}
 const l=liter(engine);
 if(l){const q=xs.filter(x=>{
   const xl=x.displacement_l?Number(x.displacement_l).toFixed(1):x.engine_cc?(Math.round(Number(x.engine_cc)/100)/10).toFixed(1):liter(x.powertrain);
   return !xl||xl===l;
 });if(q.length)xs=q}
 if(turbo(engine)){const q=xs.filter(x=>x.turbo===true||turbo(x.powertrain));if(q.length)xs=q}
 const forms=trimForms(trimName);
 return xs.map(x=>({
   trim_row_key:x.trim_row_key,master_id:x.master_id,powertrain_seq:x.powertrain_seq,trim_seq:x.trim_seq,
   sub_model:x.sub_model,powertrain:x.powertrain,trim:x.trim,fuel:x.fuel,engine_cc:x.engine_cc,
   displacement_l:x.displacement_l,turbo:x.turbo,drivetrain:x.drivetrain,seats:x.seats,
   body_configuration:x.body_configuration||'',usage_tier:x.usage_tier,
   trim_match:[...forms].some(f=>rowForms(x).has(f))
 }));
};

function providerCandidates(r,name,engine,trimName){
 const out=[];const seen=new Set();
 const wantMaker=S(r.maker),wantModel=N(name),forms=new Set(trimForms(trimName)),engineKeys=new Set([engineKey(engine)].filter(Boolean));
 const legacy=legacyWelrixMap[S(r.id)];
 if(legacy?._label){
   const parts=legacy._label.split('|').map(S);
   if(parts[2])engineKeys.add(engineKey(parts[2]));
   if(parts[3])for(const x of trimForms(parts[3]))forms.add(x);
 }
 for(const mf of providerDb.manufacturers||[]){
  if(S(mf.manufacturer_name)!==wantMaker)continue;
  for(const md of mf.models||[]){
   const mn=N(md.model_name);
   const legacyModel=legacy?._label?N(legacy._label.split('|').map(S)[1]):'';
   if(!(mn===wantModel||mn.includes(wantModel)||wantModel.includes(mn)||legacyModel===mn))continue;
   for(const v of md.variants||[]){
    const vek=engineKey(v.variant_name||v.fuel);
    if(engineKeys.size&&![...engineKeys].some(k=>k===vek||(!liter(k)&&fuelWord(k)===fuelWord(vek))))continue;
    for(const t of v.trims||[]){
      const tf=trimForms(t.name);
      const match=[...forms].some(x=>tf.has(x));
      if(!match)continue;
      const key=t.trim_id;
      if(seen.has(key))continue;seen.add(key);
      out.push({
        api_model:t.trim_id,label:[md.model_name,v.variant_name,t.group,t.name].filter(Boolean).join(' · '),
        group:t.group||'',drivetrain:driveClass(t.group||t._welrixModel||''),seats:seat(t.group||t._welrixModel||''),
        price_won:Number(t._priceWon||((t.base_price_5||t.base_price||0)*10000)),
        trim_match:true
      });
    }
   }
  }
 }
 return out;
}
function supplementEngine(r,name,raw){
 let engine=cleanEngine(raw);
 if(liter(engine)||fuelWord(engine)==='전기'||fuelWord(engine)==='수소')return engine;
 let xs=modelCandidates(r,name);
 const f=fuelWord(engine);
 if(f){const q=xs.filter(x=>fuelWord(x.fuel||x.powertrain)===f);if(q.length)xs=q}
 const labels=[...new Set(xs.map(x=>cleanEngine(x.powertrain)).filter(Boolean))];
 return labels.length===1?labels[0]:engine;
}

const colorHex=name=>{
 const n=S(name).toLowerCase();
 if(/black|블랙|검정/.test(n))return'#1f2227';
 if(/white|화이트|크리미|아이보리|펄/.test(n))return'#f1f1ed';
 if(/silver|실버/.test(n))return'#b8bec5';
 if(/gray|grey|그레이|회색/.test(n))return'#707780';
 if(/blue|블루|남색|네이비/.test(n))return'#405b73';
 if(/red|레드|빨강/.test(n))return'#8b3a36';
 if(/green|그린|녹색/.test(n))return'#53675a';
 if(/brown|브라운/.test(n))return'#6f5649';
 if(/beige|베이지|샌드/.test(n))return'#b9aa90';
 if(/yellow|옐로|노랑/.test(n))return'#d0ae4c';
 return'#d9dde1';
};
const colorObj=c=>{
 if(typeof c==='string')return{name:c,code:c,hex:colorHex(c),price:0,_price_won:0};
 const price=Number(c?.price||0);
 return{name:S(c?.name)||S(c?.label),code:S(c?.code)||S(c?.name)||'color',hex:S(c?.hex)||colorHex(c?.name),price:price/10000,_price_won:price,ok:c?.ok};
};
const uniqColors=arr=>{
 const m=new Map();for(const c of arr.map(colorObj).filter(x=>x.name)){
  const k=N(c.name);const prev=m.get(k);if(!prev||c._price_won>prev._price_won)m.set(k,c);
 }return [...m.values()];
};
const optionRef=(ref,om)=>{
 if(om[ref])return ref;
 const n=N(ref);return Object.keys(om).find(id=>N(om[id]?.name)===n)||null;
};

const manufacturers=new Map();
function ensureMfr(name){
 const id=makerId[name]||('mf_'+hash(name));
 if(!manufacturers.has(name))manufacturers.set(name,{manufacturer_id:id,manufacturer_name:name,models:new Map()});
 return manufacturers.get(name);
}
function ensureModel(mfr,name){
 const id='md_'+hash(mfr.manufacturer_name+'|'+name);
 if(!mfr.models.has(name))mfr.models.set(name,{model_id:id,model_name:name,category:'',year:null,variants:new Map(),exterior_colors:[],_interior:[]});
 return mfr.models.get(name);
}
function ensureVariant(model,engine,r){
 const id='pt_'+hash(model.model_name+'|'+engine);
 if(!model.variants.has(id))model.variants.set(id,{
   variant_id:id,variant_name:engine,vehicle_type:'',fuel:fuelWord(engine),
   displacement_cc:0,transmission:'',trims:[],options_master:{},exclusive_groups:[],option_excludes:{}
 });
 const v=model.variants.get(id);
 const cands=masterCandidates(r,model.model_name,engine,r.trim);
 const ccs=[...new Set(cands.map(x=>Number(x.engine_cc)||0).filter(Boolean))];
 if(ccs.length===1)v.displacement_cc=ccs[0];
 else if(!v.displacement_cc&&liter(engine))v.displacement_cc=Math.round(Number(liter(engine))*1000);
 return v;
}
function mergeOptionRow(v,r,productId){
 const om=rawOptions(r);const idMap={};
 for(const [rawId,o] of Object.entries(om)){
   const id='o_'+hash(productId+'|'+rawId);idMap[rawId]=id;
   const price=Number(o?.price||0)/10000;
   v.options_master[id]={
     name:S(o?.name)||rawId,price,sub:S(o?.sub),
     ...(Array.isArray(o?.requires)&&o.requires.length?{requires:o.requires.map(x=>optionRef(x,om)).filter(Boolean).map(x=>'o_'+hash(productId+'|'+x))}:{})
   };
 }
 if(!Object.keys(om).length&&Array.isArray(r.options)){
   for(const o of r.options){
     const rawId='flat_'+hash(S(o?.name)+'|'+Number(o?.price||0));
     const id='o_'+hash(productId+'|'+rawId);idMap[rawId]=id;
     v.options_master[id]={name:S(o?.name),price:Number(o?.price||0)/10000,sub:''};
   }
 }
 const rawAvail=Array.isArray(r.availableOptions)?r.availableOptions:(Object.keys(om).length?Object.keys(om):Object.keys(idMap));
 const implied=(Array.isArray(r.impliedOptions)?r.impliedOptions:[]).map(x=>idMap[x]).filter(Boolean);
 const impliedSet=new Set(implied);
 const available=rawAvail.map(x=>idMap[x]).filter(Boolean).filter(id=>!impliedSet.has(id));

 for(const g of Array.isArray(r.exclusiveGroups)?r.exclusiveGroups:[]){
   const members=(g.members||[]).map(x=>idMap[x]).filter(Boolean);
   if(members.length<2)continue;
   v.exclusive_groups.push({id:'g_'+hash(productId+'|'+S(g.id||g.label)),label:S(g.label)||'택1',members});
 }
 for(const [rawId,arr] of Object.entries(r.optionExcludes||{})){
   const id=idMap[rawId];if(!id)continue;
   const vals=(arr||[]).map(x=>idMap[x]).filter(Boolean);if(vals.length)v.option_excludes[id]=vals;
 }
 return{available,implied,idMap};
}

const productIndex={};
for(const r of feed.rows||[]){
 const maker=S(r.maker);if(!maker)continue;
 const mfr=ensureMfr(maker);
 const name=modelName(r)||ko(r.sub_model);
 const model=ensureModel(mfr,name);
 const engine=supplementEngine(r,name,r.fuel||r.fuelRaw);
 const variant=ensureVariant(model,engine,r);
 const axes0=fixedAxes(r);
 const group0=groupLabel(r,axes0);
 const trimName0=displayTrim(r,group0);
 const opt=mergeOptionRow(variant,r,S(r.id));
 const ext=uniqColors(r.extColors||[]),intc=uniqColors(r.intColors||[]);
 model.exterior_colors=uniqColors([...model.exterior_colors,...ext]);
 model._interior=[...new Set([...model._interior,...intc.map(x=>x.name)])];
 const ccands=masterCandidates(r,name,engine,trimName0);
 const axes=refineBaseAxes(r,axes0,ccands);
 const group=groupLabel(r,axes);
 const trimName=displayTrim(r,group);
 const pcands=providerCandidates(r,name,engine,trimName);
 const before=Number(r.priceBefore||0),after=Number(r.priceAfter||0);
 const current=before||after;
 const t={
   trim_id:S(r.id),name:trimName,seats:axes.seats??0,
   base_price_5:current/10000,base_price_3_5:current/10000,
   engine, fuel_economy:{combined:0},standard_features:[],available_options:opt.available,
   group:group||undefined,_groupOrder:0,operating:current>0,
   _product_id:S(r.id),_price_before_won:before,_price_after_won:after,_price_basis:S(r.priceBasis),
   _base_axes:{drivetrain:axes.drivetrain,seats:axes.seats,body_configuration:axes.body_configuration},
   _axis_option_ids:opt.available.filter(id=>optionEffectName(variant.options_master[id]?.name)),
   _implied_options:opt.implied,_exterior_colors:ext,_interior_colors:intc,
   _canonical_candidates:ccands,_provider_candidates:pcands,
   _source:{maker,sub_model:S(r.sub_model),carType:S(r.carType),fuel:S(r.fuel),body:S(r.body),sourceName:S(r.sourceName),trim:S(r.trim)}
 };
 variant.trims.push(t);
 productIndex[t.trim_id]={
   maker,model:name,engine,trim:trimName,group,
   baseAxes:t._base_axes,
   canonicalCandidates:ccands,
   providerCandidates:pcands,
   availableOptions:t.available_options,
   axisOptionIds:t._axis_option_ids
 };
}
for(const mf of manufacturers.values())for(const md of mf.models.values())for(const v of md.variants.values()){
 const gm=new Map();for(const g of v.exclusive_groups){const k=g.id;if(!gm.has(k))gm.set(k,g)}
 v.exclusive_groups=[...gm.values()];
 v.trims.sort((a,b)=>(a._groupOrder||0)-(b._groupOrder||0)||a.base_price_5-b.base_price_5||a.name.localeCompare(b.name,'ko'));
}

const out={manufacturers:[...manufacturers.values()].map(m=>({
 manufacturer_id:m.manufacturer_id,manufacturer_name:m.manufacturer_name,
 models:[...m.models.values()].map(md=>({
   ...md,variants:[...md.variants.values()],
   exterior_colors:md.exterior_colors.length?md.exterior_colors:[{name:'색상 정보 없음',code:'unknown',hex:'#d9dde1',price:0}]
 }))
}))};
const meta={source:'freepasserp4/new_car_trim',data_as_of:feed.data_as_of,product_count:(feed.rows||[]).length,generated_at:new Date().toISOString()};
const js='/* AUTO-GENERATED from FreePass new_car_trim snapshot '+(feed.data_as_of||'')+'. DO NOT EDIT. */\n'
  +'window.VEHICLE_DB='+JSON.stringify(out)+';\n'
  +'window.__FREEPASS_NEW_CAR_META='+JSON.stringify(meta)+';\n';
fs.writeFileSync('public/vehicle-db.js',js);
fs.writeFileSync('public/welrix-db.js',js);
fs.writeFileSync('public/data/freepass-newcar/product-index.json',JSON.stringify({v:1,data_as_of:feed.data_as_of,count:Object.keys(productIndex).length,products:productIndex},null,2)+'\n');

const models=out.manufacturers.reduce((n,m)=>n+m.models.length,0);
const variants=out.manufacturers.flatMap(m=>m.models).reduce((n,m)=>n+m.variants.length,0);
const trims=out.manufacturers.flatMap(m=>m.models).flatMap(m=>m.variants).reduce((n,v)=>n+v.trims.length,0);
const providerReady=Object.values(productIndex).filter(x=>x.providerCandidates.length>0).length;
const canonicalReady=Object.values(productIndex).filter(x=>x.canonicalCandidates.length>0).length;
console.log(JSON.stringify({manufacturers:out.manufacturers.length,models,variants,trims,canonicalCandidateCoverage:canonicalReady,providerCandidateCoverage:providerReady}));
