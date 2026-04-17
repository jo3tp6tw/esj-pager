import type { BaseContext } from './context';
import type { ImageCacheEntry } from './readerState';

/**
 * Ensure an image is loaded and cached
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
export function ensureImage(ctx: BaseContext, src: string): ImageCacheEntry {
  const { state: s, render } = ctx;
  const cached = s.imageCache.get(src);
  if (cached) return cached;
  
  const img = new Image();
  const entry: ImageCacheEntry = { img, status: 'loading', naturalWidth: 0, naturalHeight: 0 };
  
  img.onload = () => {
    entry.status = 'loaded';
    entry.naturalWidth = img.naturalWidth || 0;
    entry.naturalHeight = img.naturalHeight || 0;
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
    render();
  };
  
  img.onerror = () => {
    entry.status = 'error';
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
    render();
  };
  
  img.src = src;
  s.imageCache.set(src, entry);
  return entry;
}

/**
 * Get image render information including dimensions and ready state
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
export function getImageRenderInfo(
  ctx: BaseContext,
  src: string,
  maxWidth: number,
): { ready: boolean; drawWidth: number; drawHeight: number } {
  const entry = ensureImage(ctx, src);
  
  if (entry.status !== 'loaded' || entry.naturalWidth <= 0 || entry.naturalHeight <= 0) {
    return { ready: false, drawWidth: maxWidth, drawHeight: Math.max(80, Math.floor(maxWidth * 0.56)) };
  }
  
  const scale = maxWidth > 0 ? Math.min(1, maxWidth / entry.naturalWidth) : 1;
  return {
    ready: true,
    drawWidth: Math.max(1, Math.floor(entry.naturalWidth * scale)),
    drawHeight: Math.max(1, Math.floor(entry.naturalHeight * scale)),
  };
}