'use client';

import { useRef, useCallback } from 'react';
import type { Highlight } from '@/types';

interface Props {
  passage: string;
  highlights: Highlight[];
  onChange: (highlights: Highlight[]) => void;
  readonly?: boolean;
  correctRanges?: { start: number; end: number }[];
  missedRanges?: { start: number; end: number }[];
}

interface Span {
  start: number;
  end: number;
  type: 'normal' | 'highlight' | 'correct' | 'missed' | 'false-positive';
}

function buildSpans(
  passage: string,
  highlights: Highlight[],
  readonly: boolean,
  correctRanges?: { start: number; end: number }[],
  missedRanges?: { start: number; end: number }[]
): Span[] {
  const events: { pos: number; kind: 'start' | 'end'; type: Span['type'] }[] = [];

  if (readonly && correctRanges && missedRanges) {
    const OVERLAP = 0.5;
    highlights.forEach((h) => {
      const isTP = (correctRanges ?? []).some((r) => {
        const overlapStart = Math.max(h.start, r.start);
        const overlapEnd = Math.min(h.end, r.end);
        if (overlapEnd <= overlapStart) return false;
        return (overlapEnd - overlapStart) / (r.end - r.start) >= OVERLAP;
      });
      events.push({ pos: h.start, kind: 'start', type: isTP ? 'correct' : 'false-positive' });
      events.push({ pos: h.end, kind: 'end', type: isTP ? 'correct' : 'false-positive' });
    });
    missedRanges.forEach((r) => {
      events.push({ pos: r.start, kind: 'start', type: 'missed' });
      events.push({ pos: r.end, kind: 'end', type: 'missed' });
    });
  } else {
    highlights.forEach((h) => {
      events.push({ pos: h.start, kind: 'start', type: 'highlight' });
      events.push({ pos: h.end, kind: 'end', type: 'highlight' });
    });
  }

  events.sort((a, b) => a.pos - b.pos || (a.kind === 'end' ? -1 : 1));

  const spans: Span[] = [];
  let pos = 0;
  let activeType: Span['type'] | null = null;

  for (const ev of events) {
    if (ev.pos > pos) {
      spans.push({ start: pos, end: ev.pos, type: activeType ?? 'normal' });
    }
    pos = ev.pos;
    if (ev.kind === 'start') activeType = ev.type;
    else activeType = null;
  }

  if (pos < passage.length) {
    spans.push({ start: pos, end: passage.length, type: 'normal' });
  }

  return spans.filter((s) => s.start < s.end);
}

const spanClass: Record<Span['type'], string> = {
  normal: '',
  highlight: 'bg-yellow-200 rounded cursor-pointer hover:bg-yellow-300 transition-colors',
  correct: 'bg-green-200 rounded',
  missed: 'bg-red-200 rounded underline decoration-red-400',
  'false-positive': 'bg-orange-200 rounded',
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

  const getCharOffset = useCallback((node: Node, offset: number): number => {
    const container = containerRef.current;
    if (!container) return 0;
    let charCount = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      if (current === node) return charCount + offset;
      charCount += (current.textContent ?? '').length;
      current = walker.nextNode();
    }
    return charCount + offset;
  }, []);

  const handleMouseUp = useCallback(() => {
    if (readonly) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    const start = getCharOffset(range.startContainer, range.startOffset);
    const end = getCharOffset(range.endContainer, range.endOffset);

    if (start >= end) { sel.removeAllRanges(); return; }

    const text = passage.slice(start, end);
    const newHighlight: Highlight = { start, end, text };

    // Merge/deduplicate overlapping highlights
    const merged = [...highlights];
    const overlaps = merged.filter(
      (h) => h.start < newHighlight.end && h.end > newHighlight.start
    );
    if (overlaps.length > 0) {
      const mergedStart = Math.min(...overlaps.map((h) => h.start), newHighlight.start);
      const mergedEnd = Math.max(...overlaps.map((h) => h.end), newHighlight.end);
      const filtered = merged.filter((h) => !overlaps.includes(h));
      filtered.push({ start: mergedStart, end: mergedEnd, text: passage.slice(mergedStart, mergedEnd) });
      onChange(filtered.sort((a, b) => a.start - b.start));
    } else {
      merged.push(newHighlight);
      onChange(merged.sort((a, b) => a.start - b.start));
    }

    sel.removeAllRanges();
  }, [readonly, highlights, onChange, passage, getCharOffset]);

  function removeHighlight(index: number) {
    if (readonly) return;
    onChange(highlights.filter((_, i) => i !== index));
  }

  const spans = buildSpans(passage, highlights, readonly, correctRanges, missedRanges);

  let highlightIdx = 0;

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
        const hi = span.type === 'highlight' ? highlightIdx++ : -1;
        return (
          <span
            key={i}
            className={spanClass[span.type]}
            title={
              span.type === 'highlight'
                ? 'Click to remove this highlight'
                : span.type === 'correct'
                ? 'Correctly identified hallucination'
                : span.type === 'missed'
                ? 'Missed hallucination'
                : 'Not a hallucination (false positive)'
            }
            onClick={() => { if (span.type === 'highlight') removeHighlight(hi); }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}
