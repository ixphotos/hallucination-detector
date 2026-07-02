import type { Highlight, Hallucination, ScoreResult } from '@/types';

// A hallucination counts as caught when at least this fraction of its
// characters is covered by the user's highlights (combined).
export const COVERAGE_THRESHOLD = 0.5;

// A highlight counts as a false positive when less than this fraction of its
// characters falls inside hallucinated text.
export const PRECISION_THRESHOLD = 0.5;

export interface Range {
  start: number;
  end: number;
}

/** Merge overlapping/adjacent ranges into a sorted, disjoint union. */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges
    .filter((r) => r.end > r.start)
    .slice()
    .sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ start: r.start, end: r.end });
    }
  }
  return merged;
}

/** Number of characters of `range` covered by the disjoint union `union`. */
function coveredChars(range: Range, union: Range[]): number {
  let covered = 0;
  for (const u of union) {
    const start = Math.max(range.start, u.start);
    const end = Math.min(range.end, u.end);
    if (end > start) covered += end - start;
  }
  return covered;
}

function totalChars(union: Range[]): number {
  return union.reduce((sum, r) => sum + (r.end - r.start), 0);
}

/**
 * Indices of hallucinations whose characters are sufficiently covered by the
 * combined highlights. Uses the union so several small highlights that
 * together cover a hallucination still count.
 */
export function matchedHallucinationIndices(
  highlights: Range[],
  hallucinations: Range[]
): number[] {
  const union = mergeRanges(highlights);
  const matched: number[] = [];
  hallucinations.forEach((h, i) => {
    const len = h.end - h.start;
    if (len > 0 && coveredChars(h, union) / len >= COVERAGE_THRESHOLD) {
      matched.push(i);
    }
  });
  return matched;
}

/**
 * Indices of highlights that are mostly outside hallucinated text.
 * Measured against the highlight's own length, so highlighting the whole
 * passage is a false positive rather than a free match.
 */
export function falsePositiveHighlightIndices(
  highlights: Range[],
  hallucinations: Range[]
): number[] {
  const union = mergeRanges(hallucinations);
  const fps: number[] = [];
  highlights.forEach((hl, i) => {
    const len = hl.end - hl.start;
    if (len <= 0 || coveredChars(hl, union) / len < PRECISION_THRESHOLD) {
      fps.push(i);
    }
  });
  return fps;
}

/**
 * Score an attempt.
 *
 * - tp/fn: hallucinations caught/missed (≥50% of their characters covered).
 * - fp: highlights mostly outside hallucinated text.
 * - score: character-level F1 (harmonic mean of precision and recall) so both
 *   missing hallucinations and over-highlighting reduce the score.
 *   Highlighting the entire passage no longer yields 100%.
 */
export function scoreAttempt(
  highlights: Highlight[],
  hallucinations: Hallucination[]
): ScoreResult {
  const matchedHallucinations = matchedHallucinationIndices(highlights, hallucinations);
  const falsePositiveHighlights = falsePositiveHighlightIndices(highlights, hallucinations);

  const tp = matchedHallucinations.length;
  const fp = falsePositiveHighlights.length;
  const fn = hallucinations.length - tp;

  const highlightUnion = mergeRanges(highlights);
  const hallucinationUnion = mergeRanges(hallucinations);
  const highlightedChars = totalChars(highlightUnion);
  const hallucinatedChars = totalChars(hallucinationUnion);
  const overlapChars = hallucinationUnion.reduce(
    (sum, h) => sum + coveredChars(h, highlightUnion),
    0
  );

  let score: number;
  if (hallucinatedChars === 0) {
    // "Clean passage" questions: any highlight is a mistake.
    score = highlightedChars === 0 ? 100 : 0;
  } else if (overlapChars === 0) {
    score = 0;
  } else {
    const precision = overlapChars / highlightedChars;
    const recall = overlapChars / hallucinatedChars;
    score = Math.round(((2 * precision * recall) / (precision + recall)) * 100);
  }

  return { score, tp, fp, fn, matchedHallucinations, falsePositiveHighlights };
}
