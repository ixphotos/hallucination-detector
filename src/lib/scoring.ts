import type { Highlight, Hallucination, ScoreResult } from '@/types';

const OVERLAP_THRESHOLD = 0.5;

function overlapRatio(a: { start: number; end: number }, b: { start: number; end: number }): number {
  const overlapStart = Math.max(a.start, b.start);
  const overlapEnd = Math.min(a.end, b.end);
  if (overlapEnd <= overlapStart) return 0;
  const overlapLen = overlapEnd - overlapStart;
  // Use the shorter span as denominator: a highlight counts as matching a hallucination
  // if it covers ≥50% of the hallucination OR is ≥50% contained within it.
  const minLen = Math.min(a.end - a.start, b.end - b.start);
  return overlapLen / minLen;
}

export function scoreAttempt(
  highlights: Highlight[],
  hallucinations: Hallucination[]
): ScoreResult {
  const matchedHallucinations: number[] = [];
  const falsePositiveHighlights: number[] = [];

  // For each hallucination, check if any highlight covers it sufficiently
  hallucinations.forEach((h, hi) => {
    const matched = highlights.some(
      (hl) => overlapRatio(hl, h) >= OVERLAP_THRESHOLD
    );
    if (matched) matchedHallucinations.push(hi);
  });

  // For each highlight, check if it overlaps with any hallucination sufficiently
  highlights.forEach((hl, hli) => {
    const overlapsAny = hallucinations.some(
      (h) => overlapRatio(hl, h) >= OVERLAP_THRESHOLD
    );
    if (!overlapsAny) falsePositiveHighlights.push(hli);
  });

  const tp = matchedHallucinations.length;
  const fp = falsePositiveHighlights.length;
  const fn = hallucinations.length - tp;
  const total = tp + fp + fn;
  const score = total === 0 ? 100 : Math.round((tp / total) * 100);

  return { score, tp, fp, fn, matchedHallucinations, falsePositiveHighlights };
}
