'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { saveAttempt } from '@/lib/firestore';
import { scoreAttempt } from '@/lib/scoring';
import NavBar from '@/components/NavBar';
import PassageHighlighter from '@/components/PassageHighlighter';
import questions from '@/data/questions.json';
import type { Question, Highlight } from '@/types';

const allQuestions = questions as Question[];

export default function QuizPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = use(params);
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const question = allQuestions.find((q) => q.id === questionId);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  if (loading) return null;
  if (!question) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Question not found.</p>
        </div>
      </>
    );
  }

  async function handleSubmit() {
    if (!user || !question) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
      const { score, tp, fp, fn } = scoreAttempt(highlights, question.hallucinations);
      const attemptId = await saveAttempt({
        teacherId: user.uid,
        teacherName: profile?.name ?? user.email ?? 'Teacher',
        questionId: question.id,
        subject: question.subject,
        highlights,
        score,
        tp,
        fp,
        fn,
        timeTaken,
      });
      router.push(`/results/${attemptId}`);
    } catch (err) {
      console.error(err);
      setSubmitError('Failed to save your attempt. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">{question.subject}</span>
          <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">{question.level}</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-6">{question.title}</h1>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong>Instructions:</strong> Read the passage below. Some information has been fabricated by AI. Select the text you believe is a hallucination by clicking and dragging over it. Click a highlighted section to remove it. When you&apos;re ready, press <strong>Submit</strong>.
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <PassageHighlighter
            passage={question.passage}
            highlights={highlights}
            onChange={setHighlights}
          />
        </div>

        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{submitError}</p>
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
              {submitting ? 'Saving…' : 'Submit'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
