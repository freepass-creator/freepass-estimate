import fs from 'node:fs';

const S=v=>String(v??'').trim();
const N=v=>S(v).toLowerCase().replace(/[\s·,()\[\]{}_\"'’”&+.-]/g,'');
const feed=JSON.parse(fs.readFileSync('public/data/freepass-newcar/current-feed.snapshot.json','utf8'));
const master=JSON.parse(fs.readFileSync('public/data/freepass-newcar/vehicle-trim-master.json','utf8'));
const aliases=JSON.parse(fs.readFileSync('public/data/freepass-newcar/model-aliases.json','utf8'));

const aliasToKo=new Map();
for(const [ko,arr] of Object.entries(aliases)) for(const a of [ko,...(arr||[])]) aliasToKo.set(N(a),ko);
const koModel=v=>aliasToKo.get(N(v))||S(v);

const fuelOf=v=>{
  const s=S(v);
  if(/수소/.test(s))return'수소';
  if(/전기|electric|\bev\b/i.test(s))return'전기';
  if(/플러그인|phev/i.test(s))return'플러그인 하이브리드';
  if(/하이브리드|hev/i.test(s))return'하이브리드';
  if(/lpg|lpi/i.test(s))return'LPG';
  if(/디젤|diesel/i.test(s))return'디젤';
  if(/가솔린|gasoline|gdi/i.test(s))return'가솔린';
  return'';
};
const literOf=v=>{
  const m=S(v).match(/(?:^|[^0-9.])([1-6]\.[0-9])(?![0-9])/);
  return m?Number(m[1]).toFixed(1):'';
};
const driveOf=v=>{
  const s=S(v).toUpperCase();
  if(/AWD|4WD|4MATIC|4MOTION|XDRIVE|QUATTRO|사륜/.test(s))return'all';
  if(/FWD|전륜/.test(s))return'front';
  if(/RWD|후륜/.test(s))return'rear';
  if(/2WD/.test(s))return'two';
  return'';
};
const seatOf=v=>{const m=S(v).match(/(\d{1,2})\s*인승/);return m?Number(m[1]):null};
const turboOf=v=>/터보|turbo|t-gdi|[1-6]\.[0-9]t\b/i.test(S(v));

const trans={
  premium:'프리미엄',exclusive:'익스클루시브',calligraphy:'캘리그래피',honors:'아너스',
  trendy:'트렌디',signature:'시그니처',noblesse:'노블레스',prestige:'프레스티지',
  gravity:'그래비티',smart:'스마트',modern:'모던',inspiration:'인스퍼레이션',
  earth:'어스',air:'에어',light:'라이트',standard:'스탠다드',business:'비즈니스',
  black:'블랙',basic:'기본형'
};
const trimForms=v=>{
  const raw=S(v);
  let translated=raw;
  for(const [en,ko] of Object.entries(trans)) translated=translated.replace(new RegExp(en,'gi'),ko);
  const forms=[
    raw,translated,
    translated.replace(/\([^)]*(인승|밴|2WD|4WD|AWD)[^)]*\)/gi,''),
    translated.replace(/\b(2WD|4WD|AWD|HTRAC)\b/gi,''),
    translated.replace(/\d{1,2}\s*인승/gi,''),
  ];
  return new Set(forms.map(N).filter(Boolean));
};
const rowForms=r=>new Set([r.trim,...(r.trim_aliases||[]),...(r.source_aliases||[])].flatMap(x=>[...trimForms(x)]));

const current=master.records.filter(r=>r.market_status==='신차'&&r.usage_tier!=='blocked');
const byMaker=new Map();
for(const r of current){if(!byMaker.has(r.maker))byMaker.set(r.maker,[]);byMaker.get(r.maker).push(r)}

const result={};
const unresolved=[];
let exact=0,alias=0,powertrain=0;

for(const p of feed.rows||[]){
  const maker=S(p.maker);
  const productModel=koModel(p.sub_model||p.carType);
  const full=[p.sub_model,p.carType,p.fuel,p.body,p.sourceName,p.trim].filter(Boolean).join(' ');
  const f=fuelOf(p.fuel||full);
  const l=literOf(p.fuel||full);
  const d=driveOf(p.sourceName||full);
  const seats=seatOf(p.body||full);
  const turbo=turboOf(p.fuel||full);
  const pForms=trimForms(p.trim);

  let rows=(byMaker.get(maker)||[]).filter(r=>{
    const names=[r.model,r.sub_model,r.generation_name,r.development_code,...(r.source_aliases||[])].map(N).filter(Boolean);
    const want=N(productModel);
    if(!want) return false;
    return names.some(x=>x===want||(x.length>=2&&x.includes(want))||(x.length>=2&&want.includes(x)));
  });
  if(f) rows=rows.filter(r=>!fuelOf(r.fuel||r.powertrain)||fuelOf(r.fuel||r.powertrain)===f);
  if(l){
    const filtered=rows.filter(r=>{
      const rl=r.displacement_l?Number(r.displacement_l).toFixed(1):r.engine_cc?(Math.round(Number(r.engine_cc)/100)/10).toFixed(1):literOf(r.powertrain);
      return !rl||rl===l;
    });
    if(filtered.length)rows=filtered;
  }
  if(turbo){
    const filtered=rows.filter(r=>r.turbo===true||turboOf(r.powertrain));
    if(filtered.length)rows=filtered;
  }
  if(seats!=null){
    const filtered=rows.filter(r=>Number(r.seats)===seats);
    if(filtered.length)rows=filtered;
  }
  if(d==='all'){
    const filtered=rows.filter(r=>driveOf(r.drivetrain)==='all');
    if(filtered.length)rows=filtered;
  }else if(d==='front'||d==='rear'){
    const filtered=rows.filter(r=>driveOf(r.drivetrain)===d);
    if(filtered.length)rows=filtered;
  }
  if(/밴/.test(full)){
    const filtered=rows.filter(r=>/밴/.test(S(r.body_configuration))||Number(r.seats)<=2||(r.source_aliases||[]).some(x=>/밴/.test(x)));
    if(filtered.length)rows=filtered;
  }
  if(/쿠페|coupe/i.test(full)){
    const filtered=rows.filter(r=>/쿠페|coupe/i.test([r.sub_model,r.generation_name,...(r.source_aliases||[])].join(' ')));
    if(filtered.length)rows=filtered;
  }

  let hits=rows.filter(r=>[...pForms].some(x=>rowForms(r).has(x)));
  if(hits.length===1){
    const r=hits[0];
    const isExact=N(r.trim)===N(p.trim);
    if(isExact)exact++;else alias++;
    result[p.id]={
      identity_level:'trim',trim_row_key:r.trim_row_key,master_id:r.master_id,
      powertrain_seq:r.powertrain_seq,trim_seq:r.trim_seq,
      maker:r.maker,model:r.model,sub_model:r.sub_model,powertrain:r.powertrain,trim:r.trim,
      fuel:r.fuel,engine_cc:r.engine_cc,displacement_l:r.displacement_l,turbo:r.turbo,
      drivetrain:r.drivetrain,seats:r.seats,body_configuration:r.body_configuration||null,
      match:isExact?'exact':'alias'
    };
    continue;
  }

  const groups=new Map();
  for(const r of rows){
    const k=[r.master_id,r.powertrain_seq,r.sub_model,r.powertrain,r.drivetrain,r.seats,r.body_configuration||''].join('|');
    if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);
  }
  if(groups.size===1&&rows.length){
    const r=rows[0];powertrain++;
    result[p.id]={
      identity_level:'powertrain',trim_row_key:null,master_id:r.master_id,powertrain_seq:r.powertrain_seq,trim_seq:null,
      maker:r.maker,model:r.model,sub_model:r.sub_model,powertrain:r.powertrain,trim:null,
      fuel:r.fuel,engine_cc:r.engine_cc,displacement_l:r.displacement_l,turbo:r.turbo,
      drivetrain:r.drivetrain,seats:r.seats,body_configuration:r.body_configuration||null,
      product_configuration:p.trim,match:'powertrain'
    };
    continue;
  }

  unresolved.push({id:p.id,maker,product_model:productModel,fuel:p.fuel,body:p.body||'',sourceName:p.sourceName||'',trim:p.trim,
    candidate_count:rows.length,candidates:rows.slice(0,8).map(r=>({key:r.trim_row_key,sub_model:r.sub_model,powertrain:r.powertrain,trim:r.trim,drive:r.drivetrain,seats:r.seats}))});
}

const artifact={
 schema_version:1,generated_at:new Date().toISOString(),feed_data_as_of:feed.data_as_of,master_data_as_of:master.data_as_of,
 stats:{total:(feed.rows||[]).length,mapped:Object.keys(result).length,unresolved:unresolved.length,trim_exact:exact,trim_alias:alias,powertrain},
 by_product_id:result,unresolved
};
fs.writeFileSync('public/data/freepass-newcar/product-canonical-map.json',JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact.stats));
console.log('unresolved sample');
for(const x of unresolved.slice(0,30))console.log(JSON.stringify(x));
