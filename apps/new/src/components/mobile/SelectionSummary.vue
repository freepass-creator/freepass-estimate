<script setup>
import { computed } from 'vue';
import { vehicleState, quoteState } from '../../store.js';
import { selectionSummary } from '../../lib/selection-summary.js';
const selected = computed(() => selectionSummary(window.VEHICLE_DB, vehicleState, quoteState));
</script>

<template>
  <details v-if="selected" class="selection-summary">
    <summary>
      <span class="selection-summary__title">선택한 내용 <span>상세 보기</span></span>
      <strong>{{ selected.vehicle }}</strong>
      <span class="selection-summary__line">외장 {{ selected.exterior }} · 내장 {{ selected.interior }}</span>
      <span class="selection-summary__options">옵션 {{ selected.options.length ? selected.options.join(' · ') : '미선택' }}</span>
    </summary>
    <dl>
      <div><dt>차량</dt><dd>{{ selected.vehicle }}</dd></div>
      <div><dt>외장색</dt><dd>{{ selected.exterior }}</dd></div>
      <div><dt>내장색</dt><dd>{{ selected.interior }}</dd></div>
      <div><dt>옵션</dt><dd><ul v-if="selected.options.length"><li v-for="(name, i) in selected.options" :key="i">{{ name }}</li></ul><span v-else>미선택</span></dd></div>
    </dl>
  </details>
</template>

<style scoped>
.selection-summary { margin: 0 0 10px; color: var(--ink-1); font-size: var(--fs-sm); }
summary { cursor: pointer; list-style: none; min-height: 64px; padding: 2px 0; }
summary::-webkit-details-marker { display: none; }
summary:focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; }
.selection-summary__title { display: flex; justify-content: space-between; color: var(--ink-3); margin-bottom: 3px; }
.selection-summary__title span { color: var(--brand); }
strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.6; }
.selection-summary__line { display: block; line-height: 1.5; overflow-wrap: anywhere; }
.selection-summary__options { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; overflow-wrap: anywhere; color: var(--ink-2); }
strong { font-weight: 600; }
.selection-summary__line { color: var(--ink-2); }
dl { margin: 8px 0 0; max-height: 24dvh; overflow-y: auto; overscroll-behavior: contain; border-top: 1px solid var(--line); }
dl div { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; padding-top: 8px; }
dt { color: var(--ink-3); } dd { margin: 0; overflow-wrap: anywhere; }
ul { margin: 0; padding-left: 16px; } li + li { margin-top: 4px; }
</style>
