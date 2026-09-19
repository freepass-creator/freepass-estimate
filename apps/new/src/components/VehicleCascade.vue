<script setup>
import { computed } from 'vue';
import { vehicleState } from '../store.js';
import CustomDropdown from './CustomDropdown.vue';

const STEPS = [
  { key: 'manufacturer', sectionId: 'sec-manufacturer', label: '제조사',  stateKey: 'manufacturer', optionsKey: 'manufacturerOptions' },
  { key: 'model',        sectionId: 'sec-model',        label: '모델',    stateKey: 'model',        optionsKey: 'modelOptions' },
  { key: 'variant',      sectionId: 'sec-variant',      label: '세부모델', stateKey: 'variant',      optionsKey: 'variantOptions' },
  { key: 'trim',         sectionId: 'sec-trim',         label: '트림',    stateKey: 'trim',         optionsKey: 'trimOptions' },
];

const stepStatus = computed(() => ({
  manufacturer: { hidden: false, current: !vehicleState.manufacturer },
  model:        { hidden: !vehicleState.manufacturer, current: !!vehicleState.manufacturer && !vehicleState.model },
  variant:      { hidden: !vehicleState.model,        current: !!vehicleState.model && !vehicleState.variant },
  trim:         { hidden: !vehicleState.variant,      current: !!vehicleState.variant && !vehicleState.trim },
}));

function onPick(stepKey, value) {
  window.__welrix_pick?.(stepKey, value);
}
</script>

<template>
  <section
    v-for="step in STEPS"
    :key="step.key"
    :id="step.sectionId"
    :class="{ hidden: stepStatus[step.key].hidden, 'is-current': stepStatus[step.key].current }"
  >
    <div class="step-title">{{ step.label }}</div>
    <CustomDropdown
      :options="vehicleState[step.optionsKey]"
      :model-value="vehicleState[step.stateKey]"
      :placeholder="step.label + ' 선택'"
      :disabled="stepStatus[step.key].hidden"
      @change="(v) => onPick(step.key, v)"
    />
  </section>
</template>
