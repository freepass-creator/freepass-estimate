<script setup>
import { computed, ref } from 'vue';
import { vehicleState, quoteState } from '../store.js';

const isDisabled = computed(() => !vehicleState.trim);

const open = ref(false);
const isOpen = computed(() => open.value || (quoteState.cond.discount || 0) > 0);

function onChange() {
  const v = Math.max(0, +quoteState.cond.discount || 0);
  quoteState.cond.discount = v;
  window.__welrix_recompute?.();
}
function clearDiscount() {
  quoteState.cond.discount = 0;
  window.__welrix_recompute?.();
}
function onToggle(e) { open.value = e.target.open; }
</script>

<template>
  <section id="sec-discount">
    <details class="qp-extras-inline" :open="isOpen" @toggle="onToggle">
      <summary class="step-title-summary">
        <span class="step-title-text">
          추가 할인
          <b v-if="quoteState.cond.discount">−{{ quoteState.cond.discount }}만원</b>
          <span v-else class="step-title-hint">재고차·특별조건</span>
        </span>
        <span class="caret"></span>
      </summary>
      <span class="qc-pct sec-discount__input">
        <input
          type="number" min="0" step="10" inputmode="numeric"
          v-model.number="quoteState.cond.discount"
          :disabled="isDisabled"
          @change="onChange"
          placeholder="0"
        />
        <em>만원</em>
        <button
          v-if="quoteState.cond.discount > 0"
          type="button" class="sec-discount__clear"
          @click="clearDiscount"
          title="할인 초기화 (0)"
        ><i class="ph ph-x"></i></button>
      </span>
    </details>
  </section>
</template>

<style scoped>
.step-title-hint {
  font-size: 10.5px; color: var(--ink-4); font-weight: 400;
  margin-left: 6px;
}
.step-title-text b {
  font-size: 11.5px; color: var(--brand); font-weight: 600;
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
}
.sec-discount__input {
  display: inline-flex; align-items: baseline;
  margin-top: 8px; width: 100%;
}
.sec-discount__clear {
  align-self: center;
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; margin-left: 8px;
  border: 1px solid var(--line-2); border-radius: 50%;
  background: var(--bg); color: var(--ink-3);
  cursor: pointer; font-size: 11px; flex-shrink: 0;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.sec-discount__clear:hover { background: var(--bg-soft); color: var(--ink-1); border-color: var(--ink-4); }
</style>
