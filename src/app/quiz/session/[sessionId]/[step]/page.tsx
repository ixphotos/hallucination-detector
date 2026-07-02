'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSession, getQuizQuestion, submitAttempt } from '@/lib/api-client';
import NavBar from '@/components/NavBar';
import PassageHighlighter from '@/components/PassageHighlighter';
import type { QuizQuestion, Highlight } from '@/types';

// Module-level cache persists across step-to-step navigations without a
// refetch. Questions are served sanitised (no answer key), so caching them
// client-side is safe.
const questionCache = new Map<string, QuizQuestion>();

function getCachedSession(sessionId: string): { subject: string; questionIds: string[] } | null {
  try {
    const raw = sessionStorage.getItem(`qs:${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function SessionStepPage({
  params,
}: {
  params: Promise<{ sessionId: string; step: string }>;
}) {
  const { sessionId, step } = use(params);
  const stepNum = parseInt(step, 10);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [subject, setSubject] = useState('');
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState('');
  const startTime = useRef(0);

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    if (!Number.isInteger(stepNum) || stepNum < 1) { router.replace('/quiz'); return; }

    async function load() {
      try {
        // 1. Get session metadata — sessionStorage first, API fallback
        const cached = getCachedSession(sessionId);
        let ids: string[];
        let sub: string;

        if (cached) {
          ids = cached.questionIds;
          sub = cached.subject;
        } else {
          const s = await getSession(sessionId);
          ids = s.questionIds;
          sub = s.subject;
          sessionStorage.setItem(`qs:${sessionId}`, JSON.stringify({ subject: sub, questionIds: ids }));
        }

        setQuestionIds(ids);
        setSubject(sub);

        // 2. Get current question — module cache first, API fallback
        const qId = ids[stepNum - 1];
        if (!qId) { router.replace('/quiz'); return; }

        let q = questionCache.get(qId) ?? null;
        if (!q) {
          q = await getQuizQuestion(qId);
          questionCache.set(qId, q);
        }
        setQuestion(q);
        setFetching(false);
        startTime.current = Date.now();

        // 3. Prefetch the next question in the background while the user reads
        const nextId = ids[stepNum];
        if (nextId && !questionCache.has(nextId)) {
          getQuizQuestion(nextId)
            .then((nq) => { questionCache.set(nextId, nq); })
            .catch(() => { /* refetched on the next step if needed */ });
        }
      } catch (err) {
        console.error(err);
        const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
        setLoadError(`Failed to load the question${detail}. Please check your connection and refresh.`);
        setFetching(false);
      }
    }
    load();
  }, [user, sessionId, stepNum, router]);

  const totalSteps = questionIds.length;
  const isLastStep = stepNum >= totalSteps;

  async function handleSubmit() {
    if (!user || !question) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
      // The server scores the attempt, appends it to the session and, on the
      // final question, computes the total — atomically and idempotently, so
      // a retried submit never creates a duplicate.
      const result = await submitAttempt({
        sessionId,
        questionId: question.id,
        highlights,
        timeTaken,
      });

      if (result.sessionComplete) {
        router.push(`/quiz/session/${sessionId}/results`);
      } else {
        router.push(`/quiz/session/${sessionId}/${stepNum + 1}`);
      }
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
      setSubmitError(`Failed to save your answer${detail}. Please check your connection and try again.`);
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

  if (loadError || !question) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {loadError || 'Question not found.'}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
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
          <span className="text-sm text-gray-500">Question {stepNum} of {totalSteps}</span>
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
                : isLastStep
                ? 'Finish & see results'
                : 'Next question →'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
