<script setup>
import { computed } from 'vue';
import { quoteState, vehicleState } from '../store.js';
import { DELIVERY_REGIONS } from '../data/lookups.js';
import CustomDropdown from './CustomDropdown.vue';
import { fmt } from '../lib/format.js';

const isDisabled = computed(() => !vehicleState.trim);

const regionOptions = computed(() =>
  Object.keys(DELIVERY_REGIONS).map((r) => ({ value: r, label: r }))
);

const cityOptions = computed(() => {
  const cities = DELIVERY_REGIONS[quoteState.cond.deliveryRegion] || {};
  return Object.entries(cities).map(([c, fee]) => ({
    value: c,
    label: c,
    sub: fee > 0 ? `+${fmt(fee)}원` : '무료',  // 탁송 무료 — 비용 0 의미
  }));
});

function onRegionChange(v) {
  quoteState.cond.deliveryRegion = v;
  quoteState.cond.deliveryCity = '';
  window.__welrix_recompute?.();
}
function onCityChange(v) {
  quoteState.cond.deliveryCity = v;
  window.__welrix_recompute?.();
}
</script>

<template>
  <section id="sec-delivery">
    <div class="step-title">탁송지</div>
    <div style="display:flex; gap:8px;">
      <div style="flex:1; min-width:0;">
        <CustomDropdown
          :options="regionOptions"
          :model-value="quoteState.cond.deliveryRegion"
          placeholder="광역시/도"
          :disabled="isDisabled"
          @change="onRegionChange"
        />
      </div>
      <div style="flex:1; min-width:0;">
        <CustomDropdown
          :options="cityOptions"
          :model-value="quoteState.cond.deliveryCity"
          placeholder="시/군 선택"
          :disabled="isDisabled || !quoteState.cond.deliveryRegion"
          @change="onCityChange"
        />
      </div>
    </div>
  </section>
</template>
