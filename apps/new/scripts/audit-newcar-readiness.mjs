import fs from 'node:fs';
import vm from 'node:vm';
import { resolveCanonicalIdentity, resolveProviderCandidate } from '../src/lib/newcar/configuration-resolver.js';

const S=v=>String(v??'').trim();
const idx=JSON.parse(fs.readFileSync('public/data/freepass-newcar/product-index.json','utf8'));
const feed=JSON.parse(fs.readFileSync('public/data/freepass-newcar/current-feed.snapshot.json','utf8'));
const master=JSON.parse(fs.readFileSync('public/data/freepass-newcar/vehicle-trim-master.json','utf8'));

const ctx={window:{},console:{log(){},warn(){},error(){}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/vehicle-db.js','utf8'),ctx);
const db=ctx.window.VEHICLE_DB||{manufacturers:[]};

const products=idx.products||{};
const feedById=new Map((feed.rows||[]).map(r=>[S(r.id),r]));
const trimById=new Map();
for(const mf of db.manufacturers||[])for(const md of mf.models||[])for(const v of md.variants||[])for(const t of v.trims||[])trimById.set(S(t.trim_id),{mf,md,v,t});

const stat={
 total:Object.keys(products).length,
 canonicalCandidate:0,canonicalResolvedBase:0,canonicalUnresolvedBase:0,
 providerCandidate:0,providerResolvedBase:0,providerUnresolvedBase:0,
 detailedOptions:0,flatOptions:0,noOptions:0,axisOptions:0,
 priced:0,colorExt:0,colorInt:0
};
const byMaker=new Map(),byModel=new Map(),noProvider=[],noCanonical=[],ambProvider=[],ambCanonical=[];
const add=(map,k,fn)=>{if(!map.has(k))map.set(k,{total:0,canonical:0,provider:0});fn(map.get(k))};

for(const [id,p] of Object.entries(products)){
 const c=p.canonicalCandidates||[],w=p.providerCandidates||[];
 const f=feedById.get(id)||{};
 const dbt=trimById.get(id)?.t;
 stat.canonicalCandidate+=c.length?1:0;
 stat.providerCandidate+=w.length?1:0;

 const dbTrim=dbt||{_base_axes:p.baseAxes||{},_canonical_candidates:c};
 const canonicalResolved=resolveCanonicalIdentity(
   {...dbTrim,_base_axes:p.baseAxes||dbTrim._base_axes||{},_canonical_candidates:c},
   {},
   []
 );
 if(canonicalResolved?.candidate){
   stat.canonicalResolvedBase++;
 }else{
   stat.canonicalUnresolvedBase++;
   noCanonical.push({id,...p,resolution:canonicalResolved?.level||'none'});
 }

 const baseAxes=p.baseAxes||dbTrim?._base_axes||{};
 const providerResolved=resolveProviderCandidate(w,baseAxes);
 if(providerResolved){
   stat.providerResolvedBase++;
 }else{
   stat.providerUnresolvedBase++;
   noProvider.push({id,...p});
   if(w.length>1)ambProvider.push({id,...p,count:w.length});
 }
 if(Number(f.priceBefore||f.priceAfter||0)>0)stat.priced++;
 if(Array.isArray(f.extColors)&&f.extColors.length)stat.colorExt++;
 if(Array.isArray(f.intColors)&&f.intColors.length)stat.colorInt++;
 if(f.optionsMaster&&Object.keys(f.optionsMaster).length)stat.detailedOptions++;
 else if(Array.isArray(f.options)&&f.options.length)stat.flatOptions++; else stat.noOptions++;
 if((p.axisOptionIds||[]).length)stat.axisOptions++;
 const maker=S(p.maker),model=S(p.model);
 add(byMaker,maker,x=>{x.total++;if(canonicalResolved?.candidate)x.canonical++;if(providerResolved)x.provider++;});
 add(byModel,maker+' '+model,x=>{x.total++;if(canonicalResolved?.candidate)x.canonical++;if(providerResolved)x.provider++;});
}

const pct=(a,b)=>b?Math.round(a*1000/b)/10:0;
console.log('=== NEW CAR READINESS ===');
console.log(JSON.stringify({...stat,
 canonicalCoverage:pct(stat.canonicalCandidate,stat.total),
 canonicalResolvedBaseCoverage:pct(stat.canonicalResolvedBase,stat.total),
 providerCoverage:pct(stat.providerCandidate,stat.total),
 providerResolvedBaseCoverage:pct(stat.providerResolvedBase,stat.total)
},null,2));

console.log('\n[BY MAKER]');
for(const [k,v] of [...byMaker.entries()].sort())console.log(k,JSON.stringify({...v,canonicalPct:pct(v.canonical,v.total),providerPct:pct(v.provider,v.total)}));

console.log('\n[LOW PROVIDER MODELS]');
for(const [k,v] of [...byModel.entries()].sort((a,b)=>(a[1].provider/a[1].total)-(b[1].provider/b[1].total)||b[1].total-a[1].total).slice(0,40))
 console.log(k,JSON.stringify({...v,providerPct:pct(v.provider,v.total),canonicalPct:pct(v.canonical,v.total)}));

console.log('\n[NO PROVIDER SAMPLE]');
for(const x of noProvider.slice(0,50))console.log(JSON.stringify(x));
console.log('\n[AMBIGUOUS PROVIDER SAMPLE]');
for(const x of ambProvider.slice(0,40))console.log(JSON.stringify(x));
console.log('\n[NO CANONICAL SAMPLE]');
for(const x of noCanonical.slice(0,50))console.log(JSON.stringify(x));

// Hard invariants for launch-quality data plumbing.
if(stat.total!==(feed.rows||[]).length) throw new Error('product-index count != feed count');
if(stat.priced!==stat.total) throw new Error('unpriced new-car product exists');
if(trimById.size!==stat.total) throw new Error('generated UI trim count != product count');
console.log('\nPASS structural invariants');
