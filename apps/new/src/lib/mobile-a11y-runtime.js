const SELECTORS = [
  '.sv-brand-card',
  '.sv-row',
  '.sv-trim-card',
  '.sv-color-card',
  '.sv-opt',
  '.sc-chip',
  '.se-chip',
  '.se-card',
].join(',');

function syncSelectionStates(root = document) {
  root.querySelectorAll?.(SELECTORS).forEach((el) => {
    el.setAttribute('aria-pressed', el.classList.contains('is-selected') ? 'true' : 'false');
    const disabled = el.matches(':disabled') || el.classList.contains('is-disabled');
    if (disabled) el.setAttribute('aria-disabled', 'true');
    else el.removeAttribute('aria-disabled');
  });
}

function syncProgress(root = document) {
  const progress = root.querySelector?.('.m-progress');
  if (!progress) return;
  const segments = [...progress.querySelectorAll('.m-progress__seg')];
  if (!segments.length) return;
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', '견적 진행 단계');
  progress.setAttribute('aria-valuemin', '1');
  progress.setAttribute('aria-valuemax', String(segments.length));
  progress.setAttribute(
    'aria-valuenow',
    String(Math.max(1, segments.filter((seg) => seg.classList.contains('is-done')).length)),
  );
  segments.forEach((seg) => seg.setAttribute('aria-hidden', 'true'));
}

function syncDialog(root = document) {
  const sheet = root.querySelector?.('.ss-sheet');
  if (!sheet) return;
  const title = sheet.querySelector('.ss-title');
  if (title && !title.id) title.id = 'send-sheet-title';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  if (title?.id) sheet.setAttribute('aria-labelledby', title.id);
}

function syncAll() {
  syncSelectionStates();
  syncProgress();
  syncDialog();
}

export function installMobileA11yRuntime() {
  syncAll();
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      syncAll();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'disabled'],
  });
  return () => observer.disconnect();
}
