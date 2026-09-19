<script setup>
import { quoteState } from '../store.js';
import { fmtTel } from '../lib/format.js';

const FEE_MIN = -10;   // 영업이 싸게 보이게 마이너스 수수료 허용 (기본 5%)
const FEE_MAX = 7;

function onFeeChange() {
  let v = +quoteState.cond.feeRatePct || 0;
  v = Math.max(FEE_MIN, Math.min(FEE_MAX, Math.round(v * 10) / 10));
  quoteState.cond.feeRatePct = v;
  window.__welrix_recompute?.();
}

function onTelInput(e) {
  const formatted = fmtTel(e.target.value);
  quoteState.staff.tel = formatted;
  if (e.target.value !== formatted) e.target.value = formatted;
}
</script>

<template>
  <div class="cs-form">
    <div class="cs-field">
      <label>손님</label>
      <input v-model="quoteState.cust.name" placeholder="VIP 고객" />
    </div>
    <div class="cs-field">
      <label>담당자</label>
      <input v-model="quoteState.staff.name" placeholder="홍길동 과장" />
    </div>
    <div class="cs-field">
      <label>연락처</label>
      <input :value="quoteState.staff.tel" @input="onTelInput" placeholder="010-0000-0000" inputmode="tel" />
    </div>
    <div class="cs-field">
      <label>수수료</label>
      <span class="qc-pct">
        <input type="number" v-model.number="quoteState.cond.feeRatePct" :min="FEE_MIN" :max="FEE_MAX" step="0.1" @change="onFeeChange" /><em>%</em>
      </span>
    </div>
  </div>
</template>

<style scoped>
.cs-form {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr 1fr;
  gap: 14px;
  align-items: center;
  padding: 4px 0;
}
.cs-field {
  display: grid; grid-template-columns: auto 1fr;
  align-items: center; gap: 6px;
  min-width: 0;
}
.cs-field label {
  font-size: 11px; color: var(--ink-4);
  font-weight: 400; letter-spacing: 0;
  white-space: nowrap;
}
.cs-field input {
  height: 28px;
  border: 0; border-bottom: 1px solid var(--line);
  background: transparent;
  font-size: 12.5px; font-family: inherit;
  color: var(--ink-1);
  outline: none; padding: 0;
  width: 100%; min-width: 0;
  font-variant-numeric: tabular-nums;
  transition: border-color .12s;
}
.cs-field input::placeholder { color: var(--ink-4); }
.cs-field input:hover { border-bottom-color: var(--ink-3); }
.cs-field input:focus { border-bottom-color: var(--ink-1); }
</style>
