<script setup>
import { ref, computed } from 'vue';
import { 담당자인가 } from '../../lib/role.js';
import { quoteState } from '../../store.js';
/* ★계산은 웰릭스가 한다. calc.js 는 검산용으로만 남긴다(scripts/check-promo.mjs).
     대표 2026-09-18 「몇천 원 차이가 나면 안 돼 … 내부는 똑같은 로직이어야 되는 거야」 */
import { 견적상태 } from '../../lib/quote/index.js';
import { vehicleState } from '../../store.js';
import { fmt } from '../../lib/format.js';
import { QUOTE_TERMS } from '../../lib/quote/terms.js';
import { setScenarioIncluded, setScenarioPercent, setScenarioTerm } from '../../lib/feature/conditions.js';
import { selectionSummary } from '../../lib/selection-summary.js';
const selected = computed(() => selectionSummary(window.VEHICLE_DB, vehicleState, quoteState));

const 담당자 = 담당자인가();   // 손님은 보증금·선납금을 만지지 않는다
const expanded = ref(false);
function toggle() { expanded.value = !expanded.value; }

// 스와이프 제스처 — 손잡이/요약 영역에서 위로 끌면 펼침, 아래로 끌면 접힘
const SWIPE_THRESHOLD = 30;  // px — 이 이상 움직여야 스와이프로 인식
let touchStartY = 0;
let touchStartT = 0;
function onTouchStart(e) {
  touchStartY = e.touches[0].clientY;
  touchStartT = Date.now();
}
function onTouchEnd(e) {
  const endY = (e.changedTouches?.[0] || {}).clientY ?? touchStartY;
  const dy = endY - touchStartY;
  const dt = Date.now() - touchStartT;
  // 짧은 탭(움직임 작고 빠른 터치) 은 무시 — @click 이 처리
  if (Math.abs(dy) < SWIPE_THRESHOLD || dt > 500) return;
  if (dy < 0) expanded.value = true;     // 위로 → 펼침
  else        expanded.value = false;    // 아래로 → 접힘
  e.preventDefault();  // tap 으로 토글되지 않도록
}

const TERM_OPTIONS = QUOTE_TERMS;

/* 금액바는 «표시»만 한다. 사용자가 계약조건에서 줄인 기간을 다시 만들어내지 않는다.
   quoteState.send 길이만 현재 시나리오 수와 맞춘다. */
if (!Array.isArray(quoteState.send)) quoteState.send = [];
while (quoteState.send.length < quoteState.scenarios.length) quoteState.send.push(true);
if (quoteState.send.length > quoteState.scenarios.length) quoteState.send.splice(quoteState.scenarios.length);

function onTermChange(idx, e) {
  const result = setScenarioTerm(quoteState, idx, e.target.value);
  e.target.value = result.value ?? quoteState.scenarios[idx]?.term ?? '';
}
function stripNonDigits(e) {
  const cleaned = e.target.value.replace(/\D/g, '');
  if (cleaned !== e.target.value) e.target.value = cleaned;
}
function onDepChange(idx, e) {
  const result = setScenarioPercent(quoteState, idx, 'dep', e.target.value.replace(/\D/g, ''));
  e.target.value = result.value ?? 0;
}
function onPreChange(idx, e) {
  const result = setScenarioPercent(quoteState, idx, 'pre', e.target.value.replace(/\D/g, ''));
  e.target.value = result.value ?? 0;
}
function onSendToggle(idx) {
  setScenarioIncluded(quoteState, idx, !(quoteState.send[idx] !== false));
}

/* 조건이 바뀌면 다시 묻는 watch 는 MobileApp 에 있다 — 이 금액바는 옵션 단계 전엔 안 뜨지만
   계산은 늘 돌아야 해서(마지막 견적 페이지도 같은 값을 읽는다). */

const 계산중 = computed(() => 견적상태.상태 === 'pending');
const 계산못함 = computed(() => 견적상태.상태 === 'error');

// 각 기간 시나리오 — 계산 결과의 같은 순서 슬롯을 읽는다.
const cards = computed(() => {
  const r = 견적상태.상태 === 'ok' ? (견적상태.결과 || []) : [];
  return quoteState.scenarios.map((sc, idx) => {
    const g = r[idx];
    return {
      idx, term: sc.term, dep: sc.dep ?? 10, pre: sc.pre ?? 0,
      sent: quoteState.send[idx] !== false,
      monthly: g?.월대여료 ?? null,
      residualAmt: g?.인수가 ?? null,
      residualPct: (g?.인수가 && g?.총차량가) ? g.인수가 / g.총차량가 : null,
      depAmt: g?.보증금 ?? null,
      preAmt: g?.선납금 ?? null,
    };
  });
});
</script>

<template>
  <div class="sq" :class="{ 'sq--expanded': expanded }">
    <!-- 단일 어포던스 — 손잡이 바 + 라벨이 한 영역, 탭/스와이프 모두 지원 -->
    <div
      class="sq-summary"
      @click="toggle"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      aria-label="견적 펼치기 (탭 또는 위로 스와이프)"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <span class="sq-summary__bar"></span>
      <div class="sq-summary__row">
        <div class="sq-summary__label">
          월 대여료
          <span class="sq-summary__hint">VAT 포함 · 체크된 기간만 발송</span>
        </div>
        <i class="ph sq-summary__caret" :class="expanded ? 'ph-caret-down' : 'ph-caret-up'"></i>
      </div>
    </div>

    <!-- 기간별 카드 — 기간 변경 select + 월대여료 + 발송 체크 -->
    <div class="sq-terms">
      <div
        v-for="c in cards" :key="c.idx"
        class="sq-term-card"
        :class="{ 'is-checked': c.sent }"
      >
        <button
          type="button"
          class="sq-term-card__check-btn"
          @click="onSendToggle(c.idx)"
          :aria-label="(c.sent ? '발송 제외' : '발송 포함') + ' ' + c.term + '개월'"
        >
          <i class="ph" :class="c.sent ? 'ph-check-circle-fill' : 'ph-circle'"></i>
        </button>
        <div class="sq-term-card__term">{{ c.term }}개월</div>
        <div class="sq-term-card__monthly">
          <template v-if="c.monthly">{{ fmt(c.monthly) }}<em>원</em></template>
          <template v-else><span class="muted">—</span></template>
        </div>
      </div>
    </div>

    <!-- 펼침 — 보증금/선납금 편집 + 만기인수/약정/정비 표시 -->
    <div v-if="expanded" class="sq-detail">
      <table class="sq-table">
        <thead>
          <tr>
            <th scope="col" class="sq-table__rowlabel">구분</th>
            <th v-for="c in cards" :key="c.idx"
                scope="col"
                :class="{ 'is-dim': !c.sent }">
              <select
                class="sq-table__term-select"
                :value="c.term"
                :aria-label="`${c.term}개월 기간 선택`"
                @change="onTermChange(c.idx, $event)"
              >
                <option v-for="t in TERM_OPTIONS" :key="t" :value="t">{{ t }}개월</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- 대여료 (기간 헤더 바로 밑) — 펼침 시 첫 눈에 보이는 핵심 정보 -->
          <tr class="sq-table__monthly-row">
            <th scope="row" class="sq-table__rowlabel">대여료</th>
            <td v-for="c in cards" :key="c.idx" class="sq-table__monthly">
              <template v-if="c.monthly">
                <b>{{ fmt(c.monthly) }}</b><small>원/월</small>
              </template>
              <template v-else>—</template>
            </td>
          </tr>
          <tr v-if="quoteState.cond.discount">
            <th scope="row" class="sq-table__rowlabel">추가 할인</th>
            <td v-for="c in cards" :key="c.idx" class="sq-table__discount">
              −{{ fmt(quoteState.cond.discount) }}만원
            </td>
          </tr>
          <tr>
            <th scope="row" class="sq-table__rowlabel">약정주행</th>
            <td v-for="c in cards" :key="c.idx">{{ quoteState.cond.km || 2 }}만km/년</td>
          </tr>
          <tr>
            <th scope="row" class="sq-table__rowlabel">만기인수</th>
            <td v-for="c in cards" :key="c.idx">
              <template v-if="c.residualAmt">
                {{ (c.residualPct * 100).toFixed(0) }}%<br>
                <small>{{ fmt(c.residualAmt) }}원</small>
              </template>
              <template v-else>—</template>
            </td>
          </tr>
          <tr>
            <th scope="row" class="sq-table__rowlabel">정비서비스</th>
            <td v-for="c in cards" :key="c.idx">{{ quoteState.cond.svc || '웰스 Basic' }}</td>
          </tr>
          <!-- ★보증금·선납금은 «담당자만» 만진다. 손님에게는 심사 뒤에 정해지는 값이라
               여기서 묻지 않는다(대표 2026-09-17). -->
          <tr v-if="담당자">
            <th scope="row" class="sq-table__rowlabel">보증금</th>
            <td v-for="c in cards" :key="c.idx">
              <span class="sq-pct-cell">
                <input
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="3"
                  class="sq-pct-input"
                  :value="c.dep"
                  :aria-label="`${c.term}개월 보증금 비율`"
                  @input="stripNonDigits($event)"
                  @change="onDepChange(c.idx, $event)"
                />%
              </span>
              <small v-if="c.depAmt">{{ fmt(c.depAmt) }}원</small>
            </td>
          </tr>
          <tr v-if="담당자">
            <th scope="row" class="sq-table__rowlabel">선납금</th>
            <td v-for="c in cards" :key="c.idx">
              <span class="sq-pct-cell">
                <input
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="3"
                  class="sq-pct-input"
                  :value="c.pre"
                  :aria-label="`${c.term}개월 선납금 비율`"
                  @input="stripNonDigits($event)"
                  @change="onPreChange(c.idx, $event)"
                />%
              </span>
              <small v-if="c.preAmt">{{ fmt(c.preAmt) }}원</small>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="sq-meta">
        <div class="sq-meta__row">
          <span class="sq-meta__key">차량</span>
          <span class="sq-meta__val">{{ quoteState.vehicle?.brand }} {{ quoteState.vehicle?.model }} {{ quoteState.vehicle?.trim_name }}</span>
        </div>
        <div class="sq-meta__row">
          <span class="sq-meta__key">옵션</span>
          <span class="sq-meta__val">{{ selected?.options.length ? selected.options.join(' · ') : '미선택' }}</span>
        </div>
        <div class="sq-meta__row">
          <span class="sq-meta__key">색상</span>
          <span class="sq-meta__val">
            <span class="sq-meta__color">외장 {{ selected?.exterior || '미선택' }}</span>
            <span class="sq-meta__color">내장 {{ selected?.interior || '미선택' }}</span>
          </span>
        </div>
        <div class="sq-meta__row">
          <span class="sq-meta__key">신용</span>
          <!-- 손님에게는 등급 이름 대신 「신용점수 무관」 (대표 2026-09-18) -->
          <span class="sq-meta__val">{{ 담당자 ? (quoteState.cond.credit || '중신용') : '신용점수 무관' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sq-meta__color { display: block; }
.sq {
  position: fixed; bottom: var(--footer-height, 78px); left: 0; right: 0;
  background: var(--bg);
  border-top: 0;
  border-radius: var(--r-sheet) var(--r-sheet) 0 0;
  box-shadow: none;
  padding-bottom: 8px;
  z-index: 25;
  transition: max-height .25s;
  max-height: 175px;
  overflow: hidden;
}
.sq--expanded {
  max-height: min(75dvh, calc(100dvh - var(--footer-height, 78px) - var(--safe-top, 0px) - 80px));
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.sq-summary {
  display: flex; flex-direction: column; align-items: stretch;
  min-height: 44px;
  padding: 6px 16px 8px;
  cursor: pointer;
  user-select: none;
}
.sq-summary__bar {
  align-self: center;
  width: 38px; height: 4px;
  background: var(--line-2);
  border-radius: 2px;
  margin-bottom: 6px;
}
.sq-summary__row {
  display: flex; align-items: center; justify-content: space-between;
}
.sq-summary__label {
  display: flex; align-items: baseline; gap: 6px;
  font-size: var(--fs-sm); color: var(--ink-3); font-weight: 500;
}
.sq-summary__hint { font-size: var(--fs-xs); color: var(--ink-4); }
.sq-summary__caret { font-size: 16px; color: var(--ink-3); }

/* 기간 카드 grid — 항상 표시 */
.sq-terms {
  display: flex; gap: 6px;
  padding: 0 16px 6px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}
.sq-terms::-webkit-scrollbar { display: none; }
.sq-term-card {
  position: relative;
  flex: 0 0 92px; min-width: 92px;
  scroll-snap-align: start;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 8px 6px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-card);
  font-family: inherit;
  transition: background .12s, border-color .12s;
}
.sq-term-card.is-checked {
  background: var(--brand-50);
}
.sq-term-card__check-btn {
  position: absolute; top: 0; right: 0;
  width: 44px; height: 44px;
  background: transparent; border: 0; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--ink-4);
  font-size: 16px;
}
.sq-term-card.is-checked .sq-term-card__check-btn { color: var(--brand); }
.sq-term-card__term {
  font-size: var(--fs-xs); color: var(--ink-3); font-weight: 500;
}
.sq-term-card.is-checked .sq-term-card__term { color: var(--brand); }
/* 펼침 표 헤더 — 기간 변경 select */
.sq-table__term-select {
  appearance: none; -webkit-appearance: none;
  background: transparent; border: 0;
  font-family: inherit;
  font-size: var(--fs-sm); font-weight: 600; color: var(--ink-1);
  text-align: center; text-align-last: center;
  min-height: 44px;
  padding: 0 2px;
  cursor: pointer;
  outline: none;
  width: 100%;
}
.sq-table__term-select:focus { color: var(--brand); }
.sq-table__term-select:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: -3px;
  border-radius: var(--r-control);
}
.sq-table thead th.is-dim .sq-table__term-select { color: var(--ink-4); }
.sq-term-card__monthly {
  white-space: nowrap;
  font-size: var(--fs-lg); font-weight: 700; color: var(--ink-1);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.4px;
}
.sq-term-card__monthly em {
  font-style: normal; font-size: var(--fs-xs); color: var(--ink-3);
  font-weight: 500;
  margin-left: 1px;
}
.sq-term-card.is-checked .sq-term-card__monthly { color: var(--brand); }

/* 펼침: 보증금/선납금 % 입력 */
.sq-pct-cell {
  display: inline-flex; align-items: center; gap: 1px;
}
.sq-pct-input {
  width: 44px; height: 44px;
  border: 1px solid var(--line-2); border-radius: var(--radius-sm);
  background: var(--bg);
  font-family: inherit;
  font-size: var(--fs-base); color: var(--ink-1); font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
  outline: none;
  padding: 0 2px;
}
.sq-pct-input:focus { border-color: var(--brand); }
.sq-pct-input:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
/* 숫자 input 화살표 제거 */
.sq-pct-input::-webkit-outer-spin-button,
.sq-pct-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.sq-pct-input { -moz-appearance: textfield; }

.sq-empty {
  padding: 20px 16px;
  text-align: center;
  color: var(--ink-4); font-size: var(--fs-md);
}

/* 펼침 표 — PC 견적표 형태 */
.sq-detail {
  border-top: 0;
  padding: 12px 16px;
}
.sq-table {
  width: 100%; border-collapse: collapse;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
  margin-bottom: 12px;
}
.sq-table th, .sq-table td {
  padding: 7px 4px;
  text-align: center;
  border-bottom: 0;
  vertical-align: middle;
  line-height: 1.3;
}
.sq-table thead th {
  background: var(--bg-soft);
  font-weight: 600; color: var(--ink-1);
  font-size: var(--fs-sm);
  border-bottom: 0;
}
.sq-table__rowlabel {
  text-align: left !important;
  color: var(--ink-3); font-weight: 500;
  font-size: var(--fs-sm);
  background: var(--bg-soft);
  width: 60px;
  padding-left: 8px !important;
}
.sq-table small {
  font-size: var(--fs-xs); color: var(--ink-3); font-weight: 400;
}
.sq-table tbody tr:last-child th,
.sq-table tbody tr:last-child td {
  border-bottom: 0;
}
.sq-table thead th.is-dim {
  color: var(--ink-4);
  opacity: 0.5;
}
.sq-table__discount {
  color: var(--brand); font-weight: var(--fw-semi);
}
.sq-table__monthly-row td {
  background: var(--brand-50);
}
.sq-table__monthly b {
  font-size: var(--fs-base); font-weight: 700; color: var(--brand);
  letter-spacing: -0.3px;
}
.sq-table__monthly small {
  font-size: var(--fs-sm); color: var(--ink-3); font-weight: 400;
  margin-left: 2px;
}

/* 메타 */
.sq-meta { padding-top: 4px; }
.sq-meta__row {
  display: flex; justify-content: space-between;
  padding: 5px 0;
  font-size: var(--fs-sm);
}
.sq-meta__key { color: var(--ink-3); }
.sq-meta__val {
  color: var(--ink-1); font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: right;
  max-width: 65%;
}
</style>
