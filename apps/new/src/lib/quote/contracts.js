// Canonical contract identifiers for FreePass Estimate.
// Numeric legacy fields remain for backward compatibility, but new code should
// use these semantic ids so evidence can say which v1/v2 it actually means.

export const QUOTE_REQUEST_CONTRACT = 'freepass-quote-request/v1';
export const QUOTE_RESULT_CONTRACT = 'freepass-quote-result/v1';
export const QUOTE_PROVIDER_CONTRACT = 'freepass-quote-provider/v1';
export const QUOTE_EXECUTION_CONTRACT = 'freepass-quote-execution/v1';
export const STANDARD_QUOTE_BATCH_CONTRACT = 'freepass-standard-quote-batch/v1';
export const SHARE_SNAPSHOT_CONTRACT = 'freepass-quote-snapshot/v2';
export const MOBILE_NAVIGATION_CONTRACT = 'freepass-estimate-mobile-navigation/v1';
export const PROVIDER_HEALTH_CONTRACT = 'freepass-provider-health/v1';

export const LEGACY_QUOTE_VERSION = 1;
export const LEGACY_SHARE_SNAPSHOT_VERSION = 1;
export const CURRENT_SHARE_SNAPSHOT_VERSION = 2;

export function buildRevision() {
  try {
    return typeof __FREEPASS_BUILD_REVISION__ !== 'undefined'
      ? (__FREEPASS_BUILD_REVISION__ || null)
      : null;
  } catch {
    return null;
  }
}
