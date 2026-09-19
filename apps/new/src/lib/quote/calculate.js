import { 요청검사, 결과검사 } from './spec.js';
import { 공급자설정, 공급자키 } from './provider-config.js';
import * as 표준 from './engines/freepass-standard.js';
import * as 외부 from './engines/external.js';

export const 계산기들 = Object.freeze({ 표준, 외부 });

export function 활성계산기이름(강제계산기 = null) {
  if (강제계산기) {
    if (!계산기들[강제계산기]) throw new Error(`그런 계산기가 없다: ${강제계산기}`);
    return 강제계산기;
  }
  return 공급자설정().mode === 'standard' ? '표준' : '외부';
}

export async function 견적계산(요청, { 신호, 강제계산기 = null } = {}) {
  const 탈 = 요청검사(요청);
  if (탈) throw new Error(탈);

  const 이름 = 활성계산기이름(강제계산기);
  const 계산기 = 계산기들[이름];
  if (!계산기.다루는차.includes(요청.차.종류)) {
    throw new Error(`${계산기.이름} 계산기는 ${요청.차.종류}를 다루지 않습니다`);
  }

  const 답 = await 계산기.계산(요청, { 신호 });
  const 탈2 = 결과검사(답?.결과, 요청.안들);
  if (탈2) throw new Error(탈2);

  return {
    ...답,
    계산기: 계산기.이름,
    공급자: 강제계산기 ? `forced:${강제계산기}` : 공급자키(),
  };
}
