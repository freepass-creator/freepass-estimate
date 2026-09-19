import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = process.cwd();
const masterPath = process.env.MASTER_PATH || path.resolve(root, '../../.master-reference/public/data/vehicle-trim-master.json');
const welrixDbPath = process.env.WELRIX_DB_PATH || path.resolve(root, 'public/welrix-db.js');
const catalogPath = process.env.CATALOG_PATH || path.resolve(root, '../../.welrix-reference/_audit/welrix-netlify-20260917/catalog.json');
const vehiclesPath = process.env.WELRIX_VEHICLES_PATH || path.resolve(root, '../../.welrix-reference/_audit/welrix-netlify-20260917/vehicles-508.json');

const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const sourceVehicles = JSON.parse(fs.readFileSync(vehiclesPath, 'utf8')).filter(v => !v.oldOnly);

const ctx = { window: {}, console: { log(){}, warn(){}, error(){} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(welrixDbPath, 'utf8'), ctx);
const db = ctx.window.VEHICLE_DB;

const S = v => String(v ?? '').trim();
const norm = v => S(v).replace(/[ⅠⅡⅢ]/g,m=>({'Ⅰ':'I','Ⅱ':'II','Ⅲ':'III'}[m]))
  .replace(/인치/g,'"').replace(/패키지|PACK|PKG/gi,'')
  .replace(/[\s·,()\[\]+\"'’”&._-]/g,'').toUpperCase();
const fuel = v => {
  const s=S(v);
  if (/수소/.test(s)) return '수소';
  if (/전기|EV/i.test(s)) return '전기';
  if (/플러그인|PHEV/i.test(s)) return '플러그인 하이브리드';
  if (/하이브리드|HEV/i.test(s)) return '하이브리드';
  if (/LPG|LPI/i.test(s)) return 'LPG';
  if (/디젤/i.test(s)) return '디젤';
  if (/가솔린|GDI/i.test(s)) return '가솔린';
  return s;
};
const disp = v => {
  const m = S(v).match(/(?:^|[^0-9.])([1-6]\.[0-9])(?![0-9])/);
  return m ? Number(m[1]).toFixed(1) : '';
};
const driveClass = v => {
  const s=S(v).toUpperCase();
  if (/AWD|4WD|4MATIC|4MOTION|XDRIVE|QUATTRO|사륜/.test(s)) return 'all';
  if (/FWD|전륜/.test(s)) return 'front';
  if (/RWD|후륜/.test(s)) return 'rear';
  if (/2WD/.test(s)) return 'two';
  return '';
};
const masterEngineKey = r => {
  const f=fuel(r.fuel);
  const d = r.displacement_l ? Number(r.displacement_l).toFixed(1) : (r.engine_cc ? (Math.round(Number(r.engine_cc)/100)/10).toFixed(1) : '');
  return [f,d,r.turbo===true?'T':''].filter(Boolean).join('|');
};
const variantEngineKey = v => {
  const label = v.variant_name || '';
  const f=fuel(label || v.fuel);
  const d=disp(label) || (v.displacement_cc ? (Math.round(Number(v.displacement_cc)/100)/10).toFixed(1) : '');
  return [f,d,/터보|T-GDI|\d\.\dT\b/i.test(label)?'T':''].filter(Boolean).join('|');
};
const groupAxes = g => {
  const s=S(g);
  const sm=s.match(/(\d{1,2})인승/);
  return {
    seats: sm ? Number(sm[1]) : null,
    drive: /(?:^|\s)(4WD|AWD|HTRAC)(?:\s|$)/i.test(s) ? 'all' : /(?:^|\s)2WD(?:\s|$)/i.test(s) ? 'two' : '',
    van: /밴/.test(s),
  };
};
const trimNorm = n => norm(S(n).replace(/^기본형\s*\+?/,'').replace(/\b(2WD|4WD|AWD|HTRAC)\b/ig,''));

const activeMaster = master.records.filter(r => r.market_status === '신차' && r.usage_tier !== 'blocked');
const byMakerModel = new Map();
for (const r of activeMaster) {
  const k = S(r.maker)+'|'+S(r.model);
  if (!byMakerModel.has(k)) byMakerModel.set(k, []);
  byMakerModel.get(k).push(r);
}

let variants=0,trims=0;
const noModel=[], noEngine=[], noTrim=[], axisMismatch=[], ambiguous=[], optionIssues=[];
const modelCoverage = [];
let exclusiveCount=0, requiresCount=0, excludesCount=0;

for (const mf of db.manufacturers || []) for (const md of mf.models || []) {
  const recs = byMakerModel.get(mf.manufacturer_name+'|'+md.model_name) || [];
  modelCoverage.push({maker:mf.manufacturer_name, model:md.model_name, masterRows:recs.length});
  if (!recs.length) noModel.push(mf.manufacturer_name+' '+md.model_name);
  for (const v of md.variants || []) {
    variants++;
    const ek=variantEngineKey(v);
    const ers=recs.filter(r=>masterEngineKey(r)===ek);
    if (recs.length && !ers.length) noEngine.push(`${mf.manufacturer_name} ${md.model_name} :: ${v.variant_name} [${ek}]`);

    const optMap=v.options_master || {};
    const optIds=new Set(Object.keys(optMap));
    const trimIds=new Set((v.trims||[]).map(t=>t.trim_id));
    for (const g of v.exclusive_groups || []) {
      exclusiveCount++;
      const missing=(g.members||[]).filter(id=>!optIds.has(id));
      if ((g.members||[]).length < 2) optionIssues.push(`exclusive<2 ${md.model_name}/${v.variant_name}/${g.label}`);
      if (missing.length) optionIssues.push(`exclusive missing ids ${md.model_name}/${v.variant_name}: ${missing.join(',')}`);
    }
    for (const [id,o] of Object.entries(optMap)) {
      if (!optIds.has(id)) optionIssues.push(`option map impossible ${id}`);
      for (const [trimId,reqs] of Object.entries(o.requires_in_trim || {})) {
        requiresCount += reqs.length;
        if (!trimIds.has(trimId)) optionIssues.push(`requires unknown trim ${md.model_name}/${trimId}`);
        const t=(v.trims||[]).find(x=>x.trim_id===trimId);
        for (const rid of reqs) {
          if (!optIds.has(rid)) optionIssues.push(`requires missing option ${md.model_name}/${rid}`);
          if (t && !(t.available_options||[]).includes(rid)) optionIssues.push(`requires unavailable in trim ${md.model_name}/${trimId}/${rid}`);
        }
      }
    }
    for (const [id,arr] of Object.entries(v.option_excludes || {})) {
      excludesCount += arr.length;
      if (!optIds.has(id)) optionIssues.push(`exclude source missing ${md.model_name}/${id}`);
      for (const x of arr) if (!optIds.has(x)) optionIssues.push(`exclude target missing ${md.model_name}/${x}`);
    }
    for (const t of v.trims || []) {
      trims++;
      const invalid=(t.available_options||[]).filter(id=>!optIds.has(id));
      if (invalid.length) optionIssues.push(`trim option missing ${md.model_name}/${t.trim_id}: ${invalid.join(',')}`);
      if (!ers.length) continue;
      const tn=trimNorm(t.name);
      let cand=ers.filter(r=>trimNorm(r.trim)===tn || norm(r.trim)===norm(t.name));
      const ax=groupAxes(t.group);
      if (ax.seats != null) cand=cand.filter(r=>Number(r.seats)===ax.seats);
      if (ax.drive==='all') cand=cand.filter(r=>driveClass(r.drivetrain)==='all');
      if (ax.drive==='two') cand=cand.filter(r=>driveClass(r.drivetrain)!=='all');
      if (ax.van) cand=cand.filter(r=>/밴/.test(S(r.body_configuration)) || /밴/.test(S(r.trim)) || (r.source_aliases||[]).some(x=>/밴/.test(x)));
      if (!cand.length) {
        const base=ers.filter(r=>trimNorm(r.trim)===tn || norm(r.trim)===norm(t.name));
        if (base.length) axisMismatch.push(`${mf.manufacturer_name} ${md.model_name} / ${v.variant_name} / [${t.group||'-'}] ${t.name} -> master candidates ${base.map(r=>`${r.drivetrain}/${r.seats||'-'}/${r.body_configuration||'-'}`).join(', ')}`);
        else noTrim.push(`${mf.manufacturer_name} ${md.model_name} / ${v.variant_name} / [${t.group||'-'}] ${t.name}`);
      } else if (cand.length>1) {
        ambiguous.push(`${mf.manufacturer_name} ${md.model_name} / ${v.variant_name} / [${t.group||'-'}] ${t.name} -> ${cand.length}`);
      }
    }
  }
}

// Detect whether a drivetrain option was globally stripped even though no equivalent priced drivetrain row exists.
const driveOption = n => /^(전자식\s*)?(AWD|4WD)$/i.test(S(n).replace(/\s+/g,' ').trim()) || /^HTRAC\s*\(?4WD\)?$/i.test(S(n));
const removedDriveRisk=[];
let driveOptionTotal=0, driveOptionCovered=0;
for (const w of sourceVehicles) {
  const opts=(catalog.optionsByModel?.[w.model] || []).filter(o=>o.price>0 && driveOption(o.name));
  for (const o of opts) {
    driveOptionTotal++;
    const target=(w.price||0)+(o.price||0);
    const siblings=sourceVehicles.filter(x=>x.brand===w.brand && x.carType===w.carType && x.price===target);
    const has=siblings.some(x=>/AWD|4WD|HTRAC/i.test(x.model));
    if (has) driveOptionCovered++;
    else removedDriveRisk.push(`${w.brand} ${w.carType} :: ${w.model} + ${o.name}(${o.price.toLocaleString()}원) => ${target.toLocaleString()}원 대응 AWD/4WD row 없음`);
  }
}

const masterModels=new Set(activeMaster.map(r=>r.maker+'|'+r.model));
const welrixModels=new Set((db.manufacturers||[]).flatMap(m=>(m.models||[]).map(md=>m.manufacturer_name+'|'+md.model_name)));
const masterOnly=[...masterModels].filter(k=>/^(현대|기아|제네시스)\|/.test(k) && !welrixModels.has(k)).sort();

console.log('=== FREEPASS NEW-CAR MASTER AUDIT ===');
console.log(`master data_as_of: ${master.data_as_of || '-'}`);
console.log(`active new master rows: ${activeMaster.length}`);
console.log(`Welrix UI models: ${welrixModels.size} / variants: ${variants} / trims: ${trims}`);
console.log(`option relations: exclusive groups ${exclusiveCount}, requires refs ${requiresCount}, excludes refs ${excludesCount}`);
console.log('');
const print=(title,arr,limit=40)=>{
  console.log(`[${title}] count=${arr.length}`);
  for(const x of arr.slice(0,limit)) console.log(' - '+x);
  if(arr.length>limit) console.log(` ... +${arr.length-limit} more`);
  console.log('');
};
print('Welrix model missing from active new master',noModel);
print('Welrix engine axis missing from active new master',noEngine);
print('Welrix trim name missing after engine match',noTrim);
print('Seat/drive/body axis mismatch',axisMismatch,60);
print('Ambiguous master match',ambiguous);
print('Option relation structural issues',optionIssues,80);
console.log(`[Drivetrain option stripping] source drive options=${driveOptionTotal}, equivalent priced row found=${driveOptionCovered}, risk=${removedDriveRisk.length}`);
for(const x of removedDriveRisk.slice(0,80)) console.log(' - '+x);
console.log('');
print('Master-only current Hyundai/Kia/Genesis models not exposed in Welrix UI',masterOnly,80);

const hard = noModel.length + optionIssues.length + removedDriveRisk.length;
console.log(`HARD_ISSUES=${hard}`);
console.log(`REVIEW_ISSUES=${noEngine.length+noTrim.length+axisMismatch.length+ambiguous.length}`);
if (hard) process.exitCode = 2;
