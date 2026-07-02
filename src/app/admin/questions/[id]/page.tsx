'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getQuestion, saveQuestion, createQuestion } from '@/lib/firestore';
import NavBar from '@/components/NavBar';
import type { Hallucination, Question } from '@/types';

const SUBJECTS = [
  'General Knowledge',
  'English Language', 'English Literature', 'Mathematics', 'Biology', 'Chemistry',
  'Physics', 'Combined Science', 'History', 'Geography', 'French', 'Spanish',
  'German', 'Religious Studies', 'Computing', 'Design & Technology', 'Art & Design',
  'Music', 'Physical Education', 'Drama', 'Food Preparation & Nutrition', 'Business Studies',
  'Economics', 'Psychology', 'Sociology', 'Law', 'Media Studies', 'Health & Social Care',
  'Politics', 'Philosophy', 'Further Mathematics', 'Environmental Science', 'Film Studies',
];

const LEVELS = ['GCSE', 'A-Level', 'Both', 'General Knowledge'] as const;

function HallucinationEditor({
  hallucination,
  index,
  onChange,
  onRemove,
}: {
  hallucination: Hallucination;
  index: number;
  onChange: (updated: Hallucination) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hallucination {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Hallucinated text (must appear verbatim in passage)</label>
        <input
          type="text"
          value={hallucination.text}
          onChange={(e) => onChange({ ...hallucination, text: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Exact text as it appears in the passage"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Explanation (shown to user after quiz)</label>
        <textarea
          value={hallucination.explanation}
          onChange={(e) => onChange({ ...hallucination, explanation: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Why is this wrong?"
        />
      </div>
    </div>
  );
}

export default function AdminQuestionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [subject, setSubject] = useState('History');
  const [level, setLevel] = useState<Question['level']>('GCSE');
  const [title, setTitle] = useState('');
  const [passage, setPassage] = useState('');
  const [hallucinations, setHallucinations] = useState<Hallucination[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fetching, setFetching] = useState(!isNew);

  useEffect(() => {
    if (!loading) {
      if (!user) { router.replace('/'); return; }
      if (profile && profile.role !== 'admin') { router.replace('/dashboard'); return; }
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (isNew || !user) return;
    getQuestion(id)
      .then((q) => {
        if (!q) { router.replace('/admin/questions'); return; }
        setSubject(q.subject);
        setLevel(q.level);
        setTitle(q.title);
        setPassage(q.passage);
        setHallucinations(q.hallucinations);
        setFetching(false);
      })
      .catch((err) => {
        console.error(err);
        setSaveError('Failed to load the question. Please refresh the page to try again.');
        setFetching(false);
      });
  }, [id, isNew, user, router]);

  function addHallucination() {
    setHallucinations((prev) => [...prev, { start: 0, end: 0, text: '', explanation: '' }]);
  }

  function updateHallucination(i: number, updated: Hallucination) {
    setHallucinations((prev) => prev.map((h, idx) => (idx === i ? updated : h)));
  }

  function removeHallucination(i: number) {
    setHallucinations((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!title.trim() || !passage.trim()) {
      setSaveError('Title and passage are required.');
      return;
    }
    for (const h of hallucinations) {
      if (!h.text.trim()) {
        setSaveError('All hallucinations must have text.');
        return;
      }
      const first = passage.indexOf(h.text);
      if (first === -1) {
        setSaveError(`Hallucination text not found in passage: "${h.text.slice(0, 60)}…"`);
        return;
      }
      // Offsets are derived from the first occurrence, so the text must be
      // unambiguous within the passage.
      if (passage.indexOf(h.text, first + 1) !== -1) {
        setSaveError(
          `Hallucination text appears more than once in the passage — extend it so it is unique: "${h.text.slice(0, 60)}…"`
        );
        return;
      }
    }
    setSaving(true);
    setSaveError('');
    try {
      if (isNew) {
        await createQuestion({ subject, level, title, passage, hallucinations });
      } else {
        await saveQuestion({ id, subject, level, title, passage, hallucinations });
      }
      router.push('/admin/questions');
    } catch (err) {
      console.error(err);
      setSaveError('Failed to save. Please try again.');
      setSaving(false);
    }
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

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        <Link href="/admin/questions" className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-block">
          ← Back to question bank
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isNew ? 'New question' : 'Edit question'}
        </h1>

        <div className="space-y-5">
          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Question['level'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. World War I Causes"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Passage</label>
            <textarea
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="The passage text that will be shown to teachers. Include hallucinations embedded in the text."
            />
            <p className="text-xs text-gray-400 mt-1">{passage.length} characters</p>
          </div>

          {/* Hallucinations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-gray-700">
                Hallucinations ({hallucinations.length})
              </label>
              <button
                type="button"
                onClick={addHallucination}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add hallucination
              </button>
            </div>
            {hallucinations.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                No hallucinations — this will be a false positive test (nothing to find).
              </div>
            )}
            <div className="space-y-3">
              {hallucinations.map((h, i) => (
                <HallucinationEditor
                  key={i}
                  index={i}
                  hallucination={h}
                  onChange={(updated) => updateHallucination(i, updated)}
                  onRemove={() => removeHallucination(i)}
                />
              ))}
            </div>
          </div>

          {saveError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {saveError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isNew ? 'Create question' : 'Save changes'}
            </button>
            <Link
              href="/admin/questions"
              className="px-4 py-2.5 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
