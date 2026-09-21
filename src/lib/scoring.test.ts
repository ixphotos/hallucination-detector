import { describe, it, expect } from 'vitest';
import { scoreAttempt, mergeRanges } from './scoring';
import type { Hallucination, Highlight } from '@/types';

function h(start: number, end: number): Hallucination {
  return { start, end, text: 'x'.repeat(end - start), explanation: '' };
}

function hl(start: number, end: number): Highlight {
  return { start, end, text: 'x'.repeat(end - start) };
}

describe('mergeRanges', () => {
  it('merges overlapping and adjacent ranges', () => {
    expect(mergeRanges([hl(0, 5), hl(3, 8), hl(8, 10), hl(20, 25)])).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 25 },
    ]);
  });

  it('drops empty ranges', () => {
    expect(mergeRanges([hl(5, 5)])).toEqual([]);
  });
});

describe('scoreAttempt', () => {
  it('gives 100 for exact highlights', () => {
    const result = scoreAttempt([hl(10, 20), hl(40, 55)], [h(10, 20), h(40, 55)]);
    expect(result).toMatchObject({ score: 100, tp: 2, fp: 0, fn: 0 });
  });

  it('does NOT reward highlighting the entire passage', () => {
    // Passage of 1000 chars, two short hallucinations.
    const result = scoreAttempt([hl(0, 1000)], [h(100, 120), h(500, 530)]);
    // All hallucinations are technically covered…
    expect(result.tp).toBe(2);
    // …but the giant highlight is a false positive and the score collapses.
    expect(result.fp).toBe(1);
    expect(result.score).toBeLessThan(15);
  });

  it('counts a hallucination covered by several small highlights as caught', () => {
    // Two highlights that each cover <50% but together cover 100%.
    const result = scoreAttempt([hl(10, 14), hl(14, 20)], [h(10, 20)]);
    expect(result.tp).toBe(1);
    expect(result.fn).toBe(0);
    expect(result.score).toBe(100);
  });

  it('counts misses and false positives', () => {
    const result = scoreAttempt([hl(200, 210)], [h(10, 20)]);
    expect(result).toMatchObject({ score: 0, tp: 0, fp: 1, fn: 1 });
  });

  it('scores 0 when nothing is highlighted but hallucinations exist', () => {
    const result = scoreAttempt([], [h(10, 20)]);
    expect(result).toMatchObject({ score: 0, tp: 0, fp: 0, fn: 1 });
  });

  it('scores clean passages 100 only when nothing is highlighted', () => {
    expect(scoreAttempt([], []).score).toBe(100);
    expect(scoreAttempt([hl(0, 10)], []).score).toBe(0);
  });

  it('penalises over-wide highlights via precision', () => {
    // Hallucination is 20 chars; user highlights 200 chars around it.
    const result = scoreAttempt([hl(0, 200)], [h(90, 110)]);
    expect(result.tp).toBe(1);
    expect(result.fp).toBe(1);
    // recall 1, precision 0.1 → F1 ≈ 0.18
    expect(result.score).toBe(18);
  });

  it('slightly generous highlighting still scores well', () => {
    // 20-char hallucination highlighted with 4 extra chars around it.
    const result = scoreAttempt([hl(88, 112)], [h(90, 110)]);
    expect(result.tp).toBe(1);
    expect(result.fp).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});
