'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAllQuestions, createQuizSession } from '@/lib/firestore';
import NavBar from '@/components/NavBar';
import type { Question } from '@/types';

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
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getAllQuestions().then((qs) => { setQuestions(qs); setLoadingQuestions(false); });
  }, [user]);

  async function startSession(subject: string) {
    if (!user || !profile || starting) return;
    setStarting(subject);
    try {
      const pool = questions.filter((q) => q.subject === subject);
      // Shuffle and pick up to 3
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      let picked = shuffled.slice(0, 3);
      // Pad with other subjects if fewer than 3
      if (picked.length < 3) {
        const others = questions.filter((q) => q.subject !== subject).sort(() => Math.random() - 0.5);
        picked = [...picked, ...others].slice(0, 3);
      }
      const questionIds = picked.map((q) => q.id);
      const sessionId = await createQuizSession(user.uid, profile.name, subject, questionIds);
      // Cache session metadata so step pages skip a Firestore read
      sessionStorage.setItem(`qs:${sessionId}`, JSON.stringify({ subject, questionIds }));
      router.push(`/quiz/session/${sessionId}/1`);
    } catch (err) {
      console.error(err);
      setStarting(null);
    }
  }

  const available = new Set(questions.map((q) => q.subject));
  const countFor = (s: string) => questions.filter((q) => q.subject === s).length;

  const gcse = GCSE_SUBJECTS.filter((s) => s.toLowerCase().includes(filter.toLowerCase()));
  const alevel = ALEVEL_SUBJECTS.filter((s) => s.toLowerCase().includes(filter.toLowerCase()));
  const gk = GK_SUBJECTS.filter((s) => s.toLowerCase().includes(filter.toLowerCase()));

  if (loading || loadingQuestions) {
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
          <p className="text-gray-500 mt-1">You will be given 3 passages in a row. Read carefully — some details are AI hallucinations.</p>
        </div>

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
              <div className="text-sm text-gray-400">Selecting 3 passages for {starting}</div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
