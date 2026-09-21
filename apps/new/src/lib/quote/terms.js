// FreePass 견적 기간 정본. 화면·요청·엔진이 모두 같은 다섯 기간을 쓴다.
export const QUOTE_TERMS = Object.freeze([12, 24, 36, 48, 60]);

export function quoteScenarios(deposit = 10, prepay = 0) {
  return QUOTE_TERMS.map((term) => ({ term, dep: deposit, pre: prepay }));
}
