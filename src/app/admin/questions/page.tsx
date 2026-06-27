'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getAllQuestions, deleteQuestion } from '@/lib/firestore';
import NavBar from '@/components/NavBar';
import type { Question } from '@/types';

export default function AdminQuestionsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) { router.replace('/'); return; }
      if (profile && profile.role !== 'admin') { router.replace('/dashboard'); return; }
    }
    if (user && profile?.role === 'admin') {
      getAllQuestions()
        .then((qs) => setQuestions(qs.sort((a, b) => a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title))))
        .finally(() => setFetching(false));
    }
  }, [user, profile, loading, router]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    await deleteQuestion(id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setDeleting(null);
  }

  if (loading || fetching || !profile) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      </>
    );
  }

  if (profile.role !== 'admin') return null;

  const filtered = filter
    ? questions.filter(
        (q) =>
          q.subject.toLowerCase().includes(filter.toLowerCase()) ||
          q.title.toLowerCase().includes(filter.toLowerCase())
      )
    : questions;

  // Group by subject
  const grouped: Record<string, Question[]> = {};
  filtered.forEach((q) => {
    if (!grouped[q.subject]) grouped[q.subject] = [];
    grouped[q.subject].push(q);
  });

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">← Admin dashboard</Link>
            <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
            <p className="text-gray-500 mt-1 text-sm">{questions.length} questions across {Object.keys(grouped).length || '…'} subjects</p>
          </div>
          <Link
            href="/admin/questions/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add question
          </Link>
        </div>

        <div className="mb-5">
          <input
            type="text"
            placeholder="Filter by subject or title…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-6">
          {Object.entries(grouped).map(([subject, qs]) => (
            <div key={subject}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{subject}</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Level</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Hallucinations</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {qs.map((q) => (
                      <tr key={q.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{q.title}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{q.level}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-500">
                          {q.hallucinations.length === 0 ? (
                            <span className="text-amber-500">None (false positive test)</span>
                          ) : (
                            q.hallucinations.length
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/admin/questions/${q.id}`}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(q.id, q.title)}
                              disabled={deleting === q.id}
                              className="text-xs text-red-500 hover:underline disabled:opacity-50"
                            >
                              {deleting === q.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No questions match your filter.</div>
          )}
        </div>
      </main>
    </>
  );
}
