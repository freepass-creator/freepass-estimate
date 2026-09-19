<script setup>
// AI 추천 — 5가지 입력 (나이/성별/라이프스타일/용도/소득)
// 다요소 가중합 점수 → top 1 hero + 2 alt
// 개인화 narrative + 매치 %
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { DELIVERY_REGIONS, TINT_PRICES } from '../../data/lookups.js';
import { fmt } from '../../lib/format.js';
import { MODEL_SLUG } from '../../lib/slug.js';

const DEFAULT_DELIVERY_FEE = (DELIVERY_REGIONS['광역시']?.['서울']) || 0;
const DEFAULT_TINT_FEE = (() => {
  const m = TINT_PRICES['루마 GG'];
  if (!m) return 0;
  return (m['front'] || 0) + (m['side_rear_with_coupon'] || 0);
})();

// === 입력 옵션 ===
const AGES = [
  { id: '20s', label: '20대', sub: '취향·디자인' },
  { id: '30s', label: '30대', sub: '가성비·실용' },
  { id: '40s', label: '40대', sub: '가족·여유' },
  { id: '50plus', label: '50대+', sub: '품격·안락' },
];
const GENDERS = [
  { id: 'm', label: '남' },
  { id: 'f', label: '여' },
];
const LIFESTYLES = [
  { id: 'single', label: '혼자', sub: '1인', size: 1 },
  { id: 'couple', label: '연애 중', sub: '2인', size: 2 },
  { id: 'family', label: '가족', sub: '3~4인', size: 4 },
  { id: 'large', label: '대가족', sub: '5인+', size: 6 },
];
const USAGES = [
  { id: 'commute', label: '출퇴근', sub: '데일리' },
  { id: 'leisure', label: '가족·여행', sub: '주말' },
  { id: 'business', label: '비즈니스', sub: '의전·영업' },
  { id: 'hobby', label: '여가', sub: '취미·아웃도어' },
];
// === 차종 카탈로그 (스코어링용 메타) ===
// body: compact / sedan / suv-mid / suv-large / minivan / luxury
// size: S/M/L/XL  /  age: 적합 연령대 set
// usage: 적합 용도 set  /  mileage: 적합 주행거리 ('any'/'low'/'mid'/'high')
const MODEL_META = {
  '더 뉴 캐스퍼':         { body: 'compact', size: 'S', age: ['20s','30s'],          usage: ['commute','hobby'],            mileage: 'low',  image: '/cars/casper.png',
    story: '경형 SUV 시장의 표준. 1.0 터보 + 4단 자동변속기 조합으로 연비·가속 균형. 비좁아 보여도 트렁크 + 풀폴딩 시트로 실내 활용도 의외로 좋습니다. 1인·2인 가구의 첫 차로 가장 많이 선택되는 모델.', },
  '아반떼':              { body: 'sedan',   size: 'M', age: ['20s','30s'],          usage: ['commute','hobby'],            mileage: 'any', image: '/cars/avante.jpg' },
  '아반떼 Hybrid':       { body: 'sedan',   size: 'M', age: ['20s','30s','40s'],    usage: ['commute'],                    mileage: 'high', image: '/cars/avante.jpg' },
  '쏘나타 디 엣지':      { body: 'sedan',   size: 'L', age: ['30s','40s'],          usage: ['commute','business','leisure'], mileage: 'any', image: '/cars/sonata.png' },
  '쏘나타 디 엣지 Hybrid': { body: 'sedan', size: 'L', age: ['30s','40s'],          usage: ['commute','business'],         mileage: 'high', image: '/cars/sonata.png' },
  '더 뉴 그랜저':        { body: 'sedan',   size: 'XL', age: ['40s','50plus'],      usage: ['business','leisure'],         mileage: 'any', image: '/cars/grandeur.png',
    story: '국산 플래그십 세단의 표준. 7세대 GN7 그랜저는 1세대를 오마주한 디자인 + 최신 인포테인먼트의 결합. 비즈니스·가족 어느 쪽에도 무난하게 어울리는 정중함이 강점. 임원 의전·40·50대 가족 차로 가장 익숙한 선택.', },
  '더 뉴 그랜저 Hybrid': { body: 'sedan',   size: 'XL', age: ['40s','50plus'],      usage: ['business'],                   mileage: 'high', image: '/cars/grandeur.png' },
  '베뉴':                { body: 'compact', size: 'S', age: ['20s','30s'],          usage: ['commute','hobby'],            mileage: 'any', image: '/cars/venue.jpg' },
  '코나':                { body: 'suv-mid', size: 'M', age: ['20s','30s'],          usage: ['commute','leisure','hobby'],  mileage: 'any', image: '/cars/kona.png' },
  '코나 Hybrid':         { body: 'suv-mid', size: 'M', age: ['20s','30s','40s'],    usage: ['commute','leisure'],          mileage: 'high', image: '/cars/kona.png' },
  '투싼':                { body: 'suv-mid', size: 'M', age: ['30s','40s'],          usage: ['commute','leisure','family'], mileage: 'any' },
  '투싼 Hybrid':         { body: 'suv-mid', size: 'M', age: ['30s','40s'],          usage: ['commute','leisure'],          mileage: 'high' },
  '싼타페':              { body: 'suv-large', size: 'L', age: ['30s','40s'],        usage: ['leisure','family'],           mileage: 'any' },
  '싼타페 Hybrid':       { body: 'suv-large', size: 'L', age: ['30s','40s'],        usage: ['leisure','family'],           mileage: 'high' },
  '디 올 뉴 팰리세이드':  { body: 'suv-large', size: 'XL', age: ['30s','40s','50plus'], usage: ['leisure','family','business'], mileage: 'any', image: '/cars/palisade.jpg',
    story: '2025년 1월 풀체인지급 페이스리프트(LX3 세대). 7·9인승 풀사이즈 SUV의 정점. 12.3" 듀얼 디스플레이 + 어드밴스드 안전 패키지 기본. 통풍·열선 시트, 스마트 파워테일게이트 — 가족 차로서 빠진 옵션이 없습니다.', },
  '디 올 뉴 팰리세이드 Hybrid': { body: 'suv-large', size: 'XL', age: ['30s','40s','50plus'], usage: ['leisure','family'], mileage: 'high', image: '/cars/palisade.jpg' },
  '포터2':               { body: 'truck',   size: 'L', age: ['30s','40s','50plus'], usage: ['business'],                   mileage: 'high' },
  // 기아
  '모닝':                { body: 'compact', size: 'S', age: ['20s'],                usage: ['commute'],                    mileage: 'any', image: '/cars/morning.png' },
  '레이':                { body: 'compact', size: 'S', age: ['20s','30s'],          usage: ['commute','hobby'],            mileage: 'any', image: '/cars/ray.png' },
  'K3':                  { body: 'sedan',   size: 'M', age: ['20s','30s'],          usage: ['commute'],                    mileage: 'any' },
  'K5':                  { body: 'sedan',   size: 'L', age: ['20s','30s','40s'],    usage: ['commute','leisure'],          mileage: 'any', image: '/cars/k5.png' },
  'K8':                  { body: 'sedan',   size: 'XL', age: ['40s','50plus'],      usage: ['business'],                   mileage: 'any', image: '/cars/k8.png' },
  '셀토스':              { body: 'suv-mid', size: 'M', age: ['20s','30s'],          usage: ['commute','leisure','hobby'],  mileage: 'any', image: '/cars/seltos.png' },
  '스포티지':            { body: 'suv-mid', size: 'M', age: ['30s','40s'],          usage: ['commute','leisure','family'], mileage: 'any', image: '/cars/sportage.png' },
  '쏘렌토':              { body: 'suv-large', size: 'L', age: ['30s','40s'],        usage: ['leisure','family'],           mileage: 'any', image: '/cars/sorento.png' },
  '카니발':              { body: 'minivan', size: 'XL', age: ['30s','40s','50plus'], usage: ['leisure','family','business'], mileage: 'any', image: '/cars/carnival.png',
    story: '국내 미니밴 부동의 1위. 4세대 KA4는 SUV 같은 디자인 + 9인승 실내 공간을 둘 다 잡았습니다. 양쪽 슬라이딩 도어 + 2열 통풍·열선 시트 + 하이리무진 옵션까지. 가족·임원·영업 등 활용 범위가 가장 넓은 차종.', },
  // 제네시스
  'G70':                 { body: 'luxury',  size: 'L', age: ['30s','40s'],          usage: ['business','hobby'],           mileage: 'any', image: '/cars/g70.png' },
  'G80':                 { body: 'luxury',  size: 'XL', age: ['40s','50plus'],      usage: ['business'],                   mileage: 'any', image: '/cars/g80.png',
    story: '제네시스의 정통 럭셔리 세단 RG3 세대. 라디에이터 그릴부터 인테리어까지 완전히 새로 만든 풀체인지. 다이내믹 주행감과 정중한 디자인을 동시에. 임원 의전·비즈니스 미팅에서 가장 많이 보이는 선택.', },
  'G90':                 { body: 'luxury',  size: 'XL', age: ['50plus'],            usage: ['business'],                   mileage: 'low', image: '/cars/g90.png' },
  'GV70':                { body: 'suv-mid', size: 'L', age: ['30s','40s'],          usage: ['leisure','business'],         mileage: 'any', image: '/cars/gv70.png' },
  'GV80':                { body: 'suv-large', size: 'XL', age: ['40s','50plus'],    usage: ['business','family'],          mileage: 'any', image: '/cars/gv80.png' },
};

// 라이프스타일 → 적합 body 우선순위
const LIFESTYLE_BODY_FIT = {
  single: { compact: 1.0, sedan: 0.85, 'suv-mid': 0.8, 'suv-large': 0.4, minivan: 0.2, luxury: 0.6, truck: 0.3 },
  couple: { compact: 0.7, sedan: 0.95, 'suv-mid': 1.0, 'suv-large': 0.7, minivan: 0.4, luxury: 0.85, truck: 0.2 },
  family: { compact: 0.4, sedan: 0.7, 'suv-mid': 0.9, 'suv-large': 1.0, minivan: 0.95, luxury: 0.7, truck: 0.2 },
  large:  { compact: 0.1, sedan: 0.3, 'suv-mid': 0.4, 'suv-large': 0.9, minivan: 1.0, luxury: 0.4, truck: 0.3 },
};

// 성별 약한 가중치 (취향 차이만 미세 반영)
const GENDER_BIAS = {
  m: { 'luxury': 1.05, 'minivan': 1.03, 'suv-large': 1.03, 'truck': 1.05 },
  f: { 'compact': 1.05, 'suv-mid': 1.03 },
};

// === 입력 state ===
const age = ref('30s');
const gender = ref('m');
const lifestyle = ref('couple');
const usage = ref('commute');
const income = ref(400);
const submitted = ref(false);

const vehicles = ref([]);
onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
});

function calcMonthly(row, depPct) {
  try {
    const r = calcQuote({
      vehicle: row,
      options: { optPrice: 0, discount: 0, deliveryFee: DEFAULT_DELIVERY_FEE, itemsFee: DEFAULT_TINT_FEE, etc: 0 },
      contract: { term: 60, km: '2만km', dep: depPct, pre: 0 },
      customer: { creditGrade: '중신용' },
      insurance: {
        property: '1억', extraDriver: '없음',
        exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
        deductible: '30만원~', emergency: '가입',
      },
      fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
    });
    return r;
  } catch { return null; }
}

const budgetKrw = computed(() => Math.round((+income.value || 0) * 10000 * 0.33));

// 모델 별 최저가 row 한 개씩 추출 → 후보
const candidates = computed(() => {
  if (!vehicles.value.length) return [];
  const byModel = new Map();
  for (const v of vehicles.value) {
    if (!MODEL_META[v.model]) continue;  // 메타 없는 건 제외
    if (!byModel.has(v.model)) byModel.set(v.model, v);
    else if (v.price < byModel.get(v.model).price) byModel.set(v.model, v);
  }
  return Array.from(byModel.values());
});

// === 스코어링 ===
const scored = computed(() => {
  if (!submitted.value || !candidates.value.length) return [];
  const budget = budgetKrw.value;
  const lifestyleBodyMap = LIFESTYLE_BODY_FIT[lifestyle.value] || {};
  const genderBias = GENDER_BIAS[gender.value] || {};

  const arr = candidates.value.map(row => {
    const meta = MODEL_META[row.model];
    const r = calcMonthly(row, 10);
    if (!r) return null;
    const monthly = r.monthly;

    // 예산 적합도 (40% 가중)
    let budgetScore;
    if (monthly <= budget) budgetScore = 1.0;
    else if (monthly <= budget * 1.15) budgetScore = 0.7;
    else if (monthly <= budget * 1.30) budgetScore = 0.4;
    else budgetScore = 0.1;

    // 라이프스타일 매치 (25% 가중)
    const lifestyleScore = lifestyleBodyMap[meta.body] ?? 0.5;

    // 나이대 매치 (15%)
    const ageScore = meta.age.includes(age.value) ? 1.0 : 0.5;

    // 용도 매치 (20%)
    const usageScore = meta.usage.includes(usage.value) ? 1.0 : 0.55;

    // 성별 미세 보정
    const genderBoost = genderBias[meta.body] || 1.0;

    const composite = (
      budgetScore   * 0.40 +
      lifestyleScore * 0.25 +
      ageScore      * 0.15 +
      usageScore    * 0.20
    ) * genderBoost;

    const matchPct = Math.min(99, Math.round(composite * 100));

    return {
      row, meta, monthly, matchPct, composite,
      withinBudget: monthly <= budget,
      depAmt: r.depositAmt,
      residualPct: r.residualPct, residualAmt: r.residualAmt,
      details: {
        budgetScore, lifestyleScore, ageScore, usageScore,
      },
    };
  }).filter(Boolean);

  arr.sort((a, b) => b.composite - a.composite);
  return arr;
});

const topPick = computed(() => scored.value[0] || null);
const podium = computed(() => scored.value.slice(0, 3));

// === 개인화 narrative ===
const personaTagline = computed(() => {
  const ageLabel = AGES.find(a => a.id === age.value)?.label || '';
  const lifestyleLabel = LIFESTYLES.find(l => l.id === lifestyle.value)?.label || '';
  const usageLabel = USAGES.find(u => u.id === usage.value)?.label || '';
  return `${ageLabel} · ${lifestyleLabel} · ${usageLabel} 위주`;
});
const personaSub = computed(() => {
  const inc = +income.value || 0;
  return `월 소득 ${fmt(inc)}만원`;
});

function pickNarrative(p) {
  if (!p) return '';
  const ageLabel = AGES.find(a => a.id === age.value)?.label || '';
  const lifestyleLabel = LIFESTYLES.find(l => l.id === lifestyle.value)?.label || '';
  const usageLabel = USAGES.find(u => u.id === usage.value)?.label || '';
  const meta = p.meta;
  const reasons = [];
  if (p.withinBudget) {
    reasons.push(`월 예산 ${fmt(budgetKrw.value)}원 안에 정확히 들어옵니다.`);
  } else {
    const over = p.monthly - budgetKrw.value;
    reasons.push(`예산보다 약 ${fmt(over)}원 높지만, 옵션 조정으로 맞출 수 있습니다.`);
  }
  if (meta.age.includes(age.value)) {
    reasons.push(`${ageLabel} 고객층에서 가장 많이 선택되는 차종입니다.`);
  }
  if (meta.usage.includes(usage.value)) {
    const usageDesc = {
      commute: '매일의 출퇴근에 부담 없는 사이즈와 연비',
      leisure: '주말 가족 여행에 충분한 적재 공간',
      business: '비즈니스 미팅·의전에 어울리는 정중한 디자인',
      hobby: '취미 활동·아웃도어에 활용도 높은 구성',
    }[usage.value];
    if (usageDesc) reasons.push(`${usageDesc}로 ${usageLabel} 용도에 최적화됐습니다.`);
  }
  return reasons;
}

function pickIcon(p) {
  if (!p) return 'ph-car-profile';
  const map = {
    compact: 'ph-car', sedan: 'ph-car-profile',
    'suv-mid': 'ph-jeep', 'suv-large': 'ph-jeep',
    minivan: 'ph-van', luxury: 'ph-car-profile', truck: 'ph-truck',
  };
  return map[p.meta.body] || 'ph-car-profile';
}

function submit() {
  submitted.value = true;
  // 결과로 자연스럽게 스크롤
  setTimeout(() => {
    document.querySelector('.ai-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}
function reset() { submitted.value = false; }

function goToGuide(p) {
  if (!p) return;
  const slug = MODEL_SLUG[p.row.model];
  if (slug) {
    location.href = `/guide.html?slug=${slug}`;
  } else {
    document.getElementById('lineup')?.scrollIntoView({ behavior: 'smooth' });
  }
}

function goToContact(p) {
  if (!p) return;
  const params = new URLSearchParams({
    vehicle: `${p.row.brand} ${p.row.model}`,
    term: 60,
    monthly: p.monthly || '',
  });
  history.replaceState(null, '', '#contact?' + params.toString());
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <div class="ai">
    <div class="ai-wrap">
      <div class="ai-form">
        <div class="ai-form__head">
          <div class="ai-form__eyebrow">
            <i class="ph ph-sparkle"></i> AI 차종 추천
          </div>
          <h2 class="ai-form__headline">
            나에게 딱 맞는 차,<br>
            <em>30초</em>면 찾습니다.
          </h2>
          <div class="ai-form__hint">
            <b>5가지</b>만 알려주시면, AI가 신차 <b>3대</b>를 골라드려요.<br>
            <span class="ai-form__hint-sub">월 부담·라이프스타일·연식까지 한 번에 비교</span>
          </div>
        </div>
      <div class="ai-field">
          <label class="ai-label">나이대</label>
          <div class="ai-chips">
            <button v-for="a in AGES" :key="a.id"
                    class="ai-chip"
                    :class="{ 'is-active': age === a.id }"
                    @click="age = a.id; submitted = false">
              <span>{{ a.label }}</span>
              <small>{{ a.sub }}</small>
            </button>
          </div>
        </div>

        <div class="ai-row">
          <div class="ai-field">
            <label class="ai-label">성별</label>
            <div class="ai-chips ai-chips--2">
              <button v-for="g in GENDERS" :key="g.id"
                      class="ai-chip"
                      :class="{ 'is-active': gender === g.id }"
                      @click="gender = g.id; submitted = false">
                {{ g.label }}
              </button>
            </div>
          </div>
          <div class="ai-field">
            <label class="ai-label">라이프스타일</label>
            <div class="ai-chips ai-chips--4">
              <button v-for="l in LIFESTYLES" :key="l.id"
                      class="ai-chip ai-chip--sm"
                      :class="{ 'is-active': lifestyle === l.id }"
                      @click="lifestyle = l.id; submitted = false">
                <span>{{ l.label }}</span>
                <small>{{ l.sub }}</small>
              </button>
            </div>
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label">주된 용도</label>
          <div class="ai-chips">
            <button v-for="u in USAGES" :key="u.id"
                    class="ai-chip"
                    :class="{ 'is-active': usage === u.id }"
                    @click="usage = u.id; submitted = false">
              <span>{{ u.label }}</span>
              <small>{{ u.sub }}</small>
            </button>
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label">월 소득 <small class="ai-hint">(세후 만원 단위)</small></label>
          <div class="ai-income">
            <input
              type="number" min="100" max="3000" step="50"
              v-model.number="income"
              @input="submitted = false"
              class="ai-income__input"
              placeholder="400"
            />
            <span class="ai-income__unit">만원</span>
          </div>
          <div class="ai-budget" v-if="income">
            <i class="ph ph-info"></i>
            월 부담 추천 한도 <b>{{ fmt(budgetKrw) }}원</b> (월소득의 33%)
          </div>
        </div>

        <button class="ai-submit" @click="submit">
          <i class="ph ph-sparkle"></i> AI 추천 받기
        </button>
      </div>

      <!-- 결과: 폼 우측에 같이 (2분할) -->
      <div class="ai-result-col">
        <div class="ai-result">
        <div v-if="!submitted" class="ai-result__empty">
          <div class="ai-result__empty-art">
            <i class="ph ph-sparkle ai-result__empty-sparkle ai-result__empty-sparkle--1"></i>
            <i class="ph ph-car-profile ai-result__empty-car"></i>
            <i class="ph ph-sparkle ai-result__empty-sparkle ai-result__empty-sparkle--2"></i>
            <i class="ph ph-sparkle ai-result__empty-sparkle ai-result__empty-sparkle--3"></i>
          </div>
          <h4>당신에게 어울리는 신차 <em>3대</em></h4>
          <p>왼쪽에서 5가지를 알려주시면<br>AI가 매칭률 높은 순으로 골라드려요.</p>

          <div class="ai-result__empty-steps">
            <div class="ai-result__empty-step"><b>1</b> 나이·성별</div>
            <div class="ai-result__empty-step"><b>2</b> 라이프스타일</div>
            <div class="ai-result__empty-step"><b>3</b> 주된 용도</div>
            <div class="ai-result__empty-step"><b>4</b> 월 소득</div>
            <div class="ai-result__empty-step ai-result__empty-step--last">
              <b><i class="ph ph-sparkle"></i></b> AI 추천 받기
            </div>
          </div>
        </div>

        <div v-else-if="!topPick" class="ai-result__empty">
          <i class="ph ph-warning-circle"></i>
          <h4>적합한 차종이 부족합니다</h4>
          <p>예산을 조정하거나 다른 조건을 시도해 보세요.</p>
        </div>

        <template v-else>
          <!-- 페르소나 요약 -->
          <div class="ai-persona">
            <i class="ph ph-user-circle"></i>
            <div>
              <div class="ai-persona__main">{{ personaTagline }}</div>
              <div class="ai-persona__sub">{{ personaSub }}</div>
            </div>
          </div>

          <!-- AI 추천 3종 — 1번만 BEST 강조, 2-3번 평등 -->
          <div class="ai-podium">
            <article v-for="(p, i) in podium" :key="i"
                     class="ai-card"
                     :class="{ 'ai-card--top': i === 0 }">
              <div class="ai-card__rank">
                <span v-if="i === 0" class="ai-card__badge">
                  <i class="ph ph-star"></i> BEST
                </span>
                <span v-else class="ai-card__badge ai-card__badge--alt">
                  <i class="ph ph-thumbs-up"></i> 추천
                </span>
                <span class="ai-card__match">매치 {{ p.matchPct }}%</span>
              </div>
              <div class="ai-card__visual">
                <img v-if="p.meta.image"
                     :src="p.meta.image"
                     :alt="p.row.model"
                     class="ai-card__img"
                     @error="p.meta.image = null" />
                <i v-else :class="`ph ${pickIcon(p)} ai-card__icon`"></i>
              </div>
              <div class="ai-card__body">
                <div class="ai-card__brand">{{ p.row.brand }}</div>
                <h3 class="ai-card__model">{{ p.row.model }}</h3>
                <div class="ai-card__trim">{{ p.row.trim }}</div>

                <ul class="ai-card__reasons">
                  <li v-for="(rsn, j) in pickNarrative(p).slice(0, i === 0 ? 4 : 2)" :key="j">
                    <i class="ph ph-check-circle-fill"></i>
                    {{ rsn }}
                  </li>
                </ul>

                <!-- 1순위만 스토리 노출 -->
                <div v-if="i === 0 && p.meta.story" class="ai-card__story">
                  <div class="ai-card__story-label">
                    <i class="ph ph-book-open"></i> 이 차의 이야기
                  </div>
                  <p>{{ p.meta.story }}</p>
                </div>

                <div class="ai-card__price">
                  <div class="ai-card__monthly">
                    <span class="ai-card__monthly-num">{{ fmt(p.monthly) }}</span>
                    <small>원/월</small>
                  </div>
                  <div class="ai-card__sub">
                    60개월 · 보증금 10% · 월 부담 {{ ((p.monthly / (income * 10000)) * 100).toFixed(0) }}%
                  </div>
                </div>

                <div class="ai-card__ctas">
                  <button class="ai-card__cta ai-card__cta--outline" @click="goToGuide(p)">
                    <i class="ph ph-book-open"></i> 상세보기
                  </button>
                  <button class="ai-card__cta ai-card__cta--primary" @click="goToContact(p)">
                    <i class="ph ph-chat-circle-dots"></i> 상담 신청
                  </button>
                </div>
              </div>
            </article>
          </div>

          <button class="ai-result__again" @click="reset">
            <i class="ph ph-arrow-counter-clockwise"></i> 다시 추천 받기
          </button>
        </template>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.ai { width: 100%; }

.ai-wrap {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 18px;
  background: var(--bg);
  border-radius: 20px;
  padding: 22px;
  box-shadow:
    0 20px 50px rgba(0,0,0,0.07),
    0 4px 12px rgba(0,0,0,0.05);
  border: 1px solid var(--line);
}
@media (max-width: 980px) {
  .ai-wrap { grid-template-columns: 1fr; padding: 18px; gap: 16px; }
}
@media (max-width: 540px) {
  .ai-wrap { padding: 16px; border-radius: 14px; }
}

.ai-form {
  background: var(--bg-soft);
  border-radius: 14px;
  padding: 20px;
}
.ai-result-col {
  display: flex;
  flex-direction: column;
}

/* 결과 — Teleport 된 히어로 아래 섹션 */
.ai-result-out {
  max-width: 980px; margin: 0 auto;
}
.ai-result-out:not(.is-shown) .ai-result__empty {
  padding: 36px 16px;
}
.ai-form__head {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 10px;
}
.ai-form__eyebrow {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--brand); color: #fff;
  padding: 5px 12px; border-radius: 999px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
  align-self: flex-start;
}
.ai-form__eyebrow i { font-size: 12px; }
.ai-form__headline {
  margin: 2px 0 2px;
  font-size: 22px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.03em; line-height: 1.25;
}
.ai-form__headline em {
  font-style: normal; font-weight: 800; color: var(--brand);
}
.ai-form__hint {
  font-size: 12.5px; color: var(--ink-3);
  letter-spacing: -0.01em; line-height: 1.55;
}
.ai-form__hint b { color: var(--ink-1); font-weight: 800; }
.ai-form__hint-sub {
  display: inline-block; margin-top: 2px;
  font-size: 11.5px; color: var(--ink-4);
}
@media (max-width: 540px) {
  .ai-form__headline { font-size: 19px; }
  .ai-form__hint { font-size: 12px; }
}

/* === 폼 === */
.ai-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.ai-row { display: grid; grid-template-columns: 0.7fr 1.5fr; gap: 10px; margin-bottom: 10px; }
.ai-row .ai-field { margin-bottom: 0; }
@media (max-width: 540px) {
  .ai-row { grid-template-columns: 1fr; gap: 16px; }
}

.ai-label {
  font-size: 12px; font-weight: 600; color: var(--ink-2);
  letter-spacing: -0.01em;
}
.ai-hint { font-size: 10.5px; font-weight: 400; color: var(--ink-4); margin-left: 4px; }

.ai-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.ai-chips--2 { grid-template-columns: 1fr 1fr; }
.ai-chips--3 { grid-template-columns: repeat(3, 1fr); }
.ai-chips--4 { grid-template-columns: repeat(4, 1fr); }

.ai-chip {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 4px;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  border-radius: 8px;
  font-family: inherit;
  font-size: 12.5px; font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.01em;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.ai-chip small {
  font-size: 9.5px; color: var(--ink-4); font-weight: 400;
}
.ai-chip:hover { border-color: var(--ink-4); }
.ai-chip.is-active {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}
.ai-chip.is-active small { color: rgba(255,255,255,0.6); }
.ai-chip--sm { padding: 8px 2px; font-size: 11.5px; }
.ai-chip--sm small { font-size: 9px; }

.ai-income {
  display: flex; align-items: center;
  border: 1.5px solid var(--line-2);
  border-radius: 8px;
  transition: border-color var(--t-fast);
}
.ai-income:focus-within { border-color: var(--brand); }
.ai-income__input {
  flex: 1; min-width: 0; height: 40px;
  border: 0; background: transparent;
  padding: 0 14px;
  font-family: inherit; font-size: 16px; font-weight: 600;
  color: var(--ink-1);
  font-variant-numeric: tabular-nums;
  outline: none;
}
.ai-income__input::-webkit-outer-spin-button,
.ai-income__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.ai-income__unit {
  padding-right: 14px;
  font-size: 13px; color: var(--ink-3); font-weight: 500;
}
.ai-budget {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: var(--ink-3);
  background: var(--bg-soft);
  padding: 7px 12px; border-radius: 6px;
  margin-top: 2px;
}
.ai-budget i { font-size: 13px; color: var(--brand); }
.ai-budget b { color: var(--ink-1); font-weight: 700; font-variant-numeric: tabular-nums; }

.ai-submit {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 46px;
  background: var(--brand); color: #fff;
  border: 0; border-radius: 999px;
  font-family: inherit;
  font-size: 14.5px; font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  margin-top: 4px;
  transition: background var(--t-fast), transform var(--t-fast);
}
.ai-submit:hover { background: var(--brand-700); transform: translateY(-1px); }

/* === 결과 === */
.ai-result {
  background:
    radial-gradient(circle at 50% 20%, rgba(225, 20, 30, 0.04) 0%, transparent 60%),
    var(--bg-soft);
  border-radius: 14px;
  padding: 22px;
  display: flex; flex-direction: column;
  min-height: 100%;
  flex: 1;
}
.ai-result__empty {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 28px 12px;
  color: var(--ink-3);
}
.ai-result__empty-art {
  position: relative;
  width: 120px; height: 110px;
  margin-bottom: 14px;
}
.ai-result__empty-car {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 64px; color: var(--ink-1);
  opacity: 0.92;
}
.ai-result__empty-sparkle {
  position: absolute;
  color: var(--brand);
  animation: ai-twinkle 2.4s ease-in-out infinite;
}
.ai-result__empty-sparkle--1 {
  top: 0; left: 12px; font-size: 22px;
  animation-delay: 0s;
}
.ai-result__empty-sparkle--2 {
  top: 10px; right: 6px; font-size: 18px;
  animation-delay: 0.6s;
}
.ai-result__empty-sparkle--3 {
  bottom: 4px; right: 28px; font-size: 14px;
  animation-delay: 1.2s;
}
@keyframes ai-twinkle {
  0%, 100% { opacity: 0.4; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.1); }
}

.ai-result__empty h4 {
  margin: 0 0 6px; font-size: 20px; font-weight: 800;
  color: var(--ink-1); letter-spacing: -0.025em;
}
.ai-result__empty h4 em {
  font-style: normal; color: var(--brand);
}
.ai-result__empty p {
  margin: 0 0 22px; font-size: 13px; line-height: 1.7;
}

.ai-result__empty-steps {
  display: flex; flex-direction: column; gap: 6px;
  width: 100%; max-width: 260px;
}
.ai-result__empty-step {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 12px; font-weight: 600; color: var(--ink-2);
  text-align: left;
  letter-spacing: -0.01em;
}
.ai-result__empty-step b {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px;
  background: var(--bg-soft);
  color: var(--ink-3);
  border-radius: 50%;
  font-family: 'Inter', sans-serif;
  font-size: 11px; font-weight: 800;
  flex-shrink: 0;
}
.ai-result__empty-step--last {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}
.ai-result__empty-step--last b {
  background: var(--brand); color: #fff;
}
.ai-result__empty-step--last b i { font-size: 11px; }

/* 페르소나 요약 */
.ai-persona {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.ai-persona i {
  font-size: 28px; color: var(--brand);
}
.ai-persona__main {
  font-size: 13px; font-weight: 700; color: var(--ink-1);
  letter-spacing: -0.01em;
}
.ai-persona__sub {
  font-size: 11px; color: var(--ink-4);
  margin-top: 1px;
}

/* === Podium 1/2/3 — 금/은/동 통일 카드 === */
.ai-podium {
  display: flex; flex-direction: column; gap: 14px;
}
@keyframes ai-pop {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.ai-card {
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  display: grid;
  grid-template-columns: 280px 1fr;
  animation: ai-pop .4s ease-out both;
}
.ai-card:nth-child(2) { animation-delay: 0.06s; }
.ai-card:nth-child(3) { animation-delay: 0.12s; }
@media (max-width: 720px) {
  .ai-card { grid-template-columns: 1fr; }
}

/* BEST 카드만 강조 — brand 컬러 */
.ai-card--top {
  border-color: var(--brand);
  border-width: 2px;
  box-shadow: 0 6px 18px rgba(225, 20, 30, 0.10);
}

/* 상단 랭크 영역 — 카드 폭 전체 */
.ai-card__rank {
  grid-column: 1 / -1;
  position: relative;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--line);
}
.ai-card--top .ai-card__rank {
  background: linear-gradient(90deg, var(--brand-50) 0%, #fff 100%);
}

.ai-card__badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px;
  background: var(--brand);
  color: #fff;
  border-radius: 999px;
  font-family: 'Inter', 'Pretendard Variable', sans-serif;
  font-size: 10.5px; font-weight: 800;
  letter-spacing: 0.4px;
}
.ai-card__badge i { font-size: 11px; }
.ai-card__badge--alt {
  background: var(--bg);
  color: var(--ink-3);
  border: 1px solid var(--line-2);
  letter-spacing: -0.01em;
}
.ai-card__badge--alt i { color: var(--ink-3); }

.ai-card__match {
  margin-left: auto;
  font-size: 11px; font-weight: 600; color: var(--ink-3);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

/* 좌측 차량 이미지 */
.ai-card__visual {
  grid-row: span 1;
  width: 100%; aspect-ratio: 16/10;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  padding: 4px 8px;
}
@media (max-width: 720px) {
  .ai-card__visual { grid-row: auto; aspect-ratio: 16/8; }
}
.ai-card__img {
  width: 96%; height: 96%; object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0,0,0,0.10));
}
.ai-card__icon { font-size: 72px; color: var(--ink-4); opacity: 0.5; }

/* 우측 본문 */
.ai-card__body {
  padding: 16px 18px 18px;
  display: flex; flex-direction: column; gap: 8px;
}
.ai-card__brand {
  font-size: 10.5px; color: var(--ink-4); font-weight: 600;
  letter-spacing: 0.3px;
}
.ai-card__model {
  margin: 0;
  font-size: 18px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.02em; line-height: 1.2;
}
.ai-card__trim {
  font-size: 11.5px; color: var(--ink-3); line-height: 1.4;
}

.ai-card__reasons {
  margin: 6px 0 0; padding: 0;
  list-style: none;
  display: flex; flex-direction: column; gap: 5px;
}
.ai-card__reasons li {
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 12px; color: var(--ink-2); line-height: 1.5;
}
.ai-card__reasons i {
  font-size: 13px; flex-shrink: 0; margin-top: 1px;
  color: var(--brand);
}
.ai-card:not(.ai-card--top) .ai-card__reasons i { color: var(--ink-4); }

.ai-card__story {
  margin-top: 4px;
  padding: 10px 12px;
  background: var(--bg-soft);
  border-radius: 8px;
}
.ai-card__story-label {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; font-weight: 700; color: var(--ink-2);
  margin-bottom: 4px;
}
.ai-card__story-label i { font-size: 11px; color: var(--brand); }
.ai-card__story p {
  margin: 0;
  font-size: 12px; color: var(--ink-2);
  line-height: 1.65; letter-spacing: -0.01em;
}

.ai-card__price {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px; flex-wrap: wrap;
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}
.ai-card__monthly {
  display: inline-flex; align-items: baseline; gap: 2px;
  font-family: 'Inter', 'Pretendard Variable', sans-serif;
  font-variant-numeric: tabular-nums;
}
.ai-card__monthly-num {
  font-size: 22px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.04em; line-height: 1;
}
.ai-card__monthly small {
  font-size: 12px; color: var(--ink-3); font-weight: 500;
  margin-left: 1px;
}
.ai-card__sub {
  font-size: 10px; color: var(--ink-4);
  text-align: right;
}

.ai-card__ctas {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  margin-top: 4px;
}
.ai-card__cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 40px;
  border: 0; border-radius: 999px;
  font-family: inherit;
  font-size: 12.5px; font-weight: 700;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ai-card__cta i { font-size: 13px; }
.ai-card__cta--primary { background: var(--ink-1); color: #fff; }
.ai-card__cta--primary:hover { background: var(--brand); }
.ai-card__cta--outline {
  background: var(--bg); color: var(--ink-2);
  border: 1.5px solid var(--line-2);
}
.ai-card__cta--outline:hover { border-color: var(--ink-1); color: var(--ink-1); }

.ai-result__again {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; color: var(--ink-3);
  border: 1.5px solid var(--line-2);
  border-radius: 999px;
  padding: 10px 0;
  font-family: inherit; font-size: 12.5px; font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ai-result__again:hover {
  background: var(--bg); color: var(--ink-1); border-color: var(--ink-4);
}
</style>
