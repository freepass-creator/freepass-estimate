<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { docStore, chatStore, quoteState } from '../store.js';
import { sendChatMessage, watchChatMessages, isManager } from '../firebase/chat.js';
import { waitAuth, auth } from '../firebase/config.js';
import { createContract, findMyContracts } from '../firebase/contracts.js';
import { fmtTel } from '../lib/format.js';

const fmtSize = (b) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;

const totalDocs = computed(() => (docStore.license ? 1 : 0) + docStore.attachments.length);

const accOpen = ref(true);
const memo = ref('');
const licDragOver = ref(false);
const attDragOver = ref(false);
const licInputEl = ref(null);
const attInputEl = ref(null);

// === 채팅: 영업자별 단일 채널 (견적 발송과 무관, 항상 활성) ===
const myUid = ref(null);
const iAmManager = ref(false);
const editingNick = ref(false);
const chatReady = ref(false);
let unsubscribeMsg = null;

onMounted(async () => {
  await waitAuth();
  myUid.value = auth.currentUser?.uid || null;
  iAmManager.value = await isManager();
  if (myUid.value) bindChat(myUid.value);
});
onUnmounted(() => {
  if (unsubscribeMsg) unsubscribeMsg();
});

function bindChat(channelUid) {
  if (unsubscribeMsg) { unsubscribeMsg(); unsubscribeMsg = null; }
  chatStore.messages.splice(0, chatStore.messages.length);
  if (!channelUid) return;
  unsubscribeMsg = watchChatMessages(channelUid, (msg) => {
    if (chatStore.messages.find(m => m.id === msg.id)) return;
    chatStore.messages.push(msg);
    nextTick(() => {
      if (chatBoxEl.value) chatBoxEl.value.scrollTop = chatBoxEl.value.scrollHeight;
    });
  });
  chatReady.value = true;
}

function onLicChange(e) {
  docStore.license = e.target.files[0] || null;
}
function removeLicense() {
  docStore.license = null;
  if (licInputEl.value) licInputEl.value.value = '';
}
function onLicDrop(e) {
  e.preventDefault();
  licDragOver.value = false;
  const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
  if (files.length) docStore.license = files[0];
}

function onAttChange(e) {
  docStore.attachments.push(...Array.from(e.target.files || []));
  if (attInputEl.value) attInputEl.value.value = '';
}
function removeAtt(i) {
  docStore.attachments.splice(i, 1);
}
function onAttDrop(e) {
  e.preventDefault();
  attDragOver.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length) docStore.attachments.push(...files);
}

const submitting = ref(false);
const submittedId = ref('');
const submitPin = ref('');

// 손님 정보 — 이름만 (연락처는 손님이 꺼릴 수 있어 받지 않음, 메모로 보강)
const custName = ref('');

// 본인 확인 (다른 견적/세션)
const checkOpen = ref(false);
const checkTel = ref('');
const checkPin = ref('');
const checking = ref(false);
const myContracts = ref([]);

function onStaffTelInput(e) {
  quoteState.staff.tel = fmtTel(e.target.value);
}
function onCheckTelInput(e) {
  checkTel.value = fmtTel(e.target.value);
}

async function submit() {
  if (!docStore.license) { alert('운전면허증을 첨부해 주세요.'); return; }
  if (!quoteState.staff.name?.trim() || !quoteState.staff.tel?.trim()) {
    alert('영업자 정보 (이름·연락처) 를 입력해 주세요.'); return;
  }
  if (!/^\d{4}$/.test(submitPin.value)) {
    alert('PIN 4자리를 입력해 주세요. (본인 확인용)'); return;
  }
  if (submitting.value) return;
  submitting.value = true;
  try {
    if (!custName.value?.trim()) {
      alert('손님 이름을 입력해 주세요.'); submitting.value = false; return;
    }
    const { contract_id } = await createContract({
      staff: {
        name: quoteState.staff.name.trim(),
        tel: quoteState.staff.tel.trim(),
      },
      customer: {
        name: custName.value.trim(),
      },
      license: docStore.license,
      attachments: docStore.attachments || [],
      memo: memo.value || '',
      quoteId: quoteState._lastSentQuoteId || null,
      pin: submitPin.value,
    });
    // 본인 추적용 — localStorage 에 contract_id 누적
    if (!quoteState.myContracts.includes(contract_id)) {
      quoteState.myContracts.unshift(contract_id);
    }
    submittedId.value = contract_id;
    alert(`심사 접수 완료\n접수 번호: ${contract_id}\nPIN 은 잘 보관해 주세요.`);
    docStore.license = null;
    docStore.attachments.splice(0, docStore.attachments.length);
    memo.value = '';
    submitPin.value = '';
    custName.value = '';
    if (licInputEl.value) licInputEl.value.value = '';
    if (attInputEl.value) attInputEl.value.value = '';
  } catch (e) {
    alert('업로드 실패: ' + (e?.message || e));
  } finally {
    submitting.value = false;
  }
}

async function onCheck() {
  if (!checkTel.value?.trim()) { alert('연락처를 입력하세요'); return; }
  if (!/^\d{4}$/.test(checkPin.value)) { alert('PIN 4자리를 입력하세요'); return; }
  checking.value = true;
  myContracts.value = [];
  try {
    const list = await findMyContracts(checkTel.value, checkPin.value);
    myContracts.value = list;
    if (!list.length) alert('일치하는 심사 요청이 없습니다');
  } catch (e) {
    alert('조회 실패: ' + (e?.message || e));
  } finally {
    checking.value = false;
  }
}

const STATUS_LABEL = {
  pending: { label: '대기', color: '#f59e0b' },
  approved: { label: '승인', color: '#10b981' },
  rejected: { label: '반려', color: '#ef4444' },
  revision: { label: '보완 요청', color: '#3b82f6' },
};
function fmtDate(ts) {
  return new Date(ts).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function latestReview(c) {
  const r = c.reviews ? Object.values(c.reviews) : [];
  return r.sort((a,b) => b.at - a.at)[0] || null;
}

// === 채팅 입력 ===
const chatInput = ref('');
const chatBoxEl = ref(null);
const sending = ref(false);

async function sendMsg() {
  const text = chatInput.value.trim();
  if (!text) return;
  if (!chatReady.value) {
    alert('채팅 연결 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  sending.value = true;
  try {
    await sendChatMessage(text, chatStore.nickname);
    chatInput.value = '';
  } catch (e) {
    console.error('[chat]', e);
    alert('전송 실패: ' + (e.message || e));
  } finally {
    sending.value = false;
  }
}
function onChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
}
function startEditNick() { editingNick.value = true; }
function commitNick(e) {
  const v = (e.target.value || '').trim();
  if (v) chatStore.nickname = v;  // store watch 가 localStorage 저장
  editingNick.value = false;
}
function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <!-- 심사 접수 -->
  <details class="contract-top" :open="accOpen" @toggle="accOpen = $event.target.open">
    <summary class="contract-acc-summary">
      <span class="contract-pane-title" style="margin:0;">
        <i class="ph ph-clipboard-text"></i>심사 접수
      </span>
      <span class="contract-acc-count" :class="{ has: totalDocs > 0 }">
        {{ totalDocs ? totalDocs + '건' : '' }}
      </span>
      <span class="contract-acc-caret"></span>
    </summary>
    <div class="contract-acc-body">
      <!-- 영업자 본인 확인 정보 — 이름 / 연락처 / PIN 한 카드로 -->
      <div class="contract-staff-card">
        <div class="contract-staff-card__title">
          <i class="ph ph-shield-check"></i>
          영업자 본인 확인 정보
        </div>
        <input class="contract-staff__input"
               v-model="quoteState.staff.name"
               placeholder="영업자 이름" />
        <input class="contract-staff__input"
               :value="quoteState.staff.tel"
               @input="onStaffTelInput"
               placeholder="연락처 010-0000-0000"
               inputmode="tel" />
        <div class="contract-staff__pin-row">
          <input class="contract-staff__pin" type="password" inputmode="numeric" maxlength="4"
                 v-model="submitPin" placeholder="PIN 4자리" />
          <small>※ 연락처 + PIN 으로 본인 심사 결과 확인</small>
        </div>
      </div>

      <!-- 손님 정보 — 매 심사마다 새로 입력 (연락처는 받지 않음) -->
      <div class="contract-staff-card">
        <div class="contract-staff-card__title">
          <i class="ph ph-user"></i>
          심사 대상 손님
        </div>
        <input class="contract-staff__input"
               v-model="custName"
               placeholder="손님 이름 (예: 홍길동)" />
        <small class="contract-staff-card__hint">
          ※ 같은 손님의 추가 서류는 <b>동일한 이름</b>으로 입력하면 한 건으로 묶입니다
        </small>
      </div>

      <!-- 면허증 -->
      <label class="doc-dropzone single"
        :class="{ dragover: licDragOver, 'has-file': !!docStore.license }"
        @dragenter.prevent="licDragOver = true"
        @dragover.prevent="licDragOver = true"
        @dragleave.prevent="licDragOver = false"
        @drop="onLicDrop">
        <span class="doc-dz-icon"><i class="ph ph-identification-card"></i></span>
        <span class="doc-dz-text">
          <b>운전면허증 <em>필수</em></b>
          <small>이미지/PDF · 끌어 놓거나 클릭</small>
        </span>
        <input ref="licInputEl" type="file" hidden accept="image/*,.pdf" @change="onLicChange" />
      </label>
      <div v-if="docStore.license" class="doc-file-list">
        <div class="doc-file-item">
          <i class="ph ph-file-text"></i>
          <span class="name">{{ docStore.license.name }}</span>
          <span class="size">{{ fmtSize(docStore.license.size) }}</span>
          <span class="remove" @click="removeLicense">✕</span>
        </div>
      </div>

      <!-- 첨부서류 -->
      <label class="doc-dropzone"
        style="margin-top:8px;"
        :class="{ dragover: attDragOver, 'has-file': docStore.attachments.length > 0 }"
        @dragenter.prevent="attDragOver = true"
        @dragover.prevent="attDragOver = true"
        @dragleave.prevent="attDragOver = false"
        @drop="onAttDrop">
        <span class="doc-dz-icon"><i class="ph ph-paperclip"></i></span>
        <span class="doc-dz-text">
          <b>첨부서류</b>
          <small>신분증·소득증빙 등 · 끌어 놓거나 클릭 (여러 파일)</small>
        </span>
        <input ref="attInputEl" type="file" hidden multiple accept="image/*,.pdf" @change="onAttChange" />
      </label>
      <div v-if="docStore.attachments.length" class="doc-file-list">
        <div v-for="(f, i) in docStore.attachments" :key="i" class="doc-file-item">
          <i class="ph ph-file-text"></i>
          <span class="name">{{ f.name }}</span>
          <span class="size">{{ fmtSize(f.size) }}</span>
          <span class="remove" @click="removeAtt(i)">✕</span>
        </div>
      </div>

      <textarea class="contract-memo" rows="2" placeholder="추가 요청사항이나 메모" style="margin-top:10px;" v-model="memo"></textarea>

      <button class="contract-submit" @click="submit" :disabled="submitting">
        <template v-if="submitting"><i class="ph ph-spinner"></i> 업로드 중...</template>
        <template v-else>계약 심사 요청 <i class="ph ph-arrow-right"></i></template>
      </button>
      <div v-if="submittedId" class="contract-submitted">
        <i class="ph ph-check-circle"></i>
        접수 완료 · <b>{{ submittedId }}</b>
      </div>

      <!-- 본인 확인 — 다른 세션/디바이스에서도 가능 -->
      <details class="contract-check" :open="checkOpen" @toggle="checkOpen = $event.target.open" style="margin-top:14px;">
        <summary>
          <i class="ph ph-magnifying-glass"></i> 내 심사 요청 확인
        </summary>
        <div class="contract-check__body">
          <input class="contract-staff__input" :value="checkTel" @input="onCheckTelInput"
                 placeholder="연락처 010-0000-0000" inputmode="tel" />
          <input class="contract-staff__input" type="password" inputmode="numeric" maxlength="4"
                 v-model="checkPin" placeholder="PIN 4자리" />
          <button class="contract-submit" @click="onCheck" :disabled="checking" style="margin-top:6px;">
            <template v-if="checking"><i class="ph ph-spinner"></i> 조회 중...</template>
            <template v-else>조회 <i class="ph ph-arrow-right"></i></template>
          </button>
          <div v-if="myContracts.length" class="my-contracts">
            <div v-for="c in myContracts" :key="c.contract_id" class="my-contract">
              <div class="my-contract__head">
                <span class="my-contract__id">{{ c.contract_id }}</span>
                <span class="my-contract__st" :style="{
                  background: (STATUS_LABEL[c.status]?.color || '#888') + '1a',
                  color: STATUS_LABEL[c.status]?.color || '#888',
                }">{{ STATUS_LABEL[c.status]?.label || c.status }}</span>
              </div>
              <div class="my-contract__meta">손님 {{ c.customer?.name || '-' }} · {{ fmtDate(c.created_at) }}</div>
              <div v-if="latestReview(c)" class="my-contract__review">
                <i class="ph ph-quotes"></i>
                {{ latestReview(c).comment || '(코멘트 없음)' }}
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  </details>

  <!-- 채팅 — 영업담당 ↔ 견적관리자 (항상 활성) -->
  <div class="contract-bottom">
    <div class="contract-pane-title">
      <i class="ph ph-chat-circle"></i>관리자 채팅
      <span class="badge" v-show="chatStore.messages.length">{{ chatStore.messages.length }}</span>
      <span class="chat-state-hint" v-if="!chatReady">연결 중...</span>
    </div>
    <div ref="chatBoxEl" class="chat-messages">
      <div v-if="chatStore.messages.length === 0" class="chat-system">
        <i class="ph ph-chat-circle"></i>
        <span>견적관리자와 자유롭게 대화하세요.<br>견적 발송 시 자동으로 발송 기록이 채팅에 남습니다.</span>
      </div>
      <div v-for="m in chatStore.messages" :key="m.id"
           class="chat-msg" :class="{
             me: m.uid === myUid && m.sender !== 'system',
             them: m.uid !== myUid && m.sender !== 'system',
             manager: m.sender === 'manager',
             system: m.sender === 'system',
           }">
        <div class="chat-msg__author" v-if="m.sender !== 'system'">
          <span class="role-tag" v-if="m.sender === 'manager'">관리자</span>
          {{ m.name || (m.sender === 'manager' ? '견적관리자' : '영업담당') }}
          <span class="chat-msg__time">{{ fmtTime(m.at) }}</span>
        </div>
        <div class="chat-msg__text">{{ m.text }}</div>
        <div class="chat-msg__time chat-msg__time--system" v-if="m.sender === 'system'">{{ fmtTime(m.at) }}</div>
      </div>
    </div>
    <div class="chat-input-row">
      <textarea class="chat-input" rows="1"
                placeholder="메시지 (Enter 전송, Shift+Enter 줄바꿈)"
                :disabled="!chatReady || sending"
                v-model="chatInput" @keydown="onChatKey"></textarea>
      <button class="chat-send" title="전송" aria-label="전송"
              :disabled="!chatReady || sending || !chatInput.trim()"
              @click="sendMsg">
        <i class="ph ph-paper-plane-tilt"></i>
      </button>
    </div>
    <div class="chat-user-bar">
      <template v-if="!editingNick">
        <span class="chat-user-name" @click="startEditNick" title="클릭하면 변경">
          <i class="ph ph-user"></i>{{ chatStore.nickname }}
          <i class="ph ph-pencil-simple chat-edit-icon"></i>
        </span>
      </template>
      <template v-else>
        <input type="text" class="chat-nick-input"
               :value="chatStore.nickname"
               @blur="commitNick"
               @keydown.enter="commitNick($event)"
               placeholder="예: 신촌점 홍길동"
               maxlength="60" autofocus />
      </template>
      <span class="chat-help">대화명 = 관리자에게 표시되는 이름</span>
    </div>
  </div>
</template>
