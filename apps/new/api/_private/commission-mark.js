import { commissionForAgent } from '../../src/lib/quote/commission-policy.js';
const DIGITS = 'ABCDEFGHIJ';
export function encodeCommissionMark(agentPoints) {
  commissionForAgent(agentPoints);
  const tenths=Math.round(agentPoints*10);
  return DIGITS[Math.floor(tenths/10)]+DIGITS[tenths%10];
}
export function decodeCommissionMark(mark) {
  if(typeof mark!=='string'||!/^[A-F][A-J]$/.test(mark)) throw new Error('수수료 참조코드를 확인해 주세요.');
  return commissionForAgent((DIGITS.indexOf(mark[0])*10+DIGITS.indexOf(mark[1]))/10);
}
