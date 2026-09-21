<script setup>
import { computed } from 'vue';
import { vehicleState, quoteState } from '../../store.js';
import { selectionSummary } from '../../lib/selection-summary.js';
defineProps({ showVehicle: { type: Boolean, default: true } });
const selected = computed(() => selectionSummary(window.VEHICLE_DB, vehicleState, quoteState));
</script>

<template>
  <div v-if="selected" class="selection-summary" aria-label="현재 선택">
    <strong v-if="showVehicle">{{ selected.vehicle }}</strong>
    <div v-if="vehicleState.trim || quoteState.sharedSnapshot" class="selection-summary__details">
      <p>외장 {{ selected.exterior }} · 내장 {{ selected.interior }}</p>
      <p>옵션 {{ selected.options.length ? selected.options.join(' · ') : '미선택' }}</p>
    </div>
  </div>
</template>

<style scoped>
.selection-summary { color: var(--ink-2); font-size: var(--fs-sm); line-height: 1.4; overflow-wrap: anywhere; }
strong { display: block; color: var(--ink-1); font-weight: 600; margin-bottom: 2px; }
p { margin: 1px 0; }
.selection-summary__details { max-height: 22dvh; overflow-y: auto; }
</style>
