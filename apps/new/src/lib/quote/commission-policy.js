export const COMMISSION_POLICY = 'company-1-agent-5/v1';
export const COMPANY_POINTS = 1;
export const MAX_AGENT_POINTS = 5;
export const AGENT_POINTS_STEP = 0.5;
export function commissionForAgent(agentPoints) {
  if (typeof agentPoints !== 'number' || !Number.isFinite(agentPoints) || agentPoints < 0 || agentPoints > MAX_AGENT_POINTS || Math.abs(agentPoints / AGENT_POINTS_STEP - Math.round(agentPoints / AGENT_POINTS_STEP)) > 1e-8) {
    throw Object.assign(new Error('영업 수수료는 0.0~5.0P에서 0.5P 단위로 입력해 주세요.'), { code:'COMMISSION_POINTS_INVALID',status:400 });
  }
  return Object.freeze({ companyPoints: COMPANY_POINTS, agentPoints, totalPoints: Math.round((COMPANY_POINTS+agentPoints)*10)/10 });
}
export function commissionFromConditions(conditions) {
  if (conditions?.수수료정책 !== COMMISSION_POLICY) throw Object.assign(new Error('수수료 조건을 다시 설정해 주세요.'), { code:'COMMISSION_POLICY_REQUIRED',status:400 });
  return commissionForAgent(conditions.영업수수료P);
}
