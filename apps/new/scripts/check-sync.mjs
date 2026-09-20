// ============================================================================
//  웰릭스 견적 ERP 동기화 닥터   —   node scripts/check-sync.mjs  (= npm run check)
// ----------------------------------------------------------------------------
//  새 엑셀이 오거나 견적이 의심될 때 "어느 변수를 어디서 고쳐야 하는지"
//  한 번에 점검한다.
//
//  ⚠️ 가장 자주 터지는 사고: calc.js 기본값만 고치고 welrix.json 을 안 고침.
//     런타임(웹 ERP·모바일·홈)은 public/data/company-config/welrix.json 을
//     setCompanyConfig 로 로드하므로, 이 파일이 안 바뀌면 견적이 안 변한다.
//
//  설정 우선순위(런타임 실효값):
//     public/…/welrix.json(런타임 SSOT)  >  calc.js DEFAULT_CFG(fallback)
//     ※ 런타임(웹/모바일/홈)은 fetch('/data/company-config/welrix.json')=public 만 사용.
//
//  검사: [1] 변수 일치(2소스 대조)  [2] 회귀(엑셀 기대값)  [3] 차량DB  [4] 체크리스트
//  종료코드: 불일치/회귀실패 1, 깨끗 0
// ============================================================================
import { readFileSync } from 'node:fs';
import { calcQuote, setCompanyConfig, getDefaultConfig, getActiveConfig } from '../src/lib/calc.js';
import { buildCalcInput } from '../src/lib/build-calc-input.js';
import { ENGINE_CASES, ASSEMBLY_CASES, DEPOSIT_CASES } from './excel-cases.mjs';

const R='\x1b[31m',G='\x1b[32m',Y='\x1b[33m',C='\x1b[36m',B='\x1b[1m',D='\x1b[2m',X='\x1b[0m';
const url = (p) => new URL(p, import.meta.url);
// 값 표시: 정수는 천단위, 소수(이자율 등)는 그대로 — 반올림 금지(0.041→0 사고 방지)
const show = (n) => n == null ? String(n)
  : (typeof n === 'number' ? (Number.isInteger(n) ? n.toLocaleString() : String(n)) : JSON.stringify(n));
let problems = 0;

const PUB = '../public/data/company-config/welrix.json';
const pub = JSON.parse(readFileSync(url(PUB), 'utf-8'));
const vehicles = JSON.parse(readFileSync(url('../public/data/vehicles.json'), 'utf-8'));

// 의미 없는 키(주석/메타) — 드리프트 비교에서 제외
const IGNORE = (k) => k.startsWith('_');
function diff(a, b, path, out) {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push([path, a, b]);
    return;
  }
  for (const k of new Set([...Object.keys(a||{}), ...Object.keys(b||{})])) {
    if (IGNORE(k)) continue;
    diff(a?.[k], b?.[k], path ? `${path}.${k}` : k, out);
  }
}

// ── [1] 변수 일치 ────────────────────────────────────────────────────────────
console.log(`\n${B}${C}[1] 변수 일치 검사 (2소스 대조)${X}`);

// 1a) 런타임 실효값(public welrix.json 주입 후) ↔ calc.js 기본값(fallback)
//     ※ setCompanyConfig 가 payback_table 등을 정규화하므로 "실효 설정"끼리 비교(형식차 거짓양성 방지)
const def = getDefaultConfig();
setCompanyConfig(pub);
const eff = getActiveConfig();
const d1 = []; diff(def, eff, '', d1);
console.log(`\n  ${B}1a. calc.js 기본값  ⟷  public/welrix.json (런타임 실효값)${X}`);
if (!d1.length) console.log(`     ${G}✓ 일치${X}`);
else {
  console.log(`     ${R}✗ ${d1.length}개 불일치${X} ${D}(calc.js DEFAULT_CFG 를 손으로 맞춰야 함 — JS 라 자동수정 안 함)${X}`);
  for (const [p, dv, pv] of d1) {
    console.log(`        ${Y}${p}${X}  기본값 ${show(dv)}  ${D}≠${X}  welrix ${B}${show(pv)}${X}`);
    problems++;
  }
}

// ── [2] 회귀 (엑셀 기대값) — 런타임 실효 설정(public)으로 계산 ─────────────────
// 기준 케이스는 scripts/excel-cases.mjs(SSOT)에서 가져옴. 여긴 러너만.
console.log(`\n${B}${C}[2] 회귀 검사 (public welrix.json 설정으로 → 엑셀 기대값)${X}`);
setCompanyConfig(pub);
const base = { insurance:{property:'1억',extraDriver:'없음',exec:'미가입',injury:'무한',self:'1억',uninsured:'2억',deductible:'30만원~',emergency:'가입'}, fees:{feeRatePct:5.0,svc:'웰스 Basic'} };

// (A) 엔진 직접 검증
for (const t of ENGINE_CASES) {
  const m = calcQuote(t.input).monthly;
  const ok = m === t.expectMonthly;
  console.log(`  ${ok ? G+'✓' : R+'✗'} ${t.label}  우리 ${m.toLocaleString()} / 엑셀 ${t.expectMonthly.toLocaleString()}  diff ${(m-t.expectMonthly).toLocaleString()}  (${t.cell})${X}`);
  if (!ok) problems++;
}

// (B) 입력조립(buildCalcInput) 검증 — 탁송/썬팅 셀 수식 + 내비/하이패스 제외
for (const t of ASSEMBLY_CASES) {
  const inp = buildCalcInput(t.state, t.scenario, vehicles);
  const r = calcQuote(inp);
  const got = { itemsFee: inp.options.itemsFee, C14: r._debug.C14, C32: r._debug.C32 };
  const fails = Object.keys(t.expect).filter(k => got[k] !== t.expect[k]);
  const ok = fails.length === 0;
  console.log(`  ${ok ? G+'✓' : R+'✗'} ${t.label}${X}`);
  console.log(`      itemsFee=${got.itemsFee.toLocaleString()} · C14=${got.C14.toLocaleString()} · C32=${got.C32.toLocaleString()}`
    + (ok ? '' : `  ${R}불일치: ${fails.map(k=>`${k} 기대 ${t.expect[k].toLocaleString()}`).join(', ')}${X}`));
  if (!ok) problems++;
}

// (C) 보증금 v6.1 — 저신용 올림(CEILING 50만)/그외(무신용 포함) 반올림(ROUND 10만)/클램프
for (const t of DEPOSIT_CASES) {
  const got = calcQuote({
    vehicle: { brand: '·', model: '·', trim: '·', price: t.price, disp: 1600, fuel: '가솔린', tax_exempt: '과세', group: 'A군', multi_seat: null, r24: 0.65, r36: 0.55, r48: 0.48, r60: 0.4, strategic: 0, buyback_apply: 0 },
    options: { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
    contract: { term: 60, km: '2만km', dep: t.dep, pre: 0 }, customer: { creditGrade: t.credit }, ...base,
  }).depositAmt;
  const ok = got === t.expect;
  console.log(`  ${ok ? G+'✓' : R+'✗'} 보증금 ${t.credit} ${t.dep}% (${t.price.toLocaleString()})  ${got.toLocaleString()} / 기대 ${t.expect.toLocaleString()}  ${D}${t.note}${X}`);
  if (!ok) problems++;
}

// 포터 — base_porter(v4.5 1.4M ↔ v5.5 2.0M) 가 결과를 가르는 설정-버전 탐지 케이스
const p = vehicles.find(v => /포터/.test(v.model) || /포터/.test(v.trim||''));
if (p) {
  const pm = calcQuote({ vehicle:{ brand:p.brand,model:p.model,trim:p.trim,price:p.price,disp:p.disp,fuel:p.fuel,tax_exempt:p.tax_exempt,group:p.group,multi_seat:p.multi_seat,r24:p.r24,r36:p.r36,r48:p.r48,r60:p.r60,strategic:p.strategic,buyback_apply:p.buyback_apply },
    options:{ optPrice:0,discount:0,deliveryFee:0,itemsFee:0,etc:0 }, contract:{ term:60,km:'2만km',dep:10,pre:0 }, customer:{ creditGrade:'중신용' }, ...base }).monthly;
  console.log(`  ${C}· 포터 60M/보증10/중신용  월 ${pm.toLocaleString()}${X}  ${D}(base_porter=${show(pub.financial.insurance.base_porter)} 적용 — 엑셀 견적1!I10 대조)${X}`);
}

// ── [3] 차량DB 건전성 ────────────────────────────────────────────────────────
console.log(`\n${B}${C}[3] 차량DB(vehicles.json)${X}`);
const badPrice = vehicles.filter(v => !(v.price > 0)).length;
const badResid = vehicles.filter(v => !(v.r60 > 0 && v.r60 < 1)).length;
const noStrat  = vehicles.filter(v => !('strategic' in v)).length;
console.log(`  · ${vehicles.length}대 / 가격결측 ${badPrice} / r60이상 ${badResid} / strategic누락 ${noStrat}`);
if (badPrice || badResid) problems++;

// ── [4] 체크리스트 ───────────────────────────────────────────────────────────
console.log(`\n${B}${C}[4] 새 엑셀이 오면 — 변수 동기화 절차${X}`);
console.log(`  1. _source/견적기/ 에 신버전 .xlsx 드롭`);
console.log(`  2. python scripts/compare-excel-versions.py [old] [new]   ${D}← 바뀐 셀 추출${X}`);
console.log(`  3. ${B}public/…/welrix.json${X} 의 financial 값 수정  ${D}(런타임 실효 SSOT)${X}`);
console.log(`  4. ${B}calc.js DEFAULT_CFG${X} 도 동일하게 수정  ${D}(fallback — [1a]가 불일치 잡아줌)${X}`);
console.log(`  5. ${B}npm run check${X}  ${D}(= node scripts/check-sync.mjs) — 회귀검증${X}`);
console.log(`  6. 가격/잔가율 바뀌면 → python scripts/sync-vehicles-from-excel.py`);
console.log(`  7. git push (Vercel 자동) → Ctrl+Shift+R`);

console.log(`\n${B}${problems ? R+`✗ 문제 ${problems}건` : G+'✓ 전부 동기화됨'}${X}\n`);
process.exit(problems ? 1 : 0);
