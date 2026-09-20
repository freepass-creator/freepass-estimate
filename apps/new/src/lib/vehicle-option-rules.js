function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function requiredOptionIds(variant, trimId, optId) {
  const opt = variant?.options_master?.[optId];
  if (!opt) return [];
  return uniq([
    ...(opt.requires || []),
    ...(opt.requires_in_trim?.[trimId] || []),
  ]);
}

export function exclusiveGroupFor(variant, optId) {
  return (variant?.exclusive_groups || []).find((group) =>
    (group.members || []).includes(optId)
  ) || null;
}

export function exclusivePeerIds(variant, optId) {
  const group = exclusiveGroupFor(variant, optId);
  return group ? (group.members || []).filter((id) => id !== optId) : [];
}

export function explicitConflictIds(variant, optId) {
  const excludes = variant?.option_excludes || {};
  const out = new Set(excludes[optId] || []);

  // option_excludes data is directional ("package contains component"),
  // but the invalid combination is symmetric at runtime.
  for (const [parentId, childIds] of Object.entries(excludes)) {
    if ((childIds || []).includes(optId)) out.add(parentId);
  }
  out.delete(optId);
  return [...out];
}

export function conflictOptionIds(variant, optId) {
  return uniq([
    ...exclusivePeerIds(variant, optId),
    ...explicitConflictIds(variant, optId),
  ]);
}

export function optionStatus({ variant, trim, optId, selected }) {
  const selectedSet = selected instanceof Set ? selected : new Set(selected || []);
  const availableSet = new Set(trim?.available_options || []);
  const master = variant?.options_master || {};
  const requirements = requiredOptionIds(variant, trim?.trim_id, optId);
  const missingRequirements = requirements.filter((id) => !selectedSet.has(id));
  const conflicts = conflictOptionIds(variant, optId).filter((id) => selectedSet.has(id));

  return {
    exists: !!master[optId],
    available: availableSet.has(optId),
    requirements,
    missingRequirements,
    conflicts,
    enabled: !!master[optId] && availableSet.has(optId) && missingRequirements.length === 0,
  };
}

function pruneInvalidDependents(variant, trim, selectedSet, removed) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...selectedSet]) {
      const status = optionStatus({ variant, trim, optId: id, selected: selectedSet });
      if (!status.available || status.missingRequirements.length) {
        selectedSet.delete(id);
        removed.add(id);
        changed = true;
      }
    }
  }
}

export function toggleOptionSelection({ variant, trim, optId, selected }) {
  const next = new Set(selected instanceof Set ? selected : (selected || []));
  const removed = new Set();

  if (next.has(optId)) {
    next.delete(optId);
    removed.add(optId);
    pruneInvalidDependents(variant, trim, next, removed);
    return {
      next,
      changed: true,
      selected: false,
      removed: [...removed],
      blockedBy: [],
      replaced: [],
    };
  }

  const before = optionStatus({ variant, trim, optId, selected: next });
  if (!before.enabled) {
    return {
      next,
      changed: false,
      selected: false,
      removed: [],
      blockedBy: before.missingRequirements,
      replaced: [],
    };
  }

  const replaced = conflictOptionIds(variant, optId).filter((id) => next.has(id));
  for (const id of replaced) {
    next.delete(id);
    removed.add(id);
  }
  next.add(optId);

  // Removing a conflicting option can invalidate another selected dependent.
  pruneInvalidDependents(variant, trim, next, removed);

  return {
    next,
    changed: true,
    selected: next.has(optId),
    removed: [...removed],
    blockedBy: [],
    replaced,
  };
}

export function validateOptionSelection({ variant, trim, selected }) {
  const selectedSet = selected instanceof Set ? selected : new Set(selected || []);
  const errors = [];

  for (const id of selectedSet) {
    const status = optionStatus({ variant, trim, optId: id, selected: selectedSet });
    if (!status.exists) errors.push({ code: 'UNKNOWN_OPTION', optionId: id });
    else if (!status.available) errors.push({ code: 'OPTION_NOT_AVAILABLE', optionId: id });
    for (const req of status.missingRequirements) {
      errors.push({ code: 'MISSING_REQUIREMENT', optionId: id, relatedId: req });
    }
  }

  for (const group of variant?.exclusive_groups || []) {
    const picked = (group.members || []).filter((id) => selectedSet.has(id));
    if (picked.length > 1) {
      errors.push({ code: 'EXCLUSIVE_GROUP_CONFLICT', groupId: group.id, optionIds: picked });
    }
  }

  const seenPairs = new Set();
  for (const id of selectedSet) {
    for (const peer of explicitConflictIds(variant, id)) {
      if (!selectedSet.has(peer)) continue;
      const pair = [id, peer].sort().join('|');
      if (seenPairs.has(pair)) continue;
      seenPairs.add(pair);
      errors.push({ code: 'OPTION_EXCLUDE_CONFLICT', optionIds: pair.split('|') });
    }
  }

  return errors;
}
