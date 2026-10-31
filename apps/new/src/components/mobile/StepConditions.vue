<script setup>
import { computed } from 'vue';
import { quoteState } from '../../store.js';
import { KM_OPTIONS, toggleQuoteTerm, applyScenarioPercent } from '../../lib/feature/conditions.js';
import FeeControl from '../FeeControl.vue';

const TERMS = [36, 48, 60];
const KMS = KM_OPTIONS;

const selectedTerms = computed(() => (quoteState.scenarios || []).map(s => s.term));

function toggleTerm(t) {
  toggleQuoteTerm(quoteState, t);
}

</script>

<template>
  <div class="sc">
    <h2 class="sc-title">계약 조건을<br>설정해 주세요</h2>

    <p class="sc-note">보증금·선납금과 영업 수수료를 정한 뒤 견적을 확인하세요. 수수료는 풀피 5.0P로 시작합니다.</p>

    <div class="sc-field">
      <div class="sc-label">
        기간 <span class="sc-label__hint">복수 선택 가능</span>
      </div>
      <div class="sc-chips">
        <button
          v-for="t in TERMS" :key="t"
          type="button" class="sc-chip" :class="{ 'is-selected': selectedTerms.includes(t) }" :aria-pressed="selectedTerms.includes(t)"
          @click="toggleTerm(t)"
        >{{ t }}개월</button>
      </div>
    </div>

    <div class="sc-field">
      <div class="sc-label">약정 주행거리</div>
      <div class="sc-chips">
        <button
          v-for="k in KMS" :key="k"
          type="button" class="sc-chip" :class="{ 'is-selected': quoteState.cond.km == k }" :aria-pressed="quoteState.cond.km == k"
          @click="quoteState.cond.km = k"
        >{{ k }}만km/년</button>
      </div>
    </div>

    <div class="sc-finance">
      <label class="sc-finance__field"><span>보증금</span><span class="sc-finance__input"><input aria-label="보증금" type="number" inputmode="decimal" :value="quoteState.cond.dep" min="0" max="30" step="1" @input="applyScenarioPercent(quoteState, 'dep', $event.target.value)" /><span>%</span></span></label>
      <label class="sc-finance__field"><span>선납금</span><span class="sc-finance__input"><input aria-label="선납금" type="number" inputmode="decimal" :value="quoteState.cond.pre" min="0" max="30" step="1" @input="applyScenarioPercent(quoteState, 'pre', $event.target.value)" /><span>%</span></span></label>
      <FeeControl />
      <label class="sc-finance__field"><span>담당자 이름</span><input v-model.trim="quoteState.staff.name" aria-label="담당자 이름" type="text" autocomplete="name" maxlength="40" placeholder="이름 또는 직함" /></label>
      <label class="sc-finance__field"><span>담당자 연락처</span><input v-model.trim="quoteState.staff.tel" aria-label="담당자 연락처" type="tel" autocomplete="tel" maxlength="30" placeholder="010-0000-0000" /></label>
    </div>
  </div>
</template>

<style scoped>
.sc-title {
  font-size: var(--fs-2xl); font-weight: var(--fw-bold);
  color: var(--ink-1); margin: 0 0 16px;
  line-height: 1.35; letter-spacing: -0.5px;
}
.sc-field { margin-bottom: 16px; }
.sc-finance { margin: 24px 0; }
.sc-finance__field { display: flex; align-items: center; justify-content: space-between; gap: 16px; max-width: 320px; margin: 16px 0; font-size: 14px; color: var(--fp-text-2); }
.sc-finance__input { display: flex; align-items: center; gap: 8px; background: var(--fp-surface-soft); border-radius: 6px; padding: 0 12px; }
.sc-finance__input input { width: 88px; min-height: 44px; border: 0; background: transparent; font: inherit; color: var(--fp-text); text-align: right; }
.sc-finance__input input:focus-visible { outline: 3px solid var(--fp-focus-ring); border-radius: 4px; }
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
  margin: 4px 0 0; padding: 12px;
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
  background: var(--brand);
  border-color: transparent;
  color: #fff;
}

/* 보증금/선납금/수수료 — 직접 입력 */
.sc-pct {
  display: flex; align-items: baseline; gap: 4px;
  height: var(--h-input);
  padding: 0 14px;
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: var(--r-card);
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
