<script setup>
import { computed } from 'vue';
import { quoteState as state } from '../store.js';
import { fmt } from '../lib/format.js';

const BRAND_LOGOS = {
  '현대': 'https://cdn.simpleicons.org/hyundai/002C5F',
  '기아': 'https://cdn.simpleicons.org/kia/05141F',
  '제네시스': '/genesis.svg',
};

function guessColor(name) {
  if (window.__welrix_guessColor) return window.__welrix_guessColor(name);
  return '#e5e5e5';
}

const titleParts = computed(() => {
  const v = state.vehicle;
  if (!v) return [];
  return [v.brand, v.model, v.variant, v.trim_name].filter(Boolean);
});
const isEmpty = computed(() => titleParts.value.length === 0);
const brandLogo = computed(() => state.vehicle && BRAND_LOGOS[state.vehicle.brand] || null);

const trimManwon = computed(() => state.vehicle?.trim_price_manwon || 0);
const optsManwon = computed(() => state.vehicle?.options_price_manwon || 0);
const totalKrw = computed(() => {
  const v = state.vehicle;
  if (!v || !v.total_manwon) return 0;
  return v.total_manwon * 10000 + (state.cond.colorIntPrice || 0);
});
const totalManwon = computed(() => Math.round(totalKrw.value / 10000));

const options = computed(() => state.vehicle?.options || []);
const colorExt = computed(() => state.vehicle?.colorExt || null);
const colorInt = computed(() => state.cond.colorInt || null);
</script>

<template>
  <div class="qp-summary-mini__row">
    <span class="qp-vehicle" :class="{ empty: isEmpty }">
      <template v-if="!isEmpty">
        <img v-if="brandLogo" class="qp-brand-logo" :src="brandLogo" alt="" />
        <span>{{ titleParts.join(' ') }}</span>
      </template>
      <template v-else>차량 미선택</template>
    </span>
    <span v-if="trimManwon" class="qp-formula">
      트림 <b>{{ fmt(trimManwon) }}만</b><template v-if="optsManwon"> + 옵션 <b>{{ fmt(optsManwon) }}만</b></template> = 총 <b class="total">{{ fmt(totalManwon) }}만원</b>
    </span>
  </div>
  <div v-if="options.length" class="qp-summary-opts">
    <div class="qp-opt-chips">
      <span v-for="(name, i) in options" :key="i" class="badge badge--brand">{{ name }}</span>
    </div>
  </div>
  <div v-if="colorExt || colorInt" class="qp-summary-colors">
    <span v-if="colorExt" class="color-item">
      <span class="swatch" :style="{ background: guessColor(colorExt) }"></span>외장 {{ colorExt }}
    </span>
    <span v-if="colorInt" class="color-item">
      <span class="swatch" :style="{ background: guessColor(colorInt) }"></span>내장 {{ colorInt }}
    </span>
  </div>
</template>
