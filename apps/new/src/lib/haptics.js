const HAPTIC = Object.freeze({
  subtle: 7,
  selection: 12,
  primary: 18,
});

function kindFor(el) {
  if (!el) return 'subtle';
  if (el.matches('.m-btn--primary, #gate-submit')) return 'primary';
  if (el.matches('.sv-brand-card, .sv-row, .sv-trim-card, .sv-color-card, .sv-opt, .sc-chip, .se-chip, .se-card')) return 'selection';
  return 'subtle';
}

function vibrate(kind) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(HAPTIC[kind] || HAPTIC.subtle) === true;
  } catch {
    return false;
  }
}

function press(el) {
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  el.classList.add('fp-pressed');
}

function release(el) {
  if (!el) return;
  const started = Number(el.dataset.fpPressedAt || 0);
  const elapsed = Date.now() - started;
  const delay = Math.max(0, 72 - elapsed);
  setTimeout(() => el.classList.remove('fp-pressed'), delay);
}

export function installMobileHaptics(root = document) {
  if (!root || root.__freepassHapticsInstalled) return;
  root.__freepassHapticsInstalled = true;

  root.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const el = event.target?.closest?.('button, [role="button"], summary');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.dataset.haptic === 'off') return;

    el.dataset.fpPressedAt = String(Date.now());
    press(el);
    vibrate(kindFor(el));
  }, { passive: true });

  root.addEventListener('pointerup', (event) => {
    const el = event.target?.closest?.('button, [role="button"], summary');
    release(el);
  }, { passive: true });

  root.addEventListener('pointercancel', (event) => {
    const el = event.target?.closest?.('button, [role="button"], summary');
    release(el);
  }, { passive: true });

  // Keyboard accessibility: Enter/Space gets the same visual beat.
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const el = event.target?.closest?.('button, [role="button"], summary');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    el.dataset.fpPressedAt = String(Date.now());
    press(el);
    vibrate(kindFor(el));
  });

  root.addEventListener('keyup', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const el = event.target?.closest?.('button, [role="button"], summary');
    release(el);
  });
}
