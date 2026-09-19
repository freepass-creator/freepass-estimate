import assert from 'node:assert/strict';
import { 공급자설정, 공급자키 } from '../src/lib/quote/provider-config.js';
import { 결과검사, 요청검사 } from '../src/lib/quote/spec.js';

const standardCfg = { quote_provider: { mode: 'standard', adapter_id: 'freepass-standard' } };
assert.deepEqual(공급자설정(standardCfg), {
  mode: 'standard', kind: null, adapter_id: 'freepass-standard',
});
assert.equal(공급자키(standardCfg), 'standard');

const excelCfg = { quote_provider: { mode: 'external', kind: 'excel', adapter_id: 'welrix' } };
assert.deepEqual(공급자설정(excelCfg), {
  mode: 'external', kind: 'excel', adapter_id: 'welrix',
});
assert.equal(공급자키(excelCfg), 'external:excel:welrix');

const erpCfg = { quote_provider: { mode: 'external', kind: 'erp', adapter_id: 'partner-erp' } };
assert.equal(공급자키(erpCfg), 'external:erp:partner-erp');

const request = {
  버전: 1,
  차: { 종류: '신차', 키: 'TEST-TRIM' },
  조건: {},
  안들: [{ 기간: 36, 보증금: 0, 선납: 0 }],
};
assert.equal(요청검사(request), null);
assert.equal(결과검사([{ 월대여료: 1 }], request.안들), null);

// Calculation implementations are tested separately:
// - server-side FreePass standard: check-standard-engine.mjs
// - external adapters: regression/probe scripts.
// This contract test only locks the shared request/result shape and provider routing.

// Provider choice is configuration, never a user-facing quote-screen control.
const fs = await import('node:fs');
for (const file of ['index.html', 'mobile.html']) {
  const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  assert.ok(!/FreePass 표준|외부 Excel|외부 ERP|quote_provider/.test(html),
    `${file}: provider selection leaked into quote UI`);
}

console.log('✓ quote provider contract — standard/external Excel/external ERP share one UI contract');
