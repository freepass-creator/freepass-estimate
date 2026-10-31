<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { COMMISSION_POLICY, commissionForAgent } from '../lib/quote/commission-policy.js';
import { 요청만들기 } from '../lib/quote/build-request.js';
import { PUBLIC_OFFERS as COMPARISON_TYPES } from '../lib/quote/public-offers.js';
import { calculatePublicQuotes } from '../lib/quote/benchmark.js';
import FeeControl from './FeeControl.vue';
import { quoteState } from '../store.js';

const dialog = ref(null);
const term = ref(60);
const request = shallowRef(null);
const requestError = ref('');
const results = ref({});
const busy = ref(false);
let controller;
let revision = 0;
let trigger;
const money = (value) => Number.isFinite(value) ? value.toLocaleString('ko-KR') + '원' : '—';
const selectedVehicle = computed(() => request.value ? [request.value.차.브랜드, request.value.차.모델, request.value.차.트림].filter(Boolean).join(' ') : '차량 미선택');
const scenario = computed(() => request.value?.안들?.find((item) => item.기간 === term.value));
let feeTimer;
function changeFee(value) {
  clearTimeout(feeTimer);
  cancel();
  if (!request.value) return;
  request.value = { ...request.value, 조건: { ...request.value.조건, 수수료정책: COMMISSION_POLICY, 영업수수료P: value, 수수료율: commissionForAgent(value).totalPoints } };
  feeTimer = setTimeout(calculate, 350);
}

function cancel() {
  revision++;
  controller?.abort();
  busy.value = false;
  results.value = {};
}
watch(term, cancel);

async function open() {
  if (dialog.value.open) return;
  trigger = document.activeElement;
  cancel();
  try {
    const current = 요청만들기();
    request.value = current ? JSON.parse(JSON.stringify(current)) : null;
    requestError.value = '';
  } catch (error) {
    request.value = null;
    requestError.value = error.message;
  }
  dialog.value.showModal();
  await nextTick();
  dialog.value.querySelector('select')?.focus();

}
function close() { dialog.value.close(); }
function closed() { clearTimeout(feeTimer); cancel(); trigger?.focus?.(); }

async function calculate() {
  if (!request.value || busy.value) return;
  cancel();
  const sequence = revision;
  controller = new AbortController();
  const signal = controller.signal;
  busy.value = true;
  try {
    const scenario = request.value.안들.find(row => row.기간 === term.value);
    if (!scenario) throw new Error('현재 견적에서 해당 기간을 선택해 주세요.');
    const answer = await calculatePublicQuotes({ ...request.value, 안들: [scenario] }, { signal });
    const map = {};
    for (const offer of answer.offers) {
      map[offer.id] = offer.status==='ready'&&offer.results[0] ? { row:offer.results[0], analysis:offer.analysis?.[0], estimated:offer.estimated } : {error:'조건 확인 후 안내'};
    }
    if (sequence === revision) results.value = map;
  } catch (error) { if (sequence === revision) results.value = Object.fromEntries(COMPARISON_TYPES.map(t => [t.id, { error: error.message }])); }
  if (sequence === revision) busy.value = false;
}
onMounted(() => {
  window.addEventListener('freepass:open-comparison', open);
  if (new URLSearchParams(location.search).get('compare') === '1') open();
});
onBeforeUnmount(() => { clearTimeout(feeTimer); cancel(); window.removeEventListener('freepass:open-comparison', open); });
</script>

<template>
  <dialog ref="dialog" class="comparison" aria-labelledby="comparison-title" @close="closed">
    <div class="comparison__body">
      <h2 id="comparison-title">견적 비교</h2>
      <p class="comparison__intro">신용 무관 · 소득 확인 · 신용 심사</p>
      <FeeControl v-if="request && !quoteState.sharedSnapshot" @change="changeFee" />
      <div class="comparison__fields">
        <label>기간
          <select v-model.number="term"><option :value="36">36개월</option><option :value="48">48개월</option><option :value="60">60개월</option></select>
        </label>
      </div>
      <p class="comparison__notice">같은 차량·옵션·색상·보증금·선납금·수수료로 계산합니다.</p>
      <div class="comparison__grid">
        <section v-for="type in COMPARISON_TYPES" :key="type.id" :aria-label="type.label" :data-offer="type.id">
          <h3>{{ type.label }}</h3>
          <div class="comparison__quote">
            <p class="comparison__amount">{{ money(results[type.id]?.row?.월대여료) }}<small> / 월</small></p>
            <p>{{ selectedVehicle }}</p>
            <dl v-if="request">
              <dt>견적 조건</dt><dd>{{ type.label }}</dd>
              <dt>기간</dt><dd>{{ term }}개월</dd>
              <dt>보증금</dt><dd>{{ scenario ? scenario.보증금 + '%' : '기간 미선택' }} · {{ money(results[type.id]?.row?.보증금) }}</dd>
              <dt>선납금</dt><dd>{{ scenario ? scenario.선납 + '%' : '기간 미선택' }} · {{ money(results[type.id]?.row?.선납금) }}</dd>
              <dt>주행거리</dt><dd>{{ request?.조건?.주행 || '—' }}/년</dd>
              <dt>계산 차량가격</dt><dd>{{ money(results[type.id]?.row?.총차량가) }}</dd>
            </dl>
            <dl v-if="results[type.id]?.analysis">
              <dt>차량가 대비 잔존율</dt><dd>{{ (results[type.id].analysis.residualRate * 100).toFixed(2) }}%</dd>
              <dt>연 환산 내재수익률</dt><dd>{{ (results[type.id].analysis.annualEffectiveRate * 100).toFixed(2) }}%</dd>
            </dl>
            <p v-if="results[type.id]?.error" class="comparison__error" role="alert">견적 조건 확인 후 다시 조회해 주세요.</p>
            <p v-else-if="!results[type.id]" class="comparison__hint">{{ !request ? '견적기에서 차량과 색상을 선택한 뒤 다시 열어 주세요.' : busy ? '계산 중…' : '하단 비교 계산을 눌러 주세요.' }}</p>
          </div>
        </section>
      </div>
      <p v-if="requestError" role="alert">견적 조건을 확인해 주세요.</p>
      <p class="comparison__hint">상품별 확인 조건에 따라 최종 견적이 달라질 수 있습니다.</p>
    </div>
    <footer class="comparison__footer">
      <button type="button" class="comparison__secondary" @click="close">닫기</button>
      <button type="button" class="comparison__primary" :disabled="busy || !request || !scenario" @click="calculate">{{ busy ? '계산 중…' : '견적 비교 계산' }}</button>
    </footer>
  </dialog>
</template>

<style scoped>
.comparison { box-sizing: border-box; width: min(1120px, calc(100% - 32px)); max-height: calc(100dvh - 32px); margin: auto; padding: 0; border: 0; border-radius: 8px; color: var(--fp-text); background: var(--fp-surface); font-family: var(--font); font-size: 14px; }
.comparison::backdrop { background: rgb(15 27 45 / 45%); }
.comparison__body { padding: 24px; }
h2 { margin: 0; font-size: 20px; } h3 { margin: 0 0 8px; font-size: 16px; }
p { line-height: 1.6; margin: 8px 0; overflow-wrap: anywhere; }
.comparison__intro, .comparison__source, .comparison__hint { color: var(--fp-text-muted); }
.comparison__hint, .comparison__source { font-size: 12px; }
.comparison__fields { display: grid; grid-template-columns: minmax(0, 1fr) 120px; gap: 16px; margin: 24px 0 16px; }
label { display: grid; gap: 8px; min-width: 0; font-weight: 600; }
select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; padding: 8px; border: 0; border-radius: 6px; background: var(--fp-surface-soft); color: var(--fp-text); font: inherit; font-weight: 400; }
.comparison__notice { padding: 12px; background: var(--fp-info-bg); color: var(--fp-info); border-radius: 6px; }
section[data-offer="no-credit"] { --category-ink:#2459a6; --category-bg:#eef4ff; }
section[data-offer="income-check"] { --category-ink:#28704b; --category-bg:#edf7f1; }
section[data-offer="credit-required"] { --category-ink:#6c459c; --category-bg:#f4effb; }
section[data-offer] { background:var(--category-bg);padding:16px;border-radius:8px; }
section[data-offer] h3,section[data-offer] .comparison__amount { color:var(--category-ink); }
.comparison__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin: 24px 0; }
section { min-width: 0; padding: 0; box-shadow: none; }
.comparison__amount { font-size: 24px; font-weight: 700; margin: 16px 0; font-variant-numeric: tabular-nums; }
small { font-size: 12px; font-weight: 400; color: var(--fp-text-muted); }
dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; margin: 16px 0; font-size: 12px; line-height: 1.6; }
dt { color: var(--fp-text-muted); } dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
.comparison__error { color: var(--fp-err); background: var(--fp-err-bg); padding: 8px; border-radius: 6px; }
summary { cursor: pointer; padding: 12px 0; font-weight: 600; }
.comparison__footer { position: sticky; bottom: 0; display: flex; gap: 8px; justify-content: flex-end; padding: 16px 24px; background: var(--fp-surface); box-shadow: 0 -4px 16px rgb(15 27 45 / 5%); }
button { min-height: 44px; padding: 8px 16px; border: 0; border-radius: 6px; font: inherit; cursor: pointer; }
.comparison__secondary { background: var(--fp-neutral); color: var(--fp-text-2); }
.comparison__primary { background: var(--fp-primary); color: white; }
button:disabled { opacity: .5; cursor: default; }
:is(button, select, summary):focus-visible { outline: 3px solid var(--fp-focus-ring); outline-offset: 2px; }
@media (max-width: 1024px) { section[data-offer="no-credit"] { --category-ink:#2459a6; --category-bg:#eef4ff; }
section[data-offer="income-check"] { --category-ink:#28704b; --category-bg:#edf7f1; }
section[data-offer="credit-required"] { --category-ink:#6c459c; --category-bg:#f4effb; }
section[data-offer] { background:var(--category-bg);padding:16px;border-radius:8px; }
section[data-offer] h3,section[data-offer] .comparison__amount { color:var(--category-ink); }
.comparison__grid { grid-template-columns: 1fr; } section { padding-top: 16px; box-shadow: 0 -1px 0 var(--fp-neutral); } section:nth-child(2) { order: -1; padding-top: 0; box-shadow: none; } .comparison__body { padding: 16px; } .comparison__fields { grid-template-columns: minmax(0, 1fr) 96px; gap: 8px; } .comparison__footer { padding: 12px 16px; } .comparison__secondary { flex: 3; } .comparison__primary { flex: 7; } }
</style>
