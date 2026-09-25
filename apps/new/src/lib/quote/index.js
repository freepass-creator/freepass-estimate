// ============================================================================
// FreePass Estimate quote core
// 화면은 하나. 계산 공급자는 회사/채널 설정으로 갈아끼운다.
//   STANDARD → FreePass 표준
//   EXTERNAL → Excel 또는 ERP/API adapter
// ============================================================================
import { reactive } from 'vue';
import { 요청만들기 } from './build-request.js';
import { 견적계산, 활성계산기이름, 계산기들 } from './calculate.js';
import { 공급자키 } from './provider-config.js';

export { 계산기들 };
let 강제계산기 = null; // 개발/회귀 비교 전용. 운영 UI에는 노출하지 않는다.

export function 계산기고르기(이름 = null) {
  if (이름 != null && !계산기들[이름]) throw new Error(`그런 계산기가 없다: ${이름}`);
  강제계산기 = 이름;
  다시계산();
}

export function 지금계산기() { return 활성계산기이름(강제계산기); }

export const 견적상태 = reactive({
  상태: 'idle',
  결과: [],
  오류: '',
  차량가: null,
  계산기: '',
  공급자: '',
  pricingEngine: null,
  계약: null,
  실행: null,
  오류코드: '',
});

const 곳간 = new Map();
let 순번 = 0;
let 타이머 = null;

async function 보내기() {
  const 요청 = 요청만들기();
  if (!요청) { 비우기('idle'); return; }

  let 이름;
  let providerKey;
  try {
    이름 = 활성계산기이름(강제계산기);
    providerKey = 강제계산기 ? `forced:${강제계산기}` : 공급자키();
  } catch (e) {
    비우기('error', e?.message || '견적 공급자 설정을 확인해 주세요');
    return;
  }

  const 글 = providerKey + '|' + JSON.stringify(요청);
  const 캐시허용 = 이름 === '표준';
  const 캐시 = 캐시허용 ? 곳간.get(글) : null;
  if (캐시) {
    견적상태.결과 = 캐시.결과;
    견적상태.차량가 = 캐시.차량가;
    견적상태.계산기 = 캐시.계산기 || 계산기들[이름].이름;
    견적상태.공급자 = 캐시.공급자 || providerKey;
    견적상태.pricingEngine = 캐시.pricingEngine || null;
    견적상태.계약 = 캐시.계약 || null;
    견적상태.실행 = 캐시.실행 || null;
    견적상태.오류 = '';
    견적상태.오류코드 = '';
    견적상태.상태 = 'ok';
    return;
  }

  const 내순번 = ++순번;
  견적상태.상태 = 'pending';
  견적상태.오류 = '';

  try {
    const 답 = await 견적계산(요청, { 강제계산기 });
    if (내순번 !== 순번) return;

    if (캐시허용) {
      if (곳간.size > 200) 곳간.delete(곳간.keys().next().value);
      곳간.set(글, 답);
    }

    견적상태.결과 = 답.결과;
    견적상태.차량가 = 답.차량가 ?? null;
    견적상태.계산기 = 답?.계산기 || 계산기들[이름].이름;
    견적상태.공급자 = 답?.공급자 || providerKey;
    견적상태.pricingEngine = 답?.pricingEngine || null;
    견적상태.계약 = 답?.계약 || null;
    견적상태.실행 = 답?.실행 || null;
    견적상태.오류코드 = '';
    견적상태.상태 = 'ok';
  } catch (e) {
    if (내순번 !== 순번) return;
    // 공급자 장애 시 다른 계산기로 몰래 fallback 하지 않는다.
    비우기('error', e?.message || '계산할 수 없습니다', e?.code || 'QUOTE_PROVIDER_FAILED', e?.quoteExecution || null);
  }
}

function 비우기(상태, 오류 = '', 오류코드 = '', 실행 = null) {
  견적상태.상태 = 상태;
  견적상태.오류 = 오류;
  견적상태.오류코드 = 오류코드;
  견적상태.실행 = 실행;
  견적상태.결과 = [];
  견적상태.차량가 = null;
  견적상태.pricingEngine = null;
  if (상태 !== 'error') 견적상태.계약 = null;
}

export function 다시계산() {
  clearTimeout(타이머);
  const 요청 = 요청만들기();
  if (!요청) { 비우기('idle'); return; }
  견적상태.상태 = 'pending';
  견적상태.오류 = '';
  타이머 = setTimeout(보내기, 150);
}
