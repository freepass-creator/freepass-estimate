import { currentFirebaseIdToken } from '../../../firebase/id-token.js';
import { createFreePassDataQuoteRepository } from './freepass-data.js';
import { createFreePassDataShareEnvelopeRepository } from './freepass-data-share-envelope.js';

/**
 * Browser composition for authenticated canonical writes.
 *
 * F/UI can consume these factories without knowing Firebase token refresh details.
 */
export function createFirebaseAuthenticatedQuoteRepository({
  authTokenProvider = currentFirebaseIdToken,
  ...options
} = {}) {
  return createFreePassDataQuoteRepository({
    ...options,
    authTokenProvider,
  });
}

export function createFirebaseAuthenticatedShareEnvelopeRepository({
  authTokenProvider = currentFirebaseIdToken,
  ...options
} = {}) {
  return createFreePassDataShareEnvelopeRepository({
    ...options,
    authTokenProvider,
  });
}
