'use client';

import { useRef, useState } from 'react';
import type { ClickMark, ImageFlaw } from '@/types';

interface Props {
  imageUrl: string;
  flaws?: ImageFlaw[];
  readonly?: boolean;
  onSubmit?: (clicks: ClickMark[]) => void;
}

function scoreClicks(clicks: ClickMark[], flaws: ImageFlaw[]): ClickMark[] {
  return clicks.map((click) => {
    const hit = flaws.find((flaw) => {
      const dx = click.x - flaw.x;
      const dy = click.y - flaw.y;
      return Math.sqrt(dx * dx + dy * dy) < flaw.radius;
    });
    return { ...click, hitFlawId: hit?.id };
  });
}

export default function ImageFlawFinder({ imageUrl, flaws = [], readonly = false, onSubmit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [clicks, setClicks] = useState<ClickMark[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const scoredClicks = submitted ? scoreClicks(clicks, flaws) : clicks;
  const flawsHit = submitted ? new Set(scoredClicks.map((c) => c.hitFlawId).filter(Boolean)) : new Set();
  const flawsMissed = submitted ? flaws.filter((f) => !flawsHit.has(f.id)) : [];

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readonly || submitted) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setClicks((prev) => [...prev, { x, y }]);
  }

  function removeClick(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (submitted) return;
    setClicks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    const scored = scoreClicks(clicks, flaws);
    setSubmitted(true);
    onSubmit?.(scored);
  }

  function handleReset() {
    setClicks([]);
    setSubmitted(false);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        className={`relative w-full max-w-3xl select-none ${!submitted && !readonly ? 'cursor-crosshair' : 'cursor-default'}`}
        onClick={handleImageClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Find the AI hallucinations in this image"
          className="w-full h-auto rounded-lg shadow pointer-events-none"
          draggable={false}
        />

        {/* Teacher's click pins */}
        {scoredClicks.map((click, i) => (
          <button
            key={i}
            className={`absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-colors
              ${submitted
                ? click.hitFlawId
                  ? 'bg-green-500 cursor-default'
                  : 'bg-red-500 cursor-default'
                : 'bg-yellow-400 hover:bg-yellow-500'
              }`}
            style={{ left: `${click.x * 100}%`, top: `${click.y * 100}%` }}
            onClick={(e) => removeClick(i, e)}
            aria-label={submitted ? (click.hitFlawId ? 'Hit' : 'Missed') : 'Remove this mark'}
            title={submitted ? (click.hitFlawId ? '✓ Found a flaw' : '✗ Nothing here') : 'Click to remove'}
          />
        ))}

        {/* Ground-truth flaw rings — shown after submit */}
        {submitted && flaws.map((flaw) => {
          const hit = flawsHit.has(flaw.id);
          const containerEl = containerRef.current;
          const radiusPx = containerEl ? flaw.radius * containerEl.getBoundingClientRect().width : 0;
          return (
            <div
              key={flaw.id}
              className={`absolute rounded-full border-4 pointer-events-none
                ${hit ? 'border-green-400' : 'border-orange-400'}`}
              style={{
                left: `${flaw.x * 100}%`,
                top: `${flaw.y * 100}%`,
                width: `${flaw.radius * 2 * 100}%`,
                height: `${flaw.radius * 2 * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              title={flaw.label}
            />
          );
        })}

        {/* Flaw labels — shown after submit for missed flaws */}
        {submitted && flawsMissed.map((flaw) => (
          <div
            key={`label-${flaw.id}`}
            className="absolute bg-orange-500 text-white text-xs px-2 py-1 rounded shadow pointer-events-none whitespace-nowrap"
            style={{
              left: `${flaw.x * 100}%`,
              top: `calc(${flaw.y * 100}% + ${flaw.radius * 100}% + 4px)`,
              transform: 'translateX(-50%)',
            }}
          >
            {flaw.label}
          </div>
        ))}
      </div>

      {/* Instruction / score bar */}
      <div className="w-full max-w-3xl flex items-center justify-between gap-4">
        {!submitted && !readonly && (
          <>
            <p className="text-sm text-gray-500">
              Click on anything that looks wrong.{' '}
              {clicks.length > 0 && <span className="font-medium text-gray-700">{clicks.length} mark{clicks.length !== 1 ? 's' : ''} placed.</span>}
              {' '}Click a pin to remove it.
            </p>
            <div className="flex gap-2 shrink-0">
              {clicks.length > 0 && (
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={clicks.length === 0}
                className="px-4 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </>
        )}

        {submitted && (
          <div className="flex items-center gap-6 text-sm">
            <span className="text-green-700 font-medium">
              ✓ {flawsHit.size} / {flaws.length} flaw{flaws.length !== 1 ? 's' : ''} found
            </span>
            {flawsMissed.length > 0 && (
              <span className="text-orange-600">
                {flawsMissed.length} missed — shown in orange
              </span>
            )}
            {scoredClicks.filter((c) => !c.hitFlawId).length > 0 && (
              <span className="text-red-600">
                {scoredClicks.filter((c) => !c.hitFlawId).length} mark{scoredClicks.filter((c) => !c.hitFlawId).length !== 1 ? 's' : ''} didn&apos;t hit anything
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
