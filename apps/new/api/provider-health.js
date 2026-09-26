import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { 공급자설정 } from '../src/lib/quote/provider-config.js';
import { configuredProviderHealth } from '../src/lib/quote/provider-health.js';

function bad(res, status, error, code) {
  res.status(status).json({ ok: false, error, code });
}

function companyId(req) {
  const raw = Array.isArray(req?.query?.company) ? req.query.company[0] : req?.query?.company;
  const id = String(raw || 'freepass').trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(id) ? id : null;
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return bad(res, 405, 'GET/HEAD only', 'METHOD_NOT_ALLOWED');
  }

  const id = companyId(req);
  if (!id) return bad(res, 400, '회사 설정 식별자가 올바르지 않습니다.', 'COMPANY_CONFIG_ID_INVALID');

  let cfg;
  try {
    const path = join(process.cwd(), 'public', 'data', 'company-config', `${id}.json`);
    cfg = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return bad(res, 404, '회사 견적 설정을 찾을 수 없습니다.', 'COMPANY_CONFIG_NOT_FOUND');
  }

  let provider;
  try {
    provider = 공급자설정(cfg);
  } catch (error) {
    if (error?.code === 'PROVIDER_CONFIG_MISSING') {
      return bad(res, 422, '견적 공급자 설정이 없습니다.', 'PROVIDER_NOT_CONFIGURED');
    }
    return bad(res, 422, '견적 공급자 설정이 올바르지 않습니다.', 'PROVIDER_CONFIG_INVALID');
  }

  const health = configuredProviderHealth(provider);

  if (req.method === 'HEAD') {
    res.setHeader('X-FreePass-Provider', health.provider_key);
    res.setHeader('X-FreePass-Live-Status', health.live_status);
    res.status(200).end();
    return;
  }

  res.status(200).json({
    ok: true,
    company_id: id,
    ...health,
  });
}
