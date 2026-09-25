<script setup>
import { computed } from 'vue';
import { quoteState } from '../../store.js';
import { 담당자인가 } from '../../lib/role.js';
import { QUOTE_TERMS } from '../../lib/quote/terms.js';

const 담당자 = 담당자인가();
const TERMS = QUOTE_TERMS;
const KMS = [1, 2, 3, 4];
/* ★웰릭스 계산 서버는 신용을 «고신용·중신용·저신용» 셋만 받는다.
   예전 첫 칸 '신용' 은 서버가 「허용되지 않은 값: credit」으로 돌려보내 계산이 멈췄다. */
const CREDITS = [
  { value: '고신용', label: '고신용' },
  { value: '중신용', label: '중신용' },
  { value: '저신용', label: '저신용' },
];

const selectedTerms = computed(() => (quoteState.scenarios || []).map(s => s.term));

function toggleTerm(t) {
  const list = quoteState.scenarios || [];
  const idx = list.findIndex(s => s.term === t);
  if (idx >= 0) {
    if (list.length === 1) return;
    list.splice(idx, 1);
  } else {
    list.push({ term: t, dep: quoteState.cond.dep || 10, pre: quoteState.cond.pre || 0 });
    list.sort((a, b) => b.term - a.term);
  }
  /* 발송 체크 배열도 현재 기간 개수와 정확히 맞춘다. */
  if (!Array.isArray(quoteState.send)) quoteState.send = [];
  while (quoteState.send.length < list.length) quoteState.send.push(true);
  if (quoteState.send.length > list.length) quoteState.send.splice(list.length);
}

</script>

<template>
  <div class="sc">
    <h2 class="sc-title">계약 조건을<br>설정해 주세요</h2>

    <div class="sc-field">
      <div class="sc-label">
        기간 <span class="sc-label__hint">복수 선택 가능</span>
      </div>
      <div class="sc-chips">
        <button
          v-for="t in TERMS" :key="t"
          type="button"
          class="sc-chip" :class="{ 'is-selected': selectedTerms.includes(t) }"
          :aria-pressed="selectedTerms.includes(t)"
          @click="toggleTerm(t)"
        >{{ t }}개월</button>
      </div>
    </div>

    <div class="sc-field">
      <div class="sc-label">약정 주행거리</div>
      <div class="sc-chips">
        <button
          v-for="k in KMS" :key="k"
          class="sc-chip" :class="{ 'is-selected': quoteState.cond.km == k }"
          @click="quoteState.cond.km = k"
        >{{ k }}만km/년</button>
      </div>
    </div>

    <!-- 신용은 «담당자만» 고른다. 손님이 「저신용」을 고르면 값이 확 뛴다 —
         손님 화면은 중신용 고정이고 아래 고지로 알린다. -->
    <div class="sc-field" v-if="담당자">
      <div class="sc-label">신용</div>
      <div class="sc-chips">
        <button
          v-for="c in CREDITS" :key="c.value"
          class="sc-chip" :class="{ 'is-selected': quoteState.cond.credit === c.value }"
          @click="quoteState.cond.credit = c.value"
        >{{ c.label }}</button>
      </div>
    </div>

    <!-- ★손님에게는 등급 이름을 보이지 않는다 — 「신용점수 무관」 (대표 2026-09-18).
         계산은 여전히 중신용으로 한다(웰릭스는 고·중·저만 받는다). -->
    <p v-if="!담당자" class="sc-note">
      <b>신용점수 무관</b> 기준입니다. 심사 결과에 따라 달라질 수 있습니다.
    </p>

    <!-- 보증금·선납금·수수료는 시작(제조사) 화면에서 입력 — 단일 입력처로 통일.
         ★손님에게는 그 칸 자체가 없으므로 이 안내도 안 보인다. -->
    <p v-if="담당자" class="sc-note">
      보증금·선납금·수수료는 <b>시작 화면</b>에서 설정합니다.
      <span class="sc-note__cur">현재 수수료 {{ quoteState.cond.feeRatePct }}% · 보증금 {{ quoteState.cond.dep }}% · 선납금 {{ quoteState.cond.pre }}%</span>
    </p>
  </div>
</template>

<style scoped>
.sc-title {
  font-size: var(--fs-2xl); font-weight: var(--fw-bold);
  color: var(--ink-1); margin: 0 0 24px;
  line-height: 1.35; letter-spacing: -0.5px;
}
.sc-field { margin-bottom: 22px; }
.sc-label {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: var(--fs-md); font-weight: var(--fw-semi); color: var(--ink-2);
  margin-bottom: 10px; letter-spacing: -0.2px;
}
.sc-label__hint {
  font-size: var(--fs-xs); color: var(--ink-4); font-weight: var(--fw-regular);
}
.sc-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.sc-note {
  margin: 4px 0 0; padding: 12px 14px;
  background: var(--bg-soft); border-radius: var(--r-chip);
  font-size: var(--fs-sm); color: var(--ink-3); line-height: 1.5;
  letter-spacing: -0.2px;
}
.sc-note b { color: var(--ink-2); font-weight: var(--fw-semi); }
.sc-note__cur {
  display: block; margin-top: 4px;
  font-variant-numeric: tabular-nums; color: var(--ink-2);
}
.sc-chip {
  min-height: var(--h-chip);
  padding: 10px 14px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-chip);
  font-family: inherit; font-size: var(--fs-base); font-weight: var(--fw-medium);
  color: var(--ink-2);
  cursor: pointer;
  transition: background .12s, color .12s, border-color .12s;
}
.sc-chip:active { background: var(--brand-50); }
.sc-chip.is-selected {
  background: var(--brand-50);
  border-color: transparent;
  color: var(--brand);
  font-weight: var(--fw-bold);
}

/* 보증금/선납금/수수료 — 직접 입력 */
.sc-pct {
  display: flex; align-items: baseline; gap: 4px;
  height: var(--h-input);
  padding: 0 14px;
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: var(--r-chip);
  transition: border-color .12s;
}
.sc-pct:focus-within { border-color: var(--brand); }
.sc-pct input {
  flex: 1; min-width: 0;
  height: 100%;
  border: 0; background: transparent;
  font-family: inherit; font-size: var(--fs-lg);
  color: var(--ink-1);
  outline: none;
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding: 0;
  -moz-appearance: textfield;
}
.sc-pct input::-webkit-outer-spin-button,
.sc-pct input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.sc-pct em {
  font-style: normal; font-size: var(--fs-md);
  color: var(--ink-4); flex-shrink: 0;
}
</style>
