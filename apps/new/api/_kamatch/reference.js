import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { kamatchError, validateReference } from './rates.js';
export const KAMATCH_APP_DIGEST = '63e50c4abf5b64ae7b80b826c0aa529a31c71cdfae0ab35e000f8e1acc38da22';
export function tableDigest(reference) {
  return createHash('sha256').update(JSON.stringify(reference.tables)).digest('hex');
}
async function privateJson(name, env) {
  const file = env[name];
  if (!file) throw kamatchError('카매치 원본 요율 연결을 확인해 주세요.', 'KAMATCH_REFERENCE_UNAVAILABLE');
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { throw kamatchError('카매치 원본 요율 자료를 읽지 못했습니다.','KAMATCH_REFERENCE_UNAVAILABLE'); }
}
export async function loadKamatchReference({ env = process.env, now = Date.now() } = {}) {
  const reference = validateReference(await privateJson('KAMATCH_REFERENCE_FILE',env),KAMATCH_APP_DIGEST);
  const at = Date.parse(reference.capturedAt);
  const maxAge = Number(env.KAMATCH_REFERENCE_MAX_AGE_MS || 3600000);
  if (!Number.isFinite(at) || !Number.isFinite(maxAge) || maxAge<=0 || at>now+300000 || now-at>maxAge) {
    throw kamatchError('카매치 요율 기준시각을 확인해 주세요.','KAMATCH_REFERENCE_STALE');
  }
  return reference;
}
export async function loadKamatchProfiles({ env = process.env } = {}) {
  return privateJson('KAMATCH_PROFILE_FILE',env);
}
export function resolveKamatchProfile(profiles, reference, productId) {
  if (profiles?.schema !== 'freepass-kamatch-mapping/v1' || profiles.applicationDigest !== reference.application.sha256 ||
      profiles.tablesDigest !== tableDigest(reference)) throw kamatchError('카매치 차량 매핑과 원본 요율 버전이 다릅니다.','KAMATCH_MAPPING_VERSION_MISMATCH');
  const p=profiles.products?.[productId];
  if (!p || !['brand','model','lineup','trim','vehicleType','insuranceProperty'].every(k=>typeof p[k]==='string'&&p[k].trim())) {
    throw kamatchError('선택한 차량의 카매치 매핑을 확인해 주세요.','KAMATCH_MAPPING_UNAVAILABLE',422);
  }
  for(const k of ['deliveryFee','tintFee','dashcamFee']) {
    if(!Number.isSafeInteger(p.baselines?.[k])||p.baselines[k]<0) throw kamatchError('카매치 기본 용품 조건을 확인해 주세요.','KAMATCH_COST_MAPPING_UNAVAILABLE');
  }
  return p;
}
