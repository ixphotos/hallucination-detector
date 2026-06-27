'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getQuizSession, getAttemptsByIds, getQuestion } from '@/lib/firestore';
import NavBar from '@/components/NavBar';
import PassageHighlighter from '@/components/PassageHighlighter';
import type { QuizSession, Attempt, Question } from '@/types';

const OVERLAP = 0.5;

function overlapRatio(a: { start: number; end: number }, b: { start: number; end: number }) {
  const os = Math.max(a.start, b.start);
  const oe = Math.min(a.end, b.end);
  if (oe <= os) return 0;
  return (oe - os) / (b.end - b.start);
}

function ScoreRing({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const colour = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const dim = size === 'lg' ? 140 : 80;
  const r = size === 'lg' ? 55 : 30;
  const sw = size === 'lg' ? 12 : 8;
  const fs = size === 'lg' ? 28 : 18;
  return (
    <svg viewBox={`0 0 ${dim} ${dim}`} width={dim} height={dim}>
      <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
      <circle
        cx={dim / 2} cy={dim / 2} r={r}
        fill="none" stroke={colour} strokeWidth={sw}
        strokeDasharray={`${(score / 100) * (2 * Math.PI * r)} ${2 * Math.PI * r}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
      />
      <text x={dim / 2} y={dim / 2 + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight="700" fill={colour}>
        {score}%
      </text>
    </svg>
  );
}

export default function SessionResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const s = await getQuizSession(sessionId);
      if (!s) { router.replace('/dashboard'); return; }
      setSession(s);
      const [attemptsData, questionsData] = await Promise.all([
        getAttemptsByIds(s.attemptIds),
        Promise.all(s.questionIds.map((id) => getQuestion(id))),
      ]);
      setAttempts(attemptsData);
      setQuestions(questionsData.filter(Boolean) as Question[]);
      setFetching(false);
    }
    load();
  }, [user, sessionId, router]);

  if (loading || fetching) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading results…</div>
      </>
    );
  }

  if (!session) return null;

  const totalScore = session.totalScore ?? Math.round(attempts.reduce((s, a) => s + a.score, 0) / Math.max(attempts.length, 1));

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="mb-2 flex items-center gap-2">
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">{session.subject}</span>
          <span className="text-xs text-gray-400">3-question session</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Session Complete</h1>

        {/* Cumulative score */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={totalScore} />
          <div className="text-center sm:text-left">
            <div className="text-sm text-gray-500 mb-1">Overall session score</div>
            <div className="text-4xl font-bold text-gray-900 mb-3">{totalScore}%</div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">{attempts.reduce((s, a) => s + a.tp, 0)} caught</span>
              <span className="text-red-600 font-medium">{attempts.reduce((s, a) => s + a.fn, 0)} missed</span>
              <span className="text-orange-500 font-medium">{attempts.reduce((s, a) => s + a.fp, 0)} false positives</span>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <h2 className="text-base font-semibold text-gray-900 mb-3">Question breakdown</h2>
        <div className="space-y-3 mb-6">
          {questions.map((q, i) => {
            const attempt = attempts[i];
            if (!attempt) return null;
            const isExpanded = expanded === i;
            const correctRanges = q.hallucinations.map((h) => ({ start: h.start, end: h.end }));
            const missedRanges = q.hallucinations
              .filter((h) => !attempt.highlights.some((hl) => overlapRatio(hl, h) >= OVERLAP))
              .map((h) => ({ start: h.start, end: h.end }));

            return (
              <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <ScoreRing score={attempt.score} size="sm" />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{q.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {attempt.tp} caught · {attempt.fn} missed · {attempt.fp} false positive{attempt.fp !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    <div className="flex gap-3 text-xs mb-3 flex-wrap text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 inline-block"></span> Correct</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block"></span> Missed</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-200 inline-block"></span> False positive</span>
                    </div>
                    <PassageHighlighter
                      passage={q.passage}
                      highlights={attempt.highlights}
                      onChange={() => {}}
                      readonly
                      correctRanges={correctRanges}
                      missedRanges={missedRanges}
                    />
                    {q.hallucinations.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {q.hallucinations.map((h, hi) => (
                          <div key={hi} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-600 italic mb-1">"{h.text}"</p>
                            <p className="text-xs text-gray-500">{h.explanation}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Link
            href="/quiz"
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try another set
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
