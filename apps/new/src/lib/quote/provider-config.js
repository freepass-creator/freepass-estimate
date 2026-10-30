// Quote provider selection is company/channel configuration, never a customer-facing UI choice.
// 견적 산식은 FreePass STANDARD 하나뿐이다(외부 연동 산식은 폐기).

export const PROVIDER_MODE = Object.freeze({
  STANDARD: 'standard',
});

export function 공급자설정(cfg = globalThis.window?.__estimate_companyConfig) {
  const p = cfg?.quote_provider;
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

  throw new Error('견적 공급자 설정이 올바르지 않습니다');
}

export function 공급자키(cfg) {
  const p = 공급자설정(cfg);
  return 'standard';
}
