import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Profile, Attempt, QuizSession, Question } from '@/types';

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

export async function getAllProfiles(): Promise<Profile[]> {
  const snap = await getDocs(collection(db(), 'profiles'));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
  })) as Profile[];
}

// ── Questions ────────────────────────────────────────────────────────────────

export async function getAllQuestions(): Promise<Question[]> {
  const snap = await getDocs(collection(db(), 'questions'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Question[];
}

export async function getQuestionsBySubject(subject: string): Promise<Question[]> {
  const q = query(collection(db(), 'questions'), where('subject', '==', subject));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Question[];
}

export async function getQuestion(questionId: string): Promise<Question | null> {
  const snap = await getDoc(doc(db(), 'questions', questionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Question;
}

export async function saveQuestion(question: Question): Promise<void> {
  // Recompute offsets in case passage changed
  const hallucinations = question.hallucinations.map((h) => {
    const idx = question.passage.indexOf(h.text);
    if (idx !== -1) return { ...h, start: idx, end: idx + h.text.length };
    return h;
  });
  const { id, ...data } = { ...question, hallucinations };
  await setDoc(doc(db(), 'questions', id), data);
}

export async function createQuestion(question: Omit<Question, 'id'>): Promise<string> {
  const hallucinations = question.hallucinations.map((h) => {
    const idx = question.passage.indexOf(h.text);
    if (idx !== -1) return { ...h, start: idx, end: idx + h.text.length };
    return h;
  });
  const ref = await addDoc(collection(db(), 'questions'), { ...question, hallucinations });
  return ref.id;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await deleteDoc(doc(db(), 'questions', questionId));
}

// ── Attempts ─────────────────────────────────────────────────────────────────

export async function saveAttempt(attempt: Omit<Attempt, 'id' | 'completedAt'>): Promise<string> {
  const ref = await addDoc(collection(db(), 'attempts'), {
    ...attempt,
    completedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getAttempt(attemptId: string): Promise<Attempt | null> {
  const snap = await getDoc(doc(db(), 'attempts', attemptId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    completedAt: data.completedAt?.toDate() ?? new Date(),
  } as Attempt;
}

export async function getAttemptsByIds(ids: string[]): Promise<Attempt[]> {
  if (ids.length === 0) return [];
  const results = await Promise.all(ids.map((id) => getAttempt(id)));
  return results.filter(Boolean) as Attempt[];
}

// ── Quiz Sessions ─────────────────────────────────────────────────────────────

export async function createQuizSession(
  teacherId: string,
  teacherName: string,
  subject: string,
  questionIds: string[]
): Promise<string> {
  const ref = await addDoc(collection(db(), 'quizSessions'), {
    teacherId,
    teacherName,
    subject,
    questionIds,
    attemptIds: [],
    totalScore: null,
    startedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuizSession(sessionId: string, attemptId: string): Promise<void> {
  await updateDoc(doc(db(), 'quizSessions', sessionId), {
    attemptIds: arrayUnion(attemptId),
  });
}

export async function completeQuizSession(sessionId: string, totalScore: number): Promise<void> {
  await updateDoc(doc(db(), 'quizSessions', sessionId), {
    totalScore,
    completedAt: serverTimestamp(),
  });
}

export async function getQuizSession(sessionId: string): Promise<QuizSession | null> {
  const snap = await getDoc(doc(db(), 'quizSessions', sessionId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    startedAt: data.startedAt?.toDate() ?? new Date(),
    completedAt: data.completedAt?.toDate(),
  } as QuizSession;
}

export async function getTeacherSessions(teacherId: string): Promise<QuizSession[]> {
  const q = query(collection(db(), 'quizSessions'), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      startedAt: d.data().startedAt?.toDate() ?? new Date(),
      completedAt: d.data().completedAt?.toDate(),
    }) as QuizSession)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

export async function getAllSessions(): Promise<QuizSession[]> {
  const snap = await getDocs(collection(db(), 'quizSessions'));
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      startedAt: d.data().startedAt?.toDate() ?? new Date(),
      completedAt: d.data().completedAt?.toDate(),
    }) as QuizSession)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

// Legacy: kept for admin page stats
export async function getAllAttempts(): Promise<Attempt[]> {
  const snap = await getDocs(collection(db(), 'attempts'));
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      completedAt: d.data().completedAt?.toDate() ?? new Date(),
    }) as Attempt)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

export async function getTeacherAttempts(teacherId: string): Promise<Attempt[]> {
  const q = query(collection(db(), 'attempts'), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      completedAt: d.data().completedAt?.toDate() ?? new Date(),
    }) as Attempt)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}
