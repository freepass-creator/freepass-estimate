<script setup>
import { QUOTE_REGION, QUOTE_DELIVERY_FEE } from '../lib/quote/launch-region.js';
import { fmt } from '../lib/format.js';
</script>

<template>
  <section id="sec-delivery">
    <div class="step-title">탁송지</div>
    <p>{{ QUOTE_REGION }} 기준 · {{ fmt(QUOTE_DELIVERY_FEE) }}원</p>
  </section>
</template>
