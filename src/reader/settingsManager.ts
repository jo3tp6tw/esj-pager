import type { SyncContext } from '../context';
import type { ReaderSettings } from './settings';
import { READER_LIMITS } from '../readerState';
import { roundByStep, clamp, applyEmptyParagraphFilter } from '../utils';
import { clearCharWidthCache } from '../pagination';
import { ensureWebFontStylesheet, loadWebFont } from '../fonts';
import { saveWebFontConfig } from '../storage';

/**
 * Adjust a reader setting by delta value
 * @param ctx - Context with state, refs, render, blocks, and syncUi
 * @param key - Setting key to adjust
 * @param delta - Amount to change (positive or negative)
 */
export function adjustReaderSetting(
  ctx: SyncContext,
  key: keyof Pick<ReaderSettings, 'fontSize' | 'lineHeight' | 'paragraphSpacing' | 'pagePaddingX' | 'pagePaddingY' | 'pageMaxWidth'>,
  delta: number,
): void {
  const { state: s, render } = ctx;
  const limits = READER_LIMITS[key];
  const next = clamp(roundByStep((s.currentReaderSettings[key] as number) + delta, limits.step), limits.min, limits.max);
  
  if (next === s.currentReaderSettings[key]) return;
  
  s.currentReaderSettings[key] = next;
  ctx.syncUi();
  
  if (!s.previewFromAdjust) {
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
  }
  
  render();
}

/**
 * Toggle the remove single empty paragraph filter
 * @param ctx - Context with state, refs, render, blocks, and syncUi
 */
export function toggleRemoveSingleEmptyParagraph(ctx: SyncContext): void {
  const { state: s, blocks, render } = ctx;
  
  s.removeSingleEmptyParagraph = !s.removeSingleEmptyParagraph;
  ctx.syncUi();
  
  s.pagedBlocks = applyEmptyParagraphFilter(blocks, s.removeSingleEmptyParagraph);
  
  if (!s.previewFromAdjust) {
    s.pageIndex = 0;
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
  }
  
  render();
}

/**
 * Apply a web font by loading it and updating settings
 * @param ctx - Context with state, refs, render, and syncUi
 * @param cssUrl - CSS URL for the web font
 * @param family - Font family name
 */
export async function applyWebFont(ctx: SyncContext, cssUrl: string, family: string): Promise<void> {
  const { state: s, render } = ctx;
  
  // Ensure the web font stylesheet is loaded
  s.webFontLinkEl = ensureWebFontStylesheet(cssUrl, s.webFontLinkEl);
  
  // Load the web font
  await loadWebFont(cssUrl, family);
  
  // Update settings
  s.currentReaderSettings.fontFamily = family;
  s.fontSource = 'web';
  
  // Sync UI
  ctx.syncUi();
  
  // Clear cache and re-render
  clearCharWidthCache();
  s.lastCanvasW = -1;
  s.lastCanvasH = -1;
  render();
  
  // Save web font config
  saveWebFontConfig({ cssUrl, family });
}
