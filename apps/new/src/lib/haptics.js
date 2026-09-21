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

const releaseTimers = new WeakMap();
function control(target) {
  const el = target?.closest?.('button, [role="button"], summary');
  return el && !el.disabled && el.getAttribute('aria-disabled') !== 'true'
    && el.dataset.haptic !== 'off' ? el : null;
}
function press(el) {
  clearTimeout(releaseTimers.get(el));
  el.dataset.fpPressedAt = String(Date.now());
  el.classList.add('fp-pressed');
}
function release(el, immediate = false) {
  if (!el) return;
  clearTimeout(releaseTimers.get(el));
  const delay = immediate ? 0 : Math.max(0, 72 - (Date.now() - Number(el.dataset.fpPressedAt)));
  if (!delay) { el.classList.remove('fp-pressed'); return; }
  releaseTimers.set(el, setTimeout(() => el.classList.remove('fp-pressed'), delay));
}

export function installMobileHaptics(root = document) {
  if (!root || root.__freepassHapticsInstalled) return;
  root.__freepassHapticsInstalled = true;
  const pointers = new Map();
  const keys = new Map();
  const cancelled = new WeakSet();
  const cancelAll = () => {
    for (const { el } of pointers.values()) { cancelled.add(el); release(el, true); }
    for (const el of keys.values()) release(el, true);
    pointers.clear(); keys.clear();
  };
  root.addEventListener('pointerdown', (event) => {
    if (event.isPrimary === false || (event.button != null && event.button !== 0)) return;
    const el = control(event.target);
    if (!el) return;
    cancelled.delete(el);
    pointers.set(event.pointerId, { el, x: event.clientX, y: event.clientY });
    press(el);
  }, { passive: true });
  root.addEventListener('pointermove', (event) => {
    const active = pointers.get(event.pointerId);
    if (!active) return;
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10) {
      cancelled.add(active.el);
      release(active.el, true);
      pointers.delete(event.pointerId);
    }
  }, { passive: true });
  const finish = (event) => {
    const active = pointers.get(event.pointerId);
    if (!active) return;
    const aborted = event.type !== 'pointerup' || control(event.target) !== active.el;
    if (aborted) cancelled.add(active.el);
    release(active.el, aborted);
    pointers.delete(event.pointerId);
  };
  root.addEventListener('pointerup', finish, { passive: true });
  root.addEventListener('pointercancel', finish, { passive: true });
  root.addEventListener('scroll', cancelAll, { passive: true, capture: true });
  root.addEventListener('visibilitychange', cancelAll);
  root.defaultView?.addEventListener('blur', cancelAll);

  // Capture before Vue's click handler disables or removes the selected card.
  // Native click fires for completed taps and keyboard activation, not scroll gestures.
  root.addEventListener('click', (event) => {
    const el = control(event.target);
    if (!el || event.isTrusted === false) return;
    if (event.detail !== 0 && cancelled.has(el)) return;
    vibrate(kindFor(el));
    if (event.detail === 0) { press(el); release(el); }
  }, { capture: true });
  root.addEventListener('keydown', (event) => {
    if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
    const el = control(event.target);
    if (!el) return;
    cancelled.delete(el);
    keys.set(event.key, el); press(el);
  });
  root.addEventListener('keyup', (event) => {
    release(keys.get(event.key)); keys.delete(event.key);
  });
}
