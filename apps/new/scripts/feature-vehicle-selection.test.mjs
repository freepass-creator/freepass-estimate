import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../public/feature-vehicle-selection.js', import.meta.url), 'utf8');
const context = vm.createContext({ Set, Object, Error, Number, Boolean });
vm.runInContext(code, context);
const rules = context.FreePassVehicleSelection;

function state() {
  return {
    manufacturer: 'hyundai',
    model: 'santafe',
    variant: 'gasoline',
    trimGroup: '5인승 2WD',
    trim: 'premium',
    options: new Set(['sunroof']),
    color: 2,
  };
}

test('re-selecting same manufacturer is non-destructive', () => {
  const s = state();
  const result = rules.applySelection(s, 'manufacturer', 'hyundai');
  assert.equal(result.changed, false);
  assert.equal(s.model, 'santafe');
  assert.equal(s.trim, 'premium');
  assert.deepEqual([...s.options], ['sunroof']);
  assert.equal(s.color, 2);
});

test('changing manufacturer clears every dependent selection', () => {
  const s = state();
  const result = rules.applySelection(s, 'manufacturer', 'kia');
  assert.equal(result.changed, true);
  assert.equal(s.manufacturer, 'kia');
  assert.equal(s.model, null);
  assert.equal(s.variant, null);
  assert.equal(s.trimGroup, null);
  assert.equal(s.trim, null);
  assert.equal(s.options.size, 0);
  assert.equal(s.color, null);
});

test('changing variant clears spec group, trim, options, and color only', () => {
  const s = state();
  rules.applySelection(s, 'variant', 'hybrid');
  assert.equal(s.manufacturer, 'hyundai');
  assert.equal(s.model, 'santafe');
  assert.equal(s.variant, 'hybrid');
  assert.equal(s.trimGroup, null);
  assert.equal(s.trim, null);
  assert.equal(s.options.size, 0);
  assert.equal(s.color, null);
});

test('changing trim preserves upstream identity and resets trim-dependent choices', () => {
  const s = state();
  rules.applySelection(s, 'trim', 'calligraphy');
  assert.equal(s.variant, 'gasoline');
  assert.equal(s.trimGroup, '5인승 2WD');
  assert.equal(s.trim, 'calligraphy');
  assert.equal(s.options.size, 0);
  assert.equal(s.color, null);
});

test('variant advances to spec only when operating trims have multiple groups', () => {
  const one = { trims: [{ group: '5인승 2WD', operating: true }, { group: '5인승 2WD', operating: true }] };
  const many = { trims: [{ group: '5인승 2WD' }, { group: '7인승 4WD' }, { group: '9인승', operating: false }] };
  assert.equal(rules.nextStepAfterSelection('variant', { variant: one }), 'trim');
  assert.equal(rules.nextStepAfterSelection('variant', { variant: many }), 'spec');
});

test('trim advances to colors only when color data exists', () => {
  assert.equal(rules.nextStepAfterSelection('trim', { trim: { _exterior_colors: [{ name: 'white' }] } }), 'colors');
  assert.equal(rules.nextStepAfterSelection('trim', { trim: {}, model: {} }), 'options');
});
