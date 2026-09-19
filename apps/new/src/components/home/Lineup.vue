<script setup>
// 인기 차종 카드 (hana-car / kbrentcardirect 스타일) — 4종 추천
// 표준 조건(중신용/보증금10%/선납0%/2만km/60개월)으로 월대여료 즉시 계산
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';
import { MODEL_SLUG, imageOf } from '../../lib/slug.js';

// 4종 picks — 인기 차종 + 블로그 스타일 추천 컬럼
// 차량 이미지는 /public/cars/{slug}.jpg 에 직접 드롭 (없으면 SVG fallback)
// image 는 PICKS 에서 빼고 cards computed 에서 imageOf(slug) 로 단일 매핑
const PICKS = [
  {
    brand: '현대', model: '더 뉴 캐스퍼', tagline: '입문 SUV',
    blurb: '도심에서 가장 잘 어울리는 경형 SUV. 작지만 알찬 실내, 1인·2인 가구의 첫 차로 만족도 높습니다.',
    pros: ['가성비 최강', '주차 쉬움', '연비 우수'],
  },
  {
    brand: '현대', model: '디 올 뉴 팰리세이드', tagline: '대형 SUV',
    blurb: '7·9인승 풀사이즈 SUV. 가족 여행·등하원·골프까지 한 대로. 통풍·열선·어드밴스드 안전 패키지 기본.',
    pros: ['7/9인승', '풀옵션 기본', '공간 여유'],
  },
  {
    brand: '기아', model: '카니발', tagline: '미니밴 1위',
    blurb: '국내 미니밴 표준. 9인승 풀옵션으로 가족·임원·영업까지 만능. 슬라이딩 도어 + 통풍 시트는 보너스.',
    pros: ['9인승', '슬라이딩 도어', '하이리무진 옵션'],
  },
  {
    brand: '제네시스', model: 'G80', tagline: '비즈니스 세단',
    blurb: '국산 럭셔리 세단의 정점. 비즈니스·임원 의전에 정형화된 디자인과 다이내믹 주행감.',
    pros: ['풀체인지 신차', '럭셔리 인테리어', '주행감 우수'],
  },
];

const vehicles = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
  loading.value = false;
});

// 각 pick — vehicles.json 에서 가장 저렴한 트림 1개 잡고 60개월 표준 견적
const cards = computed(() => {
  return PICKS.map(pick => {
    const slug = MODEL_SLUG[pick.model];
    const image = imageOf(slug);
    const candidates = vehicles.value
      .filter(v => v.brand === pick.brand)
      .filter(v => v.model === pick.model);
    if (!candidates.length) return { ...pick, image, monthly: null, price: null };
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
      return { ...pick, image, monthly: r.monthly, price: cheapest.price, trim: cheapest.trim };
    } catch {
      return { ...pick, image, monthly: null, price: cheapest.price, trim: cheapest.trim };
    }
  });
});

function goToContact(card) {
  const params = new URLSearchParams({
    vehicle: `${card.brand} ${card.model}`,
    term: 60,
    monthly: card.monthly || '',
  });
  history.replaceState(null, '', '#contact?' + params.toString());
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}

function goToGuide(card) {
  const slug = MODEL_SLUG[card.model];
  if (slug) {
    location.href = `/guide.html?slug=${slug}`;
  } else {
    document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth' });
  }
}
</script>

<template>
  <div class="lu">
    <div class="lu-grid">
      <div
        v-for="(c, i) in cards" :key="i"
        class="lu-card"
      >
        <!-- 차량 이미지 (제조사 공식 PNG → SVG fallback) -->
        <div class="lu-card__image">
          <span class="lu-card__badge">{{ c.tagline }}</span>
          <img v-if="c.image"
               :src="c.image"
               :alt="c.model"
               class="lu-card__img"
               @error="c.image = null" />
          <i v-else class="ph ph-car-profile lu-card__fallback"></i>
        </div>

        <div class="lu-card__top">
          <div class="lu-card__brand">{{ c.brand }}</div>
          <div class="lu-card__model">{{ c.model }}</div>
          <div class="lu-card__blurb">{{ c.blurb }}</div>
          <div class="lu-card__pros">
            <span v-for="(p, pi) in c.pros" :key="pi" class="lu-card__pro">
              <i class="ph ph-check"></i> {{ p }}
            </span>
          </div>
        </div>

        <div class="lu-card__price">
          <div class="lu-card__price-label">60개월 월 대여료부터</div>
          <div class="lu-card__monthly">
            <template v-if="c.monthly">
              <span class="lu-card__monthly-num">{{ fmt(c.monthly) }}</span>
              <small>원/월</small>
            </template>
            <template v-else>—</template>
          </div>
          <div class="lu-card__sub" v-if="c.price">
            차량가 {{ fmt(c.price) }}원~
          </div>
        </div>

        <div class="lu-card__actions">
          <button class="lu-card__btn lu-card__btn--ghost" @click="goToGuide(c)">
            <i class="ph ph-book-open"></i> 차량 가이드
          </button>
          <button class="lu-card__btn lu-card__btn--primary" @click="goToContact(c)">
            <i class="ph ph-chat-circle-dots"></i> 상담 신청
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lu { max-width: 1180px; margin: 0 auto; }

.lu-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
}
@media (max-width: 1024px) {
  .lu-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .lu-grid { grid-template-columns: 1fr; }
}

.lu-card {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 24px 22px;
  display: flex; flex-direction: column; gap: 20px;
  transition: border-color var(--t-fast), transform var(--t-fast), box-shadow var(--t-fast);
}
.lu-card:hover {
  border-color: var(--ink-4);
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

/* 차량 이미지 영역 */
.lu-card__image {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  margin-bottom: 4px;
}
.lu-card__img {
  width: 96%; height: 96%; object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0,0,0,0.08));
  transition: transform var(--t-fast);
}
.lu-card:hover .lu-card__img { transform: scale(1.04); }
.lu-card__fallback {
  font-size: 80px; color: var(--ink-4); opacity: 0.5;
}
.lu-card__badge {
  position: absolute; top: 12px; left: 12px;
  font-size: 10px; font-weight: 700; color: #fff;
  background: var(--brand);
  padding: 4px 10px; border-radius: var(--radius-pill);
  letter-spacing: 0.3px;
  z-index: 1;
  box-shadow: 0 4px 10px rgba(225, 20, 30, 0.3);
}

.lu-card__top { display: flex; flex-direction: column; gap: 6px; }
.lu-card__brand {
  font-size: 11px; color: var(--ink-4); font-weight: 500;
  letter-spacing: 0.3px;
}
.lu-card__model {
  font-size: 19px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.3px; line-height: 1.2;
}
.lu-card__blurb {
  font-size: 12.5px; color: var(--ink-3);
  line-height: 1.6;
  margin-top: 2px;
}
.lu-card__pros {
  display: flex; flex-wrap: wrap; gap: 4px;
  margin-top: 8px;
}
.lu-card__pro {
  display: inline-flex; align-items: center; gap: 3px;
  background: var(--bg-soft);
  padding: 3px 8px; border-radius: var(--radius-pill);
  font-size: 10.5px; font-weight: 600; color: var(--ink-2);
}
.lu-card__pro i { font-size: 11px; color: var(--brand); }

.lu-card__price {
  padding: 14px 0;
  border-top: 1px dashed var(--line-2);
  border-bottom: 1px dashed var(--line-2);
}
.lu-card__price-label {
  font-size: 11px; color: var(--ink-4); font-weight: 500;
  letter-spacing: 0.2px; margin-bottom: 4px;
}
.lu-card__monthly {
  display: flex; align-items: baseline; gap: 2px;
  font-variant-numeric: tabular-nums;
}
.lu-card__monthly-num {
  font-size: 24px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.04em;
}
.lu-card__monthly small {
  font-size: 12px; color: var(--ink-4); font-weight: 400;
  margin-left: 3px;
}
.lu-card__sub {
  margin-top: 4px;
  font-size: 11px; color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}

.lu-card__actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.lu-card__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 40px;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  border-radius: var(--radius-pill);
  font-family: inherit;
  font-size: 12.5px; font-weight: 600;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.lu-card__btn i { font-size: 14px; }
.lu-card__btn--ghost:hover {
  border-color: var(--ink-4); color: var(--ink-1);
}
.lu-card__btn--primary {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}
.lu-card__btn--primary:hover {
  background: var(--brand); border-color: var(--brand);
}
</style>
