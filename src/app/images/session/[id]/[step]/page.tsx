'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getImageSession,
  getImageQuestion,
  saveImageAttempt,
  updateImageSession,
  completeImageSession,
} from '@/lib/image-firestore';
import { storage } from '@/lib/firebase';
import { getDownloadURL, ref } from 'firebase/storage';
import NavBar from '@/components/NavBar';
import ImageFlawFinder from '@/components/ImageFlawFinder';
import SpotTheFake from '@/components/SpotTheFake';
import type { ImageQuestion, ClickMark } from '@/types';

const questionCache = new Map<string, ImageQuestion>();
const urlCache = new Map<string, string>();

function getCachedSession(id: string) {
  try { return JSON.parse(sessionStorage.getItem(`is:${id}`) || 'null'); }
  catch { return null; }
}

function getCachedScores(id: string): number[] {
  try { return JSON.parse(sessionStorage.getItem(`is-scores:${id}`) || '[]'); }
  catch { return []; }
}

function appendScore(id: string, score: number) {
  const prev = getCachedScores(id);
  sessionStorage.setItem(`is-scores:${id}`, JSON.stringify([...prev, score]));
}

async function resolveImageUrl(path: string): Promise<string> {
  // Local paths (start with /) served directly from public/
  if (path.startsWith('/')) return path;
  // Firebase Storage paths
  if (urlCache.has(path)) return urlCache.get(path)!;
  const url = await getDownloadURL(ref(storage(), path));
  urlCache.set(path, url);
  return url;
}

function scoreFlawFinder(clicks: ClickMark[], question: ImageQuestion): number {
  const flaws = question.flaws ?? [];
  if (flaws.length === 0) return 0;
  const hit = new Set(
    clicks
      .map((c) => flaws.find((f) => {
        const dx = c.x - f.x; const dy = c.y - f.y;
        return Math.sqrt(dx * dx + dy * dy) < f.radius;
      })?.id)
      .filter(Boolean)
  );
  return Math.round((hit.size / flaws.length) * 100);
}

export default function ImageSessionStepPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = use(params);
  const stepNum = parseInt(step, 10);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [totalSteps, setTotalSteps] = useState(3);
  const [question, setQuestion] = useState<ImageQuestion | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [realUrl, setRealUrl] = useState<string | null>(null);
  const [fakeUrl, setFakeUrl] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [pendingClicks, setPendingClicks] = useState<ClickMark[] | null>(null);
  const [pendingChoice, setPendingChoice] = useState<'real' | 'fake' | null>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const cached = getCachedSession(id);
      let ids: string[];

      if (cached?.questionIds) {
        ids = cached.questionIds;
      } else {
        const s = await getImageSession(id);
        if (!s) { router.replace('/images'); return; }
        ids = s.questionIds;
        sessionStorage.setItem(`is:${id}`, JSON.stringify({ questionIds: ids, mode: s.mode }));
      }

      setQuestionIds(ids);
      setTotalSteps(ids.length);

      const qId = ids[stepNum - 1];
      if (!qId) { router.replace('/images'); return; }

      let q = questionCache.get(qId) ?? null;
      if (!q) {
        q = await getImageQuestion(qId);
        if (q) questionCache.set(qId, q);
      }
      if (!q) { router.replace('/images'); return; }
      setQuestion(q);

      // Resolve image URLs
      if (q.mode === 'flaw-finder' && q.imagePath) {
        setImageUrl(await resolveImageUrl(q.imagePath));
      } else if (q.mode === 'spot-the-fake' && q.realImagePath && q.fakeImagePath) {
        const [r, f] = await Promise.all([
          resolveImageUrl(q.realImagePath),
          resolveImageUrl(q.fakeImagePath),
        ]);
        setRealUrl(r);
        setFakeUrl(f);
      }

      setFetching(false);
      startTime.current = Date.now();

      // Prefetch next question
      const nextId = ids[stepNum];
      if (nextId && !questionCache.has(nextId)) {
        getImageQuestion(nextId).then((nq) => { if (nq) questionCache.set(nextId, nq); });
      }
    }
    load();
  }, [user, id, stepNum, router]);

  async function handleFlawSubmit(clicks: ClickMark[]) {
    setPendingClicks(clicks);
    setShowExplanation(true);
  }

  async function handleSpotSubmit(chosen: 'real' | 'fake') {
    setPendingChoice(chosen);
    setShowExplanation(true);
  }

  async function handleNext() {
    if (!user || !question) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const timeSpentSeconds = Math.round((Date.now() - startTime.current) / 1000);
      let score = 0;
      let attemptData: Parameters<typeof saveImageAttempt>[0];

      if (question.mode === 'flaw-finder' && pendingClicks) {
        score = scoreFlawFinder(pendingClicks, question);
        const flaws = question.flaws ?? [];
        const flawsHit = pendingClicks
          .map((c) => flaws.find((f) => {
            const dx = c.x - f.x; const dy = c.y - f.y;
            return Math.sqrt(dx * dx + dy * dy) < f.radius;
          })?.id)
          .filter(Boolean) as string[];
        const flawsMissed = flaws.map((f) => f.id).filter((id) => !flawsHit.includes(id));
        attemptData = {
          sessionId: id, userId: user.uid, questionId: question.id,
          mode: 'flaw-finder', clicks: pendingClicks, flawsHit, flawsMissed,
          pointsEarned: flawsHit.length, timeSpentSeconds,
        };
      } else {
        score = pendingChoice === 'fake' ? 100 : 0;
        attemptData = {
          sessionId: id, userId: user.uid, questionId: question.id,
          mode: 'spot-the-fake', chosenImage: pendingChoice ?? undefined,
          correct: pendingChoice === 'fake', pointsEarned: score === 100 ? 1 : 0, timeSpentSeconds,
        };
      }

      const attemptId = await saveImageAttempt(attemptData);
      appendScore(id, score);

      const isLast = stepNum >= totalSteps;
      if (!isLast) {
        updateImageSession(id, attemptId); // fire-and-forget
        router.push(`/images/session/${id}/${stepNum + 1}`);
      } else {
        await updateImageSession(id, attemptId);
        const allScores = getCachedScores(id);
        const total = allScores.length > 0
          ? Math.round(allScores.reduce((s, n) => s + n, 0) / allScores.length)
          : score;
        completeImageSession(id, total); // fire-and-forget
        router.push(`/images/session/${id}/results`);
      }
    } catch (err) {
      console.error(err);
      setSubmitError('Failed to save your answer. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  if (loading || fetching) {
    return (
      <>
        <NavBar />
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading image…</div>
      </>
    );
  }

  if (!question) return null;

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className={`h-2 w-10 rounded-full transition-colors ${
                i + 1 < stepNum ? 'bg-indigo-600' :
                i + 1 === stepNum ? 'bg-indigo-400' : 'bg-gray-200'
              }`} />
            ))}
          </div>
          <span className="text-sm text-gray-500">Image {stepNum} of {totalSteps}</span>
          <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">
            {question.subject}
          </span>
        </div>

        <div className="mb-4">
          <h1 className="text-lg font-bold text-gray-900">{question.topic}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{question.level} · {question.difficulty}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          {question.mode === 'flaw-finder' && imageUrl && (
            <ImageFlawFinder
              imageUrl={imageUrl}
              flaws={question.flaws}
              readonly={showExplanation}
              onSubmit={handleFlawSubmit}
            />
          )}
          {question.mode === 'spot-the-fake' && realUrl && fakeUrl && (
            <SpotTheFake
              realImageUrl={realUrl}
              fakeImageUrl={fakeUrl}
              readonly={showExplanation}
              chosen={pendingChoice ?? undefined}
              onSubmit={handleSpotSubmit}
            />
          )}
        </div>

        {/* Explanation panel — shown after submit */}
        {showExplanation && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-1">Explanation</h3>
            <p className="text-sm text-amber-800 leading-relaxed">{question.explanation}</p>
          </div>
        )}

        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {submitError}
          </p>
        )}

        {showExplanation && (
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving…' : stepNum < totalSteps ? 'Next image →' : 'Finish & see results'}
            </button>
          </div>
        )}
      </main>
    </>
  );
}
