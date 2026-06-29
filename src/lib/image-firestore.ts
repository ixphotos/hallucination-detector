import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ImageQuestion, ImageSession, ImageAttempt } from '@/types';

// ── Questions ────────────────────────────────────────────────────────────────

export async function getAllImageQuestions(): Promise<ImageQuestion[]> {
  const snap = await getDocs(collection(db(), 'imageQuestions'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ImageQuestion[];
}

export async function getActiveImageQuestions(mode?: ImageQuestion['mode'], subject?: string): Promise<ImageQuestion[]> {
  let q = query(
    collection(db(), 'imageQuestions'),
    where('active', '==', true),
    where('licensingEnabled', '==', true),
  );
  const snap = await getDocs(q);
  let results = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ImageQuestion[];
  if (mode && mode !== 'mixed') results = results.filter((r) => r.mode === mode);
  if (subject) results = results.filter((r) => r.subject === subject);
  return results;
}

export async function getImageQuestion(id: string): Promise<ImageQuestion | null> {
  const snap = await getDoc(doc(db(), 'imageQuestions', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ImageQuestion;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function createImageSession(
  userId: string,
  mode: ImageSession['mode'],
  questionIds: string[],
  subjectFilter?: string,
): Promise<string> {
  const ref = await addDoc(collection(db(), 'imageSessions'), {
    userId,
    mode,
    questionIds,
    attemptIds: [],
    totalScore: null,
    subjectFilter: subjectFilter ?? null,
    startedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getImageSession(id: string): Promise<ImageSession | null> {
  const snap = await getDoc(doc(db(), 'imageSessions', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    startedAt: data.startedAt?.toDate() ?? new Date(),
    completedAt: data.completedAt?.toDate(),
  } as ImageSession;
}

export async function updateImageSession(sessionId: string, attemptId: string): Promise<void> {
  await updateDoc(doc(db(), 'imageSessions', sessionId), {
    attemptIds: arrayUnion(attemptId),
  });
}

export async function completeImageSession(sessionId: string, totalScore: number): Promise<void> {
  await updateDoc(doc(db(), 'imageSessions', sessionId), {
    totalScore,
    completedAt: serverTimestamp(),
  });
}

export async function getTeacherImageSessions(userId: string): Promise<ImageSession[]> {
  const q = query(collection(db(), 'imageSessions'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      startedAt: d.data().startedAt?.toDate() ?? new Date(),
      completedAt: d.data().completedAt?.toDate(),
    }) as ImageSession)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

// ── Attempts ─────────────────────────────────────────────────────────────────

export async function saveImageAttempt(attempt: Omit<ImageAttempt, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db(), 'imageAttempts'), {
    ...attempt,
    submittedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getImageAttemptsByIds(ids: string[]): Promise<ImageAttempt[]> {
  if (ids.length === 0) return [];
  const results = await Promise.all(
    ids.map(async (id) => {
      const snap = await getDoc(doc(db(), 'imageAttempts', id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ImageAttempt;
    }),
  );
  return results.filter(Boolean) as ImageAttempt[];
}
