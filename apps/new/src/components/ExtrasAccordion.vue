<script setup>
import { ref, computed, nextTick } from 'vue';
import { quoteState, vehicleState } from '../store.js';
import { ACCESSORIES } from '../data/lookups.js';
import CustomDropdown from './CustomDropdown.vue';
import { fmt } from '../lib/format.js';

const isDisabled = computed(() => !vehicleState.trim);

const open = ref(false);
function onToggle(e) {
  open.value = e.target.open;
  if (open.value) {
    nextTick(() => e.target.scrollIntoView({ block: 'end', behavior: 'smooth' }));
  }
}

function buildOpts(map, prefix) {
  return [{ value: '', label: `${prefix} 없음`, sub: '무료' },
    ...Object.entries(map).map(([k, v]) => ({
      value: k,
      label: k,
      sub: v > 0 ? `+${fmt(v)}원` : '무료',
    }))
  ];
}

const blackboxOpts = computed(() => buildOpts(ACCESSORIES.blackbox, '블박'));
const naviOpts     = computed(() => buildOpts(ACCESSORIES.navi, '내비'));
const hipassOpts   = computed(() => buildOpts(ACCESSORIES.hipass, '하이패스'));

function onChange(key, v) {
  quoteState.extras[key] = v;
  window.__welrix_recompute?.();
}
</script>

<template>
  <section id="sec-extras">
    <details class="qp-extras-inline" :open="open" @toggle="onToggle">
      <summary class="step-title-summary">
        <span class="step-title-text">용품 — 블박 · 내비 · 하이패스</span>
        <span class="caret"></span>
      </summary>
      <div style="margin-top:8px; display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
        <CustomDropdown :options="blackboxOpts" :model-value="quoteState.extras.blackbox" placeholder="블박 없음"    :disabled="isDisabled" @change="(v) => onChange('blackbox', v)" />
        <CustomDropdown :options="naviOpts"     :model-value="quoteState.extras.navi"     placeholder="내비 없음"    :disabled="isDisabled" @change="(v) => onChange('navi', v)" />
        <CustomDropdown :options="hipassOpts"   :model-value="quoteState.extras.hipass"   placeholder="하이패스 없음" :disabled="isDisabled" @change="(v) => onChange('hipass', v)" />
      </div>
    </details>
  </section>
</template>
