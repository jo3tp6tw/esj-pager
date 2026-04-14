import type { ReaderSettings } from './settings';

function ellipsizeToWidth(ctx: CanvasRenderingContext2D, raw: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (ctx.measureText(raw).width <= maxWidth) return raw;

  const ellipsis = '...';
  const ellipsisW = ctx.measureText(ellipsis).width;
  if (ellipsisW >= maxWidth) return ellipsis;

  let lo = 0;
  let hi = raw.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = raw.slice(0, mid) + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return raw.slice(0, lo) + ellipsis;
}

export function drawBottomMetadata(
  ctx: CanvasRenderingContext2D,
  height: number,
  title: string,
  pageLabel: string,
  settings: ReaderSettings,
  textLeft: number,
  textWidth: number,
): void {
  const metaFontSize = 13;
  const metaY = Math.max(metaFontSize, height - Math.max(settings.pagePaddingY / 2, metaFontSize));
  const metaGap = 12;

  ctx.textBaseline = 'middle';
  ctx.font = `${metaFontSize}px ${settings.fontFamily}`;
  ctx.fillStyle = '#666';

  const rightW = ctx.measureText(pageLabel).width;
  const rightX = textLeft + textWidth;
  ctx.textAlign = 'right';
  ctx.fillText(pageLabel, rightX, metaY);

  const titleMaxW = Math.max(0, textWidth - rightW - metaGap);
  const metaTitle = ellipsizeToWidth(ctx, title, titleMaxW);
  ctx.textAlign = 'left';
  ctx.fillText(metaTitle, textLeft, metaY);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#111';
  ctx.font = `${settings.fontSize}px ${settings.fontFamily}`;
}
