import assert from 'node:assert/strict';
import { 공급자설정, 공급자키 } from '../src/lib/quote/provider-config.js';
import { 결과검사, 요청검사 } from '../src/lib/quote/spec.js';
import * as 표준 from '../src/lib/quote/engines/freepass-standard.js';

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
  차: {
    종류: '신차',
    키: 'TEST-TRIM',
    브랜드: '현대',
    모델: '테스트',
    트림: '프리미엄',
    배기량: 1999,
    연료: '가솔린',
    과세구분: '과세',
    그룹: 'A군',
    전략차종: 0,
    잔가: { 24: .65, 36: .55, 48: .48, 60: .40 },
    가격: {
      트림: 30000000,
      옵션: 0,
      외장색: 0,
      내장색: 0,
      할인: 0,
      표준계산차량가: 30000000,
    },
  },
  조건: {
    신용: '중신용',
    주행: '2만km',
    정비: '웰스 Basic',
    대물: '1억',
    추가운전자: '없음',
    탁송비: 0,
    썬팅비: 0,
    블박비: 0,
    수수료율: 5,
  },
  안들: [
    { 기간: 36, 보증금: 0, 선납: 0 },
    { 기간: 48, 보증금: 0, 선납: 0 },
    { 기간: 60, 보증금: 0, 선납: 0 },
  ],
};

assert.equal(요청검사(request), null);
const answer = await 표준.계산(request);
assert.equal(결과검사(answer.결과, request.안들), null);
assert.equal(answer.결과.length, 3);
for (const row of answer.결과) {
  assert.ok(Number.isFinite(row.월대여료) && row.월대여료 > 0);
  assert.ok(Number.isFinite(row.총차량가) && row.총차량가 > 0);
}

// Provider choice is configuration, never a user-facing quote-screen control.
const fs = await import('node:fs');
for (const file of ['index.html', 'mobile.html']) {
  const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  assert.ok(!/FreePass 표준|외부 Excel|외부 ERP|quote_provider/.test(html),
    `${file}: provider selection leaked into quote UI`);
}

console.log('✓ quote provider contract — standard/external Excel/external ERP share one UI contract');
