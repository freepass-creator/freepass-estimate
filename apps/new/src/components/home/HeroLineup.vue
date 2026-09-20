<script setup>
// 히어로 우측 — 인기 차종 4종 미니 그리드 (2x2)
// 첫 화면에서 즉시 차량 이미지 + 월 견적 노출 → 시각 흥미 유발
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';
import { MODEL_SLUG, imageOf } from '../../lib/slug.js';

const PICKS = [
  { brand: '현대',   model: '더 뉴 캐스퍼',         tagline: '입문 SUV' },
  { brand: '현대',   model: '디 올 뉴 팰리세이드',   tagline: '대형 SUV' },
  { brand: '기아',   model: '카니발',                tagline: '미니밴 1위' },
  { brand: '제네시스', model: 'G80',                tagline: '비즈니스 세단' },
];

const vehicles = ref([]);
onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
});

const cards = computed(() => {
  return PICKS.map(pick => {
    const slug = MODEL_SLUG[pick.model];
    const image = imageOf(slug);
    const candidates = vehicles.value.filter(v => v.brand === pick.brand && v.model === pick.model);
    if (!candidates.length) return { ...pick, slug, image, monthly: null };
    const cheapest = candidates.reduce((m, c) => (!m || c.price < m.price) ? c : m, null);
    try {
      const r = calcQuote({
        vehicle: cheapest,
        options: { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
        contract: { term: 60, km: '2만km', dep: 10, pre: 0 },
        customer: { creditGrade: '중신용' },
        insurance: {
          property: '1억', extraDriver: '없음',
          exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
          deductible: '30만원~', emergency: '가입',
        },
        fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
      });
      return { ...pick, slug, image, monthly: r.monthly };
    } catch {
      return { ...pick, slug, image, monthly: null };
    }
  });
});

function goGuide(c) {
  if (c.slug) location.href = `/guide.html?slug=${c.slug}`;
}
</script>

<template>
  <div class="hl">
    <div class="hl__head">
      <div class="hl__eyebrow">
        <i class="ph ph-fire"></i> 지금 인기 차종 BEST 4
      </div>
      <div class="hl__sub">표준 조건 (보증금 10% · 60개월)</div>
    </div>
    <div class="hl__grid">
      <a v-for="(c, i) in cards" :key="i"
         class="hl-card"
         :class="{ 'hl-card--top': i === 0 }"
         href="javascript:void(0)"
         @click="goGuide(c)">
        <div class="hl-card__tag">{{ c.tagline }}</div>
        <div class="hl-card__visual">
          <img v-if="c.image" :src="c.image" :alt="c.model" class="hl-card__img" @error="c.image = null" />
          <i v-else class="ph ph-car-profile hl-card__icon"></i>
        </div>
        <div class="hl-card__body">
          <div class="hl-card__brand">{{ c.brand }}</div>
          <div class="hl-card__model">{{ c.model }}</div>
          <div class="hl-card__monthly">
            <template v-if="c.monthly">월 <b>{{ fmt(c.monthly) }}</b>원~</template>
            <template v-else>—</template>
          </div>
        </div>
      </a>
    </div>
    <a class="hl__more" href="/vehicles.html">
      전체 25종 가이드 보기 <i class="ph ph-arrow-right"></i>
    </a>
  </div>
</template>

<style scoped>
.hl {
  background: var(--bg);
  border-radius: 18px;
  padding: 20px;
  box-shadow:
    0 20px 50px rgba(0,0,0,0.07),
    0 4px 12px rgba(0,0,0,0.05);
  border: 1px solid var(--line);
}
@media (max-width: 540px) {
  .hl { padding: 16px; border-radius: 14px; }
}

.hl__head {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 14px;
  flex-wrap: wrap; gap: 4px;
}
.hl__eyebrow {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--brand); color: #fff;
  padding: 5px 12px; border-radius: 999px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
}
.hl__eyebrow i { font-size: 12px; }
.hl__sub {
  font-size: 10.5px; color: var(--ink-4);
}

.hl__grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  margin-bottom: 14px;
}

.hl-card {
  position: relative;
  display: flex; flex-direction: column;
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  padding: 10px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: border-color var(--t-fast), transform var(--t-fast);
}
.hl-card:hover {
  border-color: var(--ink-1);
  transform: translateY(-2px);
}
.hl-card--top { border-color: var(--brand); }

.hl-card__tag {
  position: absolute; top: 8px; left: 8px;
  font-size: 9.5px; font-weight: 700; color: #fff;
  background: var(--brand);
  padding: 2px 7px; border-radius: 999px;
  letter-spacing: 0.2px;
  z-index: 1;
}
.hl-card__visual {
  width: 100%; aspect-ratio: 16/9;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
  margin-bottom: 4px;
}
.hl-card__img {
  width: 96%; height: 96%; object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.08));
}
.hl-card__icon { font-size: 44px; color: var(--ink-4); opacity: 0.4; }

.hl-card__body { display: flex; flex-direction: column; gap: 1px; }
.hl-card__brand {
  font-size: 9.5px; color: var(--ink-4); font-weight: 600;
  letter-spacing: 0.3px;
}
.hl-card__model {
  font-size: 13px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.hl-card__monthly {
  margin-top: 4px;
  font-size: 11px; color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.hl-card__monthly b {
  font-size: 13.5px; color: var(--ink-1); font-weight: 800;
  letter-spacing: -0.02em;
}

.hl__more {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 11px;
  background: var(--bg-soft);
  border-radius: 999px;
  font-size: 12.5px; font-weight: 700; color: var(--ink-2);
  text-decoration: none;
  transition: background var(--t-fast), color var(--t-fast);
}
.hl__more:hover { background: var(--ink-1); color: #fff; }
.hl__more i { font-size: 13px; }
</style>
