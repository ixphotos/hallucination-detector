'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getTeacherAttempts } from '@/lib/firestore';
import NavBar from '@/components/NavBar';
import type { Attempt } from '@/types';

function ScoreBadge({ score }: { score: number }) {
  const colour =
    score >= 80 ? 'bg-green-100 text-green-700' :
    score >= 50 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colour}`}>
      {score}%
    </span>
  );
}

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
    if (user) {
      getTeacherAttempts(user.uid).then((a) => { setAttempts(a); setFetching(false); });
    }
  }, [user, loading, router]);

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

  const avgScore = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
    : null;

  const subjectScores: Record<string, { total: number; count: number }> = {};
  attempts.forEach((a) => {
    if (!subjectScores[a.subject]) subjectScores[a.subject] = { total: 0, count: 0 };
    subjectScores[a.subject].total += a.score;
    subjectScores[a.subject].count += 1;
  });

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {profile?.name?.split(' ')[0]}</h1>
          <p className="text-gray-500 mt-1">Track your hallucination detection accuracy over time.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Quizzes completed</div>
            <div className="text-3xl font-bold text-gray-900">{attempts.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Average score</div>
            <div className="text-3xl font-bold text-gray-900">{avgScore !== null ? `${avgScore}%` : '—'}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Subjects attempted</div>
            <div className="text-3xl font-bold text-gray-900">{Object.keys(subjectScores).length}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent attempts</h2>
          <Link
            href="/quiz"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New quiz
          </Link>
        </div>

        {attempts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 border-dashed p-12 text-center">
            <p className="text-gray-400 mb-4">You haven&apos;t completed any quizzes yet.</p>
            <Link
              href="/quiz"
              className="inline-flex px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Take your first quiz
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Caught</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Missed</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">False positives</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.subject}</td>
                    <td className="px-4 py-3"><ScoreBadge score={a.score} /></td>
                    <td className="px-4 py-3 hidden sm:table-cell text-green-600">{a.tp}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-red-600">{a.fn}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-orange-600">{a.fp}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-400">
                      {a.completedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/results/${a.id}`} className="text-indigo-600 hover:underline text-xs">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
