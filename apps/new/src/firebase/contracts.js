// 계약 심사 요청 — 영업이 면허증/첨부서류 + 영업자/손님 정보 업로드
// Firebase Storage 에 binary + RTDB 에 메타·심사 코멘트
import { ref as dbRef, set, get, update, push, onValue, off, query, orderByChild, equalTo } from 'firebase/database';
import { ref as stRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, waitAuth, auth } from './config.js';

function makeShortId() {
  const t = Date.now().toString(36).slice(-5);
  const r = Math.random().toString(36).slice(2, 5);
  return t + r;
}

// PIN 4자리 → SHA-256 hash 앞 24자 (단순 비밀번호 검증용, 평문 저장 방지)
async function hashPin(pin) {
  const data = new TextEncoder().encode('welrix:' + String(pin));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

// 연락처 정규화 — 비교용 (하이픈/공백 제거)
function normalizeTel(t) {
  return String(t || '').replace(/\D/g, '');
}

/**
 * 계약 심사 요청 생성 + 파일 일괄 업로드
 * @param {object} input
 * @param {object} input.staff   — { name, tel, company? }
 * @param {object} input.customer — { name, tel }
 * @param {File|null} input.license — 운전면허증 (단일)
 * @param {File[]} input.attachments — 기타 첨부 (다중)
 * @param {string} input.memo
 * @param {string} [input.quoteId] — 연결된 견적 ID (선택)
 * @param {string} input.pin — 4자리 PIN (본인 확인용)
 * @returns {Promise<{ contract_id, url }>}
 */
export async function createContract(input) {
  await waitAuth();
  const myUid = auth.currentUser?.uid || null;
  const id = makeShortId();
  if (!input.pin || !/^\d{4}$/.test(input.pin)) throw new Error('PIN 4자리를 입력하세요');
  if (!input.staff?.tel) throw new Error('영업자 연락처를 입력하세요');
  const pinHash = await hashPin(input.pin);

  // 파일 업로드 — Storage 에 binary, 메타는 RTDB
  async function uploadOne(file, kind) {
    if (!file) return null;
    const fileId = makeShortId();
    const path = `welrix_contracts/${id}/${fileId}_${file.name}`;
    const ref = stRef(storage, path);
    await uploadBytes(ref, file, { contentType: file.type });
    const url = await getDownloadURL(ref);
    return {
      file_id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      storage_path: path,
      download_url: url,
      kind,
      uploaded_at: Date.now(),
      uploaded_by: myUid,
    };
  }

  const licenseMeta = await uploadOne(input.license, 'license');
  const attMetas = [];
  for (const f of input.attachments || []) {
    const m = await uploadOne(f, 'attachment');
    if (m) attMetas.push(m);
  }

  const data = {
    contract_id: id,
    company: 'welrix',
    created_at: Date.now(),
    status: 'pending',
    staff_uid: myUid,
    is_anonymous: auth.currentUser?.isAnonymous !== false,
    staff: { ...input.staff },
    staff_tel_norm: normalizeTel(input.staff.tel),  // indexOn for lookup
    staff_pin_hash: pinHash,                          // 본인 확인용
    customer: { ...input.customer },
    quote_id: input.quoteId || null,
    memo: input.memo || '',
    files: {
      license: licenseMeta,
      attachments: attMetas,
    },
    reviews: {},
  };

  await set(dbRef(db, `welrix_contracts/${id}`), data);
  return { contract_id: id, url: buildContractUrl(id) };
}

export async function loadContract(id) {
  await waitAuth();
  const snap = await get(dbRef(db, `welrix_contracts/${id}`));
  return snap.exists() ? snap.val() : null;
}

/**
 * 영업 본인 확인 — 연락처 + PIN 으로 자기 contract 들 조회 (비로그인 가능)
 */
export async function findMyContracts(tel, pin) {
  if (!tel) throw new Error('연락처를 입력하세요');
  if (!/^\d{4}$/.test(pin || '')) throw new Error('PIN 4자리를 입력하세요');
  await waitAuth();
  const telNorm = normalizeTel(tel);
  const pinHash = await hashPin(pin);
  // RTDB query — staff_tel_norm equalTo
  const q = query(dbRef(db, 'welrix_contracts'), orderByChild('staff_tel_norm'), equalTo(telNorm));
  const snap = await get(q);
  if (!snap.exists()) return [];
  const all = snap.val();
  return Object.values(all)
    .filter(c => c.staff_pin_hash === pinHash)
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

/**
 * 단일 contract 조회 + 본인 검증 (연락처 + pin)
 */
export async function loadContractWithPin(id, tel, pin) {
  await waitAuth();
  const snap = await get(dbRef(db, `welrix_contracts/${id}`));
  if (!snap.exists()) return null;
  const c = snap.val();
  const telOk = normalizeTel(tel) === c.staff_tel_norm;
  const pinOk = (await hashPin(pin)) === c.staff_pin_hash;
  if (!telOk || !pinOk) throw new Error('연락처 또는 PIN 이 일치하지 않습니다');
  return c;
}

export async function listContracts({ limit = 100 } = {}) {
  await waitAuth();
  const snap = await get(dbRef(db, 'welrix_contracts'));
  if (!snap.exists()) return [];
  const all = snap.val();
  return Object.values(all)
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    .slice(0, limit);
}

/**
 * 관리자 심사 코멘트 추가
 * @param {string} contractId
 * @param {object} review — { status: 'approved'|'rejected'|'revision', comment }
 */
export async function addReview(contractId, review) {
  await waitAuth();
  const me = auth.currentUser;
  const meta = { uid: me?.uid || null, email: me?.email || null };
  // users/{uid} 에서 name 조회
  try {
    const us = await get(dbRef(db, `users/${me.uid}`));
    if (us.exists()) meta.name = us.val().name || null;
  } catch {}
  const node = push(dbRef(db, `welrix_contracts/${contractId}/reviews`));
  const data = {
    at: Date.now(),
    by_uid: meta.uid,
    by_name: meta.name || meta.email || 'admin',
    status: review.status,
    comment: review.comment || '',
  };
  await set(node, data);
  // contract status 도 최신 review 로 업데이트
  await update(dbRef(db, `welrix_contracts/${contractId}`), {
    status: review.status,
    last_review_at: data.at,
  });
  return data;
}

export function buildContractUrl(id) {
  return `${location.origin}${location.pathname}?contract=${id}`;
}
