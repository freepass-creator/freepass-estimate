import fs from 'node:fs';
const feed=JSON.parse(fs.readFileSync('public/data/freepass-newcar/current-feed.snapshot.json','utf8'));
const master=JSON.parse(fs.readFileSync('public/data/freepass-newcar/vehicle-trim-master.json','utf8'));
const byKey=new Set(master.records.map(r=>String(r.trim_row_key||'')));
const rows=feed.rows||[];
const optionPrices=[];
const colorPrices=[];
let trimKeyValid=0, trimKeyInvalid=0;
let availablePresent=0, availableEmpty=0, rules=0;
const samples=[];
for(const r of rows){
  if(r.trimKey){
    if(byKey.has(String(r.trimKey)))trimKeyValid++;else trimKeyInvalid++;
  }
  for(const o of Array.isArray(r.options)?r.options:[]) if(Number(o?.price)>=0) optionPrices.push(Number(o.price));
  for(const o of Object.values(r.optionsMaster||{})) if(Number(o?.price)>=0) optionPrices.push(Number(o.price));
  for(const c of [...(r.extColors||[]),...(r.intColors||[])]) if(Number(c?.price)>=0) colorPrices.push(Number(c.price));
  if(Array.isArray(r.availableOptions)){availablePresent++;if(!r.availableOptions.length)availableEmpty++;}
  if(r.optionsMaster&&Object.keys(r.optionsMaster).length)rules++;
  if(samples.length<10 && r.optionsMaster&&Object.keys(r.optionsMaster).length){
    samples.push({id:r.id,maker:r.maker,sub_model:r.sub_model,fuel:r.fuel,trim:r.trim,
      options:Object.entries(r.optionsMaster).slice(0,3),available:(r.availableOptions||[]).slice(0,5),
      ext:(r.extColors||[]).slice(0,2)});
  }
}
const stat=a=>a.length?{n:a.length,min:Math.min(...a),max:Math.max(...a),small:a.filter(x=>x>0&&x<10000).length,large:a.filter(x=>x>=10000).length}:null;
console.log(JSON.stringify({
  rows:rows.length,
  makers:[...new Set(rows.map(r=>r.maker))],
  data_as_of:feed.data_as_of,
  trimKey:{present:rows.filter(r=>r.trimKey).length,valid:trimKeyValid,invalid:trimKeyInvalid},
  options:{rules,availablePresent,availableEmpty,prices:stat(optionPrices)},
  colors:{prices:stat(colorPrices)},
  samples
},null,2));

const configAxis=[];
for(const r of rows){
  const opts=Object.entries(r.optionsMaster||{}).map(([id,o])=>({id,...o}));
  const hits=opts.filter(o=>/(AWD|4WD|2WD|HTRAC|사륜|인승|하이루프|밴)/i.test(String(o.name||'')+' '+String(o.sub||'')));
  if(hits.length) configAxis.push({id:r.id,maker:r.maker,model:r.sub_model,fuel:r.fuel,trim:r.trim,
    axes:hits.map(o=>({id:o.id,name:o.name,price:o.price,sub:o.sub||'',available:(r.availableOptions||[]).includes(o.id),implied:(r.impliedOptions||[]).includes(o.id)})),
    implied:r.impliedOptions||[]});
}
console.log('CONFIG_AXIS_ROWS='+configAxis.length);
for(const x of configAxis.slice(0,80)) console.log('AXIS '+JSON.stringify(x));
