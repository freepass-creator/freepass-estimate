<script setup>
import { computed } from 'vue';
import { vehicleState } from '../store.js';
import { fmt } from '../lib/format.js';

// 현재 트림의 옵션 목록 (인라인 스크립트가 syncToVueStore에서 채움)
const options = computed(() => vehicleState.optionsForCurrentTrim || []);

function isChecked(id) { return vehicleState.options.has(id); }

function toggle(opt) {
  if (!opt.enabled && !isChecked(opt.id)) return;
  window.__welrix_toggleOption?.(opt.id);
}
</script>

<template>
  <div v-if="options.length === 0" class="empty-state">이 트림은 선택 가능한 옵션이 없습니다</div>
  <div
    v-for="opt in options"
    :key="opt.id"
    class="option-row"
    :class="{ active: isChecked(opt.id), disabled: !opt.enabled && !isChecked(opt.id) }"
    @click="toggle(opt)"
  >
    <input
      type="checkbox"
      :checked="isChecked(opt.id)"
      :disabled="!opt.enabled && !isChecked(opt.id)"
      @click.stop="toggle(opt)"
    />
    <div class="o-info">
      <div class="o-name">{{ opt.name }}</div>
      <div v-if="opt.sub" class="o-sub">{{ opt.sub }}</div>
      <div v-if="opt.requiresLabels?.length" class="o-sub" style="color:#c00;">
        <i class="ph ph-warning"></i> 선행 필수: {{ opt.requiresLabels.join(', ') }}
      </div>
      <div v-if="opt.exclusiveGroupLabel" class="o-sub" style="color:var(--ink-4);font-size:11px;">
        <i class="ph ph-info"></i> {{ opt.exclusiveGroupLabel }} 중 하나만 선택 가능
      </div>
      <div v-if="opt.excludingParentName" class="o-sub" style="color:#888;">
        🔒 [{{ opt.excludingParentName }}]에 이미 포함됨
      </div>
      <div v-if="opt.includesNames?.length" class="o-sub" style="color:#888;font-size:11px;">
        📦 포함: {{ opt.includesNames.join(', ') }}
      </div>
    </div>
    <div class="o-price">{{ opt.price ? `+${fmt(opt.price)}만` : '기본' }}</div>
  </div>
</template>
