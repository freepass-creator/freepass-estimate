import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { audit, inspectStructure } from './audit-official-option-reference.mjs';

function reference(rules) {
  return { authority: 'RESEARCH_REFERENCE_NOT_CANONICAL', productionReady: false, observedDate: '2026-10-31',
    snapshot: { scope: 'test fixture only' }, sources: { official: { url: 'https://www.kia.com/kr/vehicles/k5/price/rent' } },
    rules: rules.map(rule => ({ id: rule.kind, sourceId: 'official', match: { model: '차량', variant: '엔진', trims: ['트림'] }, ...rule })) };
}
function fixture(options, extra = {}) {
  return { manufacturers: [{ models: [{ model_name: '차량', variants: [{
    variant_name: '엔진', options_master: options, exclusive_groups: [], option_excludes: {},
    trims: [{ trim_id: 'trim', name: '트림', available_options: Object.keys(options) }], ...extra,
  }] }] }] };
}
function engine() {
  const context = vm.createContext({ Set });
  vm.runInContext(fs.readFileSync(new URL('../public/feature-options.js', import.meta.url), 'utf8'), context);
  return context.FreePassFeatureOptions;
}

test('an at-most-one group permits no selection and rejects the pair only', () => {
  const db = fixture({ six: { name: '6인승' }, seven: { name: '7인승' } },
    { exclusive_groups: [{ id: 'seats', members: ['six', 'seven'] }] });
  const rule = reference([{ kind: 'MUTEX', subject: ['6인승'], target: ['7인승'] }]);
  assert.equal(audit(db, rule).observations[0].finding, 'SNAPSHOT_RELATION_PRESENT');
  const selected = new Set();
  const variant = db.manufacturers[0].models[0].variants[0];
  const ctx = { selected, optionsMaster: variant.options_master, exclusiveGroups: variant.exclusive_groups, trimId: 'trim' };
  engine().setOptionSelected({ ...ctx, optionId: 'six', checked: true });
  engine().setOptionSelected({ ...ctx, optionId: 'six', checked: false });
  assert.equal(selected.size, 0);
});

test('a historical exclusion mistranslated into mutual requires is detected as both missing exclusion and a cycle', () => {
  const db = fixture({ cam: { name: '빌트인 캠', requires: ['mirror'] }, mirror: { name: '센터 미러', requires: ['cam'] } });
  const result = audit(db, reference([{ kind: 'MUTEX', subject: ['빌트인 캠'], target: ['센터 미러'] }]));
  assert.equal(result.observations[0].finding, 'CANDIDATE_RELATION_MISSING');
  assert.ok(result.structure.issues.some(issue => issue.code === 'CYCLIC_REQUIREMENT'));
});

test('package coverage must not be counted as evidence for sibling exclusion', () => {
  const db = fixture({ popular: { name: '파퓰러' }, first: { name: '개별Ⅰ' }, second: { name: '개별Ⅱ' } },
    { exclusive_groups: [{ id: 'wrong', members: ['popular', 'first', 'second'] }],
      option_excludes: { popular: ['first', 'second'] } });
  const result = audit(db, reference([{ kind: 'BUNDLE_REVIEW', subject: ['파퓰러'], children: [['개별Ⅰ'], ['개별Ⅱ']] }]), engine());
  assert.equal(result.observations[0].finding, 'BUNDLE_CHILDREN_MUTUALLY_BLOCKED_REVIEW');
  assert.deepEqual(result.observations[0].blockedPairs[0].selectedAfterReplay, ['second']);
  assert.equal(result.observations[0].confidence, 'OFFICIAL_BTO_COEXISTENCE_CONFIRMATION_REQUIRED');
});

test('trim-specific price overrides and exact powertrain scope prevent cross-trim corrections', () => {
  const db = fixture({ style: { name: '스타일', price: 89, trim_prices: { trim: 69 } } });
  const result = audit(db, reference([
    { kind: 'PRICE', subject: ['스타일'], expectedWon: 690000 },
    { kind: 'PRICE', id: 'rent', match: { model: '차량', variant: '렌터카', trims: ['트림'] }, subject: ['스타일'], expectedWon: 1 },
  ]));
  assert.equal(result.observations[0].finding, 'SNAPSHOT_VALUE_MATCH');
  assert.equal(result.observations[1].finding, 'NO_EXACT_SNAPSHOT_SCOPE');
  assert.equal(result.observations[0].identityStatus, 'OPERATING_RELEASE_AND_MODEL_YEAR_ALIGNMENT_UNVERIFIED');
});

test('free or already included items remain review candidates when separately selectable', () => {
  const db = fixture({ nav: { name: '내비게이션', price: 0 } });
  const result = audit(db, reference([{ kind: 'INCLUDED', subject: ['내비게이션'] }]));
  assert.equal(result.observations[0].finding, 'INCLUDED_ITEM_STILL_SELECTABLE_REVIEW');
});

test('the auditor refuses production policy input and never mutates snapshot data', () => {
  const db = fixture({ style: { name: '스타일', price: 89 } });
  const before = JSON.stringify(db);
  const ref = reference([{ kind: 'PRICE', subject: ['스타일'], expectedWon: 690000 }]);
  const result = audit(db, ref);
  assert.equal(result.productionWrites, 0);
  assert.equal(JSON.stringify(db), before);
  assert.throws(() => audit(db, { ...ref, productionReady: true }));
  assert.throws(() => audit(db, { ...ref, sources: {} }));
});

test('unavailable prerequisites are distinct from unknown IDs', () => {
  const db = fixture({ nav: { name: '기본 내비' }, park: { name: '주차', requires: ['nav'] } },
    { trims: [{ trim_id: 'trim', name: '트림', available_options: ['park'] }] });
  const issues = inspectStructure(db).issues;
  assert.equal(issues[0].code, 'REQUIRED_OPTION_NOT_SELECTABLE_IN_TRIM');
});

test('existing projection can leak one trim prerequisite into another when an option ID is shared', async () => {
  const { buildVehicleDbFromEstimateMaster } = await import('../src/lib/master/vehicle-db-projection.js');
  const money = amount => ({ amount, currency: 'KRW' });
  const color = { colorId: 'black', name: '블랙', price: money(0) };
  const base = {
    vehicleModelId: 'model', modelYearId: 'year', modelYear: 2027, powertrainId: 'engine',
    maker: '시험', model: '차량', powertrainName: '엔진', basePrice: money(30000000),
    exteriorColors: [color], interiorColors: [color], configuration: {}, status: 'ACTIVE',
  };
  const option = (optionId, requires = []) => ({ optionId, name: optionId, price: money(100000), requires, excludes: [] });
  const projected = buildVehicleDbFromEstimateMaster({
    meta: { authority: 'CANONICAL_ACTIVE', projectionId: 'estimate-newcar-master' },
    records: [
      { ...base, productId: 'low', trimId: 'low', trimName: '하위', options: [option('cluster'), option('hud', ['cluster'])] },
      { ...base, productId: 'high', trimId: 'high', trimName: '상위', options: [option('hud')] },
    ],
  });
  const issues = inspectStructure(projected.vehicleDb).issues;
  assert.ok(issues.some(issue => issue.code === 'REQUIRED_OPTION_NOT_SELECTABLE_IN_TRIM' && issue.trimId === 'high'));
});
