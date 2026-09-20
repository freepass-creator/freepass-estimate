import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {
  requiredOptionIds,
  toggleOptionSelection,
  validateOptionSelection,
} from '../src/lib/vehicle-option-rules.js';

function loadDb(path) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path, 'utf8'), ctx);
  return ctx.window.VEHICLE_DB;
}

function selectedNames(master, selected) {
  return [...selected].map((id) => master[id]?.name || id);
}

// Pure-rule regression cases.
{
  const variant = {
    options_master: {
      a: { name: '선행 A' },
      b: { name: '종속 B', requires: ['a'] },
      c: { name: '배타 C' },
      d: { name: '배타 D' },
      e: { name: '제외 E' },
      f: { name: '복합 F', requires: ['a'], requires_in_trim: { t: ['c'] } },
    },
    exclusive_groups: [{ id: 'g0', label: '배타', members: ['c', 'd'] }],
    option_excludes: { c: ['e'] },
  };
  const trim = { trim_id: 't', available_options: ['a', 'b', 'c', 'd', 'e', 'f'] };

  let s = new Set();
  let r = toggleOptionSelection({ variant, trim, optId: 'b', selected: s });
  assert.equal(r.changed, false, 'dependent option must be blocked before prerequisite');
  assert.deepEqual(r.blockedBy, ['a']);

  r = toggleOptionSelection({ variant, trim, optId: 'a', selected: s }); s = r.next;
  r = toggleOptionSelection({ variant, trim, optId: 'b', selected: s }); s = r.next;
  assert.deepEqual(new Set(s), new Set(['a', 'b']), 'prerequisite + dependent selection failed');
  r = toggleOptionSelection({ variant, trim, optId: 'a', selected: s }); s = r.next;
  assert.equal(s.size, 0, 'removing prerequisite must cascade-remove dependent');

  r = toggleOptionSelection({ variant, trim, optId: 'c', selected: s }); s = r.next;
  r = toggleOptionSelection({ variant, trim, optId: 'd', selected: s }); s = r.next;
  assert.deepEqual([...s], ['d'], 'exclusive group must keep last selection only');

  r = toggleOptionSelection({ variant, trim, optId: 'c', selected: new Set() }); s = r.next;
  r = toggleOptionSelection({ variant, trim, optId: 'e', selected: s }); s = r.next;
  assert.deepEqual([...s], ['e'], 'explicit exclude must be symmetric: child selection replaces parent');

  r = toggleOptionSelection({ variant, trim, optId: 'e', selected: new Set() }); s = r.next;
  r = toggleOptionSelection({ variant, trim, optId: 'c', selected: s }); s = r.next;
  assert.deepEqual([...s], ['c'], 'explicit exclude must be symmetric: parent selection replaces child');

  assert.deepEqual(requiredOptionIds(variant, 't', 'f').sort(), ['a', 'c'], 'common + trim-specific requirements must be unioned');
  assert.ok(validateOptionSelection({ variant, trim, selected: new Set(['c', 'd']) })
    .some((e) => e.code === 'EXCLUSIVE_GROUP_CONFLICT'), 'validator must catch exclusive conflicts');
  assert.ok(validateOptionSelection({ variant, trim, selected: new Set(['c', 'e']) })
    .some((e) => e.code === 'OPTION_EXCLUDE_CONFLICT'), 'validator must catch explicit excludes');
}

const db = loadDb('public/sales-welrix-db.js');
assert.ok(db?.manufacturers?.length, 'Sales Welrix DB did not load');

const integrityErrors = [];
let variants = 0;
let trims = 0;
let availableEdges = 0;
let exclusiveGroups = 0;
let excludeEdges = 0;
let requirementEdges = 0;
let optionsMasterEntries = 0;

for (const manufacturer of db.manufacturers || []) {
  for (const model of manufacturer.models || []) {
    for (const variant of model.variants || []) {
      variants++;
      const master = variant.options_master || {};
      optionsMasterEntries += Object.keys(master).length;
      const trimIds = new Set((variant.trims || []).map((t) => t.trim_id));

      for (const group of variant.exclusive_groups || []) {
        exclusiveGroups++;
        const unique = new Set(group.members || []);
        if (unique.size !== (group.members || []).length) {
          integrityErrors.push({ code: 'DUPLICATE_EXCLUSIVE_MEMBER', model: model.model_name, variant: variant.variant_name, group: group.id });
        }
        for (const id of unique) if (!master[id]) {
          integrityErrors.push({ code: 'EXCLUSIVE_UNKNOWN_OPTION', model: model.model_name, variant: variant.variant_name, group: group.id, id });
        }
      }

      for (const [parent, children] of Object.entries(variant.option_excludes || {})) {
        if (!master[parent]) integrityErrors.push({ code: 'EXCLUDE_UNKNOWN_PARENT', model: model.model_name, variant: variant.variant_name, parent });
        for (const child of children || []) {
          excludeEdges++;
          if (child === parent) integrityErrors.push({ code: 'SELF_EXCLUDE', model: model.model_name, variant: variant.variant_name, parent });
          if (!master[child]) integrityErrors.push({ code: 'EXCLUDE_UNKNOWN_CHILD', model: model.model_name, variant: variant.variant_name, parent, child });
        }
      }

      for (const [id, option] of Object.entries(master)) {
        for (const req of option.requires || []) {
          requirementEdges++;
          if (!master[req]) integrityErrors.push({ code: 'REQUIRE_UNKNOWN_OPTION', model: model.model_name, variant: variant.variant_name, id, req });
        }
        for (const [trimId, reqs] of Object.entries(option.requires_in_trim || {})) {
          if (!trimIds.has(trimId)) integrityErrors.push({ code: 'REQUIRE_UNKNOWN_TRIM', model: model.model_name, variant: variant.variant_name, id, trimId });
          const trim = (variant.trims || []).find((t) => t.trim_id === trimId);
          const available = new Set(trim?.available_options || []);
          for (const req of reqs || []) {
            requirementEdges++;
            if (!master[req]) integrityErrors.push({ code: 'REQUIRE_TRIM_UNKNOWN_OPTION', model: model.model_name, variant: variant.variant_name, id, trimId, req });
            if (!available.has(req)) integrityErrors.push({ code: 'REQUIRE_NOT_AVAILABLE_IN_TRIM', model: model.model_name, variant: variant.variant_name, id, trimId, req });
          }
        }
      }

      for (const trim of variant.trims || []) {
        trims++;
        const available = new Set(trim.available_options || []);
        for (const id of available) {
          availableEdges++;
          if (!master[id]) integrityErrors.push({ code: 'AVAILABLE_UNKNOWN_OPTION', model: model.model_name, variant: variant.variant_name, trim: trim.trim_id, id });
        }

        // Every user-visible toggle transition must leave a valid state.
        let selected = new Set();
        for (const id of trim.available_options || []) {
          const reqs = requiredOptionIds(variant, trim.trim_id, id);
          for (const req of reqs) {
            if (!selected.has(req)) {
              const pre = toggleOptionSelection({ variant, trim, optId: req, selected });
              if (pre.changed) selected = pre.next;
            }
          }
          const result = toggleOptionSelection({ variant, trim, optId: id, selected });
          if (result.changed) selected = result.next;
          const errors = validateOptionSelection({ variant, trim, selected });
          if (errors.length) {
            integrityErrors.push({
              code: 'RUNTIME_SELECTION_INVARIANT',
              model: model.model_name,
              variant: variant.variant_name,
              trim: trim.trim_id,
              option: id,
              selected: selectedNames(master, selected),
              errors,
            });
            break;
          }
        }
      }
    }
  }
}

assert.equal(trims, 443, 'Sales provider-native trim count drift');
assert.deepEqual(integrityErrors, [], 'option relation integrity failed:\n' + JSON.stringify(integrityErrors.slice(0, 20), null, 2));

console.log(JSON.stringify({
  status: 'PASS',
  trims,
  variants,
  optionsMasterEntries,
  availableEdges,
  exclusiveGroups,
  excludeEdges,
  requirementEdges,
  invariantErrors: integrityErrors.length,
}, null, 2));
