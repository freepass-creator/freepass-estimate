import { createFreePassDataQuoteRepository } from './repositories/freepass-data.js';
import { createFreePassDataShareEnvelopeRepository } from './repositories/freepass-data-share-envelope.js';
import { loadCanonicalShareBundle } from './share-bundle.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Browser-safe canonical customer-share loader.
 *
 * Both repositories terminate at same-origin Estimate gateways. This loader
 * gives F/U one function and never exposes FreePass Data tokens or storage paths.
 */
export function createCanonicalShareBundleLoader({
  quoteRepository = null,
  envelopeRepository = null,
  quoteRepositoryFactory = createFreePassDataQuoteRepository,
  envelopeRepositoryFactory = createFreePassDataShareEnvelopeRepository,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof quoteRepositoryFactory !== 'function' ||
      typeof envelopeRepositoryFactory !== 'function' ||
      typeof now !== 'function') {
    throw codedError('canonical Share loader dependencies are invalid', 'CANONICAL_SHARE_LOADER_INVALID');
  }

  const quotes = quoteRepository || quoteRepositoryFactory();
  const envelopes = envelopeRepository || envelopeRepositoryFactory();

  return Object.freeze({
    contract: 'freepass-canonical-share-loader/v1',

    async load({ envelopeId, envelopeVersion = null } = {}) {
      return loadCanonicalShareBundle({
        envelopeRepository: envelopes,
        quoteRepository: quotes,
        envelopeId,
        envelopeVersion,
        now,
      });
    },
  });
}
