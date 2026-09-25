// Vue 진입점 — 점진 마이그레이션 (mount points)
import { createApp } from 'vue';
import SummaryPanel from './components/SummaryPanel.vue';
import TermsGrid from './components/TermsGrid.vue';
import ReferenceGrid from './components/ReferenceGrid.vue';
import StandardPriceTable from './components/StandardPriceTable.vue';
import TodayHistory from './components/TodayHistory.vue';
import OptionsList from './components/OptionsList.vue';
import RightPanel from './components/RightPanel.vue';
import VehicleCascade from './components/VehicleCascade.vue';
import ColorSection from './components/ColorSection.vue';
import DiscountSection from './components/DiscountSection.vue';
import CustomerStaffForm from './components/CustomerStaffForm.vue';
import ConditionsForm from './components/ConditionsForm.vue';
import DeliverySection from './components/DeliverySection.vue';
import TintSection from './components/TintSection.vue';
import ExtrasAccordion from './components/ExtrasAccordion.vue';
import InsuranceAccordion from './components/InsuranceAccordion.vue';
import CartPanel from './components/CartPanel.vue';

function mountOne(id, Component, label) {
  const target = document.getElementById(id);
  if (!target) {
    console.warn(`[Vue] #${id} 없음 — mount 실패`);
    return;
  }
  createApp(Component).mount(target);
  console.log(`[Vue] ${label} mounted`);
}

function mountAll() {
  mountOne('vehicle-cascade-root', VehicleCascade, 'VehicleCascade');
  mountOne('color-section-root', ColorSection, 'ColorSection');
  mountOne('discount-section-root', DiscountSection, 'DiscountSection');
  mountOne('delivery-section-root', DeliverySection, 'DeliverySection');
  mountOne('tint-section-root', TintSection, 'TintSection');
  mountOne('extras-accordion-root', ExtrasAccordion, 'ExtrasAccordion');
  mountOne('insurance-accordion-root', InsuranceAccordion, 'InsuranceAccordion');
  mountOne('qp-summary-mini', SummaryPanel, 'SummaryPanel');
  mountOne('customer-staff-root', CustomerStaffForm, 'CustomerStaffForm');
  mountOne('conditions-form-root', ConditionsForm, 'ConditionsForm');
  mountOne('standard-price-root', StandardPriceTable, 'StandardPriceTable');
  mountOne('reference-grid', ReferenceGrid, 'ReferenceGrid');
  mountOne('terms-grid', TermsGrid, 'TermsGrid');
  mountOne('today-history-root', TodayHistory, 'TodayHistory');
  mountOne('options', OptionsList, 'OptionsList');
  mountOne('contract-panel-root', RightPanel, 'RightPanel');
  mountOne('cart-panel-root', CartPanel, 'CartPanel');
  // Vue mount 직후 inline render 한 번 더 — Vue store가 이제 살아있으니 옵션 데이터 채워짐
  if (typeof window.__welrix_render === 'function') {
    window.__welrix_render();
    console.log('[Vue] post-mount render() 완료');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll);
} else {
  mountAll();
}
