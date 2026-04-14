import type { Block } from './types';

/** 斷頁點：第幾個 block、在該段文字內第幾個字元開始（UTF-16）。 */
export type Cursor = { bi: number; off: number };

export type PageLayout = {
  padX: number;
  padY: number;
  textLeft: number;
  textWidth: number;
  maxWidth: number;
  /** 可繪製區域高度（已扣 padding） */
  maxHeight: number;
  linePx: number;
  paraSpacing: number;
};

export type ImageRenderInfo = {
  ready: boolean;
  drawWidth: number;
  drawHeight: number;
};

export type WalkPageOptions = {
  imagePlaceholderText?: string;
  getImageRenderInfo?: (src: string, maxWidth: number) => ImageRenderInfo | null;
  drawImage?: (src: string, x: number, y: number, width: number, height: number) => void;
};

type BlockTextStyle = {
  font: string;
  linePx: number;
  paraSpacing: number;
  fillStyle: string;
};

function getBlockTextStyle(ctx: CanvasRenderingContext2D, block: Block, layout: PageLayout): BlockTextStyle {
  const baseFont = ctx.font;
  const baseSizeRaw = Number.parseFloat(baseFont);
  const baseSize = Number.isFinite(baseSizeRaw) ? baseSizeRaw : 20;
  const family = baseFont.replace(/^[\d.]+px\s*/, '') || 'sans-serif';

  if (block.type === 'commentMain') {
    return {
      font: `${Math.max(18, Math.round(baseSize))}px ${family}`,
      linePx: 30,
      paraSpacing: 10,
      fillStyle: '#111',
    };
  }

  if (block.type === 'commentMeta') {
    const halfSize = Math.max(12, Math.round(baseSize * 0.7));
    return {
      font: `${halfSize}px ${family}`,
      linePx: 22,
      paraSpacing: 6,
      fillStyle: '#999',
    };
  }

  if (block.type === 'commentDivider') {
    return {
      font: `${Math.max(13, Math.round(baseSize - 4))}px ${family}`,
      linePx: 22,
      paraSpacing: 6,
      fillStyle: '#111',
    };
  }

  return {
    font: baseFont,
    linePx: layout.linePx,
    paraSpacing: layout.paraSpacing,
    fillStyle: '#111',
  };
}

function bottomY(layout: PageLayout): number {
  return layout.padY + layout.maxHeight;
}

function buildDividerLine(ctx: CanvasRenderingContext2D, maxWidth: number): string {
  if (maxWidth <= 0) return '─';
  const unit = '─';
  const unitWidth = ctx.measureText(unit).width;
  if (unitWidth <= 0) return unit;
  const count = Math.max(1, Math.floor(maxWidth / unitWidth));
  return unit.repeat(count);
}

/** 由游標起算畫滿一頁；`draw===true` 時實際繪製。回傳下一頁起始游標，若本章已結束則 `null`。 */
export function walkOnePage(
  ctx: CanvasRenderingContext2D,
  blocks: Block[],
  start: Cursor,
  layout: PageLayout,
  draw: boolean,
  options: WalkPageOptions = {},
): Cursor | null {
  let y = layout.padY;
  let bi = start.bi;
  let off = start.off;

  if (bi >= blocks.length) return null;

  while (bi < blocks.length) {
    const block = blocks[bi];
    const textStyle = getBlockTextStyle(ctx, block, layout);
    const prevFont = ctx.font;
    const prevFill = ctx.fillStyle;
    ctx.font = textStyle.font;
    ctx.fillStyle = textStyle.fillStyle;
    const linePx = textStyle.linePx;
    const paraSpacing = textStyle.paraSpacing;

    if (block.type === 'img') {
      const tag = options.imagePlaceholderText ?? '[圖片]';
      const bot = bottomY(layout);
      const imageInfo = options.getImageRenderInfo?.(block.src, layout.maxWidth) ?? null;
      if (imageInfo && imageInfo.ready) {
        const imageTooTallForPage = imageInfo.drawHeight > layout.maxHeight;
        const imageFitsCurrentPage = y + imageInfo.drawHeight <= bot;

        if (imageFitsCurrentPage || (y <= layout.padY && imageTooTallForPage)) {
          if (draw) {
            if (options.drawImage) {
              options.drawImage(block.src, layout.textLeft, y, imageInfo.drawWidth, imageInfo.drawHeight);
            } else {
              ctx.fillText(tag, layout.textLeft, y);
            }
          }
          y += imageInfo.drawHeight + layout.paraSpacing;
          bi += 1;
          off = 0;
          continue;
        }

        // Keep image for next page; use a placeholder in current page if space remains.
        if (y + linePx <= bot && draw) {
          ctx.fillText('【圖】', layout.textLeft, y);
        }
        ctx.font = prevFont;
        ctx.fillStyle = prevFill;
        return { bi, off: 0 };
      }

      if (y + linePx > bot && y > layout.padY) {
        ctx.font = prevFont;
        ctx.fillStyle = prevFill;
        return { bi, off: 0 };
      }
      if (draw) ctx.fillText(tag, layout.textLeft, y);
      y += linePx + paraSpacing;
      bi += 1;
      off = 0;
      ctx.font = prevFont;
      ctx.fillStyle = prevFill;
      continue;
    }

    const text = block.type === 'commentDivider' ? buildDividerLine(ctx, layout.maxWidth) : block.text;
    if (text.length === 0) {
      const bot = bottomY(layout);
      if (y + paraSpacing > bot) {
        ctx.font = prevFont;
        ctx.fillStyle = prevFill;
        return { bi: bi + 1, off: 0 };
      }
      y += paraSpacing;
      bi += 1;
      off = 0;
      ctx.font = prevFont;
      ctx.fillStyle = prevFill;
      continue;
    }

    const remainder = text.slice(off);
    const lines = wrapByChar(ctx, remainder, layout.maxWidth);
    for (let i = 0; i < lines.length; i++) {
      if (y + linePx > bottomY(layout)) {
        let newOff = off;
        for (let j = 0; j < i; j++) newOff += lines[j].length;
        ctx.font = prevFont;
        ctx.fillStyle = prevFill;
        return { bi, off: newOff };
      }
      if (draw) ctx.fillText(lines[i], layout.textLeft, y);
      y += linePx;
    }

    const bot = bottomY(layout);
    if (y + paraSpacing > bot) {
      ctx.font = prevFont;
      ctx.fillStyle = prevFill;
      return { bi: bi + 1, off: 0 };
    }
    y += paraSpacing;
    bi += 1;
    off = 0;
    ctx.font = prevFont;
    ctx.fillStyle = prevFill;
  }

  return null;
}

/** 只存每頁起始斷點（不重複存全文）。 */
export function buildPageStarts(
  ctx: CanvasRenderingContext2D,
  blocks: Block[],
  layout: PageLayout,
  options: WalkPageOptions = {},
): Cursor[] {
  if (blocks.length === 0) return [];

  const starts: Cursor[] = [];
  let cur: Cursor = { bi: 0, off: 0 };
  const maxPages = Math.max(100, blocks.length * 20);

  for (let n = 0; n < maxPages; n++) {
    starts.push({ ...cur });
    const next = walkOnePage(ctx, blocks, cur, layout, false, options);
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
