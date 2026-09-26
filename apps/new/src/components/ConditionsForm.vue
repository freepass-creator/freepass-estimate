<script setup>
import { quoteState } from '../store.js';
import {
  CONDITION_LIMITS,
  CREDIT_OPTIONS,
  KM_OPTIONS,
  applyScenarioPercent,
  normalizeCredit,
  normalizeKm,
} from '../lib/feature/conditions.js';

const CREDITS = CREDIT_OPTIONS;
const KMS = KM_OPTIONS;

function recompute() { window.__welrix_recompute?.(); }

function onDepChange() {
  applyScenarioPercent(quoteState, 'dep', quoteState.cond.dep);
  recompute();
}
function onPreChange() {
  applyScenarioPercent(quoteState, 'pre', quoteState.cond.pre);
  recompute();
}
function onCreditChange() {
  quoteState.cond.credit = normalizeCredit(quoteState.cond.credit);
  recompute();
}
function onKmChange() {
  quoteState.cond.km = normalizeKm(quoteState.cond.km);
  recompute();
}
</script>

<template>
  <div class="qp-form qp-form--conds">
    <div class="qc-field">
      <label>신용</label>
      <select v-model="quoteState.cond.credit" @change="onCreditChange">
        <option v-for="c in CREDITS" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
    </div>
    <div class="qc-field">
      <label>약정주행</label>
      <select v-model.number="quoteState.cond.km" @change="onKmChange">
        <option v-for="k in KMS" :key="k" :value="k">{{ k }}만km/년</option>
      </select>
    </div>
    <div class="qc-field">
      <label>보증금</label>
      <span class="qc-pct">
        <input type="number" v-model.number="quoteState.cond.dep" min="0" :max="CONDITION_LIMITS.dep.max" @change="onDepChange" /><em>%</em>
      </span>
    </div>
    <div class="qc-field">
      <label>선납금</label>
      <span class="qc-pct">
        <input type="number" v-model.number="quoteState.cond.pre" min="0" :max="CONDITION_LIMITS.pre.max" @change="onPreChange" /><em>%</em>
      </span>
    </div>
  </div>
</template>
