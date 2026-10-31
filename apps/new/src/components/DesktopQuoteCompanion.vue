<script setup>
import { computed } from 'vue';
import { quoteState, vehicleState } from '../store.js';
import { 표시견적 } from '../lib/quote/display-runtime.js';
import { selectionSummary } from '../lib/selection-summary.js';
import { PUBLIC_OFFERS, publicOfferDefinition } from '../lib/quote/public-offers.js';
import { vehiclePriceBreakdown } from '../lib/vehicle-price-breakdown.js';
import { QUOTE_REGION } from '../lib/quote/launch-region.js';
import { fmt } from '../lib/format.js';

// Read the shared selection and calculation only. This panel never issues requests.
const snapshot = computed(() => quoteState.sharedSnapshot);
const selected = computed(() => selectionSummary(window.VEHICLE_DB, vehicleState, quoteState));
const conditions = computed(() => snapshot.value?.conditions || quoteState.cond);
const vehicle = computed(() => snapshot.value?.vehicle || quoteState.vehicle);
const total = computed(() => snapshot.value?.terms?.find(row => row.totalCarPrice)?.totalCarPrice
  ?? 표시견적.결과?.find(row => row.총차량가)?.총차량가
  ?? (vehicle.value ? Math.round(Number(vehicle.value.total_manwon || 0) * 10000) + Number(quoteState.cond.colorIntPrice || 0) - Number(quoteState.cond.discount || 0) : 0));
const prices = computed(() => vehiclePriceBreakdown(!snapshot.value && 표시견적.가격구성
  ? { priceBreakdown: 표시견적.가격구성 } : vehicle.value, conditions.value.colorIntPrice, total.value));
const offers = computed(() => {
  if (snapshot.value?.offers?.length) return snapshot.value.offers.map(offer => ({ ...publicOfferDefinition(offer.id), status:offer.status,
    rows:offer.terms.map(term => ({ term:term.term, monthly:term.monthly, dep:term.depPct, pre:term.prePct })) }));
  if (snapshot.value?.terms?.length) return [{ id:'legacy', label:'저장된 견적', status:'ready', rows:snapshot.value.terms.map(term => ({term:term.term,monthly:term.monthly,dep:term.depPct,pre:term.prePct})) }];
  return PUBLIC_OFFERS.map(definition => {
    const offer = 표시견적.견적들.find(row => row.id === definition.id);
    return { ...definition, status:offer?.status || 'pending', rows:quoteState.scenarios.map((scenario,i) => ({ term:scenario.term,
      dep:scenario.dep, pre:scenario.pre, monthly:offer?.results?.[i]?.월대여료 ?? null })) };
  });
});
const hasCalculation = computed(() => !!snapshot.value || 표시견적.상태 === 'ok');
const financeText = computed(() => {
  const rows = snapshot.value?.terms || quoteState.scenarios;
  const pairs = [...new Set(rows.map(row => `${row.depPct ?? row.dep ?? 0}% / ${row.prePct ?? row.pre ?? 0}%`))];
  return pairs.length === 1 ? pairs[0] : '기간별 조건 적용';
});
const conditionRows = computed(() => [
  ['약정 주행거리', `연 ${conditions.value.km || 2}만km`],
  ['보증금 / 선납금', financeText.value],
  ['운전자 / 정비', '만 26세 이상 / 정비 제외'],
  ['대물 / 추가 운전자', `${conditions.value.insProperty || '1억'} / ${conditions.value.extraDriver || '없음'}`],
  ['선팅', snapshot.value ? conditions.value.tint : quoteState.tint?.product || '없음'],
  ['블랙박스', snapshot.value ? conditions.value.blackbox : quoteState.extras?.blackbox || '미설치'],
  ['탁송 기준', snapshot.value?.conditions?.deliveryCity || QUOTE_REGION],
]);
</script>

<template>
  <aside class="desktop-companion" aria-label="선택 내역과 실시간 견적">
    <header class="dc-heading"><p>선택한 내용</p><h2>{{ selected?.vehicle || '나에게 맞는 차를 골라보세요' }}</h2></header>
    <p v-if="!selected" class="dc-muted">왼쪽에서 선택하면 차량과 조건이 여기에 모입니다.</p>
    <template v-else>
      <dl class="dc-details">
        <div><dt>외장 / 내장</dt><dd>{{ selected.exterior }} / {{ selected.interior }}</dd></div>
        <div><dt>선택 옵션</dt><dd>{{ selected.options.length ? selected.options.join(' · ') : '미선택' }}</dd></div>
      </dl>
      <div v-if="prices" class="dc-price">
        <div><span>트림 가격</span><span>{{ fmt(prices.base) }}원</span></div>
        <div><span>옵션·색상 추가금</span><span>{{ fmt(prices.options + prices.exterior + prices.interior - prices.discount) }}원</span></div>
        <div class="dc-total"><strong>신차 총가격</strong><strong>{{ fmt(total) }}원</strong></div>
      </div>
      <dl class="dc-details dc-conditions"><div v-for="[label,value] in conditionRows" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></div></dl>
    </template>
    <section class="dc-quotes" aria-label="실시간 견적">
      <h2>실시간 견적</h2>
      <p class="dc-muted" role="status">{{ snapshot ? '공유받은 당시의 견적입니다.' : 표시견적.상태 === 'pending' ? '선택한 조건으로 계산하고 있습니다…' : hasCalculation ? '현재 선택한 조건 기준 · 부가세 포함' : 표시견적.상태 === 'error' && vehicleState.trim ? '현재 견적을 조회할 수 없습니다. 조건을 확인해 주세요.' : '차량과 조건을 선택하면 월 렌트료가 표시됩니다.' }}</p>
      <div class="dc-offers">
        <article v-for="offer in offers" :key="offer.id" class="dc-offer" :data-offer="offer.id">
          <h3>{{ offer.label }}</h3>
          <p v-if="hasCalculation && offer.status === 'unavailable'" class="dc-muted">조회 불가</p>
          <dl v-else><div v-for="row in offer.rows" :key="row.term"><dt>{{ row.term }}개월</dt><dd class="dc-monthly">{{ hasCalculation && row.monthly != null ? fmt(row.monthly) + '원' : '—' }}</dd></div></dl>
        </article>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.dc-heading p { margin:0 0 12px; color:var(--ink-3); font-size:13px; }
h2 { font-size:20px; line-height:1.6; margin:0; color:var(--ink-1); letter-spacing:-.4px; }
.dc-muted { color:var(--ink-3); font-size:13px; line-height:1.7; }
.dc-details { margin:24px 0; font-size:13px; }
.dc-details > div { display:grid; grid-template-columns:112px minmax(0,1fr); gap:16px; margin:12px 0; }
dt { color:var(--ink-3); } dd { margin:0; overflow-wrap:anywhere; color:var(--ink-1); }
.dc-price { padding:20px; background:var(--fp-surface); border-radius:var(--fp-r-panel); font-size:14px; }
.dc-price > div { display:flex; justify-content:space-between; gap:16px; margin:8px 0; font-variant-numeric:tabular-nums; }
.dc-price .dc-total { margin-top:18px; font-size:16px; }
.dc-conditions { margin-block:24px 32px; }
.dc-quotes { margin-top:36px; }
.dc-quotes h2 { font-size:17px; }
.dc-offers { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:20px; }
.dc-offer { --offer-bg:#eef4ff; --offer-ink:#2459a6; background:var(--offer-bg); padding:16px 12px; border-radius:var(--fp-r-panel); }
.dc-offer[data-offer="income-check"] { --offer-bg:#edf7f1; --offer-ink:#28704b; }
.dc-offer[data-offer="credit-required"] { --offer-bg:#f4effb; --offer-ink:#6c459c; }
.dc-offer h3 { font-size:14px; margin:0 0 20px; color:var(--offer-ink); }
.dc-offer dl { margin:0; }
.dc-offer dl > div { margin-top:16px; }
.dc-offer dt { font-size:12px; margin-bottom:4px; }
.dc-monthly { font-size:15px; font-weight:600; color:var(--offer-ink); font-variant-numeric:tabular-nums; white-space:nowrap; }
</style>
