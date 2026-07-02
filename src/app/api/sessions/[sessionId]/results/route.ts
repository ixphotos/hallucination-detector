import { adminDb } from '@/lib/server/firebase-admin';
import { authenticate, handleRouteError, isAdmin, jsonError } from '@/lib/server/api-helpers';
import type { Highlight, Question, SessionResultsPayload } from '@/types';

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    return await getResultsResponse(request, context);
  } catch (err) {
    return handleRouteError(err, 'Failed to load results');
  }
}

async function getResultsResponse(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  const user = await authenticate(request);
  if (!user) return jsonError('Unauthorized', 401);

  const { sessionId } = await params;
  const db = adminDb();
  const snap = await db.collection('quizSessions').doc(sessionId).get();
  if (!snap.exists) return jsonError('Session not found', 404);

  const data = snap.data()!;
  if (data.teacherId !== user.uid && !(await isAdmin(user.uid))) {
    return jsonError('Forbidden', 403);
  }

  const questionIds: string[] = data.questionIds ?? [];
  const attemptIds: string[] = data.attemptIds ?? [];

  // Answers (hallucinations) are only revealed once every question in the
  // session has been attempted.
  if (attemptIds.length < questionIds.length) {
    return jsonError('Session is not complete yet', 409);
  }

  const attemptsColl = db.collection('attempts');
  const questionsColl = db.collection('questions');
  const [attemptSnaps, questionSnaps] = await Promise.all([
    attemptIds.length > 0
      ? db.getAll(...attemptIds.map((id) => attemptsColl.doc(id)))
      : Promise.resolve([]),
    questionIds.length > 0
      ? db.getAll(...questionIds.map((id) => questionsColl.doc(id)))
      : Promise.resolve([]),
  ]);

  const attempts = attemptSnaps
    .filter((s) => s.exists)
    .map((s) => {
      const a = s.data()!;
      return {
        id: s.id,
        questionId: a.questionId as string,
        highlights: (a.highlights ?? []) as Highlight[],
        score: a.score as number,
        tp: a.tp as number,
        fp: a.fp as number,
        fn: a.fn as number,
        timeTaken: a.timeTaken as number,
      };
    });

  const questions = questionSnaps
    .filter((s) => s.exists)
    .map((s) => ({ id: s.id, ...s.data() }) as Question);

  const payload: SessionResultsPayload = {
    session: {
      id: snap.id,
      subject: data.subject,
      questionIds,
      totalScore: data.totalScore ?? null,
    },
    attempts,
    questions,
  };
  return Response.json(payload);
}
