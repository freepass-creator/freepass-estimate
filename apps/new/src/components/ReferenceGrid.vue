<script setup>
// 기본 견적 — 60/48/36 × 위 조건 폼의 보증금/선납금 (편집 X, 항상 노출)
// 카드 구성: 기간 / 대여료 / 보증금(원) / 선납금(원). 만기인수 표시 X.
// 차량 미선택 상태에서도 틀은 항상 보임 (숫자만 placeholder).
import { computed } from 'vue';
import { quoteState as state } from '../store.js';
import { fmt } from '../lib/format.js';

const FIXED_TERMS = [60, 48, 36];

const cards = computed(() => {
  const arr = state.referenceMonthly || [];
  // 항상 3 카드 — 데이터 없으면 placeholder 로 채움
  return FIXED_TERMS.map((term, idx) => {
    const m = arr[idx];
    if (m && m.term === term) {
      return {
        idx, term: m.term, dep: m.dep, pre: m.pre,
        monthly: m.monthly ?? null,
        depAmt: m.depAmt ?? null, preAmt: m.preAmt ?? null,
      };
    }
    return {
      idx, term,
      dep: state.cond.dep ?? 10, pre: state.cond.pre ?? 0,
      monthly: null, depAmt: null, preAmt: null,
    };
  });
});
</script>

<template>
  <!-- term-card 클래스 그대로 사용 — TermsGrid 와 동일 룩 (구성만 read-only) -->
  <!-- term-card--ref: 애니메이션 X (틀 고정 + 숫자만 swap) -->
  <div
    v-for="card in cards"
    :key="card.idx"
    class="term-card term-card--ref"
    :class="{ 'term-card--empty': card.monthly == null }"
  >
    <div class="term-card__head">
      <span class="ref-term-label">{{ card.term }}개월</span>
    </div>
    <div class="term-card__monthly">
      <template v-if="card.monthly != null">{{ fmt(card.monthly) }}</template>
      <template v-else>—</template>
      <em>원</em>
    </div>
    <div class="term-card__row">
      <span>보증금 <em class="ref-pct">{{ card.dep }}%</em></span>
      <b>{{ card.depAmt != null ? fmt(card.depAmt) : '—' }}</b>
    </div>
    <div class="term-card__row">
      <span>선납금 <em class="ref-pct">{{ card.pre }}%</em></span>
      <b>{{ card.preAmt != null ? fmt(card.preAmt) : '—' }}</b>
    </div>
  </div>
</template>

<style scoped>
/* term-card 클래스는 글로벌 스타일을 받음. 여기선 reference 전용 마크업만 보정 */
.ref-term-label {
  font-size: 11px; font-weight: 500; color: var(--ink-1);
  letter-spacing: 0.4px;
}
.ref-pct {
  font-style: normal; font-size: 10px; font-weight: 500;
  color: var(--ink-3); margin-left: 2px;
  font-variant-numeric: tabular-nums;
}
</style>
