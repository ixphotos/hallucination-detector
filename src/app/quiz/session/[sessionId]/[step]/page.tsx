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
  getAttemptsByIds,
} from '@/lib/firestore';
import { scoreAttempt } from '@/lib/scoring';
import NavBar from '@/components/NavBar';
import PassageHighlighter from '@/components/PassageHighlighter';
import type { Question, Highlight, QuizSession } from '@/types';

export default function SessionStepPage({
  params,
}: {
  params: Promise<{ sessionId: string; step: string }>;
}) {
  const { sessionId, step } = use(params);
  const stepNum = parseInt(step, 10);
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<QuizSession | null>(null);
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
      const s = await getQuizSession(sessionId);
      if (!s) { router.replace('/quiz'); return; }
      setSession(s);
      const qId = s.questionIds[stepNum - 1];
      if (!qId) { router.replace('/quiz'); return; }
      const q = await getQuestion(qId);
      setQuestion(q);
      setFetching(false);
      startTime.current = Date.now();
    }
    load();
  }, [user, sessionId, stepNum, router]);

  async function handleSubmit() {
    if (!user || !question || !session) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
      const { score, tp, fp, fn } = scoreAttempt(highlights, question.hallucinations);
      const attemptId = await saveAttempt({
        teacherId: user.uid,
        teacherName: profile?.name ?? user.email ?? 'Teacher',
        questionId: question.id,
        subject: session.subject,
        highlights,
        score,
        tp,
        fp,
        fn,
        timeTaken,
      });
      await updateQuizSession(sessionId, attemptId);

      if (stepNum < 3) {
        setHighlights([]);
        router.push(`/quiz/session/${sessionId}/${stepNum + 1}`);
      } else {
        // Final question — compute cumulative score and complete session
        const updatedSession = await getQuizSession(sessionId);
        const allAttemptIds = [...(updatedSession?.attemptIds ?? [])];
        const allAttempts = await getAttemptsByIds(allAttemptIds);
        const totalScore = allAttempts.length > 0
          ? Math.round(allAttempts.reduce((s, a) => s + a.score, 0) / allAttempts.length)
          : score;
        await completeQuizSession(sessionId, totalScore);
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

  if (!question || !session) return null;

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
            {session.subject}
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
