import { adminDb } from '@/lib/server/firebase-admin';
import { authenticate, handleRouteError, isAdmin, jsonError } from '@/lib/server/api-helpers';
import type { SessionMeta } from '@/types';

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    return await getSessionResponse(request, context);
  } catch (err) {
    return handleRouteError(err, 'Failed to load session');
  }
}

async function getSessionResponse(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  const user = await authenticate(request);
  if (!user) return jsonError('Unauthorized', 401);

  const { sessionId } = await params;
  const snap = await adminDb().collection('quizSessions').doc(sessionId).get();
  if (!snap.exists) return jsonError('Session not found', 404);

  const data = snap.data()!;
  if (data.teacherId !== user.uid && !(await isAdmin(user.uid))) {
    return jsonError('Forbidden', 403);
  }

  const attemptIds: string[] = data.attemptIds ?? [];
  const questionIds: string[] = data.questionIds ?? [];

  let attemptedQuestionIds: string[] = [];
  if (attemptIds.length > 0) {
    const attemptsColl = adminDb().collection('attempts');
    const attemptSnaps = await adminDb().getAll(...attemptIds.map((id) => attemptsColl.doc(id)));
    attemptedQuestionIds = attemptSnaps
      .filter((s) => s.exists)
      .map((s) => s.get('questionId') as string);
  }

  const payload: SessionMeta = {
    id: snap.id,
    subject: data.subject,
    questionIds,
    attemptedQuestionIds,
    completed: data.totalScore !== null && data.totalScore !== undefined,
  };
  return Response.json(payload);
}
