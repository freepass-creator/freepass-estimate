// ============================================================================
// FreePass Estimate quote core
// 화면은 하나. 계산 공급자는 회사/채널 설정으로 갈아끼운다.
//   STANDARD → FreePass 표준
//   EXTERNAL → Excel 또는 ERP/API adapter
// ============================================================================
import { reactive } from 'vue';
import { 요청만들기 } from './build-request.js';
import { 요청검사, 결과검사 } from './spec.js';
import { 공급자설정, 공급자키 } from './provider-config.js';
import * as 표준 from './engines/freepass-standard.js';
import * as 외부 from './engines/external.js';

export const 계산기들 = { 표준, 외부 };
let 강제계산기 = null; // 개발/회귀 비교 전용. 운영 UI에는 노출하지 않는다.

function 활성계산기이름() {
  if (강제계산기) return 강제계산기;
  const p = 공급자설정();
  return p.mode === 'standard' ? '표준' : '외부';
}

export function 계산기고르기(이름 = null) {
  if (이름 != null && !계산기들[이름]) throw new Error(`그런 계산기가 없다: ${이름}`);
  강제계산기 = 이름;
  다시계산();
}

export function 지금계산기() { return 활성계산기이름(); }

export const 견적상태 = reactive({
  상태: 'idle',
  결과: [],
  오류: '',
  차량가: null,
  계산기: '',
  공급자: '',
});

const 곳간 = new Map();
let 순번 = 0;
let 타이머 = null;

async function 보내기() {
  const 요청 = 요청만들기();
  if (!요청) { 비우기('idle'); return; }

  const 탈 = 요청검사(요청);
  if (탈) { 비우기('error', 탈); return; }

  let 이름;
  let providerKey;
  try {
    이름 = 활성계산기이름();
    providerKey = 강제계산기 ? `forced:${강제계산기}` : 공급자키();
  } catch (e) {
    비우기('error', e?.message || '견적 공급자 설정을 확인해 주세요');
    return;
  }

  const 계산기 = 계산기들[이름];
  if (!계산기.다루는차.includes(요청.차.종류)) {
    비우기('error', `${계산기.이름} 계산기는 ${요청.차.종류}를 다루지 않습니다`);
    return;
  }

  const 글 = providerKey + '|' + JSON.stringify(요청);
  const 캐시 = 곳간.get(글);
  if (캐시) {
    견적상태.결과 = 캐시.결과;
    견적상태.차량가 = 캐시.차량가;
    견적상태.계산기 = 계산기.이름;
    견적상태.공급자 = providerKey;
    견적상태.오류 = '';
    견적상태.상태 = 'ok';
    return;
  }

  const 내순번 = ++순번;
  견적상태.상태 = 'pending';
  견적상태.오류 = '';

  try {
    const 답 = await 계산기.계산(요청);
    if (내순번 !== 순번) return;

    const 탈2 = 결과검사(답?.결과, 요청.안들);
    if (탈2) { 비우기('error', 탈2); return; }

    if (곳간.size > 200) 곳간.delete(곳간.keys().next().value);
    곳간.set(글, 답);

    견적상태.결과 = 답.결과;
    견적상태.차량가 = 답.차량가 ?? null;
    견적상태.계산기 = 계산기.이름;
    견적상태.공급자 = providerKey;
    견적상태.상태 = 'ok';
  } catch (e) {
    if (내순번 !== 순번) return;
    // 공급자 장애 시 다른 계산기로 몰래 fallback 하지 않는다.
    비우기('error', e?.message || '계산할 수 없습니다');
  }
}

function 비우기(상태, 오류 = '') {
  견적상태.상태 = 상태;
  견적상태.오류 = 오류;
  견적상태.결과 = [];
  견적상태.차량가 = null;
}

export function 다시계산() {
  clearTimeout(타이머);
  const 요청 = 요청만들기();
  if (!요청) { 비우기('idle'); return; }
  견적상태.상태 = 'pending';
  견적상태.오류 = '';
  타이머 = setTimeout(보내기, 150);
}
