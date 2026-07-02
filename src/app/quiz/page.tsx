'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSubjectCounts, createSession } from '@/lib/api-client';
import NavBar from '@/components/NavBar';

const GCSE_SUBJECTS = [
  'English Language', 'English Literature', 'Mathematics', 'Biology', 'Chemistry',
  'Physics', 'Combined Science', 'History', 'Geography', 'French', 'Spanish',
  'German', 'Religious Studies', 'Computing', 'Design & Technology', 'Art & Design',
  'Music', 'Physical Education', 'Drama', 'Food Preparation & Nutrition', 'Business Studies',
];

const ALEVEL_SUBJECTS = [
  'Economics', 'Psychology', 'Sociology', 'Law', 'Media Studies', 'Health & Social Care',
  'Politics', 'Philosophy', 'Further Mathematics', 'Environmental Science', 'Film Studies',
];

const GK_SUBJECTS = ['General Knowledge'];

function SubjectCard({
  subject,
  questionCount,
  onClick,
  loading,
}: {
  subject: string;
  questionCount: number;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || questionCount === 0}
      className="flex flex-col items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-400 hover:shadow-sm transition-all text-left group disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="font-medium text-gray-900 group-hover:text-indigo-700 text-sm">{subject}</span>
      <span className="text-xs text-gray-400 mt-0.5">{questionCount} {questionCount === 1 ? 'passage' : 'passages'}</span>
    </button>
  );
}

export default function QuizSelectionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [filter, setFilter] = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getSubjectCounts()
      .then((subjectCounts) => {
        setCounts(new Map(subjectCounts.map((s) => [s.subject, s.count])));
      })
      .catch((err) => {
        console.error(err);
        const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
        setError(`Failed to load subjects${detail}. Please refresh the page to try again.`);
      })
      .finally(() => setLoadingSubjects(false));
  }, [user]);

  async function startSession(subject: string) {
    if (!user || starting) return;
    setStarting(subject);
    setError('');
    try {
      const session = await createSession(subject);
      // Cache session metadata so step pages skip a fetch
      sessionStorage.setItem(
        `qs:${session.id}`,
        JSON.stringify({ subject: session.subject, questionIds: session.questionIds })
      );
      router.push(`/quiz/session/${session.id}/1`);
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
      setError(`Failed to start the session${detail}. Please try again.`);
      setStarting(null);
    }
  }

  const countFor = (s: string) => counts.get(s) ?? 0;

  const gcse = GCSE_SUBJECTS.filter((s) => s.toLowerCase().includes(filter.toLowerCase()));
  const alevel = ALEVEL_SUBJECTS.filter((s) => s.toLowerCase().includes(filter.toLowerCase()));
  const gk = GK_SUBJECTS.filter((s) => s.toLowerCase().includes(filter.toLowerCase()));

  if (loading || loadingSubjects) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading subjects…</div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Choose a subject</h1>
          <p className="text-gray-500 mt-1">You will be given up to 3 passages in a row. Read carefully — some details are AI hallucinations.</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">
            {error}
          </p>
        )}

        <div className="mb-6">
          <input
            type="text"
            placeholder="Filter subjects…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {gk.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">General Knowledge</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gk.map((subject) => (
                <SubjectCard
                  key={subject}
                  subject={subject}
                  questionCount={countFor(subject)}
                  onClick={() => startSession(subject)}
                  loading={starting === subject}
                />
              ))}
            </div>
          </section>
        )}

        {gcse.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">GCSE / KS4</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gcse.map((subject) => (
                <SubjectCard
                  key={subject}
                  subject={subject}
                  questionCount={countFor(subject)}
                  onClick={() => startSession(subject)}
                  loading={starting === subject}
                />
              ))}
            </div>
          </section>
        )}

        {alevel.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">A-Level / Post-16</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {alevel.map((subject) => (
                <SubjectCard
                  key={subject}
                  subject={subject}
                  questionCount={countFor(subject)}
                  onClick={() => startSession(subject)}
                  loading={starting === subject}
                />
              ))}
            </div>
          </section>
        )}

        {starting && (
          <div className="fixed inset-0 bg-white/80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-indigo-600 font-medium mb-1">Starting session…</div>
              <div className="text-sm text-gray-400">Selecting passages for {starting}</div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
