export async function calculateKamatchComparison(request, { signal } = {}) {
  const response=await fetch('/api/kamatch-comparison',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request}),signal});
  const body=await response.json().catch(()=>null);
  if(!response.ok||!body?.ok||body.mode!=='SOURCE_FORMULA_COMPARISON'||!Array.isArray(body.results)) {
    throw Object.assign(new Error(body?.error||'카매치 견적을 계산하지 못했습니다.'),{code:body?.code||'KAMATCH_UNAVAILABLE'});
  }
  return body;
}
