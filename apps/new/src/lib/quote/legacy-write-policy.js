export const LEGACY_QUOTE_WRITE_MODE = Object.freeze({
  LEGACY_ALLOWED: 'LEGACY_ALLOWED',
  CANONICAL_ONLY: 'CANONICAL_ONLY',
});

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function resolveLegacyQuoteWriteMode({
  globalMode = globalThis.__FREEPASS_QUOTE_WRITE_MODE,
  viteMode = import.meta.env?.VITE_FREEPASS_QUOTE_WRITE_MODE,
} = {}) {
  const raw = String(globalMode ?? viteMode ?? '').trim().toUpperCase();
  if (!raw) return LEGACY_QUOTE_WRITE_MODE.LEGACY_ALLOWED;
  if (!Object.values(LEGACY_QUOTE_WRITE_MODE).includes(raw)) {
    throw codedError(
      `unknown legacy Quote write mode: ${raw}`,
      'LEGACY_QUOTE_WRITE_MODE_INVALID'
    );
  }
  return raw;
}

/**
 * Controls creation of NEW legacy RTDB quote roots only.
 *
 * Existing legacy reads remain available during the migration window.
 * This guard must run before auth/RTDB reads or writes in saveQuote().
 */
export function assertLegacyQuoteWriteAllowed(options = {}) {
  const mode = resolveLegacyQuoteWriteMode(options);
  if (mode === LEGACY_QUOTE_WRITE_MODE.CANONICAL_ONLY) {
    throw codedError(
      'legacy RTDB Quote writes are disabled after canonical cutover',
      'LEGACY_QUOTE_WRITE_BLOCKED'
    );
  }
  return mode;
}

export function legacyQuoteWriteBlockEvidence(options = {}) {
  const mode = resolveLegacyQuoteWriteMode(options);
  return Object.freeze({
    contract: 'freepass-legacy-quote-write-policy/v1',
    mode,
    legacyNewQuoteWriteBlocked: mode === LEGACY_QUOTE_WRITE_MODE.CANONICAL_ONLY,
  });
}
