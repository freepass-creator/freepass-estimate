<script setup>
// 전체 차종 인덱스 — 25 베이스 모델, 브랜드별 그룹화
// 카드 클릭 → /guide/{slug}.html 정적 페이지로 이동
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';
import { SLUG_META, SLUG_BASE_MODEL, ALL_SLUGS, imageOf } from '../../lib/slug.js';

const vehicles = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
  loading.value = false;
});

// slug → 가장 저렴한 트림의 60개월 표준 견적
const items = computed(() => {
  const arr = ALL_SLUGS.map(slug => {
    const meta = SLUG_META[slug];
    const baseModel = SLUG_BASE_MODEL[slug];
    const rows = vehicles.value.filter(v => {
      // Hybrid 포함 — 같은 slug 묶음
      const baseMatch = v.model === baseModel;
      const hevMatch = v.model === baseModel + ' Hybrid';
      return baseMatch || hevMatch;
    });
    let monthly = null, price = null, trimCount = rows.length;
    if (rows.length) {
      const cheapest = rows.reduce((m, c) => (!m || c.price < m.price) ? c : m, null);
      price = cheapest.price;
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
        monthly = r.monthly;
      } catch {}
    }
    return {
      slug,
      ...meta,
      model: baseModel,
      monthly,
      price,
      trimCount,
      image: imageOf(slug),
    };
  });
  return arr;
});

// 브랜드별 그룹화
const grouped = computed(() => {
  const byBrand = { '현대': [], '기아': [], '제네시스': [] };
  for (const it of items.value) {
    if (byBrand[it.brand]) byBrand[it.brand].push(it);
  }
  return Object.entries(byBrand).map(([brand, list]) => ({ brand, list }));
});

function onImgError(e, item) {
  e.target.style.display = 'none';
  e.target.parentElement.classList.add('vi-card__visual--fallback');
}
</script>

<template>
  <div class="vi">
    <div v-for="g in grouped" :key="g.brand" class="vi-group">
      <h3 class="vi-group__title">
        {{ g.brand }}
        <span class="vi-group__count">{{ g.list.length }}종</span>
      </h3>
      <div class="vi-grid">
        <a v-for="it in g.list" :key="it.slug"
           class="vi-card"
           :href="`/guide.html?slug=${it.slug}`">
          <div class="vi-card__visual" :class="{ 'vi-card__visual--fallback': !it.image }">
            <img v-if="it.image" :src="it.image" :alt="it.model" class="vi-card__img"
                 @error="(e) => onImgError(e, it)" />
            <i class="ph ph-car-profile vi-card__fallback-icon"></i>
          </div>
          <div class="vi-card__body">
            <div class="vi-card__tagline">{{ it.tagline }}</div>
            <div class="vi-card__model">{{ it.model }}</div>
            <div class="vi-card__monthly" v-if="it.monthly">
              월 <b>{{ fmt(it.monthly) }}</b>원~
            </div>
            <div class="vi-card__sub" v-if="it.trimCount > 1">
              트림 {{ it.trimCount }}개
            </div>
          </div>
          <div class="vi-card__arrow">
            <i class="ph ph-arrow-right"></i>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vi { max-width: 1180px; margin: 0 auto; }

.vi-group { margin-bottom: 28px; }
.vi-group:last-child { margin-bottom: 0; }
.vi-group__title {
  display: flex; align-items: center; gap: 8px;
  margin: 0 0 12px;
  font-size: 16px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.02em;
}
.vi-group__count {
  font-size: 11px; font-weight: 600; color: var(--ink-4);
  background: var(--bg-soft);
  padding: 2px 8px; border-radius: 999px;
}

.vi-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
}
@media (max-width: 1024px) {
  .vi-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 640px) {
  .vi-grid { grid-template-columns: repeat(2, 1fr); }
}

.vi-card {
  position: relative;
  display: flex; flex-direction: column;
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: 10px;
  padding: 10px;
  text-decoration: none;
  color: inherit;
  transition: border-color var(--t-fast), transform var(--t-fast), box-shadow var(--t-fast);
}
.vi-card:hover {
  border-color: var(--ink-1);
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0,0,0,0.06);
}

.vi-card__visual {
  width: 100%; aspect-ratio: 16/9;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  margin-bottom: 6px;
}
.vi-card__img {
  width: 96%; height: 96%; object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.08));
}
.vi-card__fallback-icon {
  display: none;
  font-size: 48px; color: var(--ink-4); opacity: 0.4;
}
.vi-card__visual--fallback .vi-card__fallback-icon { display: block; }

.vi-card__body {
  display: flex; flex-direction: column; gap: 2px;
  padding: 4px 2px;
  flex: 1;
}
.vi-card__tagline {
  font-size: 10px; font-weight: 700; color: var(--brand);
  letter-spacing: 0.2px;
}
.vi-card__model {
  margin: 2px 0;
  font-size: 13px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.02em; line-height: 1.25;
}
.vi-card__monthly {
  font-size: 11px; color: var(--ink-3);
  font-variant-numeric: tabular-nums;
  margin-top: auto;
}
.vi-card__monthly b {
  color: var(--ink-1); font-weight: 800;
  font-size: 13px;
}
.vi-card__sub {
  font-size: 10px; color: var(--ink-4);
  margin-top: 1px;
}

.vi-card__arrow {
  position: absolute; top: 12px; right: 12px;
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-soft);
  border-radius: 50%;
  opacity: 0; transition: opacity var(--t-fast);
}
.vi-card__arrow i { font-size: 11px; color: var(--ink-2); }
.vi-card:hover .vi-card__arrow { opacity: 1; }
</style>
