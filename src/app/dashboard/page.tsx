'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getTeacherSessions } from '@/lib/firestore';
import NavBar from '@/components/NavBar';
import type { QuizSession } from '@/types';

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
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
    if (user) {
      getTeacherSessions(user.uid)
        .then((s) => setSessions(s))
        .catch((err) => {
          console.error(err);
          setLoadError('Failed to load your sessions. Please refresh the page to try again.');
        })
        .finally(() => setFetching(false));
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

  const completedSessions = sessions.filter((s) => s.totalScore !== null);
  const avgScore = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((s, a) => s + (a.totalScore ?? 0), 0) / completedSessions.length)
    : null;

  const subjectSet = new Set(sessions.map((s) => s.subject));

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {profile?.name?.split(' ')[0]}</h1>
          <p className="text-gray-500 mt-1">Track your hallucination detection accuracy over time.</p>
        </div>

        {loadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">
            {loadError}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Sessions completed</div>
            <div className="text-3xl font-bold text-gray-900">{completedSessions.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Average score</div>
            <div className="text-3xl font-bold text-gray-900">{avgScore !== null ? `${avgScore}%` : '—'}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Subjects attempted</div>
            <div className="text-3xl font-bold text-gray-900">{subjectSet.size}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent sessions</h2>
          <Link
            href="/quiz"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New session
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 border-dashed p-12 text-center">
            <p className="text-gray-400 mb-4">You haven&apos;t completed any sessions yet.</p>
            <Link
              href="/quiz"
              className="inline-flex px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Take your first session
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map((s) => {
                  const completed = s.totalScore !== null;
                  const totalSteps = s.questionIds.length;
                  const stepsDone = s.attemptIds.length;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.subject}</td>
                      <td className="px-4 py-3">
                        {completed ? <ScoreBadge score={s.totalScore!} /> : <span className="text-gray-400 text-xs">In progress</span>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-500 text-xs">
                        {completed ? `${totalSteps} of ${totalSteps} complete` : `${stepsDone} of ${totalSteps} done`}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-400">
                        {s.startedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        {completed ? (
                          <Link href={`/quiz/session/${s.id}/results`} className="text-indigo-600 hover:underline text-xs">
                            Review
                          </Link>
                        ) : (
                          <Link href={`/quiz/session/${s.id}/${stepsDone + 1}`} className="text-indigo-600 hover:underline text-xs">
                            Continue
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
