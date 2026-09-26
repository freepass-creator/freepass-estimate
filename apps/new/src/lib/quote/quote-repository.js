import { QUOTE_CONTRACT_V2, quoteIdempotencyKey } from './quote-v2.js';

export const QUOTE_REPOSITORY_CONTRACT = 'freepass-quote-repository/v1';
export const QUOTE_WRITE_RECEIPT_CONTRACT = 'freepass-quote-write-receipt/v1';
export const QUOTE_READ_RECEIPT_CONTRACT = 'freepass-quote-read-receipt/v1';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requiredId(value, field) {
  const v = String(value ?? '').trim();
  if (!v) throw codedError(`${field} is required`, 'QUOTE_REPOSITORY_QUERY_INVALID');
  return v;
}

export function assertIssuedQuote(quote) {
  if (!quote || quote.contract !== QUOTE_CONTRACT_V2) {
    throw codedError('Quote v2 is required', 'QUOTE_REPOSITORY_QUOTE_INVALID');
  }
  if (!quote.quoteId || !quote.snapshotHash || !Number.isInteger(quote.quoteVersion)) {
    throw codedError('issued quote identity is incomplete', 'QUOTE_REPOSITORY_QUOTE_INVALID');
  }
  return quote;
}

export function assertQuoteRepository(repository) {
  if (!repository || repository.contract !== QUOTE_REPOSITORY_CONTRACT || typeof repository.put !== 'function') {
    throw codedError('quote repository is not configured', 'QUOTE_REPOSITORY_UNAVAILABLE');
  }
  return repository;
}

export function assertQuoteReader(repository) {
  if (!repository || repository.contract !== QUOTE_REPOSITORY_CONTRACT || typeof repository.get !== 'function') {
    throw codedError('quote reader is not configured', 'QUOTE_REPOSITORY_UNAVAILABLE');
  }
  return repository;
}

export async function persistIssuedQuote(repository, quote) {
  const repo = assertQuoteRepository(repository);
  const issued = assertIssuedQuote(quote);
  const idempotencyKey = quoteIdempotencyKey(issued);
  const receipt = await repo.put({ quote: issued, idempotencyKey });

  if (!receipt || receipt.contract !== QUOTE_WRITE_RECEIPT_CONTRACT) {
    throw codedError('quote repository returned an invalid receipt', 'QUOTE_REPOSITORY_RECEIPT_INVALID');
  }
  if (!['CREATED', 'EXISTING'].includes(receipt.status)) {
    throw codedError('quote repository did not confirm persistence', 'QUOTE_REPOSITORY_WRITE_FAILED');
  }
  if (receipt.quoteId !== issued.quoteId
      || Number(receipt.quoteVersion) !== issued.quoteVersion
      || receipt.snapshotHash !== issued.snapshotHash
      || receipt.idempotencyKey !== idempotencyKey) {
    throw codedError('quote repository receipt does not match issued quote', 'QUOTE_REPOSITORY_CONFLICT');
  }
  return Object.freeze({ ...receipt });
}

export async function persistIssuedQuotes(repository, quotes) {
  if (!Array.isArray(quotes) || !quotes.length) {
    throw codedError('at least one issued quote is required', 'QUOTE_REPOSITORY_QUOTE_INVALID');
  }
  const receipts = [];
  // Sequential on purpose: preserve deterministic failure boundary and receipt order.
  for (const quote of quotes) receipts.push(await persistIssuedQuote(repository, quote));
  return Object.freeze(receipts);
}

export async function readIssuedQuote(repository, {
  quoteId,
  quoteVersion = null,
} = {}) {
  const repo = assertQuoteReader(repository);
  const id = requiredId(quoteId, 'quoteId');
  const version = quoteVersion == null ? null : Number(quoteVersion);
  if (version != null && (!Number.isSafeInteger(version) || version < 1)) {
    throw codedError('quoteVersion must be a positive integer', 'QUOTE_REPOSITORY_QUERY_INVALID');
  }

  const receipt = await repo.get({ quoteId: id, quoteVersion: version });
  if (!receipt || receipt.contract !== QUOTE_READ_RECEIPT_CONTRACT) {
    throw codedError('quote reader returned an invalid receipt', 'QUOTE_REPOSITORY_RECEIPT_INVALID');
  }
  if (!['FOUND', 'NOT_FOUND'].includes(receipt.status)) {
    throw codedError('quote reader returned an invalid status', 'QUOTE_REPOSITORY_RECEIPT_INVALID');
  }
  if (receipt.quoteId !== id) {
    throw codedError('quote read receipt does not match requested quote', 'QUOTE_REPOSITORY_CONFLICT');
  }
  if (receipt.status === 'NOT_FOUND') return null;

  const quote = assertIssuedQuote(receipt.quote);
  if (quote.quoteId !== id ||
      receipt.snapshotHash !== quote.snapshotHash ||
      Number(receipt.quoteVersion) !== quote.quoteVersion) {
    throw codedError('quote read receipt identity does not match payload', 'QUOTE_REPOSITORY_CONFLICT');
  }
  if (version != null && quote.quoteVersion !== version) {
    throw codedError('quote read receipt version does not match request', 'QUOTE_REPOSITORY_CONFLICT');
  }
  return Object.freeze({ ...quote });
}
