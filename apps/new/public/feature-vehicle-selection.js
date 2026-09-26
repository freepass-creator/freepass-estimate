(function attachFreePassVehicleSelection(root) {
  'use strict';

  const STEPS = Object.freeze(['manufacturer', 'model', 'variant', 'trimGroup', 'trim', 'color']);
  const DESCENDANTS = Object.freeze({
    manufacturer: Object.freeze(['model', 'variant', 'trimGroup', 'trim', 'options', 'color']),
    model: Object.freeze(['variant', 'trimGroup', 'trim', 'options', 'color']),
    variant: Object.freeze(['trimGroup', 'trim', 'options', 'color']),
    trimGroup: Object.freeze(['trim', 'options', 'color']),
    trim: Object.freeze(['options', 'color']),
    color: Object.freeze([]),
  });

  function ensureState(state) {
    if (!state || typeof state !== 'object') throw new Error('vehicle selection state is required');
    if (!(state.options instanceof Set)) state.options = new Set(state.options || []);
    return state;
  }

  function normalizeValue(step, value) {
    if (step === 'color') {
      if (value === '' || value == null) return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return value == null || value === '' ? null : value;
  }

  function clearField(state, field) {
    if (field === 'options') {
      state.options.clear();
      return;
    }
    state[field] = null;
  }

  function applySelection(state, step, rawValue) {
    ensureState(state);
    if (!STEPS.includes(step)) throw new Error(`unsupported vehicle selection step: ${step}`);

    const value = normalizeValue(step, rawValue);
    const previous = state[step] ?? null;

    // Back navigation + re-selecting the same item must be non-destructive.
    if (Object.is(previous, value)) {
      return { changed: false, step, value, cleared: [] };
    }

    state[step] = value;
    const cleared = [];
    for (const field of DESCENDANTS[step] || []) {
      const before = field === 'options' ? state.options.size : state[field];
      clearField(state, field);
      const didClear = field === 'options' ? before > 0 : before != null;
      if (didClear) cleared.push(field);
    }

    return { changed: true, step, value, cleared };
  }

  function operatingTrimGroups(variant) {
    const groups = new Set();
    for (const trim of variant?.trims || []) {
      if (trim?.operating === false) continue;
      if (trim?.group) groups.add(trim.group);
    }
    return [...groups];
  }

  function nextStepAfterSelection(step, context = {}) {
    if (step === 'manufacturer') return 'model';
    if (step === 'model') return 'variant';
    if (step === 'variant') return operatingTrimGroups(context.variant).length > 1 ? 'spec' : 'trim';
    if (step === 'trimGroup') return 'trim';
    if (step === 'trim') {
      const trim = context.trim || {};
      const model = context.model || {};
      const hasColors = Boolean(
        trim._exterior_colors?.length ||
        trim._interior_colors?.length ||
        model.exterior_colors?.length ||
        model._interior?.length
      );
      return hasColors ? 'colors' : 'options';
    }
    return null;
  }

  root.FreePassVehicleSelection = Object.freeze({
    STEPS,
    applySelection,
    operatingTrimGroups,
    nextStepAfterSelection,
  });
})(globalThis);
