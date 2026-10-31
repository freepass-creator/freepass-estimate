export async function calculateQuoteBenchmark(request,{signal}={}) {
  const response=await fetch('/api/quote-benchmark',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request}),signal});
  const body=await response.json().catch(()=>null);
  if(!response.ok||!body?.ok||body.mode!=='THREE_QUOTE_BENCHMARK')throw Object.assign(new Error(body?.error||'견적 비교를 계산하지 못했습니다.'),{code:body?.code});
  return body;
}
export async function calculateStandardComparison(request,options) {
  const result=await calculateQuoteBenchmark(request,options);
  if(result.standard.status!=='DRAFT')throw new Error(result.standard.error);
  return {...result.standard,mode:'STANDARD_BENCHMARK_DRAFT'};
}

export async function calculatePublicQuotes(request,{signal}={}) {
  const response=await fetch('/api/public-quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request}),signal});
  const body=await response.json().catch(()=>null);
  if(!response.ok||!body?.ok||body.mode!=='PUBLIC_QUOTE_OPTIONS'||!Array.isArray(body.offers))throw new Error('현재 견적을 조회할 수 없습니다. 잠시 후 다시 확인해 주세요.');
  return body;
}
