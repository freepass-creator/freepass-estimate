<script setup>
import { quoteState } from '../store.js';

function recompute() { window.__welrix_recompute?.(); }

function onDepChange() {
  const v = Math.max(0, Math.min(30, +quoteState.cond.dep || 0));
  quoteState.cond.dep = v;
  quoteState.scenarios.forEach((sc) => { sc.dep = v; });
  recompute();
}
function onPreChange() {
  const v = Math.max(0, Math.min(30, +quoteState.cond.pre || 0));
  quoteState.cond.pre = v;
  quoteState.scenarios.forEach((sc) => { sc.pre = v; });
  recompute();
}
</script>

<template>
  <div class="qp-form qp-form--conds">
    <div class="qc-field">
      <label>신용</label>
      <select v-model="quoteState.cond.credit" @change="recompute">
        <option>신용</option><option>중신용</option><option>저신용</option>
      </select>
    </div>
    <div class="qc-field">
      <label>약정주행</label>
      <select v-model="quoteState.cond.km" @change="recompute">
        <option value="2">2만km/년</option>
        <option value="3">3만km/년</option>
      </select>
    </div>
    <div class="qc-field">
      <label>보증금</label>
      <span class="qc-pct">
        <input type="number" v-model.number="quoteState.cond.dep" min="0" max="30" @change="onDepChange" /><em>%</em>
      </span>
    </div>
    <div class="qc-field">
      <label>선납금</label>
      <span class="qc-pct">
        <input type="number" v-model.number="quoteState.cond.pre" min="0" max="30" @change="onPreChange" /><em>%</em>
      </span>
    </div>
  </div>
</template>
