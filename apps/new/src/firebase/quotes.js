// 견적 발송 — Realtime DB 의 welrix_quotes/<id> 경로에 저장
// 손님 페이지는 ?q=<id> 로 접근해 read-only 로 표시
import { ref, set, get, update, push } from 'firebase/database';
import { db, waitAuth, auth } from './config.js';

// short id (6자) — Base36 timestamp + random
function makeShortId() {
  const t = Date.now().toString(36).slice(-4);
  const r = Math.random().toString(36).slice(2, 4);
  return t + r;
}

/**
 * 견적 저장
 * @param {object} payload — { customer, staff, cond, vehicles, scenarios, send, ... }
 * @returns {Promise<{id, url}>}
 */
export async function saveQuote(payload) {
  await waitAuth();
  const id = makeShortId();
  const myUid = auth.currentUser?.uid || null;
  const data = {
    quote_id: id,
    created_at: Date.now(),
    expires_at: Date.now() + 7 * 86400000,
    // staff_uid = 영업자 익명 uid (권한 키) — 같은 브라우저에서 자기 견적의 채팅·파일 접근.
    // 관리자(role: admin) 는 rules 에서 모든 견적 통과.
    staff_uid: myUid,
    created_by_uid: myUid,
    is_anonymous: auth.currentUser?.isAnonymous !== false,
    company: 'welrix',
    ...payload,
  };
  // 충돌 방지 — 같은 id 가 이미 있으면 다시 생성 (최대 3회)
  for (let attempt = 0; attempt < 3; attempt++) {
    const path = `welrix_quotes/${id}`;
    const snap = await get(ref(db, path));
    if (!snap.exists()) {
      await set(ref(db, path), data);
      return { id, url: buildQuoteUrl(id) };
    }
    data.quote_id = makeShortId();
  }
  throw new Error('견적 ID 생성 실패 — 다시 시도하세요');
}

export async function loadQuote(id) {
  await waitAuth();
  const snap = await get(ref(db, `welrix_quotes/${id}`));
  return snap.exists() ? snap.val() : null;
}

export async function markQuoteAccessed(id) {
  await waitAuth();
  const path = `welrix_quotes/${id}/access_log`;
  const newRef = push(ref(db, path));
  await set(newRef, {
    at: Date.now(),
    ua: navigator.userAgent.slice(0, 200),
  });
}

export function buildQuoteUrl(id) {
  const origin = location.origin;
  // 같은 SPA 안에서 ?q=<id> 모드로 분기
  return `${origin}${location.pathname}?q=${id}`;
}
