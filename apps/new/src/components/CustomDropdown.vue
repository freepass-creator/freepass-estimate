<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  options: { type: Array, default: () => [] },  // [{ value, label, iconUrl?, swatch? }]
  modelValue: { type: [String, Number, null], default: null },
  placeholder: { type: String, default: '선택' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'change']);

const open = ref(false);
const flipUp = ref(false);  // viewport 바닥 가까우면 위로 펼침
const rootEl = ref(null);

const current = computed(() => {
  if (props.modelValue == null || props.modelValue === '') return null;
  return props.options.find((o) => String(o.value) === String(props.modelValue));
});

// .cdd__menu max-height (CSS: min(70vh, 560px)) — flip 결정 시 동적 viewport 반영
const MENU_HEIGHT_CAP = 560;
function getMaxMenuHeight() {
  return Math.min(Math.floor(window.innerHeight * 0.7), MENU_HEIGHT_CAP);
}
const ITEM_HEIGHT = 32;

function computeFlip() {
  if (!rootEl.value) return;
  const rect = rootEl.value.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const needed = Math.min(getMaxMenuHeight(), props.options.length * ITEM_HEIGHT + 16);
  // 아래 공간이 부족하고 위 공간이 더 넓으면 위로
  flipUp.value = spaceBelow < needed && spaceAbove > spaceBelow;
}

function toggle() {
  if (props.disabled) return;
  if (!open.value) computeFlip();
  open.value = !open.value;
}
function close() { open.value = false; }
function select(opt) {
  emit('update:modelValue', opt.value);
  emit('change', opt.value);
  close();
}
// 다른 곳 클릭 시 닫기 — capture phase 로 등록해야
// 다른 드롭다운 버튼의 @click.stop 도 통과해서 받음
function onDocClick(e) {
  if (!open.value) return;
  if (rootEl.value && rootEl.value.contains(e.target)) return;
  close();
}
onMounted(() => {
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onEsc);
});
onUnmounted(() => {
  document.removeEventListener('click', onDocClick, true);
  document.removeEventListener('keydown', onEsc);
});
function onEsc(e) {
  if (e.key === 'Escape' && open.value) close();
}
</script>

<template>
  <div ref="rootEl" class="cdd" :class="{ 'cdd--open': open, 'cdd--disabled': disabled }">
    <button type="button" class="cdd__btn" @click.stop="toggle" :disabled="disabled">
      <span class="cdd__current">
        <template v-if="current">
          <span v-if="current.iconUrl" class="cdd__icon" :style="{ backgroundImage: `url('${current.iconUrl}')` }"></span>
          <span v-else-if="current.swatch" class="cdd__icon" :style="{ background: current.swatch }"></span>
          <span class="cdd__text">{{ current.label }}</span>
          <span v-if="current.sub" class="cdd__sub" :class="{ 'cdd__sub--accent': current.subAccent }">{{ current.sub }}</span>
        </template>
        <template v-else>
          <span class="cdd__text cdd__text--placeholder">{{ placeholder }}</span>
        </template>
      </span>
      <span class="cdd__chev"></span>
    </button>
    <div v-if="open" class="cdd__menu" :class="{ 'cdd__menu--up': flipUp }">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="cdd__opt"
        :class="{ 'cdd__opt--sel': String(opt.value) === String(modelValue) }"
        @click.stop="select(opt)"
      >
        <span v-if="opt.iconUrl" class="cdd__icon" :style="{ backgroundImage: `url('${opt.iconUrl}')` }"></span>
        <span v-else-if="opt.swatch" class="cdd__icon" :style="{ background: opt.swatch }"></span>
        <span class="cdd__opt-label">{{ opt.label }}</span>
        <span v-if="opt.sub" class="cdd__opt-sub" :class="{ 'cdd__opt-sub--accent': opt.subAccent }">{{ opt.sub }}</span>
      </button>
    </div>
  </div>
</template>
