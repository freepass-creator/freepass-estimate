// Read-only audit of Data-owned canonical facts against captured official evidence.
// This module never constructs, promotes, or writes a vehicle master.
const OFFICIAL_HOSTS=['hyundai.com','kia.com','genesis.com'];
function official(url) {try {const host=new URL(url).hostname;return OFFICIAL_HOSTS.some(h=>host===h||host.endsWith('.'+h));}catch{return false}}
function same(a,b){return stable(a)===stable(b)}
const sorted=a=>[...(a||[])].sort();
export function auditManufacturerRecord(canonical,evidence,{now=Date.now(),maxAgeMs=86400000}={}) {
  const findings=[];
  const difference=(path,ours,theirs)=>{if(!same(ours,theirs))findings.push({path,canonical:ours??null,manufacturer:theirs??null});};
  if(!official(evidence?.sourceUrl))findings.push({path:'evidence.sourceUrl',reason:'OFFICIAL_MANUFACTURER_SOURCE_REQUIRED'});
  const observed=Date.parse(evidence?.observedAt);
  if(!Number.isFinite(observed)||observed>now+300000||now-observed>maxAgeMs)findings.push({path:'evidence.observedAt',reason:'SOURCE_FRESHNESS_UNVERIFIED'});
  if(!evidence?.effectiveFrom)findings.push({path:'evidence.effectiveFrom',reason:'EFFECTIVE_DATE_REQUIRED'});
  difference('productId',canonical?.productId,evidence?.productId);
  const reference=evidence?.record;
  if(!reference)return{status:'UNVERIFIED',productId:canonical?.productId,findings:[...findings,{path:'evidence.record',reason:'OFFICIAL_RECORD_REQUIRED'}]};
  for(const field of ['maker','model','modelYear','powertrainName','trimName','priceBasis'])difference(field,canonical[field],reference[field]);
  for(const field of ['basePrice','priceBefore','priceAfter']) {
    const a=canonical[field],b=reference[field];
    if(field!=='basePrice'&&a==null&&b==null)continue;
    difference(field+'.currency',a?.currency,b?.currency);difference(field+'.amount',a?.amount,b?.amount);
    if(!Number.isSafeInteger(b?.amount)||b.amount<0||b.currency!=='KRW')findings.push({path:field,reason:'OFFICIAL_KRW_PRICE_REQUIRED'});
  }
  for(const [collection,id]of [['options','optionId'],['exteriorColors','colorId'],['interiorColors','colorId']]) {
    const ours=canonical[collection]||[],theirs=reference[collection]||[];
    difference(collection+'.ids',sorted(ours.map(r=>r[id])),sorted(theirs.map(r=>r[id])));
    for(const row of ours) {
      const matches=theirs.filter(r=>r[id]===row[id]);if(matches.length!==1)continue;
      const other=matches[0],prefix=collection+'.'+row[id];
      difference(prefix+'.name',row.name,other.name);difference(prefix+'.price',row.price,other.price);
      if(collection==='options'){
        for(const rule of ['requires','excludes','includes'])difference(prefix+'.'+rule,sorted(row[rule]),sorted(other[rule]));
        difference(prefix+'.exclusiveGroupId',row.exclusiveGroupId||null,other.exclusiveGroupId||null);
      }
    }
  }
  return{status:findings.length?'MISMATCH':'VERIFIED',productId:canonical.productId,sourceUrl:evidence.sourceUrl,observedAt:evidence.observedAt,findings};
}
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value)}
export function auditProvidedQuote(reference,calculated) {
  const findings=[];
  if(!reference?.request||!calculated?.request||stable(reference.request)!==stable(calculated.request))return{status:'INPUT_MISMATCH',findings:[{path:'request',reason:'IDENTICAL_COMPLETE_CONDITIONS_REQUIRED'}]};
  const a=reference.results,b=calculated.results;
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||!a.length)return{status:'UNVERIFIED',findings:[{path:'results',reason:'COMPLETE_TERM_RESULTS_REQUIRED'}]};
  for(let i=0;i<a.length;i++)for(const field of ['monthlyRent','deposit','prepay','acquirePrice','totalCarPrice']) {
    if(!Number.isSafeInteger(a[i][field])||!Number.isSafeInteger(b[i][field])||a[i][field]!==b[i][field])findings.push({path:`results.${i}.${field}`,provided:a[i][field]??null,calculated:b[i][field]??null,differenceWon:Number.isFinite(a[i][field])&&Number.isFinite(b[i][field])?b[i][field]-a[i][field]:null});
  }
  return{status:findings.length?'MISMATCH':'VERIFIED',toleranceWon:0,findings};
}
