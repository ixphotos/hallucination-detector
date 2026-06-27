'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAllAttempts } from '@/lib/firestore';
import NavBar from '@/components/NavBar';
import type { Attempt } from '@/types';

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) { router.replace('/'); return; }
      if (profile && profile.role !== 'admin') { router.replace('/dashboard'); return; }
    }
    if (user && profile?.role === 'admin') {
      getAllAttempts().then((a) => { setAttempts(a); setFetching(false); });
    }
  }, [user, profile, loading, router]);

  if (loading || fetching || !profile) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading…</div>
        </div>
      </>
    );
  }

  if (profile.role !== 'admin') return null;

  // Per-subject stats
  const subjectStats: Record<string, { total: number; count: number }> = {};
  attempts.forEach((a) => {
    if (!subjectStats[a.subject]) subjectStats[a.subject] = { total: 0, count: 0 };
    subjectStats[a.subject].total += a.score;
    subjectStats[a.subject].count += 1;
  });
  const subjectRows = Object.entries(subjectStats)
    .map(([subject, { total, count }]) => ({ subject, avg: Math.round(total / count), count }))
    .sort((a, b) => a.avg - b.avg);

  // Per-teacher stats
  const teacherStats: Record<string, { name: string; total: number; count: number }> = {};
  attempts.forEach((a) => {
    if (!teacherStats[a.teacherId]) teacherStats[a.teacherId] = { name: a.teacherName, total: 0, count: 0 };
    teacherStats[a.teacherId].total += a.score;
    teacherStats[a.teacherId].count += 1;
  });
  const teacherRows = Object.entries(teacherStats)
    .map(([id, { name, total, count }]) => ({ id, name, avg: Math.round(total / count), count }))
    .sort((a, b) => b.avg - a.avg);

  const overallAvg = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
    : 0;

  function ScoreBadge({ score }: { score: number }) {
    const colour = score >= 80 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colour}`}>{score}%</span>;
  }

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Aggregate results across all staff.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Total attempts</div>
            <div className="text-3xl font-bold text-gray-900">{attempts.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Overall average score</div>
            <div className="text-3xl font-bold text-gray-900">{overallAvg}%</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Staff who have attempted</div>
            <div className="text-3xl font-bold text-gray-900">{teacherRows.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Scores by subject (lowest first)</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {subjectRows.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">No data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Subject</th>
                      <th className="px-4 py-3 font-medium">Avg score</th>
                      <th className="px-4 py-3 font-medium">Attempts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subjectRows.map((row) => (
                      <tr key={row.subject} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{row.subject}</td>
                        <td className="px-4 py-3"><ScoreBadge score={row.avg} /></td>
                        <td className="px-4 py-3 text-gray-400">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Staff accuracy</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {teacherRows.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">No data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Avg score</th>
                      <th className="px-4 py-3 font-medium">Quizzes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {teacherRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{row.name}</td>
                        <td className="px-4 py-3"><ScoreBadge score={row.avg} /></td>
                        <td className="px-4 py-3 text-gray-400">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
