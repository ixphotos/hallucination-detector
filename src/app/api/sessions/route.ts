import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { authenticate, jsonError } from '@/lib/server/api-helpers';
import type { SessionMeta } from '@/types';

const SESSION_TARGET_LENGTH = 3;

function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user) return jsonError('Unauthorized', 401);

  let subject: unknown;
  try {
    ({ subject } = await request.json());
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  if (typeof subject !== 'string' || !subject.trim()) {
    return jsonError('subject is required', 400);
  }

  const db = adminDb();
  const snap = await db.collection('questions').select('subject').get();
  const inSubject = shuffle(snap.docs.filter((d) => d.get('subject') === subject)).map((d) => d.id);
  const others = shuffle(snap.docs.filter((d) => d.get('subject') !== subject)).map((d) => d.id);
  // Pad with other subjects when the chosen one has too few questions.
  const questionIds = [...inSubject, ...others].slice(0, SESSION_TARGET_LENGTH);
  if (questionIds.length === 0) return jsonError('No questions available', 409);

  const profileSnap = await db.collection('profiles').doc(user.uid).get();
  const teacherName =
    profileSnap.data()?.name ?? user.name ?? user.email?.split('@')[0] ?? 'Teacher';

  const ref = await db.collection('quizSessions').add({
    teacherId: user.uid,
    teacherName,
    subject,
    questionIds,
    attemptIds: [],
    totalScore: null,
    startedAt: FieldValue.serverTimestamp(),
  });

  const payload: SessionMeta = {
    id: ref.id,
    subject,
    questionIds,
    attemptedQuestionIds: [],
    completed: false,
  };
  return Response.json(payload, { status: 201 });
}
