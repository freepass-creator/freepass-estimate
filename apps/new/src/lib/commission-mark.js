export const isCommissionMark = value => typeof value === 'string' && /^(?:[A-E][A-J]|FA)$/.test(value);
export async function requestCommissionMark(agentPoints) {
  const response=await fetch('/api/customer-quote-code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agentPoints})});
  const body=await response.json().catch(()=>null);
  if(!response.ok||!body?.ok||!isCommissionMark(body.reference))throw new Error(body?.error||'수수료 참조코드를 만들지 못했습니다.');
  return body.reference;
}
