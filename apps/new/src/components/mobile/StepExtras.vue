<script setup>
import { computed } from 'vue';
import { quoteState } from '../../store.js';
import { 담당자인가 } from '../../lib/role.js';
import { 썬팅들, 블박들, 탁송, 탁송권역, 탁송표시, 썬팅값, 블박값 } from '../../lib/welrix-rates.js';
import { DELIVERY_REGIONS, ACCESSORIES, TINT_AREAS, TINT_PRICES } from '../../data/lookups.js';
import { fmt } from '../../lib/format.js';
import * as Fees from '../../lib/compute-fees.js';

// 짧은 옵션은 chip 유지
const SVC = [
  { value: '웰스 Basic', label: '웰스 Basic', sub: '방문 점검' },
  { value: '웰스 Self',  label: '웰스 Self',  sub: '자체 정비' },
];
const INS = [
  { value: '1억', label: '1억' },
  { value: '2억', label: '2억' },
  { value: '3억', label: '3억' },
  { value: '5억', label: '5억' },
];
const EXTRA = [
  { value: '없음', label: '없음' },
  { value: '1명', label: '1명' },
  { value: '2명', label: '2명' },
  { value: '3명', label: '3명' },
];

const 담당자 = 담당자인가();   // 손님이면 탁송 권역을 안 묻는다 (기본 서울)

// 탁송 지역/도시 — native select
/* ★웰릭스 10권역 — 우리 시군 표(200여 개)는 안 쓴다.
   표가 다르면 «같은 조건»이 안 되고, 그러면 값이 0 으로 안 맞는다. */
const regions = 탁송권역;
const deliveryFee = computed(() => 탁송[quoteState.cond.deliveryRegion] || 0);
function onRegionChange(e) {
  const r = e.target.value;
  quoteState.cond.deliveryRegion = r;
  quoteState.cond.deliveryCity = r;      // 권역 하나로 쓴다
}

// 선팅 제품 — native select
const tintProducts = Object.keys(TINT_PRICES);
const TINT_EXCLUSIVE = {
  side_rear_no_coupon: 'side_rear_with_coupon',
  side_rear_with_coupon: 'side_rear_no_coupon',
  sunroof_normal: 'sunroof_pano',
  sunroof_pano: 'sunroof_normal',
};
function toggleTintArea(key) {
  if (!quoteState.tint.areas) quoteState.tint.areas = new Set();
  const set = quoteState.tint.areas;
  if (set.has(key)) {
    set.delete(key);
  } else {
    set.add(key);
    const ex = TINT_EXCLUSIVE[key];
    if (ex && set.has(ex)) set.delete(ex);
  }
}
const tintFee = computed(() => 썬팅값(quoteState.tint?.product));

// 용품 — native select 옵션 빌드
function buildOpts(map) {
  return [{ value: '', label: '없음 — 무료' }]
    .concat(Object.entries(map).map(([k, v]) => ({ value: k, label: `${k} (+${fmt(v)}원)` })));
}
const blackboxOpts = buildOpts(ACCESSORIES.blackbox);
const naviOpts = buildOpts(ACCESSORIES.navi);
const hipassOpts = buildOpts(ACCESSORIES.hipass);
</script>

<template>
  <div class="se">
    <h2 class="se-title">옵션·서비스를<br>선택해 주세요</h2>

    <!-- 차량 케어 -->
    <div class="se-field">
      <div class="se-label">차량 케어</div>
      <div class="se-cards">
        <button
          v-for="s in SVC" :key="s.value"
          type="button" class="se-card" :class="{ 'is-selected': quoteState.cond.svc === s.value }" :aria-pressed="quoteState.cond.svc === s.value"
          @click="quoteState.cond.svc = s.value"
        >
          <span class="se-card__label">{{ s.label }}</span>
          <span class="se-card__sub">{{ s.sub }}</span>
        </button>
      </div>
    </div>

    <!-- 대물 보험 -->
    <div class="se-field">
      <div class="se-label">대물 보험</div>
      <div class="se-chips">
        <button
          v-for="i in INS" :key="i.value"
          type="button" class="se-chip" :class="{ 'is-selected': quoteState.cond.insProperty === i.value }" :aria-pressed="quoteState.cond.insProperty === i.value"
          @click="quoteState.cond.insProperty = i.value"
        >{{ i.label }}</button>
      </div>
    </div>

    <!-- 추가 운전자 -->
    <div class="se-field">
      <div class="se-label">추가 운전자</div>
      <div class="se-chips">
        <button
          v-for="e in EXTRA" :key="e.value"
          type="button" class="se-chip" :class="{ 'is-selected': quoteState.cond.extraDriver === e.value }" :aria-pressed="quoteState.cond.extraDriver === e.value"
          @click="quoteState.cond.extraDriver = e.value"
        >{{ e.label }}</button>
      </div>
    </div>

    <div class="se-divider"></div>

    <!-- 탁송 지역/도시 — drop-down -->
    <!-- 손님에게는 안 묻는다. store.js 기본값이 이미 「광역시 · 서울」이라
         서울 기준으로 계산된다. 지역이 다르면 상담에서 맞춘다. -->
    <div class="se-field" v-if="담당자">
      <div class="se-label">
        탁송 지역
        <span v-if="deliveryFee" class="se-label__val">+{{ fmt(deliveryFee) }}원</span>
      </div>
      <select class="se-select" :value="quoteState.cond.deliveryRegion" @change="onRegionChange">
        <option v-for="r in regions" :key="r" :value="r">{{ r }} · {{ 탁송표시(r) }}</option>
      </select>
    </div>

    <!-- 선팅 — ★웰릭스와 똑같이 3택. 기본은 「루마 일반」 -->
    <div class="se-field">
      <div class="se-label">
        선팅
        <span v-if="tintFee" class="se-label__val">+{{ fmt(tintFee) }}원</span>
      </div>
      <div class="se-chips">
        <button
          v-for="t in 썬팅들" :key="t.name"
          type="button" class="se-chip" :class="{ 'is-selected': quoteState.tint.product === t.name }" :aria-pressed="quoteState.tint.product === t.name"
          @click="quoteState.tint.product = t.name"
        >{{ t.name }}<small v-if="t.price"> +{{ fmt(t.price) }}</small></button>
      </div>
    </div>

    <!-- 블랙박스 — ★웰릭스와 똑같이 2택. 기본은 「파인뷰 SF500」 -->
    <div class="se-field">
      <div class="se-label">
        블랙박스
        <span v-if="블박값(quoteState.extras.blackbox)" class="se-label__val">
          +{{ fmt(블박값(quoteState.extras.blackbox)) }}원</span>
      </div>
      <div class="se-chips">
        <button
          v-for="b in 블박들" :key="b.name"
          type="button" class="se-chip" :class="{ 'is-selected': quoteState.extras.blackbox === b.name }" :aria-pressed="quoteState.extras.blackbox === b.name"
          @click="quoteState.extras.blackbox = b.name"
        >{{ b.name }}<small v-if="b.price"> +{{ fmt(b.price) }}</small></button>
      </div>
    </div>

    <!-- ★내비·하이패스 칸은 뺐다 — 웰릭스 견적기에 없는 항목이라 «같은 조건»이 깨진다 -->
  </div>
</template>

<style scoped>
.se-title {
  font-size: var(--fs-2xl); font-weight: var(--fw-bold);
  color: var(--ink-1); margin: 0 0 24px;
  line-height: 1.35; letter-spacing: -0.5px;
}
.se-divider {
  height: 0;
  margin: 16px 0;
}
.se-field { margin-bottom: 16px; }
.se-label {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: var(--fs-md); font-weight: var(--fw-semi); color: var(--ink-2);
  margin-bottom: 10px; letter-spacing: -0.2px;
}
.se-label__val {
  font-size: var(--fs-md); color: var(--brand); font-weight: var(--fw-bold);
  font-variant-numeric: tabular-nums;
}

/* chip 카드 (케어) */
.se-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.se-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-card);
  text-align: left;
  font-family: inherit; cursor: pointer;
}
.se-card__label { font-size: var(--fs-lg); font-weight: var(--fw-semi); color: var(--ink-1); }
.se-card__sub { font-size: var(--fs-sm); color: var(--ink-3); }
.se-card:active { background: var(--brand-50); }
.se-card.is-selected { background: var(--brand-50); }
.se-card.is-selected .se-card__label { color: var(--brand); font-weight: var(--fw-bold); }

/* chip (보험/운전자) */
.se-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.se-chip {
  min-height: var(--h-chip);
  padding: 10px 14px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-chip);
  font-family: inherit; font-size: var(--fs-base); font-weight: var(--fw-medium);
  color: var(--ink-2); cursor: pointer;
}
.se-chip:active { background: var(--brand-50); }
.se-chip.is-selected {
  background: var(--brand-50); color: var(--brand); font-weight: var(--fw-bold);
}

/* native select — 모바일 친화 (iOS/Android picker) */
.se-row { display: flex; gap: 8px; }
.se-row .se-select { flex: 1; }
.se-select {
  width: 100%;
  height: var(--h-input);
  padding: 0 32px 0 12px;
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: var(--r-card);
  font-family: inherit; font-size: var(--fs-lg);
  color: var(--ink-1);
  cursor: pointer;
  appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23737373' stroke-width='1.5' stroke-linecap='round'><polyline points='3 5 6 8 9 5'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 14px;
}
.se-select:focus { border-color: var(--brand); outline: none; }
.se-select:disabled { background-color: var(--bg-soft); color: var(--ink-4); cursor: not-allowed; }

/* 추가 할인 input */
.se-discount {
  display: flex; align-items: center; gap: 6px;
  height: var(--h-input);
  padding: 0 14px;
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: var(--r-md);
}
.se-discount:focus-within { border-color: var(--brand); }
.se-discount__input {
  flex: 1; min-width: 0;
  height: 100%;
  border: 0; background: transparent;
  font-family: inherit; font-size: var(--fs-lg);
  color: var(--ink-1);
  outline: none;
  font-variant-numeric: tabular-nums;
  text-align: right;
  -moz-appearance: textfield;
}
.se-discount__input::-webkit-outer-spin-button,
.se-discount__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.se-discount__unit {
  font-size: var(--fs-md); color: var(--ink-4); font-weight: var(--fw-medium);
}

/* 선팅 부위 grid */
.se-tint-areas {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  margin-top: 10px;
}
.se-tint-area {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 10px 12px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-md);
  font-family: inherit; cursor: pointer;
}
.se-tint-area__label { font-size: var(--fs-md); font-weight: var(--fw-medium); color: var(--ink-1); }
.se-tint-area__price {
  font-size: var(--fs-xs); color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}
.se-tint-area:active { background: var(--brand-50); }
.se-tint-area.is-selected {
  background: var(--brand-50);
}
.se-tint-area.is-selected .se-tint-area__label { color: var(--brand); font-weight: var(--fw-bold); }
</style>
