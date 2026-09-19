// 관리자 페이지 — ?admin=1 로 접속 시 영업 UI 대신 admin 대시보드 표시
// 인증: freepasserp3 Firebase Auth (이메일/비번) 공유
// 권한: users/{auth.uid}/role in ['admin', 'agent_admin', 'agent_manager']

import { auth, db } from './firebase/config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { listContracts, loadContract, addReview } from './firebase/contracts.js';
import { fetchAllChannels, sendChatMessage, watchChatMessages } from './firebase/chat.js';

const params = new URLSearchParams(location.search);
const isAdminMode = params.get('admin') === '1';

if (isAdminMode) {
  document.documentElement.classList.add('admin-mode');
  boot();
}

const STATE = {
  user: null,         // Firebase user
  profile: null,      // { role, name, email, ... } from users/{uid}
  ready: false,
  error: null,
};

async function boot() {
  // body 가 mount 되기 전 미리 admin shell 깔기
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-boot">
        <i class="ph ph-spinner"></i>
        <p>관리자 페이지 로딩 중...</p>
      </div>
    </div>
  `;

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.warn('[admin] setPersistence:', e?.code || e);
  }

  // auth 상태 watch
  onAuthStateChanged(auth, async (user) => {
    STATE.user = user;
    if (!user || user.isAnonymous) {
      // 익명이거나 미로그인 → 로그인 화면
      STATE.profile = null;
      renderLogin();
      return;
    }
    // 로그인됨 → role 조회
    try {
      const snap = await get(ref(db, `users/${user.uid}`));
      const profile = snap.val() || {};
      STATE.profile = profile;
      if (!hasAdminRole(profile)) {
        renderForbidden(profile);
        return;
      }
      renderDashboard();
    } catch (e) {
      console.error('[admin] profile fetch:', e);
      STATE.error = e.message || String(e);
      renderError();
    }
  });
}

function hasAdminRole(profile) {
  if (!profile?.role) return false;
  return ['admin', 'agent_admin', 'agent_manager'].includes(profile.role);
}

// ============ 화면 렌더링 ============

function renderLogin() {
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-login">
        <div class="adm-login__head">
          <div class="brand">WELRIX MOBILITY</div>
          <h2>관리자 로그인</h2>
          <p>견적관리자 / 영업관리자 계정으로 로그인하세요</p>
        </div>
        <form class="adm-login__form" id="adm-login-form">
          <label>
            <span>이메일</span>
            <input type="email" id="adm-email" required autocomplete="username" autofocus />
          </label>
          <label>
            <span>비밀번호</span>
            <input type="password" id="adm-password" required autocomplete="current-password" />
          </label>
          <div class="adm-login__error" id="adm-login-error" hidden></div>
          <button type="submit" class="adm-login__submit">
            <i class="ph ph-sign-in"></i> 로그인
          </button>
          <div class="adm-login__hint">
            계정 발급은 시스템 관리자에게 문의하세요.<br>
            영업자는 로그인 없이 메인 페이지에서 사용 가능합니다.
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('adm-login-form').addEventListener('submit', onLoginSubmit);
}

async function onLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('adm-email').value.trim();
  const password = document.getElementById('adm-password').value;
  const errorEl = document.getElementById('adm-login-error');
  const submitBtn = e.target.querySelector('button[type=submit]');

  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="ph ph-spinner"></i> 로그인 중...';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // 성공하면 onAuthStateChanged 가 다음 단계로 이끔
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = parseAuthError(err);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ph ph-sign-in"></i> 로그인';
  }
}

function parseAuthError(err) {
  const code = err?.code || '';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (code.includes('too-many-requests')) {
    return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.';
  }
  if (code.includes('network-request-failed')) {
    return '네트워크 연결을 확인하세요.';
  }
  return err?.message || '로그인 실패';
}

function renderForbidden(profile) {
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-forbidden">
        <i class="ph ph-warning-octagon"></i>
        <h2>접근 권한이 없습니다</h2>
        <p>${escapeHtml(profile.email || STATE.user.email)} 계정은 welrix 관리자 권한이 없습니다.<br>
           시스템 관리자에게 권한 부여를 요청하세요.</p>
        <div class="adm-forbidden__meta">
          현재 role: <code>${profile.role || '(없음)'}</code> · 필요: <code>admin / agent_admin / agent_manager</code>
        </div>
        <button class="adm-btn outline" id="adm-logout">
          <i class="ph ph-sign-out"></i> 다른 계정으로 로그인
        </button>
      </div>
    </div>
  `;
  document.getElementById('adm-logout').addEventListener('click', () => signOut(auth));
}

function renderError() {
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-forbidden">
        <i class="ph ph-warning-circle"></i>
        <h2>오류 발생</h2>
        <p><small>${escapeHtml(STATE.error || '알 수 없는 오류')}</small></p>
      </div>
    </div>
  `;
}

let currentTab = 'contracts';  // contracts | chats | quotes

async function renderDashboard() {
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-header">
        <div class="adm-header__brand">
          <i class="ph ph-shield-check"></i>
          <span>WELRIX 관리자</span>
        </div>
        <div class="adm-header__user">
          <span>${escapeHtml(STATE.profile.name || STATE.user.email)}</span>
          <span class="adm-header__role">${escapeHtml(STATE.profile.role)}</span>
          <button class="adm-btn ghost" id="adm-logout"><i class="ph ph-sign-out"></i>로그아웃</button>
        </div>
      </div>
      <div class="adm-tabs">
        <button class="adm-tab" data-tab="contracts"><i class="ph ph-clipboard-text"></i>심사 접수</button>
        <button class="adm-tab" data-tab="chats"><i class="ph ph-chat-circle-dots"></i>채팅</button>
        <button class="adm-tab" data-tab="quotes"><i class="ph ph-file-text"></i>발송 견적</button>
      </div>
      <div class="adm-body" id="adm-body">
        <div class="adm-empty">로딩 중…</div>
      </div>
    </div>
  `;
  document.getElementById('adm-logout').addEventListener('click', () => signOut(auth));
  document.querySelectorAll('.adm-tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  switchTab(currentTab);
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.adm-tab').forEach(t => {
    t.classList.toggle('is-active', t.dataset.tab === tab);
  });
  const body = document.getElementById('adm-body');
  body.innerHTML = '<div class="adm-empty">로딩 중…</div>';
  if (tab === 'contracts') return renderContractsTab(body);
  if (tab === 'chats')     return renderChatsTab(body);
  if (tab === 'quotes')    return renderQuotesTab(body);
}

async function renderContractsTab(body) {
  body.innerHTML = `
    <div class="adm-section">
      <h2 class="adm-section-title">계약 심사 접수 목록</h2>
      <div class="adm-list" id="adm-list"><div class="adm-empty">로딩 중…</div></div>
    </div>`;
  try {
    const contracts = await listContracts({ limit: 200 });
    renderList(contracts);
  } catch (e) {
    document.getElementById('adm-list').innerHTML = `<div class="adm-empty">로드 실패: ${escapeHtml(e.message || e)}</div>`;
  }
}

// === 채팅 탭 — 영업 채널 목록 + 선택 시 양방향 대화 ===
async function renderChatsTab(body) {
  body.innerHTML = `
    <div class="adm-section adm-chats">
      <div class="adm-chats__list">
        <h3>영업 채널</h3>
        <div id="adm-chat-channels"><div class="adm-empty">로딩 중…</div></div>
      </div>
      <div class="adm-chats__panel" id="adm-chat-panel">
        <div class="adm-empty">좌측 채널을 선택하세요</div>
      </div>
    </div>`;
  try {
    const channels = await fetchAllChannels();
    const list = document.getElementById('adm-chat-channels');
    if (!channels.length) {
      list.innerHTML = '<div class="adm-empty">채널이 없습니다</div>';
      return;
    }
    list.innerHTML = channels.map(c => `
      <button class="adm-chat-row" data-uid="${escapeHtml(c.staff_uid)}">
        <div class="adm-chat-row__main">
          <div class="adm-chat-row__nick">${escapeHtml(c.nickname || c.staff_uid.slice(0,8))}</div>
          <div class="adm-chat-row__last">${escapeHtml(c.lastMessage?.text?.slice(0,40) || '(메시지 없음)')}</div>
        </div>
        ${c.lastMessage?.at ? `<div class="adm-chat-row__time">${fmtTime(c.lastMessage.at)}</div>` : ''}
      </button>
    `).join('');
    list.querySelectorAll('.adm-chat-row').forEach(r => {
      r.addEventListener('click', () => openChannel(r.dataset.uid, r.querySelector('.adm-chat-row__nick').textContent));
    });
  } catch (e) {
    document.getElementById('adm-chat-channels').innerHTML = `<div class="adm-empty">로드 실패: ${escapeHtml(e.message || e)}</div>`;
  }
}

let unsubChatMsg = null;
function openChannel(staffUid, nickname) {
  if (unsubChatMsg) { unsubChatMsg(); unsubChatMsg = null; }
  document.querySelectorAll('.adm-chat-row').forEach(r => {
    r.classList.toggle('is-active', r.dataset.uid === staffUid);
  });
  const panel = document.getElementById('adm-chat-panel');
  panel.innerHTML = `
    <div class="adm-chat-head">
      <i class="ph ph-user-circle"></i>
      <b>${escapeHtml(nickname)}</b>
    </div>
    <div class="adm-chat-messages" id="adm-chat-msgs"></div>
    <form class="adm-chat-input" id="adm-chat-form">
      <input id="adm-chat-text" placeholder="메시지를 입력하세요" autocomplete="off" />
      <button type="submit"><i class="ph ph-paper-plane-tilt"></i></button>
    </form>`;
  const msgsEl = document.getElementById('adm-chat-msgs');
  const seen = new Set();
  unsubChatMsg = watchChatMessages(staffUid, (msg) => {
    if (seen.has(msg.id)) return;
    seen.add(msg.id);
    const me = auth.currentUser?.uid;
    const mine = msg.uid === me;
    const div = document.createElement('div');
    div.className = 'adm-chat-msg ' + (mine ? 'mine' : 'them');
    div.innerHTML = `
      <div class="adm-chat-msg__name">${escapeHtml(msg.name || '')}</div>
      <div class="adm-chat-msg__text">${escapeHtml(msg.text || '')}</div>
      <div class="adm-chat-msg__at">${fmtTime(msg.at)}</div>`;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  });

  document.getElementById('adm-chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('adm-chat-text');
    const text = input.value.trim();
    if (!text) return;
    try {
      await sendChatMessage(text, STATE.profile.name || 'admin', staffUid);
      input.value = '';
    } catch (err) {
      alert('전송 실패: ' + (err?.message || err));
    }
  });
}

// === 발송 견적 탭 ===
async function renderQuotesTab(body) {
  body.innerHTML = `
    <div class="adm-section">
      <h2 class="adm-section-title">영업 발송 견적</h2>
      <div class="adm-list" id="adm-quote-list"><div class="adm-empty">로딩 중…</div></div>
    </div>`;
  try {
    const snap = await get(ref(db, 'welrix_quotes'));
    const quotes = snap.exists()
      ? Object.values(snap.val()).sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, 200)
      : [];
    const el = document.getElementById('adm-quote-list');
    if (!quotes.length) { el.innerHTML = '<div class="adm-empty">발송된 견적이 없습니다.</div>'; return; }
    el.innerHTML = quotes.map(q => {
      const v = (q.vehicles && q.vehicles[0]) || {};
      const date = q.created_at ? new Date(q.created_at).toLocaleString('ko-KR') : '';
      return `
        <div class="adm-contract-row" data-id="${q.quote_id}">
          <div class="adm-contract-row__main">
            <div class="adm-contract-row__id">${escapeHtml(q.quote_id)}</div>
            <div class="adm-contract-row__cust">손님 ${escapeHtml(q.customer?.name || '-')} · ${escapeHtml(v.brand || '')} ${escapeHtml(v.model || '')} ${escapeHtml(v.trim_name || '')}</div>
            <div class="adm-contract-row__date">${date} · 영업 ${escapeHtml(q.staff?.name || '익명')}</div>
          </div>
          <i class="ph ph-caret-right adm-contract-row__chev"></i>
        </div>`;
    }).join('');
    el.querySelectorAll('.adm-contract-row').forEach(r => {
      r.addEventListener('click', () => openQuote(r.dataset.id));
    });
  } catch (e) {
    document.getElementById('adm-quote-list').innerHTML = `<div class="adm-empty">로드 실패: ${escapeHtml(e.message || e)}</div>`;
  }
}

async function openQuote(id) {
  window.open(`/?q=${id}`, '_blank');
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL = {
  pending: { label: '대기', color: '#f59e0b' },
  approved: { label: '승인', color: '#10b981' },
  rejected: { label: '반려', color: '#ef4444' },
  revision: { label: '보완', color: '#3b82f6' },
};

function renderList(contracts) {
  const el = document.getElementById('adm-list');
  if (!contracts.length) {
    el.innerHTML = '<div class="adm-empty">접수된 계약 심사 요청이 없습니다.</div>';
    return;
  }
  el.innerHTML = contracts.map(c => {
    const st = STATUS_LABEL[c.status] || STATUS_LABEL.pending;
    const date = c.created_at ? new Date(c.created_at).toLocaleString('ko-KR') : '';
    const attCount = (c.files?.attachments || []).length + (c.files?.license ? 1 : 0);
    return `
      <div class="adm-contract-row" data-id="${c.contract_id}">
        <span class="adm-st" style="background:${st.color}1a;color:${st.color};">${st.label}</span>
        <div class="adm-contract-row__main">
          <div class="adm-contract-row__id">${escapeHtml(c.contract_id)}</div>
          <div class="adm-contract-row__cust">손님: ${escapeHtml(c.customer?.name || '-')} · 영업: ${escapeHtml(c.staff?.name || '-')}</div>
          <div class="adm-contract-row__date">${date} · 첨부 ${attCount}건</div>
        </div>
        <i class="ph ph-caret-right adm-contract-row__chev"></i>
      </div>
    `;
  }).join('');
  el.querySelectorAll('.adm-contract-row').forEach(row => {
    row.addEventListener('click', () => openContract(row.dataset.id));
  });
}

async function openContract(id) {
  const c = await loadContract(id);
  if (!c) { alert('계약 정보를 찾을 수 없습니다'); return; }
  const st = STATUS_LABEL[c.status] || STATUS_LABEL.pending;
  const date = c.created_at ? new Date(c.created_at).toLocaleString('ko-KR') : '';
  const license = c.files?.license;
  const atts = c.files?.attachments || [];
  const reviews = c.reviews ? Object.values(c.reviews).sort((a,b) => a.at - b.at) : [];

  const html = `
    <div class="adm-modal-bd" id="adm-modal-bd">
      <div class="adm-modal">
        <div class="adm-modal__head">
          <h3>계약 심사 — ${escapeHtml(c.contract_id)}
            <span class="adm-st" style="background:${st.color}1a;color:${st.color};margin-left:8px;">${st.label}</span>
          </h3>
          <button class="adm-btn ghost" id="adm-modal-close"><i class="ph ph-x"></i></button>
        </div>
        <div class="adm-modal__body">
          <div class="adm-meta">
            <div><b>접수일</b> ${date}</div>
            <div><b>손님</b> ${escapeHtml(c.customer?.name || '-')} (${escapeHtml(c.customer?.tel || '-')})</div>
            <div><b>영업자</b> ${escapeHtml(c.staff?.name || '-')} (${escapeHtml(c.staff?.tel || '-')})</div>
            ${c.quote_id ? `<div><b>견적</b> <a href="/?q=${escapeHtml(c.quote_id)}" target="_blank">${escapeHtml(c.quote_id)} 열기</a></div>` : ''}
            ${c.memo ? `<div><b>메모</b> ${escapeHtml(c.memo)}</div>` : ''}
          </div>

          <h4>첨부 서류</h4>
          <div class="adm-files">
            ${license ? `<a class="adm-file" href="${escapeHtml(license.download_url)}" target="_blank">
              <i class="ph ph-identification-card"></i>
              <div><div><b>운전면허증</b></div><div class="adm-file__meta">${escapeHtml(license.name)} · ${fmtSize(license.size)}</div></div>
            </a>` : '<div class="adm-empty">운전면허증 없음</div>'}
            ${atts.map(a => `
              <a class="adm-file" href="${escapeHtml(a.download_url)}" target="_blank">
                <i class="ph ph-file-text"></i>
                <div><div>${escapeHtml(a.name)}</div><div class="adm-file__meta">${fmtSize(a.size)}</div></div>
              </a>
            `).join('')}
          </div>

          ${reviews.length ? `<h4>심사 이력</h4><div class="adm-reviews">
            ${reviews.map(r => {
              const rst = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
              return `<div class="adm-review">
                <div class="adm-review__head">
                  <span class="adm-st" style="background:${rst.color}1a;color:${rst.color};">${rst.label}</span>
                  <span class="adm-review__by">${escapeHtml(r.by_name || '')}</span>
                  <span class="adm-review__at">${new Date(r.at).toLocaleString('ko-KR')}</span>
                </div>
                <div class="adm-review__comment">${escapeHtml(r.comment || '(코멘트 없음)')}</div>
              </div>`;
            }).join('')}
          </div>` : ''}

          <h4>심사 결과 입력</h4>
          <div class="adm-review-form">
            <textarea id="adm-rv-comment" rows="3" placeholder="검토 코멘트 (필수 보완사항 등 명확히)"></textarea>
            <div class="adm-review-form__btns">
              <button class="adm-btn approve" data-st="approved"><i class="ph ph-check-circle"></i> 승인</button>
              <button class="adm-btn revision" data-st="revision"><i class="ph ph-pencil"></i> 보완 요청</button>
              <button class="adm-btn reject" data-st="rejected"><i class="ph ph-x-circle"></i> 반려</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstElementChild);
  document.getElementById('adm-modal-close').addEventListener('click', closeContract);
  document.getElementById('adm-modal-bd').addEventListener('click', (e) => {
    if (e.target.id === 'adm-modal-bd') closeContract();
  });
  document.querySelectorAll('.adm-review-form__btns .adm-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const status = btn.dataset.st;
      const comment = document.getElementById('adm-rv-comment').value.trim();
      if (!comment && status !== 'approved') { alert('코멘트를 입력하세요.'); return; }
      btn.disabled = true;
      try {
        await addReview(id, { status, comment });
        closeContract();
        renderDashboard();
      } catch (e) {
        alert('심사 저장 실패: ' + (e?.message || e));
        btn.disabled = false;
      }
    });
  });
}

function closeContract() {
  const bd = document.getElementById('adm-modal-bd');
  if (bd) bd.remove();
}

function fmtSize(b) {
  if (!b) return '';
  if (b < 1024) return b + 'B';
  if (b < 1048576) return (b/1024).toFixed(1) + 'KB';
  return (b/1048576).toFixed(1) + 'MB';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}
