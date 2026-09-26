(function attachFreePassFeatureOptions(root) {
  'use strict';

  function asSet(value) {
    if (!(value instanceof Set)) throw new Error('selected options must be a Set');
    return value;
  }

  function getExclusiveGroup(exclusiveGroups, optionId) {
    return (exclusiveGroups || []).find((group) => (group.members || []).includes(optionId)) || null;
  }

  function requiredOptionIds(optionsMaster, trimId, optionId) {
    const option = optionsMaster?.[optionId];
    if (!option) return [];
    return [...new Set([
      ...(option.requires || []),
      ...(option.requires_in_trim?.[trimId] || []),
    ])];
  }

  function getExcludingParent(selected, optionExcludes, optionId) {
    asSet(selected);
    for (const [parentId, excludedIds] of Object.entries(optionExcludes || {})) {
      if (selected.has(parentId) && (excludedIds || []).includes(optionId)) return parentId;
    }
    return null;
  }

  function isOptionEnabled({ selected, optionsMaster, optionExcludes, trimId, optionId }) {
    asSet(selected);
    if (!optionsMaster?.[optionId]) return false;
    if (requiredOptionIds(optionsMaster, trimId, optionId).some((id) => !selected.has(id))) return false;
    return !getExcludingParent(selected, optionExcludes, optionId);
  }

  function pruneInvalidDependents(selected, optionsMaster, trimId) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const optionId of [...selected]) {
        const required = requiredOptionIds(optionsMaster, trimId, optionId);
        if (required.some((id) => !selected.has(id))) {
          selected.delete(optionId);
          changed = true;
        }
      }
    }
  }

  function setOptionSelected({
    selected,
    optionsMaster,
    exclusiveGroups,
    optionExcludes,
    trimId,
    optionId,
    checked,
  }) {
    asSet(selected);
    const wasSelected = selected.has(optionId);

    if (!checked) {
      if (!wasSelected) return { changed: false, selected };
      selected.delete(optionId);
      pruneInvalidDependents(selected, optionsMaster, trimId);
      return { changed: true, selected };
    }

    if (wasSelected) return { changed: false, selected };
    if (!isOptionEnabled({ selected, optionsMaster, optionExcludes, trimId, optionId })) {
      return { changed: false, selected };
    }

    const group = getExclusiveGroup(exclusiveGroups, optionId);
    for (const memberId of group?.members || []) {
      if (memberId !== optionId) selected.delete(memberId);
    }

    for (const excludedId of optionExcludes?.[optionId] || []) selected.delete(excludedId);
    pruneInvalidDependents(selected, optionsMaster, trimId);
    selected.add(optionId);
    return { changed: true, selected };
  }

  function toggleOptionSelection(context) {
    const selected = asSet(context.selected);
    return setOptionSelected({
      ...context,
      checked: !selected.has(context.optionId),
    });
  }

  root.FreePassFeatureOptions = Object.freeze({
    getExclusiveGroup,
    requiredOptionIds,
    getExcludingParent,
    isOptionEnabled,
    setOptionSelected,
    toggleOptionSelection,
  });
})(globalThis);
