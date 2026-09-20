import { 공급자설정 } from './provider-config.js';

export function 웰릭스외부공급자인가(cfg = globalThis.window?.__welrix_companyConfig) {
  const provider = 공급자설정(cfg);
  return provider.mode === 'external'
    && provider.kind === 'excel'
    && provider.adapter_id === 'welrix';
}

export function 트림공급가능(t, cfg = globalThis.window?.__welrix_companyConfig) {
  if (!t || t.operating === false) return false;
  if (!웰릭스외부공급자인가(cfg)) return true;
  if (Object.prototype.hasOwnProperty.call(t, '_provider_candidates')) {
    return Array.isArray(t._provider_candidates) && t._provider_candidates.length > 0;
  }
  // Sales profile uses provider-native Welrix catalog: trim_id itself is the Welrix API model key.
  return typeof t.trim_id === 'string' && t.trim_id.trim().length > 0;
}

export function 변형공급가능(v, cfg = globalThis.window?.__welrix_companyConfig) {
  return !!v && (v.trims || []).some((t) => 트림공급가능(t, cfg));
}

export function 모델공급가능(m, cfg = globalThis.window?.__welrix_companyConfig) {
  return !!m && (m.variants || []).some((v) => 변형공급가능(v, cfg));
}

export function 브랜드공급가능(b, cfg = globalThis.window?.__welrix_companyConfig) {
  return !!b && (b.models || []).some((m) => 모델공급가능(m, cfg));
}
