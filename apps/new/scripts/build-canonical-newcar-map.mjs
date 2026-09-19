import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = process.cwd();
const masterPath = process.env.MASTER_PATH || path.resolve(root, '../../.master-reference/public/data/vehicle-trim-master.json');
const dbPath = process.env.WELRIX_DB_PATH || path.resolve(root, 'public/welrix-db.js');
const outPath = process.env.OUT_PATH || path.resolve(root, 'public/data/canonical-newcar-map.json');

const master = JSON.parse(fs.readFileSync(masterPath,'utf8'));
const ctx={window:{},console:{log(){},warn(){},error(){}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dbPath,'utf8'),ctx);
const db=ctx.window.VEHICLE_DB;

const S=v=>String(v??'').trim();
const clean=v=>S(v).toLowerCase().replace(/[\s·,()\[\]{}_\"'’”&+.-]/g,'');
const fuelWord=v=>{
  const s=S(v);
  if(/수소/.test(s))return'수소';
  if(/전기|\bEV\b/i.test(s))return'전기';
  if(/플러그인|PHEV/i.test(s))return'플러그인하이브리드';
  if(/하이브리드|HEV/i.test(s))return'하이브리드';
  if(/LPG|LPi/i.test(s))return'LPG';
  if(/디젤/i.test(s))return'디젤';
  if(/가솔린|GDI/i.test(s))return'가솔린';
  return'';
};
const liter=v=>{
  const m=S(v).match(/(?:^|[^0-9.])([1-6]\.[0-9])(?![0-9])/);
  return m?Number(m[1]).toFixed(1):'';
};
const driveClass=v=>{
  const s=S(v).toUpperCase();
  if(/AWD|4WD|4MATIC|4MOTION|XDRIVE|QUATTRO|사륜/.test(s))return'all';
  if(/FWD|전륜/.test(s))return'front';
  if(/RWD|후륜/.test(s))return'rear';
  if(/2WD/.test(s))return'two';
  return'';
};
const commonTrim={
  premium:'프리미엄',exclusive:'익스클루시브',calligraphy:'캘리그래피',honors:'아너스',
  trendy:'트렌디',signature:'시그니처',noblesse:'노블레스',prestige:'프레스티지',
  gravity:'그래비티',smart:'스마트',modern:'모던',inspiration:'인스퍼레이션',
  earth:'어스',air:'에어',light:'라이트',black:'블랙',business:'비즈니스',
  standard:'스탠다드',special:'스페셜',basic:'기본형'
};
const trimForms=v=>{
  const raw=S(v);
  const lower=raw.toLowerCase();
  const translated=Object.entries(commonTrim).reduce((s,[en,ko])=>s.replace(new RegExp(en,'gi'),ko),raw);
  const noDrive=translated.replace(/\b(2WD|4WD|AWD|HTRAC)\b/ig,'');
  const noSeat=noDrive.replace(/\d{1,2}\s*인승/g,'');
  const noGroup=noSeat.replace(/\b(일반|렌터카|선구매|해치백|쿠페|밴)\b/g,'');
  return new Set([raw,translated,noDrive,noSeat,noGroup,commonTrim[lower]||''].map(clean).filter(Boolean));
};
const groupAxes=g=>{
  const s=S(g);
  const seat=/(\d{1,2})\s*인승/.exec(s)?.[1];
  return {
    seats:seat?Number(seat):null,
    drive:driveClass(s),
    van:/밴/.test(s),
    rental:/렌터카|business|비즈니스/i.test(s),
    coupe:/쿠페|coupe/i.test(s),
  };
};
const rowForms=r=>{
  const vals=[r.trim,...(r.trim_aliases||[]),...(r.source_aliases||[])];
  const set=new Set();
  for(const v of vals) for(const f of trimForms(v)) set.add(f);
  return set;
};
const axesKey=r=>{
  const f=fuelWord(r.fuel||r.powertrain);
  const l=r.displacement_l?Number(r.displacement_l).toFixed(1):r.engine_cc?(Math.round(Number(r.engine_cc)/100)/10).toFixed(1):liter(r.powertrain);
  return {fuel:f,liter:l,drive:driveClass(r.drivetrain),seats:r.seats==null?null:Number(r.seats),body:S(r.body_configuration)};
};

const active=master.records.filter(r=>r.market_status==='신차'&&r.usage_tier!=='blocked');
const byMakerModel=new Map();
for(const r of active){
  const k=S(r.maker)+'|'+S(r.model);
  if(!byMakerModel.has(k))byMakerModel.set(k,[]);
  byMakerModel.get(k).push(r);
}

const by_trim_id={};
const unresolved=[];
let total=0, exact=0, alias=0, uniqueAxis=0;
const duplicateTrimIds=new Map();

for(const mf of db.manufacturers||[]) for(const md of mf.models||[]) for(const v of md.variants||[]) for(const t of v.trims||[]){
  total++;
  const key=S(t.trim_id);
  duplicateTrimIds.set(key,(duplicateTrimIds.get(key)||0)+1);
  const fullLabel=[t.trim_id,v.variant_name,t.group,t.name].filter(Boolean).join(' ');
  const ax=groupAxes(t.group,fullLabel);
  let rows=(byMakerModel.get(S(mf.manufacturer_name)+'|'+S(md.model_name))||[]).filter(r=>{
    const a=axesKey(r);
    const vf=fuelWord(v.variant_name||v.fuel);
    const vl=liter(v.variant_name)||(v.displacement_cc?(Math.round(Number(v.displacement_cc)/100)/10).toFixed(1):'');
    if(vf&&a.fuel&&vf!==a.fuel)return false;
    if(vl&&a.liter&&vl!==a.liter)return false;
    return true;
  });
  // 세부모델 변형축 — 쿠페/하이루프/롱휠은 이름에 명시될 때만 그 갈래로 간다.
  if(ax.coupe) rows=rows.filter(r=>/쿠페|coupe/i.test(S(r.sub_model)+' '+S(r.generation_name)));
  else if(rows.some(r=>/쿠페|coupe/i.test(S(r.sub_model)))) rows=rows.filter(r=>!/쿠페|coupe/i.test(S(r.sub_model)));
  if(ax.highroof) rows=rows.filter(r=>/하이루프|high\\s*roof/i.test(S(r.sub_model)+' '+S(r.generation_name)));
  else if(rows.some(r=>/하이루프|high\\s*roof/i.test(S(r.sub_model)))) rows=rows.filter(r=>!/하이루프|high\\s*roof/i.test(S(r.sub_model)));
  if(ax.longwheel) rows=rows.filter(r=>/롱휠|long\\s*wheel/i.test(S(r.sub_model)+' '+S(r.generation_name)+' '+S(r.source_aliases)));
  // 터보가 명시되면 반드시 터보. 명시가 없고 같은 축에 non-turbo가 존재하면 non-turbo를 우선한다.
  if(ax.turbo) rows=rows.filter(r=>r.turbo===true);
  else if(rows.some(r=>r.turbo===false)) rows=rows.filter(r=>r.turbo!==true);

  const forms=trimForms(t.name);
  let cand=rows.filter(r=>[...forms].some(x=>rowForms(r).has(x)));
  const beforeAxis=[...cand];
  if(ax.seats!=null){
    const f=cand.filter(r=>Number(r.seats)===ax.seats);
    if(f.length)cand=f;
  }
  if(ax.drive==='all'){
    const f=cand.filter(r=>driveClass(r.drivetrain)==='all');
    if(f.length)cand=f;
  } else if(ax.drive==='two'){
    const f=cand.filter(r=>driveClass(r.drivetrain)!=='all');
    if(f.length)cand=f;
  }
  if(ax.van){
    const f=cand.filter(r=>/밴/.test(S(r.body_configuration))||(r.source_aliases||[]).some(x=>/밴/.test(x))||Number(r.seats)<=2);
    if(f.length)cand=f;
  } else if(/일반|해치백/.test(S(t.group))) {
    const f=cand.filter(r=>Number(r.seats)>2 || !r.seats);
    if(f.length)cand=f;
  }
  if(ax.rental){
    const f=cand.filter(r=>(r.source_aliases||[]).some(x=>/렌터카|business|비즈니스/i.test(x))||/렌터카|business|비즈니스/i.test(S(r.trim)));
    if(f.length)cand=f;
  }

  let axisRows=rows;
  if(ax.seats!=null)axisRows=axisRows.filter(r=>Number(r.seats)===ax.seats);
  if(ax.drive==='all')axisRows=axisRows.filter(r=>driveClass(r.drivetrain)==='all');
  else if(ax.drive==='two')axisRows=axisRows.filter(r=>driveClass(r.drivetrain)!=='all');
  if(ax.van){
    const f=axisRows.filter(r=>/밴/.test(S(r.body_configuration))||(r.source_aliases||[]).some(x=>/밴/.test(x))||Number(r.seats)<=2);
    if(f.length)axisRows=f;
  }

  // 1) 표준 세부트림까지 유일하면 trim_row_key를 박는다.
  if(cand.length===1){
    const r=cand[0];
    const rawExact=clean(r.trim)===clean(t.name);
    if(rawExact)exact++;else alias++;
    by_trim_id[key]={
      identity_level:'trim',
      trim_row_key:r.trim_row_key,
      master_id:r.master_id,
      powertrain_seq:r.powertrain_seq,
      maker:r.maker,model:r.model,sub_model:r.sub_model,
      powertrain:r.powertrain,trim:r.trim,
      fuel:r.fuel,engine_cc:r.engine_cc,displacement_l:r.displacement_l,
      turbo:r.turbo,drivetrain:r.drivetrain,seats:r.seats,
      body_configuration:r.body_configuration||null,
      usage_tier:r.usage_tier,
      match:rawExact?'exact':'alias_or_axis'
    };
  }else{
    // 2) H-Pick/Black/E-LSD 같은 «판매구성»은 세부트림이 아니다.
    //    같은 세부모델+파워트레인으로 유일하면 차량 신원은 powertrain까지 고정하고
    //    판매구성 이름/가격은 신차 상품마스터가 계속 가진다.
    const groups=new Map();
    for(const r of axisRows){
      const g=[r.master_id,r.powertrain_seq,r.sub_model,r.powertrain,r.drivetrain,r.seats,r.body_configuration||''].join('|');
      if(!groups.has(g))groups.set(g,[]);
      groups.get(g).push(r);
    }
    if(groups.size===1 && axisRows.length){
      const r=axisRows[0];
      uniqueAxis++;
      by_trim_id[key]={
        identity_level:'powertrain',
        trim_row_key:null,
        master_id:r.master_id,
        powertrain_seq:r.powertrain_seq,
        maker:r.maker,model:r.model,sub_model:r.sub_model,
        powertrain:r.powertrain,trim:null,
        fuel:r.fuel,engine_cc:r.engine_cc,displacement_l:r.displacement_l,
        turbo:r.turbo,drivetrain:r.drivetrain,seats:r.seats,
        body_configuration:r.body_configuration||null,
        usage_tier:r.usage_tier,
        product_configuration:t.name,
        match:'powertrain_product_config'
      };
    }else unresolved.push({
      trim_id:key,maker:mf.manufacturer_name,model:md.model_name,
      variant:v.variant_name,group:t.group||'',trim:t.name,
      candidate_count:cand.length,
      candidates:(cand.length?cand:beforeAxis).slice(0,8).map(r=>({
        trim_row_key:r.trim_row_key,sub_model:r.sub_model,powertrain:r.powertrain,trim:r.trim,
        drivetrain:r.drivetrain,seats:r.seats,body_configuration:r.body_configuration||null
      }))
    });
  }
}
const dup=[...duplicateTrimIds.entries()].filter(([,n])=>n>1);
if(dup.length) throw new Error('welrix trim_id 중복: '+dup.slice(0,20).map(([k,n])=>k+'='+n).join(', '));

const levelCounts=Object.values(by_trim_id).reduce((a,x)=>{a[x.identity_level]=(a[x.identity_level]||0)+1;return a;},{});
const out={
  schema_version:1,
  generated_at:new Date().toISOString(),
  master_data_as_of:master.data_as_of||null,
  master_source:master.source||null,
  stats:{total,mapped:Object.keys(by_trim_id).length,unresolved:unresolved.length,exact,alias_or_axis:alias,unique_axis_fallback:uniqueAxis,identity_levels:levelCounts},
  by_trim_id,
  unresolved
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.stats));
console.log('unresolved sample');
for(const x of unresolved.slice(0,30))console.log(JSON.stringify(x));
