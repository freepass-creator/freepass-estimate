<script setup>
// 차종 상세 가이드 페이지
// 섹션 스택: hero / 트림 비교 / 페르소나 / 차종 썰 / 연비·세금·보험 / 유튜브 / 경쟁 / FAQ / CTA
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';
import { SLUG_META, SLUG_BASE_MODEL, imageOf } from '../../lib/slug.js';
import { groupBySubModel } from '../../lib/trim.js';
import { STORIES } from './stories.js';
import { YOUTUBE_PICKS } from './youtube.js';

const props = defineProps({ slug: String });

const vehicles = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
  loading.value = false;
  // 타이틀 업데이트
  if (meta.value) document.title = `${meta.value.model} 가이드 · 웰릭스 모빌리티`;
});

const meta = computed(() => {
  if (!props.slug) return null;
  const m = SLUG_META[props.slug];
  if (!m) return null;
  return {
    ...m,
    slug: props.slug,
    model: SLUG_BASE_MODEL[props.slug],
    image: imageOf(props.slug),
    story: STORIES[props.slug] || null,
    youtube: YOUTUBE_PICKS[props.slug] || [],
  };
});

// 해당 차종의 모든 트림 (베이스 + Hybrid)
const trims = computed(() => {
  if (!meta.value) return [];
  const base = meta.value.model;
  const rows = vehicles.value.filter(v => v.model === base || v.model === base + ' Hybrid');
  return rows.map(v => {
    let monthly = null;
    try {
      const r = calcQuote({
        vehicle: v,
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
    return {
      ...v,
      monthly,
      isHybrid: v.model.includes('Hybrid'),
    };
  }).sort((a, b) => a.price - b.price);
});

const minMonthly = computed(() => trims.value.filter(t => t.monthly).reduce((m, t) => !m || t.monthly < m ? t.monthly : m, null));
const minPrice = computed(() => trims.value[0]?.price);

// 세부모델별 그룹화 (대표는 그룹 최저가, 펼치면 등급 트림 전체)
const trimGroups = computed(() => groupBySubModel(trims.value));
const openGroups = ref(new Set());
function toggleGroup(subModel) {
  if (openGroups.value.has(subModel)) openGroups.value.delete(subModel);
  else openGroups.value.add(subModel);
  // Vue reactivity 트리거
  openGroups.value = new Set(openGroups.value);
}
function isOpen(subModel) { return openGroups.value.has(subModel); }

// 경쟁 차종 — 같은 body 카테고리에서 자기 자신 제외
const competitors = computed(() => {
  if (!meta.value) return [];
  return Object.entries(SLUG_META)
    .filter(([slug, m]) => m.body === meta.value.body && slug !== meta.value.slug)
    .slice(0, 4)
    .map(([slug, m]) => ({ slug, ...m, model: SLUG_BASE_MODEL[slug], image: `/cars/${slug}.png` }));
});

// 페르소나 — 어떤 사람에게 어울리나
const personas = computed(() => meta.value?.story?.personas || []);

// FAQ
const faqs = computed(() => meta.value?.story?.faqs || [
  { q: '꼭 신차로 출고되나요?', a: '네. 제휴 직영점에서 신차로 출고하며, 가이드 표시 트림 외 다른 트림도 상담을 통해 가능합니다.' },
  { q: '계약 기간은 어떻게 되나요?', a: '36/48/60개월 중 선택. 표시 견적은 60개월 기준입니다.' },
  { q: '중도 해지 가능한가요?', a: '36개월 이후 약정 위약금 없이 반납 가능. 36개월 이전엔 잔여 회차의 일부가 위약금으로 청구됩니다.' },
  { q: '보험료·세금은 포함되나요?', a: '자동차세 + 책임보험료는 포함. 종합보험은 운전자 조건에 따라 별도 안내됩니다.' },
]);

function goContact() {
  if (!meta.value) return;
  const params = new URLSearchParams({
    vehicle: `${meta.value.brand} ${meta.value.model}`,
    term: 60,
  });
  location.href = `/home.html#contact?${params.toString()}`;
}

function onImgError(e, m) {
  if (e.target.src.endsWith('.png')) {
    e.target.src = m.imageFallback;
  } else {
    e.target.style.display = 'none';
  }
}

// 페르소나 매치 색상 매핑
const PERSONA_ICONS = {
  '20s': 'ph-baby', '30s': 'ph-briefcase', '40s': 'ph-house-line', '50plus': 'ph-armchair',
  'single': 'ph-user', 'couple': 'ph-heart', 'family': 'ph-users-four', 'large': 'ph-users-three',
  'commute': 'ph-clock', 'leisure': 'ph-mountains', 'business': 'ph-handshake', 'hobby': 'ph-bicycle',
};
</script>

<template>
  <div v-if="!props.slug || !meta" class="gd-empty">
    <i class="ph ph-warning-circle"></i>
    <h2>차종을 찾을 수 없습니다</h2>
    <p>URL을 확인하시거나 <a href="/vehicles.html">전체 차종</a>으로 이동해주세요.</p>
  </div>

  <template v-else>
    <!-- HERO -->
    <section class="gd-hero">
      <div class="gd-container">
        <div class="gd-hero__inner">
          <div class="gd-hero__left">
            <div class="gd-hero__crumbs">
              <a href="/vehicles.html">전체 차종</a>
              <i class="ph ph-caret-right"></i>
              <span>{{ meta.brand }}</span>
              <i class="ph ph-caret-right"></i>
              <span>{{ meta.model }}</span>
            </div>
            <div class="gd-hero__tagline">{{ meta.tagline }}</div>
            <h1 class="gd-hero__title">{{ meta.brand }} <em>{{ meta.model }}</em></h1>
            <p v-if="meta.story?.hook" class="gd-hero__hook">{{ meta.story.hook }}</p>
            <p v-else class="gd-hero__hook">월 대여료부터 트림별 견적·연비·디자인까지 한 번에 정리했습니다.</p>

            <div class="gd-hero__stats" v-if="trims.length">
              <div class="gd-hero__stat">
                <div class="gd-hero__stat-label">60개월 월 대여료부터</div>
                <div class="gd-hero__stat-value">
                  <b>{{ fmt(minMonthly) }}</b><small>원~</small>
                </div>
              </div>
              <div class="gd-hero__stat">
                <div class="gd-hero__stat-label">차량가부터</div>
                <div class="gd-hero__stat-value">
                  <b>{{ fmt(minPrice) }}</b><small>원~</small>
                </div>
              </div>
              <div class="gd-hero__stat">
                <div class="gd-hero__stat-label">선택 가능 트림</div>
                <div class="gd-hero__stat-value">
                  <b>{{ trims.length }}</b><small>개</small>
                </div>
              </div>
            </div>

            <div class="gd-hero__cta">
              <button class="gd-btn gd-btn--primary" @click="goContact">
                <i class="ph ph-chat-circle-dots"></i> 이 차로 상담 신청
              </button>
              <a class="gd-btn gd-btn--outline" href="#trims">
                <i class="ph ph-table"></i> 트림 비교
              </a>
            </div>
          </div>

          <div class="gd-hero__right">
            <div class="gd-hero__image">
              <img :src="meta.image" :alt="meta.model" class="gd-hero__img"
                   @error="(e) => onImgError(e, meta)" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- TRIM 비교표 — 세부모델 accordion -->
    <section class="gd-section" id="trims">
      <div class="gd-container">
        <h2 class="gd-section__title">
          <i class="ph ph-table"></i> 트림별 견적 비교
        </h2>
        <p class="gd-section__sub">
          세부모델 {{ trimGroups.length }}개 · 총 {{ trims.length }}개 트림.
          대표 견적은 각 세부모델의 최저가입니다. 펼치면 등급별 트림이 모두 보입니다.
        </p>

        <div v-if="trimGroups.length" class="gd-trim-groups">
          <div v-for="(g, gi) in trimGroups" :key="g.subModel"
               class="gd-trim-group"
               :class="{ 'is-open': isOpen(g.subModel), 'is-cheapest': gi === 0 }">
            <!-- 그룹 헤더 (대표 트림 = 최저가) -->
            <button class="gd-trim-group__head" @click="toggleGroup(g.subModel)">
              <div class="gd-trim-group__head-left">
                <span v-if="gi === 0" class="gd-trim-row__badge">최저</span>
                <span v-if="g.isHybrid" class="gd-trim-row__hev">HEV</span>
                <span class="gd-trim-group__name">{{ g.subModel }}</span>
                <span class="gd-trim-group__count">{{ g.count }}개 등급</span>
              </div>
              <div class="gd-trim-group__head-right">
                <div class="gd-trim-group__monthly">
                  <template v-if="g.minMonthly">
                    월 <b>{{ fmt(g.minMonthly) }}</b>원~
                  </template>
                  <template v-else>—</template>
                </div>
                <i class="ph ph-caret-down gd-trim-group__caret"></i>
              </div>
            </button>

            <!-- 펼침 영역 — 등급 트림 리스트 -->
            <div v-show="isOpen(g.subModel)" class="gd-trim-group__body">
              <div v-for="(t, ti) in g.items" :key="ti" class="gd-trim-grade">
                <div class="gd-trim-grade__name">{{ t.grade || t.trim }}</div>
                <div class="gd-trim-grade__price">{{ fmt(t.price) }}<small>원</small></div>
                <div class="gd-trim-grade__monthly">
                  <template v-if="t.monthly"><b>{{ fmt(t.monthly) }}</b><small>원/월</small></template>
                  <template v-else>—</template>
                </div>
                <button class="gd-trim-grade__btn" @click.stop="goContact">상담</button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="gd-empty-inline">트림 정보를 불러오는 중입니다.</div>
      </div>
    </section>

    <!-- 누구에게 어울리나 (페르소나) -->
    <section class="gd-section gd-section--soft" v-if="personas.length">
      <div class="gd-container">
        <h2 class="gd-section__title">
          <i class="ph ph-user-circle"></i> 누구에게 잘 어울릴까요?
        </h2>
        <p class="gd-section__sub">{{ meta.model }}을 가장 만족스럽게 타시는 분들의 공통점입니다.</p>

        <div class="gd-persona-grid">
          <div v-for="(p, i) in personas" :key="i" class="gd-persona">
            <i :class="`ph ${p.icon || 'ph-user'} gd-persona__icon`"></i>
            <div class="gd-persona__title">{{ p.title }}</div>
            <p class="gd-persona__desc">{{ p.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 차종 썰 / 디자인 평가 -->
    <section class="gd-section" v-if="meta.story?.review">
      <div class="gd-container gd-container--narrow">
        <h2 class="gd-section__title">
          <i class="ph ph-book-open"></i> 이 차의 이야기
        </h2>
        <div class="gd-story">
          <div v-for="(block, i) in meta.story.review" :key="i" class="gd-story__block">
            <h3 v-if="block.heading" class="gd-story__heading">{{ block.heading }}</h3>
            <p class="gd-story__p">{{ block.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 연비 · 세금 · 보험료 -->
    <section class="gd-section gd-section--soft" v-if="meta.story?.specs">
      <div class="gd-container">
        <h2 class="gd-section__title">
          <i class="ph ph-gauge"></i> 연비 · 세금 · 보험료
        </h2>
        <p class="gd-section__sub">대표 트림 기준 평균값. 실제는 옵션과 운전 조건에 따라 달라집니다.</p>

        <div class="gd-specs">
          <div v-for="(s, i) in meta.story.specs" :key="i" class="gd-spec">
            <div class="gd-spec__icon"><i :class="`ph ${s.icon || 'ph-info'}`"></i></div>
            <div class="gd-spec__body">
              <div class="gd-spec__label">{{ s.label }}</div>
              <div class="gd-spec__value">{{ s.value }}</div>
              <div v-if="s.note" class="gd-spec__note">{{ s.note }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 유튜브 리뷰 -->
    <section class="gd-section" v-if="meta.youtube?.length">
      <div class="gd-container">
        <h2 class="gd-section__title">
          <i class="ph ph-youtube-logo"></i> 유튜브 리뷰
        </h2>
        <p class="gd-section__sub">신뢰할 만한 채널에서 다룬 {{ meta.model }} 리뷰를 모았습니다.</p>

        <div class="gd-youtube-grid">
          <a v-for="(yt, i) in meta.youtube" :key="i"
             class="gd-youtube" target="_blank" rel="noopener"
             :href="`https://www.youtube.com/watch?v=${yt.id}`">
            <div class="gd-youtube__thumb">
              <img :src="`https://i.ytimg.com/vi/${yt.id}/mqdefault.jpg`" :alt="yt.title" />
              <div class="gd-youtube__play"><i class="ph-fill ph-play-circle"></i></div>
            </div>
            <div class="gd-youtube__body">
              <div class="gd-youtube__channel">{{ yt.channel }}</div>
              <div class="gd-youtube__title">{{ yt.title }}</div>
            </div>
          </a>
        </div>
      </div>
    </section>

    <!-- 경쟁 차종 -->
    <section class="gd-section gd-section--soft" v-if="competitors.length">
      <div class="gd-container">
        <h2 class="gd-section__title">
          <i class="ph ph-arrows-left-right"></i> 비교해볼 차종
        </h2>
        <p class="gd-section__sub">같은 카테고리({{ meta.tagline }})의 다른 선택지도 둘러보세요.</p>

        <div class="gd-comp-grid">
          <a v-for="c in competitors" :key="c.slug"
             :href="`/guide.html?slug=${c.slug}`"
             class="gd-comp">
            <div class="gd-comp__visual">
              <img :src="c.image" :alt="c.model" @error="(e) => { e.target.style.display = 'none' }" />
            </div>
            <div class="gd-comp__brand">{{ c.brand }}</div>
            <div class="gd-comp__model">{{ c.model }}</div>
            <div class="gd-comp__arrow"><i class="ph ph-arrow-right"></i></div>
          </a>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="gd-section">
      <div class="gd-container gd-container--narrow">
        <h2 class="gd-section__title">
          <i class="ph ph-question"></i> 자주 묻는 질문
        </h2>
        <details v-for="(f, i) in faqs" :key="i" class="gd-faq">
          <summary class="gd-faq__q">
            <span>{{ f.q }}</span>
            <i class="ph ph-caret-down gd-faq__caret"></i>
          </summary>
          <p class="gd-faq__a">{{ f.a }}</p>
        </details>
      </div>
    </section>

    <!-- 상담 CTA -->
    <section class="gd-section gd-section--cta">
      <div class="gd-container">
        <div class="gd-cta">
          <h3 class="gd-cta__title">{{ meta.model }} 출고 견적, 받아보시겠어요?</h3>
          <p class="gd-cta__sub">월 {{ fmt(minMonthly) }}원부터. 5분 만에 맞춤 견적 확인.</p>
          <button class="gd-btn gd-btn--primary gd-btn--lg" @click="goContact">
            <i class="ph ph-chat-circle-dots"></i> 무료 상담 신청
          </button>
        </div>
      </div>
    </section>
  </template>
</template>

<style scoped>
.gd-container { max-width: 1180px; margin: 0 auto; padding: 0 20px; }
.gd-container--narrow { max-width: 760px; }

/* === Empty === */
.gd-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 100px 20px; text-align: center;
}
.gd-empty i { font-size: 56px; color: var(--ink-4); }
.gd-empty h2 { margin: 14px 0 6px; font-size: 18px; }
.gd-empty p { color: var(--ink-3); }
.gd-empty a { color: var(--brand); font-weight: 600; }
.gd-empty-inline {
  text-align: center; padding: 40px 20px;
  color: var(--ink-4); font-size: 13px;
}

/* === HERO === */
.gd-hero {
  background: linear-gradient(180deg, var(--bg-soft) 0%, #fff 100%);
  padding: 32px 0 48px;
}
.gd-hero__inner {
  display: grid; grid-template-columns: 1fr 1fr; gap: 32px;
  align-items: center;
}
@media (max-width: 900px) {
  .gd-hero__inner { grid-template-columns: 1fr; }
}

.gd-hero__crumbs {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: var(--ink-4);
  margin-bottom: 16px;
}
.gd-hero__crumbs a { color: var(--ink-3); font-weight: 600; }
.gd-hero__crumbs a:hover { color: var(--brand); }
.gd-hero__crumbs i { font-size: 10px; }

.gd-hero__tagline {
  display: inline-block;
  padding: 4px 10px;
  background: var(--brand);
  color: #fff;
  border-radius: 999px;
  font-size: 11px; font-weight: 800;
  letter-spacing: 0.3px;
  margin-bottom: 12px;
}
.gd-hero__title {
  margin: 0 0 12px;
  font-size: 38px; font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.15;
  color: var(--ink-1);
}
.gd-hero__title em {
  font-style: normal;
  color: var(--brand);
}
@media (max-width: 600px) { .gd-hero__title { font-size: 28px; } }

.gd-hero__hook {
  font-size: 14.5px; line-height: 1.7; color: var(--ink-3);
  margin: 0 0 24px;
  letter-spacing: -0.01em;
  max-width: 500px;
}

.gd-hero__stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  margin-bottom: 24px;
  padding: 16px 18px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.gd-hero__stat-label {
  font-size: 11px; color: var(--ink-4); font-weight: 600;
  margin-bottom: 4px;
}
.gd-hero__stat-value {
  font-family: 'Inter', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 14px; color: var(--ink-3);
}
.gd-hero__stat-value b {
  font-size: 19px; color: var(--ink-1); font-weight: 800;
  letter-spacing: -0.03em;
}
.gd-hero__stat-value small {
  font-size: 11px; color: var(--ink-4);
  margin-left: 1px;
}

.gd-hero__cta { display: flex; gap: 8px; flex-wrap: wrap; }

.gd-hero__image {
  width: 100%; aspect-ratio: 16/10;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.gd-hero__img {
  width: 100%; height: 100%; object-fit: contain;
  filter: drop-shadow(0 12px 22px rgba(0,0,0,0.14));
}

/* === Buttons === */
.gd-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 44px; padding: 0 22px;
  border: 0; border-radius: 999px;
  font-family: inherit;
  font-size: 13.5px; font-weight: 700;
  cursor: pointer; text-decoration: none;
  letter-spacing: -0.01em;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast), transform var(--t-fast);
}
.gd-btn i { font-size: 15px; }
.gd-btn:hover { transform: translateY(-1px); }
.gd-btn--primary { background: var(--brand); color: #fff; }
.gd-btn--primary:hover { background: var(--brand-700); }
.gd-btn--outline { background: var(--bg); color: var(--ink-2); border: 1.5px solid var(--line-2); }
.gd-btn--outline:hover { border-color: var(--ink-1); color: var(--ink-1); }
.gd-btn--lg { height: 52px; padding: 0 28px; font-size: 15px; }

/* === Sections === */
.gd-section { padding: 48px 0; }
.gd-section--soft { background: var(--bg-soft); }
.gd-section__title {
  display: flex; align-items: center; gap: 8px;
  margin: 0 0 4px;
  font-size: 22px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.025em;
}
.gd-section__title i { font-size: 22px; color: var(--brand); }
.gd-section__sub {
  margin: 0 0 22px;
  font-size: 13px; color: var(--ink-3);
  line-height: 1.6;
}

/* === 트림 표 === */
.gd-trim-table {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}
.gd-trim-table__head, .gd-trim-row {
  display: grid;
  grid-template-columns: 1fr 140px 160px 80px;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
}
.gd-trim-table__head {
  font-size: 11px; font-weight: 700; color: var(--ink-4);
  background: var(--bg-soft);
  border-bottom: 1px solid var(--line);
  letter-spacing: 0.3px;
}
.gd-trim-row {
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.gd-trim-row:last-child { border-bottom: 0; }
.gd-trim-row.is-cheapest { background: var(--brand-50); }
.gd-trim-row__name { display: flex; align-items: center; gap: 6px; color: var(--ink-1); font-weight: 600; }
.gd-trim-row__badge {
  background: var(--brand); color: #fff;
  padding: 2px 7px; border-radius: 999px;
  font-size: 9.5px; font-weight: 800; letter-spacing: 0.3px;
}
.gd-trim-row__hev {
  background: #1a7a3a; color: #fff;
  padding: 2px 7px; border-radius: 999px;
  font-size: 9.5px; font-weight: 800;
}
.gd-trim-row__price {
  font-variant-numeric: tabular-nums;
  color: var(--ink-2); font-weight: 600;
}
.gd-trim-row__price small { font-size: 11px; color: var(--ink-4); margin-left: 1px; }
.gd-trim-row__monthly {
  font-variant-numeric: tabular-nums;
  font-size: 13px; color: var(--ink-3);
}
.gd-trim-row__monthly b {
  font-size: 16px; color: var(--ink-1); font-weight: 800;
  letter-spacing: -0.02em;
}
.gd-trim-row__monthly small { font-size: 11px; color: var(--ink-4); margin-left: 1px; }
.gd-trim-row__btn {
  height: 32px; padding: 0 14px;
  border: 1.5px solid var(--ink-1);
  background: var(--ink-1); color: #fff;
  border-radius: 999px;
  font-family: inherit; font-size: 11.5px; font-weight: 700;
  cursor: pointer;
  transition: background var(--t-fast);
}
.gd-trim-row__btn:hover { background: var(--brand); border-color: var(--brand); }
@media (max-width: 700px) {
  .gd-trim-table__head { display: none; }
  .gd-trim-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 14px 16px;
  }
  .gd-trim-row__price::before { content: '차량가: '; font-size: 11px; color: var(--ink-4); }
  .gd-trim-row__monthly::before { content: '월 대여료: '; font-size: 11px; color: var(--ink-4); }
}

/* === 세부모델 accordion === */
.gd-trim-groups {
  display: flex; flex-direction: column; gap: 8px;
}
.gd-trim-group {
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color var(--t-fast);
}
.gd-trim-group:hover { border-color: var(--line-2); }
.gd-trim-group.is-cheapest { border-color: var(--brand); background: var(--brand-50); }
.gd-trim-group.is-open { border-color: var(--ink-1); }

.gd-trim-group__head {
  width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  background: transparent;
  border: 0;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}
.gd-trim-group__head-left {
  display: flex; align-items: center; gap: 7px;
  flex: 1; min-width: 0;
}
.gd-trim-group__head-right {
  display: flex; align-items: center; gap: 12px;
}
.gd-trim-group__name {
  font-size: 14.5px; font-weight: 700; color: var(--ink-1);
  letter-spacing: -0.02em;
}
.gd-trim-group__count {
  font-size: 11px; font-weight: 600; color: var(--ink-4);
  background: var(--bg-soft);
  padding: 2px 8px; border-radius: 999px;
}
.gd-trim-group__monthly {
  font-size: 13px; color: var(--ink-3);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.gd-trim-group__monthly b {
  font-size: 17px; color: var(--ink-1); font-weight: 800;
  letter-spacing: -0.02em;
}
.gd-trim-group__caret {
  font-size: 14px; color: var(--ink-3);
  transition: transform var(--t-fast);
}
.gd-trim-group.is-open .gd-trim-group__caret { transform: rotate(180deg); }

.gd-trim-group__body {
  border-top: 1px solid var(--line);
  background: var(--bg);
}
.gd-trim-group.is-cheapest .gd-trim-group__body { background: var(--bg); }

.gd-trim-grade {
  display: grid;
  grid-template-columns: 1fr 130px 150px 78px;
  gap: 12px;
  align-items: center;
  padding: 11px 18px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.gd-trim-grade:last-child { border-bottom: 0; }
.gd-trim-grade__name {
  color: var(--ink-2); font-weight: 600;
  letter-spacing: -0.01em;
}
.gd-trim-grade__price {
  color: var(--ink-2); font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.gd-trim-grade__price small { font-size: 11px; color: var(--ink-4); margin-left: 1px; }
.gd-trim-grade__monthly {
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.gd-trim-grade__monthly b {
  font-size: 14.5px; color: var(--ink-1); font-weight: 800;
  letter-spacing: -0.02em;
}
.gd-trim-grade__monthly small { font-size: 11px; color: var(--ink-4); margin-left: 1px; }
.gd-trim-grade__btn {
  height: 30px; padding: 0 12px;
  background: var(--ink-1); color: #fff;
  border: 0; border-radius: 999px;
  font-family: inherit; font-size: 11.5px; font-weight: 700;
  cursor: pointer;
  transition: background var(--t-fast);
}
.gd-trim-grade__btn:hover { background: var(--brand); }

@media (max-width: 700px) {
  .gd-trim-group__head { padding: 14px 16px; }
  .gd-trim-group__head-right { gap: 8px; }
  .gd-trim-group__monthly { font-size: 11.5px; }
  .gd-trim-group__monthly b { font-size: 15px; }
  .gd-trim-grade {
    grid-template-columns: 1fr 80px;
    gap: 8px;
    padding: 12px 16px;
    row-gap: 4px;
  }
  .gd-trim-grade__price { display: none; }
  .gd-trim-grade__monthly { grid-column: 1; }
  .gd-trim-grade__btn { grid-row: 1 / span 2; grid-column: 2; align-self: center; }
}

/* === 페르소나 === */
.gd-persona-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
}
@media (max-width: 720px) { .gd-persona-grid { grid-template-columns: 1fr; } }
.gd-persona {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px;
}
.gd-persona__icon {
  font-size: 28px; color: var(--brand);
  margin-bottom: 8px;
}
.gd-persona__title {
  font-size: 14.5px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}
.gd-persona__desc {
  margin: 0;
  font-size: 13px; color: var(--ink-3); line-height: 1.65;
}

/* === Story === */
.gd-story { display: flex; flex-direction: column; gap: 24px; }
.gd-story__heading {
  margin: 0 0 8px;
  font-size: 16px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.02em;
}
.gd-story__p {
  margin: 0;
  font-size: 14.5px; color: var(--ink-2); line-height: 1.8;
  letter-spacing: -0.01em;
}

/* === Specs === */
.gd-specs {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}
@media (max-width: 900px) { .gd-specs { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .gd-specs { grid-template-columns: 1fr; } }
.gd-spec {
  display: flex; gap: 12px;
  padding: 16px 18px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.gd-spec__icon {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: var(--brand-50);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.gd-spec__icon i { font-size: 18px; color: var(--brand); }
.gd-spec__label {
  font-size: 11px; color: var(--ink-4); font-weight: 600;
  margin-bottom: 2px;
}
.gd-spec__value {
  font-size: 16px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.gd-spec__note {
  margin-top: 3px;
  font-size: 10.5px; color: var(--ink-4);
}

/* === YouTube === */
.gd-youtube-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
}
@media (max-width: 720px) { .gd-youtube-grid { grid-template-columns: 1fr; } }
.gd-youtube {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  transition: transform var(--t-fast), border-color var(--t-fast);
}
.gd-youtube:hover { border-color: var(--ink-2); transform: translateY(-2px); }
.gd-youtube__thumb {
  position: relative; aspect-ratio: 16/9;
  background: var(--bg-soft-2);
  overflow: hidden;
}
.gd-youtube__thumb img { width: 100%; height: 100%; object-fit: cover; }
.gd-youtube__play {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 44px; color: #fff;
  opacity: 0.85;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
}
.gd-youtube__body { padding: 12px 14px; }
.gd-youtube__channel {
  font-size: 10.5px; color: var(--ink-4); font-weight: 700;
  letter-spacing: 0.2px;
  margin-bottom: 2px;
}
.gd-youtube__title {
  font-size: 13px; font-weight: 700; color: var(--ink-1);
  line-height: 1.4; letter-spacing: -0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* === Competitors === */
.gd-comp-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}
@media (max-width: 720px) { .gd-comp-grid { grid-template-columns: repeat(2, 1fr); } }
.gd-comp {
  position: relative;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px;
  transition: border-color var(--t-fast), transform var(--t-fast);
}
.gd-comp:hover { border-color: var(--ink-1); transform: translateY(-2px); }
.gd-comp__visual {
  aspect-ratio: 16/9;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
}
.gd-comp__visual img {
  width: 96%; height: 96%; object-fit: contain;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.08));
}
.gd-comp__brand {
  font-size: 10px; color: var(--ink-4); font-weight: 700;
  letter-spacing: 0.3px;
}
.gd-comp__model {
  margin-top: 2px;
  font-size: 13.5px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.02em;
}
.gd-comp__arrow {
  position: absolute; top: 14px; right: 14px;
  font-size: 13px; color: var(--ink-3);
  opacity: 0; transition: opacity var(--t-fast);
}
.gd-comp:hover .gd-comp__arrow { opacity: 1; }

/* === FAQ === */
.gd-faq {
  border-bottom: 1px solid var(--line);
}
.gd-faq:last-child { border-bottom: 0; }
.gd-faq__q {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 0;
  font-size: 14.5px; font-weight: 700; color: var(--ink-1);
  cursor: pointer;
  list-style: none;
  letter-spacing: -0.01em;
}
.gd-faq__q::-webkit-details-marker { display: none; }
.gd-faq__caret { font-size: 14px; color: var(--ink-3); transition: transform var(--t-fast); }
.gd-faq[open] .gd-faq__caret { transform: rotate(180deg); }
.gd-faq__a {
  margin: 0 0 16px;
  font-size: 13.5px; color: var(--ink-3); line-height: 1.75;
  letter-spacing: -0.01em;
}

/* === CTA === */
.gd-section--cta { padding: 56px 0; }
.gd-cta {
  text-align: center;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-700) 100%);
  border-radius: 18px;
  padding: 36px 28px;
  color: #fff;
}
.gd-cta__title {
  margin: 0 0 6px;
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.025em;
}
.gd-cta__sub {
  margin: 0 0 18px;
  font-size: 13px; opacity: 0.9;
}
.gd-section--cta .gd-btn--primary {
  background: var(--ink-1); color: #fff;
}
.gd-section--cta .gd-btn--primary:hover { background: #fff; color: var(--brand); }
</style>
