import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLE_GUEST,
  ROLE_STAFF,
  normalizeRole,
  roleCan,
  rolePolicy,
  conditionDefaultsForRole,
} from '../src/lib/feature/roles.js';

test('unknown roles fail closed to guest', () => {
  assert.equal(normalizeRole('admin'), ROLE_GUEST);
  assert.equal(normalizeRole(null), ROLE_GUEST);
});

test('guest can build and share a customer quote but cannot use staff operations', () => {
  const policy = rolePolicy(ROLE_GUEST);
  assert.equal(policy.canConfigureVehicle, true);
  assert.equal(policy.canConfigurePublicConditions, true);
  assert.equal(policy.canShareQuote, true);
  assert.equal(policy.canRequoteSharedQuote, true);
  assert.equal(policy.canEditInternalCredit, false);
  assert.equal(policy.canEditInternalFinanceTerms, false);
  assert.equal(policy.canEditDeliveryRegion, false);
  assert.equal(policy.canEditStaffIdentity, false);
  assert.equal(policy.canSendOfficialQuote, false);
  assert.equal(policy.canShareSignatureLink, false);
});

test('staff owns internal terms and operational send actions', () => {
  const policy = rolePolicy(ROLE_STAFF);
  assert.equal(policy.canEditInternalCredit, true);
  assert.equal(policy.canEditInternalFinanceTerms, true);
  assert.equal(policy.canEditDeliveryRegion, true);
  assert.equal(policy.canEditStaffIdentity, true);
  assert.equal(policy.canSendOfficialQuote, true);
  assert.equal(policy.canShareSignatureLink, true);
});

test('unknown feature names fail closed', () => {
  assert.equal(roleCan(ROLE_STAFF, 'delete_everything'), false);
});


test('guest starts without deposit while staff uses configured staff deposit', () => {
  assert.deepEqual(conditionDefaultsForRole(ROLE_GUEST, { staffDeposit: 10 }), {
    credit: '중신용',
    dep: 0,
    pre: 0,
  });
  assert.deepEqual(conditionDefaultsForRole(ROLE_STAFF, { staffDeposit: 10 }), {
    credit: '중신용',
    dep: 10,
    pre: 0,
  });
});
