import { fetchFreePassDataMaster } from './freepass-data-master.js';
import { canonicalizeQuoteRequestFromMaster } from './_master/authoritative-request.js';
import { calculateStandardQuote } from './_standard/standard-service.js';
import { QUOTE_RESULT_CONTRACT, QUOTE_PROVIDER_CONTRACT, STANDARD_QUOTE_BATCH_CONTRACT } from '../src/lib/quote/contracts.js';
const MAX_BATCH = 120;

function errorPayload(error) {
  return {
    ok: false,
    code: error?.code || 'STANDARD_QUOTE_INVALID',
    error: error?.message || '표준 견적을 계산할 수 없습니다',
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'POST 만 받습니다' });
    return;
  }

  const requests = req.body?.requests;
  if (!Array.isArray(requests) || !requests.length || requests.length > MAX_BATCH) {
    res.status(400).json({
      ok: false,
      code: 'QUOTE_BATCH_INVALID',
      error: `requests must contain 1..${MAX_BATCH} quote requests`,
    });
    return;
  }

  let master;
  try {
    master = await fetchFreePassDataMaster();
  } catch (error) {
    const status = Number(error?.status);
    res.status(Number.isInteger(status) && status >= 400 && status <= 599 ? status : 503).json({
      ok: false,
      code: error?.code || 'FREEPASS_DATA_MASTER_UNAVAILABLE',
      error: 'FreePass Data 차종 기준값을 확인할 수 없습니다.',
    });
    return;
  }

  const results = [];
  for (const request of requests) {
    try {
      const authoritative = canonicalizeQuoteRequestFromMaster(request, master);
      const answer = await calculateStandardQuote(authoritative.request);
      results.push({
        ok: true,
        contract: QUOTE_RESULT_CONTRACT,
        providerContract: QUOTE_PROVIDER_CONTRACT,
        ...answer,
        priceBasis: authoritative.priceBasis,
      });
    } catch (error) {
      results.push(errorPayload(error));
    }
  }

  res.status(200).json({
    ok: true,
    contract: STANDARD_QUOTE_BATCH_CONTRACT,
    results,
  });
}
