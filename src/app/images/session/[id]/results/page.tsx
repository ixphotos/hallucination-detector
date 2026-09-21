'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getImageSession, getImageAttemptsByIds, getImageQuestion } from '@/lib/image-firestore';
import { storage } from '@/lib/firebase';
import { getDownloadURL, ref } from 'firebase/storage';
import NavBar from '@/components/NavBar';
import ImageFlawFinder from '@/components/ImageFlawFinder';
import type { ImageSession, ImageAttempt, ImageQuestion } from '@/types';

async function resolveUrl(path: string): Promise<string> {
  if (path.startsWith('/')) return path;
  return getDownloadURL(ref(storage(), path));
}

function ScoreRing({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const colour = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const dim = size === 'lg' ? 140 : 72;
  const r = size === 'lg' ? 55 : 28;
  const sw = size === 'lg' ? 12 : 7;
  const fs = size === 'lg' ? 28 : 16;
  return (
    <svg viewBox={`0 0 ${dim} ${dim}`} width={dim} height={dim}>
      <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
      <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke={colour} strokeWidth={sw}
        strokeDasharray={`${(score/100)*(2*Math.PI*r)} ${2*Math.PI*r}`}
        strokeLinecap="round" transform={`rotate(-90 ${dim/2} ${dim/2})`} />
      <text x={dim/2} y={dim/2+fs*0.35} textAnchor="middle" fontSize={fs} fontWeight="700" fill={colour}>
        {score}%
      </text>
    </svg>
  );
}

export default function ImageResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<ImageSession | null>(null);
  const [attempts, setAttempts] = useState<ImageAttempt[]>([]);
  const [questions, setQuestions] = useState<ImageQuestion[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const s = await getImageSession(id);
      if (!s) { router.replace('/dashboard'); return; }
      setSession(s);
      const [attemptsData, questionsData] = await Promise.all([
        getImageAttemptsByIds(s.attemptIds),
        Promise.all(s.questionIds.map((qId) => getImageQuestion(qId))),
      ]);
      const qs = questionsData.filter(Boolean) as ImageQuestion[];
      setAttempts(attemptsData);
      setQuestions(qs);

      // Resolve all image URLs in parallel
      const urlEntries = await Promise.all(
        qs.flatMap((q) => {
          const pairs: Promise<[string, string]>[] = [];
          if (q.imagePath) pairs.push(resolveUrl(q.imagePath).then((u) => [q.imagePath!, u]));
          if (q.realImagePath) pairs.push(resolveUrl(q.realImagePath).then((u) => [q.realImagePath!, u]));
          if (q.fakeImagePath) pairs.push(resolveUrl(q.fakeImagePath).then((u) => [q.fakeImagePath!, u]));
          return pairs;
        })
      );
      setImageUrls(Object.fromEntries(urlEntries));
      setFetching(false);
    }
    load();
  }, [user, id, router]);

  if (loading || fetching) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading results…</div>
      </>
    );
  }

  if (!session) return null;

  const totalScore = session.totalScore ??
    Math.round(attempts.reduce((s, a) => s + a.pointsEarned, 0) / Math.max(attempts.length, 1) * 100);
  const flawFinderAttempts = attempts.filter((a) => a.mode === 'flaw-finder');
  const spotAttempts = attempts.filter((a) => a.mode === 'spot-the-fake');
  const spotCorrect = spotAttempts.filter((a) => a.correct).length;

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Session Complete</h1>

        {/* Summary card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={totalScore} />
          <div className="text-center sm:text-left">
            <div className="text-sm text-gray-500 mb-1">Overall session score</div>
            <div className="text-4xl font-bold text-gray-900 mb-3">{totalScore}%</div>
            <div className="flex gap-4 text-sm flex-wrap">
              {flawFinderAttempts.length > 0 && (
                <span className="text-indigo-600 font-medium">
                  {flawFinderAttempts.reduce((s, a) => s + (a.flawsHit?.length ?? 0), 0)} flaws found
                </span>
              )}
              {spotAttempts.length > 0 && (
                <span className="text-indigo-600 font-medium">
                  {spotCorrect}/{spotAttempts.length} fakes spotted
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <h2 className="text-base font-semibold text-gray-900 mb-3">Image breakdown</h2>
        <div className="space-y-3 mb-6">
          {questions.map((q, i) => {
            const attempt = attempts[i];
            if (!attempt) return null;
            const isExpanded = expanded === i;

            const questionScore = q.mode === 'flaw-finder'
              ? (q.flaws?.length ? Math.round(((attempt.flawsHit?.length ?? 0) / q.flaws.length) * 100) : 0)
              : (attempt.correct ? 100 : 0);

            return (
              <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <ScoreRing score={questionScore} size="sm" />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{q.topic}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {q.mode === 'flaw-finder'
                          ? `${attempt.flawsHit?.length ?? 0} of ${q.flaws?.length ?? 0} flaws found`
                          : attempt.correct ? '✓ Correctly identified the fake' : '✗ Picked the wrong image'}
                      </div>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    {q.mode === 'flaw-finder' && q.imagePath && imageUrls[q.imagePath] && (
                      <ImageFlawFinder
                        imageUrl={imageUrls[q.imagePath]}
                        flaws={q.flaws}
                        readonly
                      />
                    )}
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800">{q.explanation}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link href="/images"
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            Try another set
          </Link>
          <Link href="/dashboard"
            className="px-5 py-2.5 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Back to dashboard
          </Link>
        </div>
      </main>
    </>
  );
}
