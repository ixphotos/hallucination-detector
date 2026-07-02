import 'server-only';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth, adminDb } from './firebase-admin';

/** Verify the Firebase ID token from the Authorization header. */
export async function authenticate(request: Request): Promise<DecodedIdToken | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return await adminAuth().verifyIdToken(header.slice('Bearer '.length));
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
