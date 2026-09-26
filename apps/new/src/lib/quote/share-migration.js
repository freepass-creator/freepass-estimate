import { readIssuedQuote } from './quote-repository.js';
import { readShareEnvelope } from './share-envelope-repository.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function positiveVersion(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw codedError('quoteVersion must be a positive integer', 'QUOTE_LINK_INVALID');
  }
  return n;
}

function clean(value) {
  return String(value ?? '').trim();
}

/**
 * Public-link migration contract.
 *
 * Canonical Quote v2 links use:
 *   ?quote=<quoteId>&quoteVersion=<n>
 *
 * Legacy links keep the historical:
 *   ?q=<legacyId>
 *
 * The two namespaces are intentionally distinct so a canonical read failure
 * can never be reinterpreted as permission to query a legacy store.
 */
export function classifyQuoteLink(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const canonicalId = clean(params.get('quote'));
  const legacyId = clean(params.get('q'));

  if (canonicalId && legacyId) {
    throw codedError('canonical and legacy quote links cannot be mixed', 'QUOTE_LINK_AMBIGUOUS');
  }

  if (canonicalId) {
    return Object.freeze({
      kind: 'CANONICAL_V2',
      quoteId: canonicalId,
      quoteVersion: positiveVersion(params.get('quoteVersion')),
    });
  }

  if (legacyId) {
    return Object.freeze({
      kind: 'LEGACY',
      legacyId,
    });
  }

  return Object.freeze({ kind: 'NONE' });
}

export function buildCanonicalQuoteUrl({
  quoteId,
  quoteVersion = null,
  locationLike = globalThis.location,
} = {}) {
  const id = clean(quoteId);
  if (!id) throw codedError('quoteId is required', 'QUOTE_LINK_INVALID');
  const version = positiveVersion(quoteVersion);
  const origin = clean(locationLike?.origin);
  const pathname = clean(locationLike?.pathname) || '/';
  if (!origin) throw codedError('location origin is required', 'QUOTE_LINK_INVALID');

  const url = new URL(pathname, origin);
  url.searchParams.set('quote', id);
  if (version != null) url.searchParams.set('quoteVersion', String(version));
  return url.toString();
}

export async function loadQuoteFromMigratingLink({
  search,
  repository,
  legacyLoader = null,
} = {}) {
  const link = classifyQuoteLink(search);

  if (link.kind === 'NONE') {
    return Object.freeze({ kind: 'NONE', status: 'EMPTY', quote: null });
  }

  if (link.kind === 'CANONICAL_V2') {
    const quote = await readIssuedQuote(repository, {
      quoteId: link.quoteId,
      quoteVersion: link.quoteVersion,
    });
    return Object.freeze({
      kind: link.kind,
      status: quote ? 'FOUND' : 'NOT_FOUND',
      quote,
      quoteId: link.quoteId,
      quoteVersion: link.quoteVersion,
    });
  }

  if (typeof legacyLoader !== 'function') {
    throw codedError('legacy quote reader is unavailable', 'LEGACY_QUOTE_READER_UNAVAILABLE');
  }

  const quote = await legacyLoader(link.legacyId);
  return Object.freeze({
    kind: link.kind,
    status: quote ? 'FOUND' : 'NOT_FOUND',
    quote: quote || null,
    legacyId: link.legacyId,
  });
}


/**
 * Customer-facing share migration contract.
 *
 * Canonical customer links use Share Envelope identity:
 *   ?share=<envelopeId>&shareVersion=<n>
 *
 * Historical RTDB links remain:
 *   ?q=<legacyId>
 *
 * Direct ?quote=<quoteId> is intentionally not treated as the public multi-Quote
 * share namespace.
 */
export function classifyPublicShareLink(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const envelopeId = clean(params.get('share'));
  const directQuoteId = clean(params.get('quote'));
  const legacyId = clean(params.get('q'));

  const present = [envelopeId, directQuoteId, legacyId].filter(Boolean).length;
  if (present > 1) {
    throw codedError('share, quote and legacy link namespaces cannot be mixed', 'SHARE_LINK_AMBIGUOUS');
  }

  if (envelopeId) {
    return Object.freeze({
      kind: 'CANONICAL_ENVELOPE',
      envelopeId,
      envelopeVersion: positiveVersion(params.get('shareVersion')),
    });
  }

  if (directQuoteId) {
    return Object.freeze({
      kind: 'DIRECT_QUOTE',
      quoteId: directQuoteId,
      quoteVersion: positiveVersion(params.get('quoteVersion')),
    });
  }

  if (legacyId) {
    return Object.freeze({
      kind: 'LEGACY',
      legacyId,
    });
  }

  return Object.freeze({ kind: 'NONE' });
}

export function buildCanonicalShareUrl({
  envelopeId,
  envelopeVersion = null,
  locationLike = globalThis.location,
} = {}) {
  const id = clean(envelopeId);
  if (!id) throw codedError('envelopeId is required', 'SHARE_LINK_INVALID');
  const version = positiveVersion(envelopeVersion);
  const origin = clean(locationLike?.origin);
  const pathname = clean(locationLike?.pathname) || '/';
  if (!origin) throw codedError('location origin is required', 'SHARE_LINK_INVALID');

  const url = new URL(pathname, origin);
  url.searchParams.set('share', id);
  if (version != null) url.searchParams.set('shareVersion', String(version));
  return url.toString();
}

export async function loadPublicShareFromMigratingLink({
  search,
  envelopeRepository,
  quoteRepository = null,
  legacyLoader = null,
} = {}) {
  const link = classifyPublicShareLink(search);

  if (link.kind === 'NONE') {
    return Object.freeze({ kind: 'NONE', status: 'EMPTY', value: null });
  }

  if (link.kind === 'CANONICAL_ENVELOPE') {
    const envelope = await readShareEnvelope(envelopeRepository, {
      envelopeId: link.envelopeId,
      envelopeVersion: link.envelopeVersion,
    });
    return Object.freeze({
      kind: link.kind,
      status: envelope ? 'FOUND' : 'NOT_FOUND',
      value: envelope,
      envelopeId: link.envelopeId,
      envelopeVersion: link.envelopeVersion,
    });
  }

  if (link.kind === 'DIRECT_QUOTE') {
    const quote = await readIssuedQuote(quoteRepository, {
      quoteId: link.quoteId,
      quoteVersion: link.quoteVersion,
    });
    return Object.freeze({
      kind: link.kind,
      status: quote ? 'FOUND' : 'NOT_FOUND',
      value: quote,
      quoteId: link.quoteId,
      quoteVersion: link.quoteVersion,
    });
  }

  if (typeof legacyLoader !== 'function') {
    throw codedError('legacy quote reader is unavailable', 'LEGACY_QUOTE_READER_UNAVAILABLE');
  }

  const legacy = await legacyLoader(link.legacyId);
  return Object.freeze({
    kind: link.kind,
    status: legacy ? 'FOUND' : 'NOT_FOUND',
    value: legacy || null,
    legacyId: link.legacyId,
  });
}
