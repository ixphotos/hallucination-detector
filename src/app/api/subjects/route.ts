import { adminDb } from '@/lib/server/firebase-admin';
import { authenticate, jsonError } from '@/lib/server/api-helpers';
import type { SubjectCount } from '@/types';

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return jsonError('Unauthorized', 401);

  // select() keeps the payload to just the subject field — passages and
  // answers never leave the server.
  const snap = await adminDb().collection('questions').select('subject').get();
  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const subject = doc.get('subject');
    if (typeof subject === 'string') {
      counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }
  }
  const payload: SubjectCount[] = [...counts.entries()].map(([subject, count]) => ({
    subject,
    count,
  }));
  return Response.json(payload);
}
