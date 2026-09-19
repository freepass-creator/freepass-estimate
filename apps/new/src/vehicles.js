// 차량 가이드 인덱스 페이지 엔트리
import { createApp } from 'vue';
import VehicleIndex from './components/home/VehicleIndex.vue';

function mountAll() {
  if (!window.VEHICLE_DB) {
    setTimeout(mountAll, 50);
    return;
  }
  const target = document.getElementById('vehicle-index-root');
  if (!target) return;
  createApp(VehicleIndex).mount(target);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll);
} else {
  mountAll();
}
