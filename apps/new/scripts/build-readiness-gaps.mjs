import fs from 'node:fs';

const S=v=>String(v??'').trim();
const idx=JSON.parse(fs.readFileSync('public/data/freepass-newcar/product-index.json','utf8'));
const feed=JSON.parse(fs.readFileSync('public/data/freepass-newcar/current-feed.snapshot.json','utf8'));
const rows=new Map((feed.rows||[]).map(r=>[S(r.id),r]));
const products=idx.products||{};

const canonical_gaps=[];
const provider_gaps=[];
for(const [id,p] of Object.entries(products)){
  const r=rows.get(id)||{};
  const base={
    id,
    maker:p.maker,
    model:p.model,
    engine:p.engine,
    trim:p.trim,
    group:p.group||'',
    price:Number(r.priceBefore||r.priceAfter||0),
  };
  if(!(p.canonicalCandidates||[]).length) canonical_gaps.push(base);
  if(!(p.providerCandidates||[]).length) provider_gaps.push(base);
}
const by=(arr,key)=>Object.fromEntries([...new Set(arr.map(x=>x[key]))].sort().map(k=>[k,arr.filter(x=>x[key]===k).length]));
const out={
  schema_version:1,
  generated_at:new Date().toISOString(),
  data_as_of:idx.data_as_of||feed.data_as_of||null,
  total:Object.keys(products).length,
  canonical:{
    gap_count:canonical_gaps.length,
    matched_count:Object.keys(products).length-canonical_gaps.length,
    by_maker:by(canonical_gaps,'maker'),
    rows:canonical_gaps,
  },
  provider:{
    gap_count:provider_gaps.length,
    supported_count:Object.keys(products).length-provider_gaps.length,
    by_maker:by(provider_gaps,'maker'),
    rows:provider_gaps,
  }
};
fs.writeFileSync('public/data/freepass-newcar/readiness-gaps.json',JSON.stringify(out,null,2)+'\n');
console.log('PASS new-car gaps',JSON.stringify({
  total:out.total,
  canonical_gap:out.canonical.gap_count,
  provider_gap:out.provider.gap_count,
}));
