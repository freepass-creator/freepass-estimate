<script setup>
// 웰릭스 표준 가격표 — 제조사별 전 차종 × 36/48/60 월 대여료
// 표준 조건: 중신용 / 보증금 10% / 선납 0% / 2만km / 자동차보험 1억 기본
// 선택된 행만 PDF (브라우저 인쇄→PDF 저장) 로 출력
import { ref, computed } from 'vue';
import { quoteState } from '../store.js';
import { calcQuote } from '../lib/calc.js';
import { fmt, fmtTel } from '../lib/format.js';
import { buildStandardPriceHtml, STANDARD_PRICE_CSS } from '../lib/build-standard-price-html.js';

const BRANDS = ['현대', '기아', '제네시스'];
const STANDARD_TERMS = [36, 48, 60];
const STD = {
  credit: '중신용',
  km: '2만km',
  dep: 10,
  pre: 0,
  insProperty: '1억',
  extraDriver: '없음',
  feeRatePct: 5.0,
  svc: '웰스 Basic',
};

const open = ref(false);
const vehicles = ref([]);
const selectedBrand = ref('현대');   // 카스케이드: 제조사
const selectedModel = ref('');       // 카스케이드: 모델 (빈값 = 전체)
const loading = ref(false);
const errorMsg = ref('');

async function loadVehicles() {
  if (vehicles.value.length) return;
  loading.value = true;
  try {
    const r = await fetch('./data/vehicles.json?t=' + Date.now());
    const data = await r.json();
    vehicles.value = data;
  } catch (e) {
    errorMsg.value = '차량 데이터 로드 실패: ' + (e?.message || e);
  } finally {
    loading.value = false;
  }
}

function openPanel() {
  open.value = true;
  loadVehicles();
}
function closePanel() { open.value = false; }

// 상단바 버튼이 외부에서 열도록
if (typeof window !== 'undefined') {
  window.__welrix_openStandardPriceTable = openPanel;
}

// 브랜드 별 모델 목록 (드롭다운용) — 중복 제거, 등장 순서 유지
const modelsInBrand = computed(() => {
  const seen = new Set();
  const out = [];
  for (const v of vehicles.value) {
    if (v.brand !== selectedBrand.value) continue;
    if (seen.has(v.model)) continue;
    seen.add(v.model);
    out.push(v.model);
  }
  return out;
});

// 필터된 행 (제조사 + 모델). 모델 비어있으면 브랜드 전체.
const filteredRows = computed(() => {
  return vehicles.value
    .map((v, idx) => ({ idx, ...v }))
    .filter(v => v.brand === selectedBrand.value)
    .filter(v => !selectedModel.value || v.model === selectedModel.value);
});

// 표준 견적 계산 — STANDARD_TERMS(36/48/60) 각각 calcQuote (기존 로직 유지)
// monthlies: 화면 표시용 숫자 배열, quoteTerms: 견적서 빌더용 상세(월대여료/만기인수/잔가율)
function calcForRow(v) {
  const quoteTerms = STANDARD_TERMS.map((term, idx) => {
    try {
      const r = calcQuote({
        vehicle: v,
        options: { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
        contract: { term, km: STD.km, dep: STD.dep, pre: STD.pre },
        customer: { creditGrade: STD.credit },
        insurance: {
          property: STD.insProperty, extraDriver: STD.extraDriver,
          exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
          deductible: '30만원~', emergency: '가입',
        },
        fees: { feeRatePct: STD.feeRatePct, svc: STD.svc },
      });
      return { idx, term, dep: STD.dep, pre: STD.pre, monthly: r.monthly, residualAmt: r.residualAmt, residualPct: r.residualPct };
    } catch {
      return { idx, term, dep: STD.dep, pre: STD.pre, monthly: null, residualAmt: 0, residualPct: 0 };
    }
  });
  return { monthlies: quoteTerms.map(t => t.monthly), quoteTerms };
}

const computedRows = computed(() => {
  return filteredRows.value.map(v => {
    const { monthlies, quoteTerms } = calcForRow(v);
    return { ...v, monthlies, quoteTerms };
  });
});

// === 체크박스 다중 선택 — vehicles.json 의 idx 를 키로 사용(필터 무관 유지) ===
const selectedIdx = ref(new Set());
const selectedCount = computed(() => selectedIdx.value.size);

function isSelected(idx) { return selectedIdx.value.has(idx); }
function toggleRow(idx) {
  const s = new Set(selectedIdx.value);
  if (s.has(idx)) s.delete(idx); else s.add(idx);
  selectedIdx.value = s;
}
// 현재 화면(필터된 행) 전체 선택 여부
const allCurrentSelected = computed(() =>
  computedRows.value.length > 0 && computedRows.value.every(r => selectedIdx.value.has(r.idx))
);
function toggleSelectAll() {
  const s = new Set(selectedIdx.value);
  if (allCurrentSelected.value) {
    computedRows.value.forEach(r => s.delete(r.idx));
  } else {
    computedRows.value.forEach(r => s.add(r.idx));
  }
  selectedIdx.value = s;
}
function clearSelection() { selectedIdx.value = new Set(); }

// 선택된 트림 → 가격표 행 배열 (필터와 무관하게 전체에서 수집, vehicles.json 순서 유지)
function buildSelectedRows() {
  const out = [];
  vehicles.value.forEach((v, idx) => {
    if (!selectedIdx.value.has(idx)) return;
    const { monthlies } = calcForRow(v);
    out.push({
      brand: v.brand,
      model: v.model,
      trim: v.trim,
      price: v.price,
      monthlies,   // [m36, m48, m60]
    });
  });
  return out;
}

function selectBrand(b) {
  selectedBrand.value = b;
  selectedModel.value = '';  // 브랜드 바꾸면 모델 리셋
}

// 담당자 연락처 — 입력 시 자동 하이픈 (store.js watch 가 localStorage 영속)
function onStaffTel(e) {
  const v = fmtTel(e.target.value);
  quoteState.staff.tel = v;
  if (e.target.value !== v) e.target.value = v;
}

// 가격표 빌더가 쓰는 CSS 변수 — index.html :root 와 동일 값 (새 탭/오프스크린용)
const QUOTE_DOC_VARS = `
  :root {
    --brand: #0D4E8B; --brand-700: #0a3d6e; --brand-100: #cfdce7; --brand-50: #eef4fa;
    --ink-1: #0a0a0a; --ink-2: #404040; --ink-3: #737373; --ink-4: #a3a3a3;
    --line: #f0f0f0; --line-2: #e5e5e5; --line-3: #d8d8d8;
    --bg: #ffffff; --bg-soft: #fafafa; --bg-muted: #f5f5f5;
  }`;

// 오늘 날짜 (가격표 기준일)
function todayStr() {
  return new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\.\s/g, '.').replace(/\.$/, '');
}

// 선택된 트림으로 표준 가격표 본문 HTML 생성
function buildSelectedQuoteBody() {
  const rows = buildSelectedRows();
  if (!rows.length) return '';
  const cfg = (typeof window !== 'undefined' && window.__welrix_companyConfig) || {};
  return buildStandardPriceHtml({
    rows,
    cond: { credit: STD.credit, km: parseInt(STD.km, 10) || 2, dep: STD.dep, pre: STD.pre, insProperty: STD.insProperty, svc: STD.svc },
    staff: { name: quoteState.staff.name, tel: quoteState.staff.tel },
    companyConfig: cfg,
    showLogo: true,
    dateStr: todayStr(),
  });
}

// 새 탭/인쇄용 전체 HTML 문서 (가격표 양식 + 변수 + 전용 CSS)
async function buildQuoteDocHtml() {
  const body = buildSelectedQuoteBody();
  if (!body) return '';
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>웰릭스 표준 가격표</title>
<style>
  ${QUOTE_DOC_VARS}
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px 0; background: #f4f5f7;
         font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif; }
  ${STANDARD_PRICE_CSS}
  @media print { body { background: #fff; padding: 0; } }
</style></head>
<body>${body}</body></html>`;
}

async function downloadPdf() {
  const html = await buildQuoteDocHtml();
  if (!html) { alert('선택된 차종이 없습니다'); return; }
  const win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단됐어요. 브라우저 팝업 차단 해제 후 다시 시도'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => setTimeout(() => win.print(), 150));
}

// 미리보기 — 새 탭으로 견적서만 표시 (자동 인쇄 안 함)
async function openPreview() {
  const html = await buildQuoteDocHtml();
  if (!html) { alert('선택된 차종이 없습니다'); return; }
  const win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단됐어요'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// 이미지 복사 — 오프스크린에 견적서 렌더 → html2canvas 캡쳐 → clipboard
const copyingImage = ref(false);
async function copyAsImage() {
  if (copyingImage.value) return;
  const body = buildSelectedQuoteBody();
  if (!body) { alert('선택된 차종이 없습니다'); return; }
  if (!window.html2canvas) { alert('이미지 캡쳐 라이브러리 로드 실패'); return; }
  copyingImage.value = true;
  let host = null;
  try {
    // 오프스크린 컨테이너 — 가격표 폭(760px) 으로 렌더 후 캡쳐
    host = document.createElement('div');
    host.style.cssText = 'position:fixed; left:-9999px; top:0; width:800px; background:#fff;';
    const styleEl = document.createElement('style');
    styleEl.textContent = QUOTE_DOC_VARS + '\n' + STANDARD_PRICE_CSS;
    host.appendChild(styleEl);
    const wrap = document.createElement('div');
    wrap.innerHTML = body;
    host.appendChild(wrap);
    document.body.appendChild(host);
    const target = host.querySelector('.spq-doc') || wrap;
    const canvas = await window.html2canvas(target, { scale: 2, backgroundColor: '#fff', useCORS: true });
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      alert('이미지 복사 완료 — 카톡·메일에 붙여넣기 하세요');
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `welrix-견적서-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (e) {
    alert('이미지 복사 실패: ' + (e?.message || e));
  } finally {
    if (host) document.body.removeChild(host);
    copyingImage.value = false;
  }
}

// 제조사 공식 가격표 PDF (public/manufacturer-pdfs/{slug}.pdf)
const MFR_PDF_SLUG = { '현대': 'hyundai', '기아': 'kia', '제네시스': 'genesis' };
function openManufacturerPdf() {
  const slug = MFR_PDF_SLUG[selectedBrand.value];
  if (!slug) return;
  // 새 탭에서 열기 — 파일이 없으면 404, 사용자가 public/manufacturer-pdfs/{slug}.pdf 추가
  window.open(`/manufacturer-pdfs/${slug}.pdf`, '_blank');
}

</script>

<template>
  <div v-if="open" class="spt-backdrop" @click.self="closePanel">
    <div class="spt-panel">
      <div class="spt-head">
        <h3>
          <i class="ph ph-file-text"></i>
          웰릭스 표준 견적
        </h3>
        <button class="spt-close" @click="closePanel" aria-label="닫기">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="spt-body">
        <div class="spt-controls">
          <!-- 카스케이드: 제조사 탭 + 모델 드롭다운 -->
          <div class="spt-tabs">
            <button
              v-for="b in BRANDS" :key="b"
              class="spt-tab"
              :class="{ 'is-active': selectedBrand === b }"
              @click="selectBrand(b)"
            >{{ b }}</button>
          </div>
          <select
            class="spt-model-dd"
            v-model="selectedModel"
            :disabled="!modelsInBrand.length"
          >
            <option value="">전체 모델</option>
            <option v-for="m in modelsInBrand" :key="m" :value="m">{{ m }}</option>
          </select>
          <div class="spt-actions">
            <span class="spt-count">
              <template v-if="selectedCount">선택 <b>{{ selectedCount }}</b>건</template>
              <template v-else>{{ computedRows.length }}건</template>
            </span>
            <button v-if="selectedCount" class="spt-mini" @click="clearSelection" title="선택 해제">
              <i class="ph ph-x-circle"></i>선택 해제
            </button>
            <button class="spt-act" :disabled="!selectedCount" @click="openPreview" title="선택 차종 견적서 미리보기 (새 탭)">
              <i class="ph ph-eye"></i>미리보기
            </button>
            <button class="spt-act" :disabled="!selectedCount || copyingImage" @click="copyAsImage" title="견적서 이미지로 복사 (카톡 붙여넣기)">
              <i class="ph" :class="copyingImage ? 'ph-spinner' : 'ph-clipboard'"></i>이미지 복사
            </button>
            <button class="spt-act spt-act--primary" :disabled="!selectedCount" @click="downloadPdf" title="견적서 PDF (브라우저 인쇄→PDF)">
              <i class="ph ph-file-pdf"></i>PDF
            </button>
            <button class="spt-act" @click="openManufacturerPdf" title="제조사 공식 가격표 PDF 열기">
              <i class="ph ph-file-arrow-down"></i>공식 가격표
            </button>
          </div>
        </div>

        <div class="spt-cond-hint">
          <label class="spt-selectall">
            <input type="checkbox" :checked="allCurrentSelected" @change="toggleSelectAll" :disabled="!computedRows.length" />
            <span>현재 목록 전체선택</span>
          </label>
          <span class="spt-cond-hint__txt">※ 표준 조건: <b>중신용 · 보증금 10% · 선납 0% · 약정 2만km/년 · 보험 대물 1억 · 웰스 Basic</b></span>
          <span class="spt-staff">
            <i class="ph ph-user-circle"></i>
            <input v-model="quoteState.staff.name" class="spt-staff__in spt-staff__in--name" placeholder="담당자명" />
            <input :value="quoteState.staff.tel" @input="onStaffTel" class="spt-staff__in spt-staff__in--tel" placeholder="010-0000-0000" inputmode="tel" />
          </span>
        </div>

        <div v-if="loading" class="spt-loading">차량 데이터 로드 중…</div>
        <div v-else-if="errorMsg" class="spt-error">{{ errorMsg }}</div>
        <div v-else-if="!computedRows.length" class="spt-empty">표시할 차종이 없습니다</div>
        <!-- 세로 카드 — 견적서 형태. 각 트림 1장. 체크박스로 다중 선택 -->
        <div v-else class="spt-cards" ref="cardsContainer">
          <article
            v-for="r in computedRows" :key="r.idx"
            class="spt-card"
            :class="{ 'is-selected': isSelected(r.idx) }"
            @click="toggleRow(r.idx)"
          >
            <label class="spt-card__check" @click.stop>
              <input type="checkbox" :checked="isSelected(r.idx)" @change="toggleRow(r.idx)" />
            </label>
            <header class="spt-card__head">
              <div class="spt-card__brand">{{ r.brand }}</div>
              <div class="spt-card__model">{{ r.model }}</div>
              <div class="spt-card__trim">{{ r.trim }}</div>
            </header>
            <div class="spt-card__price">
              <span class="spt-card__price-label">차량가</span>
              <span class="spt-card__price-val">{{ fmt(r.price) }}<small>원</small></span>
            </div>
            <div class="spt-card__terms">
              <div v-for="(m, i) in r.monthlies" :key="i" class="spt-card__term">
                <div class="spt-card__term-label">{{ [36,48,60][i] }}개월</div>
                <div class="spt-card__term-monthly">
                  {{ m != null ? fmt(m) : '—' }}<small>원/월</small>
                </div>
              </div>
            </div>
            <div class="spt-card__cond">
              ※ 중신용 · 보증금 10% · 선납 0% · 약정 2만km/년 · 보험 대물 1억 · 웰스 Basic
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* === 모달 = backdrop + panel === */
.spt-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
  animation: spt-fade .15s ease-out;
}
@keyframes spt-fade { from { opacity: 0; } to { opacity: 1; } }

.spt-panel {
  background: var(--bg); border-radius: var(--radius-lg);
  width: 92vw; max-width: 1200px;
  max-height: 88vh;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.spt-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line-2);
  background: var(--bg-soft);
}
.spt-head h3 {
  margin: 0; font-size: 14px; font-weight: 600; color: var(--ink-1);
  display: flex; align-items: center; gap: 8px;
  letter-spacing: -0.2px;
}
.spt-head h3 i { font-size: 16px; color: var(--ink-3); }
.spt-close {
  background: transparent; border: 0;
  width: 28px; height: 28px;
  border-radius: var(--radius-sm); cursor: pointer;
  color: var(--ink-3); font-size: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.spt-close:hover { background: var(--accent-soft); color: var(--ink-1); }

.spt-body { padding: 14px 20px 20px; flex: 1; min-height: 0; display: flex; flex-direction: column; }

.spt-controls {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 0; flex-wrap: wrap;
}
.spt-tabs { display: flex; gap: 4px; }
.spt-model-dd {
  appearance: none; -webkit-appearance: none;
  border: 1px solid var(--line-2); background: var(--bg);
  font-family: inherit; font-size: 12px; color: var(--ink-1);
  padding: 6px 28px 6px 10px; border-radius: var(--radius-sm);
  cursor: pointer; min-width: 180px; max-width: 280px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23737373' stroke-width='1.5' stroke-linecap='round'><polyline points='3 5 6 8 9 5'/></svg>");
  background-repeat: no-repeat; background-position: right 8px center; background-size: 10px 10px;
  outline: none;
  transition: border-color var(--t-fast);
}
.spt-model-dd:hover { border-color: var(--ink-4); }
.spt-model-dd:focus { border-color: var(--ink-1); }
.spt-model-dd:disabled { opacity: 0.5; cursor: not-allowed; }
.spt-tab {
  border: 1px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  padding: 6px 14px; border-radius: var(--radius-sm);
  font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.spt-tab:hover { background: var(--bg-soft); }
.spt-tab.is-active {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}

.spt-actions { display: flex; align-items: center; gap: 8px; }
.spt-mini {
  border: 0; background: transparent; color: var(--ink-3);
  font-family: inherit; font-size: 11px; cursor: pointer;
  padding: 4px 8px; border-radius: var(--radius-sm);
}
.spt-mini:hover { background: var(--bg-soft); color: var(--ink-1); }
.spt-count { font-size: 11px; color: var(--ink-4); font-variant-numeric: tabular-nums; }
.spt-act {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--bg); color: var(--ink-2);
  border: 1px solid var(--line-2); border-radius: var(--radius-sm);
  padding: 6px 10px; font-family: inherit;
  font-size: 11.5px; font-weight: 500; cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.spt-act i { font-size: 13px; }
.spt-act:hover:not(:disabled) {
  background: var(--bg-soft); color: var(--ink-1); border-color: var(--ink-4);
}
.spt-act:disabled { opacity: 0.4; cursor: not-allowed; }
.spt-act--primary {
  background: var(--brand); color: #fff; border-color: var(--brand);
}
.spt-act--primary:hover:not(:disabled) {
  background: var(--brand-700); color: #fff; border-color: var(--brand-700);
}

.spt-cond-hint {
  font-size: 11px; color: var(--ink-4);
  background: var(--bg-soft);
  padding: 8px 12px; border-radius: var(--radius-sm);
  margin-bottom: 10px;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
}
.spt-cond-hint b { color: var(--ink-2); font-weight: 500; }
.spt-cond-hint__txt { flex: 1; min-width: 0; }
.spt-selectall {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: var(--ink-2); font-weight: 500;
  cursor: pointer; white-space: nowrap;
}
.spt-selectall input { width: 14px; height: 14px; cursor: pointer; accent-color: var(--brand); }
.spt-staff {
  display: inline-flex; align-items: center; gap: 5px; margin-left: auto;
  color: var(--ink-3);
}
.spt-staff > i { font-size: 15px; color: var(--ink-4); }
.spt-staff__in {
  border: 1px solid var(--line-2); background: var(--bg);
  font-family: inherit; font-size: 11.5px; color: var(--ink-1);
  padding: 5px 8px; border-radius: var(--radius-sm); outline: none;
  transition: border-color var(--t-fast);
}
.spt-staff__in:focus { border-color: var(--brand); }
.spt-staff__in--name { width: 72px; }
.spt-staff__in--tel { width: 118px; font-variant-numeric: tabular-nums; }

.spt-loading, .spt-error, .spt-empty {
  text-align: center; padding: 32px 16px;
  color: var(--ink-3); font-size: 12px;
}

/* === 세로 카드 그리드 === */
.spt-cards {
  flex: 1; min-height: 0; overflow-y: auto;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  padding: 4px;
  font-variant-numeric: tabular-nums;
}
.spt-card {
  position: relative;
  background: var(--bg);
  border: 1px solid var(--line-2); border-radius: var(--radius-md);
  padding: 14px 16px 14px 38px;
  display: flex; flex-direction: column; gap: 10px;
  cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast), box-shadow var(--t-fast);
}
.spt-card:hover { border-color: var(--ink-4); }
.spt-card.is-selected {
  border-color: var(--brand);
  background: var(--brand-50);
  box-shadow: inset 0 0 0 1px var(--brand);
}
.spt-card__check {
  position: absolute; top: 12px; left: 12px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.spt-card__check input {
  width: 16px; height: 16px; cursor: pointer; accent-color: var(--brand);
}

.spt-card__head { display: flex; flex-direction: column; gap: 1px; }
.spt-card__brand {
  font-size: 10px; color: var(--ink-4); font-weight: 500;
  letter-spacing: 0.4px;
}
.spt-card__model {
  font-size: 14px; font-weight: 700; color: var(--ink-1);
  letter-spacing: -0.2px;
}
.spt-card__trim {
  font-size: 11px; color: var(--ink-2);
  letter-spacing: -0.1px;
}

.spt-card__price {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 6px 0;
  border-top: 1px dashed var(--line);
  border-bottom: 1px dashed var(--line);
}
.spt-card__price-label { font-size: 10.5px; color: var(--ink-4); }
.spt-card__price-val {
  font-size: 13px; font-weight: 600; color: var(--ink-1);
}
.spt-card__price-val small {
  font-size: 9.5px; color: var(--ink-4); font-weight: 400; margin-left: 2px;
}

.spt-card__terms {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
}
.spt-card__term {
  background: var(--brand-50);
  border-radius: var(--radius-sm);
  padding: 8px 6px;
  text-align: center;
}
.spt-card__term-label {
  font-size: 10px; color: var(--ink-3); font-weight: 500;
  letter-spacing: 0.3px;
}
.spt-card__term-monthly {
  font-size: 13px; font-weight: 700; color: var(--brand);
  margin-top: 2px; letter-spacing: -0.3px;
}
.spt-card__term-monthly small {
  font-size: 9px; color: var(--ink-4); font-weight: 400; margin-left: 1px;
}

.spt-card__cond {
  font-size: 9.5px; color: var(--ink-4);
  letter-spacing: -0.1px;
}
</style>
