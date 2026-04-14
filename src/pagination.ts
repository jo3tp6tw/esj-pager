import type { Block } from './types';

/** 斷頁點：第幾個 block、在該段文字內第幾個字元開始（UTF-16）。 */
export type Cursor = { bi: number; off: number };

export type PageLayout = {
  pad: number;
  maxWidth: number;
  /** 可繪製區域高度（已扣 padding） */
  maxHeight: number;
  linePx: number;
  paraSpacing: number;
};

function bottomY(layout: PageLayout): number {
  return layout.pad + layout.maxHeight;
}

/** 由游標起算畫滿一頁；`draw===true` 時實際繪製。回傳下一頁起始游標，若本章已結束則 `null`。 */
export function walkOnePage(
  ctx: CanvasRenderingContext2D,
  blocks: Block[],
  start: Cursor,
  layout: PageLayout,
  draw: boolean,
): Cursor | null {
  let y = layout.pad;
  let bi = start.bi;
  let off = start.off;

  if (bi >= blocks.length) return null;

  while (bi < blocks.length) {
    const block = blocks[bi];

    if (block.type === 'img') {
      const tag = '[圖片]';
      const bot = bottomY(layout);
      if (y + layout.linePx > bot && y > layout.pad) {
        return { bi, off: 0 };
      }
      if (draw) ctx.fillText(tag, layout.pad, y);
      y += layout.linePx + layout.paraSpacing;
      bi += 1;
      off = 0;
      continue;
    }

    const text = block.text;
    if (text.length === 0) {
      const bot = bottomY(layout);
      if (y + layout.paraSpacing > bot) {
        return { bi: bi + 1, off: 0 };
      }
      y += layout.paraSpacing;
      bi += 1;
      off = 0;
      continue;
    }

    const remainder = text.slice(off);
    const lines = wrapByChar(ctx, remainder, layout.maxWidth);
    for (let i = 0; i < lines.length; i++) {
      if (y + layout.linePx > bottomY(layout)) {
        let newOff = off;
        for (let j = 0; j < i; j++) newOff += lines[j].length;
        return { bi, off: newOff };
      }
      if (draw) ctx.fillText(lines[i], layout.pad, y);
      y += layout.linePx;
    }

    const bot = bottomY(layout);
    if (y + layout.paraSpacing > bot) {
      return { bi: bi + 1, off: 0 };
    }
    y += layout.paraSpacing;
    bi += 1;
    off = 0;
  }

  return null;
}

/** 只存每頁起始斷點（不重複存全文）。 */
export function buildPageStarts(
  ctx: CanvasRenderingContext2D,
  blocks: Block[],
  layout: PageLayout,
): Cursor[] {
  if (blocks.length === 0) return [];

  const starts: Cursor[] = [];
  let cur: Cursor = { bi: 0, off: 0 };
  const maxPages = Math.max(100, blocks.length * 20);

  for (let n = 0; n < maxPages; n++) {
    starts.push({ ...cur });
    const next = walkOnePage(ctx, blocks, cur, layout, false);
    if (next === null) break;
    if (next.bi === cur.bi && next.off === cur.off) break;
    cur = next;
  }

  return starts;
}

export function wrapByChar(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  if (maxWidth <= 0) return [text];

  const lines: string[] = [];
  let line = '';
  let width = 0;

  for (const ch of text) {
    const chWidth = ctx.measureText(ch).width;
    if (line && width + chWidth > maxWidth) {
      lines.push(line);
      line = ch;
      width = chWidth;
    } else {
      line += ch;
      width += chWidth;
    }
  }

  if (line) lines.push(line);
  return lines;
}
