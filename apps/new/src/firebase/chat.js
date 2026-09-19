// 영업자 ↔ 견적관리자 채팅 — 영업자별 단일 채널
// 경로: welrix_chats/{staff_uid}/messages/{msg_id}
//
// - 영업자(익명 auth): 자기 채널(=auth.uid)에만 read/write
// - 관리자(role: admin/agent_admin/agent_manager): 모든 채널 read/write
// - 손님: 접근 차단
//
// 견적 발송 시 시스템 메시지가 자동으로 채널에 push 됨 (logQuoteSent)
import { ref, push, set, onChildAdded, off, query, orderByChild, limitToLast, get, update } from 'firebase/database';
import { db, waitAuth, auth } from './config.js';

const MAX_BACKLOG = 200;
let _roleCache;

async function getMyRole() {
  if (_roleCache !== undefined) return _roleCache;
  await waitAuth();
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    _roleCache = null;
    return null;
  }
  try {
    const snap = await get(ref(db, `users/${auth.currentUser.uid}/role`));
    const r = snap.val();
    _roleCache = (r === 'admin' || r === 'agent_admin' || r === 'agent_manager') ? r : null;
  } catch {
    _roleCache = null;
  }
  return _roleCache;
}
export async function isManager() { return !!(await getMyRole()); }

/**
 * 채팅 메시지 전송
 * @param {string} text
 * @param {string} nickname  — 영업자 자유 입력 대화명
 * @param {string} [targetStaffUid] — 관리자만 사용. 영업자는 무시되고 자기 채널로 갑니다.
 */
export async function sendChatMessage(text, nickname, targetStaffUid) {
  await waitAuth();
  if (!auth.currentUser) throw new Error('인증 필요');
  const role = await getMyRole();
  const sender = role ? 'manager' : 'sales';
  const channelUid = sender === 'sales' ? auth.currentUser.uid : targetStaffUid;
  if (!channelUid) throw new Error('대상 영업자 채널 미지정');
  const cleanText = String(text || '').trim().slice(0, 1000);
  if (!cleanText) throw new Error('빈 메시지');

  const newRef = push(ref(db, `welrix_chats/${channelUid}/messages`));
  const payload = {
    text: cleanText,
    sender,
    name: String(nickname || '').slice(0, 60) || (sender === 'manager' ? '견적관리자' : '영업담당'),
    at: Date.now(),
    uid: auth.currentUser.uid,
  };
  await set(newRef, payload);
  // 채널 메타 갱신 — 관리자 인박스 최신순 정렬용
  await update(ref(db, `welrix_chats/${channelUid}`), {
    staff_uid: channelUid,
    last_message_at: payload.at,
    last_message_sender: sender,
    last_message_text: cleanText.slice(0, 120),
    last_message_name: payload.name,
  }).catch(() => {});
  return { id: newRef.key, ...payload };
}

/** 실시간 메시지 watch
 * @param {string} staffUid  영업자 = 자기 uid, 관리자 = 대상 영업자 uid
 */
export function watchChatMessages(staffUid, onMessage) {
  const q = query(
    ref(db, `welrix_chats/${staffUid}/messages`),
    orderByChild('at'),
    limitToLast(MAX_BACKLOG)
  );
  const handler = onChildAdded(q, (snap) => onMessage({ id: snap.key, ...snap.val() }));
  return () => off(q, 'child_added', handler);
}

/** 채널 메타 (last_message 등) — 관리자 인박스용 */
export async function fetchAllChannels() {
  await waitAuth();
  const role = await getMyRole();
  if (!role) throw new Error('관리자 권한 필요');
  const snap = await get(ref(db, 'welrix_chats'));
  if (!snap.exists()) return [];
  const out = [];
  snap.forEach((c) => {
    const v = c.val() || {};
    out.push({
      staff_uid: c.key,
      last_message_at: v.last_message_at || 0,
      last_message_sender: v.last_message_sender,
      last_message_text: v.last_message_text,
      last_message_name: v.last_message_name,
    });
  });
  return out.sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));
}

/** 견적 발송 시스템 메시지 push */
export async function logQuoteSent(quoteId, summary) {
  await waitAuth();
  if (!auth.currentUser || auth.currentUser.isAnonymous === false) {
    // 관리자가 호출한 경우 (시스템 알림 의도 X) — 스킵
    const role = await getMyRole();
    if (role) return;
  }
  const channelUid = auth.currentUser?.uid;
  if (!channelUid) return;
  const newRef = push(ref(db, `welrix_chats/${channelUid}/messages`));
  const payload = {
    text: `📤 견적 발송 — ${summary}`.slice(0, 1000),
    sender: 'system',
    name: '시스템',
    at: Date.now(),
    uid: channelUid,
    quote_id: quoteId,
  };
  await set(newRef, payload);
  await update(ref(db, `welrix_chats/${channelUid}`), {
    staff_uid: channelUid,
    last_message_at: payload.at,
    last_message_sender: 'system',
    last_message_text: payload.text.slice(0, 120),
    last_message_name: '시스템',
  }).catch(() => {});
}
