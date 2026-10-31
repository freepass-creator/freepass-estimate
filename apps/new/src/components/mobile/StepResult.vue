<script setup>
import { QUOTE_REGION } from '../../lib/quote/launch-region.js';
/* ── 견적 페이지 — 마지막 걸음 ────────────────────────────────────────────
 * ★대표 2026-09-18 「옵션 고르기 전까지는 하단에 견적 보여주지 말고, 견적도 별도 페이지로 보이게」
 *   고른 차·옵션·조건을 한 장에 모으고, 기간별 월 렌트료를 크게 보인다.
 *   숫자는 하단 금액바와 «같은 곳»(견적상태 = 웰릭스 계산)에서 읽는다 — 따로 계산하지 않는다.
 */
import { computed } from 'vue';
import { PUBLIC_OFFERS,publicOfferDefinition } from '../../lib/quote/public-offers.js';
import { quoteState, vehicleState } from '../../store.js';
import { 표시견적 as 견적상태 } from '../../lib/quote/display-runtime.js';
import { 담당자인가 } from '../../lib/role.js';
import { vehiclePriceBreakdown } from '../../lib/vehicle-price-breakdown.js';
import { fmt } from '../../lib/format.js';
import { exteriorColorsFor } from '../../lib/exterior-paint.js';

const 담당자 = 담당자인가();
const 공유견적 = computed(() => !!quoteState.sharedSnapshot);
const snapshot = computed(() => quoteState.sharedSnapshot || null);

/* 고른 차 요약 — 보통은 차 고르는 화면이 만들어 둔 quoteState.vehicle 을 쓴다.
   ★공유 링크로 곧장 이 페이지에 오면 그 화면을 안 거쳐 비어 있다 → 차 목록에서 직접 찾아 채운다. */
function 목록에서() {
  try {
    const b = window.VEHICLE_DB?.manufacturers?.find((x) => x.manufacturer_id === vehicleState.manufacturer);
    const m = b?.models?.find((x) => x.model_id === vehicleState.model);
    const pt = m?.variants?.find((x) => x.trims.some((t) => t.trim_id === vehicleState.trim));
    const t = pt?.trims.find((x) => x.trim_id === vehicleState.trim);
    if (!t) return {};
    const 옵 = [...(vehicleState.options || [])].map((id) => pt.options_master?.[id]?.name).filter(Boolean);
    const 색 = vehicleState.color != null ? exteriorColorsFor(m,t)[vehicleState.color]?.name : null;
    return {
      brand: b.manufacturer_name, model: m.model_name, variant: pt.variant_name,
      trim_name: [t.group, t.name].filter(Boolean).join(' '),
      options: 옵, colorExt: 색, colorInt: quoteState.cond?.colorInt || null,
    };
  } catch { return {}; }
}
const v = computed(() => (snapshot.value?.vehicle?.trim_name ? snapshot.value.vehicle : (quoteState.vehicle?.trim_name ? quoteState.vehicle : 목록에서())));
const 연락담당자 = computed(() => 공유견적.value ? snapshot.value?.staff : quoteState.staff);
const c = computed(() => quoteState.cond || {});

const 계산중 = computed(() => !공유견적.value && 견적상태.상태 === 'pending');
const 계산못함 = computed(() => !공유견적.value && 견적상태.상태 === 'error');
const 견적종류들 = computed(() => {
  if (snapshot.value?.offers?.length) return snapshot.value.offers.map(offer => ({...publicOfferDefinition(offer.id), status:offer.status, estimated:offer.id==='no-credit', terms:offer.terms}));
  if (snapshot.value?.terms?.length) return [{id:'legacy',label:'저장된 견적',status:'ready',terms:snapshot.value.terms}];
  const offers = 견적상태.견적들?.length ? 견적상태.견적들 : PUBLIC_OFFERS.map(offer=>({...offer,status:'pending',results:[]}));
  return offers.map(offer=>({...offer,terms:(quoteState.scenarios||[]).map((sc,i)=>({term:sc.term,monthly:offer.results[i]?.월대여료??null,acquire:offer.results[i]?.인수가??null,depPct:sc.dep??0,prePct:sc.pre??0,deposit:offer.results[i]?.보증금??0,prepay:offer.results[i]?.선납금??0}))}));
});

/* 총 차량가 — 공유 Snapshot 이 있으면 «보낸 당시» 총차량가가 우선이다. */
const 총차량가 = computed(() => {
  const snapTotal = snapshot.value?.terms?.find((t) => t.totalCarPrice)?.totalCarPrice;
  if (snapTotal) return snapTotal;
  return (견적상태.결과 || []).find((g) => g?.총차량가)?.총차량가 ?? ((v.value.total_manwon || 0) * 10000);
});

const 가격구성 = computed(() => vehiclePriceBreakdown(!공유견적.value && 견적상태.가격구성 ? { priceBreakdown: 견적상태.가격구성 } : v.value, c.value.colorIntPrice, 총차량가.value));

const 추가금액 = computed(() => 가격구성.value ? 가격구성.value.options + 가격구성.value.exterior + 가격구성.value.interior - 가격구성.value.discount : 0);

const 신용글 = computed(() => (담당자 && !공유견적.value ? (c.value.credit || '중신용') : '신용점수 무관'));
const 조건들 = computed(() => {
  const sc = snapshot.value?.conditions || {};
  const km = 공유견적.value ? sc.km : c.value.km;
  const svc = 공유견적.value ? sc.svc : c.value.svc;
  const ins = 공유견적.value ? sc.insProperty : c.value.insProperty;
  const driver = 공유견적.value ? sc.extraDriver : c.value.extraDriver;
  const delivery = 공유견적.value ? sc.deliveryCity : QUOTE_REGION;
  const tint = 공유견적.value ? sc.tint : quoteState.tint?.product;
  const blackbox = 공유견적.value ? sc.blackbox : quoteState.extras?.blackbox;

  return [
    ['약정 주행거리', `연 ${km ?? 2}만km`],
    ['운전자 연령', '만 26세 이상'],
    ['보험', `대물 ${ins || '1억'}`],
    ['정비', 공유견적.value && !['정비 제외', '웰스 Self'].includes(sc.svc) ? '기존 조건 · 재계산 필요' : '제외'],
    ['부가세', '포함'],
    ['탁송 기준', delivery || QUOTE_REGION],
  ];
});

const 공유시각 = computed(() => {
  const at = snapshot.value?.at;
  if (!at) return '';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(at));
  } catch { return ''; }
});
</script>

<template>
  <div class="sr" style="background: #fff; padding: 16px; border-radius: 8px;">
    <div class="sr-header">
      <h2 class="sr-title">신차 장기렌트 견적</h2>
      <div v-if="연락담당자?.name || 연락담당자?.tel" class="sr-contact">
        <span>{{ 연락담당자.name ? '담당자 ' + 연락담당자.name : '담당자' }}</span>
        <span v-if="연락담당자.tel">{{ 연락담당자.tel }}</span>
      </div>
    </div>

    <div v-if="공유견적" class="sr-snapshot">
      <b>공유받은 견적</b>
      <span>{{ 공유시각 ? 공유시각 + ' 생성 · ' : '' }}조건을 변경하기 전까지 이 금액을 그대로 보여드립니다.</span>
    </div>

    <!-- 고른 차 -->
    <section class="sr-car">
      <div class="sr-car__name">{{ v.brand }} {{ v.model }}</div>
      <div class="sr-car__trim">{{ [v.variant, v.trim_name].filter(Boolean).join(' · ') }}</div>
      <ul v-if="(v.options || []).length" class="sr-car__opts">
        <li v-for="o in v.options" :key="o">{{ o }}</li>
      </ul>
      <div v-else class="sr-car__color">옵션 미선택</div>
      <div class="sr-car__color">
        외장 {{ v.colorExt || '미선택' }} · 내장 {{ v.colorInt || '미선택' }}
      </div>
      <div v-if="가격구성" class="sr-car__breakdown">
        <div><span>트림 가격</span><b>{{ fmt(가격구성.base) }}원</b></div>
        <div><span>{{ 추가금액 < 0 ? '−' : '+' }} {{ 가격구성.discount ? '추가금·할인' : '옵션·색상 추가금' }}</span><b>{{ fmt(Math.abs(추가금액)) }}원</b></div>
      </div>
      <p v-else class="sr-car__color">차량 가격 구성 확인이 필요합니다.</p>
      <div class="sr-car__total">
        <span>= 신차 총가격</span><b>{{ fmt(총차량가) }}원</b>
      </div>
    </section>

    <div class="sr-offers" :aria-busy="계산중">
      <section v-for="offer in 견적종류들" :key="offer.id" class="sr-offer" :data-offer="offer.id">
        <h3 class="sr-offer__title">{{ offer.label }}</h3>
        <p v-if="!offer.terms.length" class="sr-muted">조건 확인 후 안내</p>
        <div class="sr-terms">
          <div v-for="t in offer.terms" :key="t.term" class="sr-term">
            <div class="sr-term__left">
              <div class="sr-term__label">{{ t.term }}개월</div>
              <div class="sr-term__sub">보증금 {{ t.depPct }}% · 선납금 {{ t.prePct }}%</div>
              <div v-if="t.monthly != null" class="sr-term__sub">보증금 {{ fmt(t.deposit) }}원 · 선납금 {{ fmt(t.prepay) }}원</div>
              <div v-if="t.acquire" class="sr-term__sub">만기 인수가 {{ fmt(t.acquire) }}원</div>
            </div>
            <div class="sr-term__monthly">
              <template v-if="t.monthly != null">월 <b>{{ fmt(t.monthly) }}</b>원</template>
              <span v-else class="sr-muted">{{ 계산중 ? '계산 중…' : '조건 확인 후 안내' }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
    <p v-if="계산못함" class="sr-error" role="alert">{{ 견적상태.오류 }}</p>

    <!-- 조건 — 결과의 보조정보이므로 2열 요약으로 압축 -->
    <div class="sr-cond__title">이용 조건</div>
    <section class="sr-cond">
      <div v-for="[k, val] in 조건들" :key="k" class="sr-cond__row">
        <span>{{ k }}</span><b>{{ val }}</b>
      </div>
    </section>

    <p class="sr-note">
      <template v-if="공유견적">
        공유 당시 저장된 견적 결과입니다. 조건을 변경하면 현재 기준으로 새 견적이 계산됩니다.
      </template>
      <template v-else>
        VAT 포함 금액입니다. 심사 결과에 따라 달라질 수 있으며, 정확한 조건은 상담으로 안내드립니다.
      </template>
    </p>
  </div>
</template>

<style scoped>
.sr-offer { --offer-bg:#eef4ff; --offer-ink:#2459a6; }
.sr-offer[data-offer="income-check"] { --offer-bg:#edf7f1; --offer-ink:#28704b; }
.sr-offer[data-offer="credit-required"] { --offer-bg:#f4effb; --offer-ink:#6c459c; }
.sr-offer .sr-term { background:var(--offer-bg); }
.sr-offer .sr-offer__title,.sr-offer .sr-term__monthly b { color:var(--offer-ink); }
.sr-offer__title { font-size:18px;margin:20px 0 8px;color:var(--ink-1); }
.sr-offer__hint { font-size:12px;color:var(--ink-2);margin:0 0 8px; }
.sr-estimate { font-size:12px;color:#667085;margin:0 0 12px; }
.sr-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:16px; }
.sr-header .sr-title { flex:1; margin-bottom:0; }
.sr-contact { max-width:50%; text-align:right; font-size:12px; line-height:1.6; color:var(--ink-2); overflow-wrap:anywhere; }
.sr-contact span { display:block; }
.sr-title {
  font-size: var(--fs-2xl); font-weight: var(--fw-bold);
  color: var(--ink-1); margin: 0 0 var(--sp-4);
  line-height: 1.35; letter-spacing: -0.5px;
}
.sr-snapshot {
  display: flex; flex-direction: column; gap: var(--sp-1);
  margin: 0 0 var(--sp-3); padding: var(--sp-3);
  background: var(--brand-50); border-radius: var(--r-card);
  overflow-wrap: anywhere;
}
.sr-snapshot b { font-size: var(--fs-base); color: var(--brand); }
.sr-snapshot span { font-size: var(--fs-sm); color: var(--ink-2); line-height: 1.5; }

.sr-car {
  padding: var(--sp-3); margin-bottom: var(--sp-3);
  background: var(--bg-soft); border-radius: var(--r-card);
  overflow-wrap: anywhere;
}
.sr-car__name { font-size: var(--fs-base); font-weight: 700; color: var(--ink-1); letter-spacing: -0.4px; }
.sr-car__trim { margin-top: 2px; font-size: var(--fs-base); color: var(--ink-2); }
.sr-car__opts {
  margin: var(--sp-2) 0 0; padding: 0; list-style: none;
  display: flex; flex-wrap: wrap; gap: var(--sp-1) var(--sp-2);
}
.sr-car__opts li {
  min-width: 0; max-width: 100%;
  font-size: var(--fs-sm); color: var(--ink-2);
  padding: var(--sp-1) var(--sp-2); background: var(--bg); border-radius: var(--r-chip);
}
.sr-car__color { margin-top: var(--sp-2); font-size: var(--fs-sm); color: var(--ink-2); }
.sr-car__breakdown { margin-top:12px; font-size:13px; color:var(--ink-2); }
.sr-car__breakdown > div { display:flex; justify-content:space-between; gap:12px; padding:3px 0; }
.sr-car__breakdown b { white-space:nowrap; font-weight:500; }
.sr-car__breakdown .sr-price-option { padding-left:12px; font-size:12px; }
.sr-car__total {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline;
  gap: var(--sp-1) var(--sp-2); margin-top: var(--sp-3);
  font-size: var(--fs-sm); color: var(--ink-2);
}
.sr-car__total b {
  margin-inline-start: auto; text-align: right;
  font-size: var(--fs-base); color: var(--ink-1); font-variant-numeric: tabular-nums;
}

.sr-terms { display: grid; gap: var(--sp-2); margin-bottom: var(--sp-3); }
.sr-term {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: var(--sp-2) var(--sp-3);
  padding: var(--sp-3); background: var(--brand-50); border-radius: var(--r-card);
}
.sr-term__left { flex: 1 1 140px; min-width: 0; overflow-wrap: anywhere; }
.sr-term__label { font-size: var(--fs-base); font-weight: 700; color: var(--ink-1); }
.sr-term__sub {
  margin-top: 2px; font-size: var(--fs-sm); color: var(--ink-2);
  line-height: 1.5; font-variant-numeric: tabular-nums;
}
.sr-term__monthly {
  min-width: 0; max-width: 100%; margin-inline-start: auto;
  font-size: var(--fs-base); color: var(--ink-2); text-align: right;
  white-space: normal; overflow-wrap: anywhere; font-variant-numeric: tabular-nums;
}
.sr-term__monthly b {
  font-size: var(--fs-2xl); font-weight: 700; color: var(--brand);
  letter-spacing: -0.5px; font-variant-numeric: tabular-nums;
}
.sr-muted { color: var(--ink-3); }
.sr-error {
  margin: var(--sp-2) 0 0;
  padding: var(--sp-3);
  border-radius: var(--r-card);
  background: var(--fp-err-bg);
  color: var(--fp-err);
  font-size: var(--fs-base);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.sr-cond__title {
  margin: var(--sp-4) 0 var(--sp-2);
  font-size: var(--fs-base); font-weight: var(--fw-semi); color: var(--ink-1);
}
.sr-cond {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2);
}
.sr-cond__row {
  min-width: 0;
  display: flex; flex-direction: column; gap: var(--sp-1);
  padding: var(--sp-3); border-radius: var(--r-card);
  background: var(--bg-soft);
  font-size: var(--fs-base);
}
.sr-cond__row span { color: var(--ink-2); font-size: var(--fs-sm); }
.sr-cond__row b {
  min-width: 0;
  color: var(--ink-1); font-weight: var(--fw-semi);
  white-space: normal; overflow-wrap: anywhere; word-break: keep-all;
}
@media (max-width: 340px) {
  .sr-cond { grid-template-columns: 1fr; }
}

.sr-note { margin: var(--sp-3) 0 0; font-size: var(--fs-sm); color: var(--ink-2); line-height: 1.55; }
</style>
