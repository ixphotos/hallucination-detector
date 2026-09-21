import { adminDb } from '@/lib/server/firebase-admin';
import { authenticate, jsonError } from '@/lib/server/api-helpers';
import type { QuizQuestion } from '@/types';

/**
 * Serve a question for quiz taking. The `hallucinations` field (the answer
 * key) is stripped — answers are only available via the results endpoint
 * after the session is complete, or to admins via the Firestore SDK.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const user = await authenticate(request);
  if (!user) return jsonError('Unauthorized', 401);

  const { questionId } = await params;
  const snap = await adminDb().collection('questions').doc(questionId).get();
  if (!snap.exists) return jsonError('Question not found', 404);

  const data = snap.data()!;
  const payload: QuizQuestion = {
    id: snap.id,
    subject: data.subject,
    level: data.level,
    title: data.title,
    passage: data.passage,
  };
  return Response.json(payload);
}
