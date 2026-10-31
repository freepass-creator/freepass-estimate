export async function calculateWelrixComparison(request, { signal } = {}) {
  const response = await fetch('/api/welrix-comparison', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ request }), signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok || body.mode !== 'DIRECT_COMPARISON_ONLY' || !Array.isArray(body.results)) {
    const error = new Error(body?.error || '웰릭스 비교 견적을 불러오지 못했습니다');
    error.code = body?.code || 'WELRIX_COMPARISON_FAILED';
    throw error;
  }
  return body;
}
