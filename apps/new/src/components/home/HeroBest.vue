<script setup>
// 히어로 우측 — BEST 인기 차종 4종 슬라이드 (자동 회전)
// 각 슬라이드: 차량 이미지 + 월 가격으로 "이만큼만 내면 신차" 즉시 증명
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';
import { MODEL_SLUG, imageOf } from '../../lib/slug.js';

const FEATURED = [
  { brand: '현대',    model: '더 뉴 캐스퍼',       tagline: '가성비 BEST · 입문 SUV' },
  { brand: '기아',    model: '카니발',             tagline: '미니밴 1위 · 9인승 만능' },
  { brand: '현대',    model: '디 올 뉴 팰리세이드', tagline: '7·9인승 풀사이즈 SUV' },
  { brand: '제네시스', model: 'G80',                tagline: '비즈니스 세단의 정점' },
];
const AUTO_MS = 4500;

const vehicles = ref([]);
const activeIndex = ref(0);
let timer = null;

onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
  startAuto();
});

onBeforeUnmount(() => { if (timer) clearInterval(timer); });

function startAuto() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % FEATURED.length;
  }, AUTO_MS);
}
function selectSlide(i) {
  activeIndex.value = i;
  startAuto();
}
function prev() {
  activeIndex.value = (activeIndex.value - 1 + FEATURED.length) % FEATURED.length;
  startAuto();
}
function next() {
  activeIndex.value = (activeIndex.value + 1) % FEATURED.length;
  startAuto();
}

const slides = computed(() => FEATURED.map(f => {
  const slug = MODEL_SLUG[f.model];
  const image = imageOf(slug);
  const candidates = vehicles.value.filter(v => v.brand === f.brand && v.model === f.model);
  if (!candidates.length) return { ...f, slug, image, monthly: null };
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
    return { ...f, slug, image, monthly: r.monthly };
  } catch {
    return { ...f, slug, image, monthly: null };
  }
}));

const current = computed(() => slides.value[activeIndex.value]);

function goGuide() {
  if (current.value.slug) location.href = `/guide.html?slug=${current.value.slug}`;
}
function goContact() {
  const c = current.value;
  const params = new URLSearchParams({
    vehicle: `${c.brand} ${c.model}`,
    term: 60,
    monthly: c.monthly || '',
  });
  history.replaceState(null, '', '#contact?' + params.toString());
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <div class="hb">
    <div class="hb__head">
      <div class="hb__tag">
        <i class="ph ph-fire"></i> 지금 인기 BEST {{ slides.length }}
      </div>
      <div class="hb__nav">
        <button class="hb__arrow" @click="prev" aria-label="이전">
          <i class="ph ph-caret-left"></i>
        </button>
        <span class="hb__counter">{{ activeIndex + 1 }} / {{ slides.length }}</span>
        <button class="hb__arrow" @click="next" aria-label="다음">
          <i class="ph ph-caret-right"></i>
        </button>
      </div>
    </div>

    <!-- Slide track -->
    <div class="hb__track" :style="{ transform: `translateX(-${activeIndex * 100}%)` }">
      <article v-for="(s, i) in slides" :key="i" class="hb__slide">
        <div class="hb__visual">
          <img v-if="s.image" :src="s.image" :alt="s.model" class="hb__img"
               @error="s.image = null" />
          <i v-else class="ph ph-car-profile hb__icon"></i>
        </div>
        <div class="hb__body">
          <div class="hb__brand">{{ s.brand }}</div>
          <div class="hb__model">{{ s.model }}</div>
          <div class="hb__tagline">{{ s.tagline }}</div>
        </div>
      </article>
    </div>

    <!-- 현재 슬라이드의 가격 + CTA (트랙 밖, 한 군데 고정) -->
    <div class="hb__price">
      <div class="hb__price-label">월 부담은</div>
      <div class="hb__price-amount">
        <span class="hb__price-num">{{ current?.monthly ? fmt(current.monthly) : '—' }}</span>
        <small>원~</small>
      </div>
      <div class="hb__price-meta">60개월 · 보증금 10% · 보험·세금 포함</div>
    </div>

    <div class="hb__actions">
      <button class="hb__btn hb__btn--primary" @click="goContact">
        <i class="ph ph-chat-circle-dots"></i> 이 차로 상담
      </button>
      <button class="hb__btn hb__btn--ghost" @click="goGuide">
        <i class="ph ph-book-open"></i> 상세보기
      </button>
    </div>

    <!-- Dot indicator -->
    <div class="hb__dots">
      <button v-for="(s, i) in slides" :key="i"
              class="hb__dot"
              :class="{ 'is-active': i === activeIndex }"
              @click="selectSlide(i)"
              :aria-label="`${i+1}번 슬라이드`"></button>
    </div>
  </div>
</template>

<style scoped>
.hb {
  background: var(--bg);
  border-radius: 18px;
  padding: 20px 22px;
  box-shadow:
    0 20px 50px rgba(0,0,0,0.07),
    0 4px 12px rgba(0,0,0,0.05);
  border: 1px solid var(--line);
  overflow: hidden;
}
@media (max-width: 540px) {
  .hb { padding: 18px; border-radius: 14px; }
}

.hb__head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.hb__tag {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--brand); color: #fff;
  padding: 6px 14px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800; letter-spacing: 0.2px;
}
.hb__tag i { font-size: 12px; }

.hb__nav { display: flex; align-items: center; gap: 4px; }
.hb__arrow {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--bg-soft); border: 0; color: var(--ink-2);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background var(--t-fast);
}
.hb__arrow:hover { background: var(--ink-1); color: #fff; }
.hb__arrow i { font-size: 13px; }
.hb__counter {
  font-family: 'Inter', sans-serif;
  font-size: 11px; color: var(--ink-4); font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin: 0 4px;
  letter-spacing: 0.3px;
}

/* === Slide track === */
.hb__track {
  display: flex;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  margin: 0 -22px;  /* 카드 패딩 무효화 — 끝까지 확장 */
}
.hb__slide {
  flex-shrink: 0;
  width: 100%;
  padding: 0 22px;
}

.hb__visual {
  width: 100%; aspect-ratio: 16/9;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  margin-bottom: 12px;
}
.hb__img {
  width: 100%; height: 100%; object-fit: contain;
  filter: drop-shadow(0 10px 14px rgba(0,0,0,0.12));
}
.hb__icon { font-size: 64px; color: var(--ink-4); opacity: 0.4; }

.hb__body { display: flex; flex-direction: column; gap: 2px; min-height: 64px; }
.hb__brand {
  font-size: 11.5px; color: var(--ink-4); font-weight: 700;
  letter-spacing: 0.4px;
}
.hb__model {
  font-size: 20px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.025em; line-height: 1.2;
}
.hb__tagline {
  font-size: 12px; color: var(--ink-3); font-weight: 500;
  margin-top: 2px;
}

.hb__price {
  margin: 14px 0 12px;
  padding: 14px 0;
  border-top: 1px dashed var(--line);
  border-bottom: 1px dashed var(--line);
  text-align: center;
}
.hb__price-label {
  font-size: 11px; color: var(--ink-4); font-weight: 600;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}
.hb__price-amount {
  display: inline-flex; align-items: baseline; gap: 2px;
  font-family: 'Inter', 'Pretendard Variable', sans-serif;
  font-variant-numeric: tabular-nums;
}
.hb__price-num {
  font-size: 36px; font-weight: 800; color: var(--brand);
  letter-spacing: -0.05em; line-height: 1;
}
.hb__price-amount small {
  font-size: 14px; color: var(--ink-3); font-weight: 600;
  margin-left: 1px;
}
.hb__price-meta {
  margin-top: 4px;
  font-size: 11px; color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}

.hb__actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  margin-bottom: 12px;
}
.hb__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 42px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 13px; font-weight: 700;
  cursor: pointer;
  letter-spacing: -0.01em;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.hb__btn i { font-size: 14px; }
.hb__btn--primary {
  background: var(--ink-1); color: #fff; border: 0;
}
.hb__btn--primary:hover { background: var(--brand); }
.hb__btn--ghost {
  background: var(--bg); color: var(--ink-2);
  border: 1.5px solid var(--line-2);
}
.hb__btn--ghost:hover { border-color: var(--ink-1); color: var(--ink-1); }

.hb__dots {
  display: flex; gap: 6px; justify-content: center;
}
.hb__dot {
  width: 22px; height: 4px; border-radius: 999px;
  background: var(--line);
  border: 0;
  cursor: pointer;
  padding: 0;
  transition: background var(--t-fast), width var(--t-fast);
}
.hb__dot:hover { background: var(--ink-4); }
.hb__dot.is-active { background: var(--brand); width: 34px; }
</style>
