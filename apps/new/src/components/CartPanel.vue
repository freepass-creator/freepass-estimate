// 견적바구니 — 차종 N개 보관 + 체크박스 선택 + 미리보기/발송
<script setup>
import { ref, computed } from 'vue';
import { cartStore, removeFromCart, clearCart, toggleCartItem, setCartAllSelected } from '../store.js';
import { fmt } from '../lib/format.js';

const open = ref(false);

const selectedIds = computed(() =>
  cartStore.vehicles.filter(v => v.selected !== false).map(v => v.id)
);
const allSelected = computed(() =>
  cartStore.vehicles.length > 0 && cartStore.vehicles.every(v => v.selected !== false)
);
const selectedCount = computed(() => selectedIds.value.length);

function openPanel() { open.value = true; }
function closePanel() { open.value = false; }

function doAction(action) {
  if (selectedCount.value === 0) return;
  const selected = cartStore.vehicles.filter(v => v.selected !== false);
  // preview 는 모달 열어두고 결과 확인, 나머지는 자동 트리거
  window.__welrix_cartAction?.(action, selected);
  // preview 만 패널 닫음 (다른 액션은 견적서 모달에서 진행 상황/결과 확인)
  closePanel();
}
function clearAll() {
  if (confirm('견적바구니를 모두 비우시겠습니까?')) clearCart();
}
function addCurrent() {
  const result = window.__welrix_addCurrentToCart?.();
  if (!result || result.skipped) return;
  // 새로 추가된 경우 마지막 항목으로 스크롤
  if (!result.updated) {
    setTimeout(() => {
      const list = document.querySelector('.cart-list');
      if (list) list.scrollTop = list.scrollHeight;
    }, 50);
  }
}

// 외부에서 열기
if (typeof window !== 'undefined') {
  window.__welrix_openCart = openPanel;
}
</script>

<template>
  <div v-if="open" class="cart-backdrop" @click.self="closePanel">
    <div class="cart-panel">
      <div class="cart-panel__head">
        <h3>
          <i class="ph ph-paper-plane-tilt"></i> 손님 발송 — 견적바구니
          <span class="count">{{ cartStore.vehicles.length }}</span>
        </h3>
        <button class="cart-close" @click="closePanel" aria-label="닫기">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <!-- 의도 명시 배너 — 영업이 한눈에 흐름 인지 -->
      <div class="cart-intent">
        <span class="step">1. 차종 담기</span>
        <i class="ph ph-caret-right"></i>
        <span class="step">2. 체크</span>
        <i class="ph ph-caret-right"></i>
        <span class="step active">3. 손님에게 링크 발송</span>
      </div>

      <div class="cart-panel__body">
        <div v-if="cartStore.vehicles.length === 0" class="cart-empty">
          <i class="ph ph-paper-plane-tilt"></i>
          <h4>손님에게 보낼 견적이 비어있습니다</h4>
          <p>좌측에서 차량을 선택하고 아래 버튼으로 담아주세요.<br>
             여러 차종을 담아 <b>한 번에 손님에게 발송</b>할 수 있습니다.</p>
          <button class="cart-empty__cta" @click="addCurrent">
            <i class="ph ph-plus-circle"></i> 현재 견적 담기
          </button>
        </div>

        <template v-else>
          <div class="cart-toolbar">
            <label class="select-all">
              <input
                type="checkbox"
                :checked="allSelected"
                @change="setCartAllSelected($event.target.checked)"
              />
              <span>모두 선택</span>
              <em>{{ selectedCount }} / {{ cartStore.vehicles.length }}</em>
            </label>
            <div class="toolbar-right">
              <button class="ghost" @click="addCurrent" title="현재 화면의 차종을 추가">
                <i class="ph ph-plus-circle"></i> 현재 견적 담기
              </button>
              <button class="ghost" @click="clearAll">
                <i class="ph ph-trash"></i> 전체 비우기
              </button>
            </div>
          </div>

          <ul class="cart-list">
            <li
              v-for="v in cartStore.vehicles"
              :key="v.id"
              class="cart-item"
              :class="{ off: v.selected === false }"
            >
              <input
                type="checkbox"
                class="cart-item__check"
                :checked="v.selected !== false"
                @change="toggleCartItem(v.id)"
              />
              <div class="cart-item__main">
                <div class="cart-item__name">
                  {{ v.brand }} {{ v.model }} <b>{{ v.trim_name }}</b>
                </div>
                <div class="cart-item__meta">
                  {{ v.variant }}
                  <span v-if="v.colorExt"> · {{ v.colorExt }}</span>
                  <span v-if="(v.options || []).length"> · 옵션 {{ v.options.length }}개</span>
                </div>
                <div class="cart-item__monthly" v-if="v.monthly && v.monthly.length">
                  <span v-for="m in v.monthly" :key="m.idx" class="m-pill">
                    {{ m.term }}M <b>{{ fmt(m.monthly) }}</b>
                  </span>
                </div>
              </div>
              <div class="cart-item__price">{{ fmt(v.totalKrw) }}<em>원</em></div>
              <button
                class="cart-item__remove"
                @click="removeFromCart(v.id)"
                title="바구니에서 제거"
              >
                <i class="ph ph-x"></i>
              </button>
            </li>
          </ul>
        </template>
      </div>

      <div class="cart-panel__foot" v-if="cartStore.vehicles.length">
        <div class="foot-hint" v-if="selectedCount > 0">
          체크한 <b>{{ selectedCount }}건</b>을 손님에게 — 발송 방법을 선택하세요
        </div>
        <div class="foot-hint foot-hint--warn" v-else>
          ⚠ 발송할 차종을 1개 이상 체크해주세요
        </div>

        <!-- 보조 액션 (이미지/텍스트) — 영업이 카톡에 직접 붙여넣을 때 -->
        <div class="foot-actions-sub" v-if="selectedCount > 0">
          <button class="mini-action" @click="doAction('preview')" title="견적서 미리보기">
            <i class="ph ph-eye"></i><span>미리보기</span>
          </button>
          <button class="mini-action" @click="doAction('image-save')" title="N건 한 장 이미지로 저장">
            <i class="ph ph-download-simple"></i><span>이미지 저장</span>
          </button>
          <button class="mini-action" @click="doAction('image-copy')" title="클립보드에 복사 (Ctrl+V로 카톡에 붙여넣기)">
            <i class="ph ph-clipboard"></i><span>이미지 복사</span>
          </button>
          <button class="mini-action" @click="doAction('text-copy')" title="요약 텍스트 복사">
            <i class="ph ph-text-aa"></i><span>텍스트</span>
          </button>
        </div>

        <!-- 메인 액션: 링크 발송 (한 번에 N견적 가는 가장 빠른 방법) -->
        <button class="action send" :disabled="selectedCount === 0" @click="doAction('link-send')">
          <i class="ph ph-paper-plane-tilt"></i>
          손님 카톡으로 링크 발송 <em>{{ selectedCount }}건</em>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* === 견적바구니 — 디자인 시스템 토큰 통일 ===
   좌우 패딩 20px / 폰트 11·12·13·14 / 라운드 sm·md·lg / 컬러 토큰만 사용 */

.cart-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
  animation: fadeIn .15s ease-out;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.cart-panel {
  background: var(--bg); border-radius: var(--radius-lg);
  width: 520px; max-width: 94vw;
  max-height: 88vh;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

/* ===== Head ===== */
.cart-panel__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--line-2);
  background: var(--bg-soft);
}
.cart-panel__head h3 {
  margin: 0; font-size: 13px; font-weight: 500;
  display: flex; align-items: center; gap: 8px;
  color: var(--ink-1); letter-spacing: -0.2px;
}
.cart-panel__head h3 i { font-size: 14px; color: var(--brand); }
.cart-panel__head .count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--brand); color: #fff;
  font-size: 11px; font-weight: 600; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.cart-close {
  background: transparent; border: 0;
  width: 28px; height: 28px;
  border-radius: var(--radius-sm); cursor: pointer;
  color: var(--ink-3); font-size: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.cart-close:hover { background: var(--accent-soft); color: var(--ink-1); }

/* ===== Intent banner — "담기 → 체크 → 발송" 흐름 ===== */
.cart-intent {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--line);
  font-size: 11px; color: var(--ink-4); font-weight: 500;
}
.cart-intent .step { letter-spacing: -0.2px; }
.cart-intent .step.active { color: var(--brand); font-weight: 600; }
.cart-intent i { color: var(--ink-5); font-size: 10px; }

/* ===== Body ===== */
.cart-panel__body {
  flex: 1; overflow-y: auto;
  padding: 12px 20px 18px;
}

/* Empty state */
.cart-empty {
  padding: 36px 20px 40px;
  text-align: center; color: var(--ink-3);
}
.cart-empty i {
  font-size: 32px; color: var(--brand);
  opacity: 0.45;
  display: block; margin-bottom: 12px;
}
.cart-empty h4 {
  margin: 0 0 8px;
  font-size: 13px; font-weight: 600; color: var(--ink-1);
  letter-spacing: -0.2px;
}
.cart-empty p {
  margin: 0 0 16px; font-size: 12px; line-height: 1.7;
  color: var(--ink-3);
}
.cart-empty b { color: var(--brand); font-weight: 600; }
.cart-empty__cta {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 14px;
  background: var(--brand); color: #fff;
  border: 0; border-radius: var(--radius);
  font-size: 12px; font-weight: 500;
  font-family: inherit; cursor: pointer;
  transition: background var(--t-fast);
}
.cart-empty__cta:hover { background: var(--brand-700); }

/* Toolbar (select all / ghost buttons) */
.cart-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0 10px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 8px;
}
.select-all {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--ink-2);
  cursor: pointer; user-select: none;
}
.select-all input { width: 14px; height: 14px; accent-color: var(--brand); }
.select-all em {
  font-style: normal;
  color: var(--brand); font-weight: 600;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.toolbar-right { display: flex; gap: 4px; }
.ghost {
  background: transparent; border: 0; cursor: pointer;
  height: 28px; padding: 0 8px;
  border-radius: var(--radius-sm);
  font-size: 11px; font-weight: 400; color: var(--ink-3);
  display: inline-flex; align-items: center; gap: 4px;
  font-family: inherit; line-height: 1;
  transition: background var(--t-fast), color var(--t-fast);
}
.ghost i { font-size: 12px; }
.ghost:hover { background: var(--accent-soft); color: var(--ink-1); }

/* List items */
.cart-list { list-style: none; margin: 0; padding: 0; }
.cart-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center; gap: 10px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--line);
  transition: background var(--t-fast);
}
.cart-item:last-child { border-bottom: 0; }
.cart-item.off { opacity: 0.45; }
.cart-item.off .cart-item__price { color: var(--ink-4); }

.cart-item__check { width: 14px; height: 14px; accent-color: var(--brand); }
.cart-item__main { min-width: 0; }
.cart-item__name {
  font-size: 13px; font-weight: 500; color: var(--ink-1);
  letter-spacing: -0.2px;
}
.cart-item__name b { color: var(--brand); font-weight: 600; }
.cart-item__meta {
  margin-top: 2px;
  font-size: 11px; color: var(--ink-4);
}
.cart-item__monthly {
  margin-top: 6px;
  display: flex; flex-wrap: wrap; gap: 4px;
}
.m-pill {
  font-size: 11px; padding: 2px 6px;
  background: var(--accent-soft); color: var(--ink-3);
  border-radius: var(--radius-sm);
  font-variant-numeric: tabular-nums;
}
.m-pill b { color: var(--ink-1); font-weight: 600; }

.cart-item__price {
  font-size: 13px; color: var(--ink-1); font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.cart-item__price em {
  font-style: normal; font-size: 11px; color: var(--ink-4);
  font-weight: 400; margin-left: 2px;
}
.cart-item__remove {
  background: transparent; border: 0;
  width: 24px; height: 24px;
  border-radius: var(--radius-sm); cursor: pointer;
  color: var(--ink-4); font-size: 12px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.cart-item__remove:hover { background: var(--accent-soft); color: var(--ink-1); }

/* ===== Foot ===== */
.cart-panel__foot {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--line-2);
  background: var(--bg-soft);
}
.foot-hint {
  font-size: 11px; color: var(--ink-3);
  margin-bottom: 10px; text-align: center;
  letter-spacing: -0.2px;
}
.foot-hint b { color: var(--brand); font-weight: 600; }
.foot-hint--warn { color: var(--ink-2); }

/* 4-grid mini actions (미리보기/이미지/이미지복사/텍스트) */
.foot-actions-sub {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
  margin-bottom: 10px;
}
.mini-action {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  height: 48px; padding: 6px 4px;
  background: var(--bg); color: var(--ink-2);
  border: 1px solid var(--line-2); border-radius: var(--radius);
  font-size: 11px; font-weight: 500;
  font-family: inherit; cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.mini-action i { font-size: 14px; color: var(--ink-3); }
.mini-action:hover {
  background: var(--brand-50); color: var(--brand);
  border-color: var(--brand-100);
}
.mini-action:hover i { color: var(--brand); }

/* 메인 액션 — 풀폭 발송 버튼 */
.action.send {
  width: 100%;
  height: 44px;
  background: var(--brand); color: #fff;
  font-size: 14px; font-weight: 600;
  letter-spacing: -0.2px;
  border: 0; border-radius: var(--radius);
  cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px;
  transition: background var(--t-fast), opacity var(--t-fast);
}
.action.send i { font-size: 15px; }
.action.send em {
  font-style: normal;
  background: rgba(255, 255, 255, 0.22);
  padding: 2px 8px; border-radius: var(--radius-pill);
  font-size: 12px; font-weight: 600;
  margin-left: 4px;
  font-variant-numeric: tabular-nums;
}
.action.send:hover:not(:disabled) { background: var(--brand-700); }
.action.send:disabled {
  opacity: 0.4; cursor: not-allowed;
}
</style>
