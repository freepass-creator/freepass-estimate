import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const AAD = Buffer.from('freepass-customer-conditions/v1');
function keyFrom(env) {
  const key = String(env.FREEPASS_CUSTOMER_REFERENCE_KEY || '');
  if (!/^[a-f0-9]{64}$/i.test(key)) throw Object.assign(new Error('손님용 조건 이미지의 확인코드 설정이 필요합니다.'), { status: 503, code: 'CUSTOMER_REFERENCE_UNAVAILABLE' });
  return Buffer.from(key, 'hex');
}
function quoteHash(text) { return createHash('sha256').update(text, 'utf8').digest().subarray(0, 8); }
export function createCustomerReference({ feeRatePct, quoteText }, { env = process.env, now = Date.now() } = {}) {
  if (typeof feeRatePct !== 'number' || !Number.isFinite(feeRatePct) || feeRatePct < -10 || feeRatePct > 7 || Math.abs(feeRatePct * 10 - Math.round(feeRatePct * 10)) > 1e-8 ||
      typeof quoteText !== 'string' || !quoteText.trim() || quoteText.length > 16000) {
    throw Object.assign(new Error('견적 조건과 수수료 입력을 확인해 주세요.'), { status: 400, code: 'CUSTOMER_REFERENCE_INPUT_INVALID' });
  }
  const payload = Buffer.alloc(14);
  payload.writeUInt16BE(Math.round((feeRatePct + 10) * 10), 0);
  payload.writeUInt32BE(Math.floor(now / 1000), 2);
  quoteHash(quoteText).copy(payload, 6);
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(env), nonce);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return 'Q1-' + Buffer.concat([nonce, encrypted, cipher.getAuthTag()]).toString('base64url');
}
export function readCustomerReference(code, { env = process.env, quoteText = null } = {}) {
  if (typeof code !== 'string' || !/^Q1-[A-Za-z0-9_-]{56}$/.test(code)) throw new Error('확인코드 형식이 올바르지 않습니다.');
  const bytes = Buffer.from(code.slice(3), 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(env), bytes.subarray(0, 12));
  decipher.setAAD(AAD); decipher.setAuthTag(bytes.subarray(26));
  let payload;
  try { payload = Buffer.concat([decipher.update(bytes.subarray(12, 26)), decipher.final()]); }
  catch { throw new Error('확인코드의 키가 다르거나 내용이 변경됐습니다.'); }
  if (quoteText != null && !quoteHash(quoteText).equals(payload.subarray(6))) throw new Error('확인코드가 이 견적 조건과 일치하지 않습니다.');
  return Object.freeze({ feeRatePct: (payload.readUInt16BE(0) - 100) / 10, createdAt: new Date(payload.readUInt32BE(2) * 1000).toISOString(), quoteFingerprint: payload.subarray(6).toString('hex') });
}
