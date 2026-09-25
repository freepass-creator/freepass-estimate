<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { quoteState, vehicleState } from '../../store.js';
import { 담당자인가, 손님링크 } from '../../lib/role.js';
import { 지금주소 } from '../../lib/share-link.js';
import StepVehicle from './StepVehicle.vue';
import StepConditions from './StepConditions.vue';
import StepExtras from './StepExtras.vue';
import StepResult from './StepResult.vue';
import { 다시계산, 견적상태 } from '../../lib/quote/index.js';
import StickyQuote from './StickyQuote.vue';
import SendSheet from './SendSheet.vue';
import SelectionSummary from './SelectionSummary.vue';
const footer = ref(null);
const footerHeight = ref(78);
let footerObserver;
onMounted(() => {
  footerObserver = new ResizeObserver(() => {
    footerHeight.value = footer.value?.getBoundingClientRect().height || 78;
  });
  if (footer.value) footerObserver.observe(footer.value);
});
onBeforeUnmount(() => footerObserver?.disconnect());

const cfg = computed(() => window.__welrix_companyConfig || {});
const 헤더브랜드 = computed(() => '프리패스모빌리티');
const 공유제목 = computed(() => '프리패스모빌리티 견적');

// 발송은 헤더 상단 아이콘으로 — step 으로 안 둠 (사용자 의도)
const STEPS = [
  { key: 'vehicle',    label: '차량',     comp: StepVehicle    },
  { key: 'conditions', label: '계약 조건', comp: StepConditions },
  { key: 'extras',     label: '용품·서비스', comp: StepExtras   },
  /* ★견적은 별도 페이지로 (대표 2026-09-18) */
  { key: 'result',     label: '견적',     comp: StepResult     },
];

const 담당자 = 담당자인가();
const 공유됨 = ref(false);
const 공유중 = ref(false);
const 공유견적 = computed(() => !!quoteState.sharedSnapshot);
const 견적준비됨 = computed(() => !!vehicleState.trim && (공유견적.value || 견적상태.상태 === 'ok'));

/* ── 조건이 바뀌면 웰릭스에 다시 묻는다 ────────────────────────────────
 *  읽는 값이 하나라도 바뀌면 watch 가 걸린다. 연속 입력은 견적 뼈대가 묶는다. */
watch(
  () => [
    vehicleState.trim,
    [...(vehicleState.options || [])].join('.'),
    vehicleState.color,
    JSON.stringify(quoteState.scenarios),
    quoteState.cond.credit, quoteState.cond.km, quoteState.cond.svc,
    quoteState.cond.insProperty, quoteState.cond.extraDriver,
    quoteState.cond.deliveryCity, quoteState.cond.feeRatePct,
    quoteState.cond.discount, quoteState.cond.colorIntPrice,
    JSON.stringify(quoteState.tint?.areas ? [...quoteState.tint.areas] : []),
    quoteState.tint?.product, JSON.stringify(quoteState.extras),
  ].join('|'),
  () => { if (!quoteState.sharedSnapshot) 다시계산(); },
  { immediate: true },
);

/* ── 하단 금액바는 «옵션 단계부터» ─────────────────────────────────────
 * ★대표 2026-09-18 「옵션 고르기 전까지는 하단에 견적 보여주지 말고」
 *   제조사·모델·파워트레인·트림을 고르는 동안은 숨긴다. 옵션을 넣을 때부터 값이 바뀌는 게 보이고,
 *   마지막 견적 페이지에서는 그 페이지가 견적이므로 다시 숨긴다. */
const 금액바보임 = computed(() => {
  if (!vehicleState.trim) return false;
  const key = STEPS[stepIdx.value]?.key;
  if (key === 'vehicle') return (vehicleState.subStep || 'brand') === 'options';
  return key !== 'result';
});

/* ── 공유 ──────────────────────────────────────────────────────────────
 * ★대표 2026-09-17 「공유는 좀 있었으면 좋겠어 — 내가 친구한테 할 수도 있고
 *   손님한테 할 수도 있으니까」
 * ★나가는 주소에서 `staff` 를 «반드시» 떼어 낸다(손님링크). 붙여 보내면
 *   받은 사람이 수수료 칸을 보게 된다. */
async function 공유하기() {
  if (!견적준비됨.value || 공유중.value) return;
  공유중.value = true;
  try {
    /* ★고른 차·트림·옵션·색상과 확정 계산값을 주소에 담고, staff 표시는 떼어 낸다 */
    const 주소 = 손님링크(지금주소(vehicleState, quoteState, 견적상태));
    const 표시차 = quoteState.sharedSnapshot?.vehicle || quoteState.vehicle || {};
    const 글 = vehicleState.trim
      ? [표시차.brand, 표시차.model, 표시차.trim_name, '견적'].filter(Boolean).join(' ')
      : '신차 장기렌터카 견적';

    if (navigator.share) {
      try {
        await navigator.share({ title: 공유제목.value, text: 글, url: 주소 });
        공유됨.value = true;
        setTimeout(() => { 공유됨.value = false; }, 1600);
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
        /* 공유시트 자체 오류면 아래 클립보드 fallback 으로 이어진다. */
      }
    }

    try {
      await navigator.clipboard.writeText(주소);
      공유됨.value = true;
      setTimeout(() => { 공유됨.value = false; }, 1600);
    } catch {
      window.prompt('이 주소를 복사하세요', 주소);
    }
  } finally {
    공유중.value = false;
  }
}

/* 공유 링크로 들어왔으면 견적 페이지에서 시작한다 (share-link.js 풀기가 표시해 둔다) */
const stepIdx = ref(vehicleState.견적부터 ? STEPS.length - 1 : 0);

/* ── 「견적 보기」 — 트림만 고르면 어느 걸음에서든 곧장 견적 페이지로 ─────
 * ★대표 2026-09-18 「세부 트림만 누르고도 견적 보기가 가능해야 되고,
 *   다음 넘기면 옵션·색상 고르고」
 *   「다음」은 한 걸음씩, 「견적 보기」는 건너뛴다. 건너뛴 자리는 기억해 두고
 *   견적 페이지의 「이전」이 그리로 돌려보낸다. */
const 돌아갈곳 = ref(vehicleState.견적부터 ? { stepIdx: 0, subStep: 'options' } : null);
function 수정하기() {
  /* 공유받은 견적은 여기까지 «보낸 당시 값»이다. 수정부터는 새 견적이므로 실시간 계산으로 전환한다. */
  quoteState.sharedSnapshot = null;
  stepIdx.value = 0;
  vehicleState.subStep = 'options';
  돌아갈곳.value = null;
  다시계산();
  if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
}
function 견적보기() {
  if (!vehicleState.trim) return;
  돌아갈곳.value = { stepIdx: stepIdx.value, subStep: vehicleState.subStep };
  stepIdx.value = STEPS.length - 1;
  if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
}
const currentStep = computed(() => STEPS[stepIdx.value]);

/* ★순서는 제조사 «내 차 만들기»와 같게 — 파워트레인 → (갈리면) 인승·구동 → 세부트림 → 색상 → 옵션.
     현대 hyundai.com/kr/ko/e/vehicles/estimation: 01 모델(엔진·구동·트림) → 02 색상 → 옵션 → 완료.
     ★'spec'(인승·구동) 은 그 파워트레인 안에서 실제로 갈릴 때만 있는 걸음이다 — 대표 2026-09-18
       「그 인승 구동 방식 그거를 어떻게 나눌지」. 갈리지 않는 차(그랜저 2.5, K5 등)는 이 걸음이 아예 없다. */
const VEHICLE_SUB_STEPS_ALL = ['brand', 'model', 'variant', 'spec', 'trim', 'colors', 'options'];

/* 지금 고른 파워트레인이 인승·구동으로 갈리는가 — StepVehicle.vue 의 specGroups 와 같은 기준.
   그 컴포넌트 안 값이라 여기서는 DB 를 직접 다시 본다(전역 window.VEHICLE_DB, 같은 데이터). */
const 파워트레인갈래있나 = computed(() => {
  try {
    const b = window.VEHICLE_DB?.manufacturers?.find((x) => x.manufacturer_id === vehicleState.manufacturer);
    const m = b?.models?.find((x) => x.model_id === vehicleState.model);
    const v = m?.variants?.find((x) => x.variant_id === vehicleState.variant);
    return new Set((v?.trims || []).map((t) => t.group).filter(Boolean)).size > 1;
  } catch { return false; }
});
const VEHICLE_SUB_STEPS = computed(() => (
  파워트레인갈래있나.value ? VEHICLE_SUB_STEPS_ALL : VEHICLE_SUB_STEPS_ALL.filter((s) => s !== 'spec')
));

// 전체 페이지 (sub-step 포함) — progress bar 세그먼트 수. 'spec' 유무에 따라 차마다 다르다.
const TOTAL_PAGES = computed(() => VEHICLE_SUB_STEPS.value.length + (STEPS.length - 1));
// 현재 페이지 인덱스 (0-based)
const currentPageIdx = computed(() => {
  if (currentStep.value.key === 'vehicle') {
    const sub = vehicleState.subStep || 'brand';
    return VEHICLE_SUB_STEPS.value.indexOf(sub);
  }
  return VEHICLE_SUB_STEPS.value.length + (stepIdx.value - 1);
});

const canGoBack = computed(() => {
  if (공유견적.value && currentStep.value.key === 'result') return false;
  if (currentStep.value.key === 'vehicle') {
    const sub = vehicleState.subStep || 'brand';
    if (VEHICLE_SUB_STEPS.value.indexOf(sub) > 0) return true;
  }
  return stepIdx.value > 0;
});

const 견적보기보임 = computed(() => {
  if (!vehicleState.trim) return false;
  const key = currentStep.value.key;
  if (key === 'result') return false;
  if (STEPS[stepIdx.value + 1]?.key === 'result') return false;   // 그 걸음의 「다음」이 이미 「견적 보기」다
  if (key === 'vehicle') {
    return VEHICLE_SUB_STEPS.value.indexOf(vehicleState.subStep || 'brand') >= VEHICLE_SUB_STEPS.value.indexOf('trim');
  }
  return true;
});

const 자동전진단계 = computed(() => currentStep.value.key === 'vehicle'
  && ['brand', 'model', 'variant', 'spec', 'trim'].includes(vehicleState.subStep || 'brand'));

/* FreePass 하단 내비게이션 계약
 * - 이전/다음 기능은 항상 공통 뼈대에 존재한다.
 * - 단일선택(auto) 단계는 선택 즉시 전진하므로 Next 를 숨긴다.
 * - colors/options/conditions/extras 처럼 완료 의사가 필요한 단계만 Next 를 노출한다.
 * - 나중에 어떤 단계를 수동진행으로 바꿔도 이 계약에서 showNext 만 바뀌면 된다. */
const 하단내비 = computed(() => {
  const 마지막 = stepIdx.value >= STEPS.length - 1;
  return {
    mode: 자동전진단계.value ? 'auto' : 'manual',
    hasPrev: canGoBack.value,
    hasNext: !마지막,
    showNext: !마지막 && !자동전진단계.value,
    nextLabel: STEPS[stepIdx.value + 1]?.key === 'result' ? '견적 보기' : '다음',
  };
});

const canProceed = computed(() => {
  if (currentStep.value.key !== 'vehicle') return true;
  const sub = vehicleState.subStep || 'brand';
  if (sub === 'brand')   return !!vehicleState.manufacturer;
  if (sub === 'model')   return !!vehicleState.model;
  if (sub === 'variant') return !!vehicleState.variant;
  if (sub === 'spec')    return !!vehicleState.trimGroup;
  if (sub === 'trim')    return !!vehicleState.trim;
  return true;
});

function next() {
  if (!canProceed.value) return;
  if (currentStep.value.key === 'vehicle') {
    const sub = vehicleState.subStep || 'brand';
    const list = VEHICLE_SUB_STEPS.value;
    const i = list.indexOf(sub);
    if (i >= 0 && i < list.length - 1) {
      vehicleState.subStep = list[i + 1];
      return;
    }
  }
  if (stepIdx.value < STEPS.length - 1) stepIdx.value++;
}

function prev() {
  if (currentStep.value.key === 'result' && 돌아갈곳.value) {
    stepIdx.value = 돌아갈곳.value.stepIdx;
    vehicleState.subStep = 돌아갈곳.value.subStep;
    돌아갈곳.value = null;
    return;
  }
  if (currentStep.value.key === 'vehicle') {
    const sub = vehicleState.subStep || 'brand';
    const list = VEHICLE_SUB_STEPS.value;
    const i = list.indexOf(sub);
    if (i > 0) {
      vehicleState.subStep = list[i - 1];
      return;
    }
  }
  if (stepIdx.value > 0) stepIdx.value--;
}

// 상단 CI 클릭 → 처음 화면(차량 선택 1단계)으로. 선택 데이터는 유지(비파괴 이동).
function goHome() {
  sendOpen.value = false;
  const 공유였음 = !!quoteState.sharedSnapshot;
  quoteState.sharedSnapshot = null;
  stepIdx.value = 0;
  vehicleState.subStep = 'brand';
  if (공유였음) 다시계산();
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
}

const vehicles = ref(window.__welrix_vehicles || []);

// 발송 sheet
const sendOpen = ref(false);
function openSend() {
  if (!견적준비됨.value) return;
  sendOpen.value = true;
}

// 조회동의 링크 — 헤더 [동의링크] 누르면 OS 시스템 공유시트(복사·카톡 등). 회사 설정의 signature_link.
const signCopied = ref(false);
async function shareSignLink() {
  const url = cfg.value.signature_link;
  if (!url) { alert('이 회사는 조회동의 링크가 설정되어 있지 않습니다.'); return; }
  const text = '[' + (cfg.value.name || '프리패스모빌리티') + '] 조회 동의 부탁드립니다. 아래 링크에서 진행해 주세요.';
  if (navigator.share) {
    try { await navigator.share({ title: '조회 동의', text, url }); return; }   // OS 공유시트
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  // 데스크톱 등 공유 미지원 → 클립보드 복사
  try {
    await navigator.clipboard.writeText(url);
    signCopied.value = true;
    setTimeout(() => { signCopied.value = false; }, 2500);
  } catch {
    prompt('아래 링크를 복사해 손님께 전달하세요:', url);
  }
}
</script>

<template>
  <div class="m-shell" :style="{ '--footer-height': footerHeight + 'px' }">
    <!-- 상단은 표시 전용: 브랜드/제목/상태만. CTA는 하단 액션 영역만 사용. -->
    <header class="m-header">
      <div class="m-header__brand">
        <span class="m-brand">{{ 헤더브랜드 }}</span>
      </div>
    </header>

    <!-- 페이지별 progress segment — 전체 페이지 수 만큼 -->
    <div class="m-progress">
      <div v-for="i in TOTAL_PAGES" :key="i"
           class="m-progress__seg"
           :class="{ 'is-done': (i - 1) <= currentPageIdx }"></div>
    </div>

    <main class="m-main"
          :class="{ 'm-main--quote': 금액바보임, 'm-main--result': currentStep.key === 'result' }">
      <div v-if="currentStep.key !== 'vehicle'" class="selection-anchor"><SelectionSummary /></div>
      <component :is="currentStep.comp" :vehicles="vehicles" />
    </main>

    <StickyQuote v-if="금액바보임" />

    <footer
      ref="footer"
      class="m-footer"
      v-show="!자동전진단계 || 하단내비.hasPrev || (공유견적 && currentStep.key === 'result')"
      :data-nav-mode="하단내비.mode"
    >
      <div class="m-footer__actions">
      <!-- 공유받은 확정견적은 먼저 «그대로» 보여 준다. 수정 버튼을 눌러야 새 계산이 시작된다. -->
      <template v-if="공유견적 && currentStep.key === 'result'">
        <button class="m-btn m-btn--soft" @click="수정하기">
          <i class="ph ph-pencil-simple"></i>조건 변경
        </button>
        <button class="m-btn m-btn--primary" :disabled="공유중" @click="공유하기">
          <i class="ph ph-share-network"></i>{{ 공유중 ? '준비 중…' : (공유됨 ? '공유됨' : '이 견적 공유') }}
        </button>
      </template>
      <template v-else>
        <button v-if="하단내비.hasPrev" class="m-btn m-btn--ghost" :class="{ 'm-btn--icon': 견적보기보임 }"
                @click="prev" aria-label="이전">
          <i class="ph ph-arrow-left"></i><span v-if="!견적보기보임">이전</span>
        </button>
        <button v-if="견적보기보임" class="m-btn m-btn--soft" @click="견적보기">견적 보기</button>
        <template v-if="stepIdx < STEPS.length - 1">
          <button
            v-show="하단내비.showNext"
            class="m-btn m-btn--primary"
            :disabled="!canProceed"
            @click="next"
            :data-nav-mode="하단내비.mode"
          >{{ 하단내비.nextLabel }}<i class="ph ph-arrow-right"></i></button>
        </template>
        <template v-else>
          <button
            class="m-btn m-btn--soft"
            :disabled="!견적준비됨 || 공유중"
            @click="공유하기"
          ><i class="ph ph-share-network"></i>{{ 공유중 ? '준비 중…' : (공유됨 ? '공유됨' : '공유') }}</button>
          <button
            v-if="담당자"
            class="m-btn m-btn--primary"
            :disabled="!견적준비됨"
            @click="openSend"
          ><i class="ph ph-paper-plane-tilt"></i>견적 발송</button>
        </template>
      </template>
      </div>
    </footer>

    <SendSheet :open="sendOpen" @close="sendOpen = false" />
  </div>
</template>

<style scoped>
/* 상단 브랜드 한 줄 — 로고 대신 글자로 (대표 2026-09-17) */
.m-brand {
  display: inline-flex; align-items: center;
  font: inherit; font-size: var(--fs-md); font-weight: 700; letter-spacing: -0.3px;
  color: var(--brand); white-space: nowrap;
}
.m-brand__x { opacity: .55; margin: 0 1px; font-weight: 600; }

.m-shell {
  display: flex; flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
}

/* 헤더 — 상단 항상 고정 */
.m-header {
  position: fixed; top: 0; left: 0; right: 0;
  z-index: 20;
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(var(--safe-top) + 10px) 16px 10px;
  background: var(--bg);
  gap: 8px;
}
.m-header__brand {
  display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;
}
.m-ci {
  height: 20px; width: auto;
  object-fit: contain;
  flex-shrink: 0;
}
.m-ver {
  flex-shrink: 0;
  font-size: var(--fs-xs); font-weight: var(--fw-semi);
  color: var(--ink-4); letter-spacing: -0.2px;
  padding: 2px 6px; border-radius: 5px;
  background: var(--bg-soft);
  font-variant-numeric: tabular-nums;
}
.m-title {
  font-size: var(--fs-sm); font-weight: 600; color: var(--ink-1);
  letter-spacing: -0.3px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}

.m-progress {
  display: flex; gap: 4px;
  position: fixed; top: calc(var(--safe-top) + 56px); left: 0; right: 0;
  padding: 0 16px 6px;
  background: var(--bg);
  z-index: 19;
}
.m-progress__seg {
  flex: 1; height: 3px;
  background: var(--line);
  border-radius: 2px;
  transition: background .25s ease-out;
}
.m-progress__seg.is-done {
  background: var(--brand);
}

.m-main {
  flex: 1;
  padding: calc(var(--safe-top) + 80px) var(--sp-4) calc(var(--footer-height, 78px) + 16px);
  /* ★여기서 overflow-y:auto 를 «쓰지 않는다» — 2026-09-18.
     #m-app 은 min-height 만 있고 max-height 가 없어 콘텐츠만큼 늘어난다.
     즉 .m-main 이 실제로 넘쳐서 «따로» 스크롤되는 일은 없고(항상 clientHeight===scrollHeight),
     페이지(html/body)가 스크롤한다. 그런데도 여기에 overflow-y:auto 를 켜 두면
     아이폰 사파리에서 «넘치지 않는 스크롤 영역» 이 손가락 스크롤 제스처를 가로채
     바깥 페이지로 못 넘기는 경우가 있다(안드로이드·데스크톱 크롬에서는 안 보이는 버그라 놓치기 쉽다).
     대표 「스크롤 되게 해주고」 — 트림이 많은 차(싼타페 36개 등)에서 이 증상이 났을 것이다. */
}
.m-main--quote {
  /* 접힌 실시간 견적바 + footer가 함께 떠 있는 화면만 충분한 하단 여백을 둔다. */
  padding-bottom: calc(var(--footer-height, 78px) + 140px);
}
.m-main--result {
  /* 최종 견적은 footer만 피하면 된다. 과도한 빈 스크롤을 만들지 않는다. */
  padding-bottom: calc(var(--footer-height, 78px) + 24px);
}

.m-footer {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: block;
  padding: 8px 16px calc(var(--safe-bottom) + 12px);
  background: var(--bg);
  z-index: 30;
}
.m-footer__actions { display: flex; gap: 8px; }
.m-footer__actions:has(> .m-btn:nth-child(2):last-child) > .m-btn:first-child { flex: 3 1 0; }
.m-footer__actions:has(> .m-btn:nth-child(2):last-child) > .m-btn:last-child { flex: 7 1 0; }
.m-btn {
  height: var(--h-cta);
  border: 0; border-radius: var(--r-chip);
  font-family: inherit; font-weight: 600;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: background .12s, opacity .12s;
}
.m-btn i { font-size: 18px; }
.m-btn--ghost {
  flex: 0 0 96px;
  background: var(--bg-soft);
  color: var(--ink-2);
  font-size: var(--fs-base);
}
.m-btn--ghost:active { background: var(--line-2); }
.m-btn--primary {
  flex: 1;
  background: var(--brand); color: #fff;
  font-size: var(--fs-base);
}
.m-btn--primary:not(:disabled):active { background: var(--brand-700); }
/* 「견적 보기」 — 다음 옆에 나란히. 테두리 없이 옅은 바탕 */
.m-btn--soft {
  flex: 1;
  background: var(--brand-50); color: var(--brand);
  font-size: var(--fs-base);
}
.m-btn--soft:active { background: var(--line-2); }
.m-btn--icon { flex: 0 0 52px; }
.m-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
