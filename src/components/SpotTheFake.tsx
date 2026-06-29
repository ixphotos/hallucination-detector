'use client';

import { useState } from 'react';

interface Props {
  realImageUrl: string;
  fakeImageUrl: string;
  readonly?: boolean;
  chosen?: 'real' | 'fake';
  onSubmit?: (chosen: 'real' | 'fake') => void;
}

export default function SpotTheFake({ realImageUrl, fakeImageUrl, readonly = false, chosen: chosenProp, onSubmit }: Props) {
  const [chosen, setChosen] = useState<'real' | 'fake' | null>(chosenProp ?? null);
  const [submitted, setSubmitted] = useState(readonly);

  // Randomise display order once on mount so the fake isn't always on the right
  const [fakeOnRight] = useState(() => Math.random() > 0.5);
  const leftIs = fakeOnRight ? 'real' : 'fake';
  const rightIs = fakeOnRight ? 'fake' : 'real';

  function handlePick(side: 'real' | 'fake') {
    if (submitted) return;
    setChosen(side);
  }

  function handleSubmit() {
    if (!chosen) return;
    setSubmitted(true);
    onSubmit?.(chosen);
  }

  function borderClass(side: 'real' | 'fake') {
    if (!submitted) {
      return chosen === side
        ? 'border-4 border-indigo-500 shadow-lg scale-[1.01]'
        : 'border-4 border-transparent hover:border-gray-300';
    }
    if (side === 'fake') return 'border-4 border-red-400';
    return 'border-4 border-green-400';
  }

  function label(side: 'real' | 'fake') {
    if (!submitted) return null;
    if (side === 'fake') {
      return (
        <div className="absolute bottom-0 inset-x-0 bg-red-500 text-white text-center text-sm font-semibold py-1.5 rounded-b-lg">
          {chosen === 'fake' ? '✓ AI-generated — correct' : '✗ AI-generated — you missed this'}
        </div>
      );
    }
    return (
      <div className="absolute bottom-0 inset-x-0 bg-green-500 text-white text-center text-sm font-semibold py-1.5 rounded-b-lg">
        {chosen === 'real' ? '✗ Real image — incorrect' : '✓ Real image'}
      </div>
    );
  }

  const images: { side: 'real' | 'fake'; url: string }[] = [
    { side: leftIs, url: leftIs === 'real' ? realImageUrl : fakeImageUrl },
    { side: rightIs, url: rightIs === 'real' ? realImageUrl : fakeImageUrl },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-600">
        One of these images is AI-generated. Click the one you think is fake, then submit.
      </p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
        {images.map(({ side, url }, i) => (
          <button
            key={i}
            onClick={() => handlePick(side)}
            disabled={submitted}
            className={`relative rounded-lg overflow-hidden transition-all duration-150 ${borderClass(side)} ${!submitted ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Image ${i + 1}`} className="w-full h-auto block pointer-events-none" draggable={false} />
            {!submitted && chosen === side && (
              <div className="absolute top-2 right-2 bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                Selected
              </div>
            )}
            {label(side)}
          </button>
        ))}
      </div>

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!chosen}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Submit
        </button>
      )}

      {submitted && (
        <div className={`text-sm font-medium px-4 py-2 rounded-lg ${chosen === 'fake' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {chosen === 'fake' ? 'Correct! You spotted the AI-generated image.' : 'Not quite — the other image was AI-generated.'}
        </div>
      )}
    </div>
  );
}
