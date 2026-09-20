// ============================================================
//  ERP4 임베드 브리지
//  견적기 페이지가 상위 페이지(freepasserp4 등)에 iframe 으로 임베드될 때만 동작.
//  스탠드얼론 실행(직접 접속)에는 전혀 영향 없음 — isEmbedded()=false → no-op.
//
//  postMessage 프로토콜 (origin 화이트리스트로 보호):
//    child(견적기) → host(erp4):  { ns:'welrix', type:'ready'|'resize'|'quote', payload }
//    host(erp4) → child(견적기):  { ns:'welrix:host', type:'prefill', payload }
//
//  프리필(host→child) 필드: { vehicle, price, custName, custTel, staffName, staffTel, dealCode }
//    · URL 파라미터로도 초기 프리필 가능 (예: /?embed=1&custName=홍길동&dealCode=D-123)
//  결과(child→host) 'quote': { id, url, dealCode, summary }  ← erp4가 딜/계약에 연결
// ============================================================

// erp4 등 신뢰 상위 origin 화이트리스트 — 프로덕션 커스텀 도메인 확정 시 추가할 것
export const ALLOWED_PARENT_ORIGINS = [
  'http://localhost:4004',            // freepasserp4 dev (next dev -p 4004)
  'https://freepasserp4.vercel.app',  // freepasserp4 prod (TODO: 커스텀 도메인 있으면 추가)
];

const NS = 'welrix';

export function isEmbedded() {
  try { return window.self !== window.top; } catch { return true; } // 크로스오리진 접근 예외 = 임베드됨
}

// 신뢰 상위 origin 확정: ?parentOrigin= 우선, 없으면 ancestorOrigins 폴백 — 둘 다 화이트리스트 검증
function resolveParentOrigin() {
  const p = new URLSearchParams(location.search).get('parentOrigin');
  if (p && ALLOWED_PARENT_ORIGINS.includes(p)) return p;
  try {
    const anc = window.location.ancestorOrigins && window.location.ancestorOrigins[0];
    if (anc && ALLOWED_PARENT_ORIGINS.includes(anc)) return anc;
  } catch { /* ancestorOrigins 미지원 브라우저 */ }
  return null;
}

/**
 * 임베드 브리지 초기화. 스탠드얼론이면 no-op 핸들 반환.
 * @param {{ onPrefill?: (data:object)=>void }} opts
 * @returns {{ embedded:boolean, parentOrigin?:string|null, emitQuote:(d:object)=>void, post:(t:string,p:object)=>void }}
 */
export function initEmbedBridge({ onPrefill } = {}) {
  const noop = { embedded: false, emitQuote() {}, post() {} };
  if (!isEmbedded()) return noop;

  const parentOrigin = resolveParentOrigin();
  document.documentElement.setAttribute('data-embedded', '1');

  const post = (type, payload) => {
    if (!parentOrigin) return; // 신뢰 origin 미확정 시 전송 안 함(데이터 유출 방지)
    try { window.parent.postMessage({ ns: NS, type, payload }, parentOrigin); } catch { /* noop */ }
  };

  // 인바운드(host → child): 프리필 등
  window.addEventListener('message', (e) => {
    if (parentOrigin && e.origin !== parentOrigin) return;
    const m = e.data;
    if (!m || m.ns !== NS + ':host') return;
    if (m.type === 'prefill') onPrefill && onPrefill(m.payload || {});
  });

  // URL 파라미터 초기 프리필
  const params = new URLSearchParams(location.search);
  const prefill = {};
  ['vehicle', 'price', 'custName', 'custTel', 'staffName', 'staffTel', 'dealCode'].forEach((k) => {
    if (params.has(k)) prefill[k] = params.get(k);
  });
  if (Object.keys(prefill).length) onPrefill && onPrefill(prefill);

  // 자동 높이 리사이즈 → host 가 iframe 높이를 콘텐츠에 맞춤
  let lastH = 0;
  const postHeight = () => {
    const h = Math.ceil(document.documentElement.scrollHeight);
    if (h && h !== lastH) { lastH = h; post('resize', { height: h }); }
  };
  try { new ResizeObserver(postHeight).observe(document.documentElement); } catch { /* 폴백: load/interval */ }
  window.addEventListener('load', postHeight);

  post('ready', { app: NS });
  postHeight();

  return {
    embedded: true,
    parentOrigin,
    emitQuote: (data) => post('quote', data), // { id, url, dealCode, summary }
    post,
  };
}
