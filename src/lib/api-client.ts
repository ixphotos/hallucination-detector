import { auth } from './firebase';
import type {
  Highlight,
  QuizQuestion,
  SessionMeta,
  SessionResultsPayload,
  SubjectCount,
  SubmitAttemptResult,
} from '@/types';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const user = auth().currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // keep generic message
    }
    throw new Error(message);
  }
  return res.json();
}

export function getSubjectCounts(): Promise<SubjectCount[]> {
  return apiFetch('/api/subjects');
}

export function createSession(subject: string): Promise<SessionMeta> {
  return apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify({ subject }) });
}

export function getSession(sessionId: string): Promise<SessionMeta> {
  return apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

export function getQuizQuestion(questionId: string): Promise<QuizQuestion> {
  return apiFetch(`/api/questions/${encodeURIComponent(questionId)}`);
}

export function submitAttempt(payload: {
  sessionId: string;
  questionId: string;
  highlights: Highlight[];
  timeTaken: number;
}): Promise<SubmitAttemptResult> {
  return apiFetch('/api/attempts', { method: 'POST', body: JSON.stringify(payload) });
}

export function getSessionResults(sessionId: string): Promise<SessionResultsPayload> {
  return apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/results`);
}
