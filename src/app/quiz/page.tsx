'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import NavBar from '@/components/NavBar';
import questions from '@/data/questions.json';
import type { Question } from '@/types';

const allQuestions = questions as Question[];

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

function SubjectCard({
  subject,
  questionCount,
  onClick,
}: {
  subject: string;
  questionCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-400 hover:shadow-sm transition-all text-left group"
    >
      <span className="font-medium text-gray-900 group-hover:text-indigo-700 text-sm">{subject}</span>
      <span className="text-xs text-gray-400 mt-0.5">{questionCount} {questionCount === 1 ? 'passage' : 'passages'}</span>
    </button>
  );
}

export default function QuizSelectionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  function pickRandom(subject: string) {
    const pool = allQuestions.filter((q) => q.subject === subject);
    if (pool.length === 0) return;
    const q = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/quiz/${q.id}`);
  }

  const availableSubjects = Array.from(new Set(allQuestions.map((q) => q.subject)));

  const gcse = GCSE_SUBJECTS.filter((s) => availableSubjects.includes(s) && s.toLowerCase().includes(filter.toLowerCase()));
  const alevel = ALEVEL_SUBJECTS.filter((s) => availableSubjects.includes(s) && s.toLowerCase().includes(filter.toLowerCase()));

  if (loading) return null;

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Choose a subject</h1>
          <p className="text-gray-500 mt-1">A random passage will be selected for you. Read carefully — some details are AI hallucinations.</p>
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

        {gcse.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">GCSE / KS4</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gcse.map((subject) => (
                <SubjectCard
                  key={subject}
                  subject={subject}
                  questionCount={allQuestions.filter((q) => q.subject === subject).length}
                  onClick={() => pickRandom(subject)}
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
                  questionCount={allQuestions.filter((q) => q.subject === subject).length}
                  onClick={() => pickRandom(subject)}
                />
              ))}
            </div>
          </section>
        )}

        {gcse.length === 0 && alevel.length === 0 && (
          <p className="text-gray-400 text-sm">No subjects match your filter.</p>
        )}
      </main>
    </>
  );
}
