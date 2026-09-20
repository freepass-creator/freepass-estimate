const LIGHT_MS = 8;
const MEDIUM_MS = 14;

function vibrationDuration(el) {
  if (!el) return LIGHT_MS;
  if (el.matches('.m-btn--primary, .sv-brand-card, .sv-row, .sv-trim-card, .sv-color-card, .sv-opt')) {
    return MEDIUM_MS;
  }
  return LIGHT_MS;
}

function vibrate(ms) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(ms) === true;
  } catch {
    return false;
  }
}

export function installMobileHaptics(root = document) {
  if (!root || root.__freepassHapticsInstalled) return;
  root.__freepassHapticsInstalled = true;

  root.addEventListener('click', (event) => {
    const el = event.target?.closest?.('button, [role="button"], summary');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.dataset.haptic === 'off') return;
    vibrate(vibrationDuration(el));
  }, { passive: true });
}
