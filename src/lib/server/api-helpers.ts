import 'server-only';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth, adminDb, AdminConfigError, CREDENTIALS_HINT } from './firebase-admin';

/** Verify the Firebase ID token from the Authorization header. */
export async function authenticate(request: Request): Promise<DecodedIdToken | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  // Outside the try block: a misconfigured Admin SDK should surface as a
  // config error, not be silently converted into a 401.
  const auth = adminAuth();
  try {
    return await auth.verifyIdToken(header.slice('Bearer '.length));
  } catch {
    return null;
  }
}

export async function isAdmin(uid: string): Promise<boolean> {
  const snap = await adminDb().collection('profiles').doc(uid).get();
  return snap.exists && snap.data()?.role === 'admin';
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

// Substrings of errors google-auth-library / firebase-admin throw when
// credentials are missing or malformed at request time.
const CREDENTIAL_ERROR_HINTS = [
  'could not load the default credentials',
  'failed to determine project id',
  'unable to detect a project id',
  'error fetching access token',
  'invalid_grant',
  'invalid pem',
  'decoder routines',
];

/**
 * Turn an unexpected route error into a JSON response. Credential and
 * configuration problems return an actionable message so a misconfigured
 * deployment is obvious from the UI; everything else gets the fallback.
 */
export function handleRouteError(err: unknown, fallback: string): Response {
  console.error(fallback, err);
  if (err instanceof AdminConfigError) return jsonError(err.message, 500);
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  if (CREDENTIAL_ERROR_HINTS.some((hint) => message.includes(hint))) {
    return jsonError(CREDENTIALS_HINT, 500);
  }
  return jsonError(fallback, 500);
}
