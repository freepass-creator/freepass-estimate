// Quote provider selection is company/channel configuration, never a customer-facing UI choice.
// Top-level model: FreePass STANDARD vs EXTERNAL. External adapters can be Excel or ERP/API.

export const PROVIDER_MODE = Object.freeze({
  STANDARD: 'standard',
  EXTERNAL: 'external',
});

export const EXTERNAL_KIND = Object.freeze({
  EXCEL: 'excel',
  ERP: 'erp',
});

let loadingConfig;
export async function ensureProviderConfig() {
  if (globalThis.window?.__welrix_companyConfig) return;
  if (!loadingConfig) {
    loadingConfig = (async () => {
      const response = await fetch('/data/company-config/freepass.json');
      if (!response.ok) throw new Error('견적 공급자 설정을 불러오지 못했습니다');
      const config = await response.json();
      공급자설정(config);
      if (globalThis.window && !window.__welrix_companyConfig) window.__welrix_companyConfig = config;
    })().finally(() => { loadingConfig = null; });
  }
  await loadingConfig;
}

export function 공급자설정(cfg = globalThis.window?.__welrix_companyConfig, credit = null) {
  const base = cfg?.quote_provider;
  const p = credit != null && Object.hasOwn(base?.by_credit || {}, credit)
    ? base.by_credit[credit]
    : base;
  if (!p) {
    const error = new Error('견적 공급자 설정이 없습니다');
    error.code = 'PROVIDER_CONFIG_MISSING';
    throw error;
  }

  if (p.mode === PROVIDER_MODE.STANDARD) {
    return {
      mode: PROVIDER_MODE.STANDARD,
      kind: null,
      adapter_id: p.adapter_id || 'freepass-standard',
    };
  }

  if (p.mode === PROVIDER_MODE.EXTERNAL && [EXTERNAL_KIND.EXCEL, EXTERNAL_KIND.ERP].includes(p.kind)) {
    if (!p.adapter_id) throw new Error('외부 견적 adapter_id가 없습니다');
    return {
      mode: PROVIDER_MODE.EXTERNAL,
      kind: p.kind,
      adapter_id: p.adapter_id,
    };
  }

  throw new Error('견적 공급자 설정이 올바르지 않습니다');
}

export function 공급자키(cfg, credit = null) {
  const p = 공급자설정(cfg, credit);
  return p.mode === PROVIDER_MODE.STANDARD
    ? 'standard'
    : `external:${p.kind}:${p.adapter_id}`;
}
