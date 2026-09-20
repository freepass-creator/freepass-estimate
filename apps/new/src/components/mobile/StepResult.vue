<script setup>
/* ── 견적 페이지 — 마지막 걸음 ────────────────────────────────────────────
 * ★대표 2026-09-18 「옵션 고르기 전까지는 하단에 견적 보여주지 말고, 견적도 별도 페이지로 보이게」
 *   고른 차·옵션·조건을 한 장에 모으고, 기간별 월 렌트료를 크게 보인다.
 *   숫자는 하단 금액바와 «같은 곳»(견적상태 = 웰릭스 계산)에서 읽는다 — 따로 계산하지 않는다.
 */
import { computed } from 'vue';
import { quoteState, vehicleState } from '../../store.js';
import { 견적상태 } from '../../lib/quote/index.js';
import { 담당자인가 } from '../../lib/role.js';
import { fmt } from '../../lib/format.js';

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
    const 색 = vehicleState.color != null ? m.exterior_colors?.[vehicleState.color]?.name : null;
    return {
      brand: b.manufacturer_name, model: m.model_name, variant: pt.variant_name,
      trim_name: [t.group, t.name].filter(Boolean).join(' '),
      options: 옵, colorExt: 색, colorInt: quoteState.cond?.colorInt || null,
    };
  } catch { return {}; }
}
const v = computed(() => (snapshot.value?.vehicle?.trim_name ? snapshot.value.vehicle : (quoteState.vehicle?.trim_name ? quoteState.vehicle : 목록에서())));
const c = computed(() => quoteState.cond || {});

const 계산중 = computed(() => !공유견적.value && 견적상태.상태 === 'pending');
const 계산못함 = computed(() => !공유견적.value && 견적상태.상태 === 'error');

const 기간들 = computed(() => {
  if (snapshot.value?.terms?.length) {
    return snapshot.value.terms.map((t) => ({
      term: t.term,
      monthly: t.monthly ?? null,
      인수가: t.acquire ?? null,
      depPct: t.depPct ?? 0,
      prePct: t.prePct ?? 0,
    }));
  }
  const r = 견적상태.상태 === 'ok' ? (견적상태.결과 || []) : [];
  return (quoteState.scenarios || []).map((sc, i) => ({
    term: sc.term,
    monthly: r[i]?.월대여료 ?? null,
    인수가: r[i]?.인수가 ?? null,
    depPct: sc.dep ?? 0,
    prePct: sc.pre ?? 0,
  }));
});

/* 총 차량가 — 공유 Snapshot 이 있으면 «보낸 당시» 총차량가가 우선이다. */
const 총차량가 = computed(() => {
  const snapTotal = snapshot.value?.terms?.find((t) => t.totalCarPrice)?.totalCarPrice;
  if (snapTotal) return snapTotal;
  return (견적상태.결과 || []).find((g) => g?.총차량가)?.총차량가 ?? ((v.value.total_manwon || 0) * 10000);
});

const 신용글 = computed(() => (담당자 && !공유견적.value ? (c.value.credit || '중신용') : '소득 확인 시 신청 가능'));
const 조건들 = computed(() => {
  const sc = snapshot.value?.conditions || {};
  const km = 공유견적.value ? sc.km : c.value.km;
  const svc = 공유견적.value ? sc.svc : c.value.svc;
  const ins = 공유견적.value ? sc.insProperty : c.value.insProperty;
  const driver = 공유견적.value ? sc.extraDriver : c.value.extraDriver;
  const delivery = 공유견적.value ? sc.deliveryCity : c.value.deliveryCity;
  const tint = 공유견적.value ? sc.tint : quoteState.tint?.product;
  const blackbox = 공유견적.value ? sc.blackbox : quoteState.extras?.blackbox;

  return [
    ['신용', 신용글.value],
    ['약정주행', `연 ${km ?? 2}만km`],
    ['정비', svc || '웰스 Basic'],
    ['대물', ins || '1억'],
    ['추가 운전자', driver || '없음'],
    ['탁송', delivery || '서울'],
    ['썬팅', tint || '없음'],
    ['블랙박스', blackbox || '미설치'],
    ...(공유견적.value ? [] : 담당자 ? [
      ['보증금', `${c.value.dep ?? 0}%`],
      ['선납금', `${c.value.pre ?? 0}%`],
      ['수수료', `${c.value.feeRatePct ?? 0}%`],
    ] : []),
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
  <div class="sr">
    <h2 class="sr-title">월 렌트료 견적</h2>

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
      <div v-if="v.colorExt || v.colorInt" class="sr-car__color">
        {{ [v.colorExt && `외장 ${v.colorExt}`, v.colorInt && `내장 ${v.colorInt}`].filter(Boolean).join(' · ') }}
      </div>
      <div class="sr-car__total">
        <span>총 차량가격</span><b>{{ fmt(총차량가) }}원</b>
      </div>
    </section>

    <!-- 기간별 월 렌트료 -->
    <section class="sr-terms" :aria-busy="계산중">
      <div v-for="t in 기간들" :key="t.term" class="sr-term">
        <div class="sr-term__left">
          <div class="sr-term__label">{{ t.term }}개월</div>
          <div v-if="공유견적 || t.인수가" class="sr-term__sub">
            <template v-if="공유견적">보증금 {{ t.depPct }}% · 선납 {{ t.prePct }}%</template>
            <template v-if="t.인수가">{{ 공유견적 ? ' · ' : '' }}만기 인수가 {{ fmt(t.인수가) }}원</template>
          </div>
        </div>
        <div class="sr-term__monthly">
          <template v-if="t.monthly">월 <b>{{ fmt(t.monthly) }}</b>원</template>
          <span v-else class="sr-muted">{{ 계산중 ? '계산 중…' : '—' }}</span>
        </div>
      </div>
      <p v-if="계산못함" class="sr-error">지금 계산할 수 없습니다. 잠시 뒤 다시 열거나 상담으로 문의해 주세요.</p>
    </section>

    <!-- 조건 — 결과의 보조정보이므로 2열 요약으로 압축 -->
    <div class="sr-cond__title">이용 조건</div>
    <section class="sr-cond">
      <div v-for="[k, val] in 조건들" :key="k" class="sr-cond__row">
        <span>{{ k }}</span><b>{{ val }}</b>
      </div>
    </section>

    <p class="sr-note">
      <template v-if="공유견적">
        공유 당시 웰릭스 계산 결과입니다. 조건을 변경하면 현재 기준으로 새 견적이 계산됩니다.
      </template>
      <template v-else>
        VAT 포함 금액입니다. 심사 결과에 따라 달라질 수 있으며, 정확한 조건은 상담으로 안내드립니다.
      </template>
    </p>
  </div>
</template>

<style scoped>
.sr-title {
  font-size: var(--fs-2xl); font-weight: var(--fw-bold);
  color: var(--ink-1); margin: 0 0 18px;
  line-height: 1.35; letter-spacing: -0.5px;
  text-align: left;
}
.sr-snapshot {
  display: flex; flex-direction: column; gap: 3px;
  margin: -4px 0 14px; padding: 11px 13px;
  background: var(--brand-50); border-radius: 10px;
}
.sr-snapshot b { font-size: var(--fs-md); color: var(--brand); }
.sr-snapshot span { font-size: var(--fs-sm); color: var(--ink-3); line-height: 1.45; }

.sr-car {
  padding: 16px; margin-bottom: 12px;
  background: var(--bg-soft); border-radius: 12px;
}
.sr-car__name { font-size: var(--fs-xl); font-weight: 700; color: var(--ink-1); letter-spacing: -0.4px; }
.sr-car__trim { margin-top: 2px; font-size: var(--fs-base); color: var(--ink-2); }
.sr-car__opts {
  margin: 10px 0 0; padding: 0; list-style: none;
  display: flex; flex-wrap: wrap; gap: 4px 6px;
}
.sr-car__opts li {
  font-size: var(--fs-sm); color: var(--ink-2);
  padding: 3px 8px; background: var(--bg); border-radius: 6px;
}
.sr-car__color { margin-top: 8px; font-size: var(--fs-sm); color: var(--ink-3); }
.sr-car__total {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line);
  font-size: var(--fs-md); color: var(--ink-3);
}
.sr-car__total b { font-size: var(--fs-lg); color: var(--ink-1); font-variant-numeric: tabular-nums; text-align: right; }

.sr-terms { display: grid; gap: 8px; margin-bottom: 12px; }
.sr-term {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px; background: var(--brand-50); border-radius: 12px;
}
.sr-term__label { font-size: var(--fs-lg); font-weight: 700; color: var(--ink-1); }
.sr-term__sub { margin-top: 2px; font-size: var(--fs-sm); color: var(--ink-3); font-variant-numeric: tabular-nums; }
.sr-term__monthly { font-size: var(--fs-md); color: var(--ink-2); white-space: nowrap; text-align: right; }
.sr-term__monthly b {
  font-size: var(--fs-2xl); font-weight: 700; color: var(--brand);
  letter-spacing: -0.5px; font-variant-numeric: tabular-nums;
}
.sr-muted { color: var(--ink-4); }
.sr-error { margin: 4px 0 0; font-size: var(--fs-md); color: #c62828; }

.sr-cond__title {
  margin: 16px 2px 8px;
  font-size: var(--fs-sm); font-weight: var(--fw-semi); color: var(--ink-3);
}
.sr-cond {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  padding: 1px;
  background: var(--line);
  border-radius: var(--r-card);
  overflow: hidden;
}
.sr-cond__row {
  min-width: 0;
  display: flex; flex-direction: column; gap: 3px;
  padding: 11px 12px;
  background: var(--bg-soft);
  font-size: var(--fs-md);
}
.sr-cond__row span { color: var(--ink-3); font-size: var(--fs-sm); }
.sr-cond__row b {
  min-width: 0;
  color: var(--ink-1); font-weight: var(--fw-semi);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
@media (max-width: 340px) {
  .sr-cond { grid-template-columns: 1fr; }
}

.sr-note { margin: 12px 2px 0; font-size: var(--fs-sm); color: var(--ink-4); line-height: 1.55; }
</style>
