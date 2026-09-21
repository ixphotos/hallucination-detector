'use client';

import { useRef, useCallback } from 'react';
import { falsePositiveHighlightIndices, type Range as CharRange } from '@/lib/scoring';
import type { Highlight } from '@/types';

interface Props {
  passage: string;
  highlights: Highlight[];
  onChange: (highlights: Highlight[]) => void;
  readonly?: boolean;
  correctRanges?: CharRange[];
  missedRanges?: CharRange[];
}

type SpanType = 'normal' | 'highlight' | 'correct' | 'missed' | 'false-positive';

interface Span {
  start: number;
  end: number;
  type: SpanType;
}

interface TypedRange extends CharRange {
  type: Exclude<SpanType, 'normal'>;
}

// When ranges overlap, the highest-priority type wins the segment.
const TYPE_PRIORITY: Record<Exclude<SpanType, 'normal'>, number> = {
  missed: 4,
  'false-positive': 3,
  correct: 2,
  highlight: 1,
};

function buildSpans(passageLength: number, ranges: TypedRange[]): Span[] {
  const clamped = ranges
    .map((r) => ({
      ...r,
      start: Math.max(0, Math.min(r.start, passageLength)),
      end: Math.max(0, Math.min(r.end, passageLength)),
    }))
    .filter((r) => r.start < r.end);

  const boundaries = new Set<number>([0, passageLength]);
  for (const r of clamped) {
    boundaries.add(r.start);
    boundaries.add(r.end);
  }
  const points = [...boundaries].sort((a, b) => a - b);

  const spans: Span[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    let type: SpanType = 'normal';
    let priority = 0;
    for (const r of clamped) {
      if (r.start <= start && r.end >= end && TYPE_PRIORITY[r.type] > priority) {
        type = r.type;
        priority = TYPE_PRIORITY[r.type];
      }
    }
    spans.push({ start, end, type });
  }
  return spans;
}

const spanClass: Record<SpanType, string> = {
  normal: '',
  highlight: 'bg-yellow-200 rounded cursor-pointer hover:bg-yellow-300 transition-colors',
  correct: 'bg-green-200 rounded',
  missed: 'bg-red-200 rounded underline decoration-red-400',
  'false-positive': 'bg-orange-200 rounded',
};

const spanTitle: Record<SpanType, string | undefined> = {
  normal: undefined,
  highlight: 'Click to remove this highlight',
  correct: 'Correctly identified hallucination',
  missed: 'Missed hallucination',
  'false-positive': 'Not a hallucination (false positive)',
};

export default function PassageHighlighter({
  passage,
  highlights,
  onChange,
  readonly = false,
  correctRanges,
  missedRanges,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Character offset of a DOM boundary point, measured as the text between
  // the start of the container and that point. Works for element boundary
  // points too (e.g. triple-click selections), which are child indices
  // rather than character offsets.
  const getCharOffset = useCallback((node: Node, offset: number): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const range = document.createRange();
    range.selectNodeContents(container);
    try {
      range.setEnd(node, offset);
    } catch {
      return 0;
    }
    return range.toString().length;
  }, []);

  const handleMouseUp = useCallback(() => {
    if (readonly) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    const start = Math.min(getCharOffset(range.startContainer, range.startOffset), passage.length);
    const end = Math.min(getCharOffset(range.endContainer, range.endOffset), passage.length);

    if (start >= end) { sel.removeAllRanges(); return; }

    const newHighlight: Highlight = { start, end, text: passage.slice(start, end) };

    // Merge/deduplicate overlapping highlights
    const overlaps = highlights.filter(
      (h) => h.start < newHighlight.end && h.end > newHighlight.start
    );
    if (overlaps.length > 0) {
      const mergedStart = Math.min(...overlaps.map((h) => h.start), newHighlight.start);
      const mergedEnd = Math.max(...overlaps.map((h) => h.end), newHighlight.end);
      const filtered = highlights.filter((h) => !overlaps.includes(h));
      filtered.push({ start: mergedStart, end: mergedEnd, text: passage.slice(mergedStart, mergedEnd) });
      onChange(filtered.sort((a, b) => a.start - b.start));
    } else {
      onChange([...highlights, newHighlight].sort((a, b) => a.start - b.start));
    }

    sel.removeAllRanges();
  }, [readonly, highlights, onChange, passage, getCharOffset]);

  function removeHighlightAt(pos: number) {
    if (readonly) return;
    onChange(highlights.filter((h) => !(pos >= h.start && pos < h.end)));
  }

  let ranges: TypedRange[];
  if (readonly && correctRanges && missedRanges) {
    // Classify each highlight with the same rule the scorer uses, so the
    // review display always agrees with the score.
    const fpIndices = new Set(falsePositiveHighlightIndices(highlights, correctRanges));
    ranges = [
      ...highlights.map((h, i): TypedRange => ({
        start: h.start,
        end: h.end,
        type: fpIndices.has(i) ? 'false-positive' : 'correct',
      })),
      ...missedRanges.map((r): TypedRange => ({ ...r, type: 'missed' })),
    ];
  } else {
    ranges = highlights.map((h): TypedRange => ({ start: h.start, end: h.end, type: 'highlight' }));
  }

  const spans = buildSpans(passage.length, ranges);

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className={`text-gray-800 leading-8 text-base select-text ${readonly ? '' : 'cursor-text'}`}
    >
      {spans.map((span, i) => {
        const text = passage.slice(span.start, span.end);
        if (span.type === 'normal') {
          return <span key={i}>{text}</span>;
        }
        return (
          <span
            key={i}
            className={spanClass[span.type]}
            title={spanTitle[span.type]}
            onClick={() => { if (span.type === 'highlight') removeHighlightAt(span.start); }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}
