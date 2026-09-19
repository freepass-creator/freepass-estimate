<script setup>
// 오늘 찍어본 견적 — 차량/조건 바뀔 때 자동 누적 (today 한정)
// localStorage 영속 (자정 지나면 비움). 클릭 시 그 시점 견적 스냅샷 모달에 표시.
import { ref, computed, watch, onMounted } from 'vue';
import { quoteState as state } from '../store.js';
import { fmt } from '../lib/format.js';

const DAY_KEY = (() => {
  const d = new Date();
  return `welrix_today_history_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
})();
const MAX_ENTRIES = 50;

const entries = ref([]);

function load() {
  try {
    const raw = localStorage.getItem(DAY_KEY);
    if (!raw) return;
    entries.value = JSON.parse(raw);
  } catch {}
}
function persist() {
  try { localStorage.setItem(DAY_KEY, JSON.stringify(entries.value)); } catch {}
}

onMounted(load);

// 마지막 저장된 vehicle key (중복 누적 방지)
let lastKey = '';
let lastSaveAt = 0;
function vehicleKey() {
  const v = state.vehicle;
  if (!v) return '';
  return `${v.brand}|${v.model}|${v.variant}|${v.trim_name}|${v.total_manwon}`;
}

function snapshot() {
  const v = state.vehicle;
  if (!v) return;
  const ms = state.monthly || [];
  // 60/48/36 순서 기준 monthly 매핑
  const findT = (term) => ms.find(m => m && m.term === term) || null;
  const entry = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2,6),
    ts: Date.now(),
    vehicle: {
      brand: v.brand, model: v.model, variant: v.variant, trim_name: v.trim_name,
      total_manwon: v.total_manwon, fuel: v.fuel, displacement_cc: v.displacement_cc,
    },
    cond: {
      credit: state.cond.credit, km: state.cond.km,
      dep: state.cond.dep, pre: state.cond.pre,
      svc: state.cond.svc, insProperty: state.cond.insProperty,
    },
    // 복원용 — 클릭 시 그대로 재산출하기 위한 전체 스냅샷
    vehicleFull: (() => { try { return JSON.parse(JSON.stringify(v)); } catch { return null; } })(),
    condFull: (() => { try { return JSON.parse(JSON.stringify(state.cond)); } catch { return null; } })(),
    monthly: [60, 48, 36].map(t => {
      const m = findT(t);
      return m ? { term: t, monthly: m.monthly, dep: m.dep, pre: m.pre,
                   residualPct: m.residualPct, residualAmt: m.residualAmt } : null;
    }),
  };
  // 최근 entry 와 같은 vehicle 이면 갱신 (덮어쓰기), 아니면 새로 추가
  const last = entries.value[0];
  const sameKey = last && last.vehicle &&
    last.vehicle.brand === v.brand && last.vehicle.model === v.model &&
    last.vehicle.variant === v.variant && last.vehicle.trim_name === v.trim_name &&
    last.vehicle.total_manwon === v.total_manwon &&
    last.cond.dep === state.cond.dep && last.cond.pre === state.cond.pre &&
    last.cond.credit === state.cond.credit;
  if (sameKey) {
    entries.value[0] = entry;
  } else {
    entries.value = [entry, ...entries.value].slice(0, MAX_ENTRIES);
  }
  persist();
}

// 차량 / 조건 변경 시 자동 스냅샷 (debounce 800ms)
let debounceTimer = null;
function scheduleSnapshot() {
  if (!state.vehicle?.total_manwon) return;
  if (!state.monthly?.length) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(snapshot, 800);
}

watch(
  () => [
    vehicleKey(),
    state.monthly?.length,
    state.cond.dep, state.cond.pre, state.cond.credit, state.cond.km,
  ],
  scheduleSnapshot,
  { deep: false }
);

// 액션
function removeEntry(id) {
  entries.value = entries.value.filter(e => e.id !== id);
  persist();
}
function clearAll() {
  if (!confirm('오늘 견적 히스토리를 모두 비우시겠습니까?')) return;
  entries.value = [];
  persist();
}

// 클릭 — 그 견적을 계산기에 그대로 복원·재산출
function restoreEntry(entry) {
  const vf = entry.vehicleFull;
  if (!vf || !vf.total_manwon) {
    // 구버전 엔트리(복원 데이터 없음) — 미리보기로 폴백
    if (typeof window.__welrix_previewHistoryEntry === 'function') { window.__welrix_previewHistoryEntry(entry); return; }
    const v = entry.vehicle;
    const m = entry.monthly.map(x => x ? `${x.term}M ${fmt(x.monthly)}원` : '—').join(' / ');
    alert(`${v.brand} ${v.model} ${v.trim_name}\n${m}\n\n(이 견적은 예전 형식이라 복원할 수 없어요. 새로 산출한 견적부터 클릭 복원됩니다.)`);
    return;
  }
  // 차량 복원 (state.vehicle 교체 → SummaryPanel 등 reactive 갱신)
  state.vehicle = JSON.parse(JSON.stringify(vf));
  // 조건 복원 (credit/km/dep/pre/수수료/할인/색상 등) — 기존 cond 위에 덮어쓰기
  if (entry.condFull) Object.assign(state.cond, entry.condFull);
  // 재계산 — findVehicleMeta 가 카탈로그에서 r팩터를 끌어와 그대로 산출
  window.__welrix_recompute?.();
  // 복원된 견적 확인하도록 상단으로
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
</script>

<template>
  <div class="th" v-if="entries.length">
    <div class="th-head">
      <h3>오늘 산출한 견적 <span class="th-count">{{ entries.length }}</span></h3>
      <button class="th-clear" @click="clearAll" title="전체 비우기">
        <i class="ph ph-trash"></i>
      </button>
    </div>
    <div class="th-list">
      <div
        v-for="e in entries" :key="e.id"
        class="th-item"
        @click="restoreEntry(e)"
        title="클릭하면 이 견적을 그대로 다시 산출합니다"
      >
        <div class="th-item__time">{{ fmtTime(e.ts) }}</div>
        <div class="th-item__main">
          <div class="th-item__name">
            {{ e.vehicle.brand }} {{ e.vehicle.model }} <b>{{ e.vehicle.trim_name }}</b>
          </div>
          <div class="th-item__meta">
            {{ e.cond.credit }} · 보증금 {{ e.cond.dep }}% · 선납 {{ e.cond.pre }}% · {{ e.cond.km }}만km/년
          </div>
        </div>
        <div class="th-item__monthly">
          <span v-for="m in e.monthly" :key="m?.term ?? Math.random()" class="th-pill">
            <template v-if="m">{{ m.term }}M <b>{{ fmt(m.monthly) }}</b></template>
            <template v-else>—</template>
          </span>
        </div>
        <button class="th-item__remove" @click.stop="removeEntry(e.id)" title="삭제">
          <i class="ph ph-x"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.th {
  margin-top: 22px;
  border-top: 1px solid var(--line);
  padding-top: 16px;
}
.th-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 10px;
}
.th-head h3 {
  margin: 0; font-size: 12px; font-weight: 500; color: var(--ink-3);
  letter-spacing: 0;
  display: flex; align-items: baseline; gap: 6px;
}
.th-count {
  font-size: 10.5px; color: var(--brand); font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.th-clear {
  border: 0; background: transparent; cursor: pointer;
  color: var(--ink-4); padding: 4px 6px; border-radius: var(--radius-sm);
  font-size: 12px;
}
.th-clear:hover { background: var(--bg-soft); color: var(--ink-1); }

.th-list {
  display: flex; flex-direction: column;
  border: 1px solid var(--line-2); border-radius: var(--radius-sm);
  max-height: 60vh; overflow-y: auto;
  background: var(--bg);
}
.th-item {
  display: grid;
  grid-template-columns: 42px 1fr auto 24px;
  gap: 10px; align-items: center;
  padding: 9px 10px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  transition: background var(--t-fast);
}
.th-item:last-child { border-bottom: 0; }
.th-item:hover { background: var(--bg-soft); }
.th-item__time {
  font-size: 10px; color: var(--ink-4);
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.th-item__main { min-width: 0; }
.th-item__name {
  font-size: 12px; color: var(--ink-1); font-weight: 500;
  letter-spacing: -0.2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.th-item__name b { color: var(--brand); font-weight: 600; }
.th-item__meta {
  margin-top: 2px;
  font-size: 10.5px; color: var(--ink-4);
}
.th-item__monthly {
  display: flex; gap: 4px; flex-wrap: wrap;
}
.th-pill {
  font-size: 10.5px; padding: 2px 7px;
  background: var(--accent-soft); color: var(--ink-3);
  border-radius: var(--radius-pill);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.th-pill b { color: var(--ink-1); font-weight: 600; }
.th-item__remove {
  border: 0; background: transparent; cursor: pointer;
  width: 22px; height: 22px;
  border-radius: 50%; color: var(--ink-4);
  display: inline-flex; align-items: center; justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.th-item__remove:hover { background: var(--accent-soft); color: var(--ink-1); }
</style>
