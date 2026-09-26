export const STANDARD_CONDITION_POLICY_CONTRACT = 'freepass-standard-condition-policy/v1';

export const STANDARD_BASELINE_CONDITIONS = Object.freeze({
  mileage: '2만km',
  maintenance: '웰스 Basic',
  liability: '1억',
  extraDriver: '없음',
});

function unsupported(field, actual, expected) {
  const error = new Error(
    `FreePass Standard does not yet support ${field}=${String(actual ?? '')}; supported baseline is ${expected}`
  );
  error.code = 'STANDARD_CONDITION_UNSUPPORTED';
  error.field = field;
  error.actual = actual ?? null;
  error.expected = expected;
  return error;
}

export function assertStandardConditionSupport(request) {
  const cond = request?.조건 || {};
  const checks = [
    ['mileage', cond.주행, STANDARD_BASELINE_CONDITIONS.mileage],
    ['maintenance', cond.정비, STANDARD_BASELINE_CONDITIONS.maintenance],
    ['liability', cond.대물, STANDARD_BASELINE_CONDITIONS.liability],
    ['extraDriver', cond.추가운전자, STANDARD_BASELINE_CONDITIONS.extraDriver],
  ];

  for (const [field, actual, expected] of checks) {
    if (String(actual ?? '').trim() !== expected) {
      throw unsupported(field, actual, expected);
    }
  }

  return Object.freeze({
    contract: STANDARD_CONDITION_POLICY_CONTRACT,
    ...STANDARD_BASELINE_CONDITIONS,
  });
}
