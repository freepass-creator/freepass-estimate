<script setup>
import { computed } from 'vue';
import { vehicleState, quoteState } from '../store.js';
import CustomDropdown from './CustomDropdown.vue';
import { colorPriceLabel } from '../lib/exterior-paint.js';

const isDisabled = computed(() => !vehicleState.trim);

const COLOR_INT = [
  { value: '|0',          label: '내장 선택' },
  { value: '블랙|0',      label: '블랙 (기본)' },
  { value: '그레이|0',    label: '그레이 (기본)' },
  { value: '베이지|0',    label: '베이지 (기본)' },
  { value: '브라운|0',    label: '브라운 (기본)' },
  { value: '투톤|500000', label: '투톤 (+500,000원)' },
];

function guessColor(name) {
  return window.__welrix_guessColor ? window.__welrix_guessColor(name) : '#e5e5e5';
}

// 외장 색상 옵션은 store에서 (모델 변경시 자동 갱신)
const extOptions = computed(() => (vehicleState.exteriorColorOptions || []).map(c => ({
  ...c, sub: colorPriceLabel(c.priceWon),
})));

// 내장 색상 — FreePass 신차 상품마스터의 트림별 제조사 색상이 우선.
const intOptions = computed(() => {
  const dynamic = vehicleState.interiorColorOptions || [];
  if (dynamic.length) return [
    { value: '|0', label: '내장 선택', swatch: null },
    ...dynamic,
  ];
  return COLOR_INT.map((c) => {
    const name = c.label.split(/[\s(]/)[0].trim();
    return { ...c, swatch: c.value.startsWith('|') ? null : guessColor(name) };
  });
});

const extValue = computed({
  get: () => vehicleState.color != null ? String(vehicleState.color) : '',
  set: (v) => window.__welrix_pick?.('colorExt', v),
});
// 내장은 quote.js의 dd-color-int change 핸들러가 처리 — value/price split
const intCurrentValue = computed(() => {
  // 현재 선택 매칭: state.cond.colorInt만 보고 value 찾음
  const name = quoteState.cond.colorInt;
  if (!name) return '';
  return intOptions.value.find((c) => c.value.startsWith(name + '|'))?.value || '';
});

function onIntChange(value) {
  const [name, price, stableEncoded = ''] = value.split('|');
  quoteState.cond.colorInt = name || '';
  quoteState.cond.colorIntPrice = +price || 0;
  quoteState.cond.colorIntId = stableEncoded ? decodeURIComponent(stableEncoded) : null;
  // 외부 hook (renderQuoteDoc 등)
  window.__welrix_recompute?.();
}

</script>

<template>
  <section id="sec-color">
    <div class="step-title">색상</div>
    <div class="color-row" style="display:flex; gap:8px;">
      <div style="flex:1; min-width:0;">
        <CustomDropdown
          :options="extOptions"
          :model-value="extValue"
          placeholder="외장 색상"
          :disabled="isDisabled"
          @change="(v) => extValue = v"
        />
      </div>
      <div style="flex:1; min-width:0;">
        <CustomDropdown
          :options="intOptions"
          :model-value="intCurrentValue"
          placeholder="내장 선택"
          :disabled="isDisabled"
          @change="onIntChange"
        />
      </div>
    </div>
  </section>
</template>
