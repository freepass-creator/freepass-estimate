import { loadEstimateNewcarMaster } from '../master/freepass-data-master.js';
import { issueQuotesFromCalculation } from './from-calculation.js';
import { masterContextFromSelection } from './master-selection.js';
import { persistIssuedQuotes } from './quote-repository.js';
import { createFreePassDataQuoteRepository } from './repositories/freepass-data.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object') {
    throw codedError(`${field} is required`, 'QUOTE_PERSISTENCE_RUNTIME_INVALID');
  }
  return value;
}

/**
 * Integration runtime for the canonical Quote v2 write path.
 *
 * This is deliberately UI-agnostic and calculation-agnostic:
 * - E/F provide request + calculation.
 * - FreePass Data provides authoritative master evidence.
 * - I resolves stable identity, issues Quote v2, and persists through QuoteRepository.
 *
 * No RTDB fallback is permitted here.
 */
export async function persistCalculatedQuotes({
  request,
  calculation,
  vehicle,
  condition,
  master = null,
  repository = null,
  loadMaster = loadEstimateNewcarMaster,
  createRepository = createFreePassDataQuoteRepository,
  now = () => new Date().toISOString(),
} = {}) {
  requiredObject(request, 'request');
  requiredObject(calculation, 'calculation');
  requiredObject(vehicle, 'vehicle');

  if (typeof loadMaster !== 'function') {
    throw codedError('FreePass Data master loader is unavailable', 'QUOTE_PERSISTENCE_RUNTIME_INVALID');
  }
  if (typeof createRepository !== 'function') {
    throw codedError('Quote repository factory is unavailable', 'QUOTE_PERSISTENCE_RUNTIME_INVALID');
  }
  if (typeof now !== 'function') {
    throw codedError('clock is unavailable', 'QUOTE_PERSISTENCE_RUNTIME_INVALID');
  }

  const resolvedMaster = master || await loadMaster();
  const masterContext = masterContextFromSelection({
    master: resolvedMaster,
    vehicle,
    condition: condition || {},
  });

  const createdAt = String(now() ?? '').trim();
  if (!createdAt || !Number.isFinite(Date.parse(createdAt))) {
    throw codedError('issued quote timestamp is invalid', 'QUOTE_PERSISTENCE_RUNTIME_INVALID');
  }

  const quotes = await issueQuotesFromCalculation({
    request,
    calculation,
    masterContext,
    createdAt,
  });

  const repo = repository || createRepository();
  const receipts = await persistIssuedQuotes(repo, quotes);

  if (receipts.length !== quotes.length) {
    throw codedError('quote persistence receipt count mismatch', 'QUOTE_REPOSITORY_RECEIPT_INVALID');
  }

  return Object.freeze({
    quotes,
    receipts,
    sourceRevision: masterContext.sourceRevision,
  });
}
