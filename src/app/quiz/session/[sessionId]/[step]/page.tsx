'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getQuizSession,
  getQuestion,
  saveAttempt,
  updateQuizSession,
  completeQuizSession,
} from '@/lib/firestore';
import { scoreAttempt } from '@/lib/scoring';
import NavBar from '@/components/NavBar';
import PassageHighlighter from '@/components/PassageHighlighter';
import type { Question, Highlight } from '@/types';

// Module-level cache persists across step-to-step navigations without a Firestore read
const questionCache = new Map<string, Question>();

function getCachedSession(sessionId: string): { subject: string; questionIds: string[] } | null {
  try {
    const raw = sessionStorage.getItem(`qs:${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getCachedScores(sessionId: string): number[] {
  try {
    return JSON.parse(sessionStorage.getItem(`qs-scores:${sessionId}`) || '[]');
  } catch { return []; }
}

function appendCachedScore(sessionId: string, score: number) {
  const prev = getCachedScores(sessionId);
  sessionStorage.setItem(`qs-scores:${sessionId}`, JSON.stringify([...prev, score]));
}

export default function SessionStepPage({
  params,
}: {
  params: Promise<{ sessionId: string; step: string }>;
}) {
  const { sessionId, step } = use(params);
  const stepNum = parseInt(step, 10);
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [subject, setSubject] = useState('');
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fetching, setFetching] = useState(true);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      // 1. Get session metadata — sessionStorage first, Firestore fallback
      const cached = getCachedSession(sessionId);
      let ids: string[];
      let sub: string;

      if (cached) {
        ids = cached.questionIds;
        sub = cached.subject;
      } else {
        const s = await getQuizSession(sessionId);
        if (!s) { router.replace('/quiz'); return; }
        ids = s.questionIds;
        sub = s.subject;
        sessionStorage.setItem(`qs:${sessionId}`, JSON.stringify({ subject: sub, questionIds: ids }));
      }

      setQuestionIds(ids);
      setSubject(sub);

      // 2. Get current question — module cache first, Firestore fallback
      const qId = ids[stepNum - 1];
      if (!qId) { router.replace('/quiz'); return; }

      let q = questionCache.get(qId) ?? null;
      if (!q) {
        q = await getQuestion(qId);
        if (q) questionCache.set(qId, q);
      }
      setQuestion(q);
      setFetching(false);
      startTime.current = Date.now();

      // 3. Prefetch next question in the background while user reads
      if (stepNum < 3) {
        const nextId = ids[stepNum];
        if (nextId && !questionCache.has(nextId)) {
          getQuestion(nextId).then((nq) => { if (nq) questionCache.set(nextId, nq); });
        }
      }
    }
    load();
  }, [user, sessionId, stepNum, router]);

  async function handleSubmit() {
    if (!user || !question) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
      const { score, tp, fp, fn } = scoreAttempt(highlights, question.hallucinations);

      // Save attempt — must await to get the ID
      const attemptId = await saveAttempt({
        teacherId: user.uid,
        teacherName: profile?.name ?? user.email ?? 'Teacher',
        questionId: question.id,
        subject,
        highlights,
        score,
        tp,
        fp,
        fn,
        timeTaken,
      });

      // Store score locally for cumulative total
      appendCachedScore(sessionId, score);

      if (stepNum < 3) {
        // Fire-and-forget: user doesn't need to wait for this write
        updateQuizSession(sessionId, attemptId);
        router.push(`/quiz/session/${sessionId}/${stepNum + 1}`);
      } else {
        // Final step: need attemptIds complete before results page reads them
        await updateQuizSession(sessionId, attemptId);

        // Compute total from cached scores — avoids re-reading 3 attempt docs
        const allScores = getCachedScores(sessionId);
        const totalScore = allScores.length > 0
          ? Math.round(allScores.reduce((s, n) => s + n, 0) / allScores.length)
          : score;

        // Fire-and-forget: results page uses totalScore fallback if this hasn't landed yet
        completeQuizSession(sessionId, totalScore);
        router.push(`/quiz/session/${sessionId}/results`);
      }
    } catch (err) {
      console.error(err);
      setSubmitError('Failed to save your answer. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  if (loading || fetching) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading question…</div>
        </div>
      </>
    );
  }

  if (!question) return null;

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-2 w-12 rounded-full transition-colors ${
                  n < stepNum ? 'bg-indigo-600' :
                  n === stepNum ? 'bg-indigo-400' :
                  'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500">Question {stepNum} of 3</span>
          <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">
            {subject}
          </span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-6">{question.title}</h1>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong>Instructions:</strong> Read the passage carefully. Some information may have been fabricated by AI. Highlight any text you believe is a hallucination by clicking and dragging over it. Click a highlighted section to remove it.
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <PassageHighlighter
            passage={question.passage}
            highlights={highlights}
            onChange={setHighlights}
          />
        </div>

        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {highlights.length === 0
              ? 'No text highlighted yet'
              : `${highlights.length} section${highlights.length === 1 ? '' : 's'} highlighted`}
          </div>
          <div className="flex gap-3">
            {highlights.length > 0 && (
              <button
                onClick={() => setHighlights([])}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting
                ? 'Saving…'
                : stepNum < 3
                ? 'Next question →'
                : 'Finish & see results'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
