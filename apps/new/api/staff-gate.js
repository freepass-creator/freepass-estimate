// 담당자 PIN 서버 확인 — PIN 은 서버 환경변수에만 있고 화면(HTML)으로 나가지 않는다.
import { timingSafeEqual } from 'node:crypto';

const 실패 = new Map(); // ip → { n, until }
const 최대 = 5;
const 잠금ms = 10 * 60 * 1000;

function 서버핀() {
  const configured = String(process.env.AGENT_PIN || process.env.VITE_AGENT_PIN || '').trim();
  return configured || (process.env.VERCEL_ENV ? '' : '1234'); // 로컬 개발만 1234
}

function 같다(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const rec = 실패.get(ip);
  if (rec && rec.until > now) return res.status(429).json({ ok: false, locked: true });
  const 정답 = 서버핀();
  let pin = '';
  try { pin = String((typeof req.body === 'string' ? JSON.parse(req.body) : req.body)?.pin ?? '').trim(); } catch { /* 빈 값 */ }
  if (정답 && pin && 같다(pin, 정답)) { 실패.delete(ip); return res.status(200).json({ ok: true }); }
  const n = (rec?.n || 0) + 1;
  실패.set(ip, { n, until: n >= 최대 ? now + 잠금ms : 0 });
  return res.status(401).json({ ok: false });
}
