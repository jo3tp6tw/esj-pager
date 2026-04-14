import type { Cursor } from './pagination';
import type { Block } from './types';
import { READER_LIMITS, type ReaderLimitKey } from './readerState';

export function roundByStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function compareCursor(a: Cursor, b: Cursor): number {
  if (a.bi !== b.bi) return a.bi - b.bi;
  return a.off - b.off;
}

export function findPageIndexByCursor(starts: Cursor[], target: Cursor): number {
  if (starts.length === 0) return 0;
  let idx = 0;
  for (let i = 0; i < starts.length; i += 1) {
    if (compareCursor(starts[i], target) <= 0) idx = i;
    else break;
  }
  return idx;
}

export function formatLineHeight(v: number): string {
  return Number(v.toFixed(2)).toString();
}

export function safeNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function clampSetting(key: ReaderLimitKey, raw: number | null): number | null {
  if (raw === null) return null;
  const lim = READER_LIMITS[key];
  return clamp(roundByStep(raw, lim.step), lim.min, lim.max);
}

export function applyEmptyParagraphFilter(source: Block[], removeSingleEmpty: boolean): Block[] {
  if (!removeSingleEmpty) return source;

  const out: Block[] = [];
  let i = 0;
  while (i < source.length) {
    const b = source[i];
    const isEmptyParagraph = b.type === 'paragraph' && b.text.trim().length === 0;
    if (!isEmptyParagraph) {
      out.push(b);
      i += 1;
      continue;
    }

    let j = i;
    while (j < source.length) {
      const bj = source[j];
      if (bj.type !== 'paragraph') break;
      if (bj.text.trim().length > 0) break;
      j += 1;
    }
    const runLen = j - i;
    if (runLen >= 2) {
      for (let k = i; k < j; k += 1) out.push(source[k]);
    }
    i = j;
  }
  return out;
}
