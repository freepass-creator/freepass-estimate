// Private operator CLI only. Never bundled into the browser or exposed as an API.
import { decodeCommissionMark } from '../api/_private/commission-mark.js';
import { loadEnv } from 'vite';
import { readCustomerReference } from '../api/_private/customer-reference.js';
const reference = process.argv[2];
if (!reference) { console.error('사용법: node scripts/read-customer-reference.mjs CF 또는 Q1-기존확인코드'); process.exitCode = 1; }
else {
  try {
    const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
    if (!reference.startsWith('Q1-')) {
      const p = decodeCommissionMark(reference);
      console.log(`영업 ${p.agentPoints.toFixed(1)}P · 회사 ${p.companyPoints.toFixed(1)}P · 합계 ${p.totalPoints.toFixed(1)}P`);
      process.exit(0);
    }
    const result = readCustomerReference(reference, { env });
    console.log(`수수료율: ${result.feeRatePct}%\n생성시각: ${result.createdAt}\n견적 대조값: ${result.quoteFingerprint}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
