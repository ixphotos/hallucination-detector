'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getActiveImageQuestions, createImageSession } from '@/lib/image-firestore';
import NavBar from '@/components/NavBar';
import type { ImageQuestion } from '@/types';

type Mode = 'flaw-finder' | 'spot-the-fake' | 'mixed';

const SUBJECTS = [
  'Biology', 'Chemistry', 'Physics', 'History', 'Geography',
  'Mathematics', 'English Literature', 'Computer Science', 'Art & Design', 'Modern Languages',
];

const SESSION_LENGTH = 3;

export default function ImagesLandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<ImageQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [mode, setMode] = useState<Mode>('flaw-finder');
  const [subject, setSubject] = useState<string>('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getActiveImageQuestions().then((qs) => {
      setQuestions(qs);
      setLoadingQuestions(false);
    });
  }, [user]);

  const filtered = questions.filter((q) => {
    const modeMatch = mode === 'mixed' || q.mode === mode;
    const subjectMatch = !subject || q.subject === subject;
    return modeMatch && subjectMatch;
  });

  async function startSession() {
    if (!user || starting || filtered.length === 0) return;
    setStarting(true);
    try {
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, SESSION_LENGTH);
      const sessionId = await createImageSession(user.uid, mode, picked.map((q) => q.id), subject || undefined);
      sessionStorage.setItem(`is:${sessionId}`, JSON.stringify({ questionIds: picked.map((q) => q.id), mode }));
      router.push(`/images/session/${sessionId}/1`);
    } catch (err) {
      console.error(err);
      setStarting(false);
    }
  }

  if (loading || loadingQuestions) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Image Hallucination Quiz</h1>
          <p className="text-gray-500 mt-1">
            Can you spot what AI got wrong? Choose a mode and start a {SESSION_LENGTH}-image session.
          </p>
        </div>

        {/* Mode picker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { value: 'flaw-finder', label: 'Flaw Finder', desc: 'Click on the AI mistakes in a single image' },
              { value: 'spot-the-fake', label: 'Spot the Fake', desc: 'Pick which of two images is AI-generated' },
              { value: 'mixed', label: 'Mixed', desc: 'A blend of both modes' },
            ] as { value: Mode; label: string; desc: string }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  mode === opt.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`font-semibold text-sm ${mode === opt.value ? 'text-indigo-700' : 'text-gray-900'}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Subject filter */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">All subjects</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Availability */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600">
          {filtered.length === 0 ? (
            <span className="text-amber-700">
              No questions available for this combination yet.{' '}
              {questions.length === 0 && 'Add image questions via the admin panel to get started.'}
            </span>
          ) : (
            <span>
              <span className="font-medium text-gray-900">{filtered.length}</span> question{filtered.length !== 1 ? 's' : ''} available
              {filtered.length < SESSION_LENGTH && ` — session will use all ${filtered.length}`}
            </span>
          )}
        </div>

        <button
          onClick={startSession}
          disabled={starting || filtered.length === 0}
          className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {starting ? 'Starting…' : `Start ${Math.min(filtered.length, SESSION_LENGTH)}-image session`}
        </button>
      </main>
    </>
  );
}
