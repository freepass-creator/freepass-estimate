<script setup>
// 손님 셀프 견적 — ERP 카스케이드 로직(vehicle-db.js + vehicles.json 매칭) 그대로 활용.
// 4단계: 제조사 → 모델 → 세부모델(variant) → 트림 → 기간 → 결과.
// operating !== false 필터, Hybrid 모델명 접미사 매칭, calc.js 표준 조건 호출.
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';
import { DELIVERY_REGIONS, TINT_PRICES } from '../../data/lookups.js';

// 기본 deliveryFee = 서울 광역시 (UI 표시 X)
const DEFAULT_DELIVERY_FEE = (DELIVERY_REGIONS['광역시']?.['서울']) || 0;
// 기본 itemsFee = 기본 썬팅 (루마 GG, 전면 + 측후면 쿠폰)
const DEFAULT_TINT_FEE = (() => {
  const m = TINT_PRICES['루마 GG'];
  if (!m) return 0;
  return (m['front'] || 0) + (m['side_rear_with_coupon'] || 0);
})();

const TERMS = [60, 48, 36];
const DEPOSIT_PRESETS = [0, 10, 20, 30];
const PREPAY_PRESETS = [0, 10, 20, 30];

// vehicle-db (카탈로그) + vehicles.json (calc 데이터)
const db = ref(null);
const vehicles = ref([]);
const loading = ref(true);
const error = ref('');

// 카스케이드 상태 — 브랜드는 상단 탭으로 항상 노출, 단계는 모델 → 세부모델 → 트림
const brandId = ref('');   // 상단 탭 (manufacturer_id)
const modelId = ref('');
const variantId = ref('');
const trim = ref(null);     // 직접 트림 객체 보관
const selectedTerm = ref(60);
const deposit = ref(10);    // 보증금 % (기본 10)
const prepay = ref(0);      // 선납금 % (기본 0)
const selectedOptions = ref(new Set());  // 선택한 옵션 id Set

onMounted(async () => {
  try {
    let tries = 0;
    while (!window.VEHICLE_DB && tries < 50) {
      await new Promise(r => setTimeout(r, 50));
      tries++;
    }
    if (!window.VEHICLE_DB) throw new Error('VEHICLE_DB 미로드');
    db.value = window.VEHICLE_DB;
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
    // 첫 브랜드 자동 선택 — 브랜드 탭은 항상 노출, 카스케이드는 모델부터 시작
    const first = db.value.manufacturers?.[0];
    if (first) brandId.value = first.manufacturer_id;
  } catch (e) {
    error.value = '차량 데이터 로드 실패';
  } finally {
    loading.value = false;
  }
});

// 카스케이드 옵션
const manufacturers = computed(() => db.value?.manufacturers || []);
const selectedManufacturer = computed(() =>
  manufacturers.value.find(m => m.manufacturer_id === brandId.value)
);
const models = computed(() => selectedManufacturer.value?.models || []);
const selectedModel = computed(() =>
  models.value.find(m => m.model_id === modelId.value)
);
// 운영 트림(operating !== false) 이 1개 이상인 variant 만
const variants = computed(() => {
  const all = selectedModel.value?.variants || [];
  return all.filter(v => (v.trims || []).some(t => t.operating !== false));
});
const selectedVariant = computed(() =>
  variants.value.find(v => v.variant_id === variantId.value)
);
// 운영 트림만, 가격 낮은 순
const trims = computed(() => {
  if (!selectedVariant.value) return [];
  return (selectedVariant.value.trims || [])
    .filter(t => t.operating !== false)
    .slice()
    .sort((a, b) => (a.base_price_5 || 0) - (b.base_price_5 || 0));
});

function selectBrand(m) {
  brandId.value = m.manufacturer_id;
  // 브랜드 변경 시 하위 모두 리셋
  modelId.value = ''; variantId.value = ''; trim.value = null;
}
function selectModel(m) {
  modelId.value = m.model_id;
  variantId.value = ''; trim.value = null;
  // variant 1개면 자동 선택
  const vs = (m.variants || []).filter(v => (v.trims || []).some(t => t.operating !== false));
  if (vs.length === 1) selectVariant(vs[0]);
}
function selectVariant(v) {
  variantId.value = v.variant_id;
  trim.value = null;
  // 트림 1개면 자동 선택
  const ts = (v.trims || []).filter(t => t.operating !== false);
  if (ts.length === 1) selectTrim(ts[0]);
}
function selectTrim(t) {
  trim.value = t;
  selectedOptions.value = new Set();  // 트림 바뀌면 옵션 리셋
}
function selectTerm(t) { selectedTerm.value = t; }
function toggleOption(id) {
  if (selectedOptions.value.has(id)) selectedOptions.value.delete(id);
  else selectedOptions.value.add(id);
  selectedOptions.value = new Set(selectedOptions.value);
}

// 옵션 마스터 + 트림 가용 옵션
const optionsMaster = computed(() => selectedVariant.value?.options_master || {});
const trimOptions = computed(() => {
  if (!trim.value) return [];
  return (trim.value.available_options || [])
    .map(id => ({ id, ...optionsMaster.value[id] }))
    .filter(o => o.name);
});
const optionsPriceWon = computed(() => {
  let total = 0;
  selectedOptions.value.forEach(id => {
    const o = optionsMaster.value[id];
    if (o?.price) total += (o.price || 0) * 10000;
  });
  return total;
});

// 표시 정보
const selectedBrandName = computed(() => selectedManufacturer.value?.manufacturer_name || '');
const selectedModelName = computed(() => selectedModel.value?.model_name || '');
const selectedVariantName = computed(() => selectedVariant.value?.variant_name || '');
const selectedTrimName = computed(() => trim.value?.name || '');
const selectedTrimPriceKrw = computed(() => (trim.value?.base_price_5 || 0) * 10000);

// vehicles.json 에서 해당 트림 row 찾기 (ERP quote.js findVehicleMeta 동일 로직)
const matchedRow = computed(() => {
  const t = trim.value;
  const v = selectedVariant.value;
  const m = selectedModel.value;
  const mfr = selectedManufacturer.value;
  if (!t || !v || !m || !mfr) return null;
  const brand = mfr.manufacturer_name;
  const model = m.model_name;
  const priceWon = (t.base_price_5 || 0) * 10000;
  // HEV variant 면 model + ' Hybrid' 도 시도
  const isHEV = /하이브리드|HEV/i.test(v.variant_name || '');
  const candidates = isHEV ? [`${model} Hybrid`, model] : [model];
  for (const mm of candidates) {
    const exact = vehicles.value.filter(x =>
      x.brand === brand && x.model === mm && x.price === priceWon
    );
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      // 트림명 토큰 매칭
      const tokens = [...(v.variant_name || '').split(/[\s·,()/]+/), ...(t.name || '').split(/[\s·,()/]+/)]
        .filter(s => s && s.length >= 1).map(s => s.toLowerCase());
      const scored = exact.map(row => ({
        row, score: tokens.reduce((s, tok) => s + ((row.trim || '').toLowerCase().includes(tok) ? 1 : 0), 0)
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored[0].row;
    }
  }
  // 폴백 — brand+model 만
  for (const mm of candidates) {
    const f = vehicles.value.find(x => x.brand === brand && x.model === mm);
    if (f) return f;
  }
  return null;
});

// 표준 견적 계산
const result = computed(() => {
  const row = matchedRow.value;
  if (!row) return null;
  try {
    const r = calcQuote({
      vehicle: row,
      options: {
        optPrice: optionsPriceWon.value,
        discount: 0,
        deliveryFee: DEFAULT_DELIVERY_FEE,  // 서울 기본 (UI 표시 X)
        itemsFee: DEFAULT_TINT_FEE,         // 기본 썬팅 (UI 표시 X)
        etc: 0,
      },
      contract: { term: selectedTerm.value, km: '2만km', dep: +deposit.value || 0, pre: +prepay.value || 0 },
      customer: { creditGrade: '중신용' },
      insurance: {
        property: '1억', extraDriver: '없음',
        exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
        deductible: '30만원~', emergency: '가입',
      },
      fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
    });
    return {
      monthly: r.monthly,
      depAmt: r.depositAmt,
      preAmt: r.prePayAmt,
      residualPct: r.residualPct,
      residualAmt: r.residualAmt,
    };
  } catch (e) {
    return null;
  }
});

// 상담 신청 점프
function goToContact() {
  if (trim.value && matchedRow.value) {
    const params = new URLSearchParams({
      vehicle: `${selectedBrandName.value} ${selectedModelName.value} ${selectedVariantName.value} ${selectedTrimName.value}`.trim(),
      term: selectedTerm.value,
      monthly: result.value?.monthly || '',
    });
    history.replaceState(null, '', '#contact?' + params.toString());
  }
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}

// "뒤로" 단계 이동 (브랜드는 탭이라 step out 안 함)
function backToModel() { modelId.value = ''; variantId.value = ''; trim.value = null; }
function backToVariant() { variantId.value = ''; trim.value = null; }
</script>

<template>
  <div class="qw">
    <div v-if="loading" class="qw-loading">차량 데이터 로드 중…</div>
    <div v-else-if="error" class="qw-error">{{ error }}</div>
    <div v-else class="qw-grid">
      <!-- 좌측: 브랜드 탭(상단) + 카스케이드 (모델 → 세부모델 → 트림) -->
      <div class="qw-pickers">
        <!-- 브랜드 탭 (항상 노출) -->
        <div class="qw-brand-tabs">
          <button
            v-for="m in manufacturers" :key="m.manufacturer_id"
            class="qw-brand-tab"
            :class="{ 'is-active': brandId === m.manufacturer_id }"
            @click="selectBrand(m)"
          >{{ m.manufacturer_name }}</button>
        </div>

        <!-- 브레드크럼 (카스케이드 진행) -->
        <div class="qw-crumbs" v-if="modelId || variantId || trim">
          <button class="qw-crumb" @click="backToModel">{{ selectedModelName }}</button>
          <i class="ph ph-caret-right" v-if="variantId"></i>
          <button class="qw-crumb" v-if="variantId" @click="backToVariant">{{ selectedVariantName }}</button>
          <i class="ph ph-caret-right" v-if="trim"></i>
          <span class="qw-crumb qw-crumb--current" v-if="trim">{{ selectedTrimName }}</span>
        </div>

        <!-- 1) 모델 -->
        <div v-if="!modelId" class="qw-step">
          <div class="qw-step-label">모델 선택</div>
          <div class="qw-row-list">
            <button
              v-for="m in models" :key="m.model_id"
              class="qw-row"
              @click="selectModel(m)"
            >
              <span class="qw-row-name">{{ m.model_name }}</span>
              <i class="ph ph-caret-right qw-row-chev"></i>
            </button>
          </div>
        </div>

        <!-- 2) 세부모델 (variant) -->
        <div v-else-if="!variantId" class="qw-step">
          <div class="qw-step-label">세부 모델 선택</div>
          <div class="qw-row-list">
            <button
              v-for="v in variants" :key="v.variant_id"
              class="qw-row"
              @click="selectVariant(v)"
            >
              <span class="qw-row-name">{{ v.variant_name }}</span>
              <i class="ph ph-caret-right qw-row-chev"></i>
            </button>
          </div>
        </div>

        <!-- 3) 트림 -->
        <div v-else-if="!trim" class="qw-step">
          <div class="qw-step-label">트림 선택</div>
          <div class="qw-row-list">
            <button
              v-for="t in trims" :key="t.trim_id"
              class="qw-row qw-row--trim"
              @click="selectTrim(t)"
            >
              <div>
                <div class="qw-row-name">{{ t.name }}</div>
                <div class="qw-row-sub" v-if="t.seats">{{ t.seats }}인승 · {{ t.engine }}</div>
              </div>
              <div class="qw-row-price">{{ fmt(t.base_price_5 * 10000) }}<small>원</small></div>
            </button>
          </div>
        </div>

        <!-- 4) 기간 + 조건 (트림 선택 후) -->
        <template v-if="trim">
          <div class="qw-step">
            <div class="qw-step-label">기간</div>
            <div class="qw-chips">
              <button
                v-for="t in TERMS" :key="t"
                class="qw-chip qw-chip--lg"
                :class="{ 'is-active': selectedTerm === t }"
                @click="selectTerm(t)"
              >{{ t }}개월</button>
            </div>
          </div>

          <div class="qw-step">
            <div class="qw-step-label">보증금 <small class="qw-step-hint">(차량가의 %)</small></div>
            <div class="qw-chips">
              <button
                v-for="p in DEPOSIT_PRESETS" :key="p"
                class="qw-chip"
                :class="{ 'is-active': deposit === p }"
                @click="deposit = p"
              >{{ p === 0 ? '무보증' : p + '%' }}</button>
            </div>
          </div>

          <div class="qw-step">
            <div class="qw-step-label">선납금 <small class="qw-step-hint">(차량가의 %)</small></div>
            <div class="qw-chips">
              <button
                v-for="p in PREPAY_PRESETS" :key="p"
                class="qw-chip"
                :class="{ 'is-active': prepay === p }"
                @click="prepay = p"
              >{{ p === 0 ? '없음' : p + '%' }}</button>
            </div>
          </div>

          <!-- 옵션 (선택 사항) -->
          <div class="qw-step" v-if="trimOptions.length">
            <div class="qw-step-label">옵션 <small class="qw-step-hint">(선택 사항 · 토글)</small></div>
            <div class="qw-options">
              <button
                v-for="o in trimOptions" :key="o.id"
                class="qw-option"
                :class="{ 'is-active': selectedOptions.has(o.id) }"
                @click="toggleOption(o.id)"
                :title="o.sub || ''"
              >
                <span class="qw-option-name">{{ o.name }}</span>
                <span class="qw-option-price">+{{ o.price }}만원</span>
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- 우측: 결과 -->
      <aside class="qw-result">
        <div v-if="!trim" class="qw-result__empty">
          <i class="ph ph-car-profile"></i>
          <p>차종을 선택하면<br>즉시 월 대여료가 계산됩니다.</p>
        </div>
        <template v-else>
          <div class="qw-result__head">
            <div class="qw-result__brand">{{ selectedBrandName }} · {{ selectedModelName }}</div>
            <div class="qw-result__trim">{{ selectedVariantName }} {{ selectedTrimName }}</div>
          </div>

          <div class="qw-result__hero">
            <div class="qw-result__monthly-label">{{ selectedTerm }}개월 월 대여료</div>
            <div class="qw-result__monthly">
              <span v-if="result">{{ fmt(result.monthly) }}<small>원/월</small></span>
              <span v-else>—</span>
            </div>
          </div>

          <div class="qw-result__rows">
            <div class="qw-result__row">
              <span>차량가</span>
              <b>{{ fmt(selectedTrimPriceKrw) }}원</b>
            </div>
            <div class="qw-result__row" v-if="optionsPriceWon > 0">
              <span>선택 옵션 ({{ selectedOptions.size }}개)</span>
              <b>+{{ fmt(optionsPriceWon) }}원</b>
            </div>
            <div class="qw-result__row">
              <span v-if="deposit === 0">보증금</span>
              <span v-else>보증금 ({{ deposit }}%)</span>
              <b v-if="deposit === 0" class="qw-result__pill">무보증</b>
              <b v-else>{{ result ? fmt(result.depAmt) : '—' }}원</b>
            </div>
            <div class="qw-result__row" v-if="prepay > 0">
              <span>선납금 ({{ prepay }}%)</span>
              <b>{{ result ? fmt(result.preAmt) : '—' }}원</b>
            </div>
            <div class="qw-result__row">
              <span>만기인수 (선택)</span>
              <b>{{ result ? fmt(result.residualAmt) : '—' }}원</b>
            </div>
          </div>

          <div class="qw-result__cond">
            ※ 표준 조건: 중신용 · 약정 2만km/년 · 자동차 보험료·자동차세 포함<br>
            장기렌터카 — 월 대여료에 <b>보험료·세금</b> 포함 (정비는 별도).<br>
            실제 견적은 신용·소득·차량 옵션에 따라 다를 수 있습니다.
          </div>

          <button class="qw-result__cta" @click="goToContact">
            <i class="ph ph-chat-circle-dots"></i>
            이 견적으로 상담 신청
          </button>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.qw { max-width: 980px; margin: 0 auto; }
.qw-loading, .qw-error {
  text-align: center; padding: 60px 20px;
  color: var(--ink-3); font-size: 14px;
}

.qw-grid {
  display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px;
  align-items: start;
}
@media (max-width: 820px) {
  .qw-grid { grid-template-columns: 1fr; gap: 20px; }
}

/* === 좌측: 카스케이드 === */
.qw-pickers {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 22px;
  display: flex; flex-direction: column; gap: 18px;
  min-height: 380px;
}

/* 브랜드 탭 (항상 노출) */
.qw-brand-tabs {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
}
.qw-brand-tab {
  padding: 12px 8px;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  border-radius: var(--radius-sm);
  font-family: inherit; font-size: 14px; font-weight: 500;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.qw-brand-tab:hover { border-color: var(--ink-4); }
.qw-brand-tab.is-active {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}

/* 브레드크럼 */
.qw-crumbs {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  padding-bottom: 14px; border-bottom: 1px solid var(--line);
}
.qw-crumb {
  border: 0; background: transparent;
  font-family: inherit; font-size: 12px; color: var(--ink-3);
  padding: 4px 6px; border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}
.qw-crumb:hover { background: var(--bg-soft); color: var(--ink-1); }
.qw-crumb--current {
  color: var(--ink-1); font-weight: 600;
  cursor: default;
}
.qw-crumb--current:hover { background: transparent; }
.qw-crumbs i { font-size: 10px; color: var(--ink-4); }

/* 스텝 */
.qw-step { display: flex; flex-direction: column; gap: 10px; }
.qw-step-label {
  font-size: 12px; font-weight: 600; color: var(--ink-2);
  letter-spacing: -0.1px;
}

/* 행 리스트 (제조사/모델/세부모델) */
.qw-row-list {
  display: flex; flex-direction: column; gap: 6px;
  max-height: 320px; overflow-y: auto;
}
.qw-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-1);
  border-radius: var(--radius-sm);
  font-family: inherit; text-align: left;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.qw-row:hover { background: var(--bg-soft); border-color: var(--ink-4); }
.qw-row-name {
  font-size: 14px; font-weight: 600; letter-spacing: -0.2px;
}
.qw-row-sub {
  font-size: 11.5px; color: var(--ink-4); margin-top: 2px;
}
.qw-row-chev { font-size: 14px; color: var(--ink-4); }

/* 트림 행 — 가격 표시 */
.qw-row--trim { align-items: center; gap: 12px; }
.qw-row-price {
  font-size: 13.5px; font-weight: 700; color: var(--brand);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.qw-row-price small {
  font-size: 10px; color: var(--ink-4); font-weight: 400; margin-left: 1px;
}

/* Step hint (작은 설명) */
.qw-step-hint {
  font-size: 10.5px; font-weight: 400; color: var(--ink-4);
  margin-left: 2px;
}

/* Chip — 보증금/선납금/기간 공통 */
.qw-chips {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
}
.qw-chip {
  padding: 10px 0;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  border-radius: var(--radius-sm);
  font-family: inherit; font-size: 13px; font-weight: 500;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.qw-chip:hover { border-color: var(--ink-4); }
.qw-chip.is-active {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}
.qw-chip--lg {
  padding: 12px 0;
  font-size: 14px;
}
/* 기간은 3개 칩 */
.qw-step:has(.qw-chip--lg) .qw-chips { grid-template-columns: repeat(3, 1fr); }

/* 옵션 토글 */
.qw-options {
  display: flex; flex-direction: column; gap: 5px;
  max-height: 260px; overflow-y: auto;
}
.qw-option {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 11px 12px;
  background: var(--bg);
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius-sm);
  font-family: inherit; font-size: 13px;
  cursor: pointer; text-align: left;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.qw-option:hover { border-color: var(--ink-4); background: var(--bg-soft); }
.qw-option.is-active {
  background: var(--brand-50); border-color: var(--brand);
  color: var(--brand);
}
.qw-option-name {
  font-weight: 500; color: var(--ink-1);
  letter-spacing: -0.1px; flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.qw-option.is-active .qw-option-name { color: var(--brand); font-weight: 600; }
.qw-option-price {
  font-weight: 700; color: var(--brand);
  font-variant-numeric: tabular-nums; font-size: 12px;
  flex-shrink: 0;
}

/* === 우측: 결과 (네이비 카드) === */
.qw-result {
  background: var(--ink-1); color: #fff;
  border-radius: var(--radius-md);
  padding: 28px 24px;
  display: flex; flex-direction: column; gap: 18px;
  position: sticky; top: 80px;
}
.qw-result__empty {
  text-align: center; color: rgba(255,255,255,0.55);
  padding: 28px 8px;
}
.qw-result__empty i { font-size: 40px; color: rgba(255,255,255,0.3); }
.qw-result__empty p { margin: 14px 0 0; font-size: 13.5px; line-height: 1.6; }

.qw-result__head { display: flex; flex-direction: column; gap: 2px; }
.qw-result__brand {
  font-size: 11px; color: rgba(255,255,255,0.55); font-weight: 500;
  letter-spacing: 0.3px;
}
.qw-result__trim {
  font-size: 15px; font-weight: 700; color: #fff;
  letter-spacing: -0.2px; line-height: 1.4;
}

.qw-result__hero {
  background: rgba(255,255,255,0.06);
  border-radius: var(--radius-sm);
  padding: 18px 20px;
}
.qw-result__monthly-label {
  font-size: 11.5px; color: rgba(255,255,255,0.55); font-weight: 500;
  letter-spacing: 0.3px; margin-bottom: 6px;
}
.qw-result__monthly {
  font-size: 34px; font-weight: 800;
  letter-spacing: -0.04em; color: #fff;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.qw-result__monthly small {
  font-size: 14px; color: rgba(255,255,255,0.55); font-weight: 400;
  margin-left: 4px; letter-spacing: 0;
}

.qw-result__rows {
  display: flex; flex-direction: column; gap: 8px;
}
.qw-result__row {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 12.5px;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(255,255,255,0.1);
}
.qw-result__row:last-child { border-bottom: 0; }
.qw-result__row span { color: rgba(255,255,255,0.55); }
.qw-result__row b {
  color: #fff; font-weight: 600; font-variant-numeric: tabular-nums;
}
.qw-result__pill {
  background: rgba(13, 78, 139, 0.55); color: #fff;
  padding: 2px 10px; border-radius: var(--radius-pill);
  font-size: 11px; font-weight: 700; letter-spacing: 0.2px;
}

.qw-result__cond {
  font-size: 11px; color: rgba(255,255,255,0.4);
  line-height: 1.55;
}

.qw-result__cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: #fff; color: var(--ink-1);
  border: 0; border-radius: var(--radius-pill);
  padding: 14px 22px;
  font-size: 14px; font-weight: 700;
  font-family: inherit; cursor: pointer;
  transition: background var(--t-fast), transform var(--t-fast);
}
.qw-result__cta:hover { background: var(--brand-50); transform: translateY(-1px); }
.qw-result__cta i { font-size: 16px; }
</style>
