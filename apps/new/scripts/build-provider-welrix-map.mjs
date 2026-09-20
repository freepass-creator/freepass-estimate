import fs from 'node:fs';import vm from 'node:vm';
const S=v=>String(v??'').trim();const N=v=>S(v).toLowerCase().replace(/[\s·,()\[\]{}_\"'’”&+.-]/g,'');
const feed=JSON.parse(fs.readFileSync('public/data/freepass-newcar/current-feed.snapshot.json','utf8'));
const idmap=JSON.parse(fs.readFileSync('public/data/freepass-newcar/welrix-id-map.json','utf8')).map||{};
const ctx={window:{},console:{log(){},warn(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/welrix-db.js','utf8'),ctx);
const db=ctx.window.VEHICLE_DB;
const byPath=new Map();
for(const mf of db.manufacturers||[])for(const md of mf.models||[])for(const v of md.variants||[])for(const t of v.trims||[])
 byPath.set([mf.manufacturer_id,md.model_id,v.variant_id,t.trim_id].map(S).join('|'),{api_model:t.trim_id,price:t._priceWon||((t.base_price_5||0)*10000),label:[mf.manufacturer_name,md.model_name,v.variant_name,t.group,t.name].filter(Boolean).join(' | ')});
const result={};const unresolved=[];let pinned=0,priceName=0;
const fuelWord=v=>/(가솔린|디젤|하이브리드|전기|수소|LPG|LPi)/i.exec(S(v))?.[1]?.toLowerCase()||'';
const liter=v=>(/([1-6]\.[0-9])/.exec(S(v))||[])[1]||'';
const bare=v=>N(S(v).replace(/\([^)]*\)\s*$/,''));
for(const p of feed.rows||[]){
 const m=idmap[p.id];
 if(m){
   const h=byPath.get([m.manufacturer_id,m.model_id,m.variant_id,m.trim_id].map(S).join('|'));
   if(h){result[p.id]={provider:'welrix',...h,match:'pinned_id_map'};pinned++;continue}
 }
 const candidates=[];
 for(const mf of db.manufacturers||[]){
  if(N(mf.manufacturer_name)!==N(p.maker))continue;
  for(const md of mf.models||[]){
   const names=[p.sub_model,p.carType].filter(Boolean).map(N);
   if(!names.some(x=>N(md.model_name)===x||N(md.model_name).includes(x)||x.includes(N(md.model_name))))continue;
   for(const v of md.variants||[]){
    if(fuelWord(v.variant_name||v.fuel)&&fuelWord(p.fuel)&&fuelWord(v.variant_name||v.fuel)!==fuelWord(p.fuel))continue;
    if(liter(v.variant_name)&&liter(p.fuel)&&liter(v.variant_name)!==liter(p.fuel))continue;
    for(const t of v.trims||[]){
      const nameOk=N(t.name)===N(p.trim)||bare(t.name)===bare(p.trim)||N(t.trim_id)===N(p.id);
      const price=Number(p.priceAfter||p.priceBefore||0),tp=Number(t._priceWon||((t.base_price_5||0)*10000));
      const priceOk=price>0&&tp===price;
      if(nameOk||priceOk)candidates.push({mf,md,v,t,nameOk,priceOk,tp});
    }
   }
  }
 }
 const exact=candidates.filter(x=>x.nameOk&&x.priceOk);
 const chosen=exact.length===1?exact[0]:(candidates.filter(x=>x.priceOk).length===1?candidates.filter(x=>x.priceOk)[0]:(candidates.filter(x=>x.nameOk).length===1?candidates.filter(x=>x.nameOk)[0]:null));
 if(chosen){
  result[p.id]={provider:'welrix',api_model:chosen.t.trim_id,price:chosen.tp,label:[chosen.mf.manufacturer_name,chosen.md.model_name,chosen.v.variant_name,chosen.t.group,chosen.t.name].filter(Boolean).join(' | '),match:chosen.nameOk&&chosen.priceOk?'name+price':chosen.priceOk?'price':'name'};priceName++;
 }else unresolved.push({id:p.id,maker:p.maker,model:p.sub_model||p.carType,fuel:p.fuel,trim:p.trim,price:Number(p.priceAfter||p.priceBefore||0),candidate_count:candidates.length,candidates:candidates.slice(0,6).map(x=>({label:[x.md.model_name,x.v.variant_name,x.t.group,x.t.name].filter(Boolean).join(' | '),price:x.tp,nameOk:x.nameOk,priceOk:x.priceOk}))});
}
const artifact={schema_version:1,generated_at:new Date().toISOString(),stats:{total:(feed.rows||[]).length,mapped:Object.keys(result).length,unresolved:unresolved.length,pinned_id_map:pinned,inferred:priceName},by_product_id:result,unresolved};
fs.writeFileSync('public/data/freepass-newcar/provider-welrix-map.json',JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact.stats));console.log('unresolved sample');for(const x of unresolved.slice(0,30))console.log(JSON.stringify(x));
