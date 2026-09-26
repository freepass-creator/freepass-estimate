<script setup>
// 오늘 찍어본 견적 — 차량/조건 바뀔 때 자동 누적 (today 한정)
// localStorage 영속 (자정 지나면 비움). 클릭 시 그 시점 견적 스냅샷 모달에 표시.
import { ref, computed, watch, onMounted } from 'vue';
import { quoteState as state } from '../store.js';
import { fmt } from '../lib/format.js';
import {
  buildHistorySnapshot,
  restoreHistorySnapshot,
  sameHistoryConfiguration,
} from '../lib/feature/history.js';

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

function snapshot() {
  const entry = buildHistorySnapshot(state, {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    now: Date.now(),
  });
  if (!entry) return;

  const last = entries.value[0];
  if (last && sameHistoryConfiguration(last, state)) {
    entries.value[0] = entry;
  } else {
    entries.value = [entry, ...entries.value].slice(0, MAX_ENTRIES);
  }
  persist();
}

// 차량 / 조건 / 계산결과 / 발송기간 변경 시 자동 스냅샷 (debounce 800ms)
let debounceTimer = null;
function scheduleSnapshot() {
  if (!state.vehicle?.total_manwon) return;
  if (!(state.monthly || []).some((item) => item?.monthly != null)) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(snapshot, 800);
}

watch(
  () => JSON.stringify({
    vehicle: state.vehicle ? {
      brand: state.vehicle.brand,
      model: state.vehicle.model,
      variant: state.vehicle.variant,
      trim_name: state.vehicle.trim_name,
      total_manwon: state.vehicle.total_manwon,
      options: state.vehicle.options || [],
      colorExt: state.vehicle.colorExt || null,
    } : null,
    scenarios: state.scenarios || [],
    send: state.send || [],
    monthly: state.monthly || [],
    cond: {
      credit: state.cond.credit,
      km: state.cond.km,
      dep: state.cond.dep,
      pre: state.cond.pre,
      svc: state.cond.svc,
      insProperty: state.cond.insProperty,
    },
  }),
  scheduleSnapshot,
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
  const result = restoreHistorySnapshot(entry, state);
  if (!result.restored) {
    // 구버전 엔트리(복원 데이터 없음) — 미리보기로 폴백
    if (typeof window.__welrix_previewHistoryEntry === 'function') {
      window.__welrix_previewHistoryEntry(entry);
      return;
    }
    const v = entry.vehicle || {};
    const m = (entry.monthly || []).map((x) => x ? `${x.term}M ${fmt(x.monthly)}원` : '—').join(' / ');
    alert(`${v.brand || ''} ${v.model || ''} ${v.trim_name || ''}\n${m}\n\n(이 견적은 예전 형식이라 복원할 수 없습니다.)`);
    return;
  }

  // Snapshot 금액을 먼저 복원한 뒤 현재 Provider 기준으로 다시 산출해 최신 live 상태를 만든다.
  window.__welrix_recompute?.();
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
