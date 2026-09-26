import { getIdToken } from 'firebase/auth';
import { auth, waitAuth } from './config.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Returns the current Firebase Auth ID token for same-origin Estimate API calls.
 * The token identifies the caller only; it is never the FreePass Data service token.
 */
export async function currentFirebaseIdToken({
  forceRefresh = false,
} = {}) {
  await waitAuth();
  const user = auth.currentUser;
  if (!user) {
    throw codedError('Firebase user is not signed in', 'FIREBASE_CALLER_UNAUTHENTICATED');
  }

  const token = await getIdToken(user, forceRefresh);
  const value = String(token ?? '').trim();
  if (!value) {
    throw codedError('Firebase ID token is unavailable', 'FIREBASE_CALLER_UNAUTHENTICATED');
  }
  return value;
}
