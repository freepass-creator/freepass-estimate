<script setup>
import { computed, ref, watch } from 'vue';
import { commissionForAgent } from '../lib/quote/commission-policy.js';
import { quoteState } from '../store.js';
import { CONDITION_LIMITS, normalizeFeeRate } from '../lib/feature/conditions.js';
const rule = CONDITION_LIMITS.feeRatePct;
const commission = computed(() => commissionForAgent(quoteState.cond.feeRatePct));
const draft = ref(String(quoteState.cond.feeRatePct));
watch(() => quoteState.cond.feeRatePct, value => { draft.value = String(value); });
const emit = defineEmits(['change']);
function apply(value) {
  const normalized = normalizeFeeRate(value);
  draft.value = String(normalized);
  quoteState.cond.feeRatePct = normalized;
  window.__welrix_recompute?.();
  emit('change', normalized);
}
function adjust(direction) {
  apply(normalizeFeeRate(draft.value) + direction * rule.step);
}
</script>

<template>
  <div class="fee-control">
    <span>영업 수수료</span>
    <div class="fee-control__input">
      <input type="number" aria-label="영업 수수료" inputmode="decimal" :value="draft" :min="rule.min" :max="rule.max" :step="rule.step" @input="draft = $event.target.value" @change="apply(draft)" @blur="apply(draft)" @keydown.enter="apply(draft)" />
      <span aria-hidden="true">P</span>
      <div class="fee-control__buttons">
        <button type="button" aria-label="영업 수수료 0.5P 올리기" :disabled="normalizeFeeRate(draft) >= rule.max" @click="adjust(1)">▲</button>
        <button type="button" aria-label="영업 수수료 0.5P 내리기" :disabled="normalizeFeeRate(draft) <= rule.min" @click="adjust(-1)">▼</button>
      </div>
    </div>
  </div>
  <p class="fee-control__hint">0.5P 단위 · 회사 1.0P 고정 + 영업 {{ commission.agentPoints.toFixed(1) }}P = 적용 {{ commission.totalPoints.toFixed(1) }}P</p>
</template>

<style scoped>
.fee-control__hint { margin:-8px 0 16px; font-size:12px; line-height:1.6; color:var(--fp-text-muted); }
.fee-control { display: flex; align-items: center; justify-content: space-between; gap: 16px; max-width: 320px; margin: 16px 0; font-size: 14px; color: var(--fp-text-2); }
.fee-control__input { display: flex; align-items: center; gap: 8px; background: var(--fp-surface-soft); border-radius: 6px; padding: 0 12px; }
input { appearance: textfield; width: 72px; min-height: 44px; border: 0; background: transparent; color: var(--fp-text); font: inherit; text-align: right; font-variant-numeric: tabular-nums; }
input:focus-visible { outline: 3px solid var(--fp-focus-ring); border-radius: 4px; }
</style>

<style scoped>
input::-webkit-inner-spin-button, input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.fee-control__buttons { display:flex; flex-direction:column; }
.fee-control__buttons button { border:0; background:transparent; color:var(--fp-text); min-width:44px; min-height:32px; cursor:pointer; font-size:12px; }
.fee-control__buttons button:disabled { opacity:.3; cursor:default; }
.fee-control__buttons button:focus-visible { outline:3px solid var(--fp-focus-ring); border-radius:4px; }
</style>
