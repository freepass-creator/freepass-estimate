<script setup>
import { computed } from 'vue';
import { commissionForAgent } from '../lib/quote/commission-policy.js';
import { quoteState } from '../store.js';
import { CONDITION_LIMITS, normalizeFeeRate } from '../lib/feature/conditions.js';
const commission = computed(() => commissionForAgent(quoteState.cond.feeRatePct));
const emit = defineEmits(['change']);
function update(event) {
  if (event.target.value === '' && event.type === 'input') return;
  const value = normalizeFeeRate(event.target.value);
  quoteState.cond.feeRatePct = value;
  if (event.type === 'change') event.target.value = String(value);
  window.__welrix_recompute?.();
  emit('change', value);
}
</script>

<template>
  <label class="fee-control">
    <span>영업 수수료</span>
    <span class="fee-control__input"><input type="number" aria-label="영업 수수료" inputmode="decimal" :value="quoteState.cond.feeRatePct" :min="CONDITION_LIMITS.feeRatePct.min" :max="CONDITION_LIMITS.feeRatePct.max" :step="CONDITION_LIMITS.feeRatePct.step" @input="update" @change="update" /><span aria-hidden="true">P</span></span>
  </label>
  <p class="fee-control__hint">회사 1.0P 고정 + 영업 {{ commission.agentPoints.toFixed(1) }}P = 적용 {{ commission.totalPoints.toFixed(1) }}P</p>
</template>

<style scoped>
.fee-control__hint { margin:-8px 0 16px; font-size:12px; line-height:1.6; color:var(--fp-text-muted); }
.fee-control { display: flex; align-items: center; justify-content: space-between; gap: 16px; max-width: 320px; margin: 16px 0; font-size: 14px; color: var(--fp-text-2); }
.fee-control__input { display: flex; align-items: center; gap: 8px; background: var(--fp-surface-soft); border-radius: 6px; padding: 0 12px; }
input { width: 88px; min-height: 44px; border: 0; background: transparent; color: var(--fp-text); font: inherit; text-align: right; font-variant-numeric: tabular-nums; }
input:focus-visible { outline: 3px solid var(--fp-focus-ring); border-radius: 4px; }
</style>
