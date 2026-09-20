<script setup>
// 상담 신청 폼 — Firebase Realtime DB /leads/ 에 저장
import { ref, onMounted } from 'vue';
import { db, waitAuth } from '../../firebase/config.js';
import { ref as dbRef, push, set, serverTimestamp } from 'firebase/database';
import { fmtTel } from '../../lib/format.js';

const form = ref({
  name: '',
  tel: '',
  vehicle: '',     // 관심 차종
  memo: '',
  privacy: false,  // 개인정보 동의
});

const sending = ref(false);
const success = ref(false);
const errorMsg = ref('');

// QuoteWidget 에서 #contact?vehicle=...&term=... 으로 점프하면 자동 채움
onMounted(() => {
  const hashRaw = location.hash || '';
  if (hashRaw.includes('?')) {
    const q = new URLSearchParams(hashRaw.split('?')[1]);
    const v = q.get('vehicle');
    const term = q.get('term');
    const monthly = q.get('monthly');
    if (v) form.value.vehicle = v;
    if (term && monthly) {
      form.value.memo = `${term}개월 견적 ${Number(monthly).toLocaleString()}원 관심`;
    }
  }
});

function onTelInput(e) {
  const v = fmtTel(e.target.value);
  form.value.tel = v;
  if (e.target.value !== v) e.target.value = v;
}

async function submit() {
  errorMsg.value = '';
  if (!form.value.name.trim()) { errorMsg.value = '이름을 입력해 주세요'; return; }
  if (!form.value.tel.trim()) { errorMsg.value = '연락처를 입력해 주세요'; return; }
  if (!form.value.privacy) { errorMsg.value = '개인정보 처리 동의가 필요합니다'; return; }
  sending.value = true;
  try {
    await waitAuth();
    const newRef = push(dbRef(db, '/leads'));
    await set(newRef, {
      name: form.value.name.trim(),
      tel: form.value.tel.trim(),
      vehicle: form.value.vehicle.trim() || null,
      memo: form.value.memo.trim() || null,
      source: 'home',
      status: 'new',
      createdAt: serverTimestamp(),
    });
    success.value = true;
  } catch (e) {
    errorMsg.value = '전송 실패: ' + (e?.message || e);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="lf">
    <div v-if="success" class="lf-success">
      <i class="ph ph-check-circle"></i>
      <h3>신청이 접수되었습니다</h3>
      <p>1영업일 이내 입력하신 연락처로 전문 상담사가 연락드립니다.<br>
        급한 문의는 <b>1544-0000</b> 으로 전화 주세요.</p>
    </div>
    <form v-else class="lf-form" @submit.prevent="submit">
      <div class="lf-row">
        <div class="lf-field">
          <label>이름 *</label>
          <input type="text" v-model="form.name" placeholder="홍길동" maxlength="20" />
        </div>
        <div class="lf-field">
          <label>연락처 *</label>
          <input
            type="text" inputmode="tel"
            :value="form.tel"
            @input="onTelInput"
            placeholder="010-0000-0000"
            maxlength="13"
          />
        </div>
      </div>

      <div class="lf-field">
        <label>관심 차종 (선택)</label>
        <input type="text" v-model="form.vehicle" placeholder="예: 현대 팰리세이드, 기아 카니발" maxlength="60" />
      </div>

      <div class="lf-field">
        <label>문의 내용 (선택)</label>
        <textarea v-model="form.memo" rows="3" placeholder="원하시는 기간, 보증금 조건, 출고 시점 등을 자유롭게 적어주세요" maxlength="300"></textarea>
      </div>

      <label class="lf-privacy">
        <input type="checkbox" v-model="form.privacy" />
        <span>상담 목적으로 개인정보(이름·연락처) 수집·이용에 동의합니다. <a href="#" @click.prevent>약관 보기</a></span>
      </label>

      <div v-if="errorMsg" class="lf-error">{{ errorMsg }}</div>

      <button type="submit" class="lf-submit" :disabled="sending">
        <i class="ph" :class="sending ? 'ph-spinner' : 'ph-paper-plane-tilt'"></i>
        {{ sending ? '신청 중…' : '무료 상담 신청' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.lf { max-width: 640px; margin: 0 auto; }

.lf-form {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 32px;
  display: flex; flex-direction: column; gap: 18px;
}
@media (max-width: 640px) { .lf-form { padding: 24px 20px; } }

.lf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 480px) { .lf-row { grid-template-columns: 1fr; } }

.lf-field { display: flex; flex-direction: column; gap: 6px; }
.lf-field label {
  font-size: 12px; font-weight: 600; color: var(--ink-2);
  letter-spacing: -0.1px;
}
.lf-field input, .lf-field textarea {
  width: 100%; padding: 12px 14px;
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-family: inherit; font-size: 14.5px;
  color: var(--ink-1);
  outline: none;
  transition: border-color var(--t-fast);
}
.lf-field input { height: 46px; }
.lf-field textarea { resize: vertical; line-height: 1.55; }
.lf-field input:focus, .lf-field textarea:focus { border-color: var(--brand); }
.lf-field input::placeholder, .lf-field textarea::placeholder { color: var(--ink-4); }

.lf-privacy {
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 12.5px; color: var(--ink-3); line-height: 1.5;
  cursor: pointer;
}
.lf-privacy input { margin-top: 3px; width: 15px; height: 15px; accent-color: var(--brand); flex-shrink: 0; cursor: pointer; }
.lf-privacy a { color: var(--brand); text-decoration: underline; }

.lf-error {
  padding: 10px 14px;
  background: rgba(225, 20, 30, 0.05);
  color: #b91c1c;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.lf-submit {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--ink-1); color: #fff;
  border: 0; border-radius: var(--radius-pill);
  padding: 16px 24px;
  font-family: inherit; font-size: 15px; font-weight: 700;
  letter-spacing: -0.2px;
  transition: background var(--t-fast), transform var(--t-fast);
}
.lf-submit:hover:not(:disabled) { background: var(--brand); transform: translateY(-1px); }
.lf-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.lf-submit i { font-size: 16px; }

.lf-success {
  text-align: center; padding: 48px 24px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.lf-success i {
  font-size: 56px; color: var(--brand);
  margin-bottom: 12px;
}
.lf-success h3 {
  margin: 0 0 10px; font-size: 22px; font-weight: 700;
  letter-spacing: -0.3px;
}
.lf-success p {
  margin: 0; color: var(--ink-3); font-size: 14px; line-height: 1.7;
}
.lf-success b { color: var(--ink-1); }
</style>
