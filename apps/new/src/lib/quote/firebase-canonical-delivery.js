import { createCanonicalQuoteDelivery } from './canonical-delivery-session.js';
import {
  createFirebaseAuthenticatedQuoteRepository,
  createFirebaseAuthenticatedShareEnvelopeRepository,
} from './repositories/firebase-authenticated.js';

/**
 * Final browser-safe I-01 facade for F/UI.
 *
 * Caller supplies business/calculation state only. Repository wiring and
 * Firebase caller-token injection stay inside Integration.
 */
export async function createFirebaseCanonicalQuoteDelivery({
  quoteRepository = null,
  envelopeRepository = null,
  quoteRepositoryFactory = createFirebaseAuthenticatedQuoteRepository,
  envelopeRepositoryFactory = createFirebaseAuthenticatedShareEnvelopeRepository,
  delivery = createCanonicalQuoteDelivery,
  ...input
} = {}) {
  const quotes = quoteRepository || quoteRepositoryFactory();
  const envelopes = envelopeRepository || envelopeRepositoryFactory();

  return delivery({
    ...input,
    quoteRepository: quotes,
    envelopeRepository: envelopes,
  });
}
