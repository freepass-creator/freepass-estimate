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

const LEGACY_WELRIX = Object.freeze({
  mode: PROVIDER_MODE.EXTERNAL,
  kind: EXTERNAL_KIND.EXCEL,
  adapter_id: 'welrix',
});

export function 공급자설정(cfg = globalThis.window?.__welrix_companyConfig) {
  const p = cfg?.quote_provider;
  if (!p) return { ...LEGACY_WELRIX };

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

export function 공급자키(cfg) {
  const p = 공급자설정(cfg);
  return p.mode === PROVIDER_MODE.STANDARD
    ? 'standard'
    : `external:${p.kind}:${p.adapter_id}`;
}
