import fs from 'node:fs';
const master=JSON.parse(fs.readFileSync('public/data/freepass-newcar/vehicle-trim-master.json','utf8'));
const S=v=>String(v??'').trim();
const N=v=>S(v).toLowerCase().replace(/[\s·,()\[\]{}_\"'’”&+.-]/g,'');
const queries=[
 ['KG모빌리티','렉스턴'],
 ['KG모빌리티','무쏘'],
 ['KG모빌리티','액티언'],
 ['KG모빌리티','티볼리'],
 ['르노','그랑콜레오스'],
 ['르노','아르카나'],
 ['르노','필랑트'],
 ['제네시스','g70'],
 ['현대','아반떼'],
];
for(const [maker,q] of queries){
 const nq=N(q);
 const rows=(master.records||[]).filter(r=>S(r.maker)===maker && [r.model,r.sub_model,r.generation_name,r.development_code,...(r.source_aliases||[])]
   .map(N).filter(Boolean).some(x=>x.includes(nq)||nq.includes(x)));
 console.log('QUERY',maker,q,'COUNT',rows.length);
 const uniq=new Map();
 for(const r of rows){
   const k=[r.model,r.sub_model,r.powertrain,r.engine_cc,r.displacement_l,r.fuel,r.drivetrain,r.seats,r.body_configuration].join('|');
   if(!uniq.has(k))uniq.set(k,{model:r.model,sub_model:r.sub_model,powertrain:r.powertrain,engine_cc:r.engine_cc,displacement_l:r.displacement_l,fuel:r.fuel,drivetrain:r.drivetrain,seats:r.seats,body_configuration:r.body_configuration,aliases:(r.source_aliases||[]).slice(0,6)});
 }
 for(const x of [...uniq.values()].slice(0,80))console.log('ROW',JSON.stringify(x));
}
