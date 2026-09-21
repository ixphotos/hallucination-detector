import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Profile, Attempt, QuizSession, Question, Hallucination } from '@/types';

// Quiz-taking reads and writes (sanitised questions, attempts, session
// creation/updates) go through the API routes in src/app/api — scores are
// computed server-side and the answer key never reaches the client during a
// quiz. This module covers the reads and admin operations that Firestore
// security rules allow directly.

// ── Profiles ────────────────────────────────────────────────────────────────

export async function createProfile(userId: string, name: string, email: string): Promise<void> {
  await setDoc(doc(db(), 'profiles', userId), {
    name,
    email,
    role: 'teacher',
    createdAt: serverTimestamp(),
  });
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db(), 'profiles', userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    email: data.email,
    role: data.role,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

// ── Questions (admin only — see firestore.rules) ────────────────────────────

export async function getAllQuestions(): Promise<Question[]> {
  const snap = await getDocs(collection(db(), 'questions'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);
}

export async function getQuestion(questionId: string): Promise<Question | null> {
  const snap = await getDoc(doc(db(), 'questions', questionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Question;
}

/**
 * Recompute hallucination offsets from the passage. Throws if a
 * hallucination's text does not appear in the passage, or appears more than
 * once (ambiguous — offsets could point at the wrong occurrence).
 */
function withRecomputedOffsets(passage: string, hallucinations: Hallucination[]): Hallucination[] {
  return hallucinations.map((h) => {
    const first = passage.indexOf(h.text);
    if (first === -1) {
      throw new Error(`Hallucination text not found in passage: "${h.text.slice(0, 60)}"`);
    }
    if (passage.indexOf(h.text, first + 1) !== -1) {
      throw new Error(
        `Hallucination text appears more than once in the passage — extend it so it is unique: "${h.text.slice(0, 60)}"`
      );
    }
    return { ...h, start: first, end: first + h.text.length };
  });
}

export async function saveQuestion(question: Question): Promise<void> {
  const hallucinations = withRecomputedOffsets(question.passage, question.hallucinations);
  const { id, ...data } = { ...question, hallucinations };
  await setDoc(doc(db(), 'questions', id), data);
}

export async function createQuestion(question: Omit<Question, 'id'>): Promise<string> {
  const hallucinations = withRecomputedOffsets(question.passage, question.hallucinations);
  const ref = await addDoc(collection(db(), 'questions'), { ...question, hallucinations });
  return ref.id;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await deleteDoc(doc(db(), 'questions', questionId));
}

// ── Sessions & attempts (owner/admin reads) ─────────────────────────────────

export async function getTeacherSessions(teacherId: string): Promise<QuizSession[]> {
  const q = query(collection(db(), 'quizSessions'), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs
    .map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
          startedAt: d.data().startedAt?.toDate() ?? new Date(),
          completedAt: d.data().completedAt?.toDate(),
        }) as QuizSession
    )
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

export async function getAllAttempts(): Promise<Attempt[]> {
  const snap = await getDocs(collection(db(), 'attempts'));
  return snap.docs
    .map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
          completedAt: d.data().completedAt?.toDate() ?? new Date(),
        }) as Attempt
    )
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}
