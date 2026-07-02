import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { authenticate, handleRouteError, jsonError } from '@/lib/server/api-helpers';
import { scoreAttempt } from '@/lib/scoring';
import type { Hallucination, Highlight, SubmitAttemptResult } from '@/types';

const MAX_HIGHLIGHTS = 200;
const MAX_TIME_TAKEN = 60 * 60 * 24; // seconds

/**
 * Parse and sanitise client highlights. Text is recomputed from the passage
 * server-side so the stored highlight always matches its offsets.
 */
function sanitiseHighlights(raw: unknown, passage: string): Highlight[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_HIGHLIGHTS) return null;
  const highlights: Highlight[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const { start, end } = item as { start: unknown; end: unknown };
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    const s = start as number;
    const e = end as number;
    if (s < 0 || e > passage.length || s >= e) return null;
    highlights.push({ start: s, end: e, text: passage.slice(s, e) });
  }
  return highlights;
}

export async function POST(request: Request) {
  try {
    return await submitAttemptResponse(request);
  } catch (err) {
    if (err instanceof ApiError) return jsonError(err.message, err.status);
    return handleRouteError(err, 'Failed to save attempt');
  }
}

async function submitAttemptResponse(request: Request): Promise<Response> {
  const user = await authenticate(request);
  if (!user) return jsonError('Unauthorized', 401);

  let body: {
    sessionId?: unknown;
    questionId?: unknown;
    highlights?: unknown;
    timeTaken?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const { sessionId, questionId } = body;
  if (typeof sessionId !== 'string' || typeof questionId !== 'string') {
    return jsonError('sessionId and questionId are required', 400);
  }
  const timeTaken =
    typeof body.timeTaken === 'number' && Number.isFinite(body.timeTaken)
      ? Math.min(Math.max(Math.round(body.timeTaken), 0), MAX_TIME_TAKEN)
      : 0;

  const db = adminDb();
  const sessionRef = db.collection('quizSessions').doc(sessionId);
  const questionRef = db.collection('questions').doc(questionId);
  const attemptsColl = db.collection('attempts');

  const result = await db.runTransaction(async (tx): Promise<SubmitAttemptResult> => {
    // ── Reads (all before any write) ────────────────────────────────────
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) throw new ApiError('Session not found', 404);
    const session = sessionSnap.data()!;
    if (session.teacherId !== user.uid) throw new ApiError('Forbidden', 403);

    const questionIds: string[] = session.questionIds ?? [];
    if (!questionIds.includes(questionId)) {
      throw new ApiError('Question is not part of this session', 400);
    }

    const existingSnap = await tx.get(
      attemptsColl
        .where('sessionId', '==', sessionId)
        .where('questionId', '==', questionId)
        .limit(1)
    );

    const attemptIds: string[] = session.attemptIds ?? [];

    // Idempotent retry: this question was already submitted for this
    // session — return the stored result instead of duplicating it.
    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      const a = existing.data();
      return {
        attemptId: existing.id,
        score: a.score,
        tp: a.tp,
        fp: a.fp,
        fn: a.fn,
        sessionComplete: attemptIds.length >= questionIds.length,
        totalScore: session.totalScore ?? null,
      };
    }

    const questionSnap = await tx.get(questionRef);
    if (!questionSnap.exists) throw new ApiError('Question not found', 404);
    const question = questionSnap.data()!;
    const passage: string = question.passage ?? '';
    const hallucinations: Hallucination[] = question.hallucinations ?? [];

    const highlights = sanitiseHighlights(body.highlights, passage);
    if (!highlights) throw new ApiError('Invalid highlights', 400);

    // Previous attempts' scores are needed if this submission completes
    // the session (reads must happen before writes in a transaction).
    let previousScores: number[] = [];
    if (attemptIds.length > 0) {
      const prevSnaps = await tx.getAll(...attemptIds.map((id) => attemptsColl.doc(id)));
      previousScores = prevSnaps
        .filter((s) => s.exists)
        .map((s) => s.get('score') as number)
        .filter((s) => typeof s === 'number');
    }

    // ── Scoring + writes ────────────────────────────────────────────────
    const { score, tp, fp, fn } = scoreAttempt(highlights, hallucinations);

    const attemptRef = attemptsColl.doc();
    tx.create(attemptRef, {
      teacherId: user.uid,
      teacherName: session.teacherName ?? 'Teacher',
      sessionId,
      questionId,
      subject: session.subject,
      highlights,
      score,
      tp,
      fp,
      fn,
      timeTaken,
      completedAt: FieldValue.serverTimestamp(),
    });

    const newAttemptIds = [...attemptIds, attemptRef.id];
    const sessionComplete = newAttemptIds.length >= questionIds.length;
    const allScores = [...previousScores, score];
    const totalScore = sessionComplete
      ? Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length)
      : null;

    tx.update(sessionRef, {
      attemptIds: newAttemptIds,
      ...(sessionComplete
        ? { totalScore, completedAt: FieldValue.serverTimestamp() }
        : {}),
    });

    return { attemptId: attemptRef.id, score, tp, fp, fn, sessionComplete, totalScore };
  });

  return Response.json(result, { status: 201 });
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
