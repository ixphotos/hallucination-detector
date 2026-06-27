'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getAttempt } from '@/lib/firestore';
import NavBar from '@/components/NavBar';
import PassageHighlighter from '@/components/PassageHighlighter';
import questions from '@/data/questions.json';
import type { Attempt, Question } from '@/types';

const allQuestions = questions as Question[];

function ScoreRing({ score }: { score: number }) {
  const colour = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 120" className="w-32 h-32">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="60" cy="60" r="50"
          fill="none"
          stroke={colour}
          strokeWidth="12"
          strokeDasharray={`${(score / 100) * 314} 314`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="65" textAnchor="middle" fontSize="28" fontWeight="700" fill={colour}>
          {score}%
        </text>
      </svg>
    </div>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
    if (user) {
      getAttempt(attemptId).then((a) => { setAttempt(a); setFetching(false); });
    }
  }, [user, loading, router, attemptId]);

  if (loading || fetching) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading…</div>
        </div>
      </>
    );
  }

  if (!attempt) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Result not found.</p>
        </div>
      </>
    );
  }

  const question = allQuestions.find((q) => q.id === attempt.questionId);
  if (!question) return null;

  const correctRanges = question.hallucinations.map((h) => ({ start: h.start, end: h.end }));
  // Missed = hallucinations not covered by any highlight
  const OVERLAP = 0.5;
  const missedRanges = question.hallucinations
    .filter((h) => !attempt.highlights.some((hl) => {
      const os = Math.max(hl.start, h.start);
      const oe = Math.min(hl.end, h.end);
      return oe > os && (oe - os) / (h.end - h.start) >= OVERLAP;
    }))
    .map((h) => ({ start: h.start, end: h.end }));

  const mins = Math.floor(attempt.timeTaken / 60);
  const secs = attempt.timeTaken % 60;

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">{attempt.subject}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-6">{question.title} — Results</h1>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={attempt.score} />
          <div className="grid grid-cols-3 gap-4 flex-1">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{attempt.tp}</div>
              <div className="text-xs text-gray-500 mt-1">Hallucinations caught</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{attempt.fn}</div>
              <div className="text-xs text-gray-500 mt-1">Hallucinations missed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{attempt.fp}</div>
              <div className="text-xs text-gray-500 mt-1">False positives</div>
            </div>
            <div className="col-span-3 text-center text-xs text-gray-400 mt-2">
              Time taken: {mins > 0 ? `${mins}m ` : ''}{secs}s
            </div>
          </div>
        </div>

        <div className="flex gap-3 text-xs mb-4 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-green-200 inline-block"></span> Correctly identified hallucination</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-200 inline-block"></span> Missed hallucination</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-orange-200 inline-block"></span> False positive (not a hallucination)</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <PassageHighlighter
            passage={question.passage}
            highlights={attempt.highlights}
            onChange={() => {}}
            readonly
            correctRanges={correctRanges}
            missedRanges={missedRanges}
          />
        </div>

        {question.hallucinations.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Hallucination explanations</h2>
            <div className="space-y-3">
              {question.hallucinations.map((h, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1 italic">"{h.text}"</p>
                  <p className="text-sm text-gray-600">{h.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href="/quiz"
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try another quiz
          </Link>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    </>
  );
}
