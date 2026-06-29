'use client';

import { useState } from 'react';
import ImageFlawFinder from '@/components/ImageFlawFinder';
import type { ClickMark, ImageFlaw } from '@/types';

// Hardcoded test question — replace with a real AI-generated image later
const TEST_QUESTION = {
  imageUrl: '/white-water-raft.png',
  flaws: [
  {
    "id": "flaw-1",
    "label": "Strange Arm",
    "x": 0.2121,
    "y": 0.3601,
    "radius": 0.06
  },
  {
    "id": "flaw-2",
    "label": "Long Hand",
    "x": 0.3158,
    "y": 0.7097,
    "radius": 0.06
  },
  {
    "id": "flaw-3",
    "label": "extra hand",
    "x": 0.4595,
    "y": 0.439,
    "radius": 0.035
  },
  {
    "id": "flaw-4",
    "label": "Melted face",
    "x": 0.7834,
    "y": 0.2097,
    "radius": 0.035
  },
  {
    "id": "flaw-5",
    "label": "weird mouth",
    "x": 0.366,
    "y": 0.2548,
    "radius": 0.035
  }
] satisfies ImageFlaw[],
  explanation:
    'There are a number of strange artifacts and faces in this image, the obvious ones have been identified.',
};

export default function ImageTestPage() {
  const [result, setResult] = useState<ClickMark[] | null>(null);

  function handleSubmit(clicks: ClickMark[]) {
    setResult(clicks);
  }

  const flawsHit = result ? new Set(result.map((c) => c.hitFlawId).filter(Boolean)) : new Set();

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">
            Test page — Flaw Finder component
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Can you spot the AI hallucinations?
          </h1>
          <p className="mt-1 text-gray-600">
            Click on anything in the image that looks wrong. Submit when you&apos;re done.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <ImageFlawFinder
            imageUrl={TEST_QUESTION.imageUrl}
            flaws={TEST_QUESTION.flaws}
            onSubmit={handleSubmit}
          />
        </div>

        {result && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Explanation</h2>
            <p className="text-gray-700 text-sm leading-relaxed">{TEST_QUESTION.explanation}</p>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Score breakdown
              </h3>
              <ul className="space-y-1 text-sm">
                {TEST_QUESTION.flaws.map((flaw) => (
                  <li key={flaw.id} className="flex items-center gap-2">
                    <span>{flawsHit.has(flaw.id) ? '✅' : '❌'}</span>
                    <span className={flawsHit.has(flaw.id) ? 'text-green-700' : 'text-red-600'}>
                      {flaw.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
              Raw click data (for debugging): {JSON.stringify(result, null, 2).slice(0, 300)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
