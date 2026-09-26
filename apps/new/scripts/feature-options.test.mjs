import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../public/feature-options.js', import.meta.url), 'utf8');
const context = vm.createContext({ Set, Object, Error });
vm.runInContext(code, context);
const rules = context.FreePassFeatureOptions;

const optionsMaster = {
  base: { name: 'Base', price: 10 },
  child: { name: 'Child', price: 20, requires: ['base'] },
  grandchild: { name: 'Grandchild', price: 30, requires: ['child'] },
  pack: { name: 'Pack', price: 40 },
  wheel18: { name: '18', price: 0 },
  wheel19: { name: '19', price: 10 },
  trimReq: { name: 'Trim req', price: 10, requires_in_trim: { premium: ['base'] } },
};

const exclusiveGroups = [{ id: 'wheel', members: ['wheel18', 'wheel19'] }];
const optionExcludes = { pack: ['base'] };

test('requires blocks selection until prerequisites are selected', () => {
  const selected = new Set();
  assert.equal(rules.isOptionEnabled({ selected, optionsMaster, optionExcludes, trimId: 'premium', optionId: 'child' }), false);
  selected.add('base');
  assert.equal(rules.isOptionEnabled({ selected, optionsMaster, optionExcludes, trimId: 'premium', optionId: 'child' }), true);
});

test('exclusive group selection removes the previous member', () => {
  const selected = new Set(['wheel18']);
  rules.setOptionSelected({ selected, optionsMaster, exclusiveGroups, optionExcludes, trimId: 'premium', optionId: 'wheel19', checked: true });
  assert.deepEqual([...selected], ['wheel19']);
});

test('selecting an excluding parent removes excluded options and their dependents', () => {
  const selected = new Set(['base', 'child', 'grandchild']);
  rules.setOptionSelected({ selected, optionsMaster, exclusiveGroups, optionExcludes, trimId: 'premium', optionId: 'pack', checked: true });
  assert.equal(selected.has('base'), false);
  assert.equal(selected.has('child'), false);
  assert.equal(selected.has('grandchild'), false);
  assert.equal(selected.has('pack'), true);
});

test('deselecting a prerequisite removes dependent chains', () => {
  const selected = new Set(['base', 'child', 'grandchild']);
  rules.setOptionSelected({ selected, optionsMaster, exclusiveGroups, optionExcludes, trimId: 'premium', optionId: 'base', checked: false });
  assert.equal(selected.size, 0);
});

test('trim-specific requires joins global requires', () => {
  const selected = new Set();
  assert.deepEqual([...rules.requiredOptionIds(optionsMaster, 'premium', 'trimReq')], ['base']);
});
