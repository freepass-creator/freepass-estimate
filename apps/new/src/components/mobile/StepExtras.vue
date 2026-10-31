<script setup>
import { computed } from 'vue';
import { quoteState } from '../../store.js';
import { 썬팅들, 블박들, 기본용품표시 } from '../../lib/welrix-rates.js';
import { fmt } from '../../lib/format.js';
import { resolveQuoteConditionCosts } from '../../lib/quote/condition-costs.js';

defineProps({ embedded: { type:Boolean, default:false } });

const INS = [
  { value: '1억', label: '1억' },
  { value: '2억', label: '2억' },
  { value: '3억', label: '3억' },
  { value: '5억', label: '5억' },
];
const EXTRA = [
  { value: '없음', label: '없음' },
  { value: '1명', label: '1명' },
  { value: '2명', label: '2명' },
  { value: '3명', label: '3명' },
];

const currentCosts = computed(() => resolveQuoteConditionCosts(quoteState));
const deliveryFee = computed(() => currentCosts.value.deliveryFee);
const tintFee = computed(() => currentCosts.value.tintFee);
const dashcamFee = computed(() => currentCosts.value.dashcamFee);
</script>

<template>
  <div class="se">
    <h2 v-if="!embedded" class="se-title">추가 조건을<br>선택해 주세요</h2>

    <p class="se-maintenance">정비 제외</p>

    <!-- 대물 보험 -->
    <div class="se-field">
      <div class="se-label">대물 보험</div>
      <div class="se-chips">
        <button
          v-for="i in INS" :key="i.value"
          type="button" class="se-chip" :class="{ 'is-selected': quoteState.cond.insProperty === i.value }" :aria-pressed="quoteState.cond.insProperty === i.value"
          @click="quoteState.cond.insProperty = i.value"
        >{{ i.label }}</button>
      </div>
    </div>

    <!-- 추가 운전자 -->
    <div class="se-field">
      <div class="se-label">추가 운전자</div>
      <div class="se-chips">
        <button
          v-for="e in EXTRA" :key="e.value"
          type="button" class="se-chip" :class="{ 'is-selected': quoteState.cond.extraDriver === e.value }" :aria-pressed="quoteState.cond.extraDriver === e.value"
          @click="quoteState.cond.extraDriver = e.value"
        >{{ e.label }}</button>
      </div>
    </div>

    <div class="se-divider"></div>

    <div class="se-field">
      <div class="se-label">탁송 기준 <span class="se-label__val">수도권 · {{ fmt(deliveryFee) }}원</span></div>
    </div>

    <!-- 선팅 — ★웰릭스와 똑같이 3택. 기본은 「루마 일반」 -->
    <div class="se-field">
      <div class="se-label">
        선팅
        <span v-if="tintFee && quoteState.tint.product !== '루마 일반'" class="se-label__val">+{{ fmt(tintFee) }}원</span>
      </div>
      <div class="se-chips">
        <button
          v-for="t in 썬팅들" :key="t.name"
          type="button" class="se-chip" :class="{ 'is-selected': quoteState.tint.product === t.name }" :aria-pressed="quoteState.tint.product === t.name"
          @click="quoteState.tint.product = t.name"
        >{{ 기본용품표시(t.name) }}<small v-if="t.price && t.name !== '루마 일반'"> +{{ fmt(t.price) }}</small></button>
      </div>
    </div>

    <!-- 블랙박스 — ★웰릭스와 똑같이 2택. 기본은 「파인뷰 SF500」 -->
    <div class="se-field">
      <div class="se-label">
        블랙박스
        <span v-if="dashcamFee && quoteState.extras.blackbox !== '파인뷰 SF500'" class="se-label__val">
          +{{ fmt(dashcamFee) }}원</span>
      </div>
      <div class="se-chips">
        <button
          v-for="b in 블박들" :key="b.name"
          type="button" class="se-chip" :class="{ 'is-selected': quoteState.extras.blackbox === b.name }" :aria-pressed="quoteState.extras.blackbox === b.name"
          @click="quoteState.extras.blackbox = b.name"
        >{{ 기본용품표시(b.name) }}<small v-if="b.price && b.name !== '파인뷰 SF500'"> +{{ fmt(b.price) }}</small></button>
      </div>
    </div>

    <!-- ★내비·하이패스 칸은 뺐다 — 웰릭스 견적기에 없는 항목이라 «같은 조건»이 깨진다 -->
  </div>
</template>

<style scoped>
.se-title {
  font-size: var(--fs-2xl); font-weight: var(--fw-bold);
  color: var(--ink-1); margin: 0 0 24px;
  line-height: 1.35; letter-spacing: -0.5px;
}
.se-divider {
  height: 0;
  margin: 16px 0;
}
.se-field { margin-bottom: 16px; }
.se-label {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: var(--fs-md); font-weight: var(--fw-semi); color: var(--ink-2);
  margin-bottom: 10px; letter-spacing: -0.2px;
}
.se-label__val {
  font-size: var(--fs-md); color: var(--brand); font-weight: var(--fw-bold);
  font-variant-numeric: tabular-nums;
}

/* chip 카드 (케어) */
.se-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.se-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-card);
  text-align: left;
  font-family: inherit; cursor: pointer;
}
.se-card__label { font-size: var(--fs-lg); font-weight: var(--fw-semi); color: var(--ink-1); }
.se-card__sub { font-size: var(--fs-sm); color: var(--ink-3); }
.se-card:active { background: var(--brand-50); }
.se-card.is-selected { background: var(--brand-50); }
.se-card.is-selected .se-card__label { color: var(--brand); font-weight: var(--fw-bold); }

/* chip (보험/운전자) */
.se-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.se-chip {
  min-height: var(--h-chip);
  padding: 10px 14px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-chip);
  font-family: inherit; font-size: var(--fs-base); font-weight: var(--fw-medium);
  color: var(--ink-2); cursor: pointer;
}
.se-chip:active { background: var(--brand-50); }
.se-chip.is-selected {
  background: var(--brand-50); color: var(--brand); font-weight: var(--fw-bold);
}

/* native select — 모바일 친화 (iOS/Android picker) */
.se-row { display: flex; gap: 8px; }
.se-row .se-select { flex: 1; }
.se-select {
  width: 100%;
  height: var(--h-input);
  padding: 0 32px 0 12px;
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: var(--r-card);
  font-family: inherit; font-size: var(--fs-lg);
  color: var(--ink-1);
  cursor: pointer;
  appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23737373' stroke-width='1.5' stroke-linecap='round'><polyline points='3 5 6 8 9 5'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 14px;
}
.se-select:focus { border-color: var(--brand); outline: none; }
.se-select:disabled { background-color: var(--bg-soft); color: var(--ink-4); cursor: not-allowed; }

/* 추가 할인 input */
.se-discount {
  display: flex; align-items: center; gap: 6px;
  height: var(--h-input);
  padding: 0 14px;
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: var(--r-md);
}
.se-discount:focus-within { border-color: var(--brand); }
.se-discount__input {
  flex: 1; min-width: 0;
  height: 100%;
  border: 0; background: transparent;
  font-family: inherit; font-size: var(--fs-lg);
  color: var(--ink-1);
  outline: none;
  font-variant-numeric: tabular-nums;
  text-align: right;
  -moz-appearance: textfield;
}
.se-discount__input::-webkit-outer-spin-button,
.se-discount__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.se-discount__unit {
  font-size: var(--fs-md); color: var(--ink-4); font-weight: var(--fw-medium);
}

/* 선팅 부위 grid */
.se-tint-areas {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  margin-top: 10px;
}
.se-tint-area {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 10px 12px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-md);
  font-family: inherit; cursor: pointer;
}
.se-tint-area__label { font-size: var(--fs-md); font-weight: var(--fw-medium); color: var(--ink-1); }
.se-tint-area__price {
  font-size: var(--fs-xs); color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}
.se-tint-area:active { background: var(--brand-50); }
.se-tint-area.is-selected {
  background: var(--brand-50);
}
.se-tint-area.is-selected .se-tint-area__label { color: var(--brand); font-weight: var(--fw-bold); }
</style>
