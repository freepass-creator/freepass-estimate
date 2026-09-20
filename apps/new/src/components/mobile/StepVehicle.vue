<script setup>
import { computed, ref, onMounted } from 'vue';
import { vehicleState, quoteState } from '../../store.js';
import { 담당자인가 } from '../../lib/role.js';
import { POPULAR_BRAND, POPULAR_MODELS, sortByRank } from '../../data/popular-rankings.js';
import { fmt, guessColor } from '../../lib/format.js';
import {
  requiredOptionIds,
  exclusiveGroupFor,
  conflictOptionIds,
  optionStatus,
  toggleOptionSelection,
  validateOptionSelection,
} from '../../lib/vehicle-option-rules.js';
import { resolveCanonicalIdentity } from '../../lib/newcar/configuration-resolver.js';
import { 브랜드공급가능, 모델공급가능, 변형공급가능, 트림공급가능 } from '../../lib/quote/provider-availability.js';

const props = defineProps({
  vehicles: { type: Array, default: () => [] },
});

const committingKey = ref('');
let committingTimer = null;
function commitDelayMs() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 0 : 160;
  } catch {
    return 160;
  }
}
function commitSelection(key, nextStep) {
  if (committingTimer) clearTimeout(committingTimer);
  committingKey.value = key;
  committingTimer = setTimeout(() => {
    committingKey.value = '';
    committingTimer = null;
    subStep.value = nextStep;
  }, commitDelayMs());
}

const BRAND_LOGOS = {
  hyundai:  '/hyundai.svg',
  kia:      '/kia.svg',
  genesis:  '/genesis.svg',
};

// 내장 색상 — lookups.js 와 동일 (PC 와 일치) + swatch 자동 계산
/* ★내장 색상 — «웰릭스 표»를 쓴다(차종별 이름 목록, 값은 0).
   우리 옛 표에는 「투톤 +50만」이 있었는데 웰릭스 견적기는 내장색에 값을 매기지 않는다
   (그쪽 commonInput 의 colorFee 는 «외장»만 본다). 값이 붙으면 조건이 어긋난다. */
const 내장색들 = computed(() => {
  const src = selectedTrim.value?._interior_colors?.length
    ? selectedTrim.value._interior_colors
    : (selectedModel.value?._interior || []);
  return src.map((c) => {
    const name = typeof c === 'string' ? c : (c?.name || c?.label || '');
    const price = typeof c === 'string' ? 0 : Number(c?._price_won ?? c?.price ?? 0);
    return { value: name, label: name, price, swatch: c?.hex || guessColor(name) };
  }).filter((c) => c.value);
});

const COLOR_INT_OLD = [
  { value: '블랙',   price: 0,      label: '블랙' },
  { value: '그레이', price: 0,      label: '그레이' },
  { value: '베이지', price: 0,      label: '베이지' },
  { value: '브라운', price: 0,      label: '브라운' },
  { value: '투톤',   price: 500000, label: '투톤' },
].map(c => ({ ...c, swatch: guessColor(c.value) }));

// SSOT — window.VEHICLE_DB (mobile.js 의 boot 가 wait 후 mount 하므로 set 되어있음)
const globalDB = computed(() => window.VEHICLE_DB);
const db = ref(window.VEHICLE_DB || null);
onMounted(() => {
  if (!db.value) db.value = window.VEHICLE_DB;
  // Legacy flow had a separate spec(passenger/drive) screen. It is now merged into powertrain.
  if (vehicleState.subStep === 'spec') vehicleState.subStep = 'variant';
  /* ★공유 링크로 들어온 경우 — 트림은 이미 정해져 있는데 «트림을 고를 때 도는 뒷일»
     (syncVehicle)이 안 돌아서 월 대여료가 «—» 로 남는다. 여기서 한 번 돌려 준다.
     손으로 고른 경우엔 selectTrim 이 이미 돌렸으므로 다시 돌아도 값이 같다. */
  if (vehicleState.trim) {
    if (!트림공급가능(selectedTrim.value)) {
      vehicleState.trim = null;
      vehicleState.trimGroup = null;
      vehicleState.options.clear();
      vehicleState.color = null;
      quoteState.vehicle = null;
      subStep.value = 변형공급가능(selectedVariant.value) ? 'trim' : 'variant';
    } else {
      syncVehicle();
    }
  }
});

// sub-step — vehicleState.subStep 에 저장 (MobileApp next() 와 통합)
const subStep = computed({
  get: () => vehicleState.subStep || 'brand',
  set: (v) => { vehicleState.subStep = v; },
});

// 제조사 — 판매량순
const brands = computed(() => {
  if (!db.value) return [];
  return sortByRank(db.value.manufacturers.filter((m) => 브랜드공급가능(m)), (m) => m.manufacturer_name, POPULAR_BRAND);
});

const selectedBrand = computed(() => {
  if (!db.value || !vehicleState.manufacturer) return null;
  return db.value.manufacturers.find(m => m.manufacturer_id === vehicleState.manufacturer);
});

// 모델 — 인기순
const models = computed(() => {
  if (!selectedBrand.value) return [];
  return sortByRank(
    selectedBrand.value.models.filter((m) => 모델공급가능(m)), (m) => m.model_name,
    POPULAR_MODELS[selectedBrand.value.manufacturer_name] || [],
  );
});

const selectedModel = computed(() => {
  if (!selectedBrand.value || !vehicleState.model) return null;
  return selectedBrand.value.models.find(m => m.model_id === vehicleState.model);
});

// 세부모델 — 운영 트림(operating !== false) 이 1개 이상 있는 variant 만 노출
// (vehicle-db.js 카탈로그는 PDF 전체, 실제 노출 차종은 trims 의 operating 플래그 + 엑셀 차량DB 매칭으로 결정)
const variants = computed(() => {
  const all = selectedModel.value?.variants || [];
  return all.filter((v) => 변형공급가능(v));
});

const selectedVariant = computed(() => {
  if (!selectedModel.value || !vehicleState.variant) return null;
  return selectedModel.value.variants.find(v => v.variant_id === vehicleState.variant);
});

/* 파워트레인 선택지는 엔진 + 필요 시 인승·구동·용도까지 한 카드에 합친다.
   내부 데이터는 variant + trimGroup 을 그대로 유지한다. 사용자는 한 번 고르고 바로 트림으로 간다.
   예: 가솔린 2.5 터보 · 7인승 · 4WD */
const powertrainChoices = computed(() => {
  const taxRate = vehicleState.tax_rate || '5';
  const out = [];

  for (const variant of variants.value) {
    const available = (variant.trims || []).filter((t) => 트림공급가능(t));
    const groups = new Map();

    for (const trim of available) {
      const group = trim._ui_powertrain_group || '';
      if (!groups.has(group)) groups.set(group, { group, count: 0, minPrice: Infinity, order: trim._groupOrder ?? 0 });
      const item = groups.get(group);
      item.count += 1;
      item.minPrice = Math.min(item.minPrice, trimPrice(trim, taxRate));
      item.order = Math.min(item.order, trim._groupOrder ?? item.order);
    }

    const grouped = [...groups.values()].sort((a, b) => a.order - b.order || a.minPrice - b.minPrice);
    if (!grouped.length) continue;

    for (const g of grouped) {
      const showGroup = !!g.group && g.group !== '일반';
      out.push({
        key: variant.variant_id + '::' + (g.group || '_'),
        variant,
        group: g.group || null,
        label: [variant.variant_name, showGroup ? g.group : ''].filter(Boolean).join(' · '),
        count: g.count,
        minPrice: g.minPrice,
      });
    }
  }
  return out;
});

const selectedPowertrainKey = computed(() =>
  vehicleState.variant ? vehicleState.variant + '::' + (vehicleState.trimGroup || '_') : ''
);

// 트림 — 파워트레인 카드에서 함께 선택한 인승·구동 묶음(vehicleState.trimGroup)으로 좁힌다
const trims = computed(() => {
  if (!selectedVariant.value) return [];
  const taxRate = vehicleState.tax_rate || '5';
  let list = [...(selectedVariant.value.trims || [])].filter((t) => 트림공급가능(t));
  if (vehicleState.trimGroup) list = list.filter(t => (t._ui_powertrain_group || '') === vehicleState.trimGroup);
  return list.sort((a, b) => (a._groupOrder ?? 0) - (b._groupOrder ?? 0) || trimPrice(a, taxRate) - trimPrice(b, taxRate));
});

const selectedTrim = computed(() => {
  if (!selectedVariant.value || !vehicleState.trim) return null;
  return selectedVariant.value.trims.find(t => t.trim_id === vehicleState.trim);
});

function trimPrice(t, taxRate) {
  return (taxRate === '3.5' ? t.base_price_3_5 : t.base_price_5) || 0;
}

// === 옵션 master / 배타 그룹 / 선행·제외 규칙 ===
const optionsMaster = computed(() => selectedVariant.value?.options_master || {});

function getGroup(optId) {
  return exclusiveGroupFor(selectedVariant.value, optId);
}
function getRequires(optId) {
  return requiredOptionIds(selectedVariant.value, vehicleState.trim, optId);
}
function getConflicts(optId) {
  return conflictOptionIds(selectedVariant.value, optId)
    .filter((id) => vehicleState.options.has(id));
}
function isEnabled(optId) {
  return optionStatus({
    variant: selectedVariant.value,
    trim: selectedTrim.value,
    optId,
    selected: vehicleState.options,
  }).enabled;
}
function optionNames(ids) {
  return (ids || []).map((id) => optionsMaster.value[id]?.name).filter(Boolean);
}

// trim 의 available_options
const availableOptions = computed(() => {
  if (!selectedTrim.value || !selectedTrim.value.available_options) return [];
  return selectedTrim.value.available_options
    .map(id => ({ id, ...(optionsMaster.value[id] || {}) }))
    .filter(o => o.name);
});

// 외장 색상 — FreePass 신차 상품마스터는 트림별 실제 색상 목록이 정본.
const exteriorColors = computed(() => selectedTrim.value?._exterior_colors?.length
  ? selectedTrim.value._exterior_colors
  : (selectedModel.value?.exterior_colors || []));

// 옵션 토글 — 규칙 엔진이 배타/제외/선행 종속을 원자적으로 정리한다.
function toggleOption(optId) {
  const result = toggleOptionSelection({
    variant: selectedVariant.value,
    trim: selectedTrim.value,
    optId,
    selected: vehicleState.options,
  });
  if (!result.changed) return;

  vehicleState.options.clear();
  result.next.forEach((id) => vehicleState.options.add(id));

  // fail-closed: UI 상태에 잘못된 조합이 남으면 견적 계산으로 보내지 않는다.
  const errors = validateOptionSelection({
    variant: selectedVariant.value,
    trim: selectedTrim.value,
    selected: vehicleState.options,
  });
  if (errors.length) {
    console.error('[FreePass option invariant]', errors);
    vehicleState.options.clear();
    return;
  }
  syncVehicle();
}

function pickExtColor(idx) {
  vehicleState.color = idx;
  syncVehicle();
}
function pickIntColor(c) {
  quoteState.cond.colorInt = c.value;
  quoteState.cond.colorIntPrice = c.price;
  syncVehicle();
}

// 가격 합산 — 트림 + 옵션 + 색상
const optionsPriceManwon = computed(() => {
  let p = 0;
  vehicleState.options.forEach(id => {
    const opt = optionsMaster.value[id];
    if (opt?.price) p += opt.price;
  });
  return p;
});
const exteriorColorPriceManwon = computed(() => {
  const c = vehicleState.color != null ? exteriorColors.value[vehicleState.color] : null;
  return Number(c?.price || 0);
});
const interiorColorPriceManwon = computed(() => Number(quoteState.cond.colorIntPrice || 0) / 10000);
const totalManwon = computed(() => {
  if (!selectedTrim.value) return 0;
  const taxRate = vehicleState.tax_rate || '5';
  return trimPrice(selectedTrim.value, taxRate)
    + optionsPriceManwon.value
    + exteriorColorPriceManwon.value
    + interiorColorPriceManwon.value;
});


function syncVehicle() {
  if (!selectedTrim.value || !트림공급가능(selectedTrim.value)) return;
  const t = selectedTrim.value;
  const taxRate = vehicleState.tax_rate || '5';
  const trimPriceManwon = trimPrice(t, taxRate);
  const colorExtName = (vehicleState.color != null && exteriorColors.value[vehicleState.color])
    ? exteriorColors.value[vehicleState.color].name : null;
  const optNames = [...vehicleState.options]
    .map(id => optionsMaster.value[id]?.name)
    .filter(Boolean);

  // vehicles.json 매칭 — 모델+연료 기반 (가격 매칭은 데이터 시점 차이로 불안정)
  const brandName = selectedBrand.value.manufacturer_name;
  const modelName = selectedModel.value.model_name;
  const fuelStr = selectedVariant.value?.fuel || '';
  const isHybrid = /하이브리드/.test(fuelStr);
  const targetModel = isHybrid ? modelName + ' Hybrid' : modelName;
  // 트림명 토큰 (예: "Premium" / "노블레스") 매칭
  const trimTokens = (t.name || '').split(/[\s·]/).filter(s => s.length >= 2);
  const vehicles = props.vehicles || [];
  let match = vehicles.find(v =>
    v.brand === brandName && v.model === targetModel &&
    trimTokens.every(tk => v.trim.toLowerCase().includes(tk.toLowerCase()))
  );
  // fallback 1 — brand + 정확 model 의 가장 가까운 가격
  if (!match) {
    const cands = vehicles.filter(v => v.brand === brandName && v.model === targetModel);
    if (cands.length) {
      const priceKrw = trimPriceManwon * 10000;
      match = cands.reduce((m, v) =>
        (!m || Math.abs(v.price - priceKrw) < Math.abs(m.price - priceKrw)) ? v : m, null);
    }
  }
  // fallback 2 — brand + model base 부분 매칭
  if (!match) {
    match = vehicles.find(v => v.brand === brandName && v.model.includes(modelName));
  }

  const selectedOptionIds = [...vehicleState.options];
  const canonical = resolveCanonicalIdentity(t, optionsMaster.value, selectedOptionIds);
  const can = canonical?.candidate || null;
  const canonicalSrc = can ? {
    brand: can.maker || brandName,
    model: can.model || modelName,
    trim: can.trim || t.name,
    disp: can.engine_cc || match?.disp,
    fuel: can.fuel || selectedVariant.value?.fuel || match?.fuel,
    multi_seat: can.seats && Number(can.seats) > 5 ? '다인승' : match?.multi_seat,
    r24: match?.r24, r36: match?.r36, r48: match?.r48, r60: match?.r60,
    strategic: match?.strategic,
    tax_exempt: match?.tax_exempt,
    group: match?.group,
  } : match;

  quoteState.vehicle = {
    brand: brandName,
    model: modelName,
    variant: selectedVariant.value?.variant_name || '',
    /* ★소제목(인승·구동·용도)을 트림 이름 앞에 붙인다 — 「익스클루시브」만으론 5인승인지 7인승인지 모른다 */
    trim_name: [t._ui_powertrain_group, t.name].filter(Boolean).join(' '),
    // 공통 quoteState 계약: total_manwon = 트림 + 옵션 + 외장색.
    // 내장색은 quoteState.cond.colorIntPrice 로 별도 보관한다(웹과 동일, 이중계상 방지).
    total_manwon: totalManwon.value - interiorColorPriceManwon.value,
    trim_price_manwon: trimPriceManwon,
    options_price_manwon: optionsPriceManwon.value,
    color_price_manwon: exteriorColorPriceManwon.value,
    options: optNames,
    colorExt: colorExtName,
    colorInt: quoteState.cond.colorInt || null,
    fuel: can?.fuel || selectedVariant.value?.fuel,
    displacement_cc: can?.engine_cc || selectedVariant.value?.displacement_cc || match?.disp,
    _product_id: t._canonical_product_id || t._product_id || t.trim_id,
    _trim_meta: t,
    _price_before_won: Number(t._price_before_won || 0),
    _price_after_won: Number(t._price_after_won || 0),
    _price_basis: t._price_basis || '',
    _base_axes: t._base_axes || {},
    _provider_candidates: t._provider_candidates || [],
    _canonical: canonical,
    _selected_options: selectedOptionIds.map(id => ({
      id,
      name: optionsMaster.value[id]?.name || id,
      price_won: Math.round(Number(optionsMaster.value[id]?.price || 0) * 10000),
    })),
    _src: canonicalSrc,
  };
}

function selectBrand(b) {
  vehicleState.manufacturer = b.manufacturer_id;
  vehicleState.model = null; vehicleState.variant = null; vehicleState.trim = null;
  vehicleState.options.clear(); vehicleState.color = null;
  quoteState.vehicle = null;
  commitSelection('brand:' + b.manufacturer_id, 'model');
}
function selectModel(m) {
  vehicleState.model = m.model_id;
  vehicleState.variant = null; vehicleState.trim = null;
  vehicleState.options.clear(); vehicleState.color = null;
  quoteState.vehicle = null;
  // 한 화면 한 선택: 선택 피드백을 짧게 보여 준 뒤 파워트레인으로 전진한다.
  commitSelection('model:' + m.model_id, 'variant');
}
function selectPowertrain(choice) {
  const v = choice.variant;
  vehicleState.variant = v.variant_id;
  vehicleState.trimGroup = choice.group;
  vehicleState.trim = null;
  vehicleState.options.clear();
  vehicleState.color = null;
  quoteState.vehicle = null;
  commitSelection('variant:' + choice.key, 'trim');
}
function selectTrim(t) {
  if (!트림공급가능(t)) return;
  vehicleState.trim = t.trim_id;
  vehicleState.options.clear();
  /* ★색은 «안 고른 채»로 둔다 — 웰릭스 견적기 기본이 「선택 안 함」이다.
     대표 2026-09-18 「아 우리도 외장색 기본으로 해」
     자동으로 골라 두면 그 색이 유료일 때(그랜저 세레니티 화이트 펄 +10만) 값이 벌어진다.
     고르고 싶은 사람은 색상 걸음에서 고르면 되고, 안 골라도 다음으로 넘어간다. */
  vehicleState.color = null;
  quoteState.cond.colorInt = '';
  quoteState.cond.colorIntPrice = 0;
  syncVehicle();

  // 한 화면 한 선택: 트림 선택 즉시 다음 구성 화면으로 이동한다.
  // 실제 제조사 색상이 있으면 색상 → 옵션 순서를 유지하고,
  // 색상 정보가 없는 상품만 옵션 화면으로 바로 간다.
  const 색상있음 = (t._exterior_colors?.length || t._interior_colors?.length);
  commitSelection('trim:' + t.trim_id, 색상있음 ? 'colors' : 'options');
}

function goBack(target) { subStep.value = target; }

const 담당자 = 담당자인가();   // ★손님이면 수수료 칸을 아예 안 그린다

// 시작 조건 — 제조사 화면에서 수수료/보증금/선납금 선입력 (StepConditions 와 동일 SSOT·클램프)
function onDepChange() {
  const v = Math.max(0, Math.min(30, +quoteState.cond.dep || 0));
  quoteState.cond.dep = v;
  (quoteState.scenarios || []).forEach(s => { s.dep = v; });
}
function onPreChange() {
  const v = Math.max(0, Math.min(30, +quoteState.cond.pre || 0));
  quoteState.cond.pre = v;
  (quoteState.scenarios || []).forEach(s => { s.pre = v; });
}
function onFeeChange() {
  const v = Math.max(-10, Math.min(7, Math.round((+quoteState.cond.feeRatePct || 0) * 10) / 10));
  quoteState.cond.feeRatePct = v;
}
</script>

<template>
  <div class="sv">
    <!-- breadcrumb — 텍스트만 결합 -->
    <div class="sv-crumbs" v-if="selectedBrand">
      <button class="sv-crumb" @click="goBack('brand')">
        <img v-if="BRAND_LOGOS[selectedBrand.manufacturer_id]" :src="BRAND_LOGOS[selectedBrand.manufacturer_id]" />
        <span>{{ selectedBrand.manufacturer_name }}</span>
      </button>
      <button v-if="selectedModel" class="sv-crumb" @click="goBack('model')">{{ selectedModel.model_name }}</button>
      <button v-if="selectedVariant" class="sv-crumb" @click="goBack('variant')">{{ [selectedVariant.variant_name, vehicleState.trimGroup].filter(Boolean).join(' · ') }}</button>
      <button v-if="selectedTrim" class="sv-crumb" @click="goBack('trim')">{{ [selectedTrim._ui_powertrain_group, selectedTrim.name].filter(Boolean).join(' ') }}</button>
    </div>

    <!-- 1) 제조사 -->
    <div v-if="subStep === 'brand'" class="sv-section">
      <h2 class="sv-title">어떤 제조사를<br>선택할까요?</h2>

      <!-- ★시작 조건(수수료·보증금·선납금) — «담당자만» 본다.
           대표 2026-09-17 「보증금 선납금도 그냥 없어. 제조사에 대해 그 어설픈 거 빼.
           그냥 누르고 누르고 누르고 하면 월 대여료가 얼마 나온다인 거야.
           보증금은 어차피 심사받아서 그거 해야 되니까」
           → 손님 화면은 첫 화면부터 «차만 고른다». 보증금 0 · 선납 0 · 수수료 7% 로 계산된다. -->
      <div class="sv-precond" v-if="담당자">
        <label class="sv-pc" v-if="담당자">
          <span class="sv-pc__lab">수수료</span>
          <span class="sv-pc__in">
            <input type="number" min="-10" max="7" step="0.1" inputmode="decimal"
                   v-model.number="quoteState.cond.feeRatePct" @change="onFeeChange" placeholder="0" />
            <em>%</em>
          </span>
        </label>
        <label class="sv-pc">
          <span class="sv-pc__lab">보증금</span>
          <span class="sv-pc__in">
            <input type="number" min="0" max="30" step="1" inputmode="numeric"
                   v-model.number="quoteState.cond.dep" @change="onDepChange" placeholder="0" />
            <em>%</em>
          </span>
        </label>
        <label class="sv-pc">
          <span class="sv-pc__lab">선납금</span>
          <span class="sv-pc__in">
            <input type="number" min="0" max="30" step="1" inputmode="numeric"
                   v-model.number="quoteState.cond.pre" @change="onPreChange" placeholder="0" />
            <em>%</em>
          </span>
        </label>
      </div>

      <div v-if="!db" class="sv-debug">
        차량 DB 로드 중... (window.VEHICLE_DB: {{ typeof globalDB }})
      </div>
      <div v-else-if="!brands.length" class="sv-debug">
        제조사 0개 — manufacturers: {{ (db.manufacturers || []).length }}
      </div>
      <div class="sv-brand-grid">
        <button
          v-for="b in brands" :key="b.manufacturer_id"
          class="sv-brand-card ui-card"
          :class="{ 'is-selected': vehicleState.manufacturer === b.manufacturer_id, 'is-committing': committingKey === 'brand:' + b.manufacturer_id }"
          :disabled="!!committingKey"
          @click="selectBrand(b)"
        >
          <img v-if="BRAND_LOGOS[b.manufacturer_id]" :src="BRAND_LOGOS[b.manufacturer_id]" :alt="b.manufacturer_name" />
          <span class="sv-brand-card__name">{{ b.manufacturer_name }}</span>
        </button>
      </div>
    </div>

    <!-- 2) 모델 -->
    <div v-else-if="subStep === 'model'" class="sv-section">
      <h2 class="sv-title">{{ selectedBrand.manufacturer_name }} 에서<br>어떤 모델로 갈까요?</h2>
      <div class="sv-list">
        <button
          v-for="m in models" :key="m.model_id"
          class="sv-row ui-card"
          :class="{ 'is-selected': vehicleState.model === m.model_id, 'is-committing': committingKey === 'model:' + m.model_id }"
          :disabled="!!committingKey"
          @click="selectModel(m)"
        >
          <span class="sv-row__label">{{ m.model_name }}</span>
          <i class="ph ph-caret-right sv-row__chev"></i>
        </button>
      </div>
    </div>

    <!-- 3) 파워트레인 — 엔진·인승·구동을 한 선택지로 -->
    <div v-else-if="subStep === 'variant'" class="sv-section">
      <h2 class="sv-title">{{ selectedModel.model_name }}<br>파워트레인을 골라주세요</h2>
      <div class="sv-list">
        <button
          v-for="p in powertrainChoices" :key="p.key"
          class="sv-row ui-card"
          :class="{ 'is-selected': selectedPowertrainKey === p.key, 'is-committing': committingKey === 'variant:' + p.key }"
          :disabled="!!committingKey"
          @click="selectPowertrain(p)"
        >
          <span class="sv-row__label">{{ p.label }}
            <small class="sv-row__hint">{{ p.count }}개 트림 · {{ fmt(p.minPrice * 10000) }}원~</small>
          </span>
          <i class="ph ph-caret-right sv-row__chev"></i>
        </button>
      </div>
    </div>

    <!-- 4) 트림 -->
    <div v-else-if="subStep === 'trim'" class="sv-section">
      <h2 class="sv-title">{{ [selectedVariant?.variant_name, vehicleState.trimGroup].filter(Boolean).join(' · ') }}<br>세부 트림을 골라주세요</h2>
      <div class="sv-list">
        <template v-for="(t, i) in trims" :key="t.trim_id">
        <button
          class="sv-trim-card ui-card"
          :class="{ 'is-selected': vehicleState.trim === t.trim_id, 'is-committing': committingKey === 'trim:' + t.trim_id }"
          :disabled="!!committingKey"
          @click="selectTrim(t)"
        >
          <div class="sv-trim-card__top">
            <span class="sv-trim-card__name">{{ t.name }}</span>
            <i class="ph ph-check sv-trim-card__check" v-if="vehicleState.trim === t.trim_id"></i>
          </div>
          <div class="sv-trim-card__price">{{ fmt(trimPrice(t, vehicleState.tax_rate || '5') * 10000) }}원</div>
        </button>
        </template>
      </div>

      <!-- 트림 선택 후 — 할인 (접힘, 클릭하면 열림) -->
      <!-- ★할인은 «담당자만» — 손님이 금액을 적어 월 렌트료를 낮출 수 있었다 (대표 2026-09-18) -->
      <details v-if="selectedTrim && 담당자" class="sv-disclosure" :open="(quoteState.cond.discount || 0) > 0">
        <summary class="sv-disclosure__summary">
          <span class="sv-disclosure__label">추가 할인</span>
          <span v-if="quoteState.cond.discount" class="sv-disclosure__val">−{{ fmt(quoteState.cond.discount) }}만원</span>
          <span v-else class="sv-disclosure__hint">재고차·특별조건</span>
          <i class="ph ph-caret-down sv-disclosure__caret"></i>
        </summary>
        <div class="sv-discount">
          <input
            type="number" min="0" step="10" inputmode="numeric"
            v-model.number="quoteState.cond.discount"
            placeholder="0"
            class="sv-discount__input"
          />
          <span class="sv-discount__unit">만원</span>
        </div>
      </details>
      <div v-if="selectedTrim" class="sv-total">
        <div class="sv-total__row">
          <span>트림</span>
          <span>{{ fmt(trimPrice(selectedTrim, vehicleState.tax_rate || '5')) }}만원</span>
        </div>
        <div class="sv-total__row" v-if="quoteState.cond.discount">
          <span>할인</span>
          <span>−{{ fmt(quoteState.cond.discount) }}만원</span>
        </div>
        <div class="sv-total__row sv-total__row--total">
          <span>총 차량가격</span>
          <span>{{ fmt((trimPrice(selectedTrim, vehicleState.tax_rate || '5') - (quoteState.cond.discount || 0)) * 10000) }}원</span>
        </div>
      </div>
    </div>

    <!-- 5) 옵션 -->
    <div v-else-if="subStep === 'options'" class="sv-section">
      <h2 class="sv-title">옵션을<br>선택해 주세요</h2>

      <div v-if="!availableOptions.length" class="sv-empty">선택 가능한 옵션이 없습니다.</div>
      <div v-else class="sv-opts">
        <button
          v-for="o in availableOptions" :key="o.id"
          class="sv-opt ui-card"
          :class="{
            'is-selected': vehicleState.options.has(o.id),
            'is-disabled': !isEnabled(o.id) && !vehicleState.options.has(o.id),
          }"
          :aria-pressed="vehicleState.options.has(o.id)"
          :disabled="!isEnabled(o.id) && !vehicleState.options.has(o.id)"
          @click="toggleOption(o.id)"
        >
          <div class="sv-opt__top">
            <span class="sv-opt__name">{{ o.name }}</span>
            <span class="sv-opt__price">+{{ fmt(o.price) }}만</span>
          </div>
          <div class="sv-opt__axis" v-if="o._main_axis">차량 구성 옵션</div>
          <div class="sv-opt__sub" v-if="o.sub">{{ o.sub }}</div>
          <div class="sv-opt__group" v-if="getGroup(o.id)">
            <i class="ph ph-info"></i>
            {{ getGroup(o.id).label }} 중 1개만 선택
          </div>
          <div class="sv-opt__req" v-if="!isEnabled(o.id) && !vehicleState.options.has(o.id) && getRequires(o.id).length">
            <i class="ph ph-warning"></i>
            먼저 선택: {{ optionNames(getRequires(o.id)).join(', ') }}
          </div>
          <div class="sv-opt__replace" v-if="!vehicleState.options.has(o.id) && getConflicts(o.id).length">
            <i class="ph ph-arrows-left-right"></i>
            선택 시 해제: {{ optionNames(getConflicts(o.id)).join(', ') }}
          </div>
        </button>
      </div>

      <div class="sv-total">
        <div class="sv-total__row">
          <span>트림</span>
          <span>{{ fmt(trimPrice(selectedTrim, vehicleState.tax_rate || '5')) }}만원</span>
        </div>
        <div class="sv-total__row" v-if="optionsPriceManwon">
          <span>옵션</span>
          <span>+{{ fmt(optionsPriceManwon) }}만원</span>
        </div>
        <div class="sv-total__row sv-total__row--total">
          <span>총 차량가격</span>
          <span>{{ fmt(totalManwon * 10000) }}원</span>
        </div>
      </div>
    </div>

    <!-- 6) 색상 (외장 + 내장) -->
    <div v-else-if="subStep === 'colors'" class="sv-section">
      <h2 class="sv-title">색상을<br>골라주세요</h2>

      <!-- 외장 색상 -->
      <div v-if="exteriorColors.length" class="sv-block">
        <div class="sv-block__label">
          외장 색상
          <span class="sv-block__hint">{{ exteriorColors[vehicleState.color]?.name || '미선택' }}</span>
        </div>
        <div class="sv-color-grid">
          <button
            v-for="(c, i) in exteriorColors" :key="i"
            class="sv-color-card ui-card"
            :class="{ 'is-selected': vehicleState.color === i }"
            :title="c.name"
            @click="pickExtColor(i)"
          >
            <span class="sv-color-swatch" :style="{ background: c.hex }"></span>
            <span class="sv-color-name">{{ c.name }}</span>
            <span class="sv-color-price" v-if="c.price">+{{ fmt(c.price * 10000) }}원</span>
            <i class="ph ph-check sv-color-check" v-if="vehicleState.color === i"></i>
          </button>
        </div>
      </div>

      <!-- 내장 색상 -->
      <div class="sv-block">
        <div class="sv-block__label">
          내장 색상
          <span class="sv-block__hint">{{ quoteState.cond.colorInt || '미선택' }}</span>
        </div>
        <div class="sv-color-grid">
          <button
            v-for="c in 내장색들" :key="c.value"
            class="sv-color-card ui-card"
            :class="{ 'is-selected': quoteState.cond.colorInt === c.value }"
            @click="pickIntColor(c)"
          >
            <span class="sv-color-swatch" :style="{ background: c.swatch }"></span>
            <span class="sv-color-name">{{ c.label }}</span>
            <span class="sv-color-price" v-if="c.price">+{{ fmt(c.price) }}원</span>
            <i class="ph ph-check sv-color-check" v-if="quoteState.cond.colorInt === c.value"></i>
          </button>
        </div>
      </div>

      <!-- 추가 할인 — 접힘 (재고차/특별조건) -->
      <details v-if="담당자" class="sv-disclosure" :open="(quoteState.cond.discount || 0) > 0">
        <summary class="sv-disclosure__summary">
          <span class="sv-disclosure__label">추가 할인</span>
          <span v-if="quoteState.cond.discount" class="sv-disclosure__val">−{{ fmt(quoteState.cond.discount) }}만원</span>
          <span v-else class="sv-disclosure__hint">재고차·특별조건</span>
          <i class="ph ph-caret-down sv-disclosure__caret"></i>
        </summary>
        <div class="sv-discount">
          <input
            type="number" min="0" step="10" inputmode="numeric"
            v-model.number="quoteState.cond.discount"
            placeholder="0"
            class="sv-discount__input"
          />
          <span class="sv-discount__unit">만원</span>
        </div>
      </details>

      <!-- 최종 차량가격 (할인 반영) -->
      <div class="sv-total">
        <div class="sv-total__row">
          <span>트림</span>
          <span>{{ fmt(trimPrice(selectedTrim, vehicleState.tax_rate || '5')) }}만원</span>
        </div>
        <div class="sv-total__row" v-if="optionsPriceManwon">
          <span>옵션</span>
          <span>+{{ fmt(optionsPriceManwon) }}만원</span>
        </div>
        <div class="sv-total__row" v-if="quoteState.cond.discount">
          <span>할인</span>
          <span>−{{ fmt(quoteState.cond.discount) }}만원</span>
        </div>
        <div class="sv-total__row sv-total__row--total">
          <span>총 차량가격</span>
          <span>{{ fmt((totalManwon - (quoteState.cond.discount || 0)) * 10000) }}원</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sv { padding-top: 4px; }
.sv-title {
  font-size: var(--fs-2xl); font-weight: var(--fw-bold);
  color: var(--ink-1); margin: 0 0 24px;
  line-height: 1.35; letter-spacing: -0.5px;
  text-align: left;
}

/* breadcrumb */
.sv-crumbs {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-bottom: 18px;
}
.sv-crumb {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 0 2px; min-height: 32px; border: 0; background: transparent;
  color: var(--ink-2); font-weight: var(--fw-medium);
  font-family: inherit; font-size: var(--fs-sm);
  cursor: pointer;
  letter-spacing: -0.2px;
}
.sv-crumb img { width: 14px; height: 14px; }
.sv-crumb:active { color: var(--brand); }

/* 시작 조건 — 수수료·보증금·선납금 3-up */
.sv-precond {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  margin-bottom: 20px;
}
.sv-pc { display: flex; flex-direction: column; gap: 6px; }
.sv-pc__lab {
  font-size: var(--fs-sm); font-weight: var(--fw-semi); color: var(--ink-2);
  letter-spacing: -0.2px;
}
.sv-pc__in {
  display: flex; align-items: baseline; gap: 3px;
  height: var(--h-input);
  padding: 0 10px;
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: var(--r-md);
  transition: border-color .12s;
}
.sv-pc__in:focus-within { border-color: var(--brand); }
.sv-pc__in input {
  flex: 1; min-width: 0; height: 100%;
  border: 0; background: transparent;
  font-family: inherit; font-size: var(--fs-lg);
  color: var(--ink-1); outline: none;
  font-variant-numeric: tabular-nums;
  text-align: right; padding: 0;
  -moz-appearance: textfield;
}
.sv-pc__in input::-webkit-outer-spin-button,
.sv-pc__in input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.sv-pc__in em {
  font-style: normal; font-size: var(--fs-md);
  color: var(--ink-4); flex-shrink: 0;
}

/* 제조사 카드 */
.sv-brand-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.sv-brand-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 22px 8px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-card);
  font-family: inherit; cursor: pointer;
  transition: transform .12s, background .12s;
}
.sv-brand-card img { width: 38px; height: 38px; object-fit: contain; }
.sv-brand-card img[src*="genesis"] { width: auto; height: 18px; max-width: 70px; }
.sv-brand-card__name { font-size: var(--fs-md); font-weight: var(--fw-semi); color: var(--ink-1); }
.sv-brand-card:active { transform: scale(0.97); }
.sv-brand-card.is-selected { background: var(--brand-50); }
.sv-brand-card.is-selected .sv-brand-card__name { color: var(--brand); font-weight: var(--fw-bold); }

.sv-debug {
  padding: 12px 14px;
  background: #fff8e1;
  border: 1px solid #f4d35e;
  border-radius: var(--r-md);
  font-size: var(--fs-sm); color: #936916;
  margin-bottom: 12px;
}

/* 리스트 */
.sv-list { display: flex; flex-direction: column; gap: 8px; }
.sv-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: var(--sp-4);
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-card);
  font-family: inherit; cursor: pointer;
  text-align: left;
  transition: background .12s;
}
.sv-row__label {
  flex: 1; min-width: 0;
  font-size: var(--fs-lg); font-weight: var(--fw-medium); color: var(--ink-1); letter-spacing: -0.3px;
  text-align: left;
}
.sv-row__hint { display: block; margin-top: 3px; font-size: var(--fs-sm); font-weight: var(--fw-regular); color: var(--ink-4); text-align: left; }
.sv-row__chev { font-size: 18px; color: var(--ink-4); }
.sv-row:active { background: var(--brand-50); }
.sv-row.is-selected { background: var(--brand-50); }
.sv-row.is-selected .sv-row__label { color: var(--brand); font-weight: var(--fw-bold); }

/* 트림 카드 */
.sv-trim-card {
  display: flex; flex-direction: column; gap: 6px;
  padding: 16px;
  background: var(--bg-soft);
  border: 0;
  border-radius: 12px;
  text-align: left;
  font-family: inherit; cursor: pointer;
}
.sv-trim-card__top { display: flex; align-items: center; justify-content: space-between; }
.sv-trim-card__name { font-size: var(--fs-lg); font-weight: var(--fw-semi); color: var(--ink-1); letter-spacing: -0.3px; }
.sv-trim-card__check { font-size: 20px; color: var(--brand); font-weight: 700; }
.sv-trim-card__price {
  font-size: var(--fs-lg); font-weight: var(--fw-semi); color: var(--ink-2);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.sv-trim-card:active { background: var(--brand-50); }
.sv-trim-card.is-selected { background: var(--brand-50); }
.sv-trim-card.is-selected .sv-trim-card__name { color: var(--brand); font-weight: var(--fw-bold); }
.sv-trim-card.is-selected .sv-trim-card__price { color: var(--brand); font-weight: var(--fw-bold); }
/* 레거시 group label 스타일 — 현재 고객 flow에서는 파워트레인 카드에 합쳐 표시한다. */
.sv-group {
  margin: 14px 2px 2px; font-size: var(--fs-md); font-weight: var(--fw-bold);
  color: var(--ink-3); letter-spacing: -0.2px;
  text-align: left;
}
.sv-group:first-child { margin-top: 0; }

/* 옵션·색상 sub-step */
.sv-block { margin-bottom: 22px; }
.sv-block__label {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: var(--fs-md); font-weight: var(--fw-semi); color: var(--ink-2);
  margin-bottom: 10px; letter-spacing: -0.2px;
}
.sv-block__hint { font-size: var(--fs-sm); color: var(--ink-3); font-weight: var(--fw-regular); }
.sv-block__val {
  font-size: var(--fs-md); color: var(--brand); font-weight: var(--fw-bold);
  font-variant-numeric: tabular-nums;
}

/* 색상 grid — 외장/내장 공통 (swatch + 이름 + 가격) */
.sv-color-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.sv-color-card {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 6px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-card);
  font-family: inherit; cursor: pointer;
  transition: background .12s;
}
.sv-color-swatch {
  width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.12);
  box-shadow: inset 0 0 0 2px #fff;
}
.sv-color-name {
  font-size: var(--fs-sm); color: var(--ink-2); text-align: center;
  line-height: 1.2; word-break: keep-all;
}
.sv-color-card.is-selected .sv-color-name { color: var(--brand); font-weight: 600; }
.sv-color-price {
  font-size: var(--fs-xs); color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}
.sv-color-card.is-selected { background: var(--brand-50); }
.sv-color-check {
  position: absolute; top: 6px; right: 8px;
  font-size: 14px; color: var(--brand); font-weight: 700;
}

.sv-empty {
  padding: 18px; text-align: center;
  background: var(--bg-soft);
  border-radius: var(--r-md);
  color: var(--ink-4); font-size: var(--fs-md);
}

/* 할인 — 접힘 disclosure */
.sv-disclosure {
  margin-top: 18px;
  background: var(--bg-soft);
  border-radius: var(--r-md);
  padding: 12px 14px;
}
.sv-disclosure__summary {
  display: flex; align-items: center; gap: 8px;
  list-style: none;
  cursor: pointer;
  user-select: none;
}
.sv-disclosure__summary::-webkit-details-marker { display: none; }
.sv-disclosure__label {
  font-size: var(--fs-base); font-weight: var(--fw-semi); color: var(--ink-1);
}
.sv-disclosure__val {
  font-size: var(--fs-md); color: var(--brand); font-weight: var(--fw-bold);
  font-variant-numeric: tabular-nums;
}
.sv-disclosure__hint {
  font-size: var(--fs-sm); color: var(--ink-4);
}
.sv-disclosure__caret {
  margin-left: auto;
  font-size: 16px; color: var(--ink-3);
  transition: transform .15s;
}
.sv-disclosure[open] .sv-disclosure__caret { transform: rotate(180deg); }
.sv-disclosure[open] .sv-discount { margin-top: 10px; }

/* 할인 입력 */
.sv-discount {
  display: flex; align-items: center; gap: 6px;
  height: var(--h-input);
  padding: 0 14px;
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: var(--r-md);
}
.sv-discount:focus-within { border-color: var(--brand); }
.sv-discount__input {
  flex: 1; min-width: 0;
  height: 100%;
  border: 0; background: transparent;
  font-family: inherit; font-size: var(--fs-lg);
  color: var(--ink-1);
  outline: none;
  font-variant-numeric: tabular-nums;
  text-align: right;
  -moz-appearance: textfield;
}
.sv-discount__input::-webkit-outer-spin-button,
.sv-discount__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.sv-discount__unit { font-size: var(--fs-md); color: var(--ink-4); font-weight: var(--fw-medium); }
.sv-block__val { font-size: var(--fs-md); color: var(--brand); font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }

/* 옵션 카드 */
.sv-opts { display: flex; flex-direction: column; gap: 8px; }
.sv-opt {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 14px;
  background: var(--bg-soft);
  border: 0;
  border-radius: var(--r-md);
  text-align: left;
  font-family: inherit; cursor: pointer;
  transition: background .12s, border-color .12s, opacity .12s;
}
.sv-opt__top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.sv-opt__name { font-size: var(--fs-base); font-weight: var(--fw-semi); color: var(--ink-1); }
.sv-opt__price {
  font-size: var(--fs-md); font-weight: var(--fw-semi); color: var(--ink-2);
  font-variant-numeric: tabular-nums; flex-shrink: 0;
  text-align: right;
}
.sv-opt__axis {
  align-self: flex-start;
  margin-top: 1px;
  padding: 2px 6px;
  border-radius: var(--r-sm);
  background: var(--brand-50);
  color: var(--brand);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semi);
  line-height: 1.35;
}
.sv-opt__sub { font-size: var(--fs-sm); color: var(--ink-3); line-height: 1.4; }
.sv-opt__group {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: var(--fs-xs); color: var(--ink-4); margin-top: 2px;
}
.sv-opt__group i { font-size: 12px; }
.sv-opt__req {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: var(--fs-xs); color: #c62828; margin-top: 2px;
}
.sv-opt__replace {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: var(--fs-xs); color: var(--ink-3); margin-top: 2px;
}
.sv-opt:active { background: var(--brand-50); }
.sv-opt.is-selected {
  background: var(--brand-50);
}
.sv-opt.is-selected .sv-opt__name { color: var(--brand); font-weight: var(--fw-bold); }
.sv-opt.is-selected .sv-opt__price { color: var(--brand); font-weight: var(--fw-bold); }
.sv-opt.is-disabled {
  opacity: 0.55; cursor: not-allowed;
}

/* 가격 합산 카드 */
.sv-total {
  margin-top: 28px;
  padding: 14px 16px;
  background: var(--brand-50);
  border-radius: 12px;
}
.sv-total__row {
  display: flex; justify-content: space-between;
  font-size: var(--fs-md); color: var(--ink-2);
  font-variant-numeric: tabular-nums;
  padding: 3px 0;
}
.sv-total__row--total {
  border-top: 1px solid var(--brand-100);
  margin-top: 6px; padding-top: 8px;
  font-size: var(--fs-lg); color: var(--brand); font-weight: var(--fw-bold);
}
</style>

<style scoped>
.sv-brand-card.is-committing,
.sv-row.is-committing,
.sv-trim-card.is-committing {
  background: var(--brand-50);
  transform: scale(.985);
  box-shadow: inset 0 0 0 1px var(--brand-100);
}
.sv-brand-card:disabled,
.sv-row:disabled,
.sv-trim-card:disabled {
  cursor: default;
}
.sv-brand-card:disabled:not(.is-committing),
.sv-row:disabled:not(.is-committing),
.sv-trim-card:disabled:not(.is-committing) {
  opacity: .72;
}


/* Canonical card headline alignment — model / powertrain / trim.
   Headline text owns the left/start edge; only affordances and numeric values go right. */
.sv-row {
  justify-content: flex-start;
  text-align: left;
}
.sv-row__label {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  margin-right: auto;
  text-align: left;
  font-weight: var(--fw-semi);
}
.sv-row__hint {
  width: 100%;
  text-align: left;
}
.sv-row__chev {
  flex: 0 0 auto;
  margin-left: auto;
}
.sv-trim-card {
  align-items: stretch;
  text-align: left;
}
.sv-trim-card__top {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
}
.sv-trim-card__name {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  margin-right: auto;
  text-align: left;
}
.sv-trim-card__check {
  flex: 0 0 auto;
  margin-left: auto;
}
.sv-trim-card__price {
  align-self: stretch;
  text-align: right;
}
</style>
