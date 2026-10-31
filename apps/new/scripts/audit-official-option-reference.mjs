import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const normalize = value => String(value ?? '').normalize('NFKC').replace(/[\s"'+]/g, '').toLowerCase();
const countBy = values => values.reduce((out, value) => ({ ...out, [value]: (out[value] || 0) + 1 }), {});
const same = (a, b) => normalize(a) === normalize(b);
const matches = (value, aliases) => (aliases || []).some(alias => same(value, alias));
const available = (variant, trim, aliases) => (trim.available_options || [])
  .filter(id => matches(variant.options_master?.[id]?.name, aliases));
const requires = (variant, trim, id) => [...new Set([
  ...(variant.options_master?.[id]?.requires || []),
  ...(variant.options_master?.[id]?.requires_in_trim?.[trim.trim_id] || []),
])];
const conflicts = (variant, a, b) => (variant.exclusive_groups || [])
  .some(group => (group.members || []).includes(a) && (group.members || []).includes(b))
  || (variant.option_excludes?.[a] || []).includes(b)
  || (variant.option_excludes?.[b] || []).includes(a);

export function inspectStructure(db) {
  const stats = { models: 0, variants: 0, trims: 0, optionEntries: 0, exclusiveGroups: 0, requiresRefs: 0, excludesRefs: 0 };
  const issues = [];
  for (const maker of db.manufacturers || []) for (const model of maker.models || []) {
    stats.models++;
    for (const variant of model.variants || []) {
      stats.variants++;
      const options = variant.options_master || {};
      const optionIds = new Set(Object.keys(options));
      const scoped = { model: model.model_name, variant: variant.variant_name };
      stats.optionEntries += optionIds.size;
      stats.exclusiveGroups += (variant.exclusive_groups || []).length;
      for (const group of variant.exclusive_groups || []) {
        if (new Set(group.members || []).size < 2) issues.push({ ...scoped, code: 'GROUP_WITH_FEWER_THAN_TWO_MEMBERS', groupId: group.id });
        for (const id of group.members || []) if (!optionIds.has(id)) issues.push({ ...scoped, code: 'UNKNOWN_GROUP_OPTION', optionId: id });
      }
      for (const [parent, targets] of Object.entries(variant.option_excludes || {})) {
        stats.excludesRefs += targets.length;
        for (const id of [parent, ...targets]) if (!optionIds.has(id)) issues.push({ ...scoped, code: 'UNKNOWN_EXCLUSION_OPTION', optionId: id });
      }
      for (const [id, option] of Object.entries(options)) {
        const refs = [...(option.requires || []), ...Object.values(option.requires_in_trim || {}).flat()];
        stats.requiresRefs += refs.length;
        for (const ref of refs) if (!optionIds.has(ref) || ref === id) issues.push({ ...scoped, code: 'INVALID_REQUIREMENT_REFERENCE', optionId: id, target: ref });
      }
      for (const trim of variant.trims || []) {
        stats.trims++;
        const ids = new Set(trim.available_options || []);
        for (const id of ids) {
          if (!optionIds.has(id)) { issues.push({ ...scoped, code: 'UNDEFINED_TRIM_OPTION', trimId: trim.trim_id, optionId: id }); continue; }
          for (const ref of requires(variant, trim, id)) if (!ids.has(ref)) issues.push({ ...scoped, code: 'REQUIRED_OPTION_NOT_SELECTABLE_IN_TRIM', trimId: trim.trim_id, optionId: id, target: ref });
        }
        const walk = (id, stack = []) => {
          if (stack.includes(id)) { issues.push({ ...scoped, code: 'CYCLIC_REQUIREMENT', trimId: trim.trim_id, path: [...stack, id] }); return; }
          for (const next of requires(variant, trim, id)) if (ids.has(next)) walk(next, [...stack, id]);
        };
        for (const id of ids) walk(id);
      }
    }
  }
  return { stats, issues };
}

export function inspectReference(db, reference, engine = null) {
  if (reference.authority !== 'RESEARCH_REFERENCE_NOT_CANONICAL' || reference.productionReady !== false) {
    throw new Error('Only a non-production manufacturer research reference is accepted');
  }
  const rows = [];
  for (const rule of reference.rules) {
    if (!reference.sources[rule.sourceId]?.url?.startsWith('https://')) throw new Error('Missing source for ' + rule.id);
    const contexts = [];
    for (const maker of db.manufacturers || []) for (const model of maker.models || []) {
      if (!same(model.model_name, rule.match.model)) continue;
      for (const variant of model.variants || []) {
        if (rule.match.variant && !same(variant.variant_name, rule.match.variant)) continue;
        for (const trim of variant.trims || []) {
          if (rule.match.trims && !matches(trim.name, rule.match.trims)) continue;
          contexts.push({ model, variant, trim });
        }
      }
    }
    if (rule.kind === 'MANUAL') {
      rows.push({ ruleId: rule.id, finding: 'MANUAL_SCOPE_OR_SCHEMA_REVIEW', matchingSnapshotTrims: contexts.length });
      continue;
    }
    if (!contexts.length) { rows.push({ ruleId: rule.id, finding: 'NO_EXACT_SNAPSHOT_SCOPE' }); continue; }
    for (const { model, variant, trim } of contexts) {
      const base = { ruleId: rule.id, model: model.model_name, variant: variant.variant_name, trim: trim.name, trimId: trim.trim_id,
        identityStatus: 'OPERATING_RELEASE_AND_MODEL_YEAR_ALIGNMENT_UNVERIFIED' };
      const ids = available(variant, trim, rule.subject);
      if (rule.kind === 'NOT_AVAILABLE') {
        rows.push({ ...base, finding: ids.length ? 'UNEXPECTED_SELECTABLE_OPTION' : 'NOT_OFFERED_SEPARATELY', optionIds: ids });
        continue;
      }
      if (rule.kind === 'INCLUDED') {
        rows.push({ ...base, finding: ids.length ? 'INCLUDED_ITEM_STILL_SELECTABLE_REVIEW' : 'NOT_OFFERED_SEPARATELY', optionIds: ids });
        continue;
      }
      if (!ids.length) { rows.push({ ...base, finding: 'OPTION_NOT_IN_SNAPSHOT_SCOPE' }); continue; }
      if (ids.length > 1) { rows.push({ ...base, finding: 'AMBIGUOUS_OPTION_IDENTITY', optionIds: ids }); continue; }
      const id = ids[0];
      if (rule.kind === 'PRICE') {
        const option = variant.options_master[id];
        const actualWon = (option.trim_prices?.[trim.trim_id] ?? option.price) * 10000;
        if (!Number.isSafeInteger(actualWon)) throw new Error('Non-integer snapshot price: ' + id);
        rows.push({ ...base, finding: actualWon === rule.expectedWon ? 'SNAPSHOT_VALUE_MATCH' : 'CANDIDATE_PRICE_DIFFERENCE',
          optionId: id, snapshotWon: actualWon, officialWon: rule.expectedWon, differenceWon: actualWon - rule.expectedWon });
      } else if (rule.kind === 'MUTEX' || rule.kind === 'REQUIRES') {
        const targets = available(variant, trim, rule.target);
        if (targets.length !== 1) {
          rows.push({ ...base, finding: 'RELATION_TARGET_UNAVAILABLE_OR_AMBIGUOUS', optionId: id, targets });
          continue;
        }
        const target = targets[0];
        const represented = rule.kind === 'MUTEX' ? conflicts(variant, id, target) : requires(variant, trim, id).includes(target);
        rows.push({ ...base, finding: represented ? 'SNAPSHOT_RELATION_PRESENT' : 'CANDIDATE_RELATION_MISSING', optionId: id, target });
      } else if (rule.kind === 'BUNDLE_REVIEW') {
        const children = rule.children.map(names => available(variant, trim, names));
        if (children.some(ids => ids.length !== 1)) {
          rows.push({ ...base, finding: 'BUNDLE_CHILD_IDENTITY_REVIEW' }); continue;
        }
        const childIds = children.map(ids => ids[0]);
        const blockedPairs = [];
        for (let a = 0; a < childIds.length; a++) for (let b = a + 1; b < childIds.length; b++) {
          if (!conflicts(variant, childIds[a], childIds[b])) continue;
          const selected = new Set();
          if (engine) {
            const ctx = { selected, optionsMaster: variant.options_master, exclusiveGroups: variant.exclusive_groups, optionExcludes: variant.option_excludes, trimId: trim.trim_id };
            engine.setOptionSelected({ ...ctx, optionId: childIds[a], checked: true });
            engine.setOptionSelected({ ...ctx, optionId: childIds[b], checked: true });
          }
          blockedPairs.push({ optionIds: [childIds[a], childIds[b]], selectedAfterReplay: engine ? [...selected] : null });
        }
        rows.push({ ...base, finding: blockedPairs.length ? 'BUNDLE_CHILDREN_MUTUALLY_BLOCKED_REVIEW' : 'BUNDLE_CHILDREN_NOT_MUTUALLY_BLOCKED',
          blockedPairs, confidence: 'OFFICIAL_BTO_COEXISTENCE_CONFIRMATION_REQUIRED' });
      } else throw new Error('Unsupported research kind: ' + rule.kind);
    }
  }
  return rows;
}

export function audit(db, reference, engine = null) {
  const structure = inspectStructure(db);
  const observations = inspectReference(db, reference, engine);
  return {
    schema: 'freepass-option-research-audit/v1', observedDate: reference.observedDate,
    verdict: 'REVIEW_REQUIRED_NOT_OPERATIONAL_VERIFICATION',
    snapshot: reference.snapshot, sourceRuleCount: reference.rules.length,
    structure, findingsByType: countBy(observations.map(row => row.finding)), observations,
    productionWrites: 0,
    limitations: [
      'No current CANONICAL_ACTIVE payload or live UI/API was read.',
      'Model year, generation, powertrain, body, trim, tax basis and effective date must align before approving any correction.',
      'A structural pass does not prove official compatibility. A snapshot match does not prove production correctness.',
      'Unmatched scopes are not guessed; no manufacturer facts or IDs are imported into a runtime master.',
      'Bundle inclusion is not proof of sibling mutual exclusion; G80 remains a reviewed candidate pending official BTO coexistence confirmation.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const dbPath = value('--db', new URL('../public/vehicle-db.js', import.meta.url));
  const rulesPath = value('--rules', new URL('../../../docs/references/manufacturers/option-constraints-20261031.json', import.meta.url));
  const enginePath = value('--engine', new URL('../public/feature-options.js', import.meta.url));
  const bytes = fs.readFileSync(dbPath);
  const context = { window: {}, Set };
  vm.createContext(context);
  vm.runInContext(bytes.toString('utf8'), context, { timeout: 5000 });
  vm.runInContext(fs.readFileSync(enginePath, 'utf8'), context, { timeout: 5000 });
  const reference = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  const result = audit(context.window.VEHICLE_DB, reference, context.FreePassFeatureOptions);
  result.actualInputSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  result.actualSnapshotMeta = context.window.__FREEPASS_NEW_CAR_META || null;
  console.log(JSON.stringify(result, null, 2));
}
