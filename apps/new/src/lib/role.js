// ============================================================================
//  누가 보고 있나 — 손님(guest) / 담당자(staff)
// ----------------------------------------------------------------------------
//  ★대표 2026-09-17 「이거를 손님도 쓰고 나도 쓰고, 그런데도 전혀 지장 없게끔 한다」
//
//  ★기본은 «손님»이다. 주소를 그냥 열면 손님 화면이다.
//    담당자는 `?staff=1` 로 한 번 들어와 PIN 을 넣으면 그 «폰에» 기억된다.
//    다음부터는 그냥 열어도 담당자 화면이고, 손님 폰에는 아무 일도 안 생긴다.
//
//  ★PIN 은 빌드 때 심는다 — `vite.config.js` 의 injectGatePins 가
//    `window.__GATE_PINS = { agent: '…' }` 를 넣는다(환경변수 VITE_AGENT_PIN).
//    이건 «담을 치는 자물쇠»가 아니라 «손님이 실수로 들어오지 않게 하는 빗장»이다 —
//    원가·마진은 이 화면에 애초에 안 나온다. 가리는 건 수수료율·신용·탁송뿐이다.
//
//  ★공유 링크에는 담당자 표시를 «절대» 붙이지 않는다(→ 손님링크()).
//    붙여 보내면 손님이 수수료 칸을 보게 된다.
// ============================================================================

const 열쇠 = 'welrix_role';
let 세션역할 = null;

/** 지금 보는 사람 — 'staff' | 'guest' */
export function 역할() {
  if (세션역할 === 'staff') return 'staff';
  if (세션역할 === 'guest') return 'guest';
  try {
    if (localStorage.getItem(열쇠) === 'staff') return 'staff';
  } catch { /* 사파리 프라이빗 등 — 저장소를 못 읽어도 세션 역할은 유지한다 */ }
  return 'guest';
}

export const 담당자인가 = () => 역할() === 'staff';

/** PIN 을 맞히면 이 폰을 담당자로 기억한다 */
export function 담당자로(핀) {
  const 정답 = String(window.__GATE_PINS?.agent ?? '');
  if (!정답 || String(핀).trim() !== 정답) return false;
  세션역할 = 'staff';
  try { localStorage.setItem(열쇠, 'staff'); } catch { /* 못 적어도 이번 세션은 담당자 */ }
  return true;
}

/** 담당자를 그만둔다 (내 폰을 남에게 넘길 때) */
export function 손님으로() {
  세션역할 = 'guest';
  try { localStorage.removeItem(열쇠); } catch { /* 무시 */ }
}

/** 주소에 `?staff=1` 이 붙어 들어왔나 — PIN 을 물을 때다 */
export function 담당자로들어왔나() {
  try { return new URLSearchParams(location.search).get('staff') === '1'; }
  catch { return false; }
}

/** ★손님에게 보낼 링크 — staff 표시를 떼어 낸다 */
export function 손님링크(주소 = location.href) {
  const u = new URL(주소, location.href);
  u.searchParams.delete('staff');
  return u.toString();
}
