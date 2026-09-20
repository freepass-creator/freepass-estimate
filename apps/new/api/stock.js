// 현대차 재고 proxy — CORS 우회용 (브라우저가 직접 호출 불가)
// 캐시 1시간 (s-maxage) — Vercel edge cache 가 처리

export default async function handler(req, res) {
  try {
    const r = await fetch('https://hyundai-two-phi.vercel.app/api/recent', {
      headers: { 'User-Agent': 'welrix-mobility-proxy' },
    });
    if (!r.ok) {
      res.status(r.status).json({ error: 'upstream', status: r.status });
      return;
    }
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'fetch_failed', message: String(e) });
  }
}
