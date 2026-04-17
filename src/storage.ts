import type { LastPageEntry, ReaderProfile, WebFontConfig, ReaderState } from './readerState';
import type { Cursor } from './pagination';
import type { Block } from './types';
import { clampSetting, safeNum, applyEmptyParagraphFilter } from './utils';
import { READER_LIMITS } from './readerState';

const READER_PROFILE_STORAGE_KEY = 'esj-pager:reader-profile:v1';
const READER_LAST_PAGE_STORAGE_KEY = 'esj-pager:last-page:v3';
const READER_LAST_PAGE_MAX_NOVELS = 10;
const READER_WEB_FONT_STORAGE_KEY = 'esj-pager:web-font:v1';
const READER_FULLSCREEN_PROMPT_KEY = 'esj-pager:fullscreen-prompt:v1';

export function saveWebFontConfig(config: WebFontConfig): void {
  try {
    window.localStorage.setItem(READER_WEB_FONT_STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

export function loadWebFontConfig(): WebFontConfig | null {
  try {
    const raw = window.localStorage.getItem(READER_WEB_FONT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WebFontConfig>;
    if (!parsed || typeof parsed.cssUrl !== 'string' || typeof parsed.family !== 'string') return null;
    const cssUrl = parsed.cssUrl.trim();
    const family = parsed.family.trim();
    if (!cssUrl || !family) return null;
    return { cssUrl, family };
  } catch {
    return null;
  }
}

export function loadLastPageEntries(): LastPageEntry[] {
  try {
    const raw = window.localStorage.getItem(READER_LAST_PAGE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadSavedCursor(novelId: string, chapterKey: string): Cursor | null {
  if (!novelId) return null;
  const entries = loadLastPageEntries();
  const entry = entries.find((e) => e.novelId === novelId);
  if (!entry) return null;
  if (entry.chapter !== chapterKey) return null;
  if (!entry.cursor || typeof entry.cursor.bi !== 'number' || typeof entry.cursor.off !== 'number') return null;
  return { bi: Math.max(0, Math.floor(entry.cursor.bi)), off: Math.max(0, Math.floor(entry.cursor.off)) };
}

export function saveCurrentCursor(
  novelId: string,
  chapterKey: string,
  cursor: Cursor,
): void {
  if (!novelId) return;
  try {
    let entries = loadLastPageEntries();
    entries = entries.filter((e) => e.novelId !== novelId);
    entries.push({ novelId, chapter: chapterKey, cursor: { bi: cursor.bi, off: cursor.off }, ts: Date.now() });
    if (entries.length > READER_LAST_PAGE_MAX_NOVELS) {
      entries.sort((a, b) => a.ts - b.ts);
      entries = entries.slice(entries.length - READER_LAST_PAGE_MAX_NOVELS);
    }
    window.localStorage.setItem(READER_LAST_PAGE_STORAGE_KEY, JSON.stringify(entries));
  } catch { /* ignore */ }
}

export function saveReaderProfile(profile: ReaderProfile): void {
  window.localStorage.setItem(READER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function loadReaderProfileRaw(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(READER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function saveFullscreenPromptSetting(enabled: boolean): void {
  try {
    window.localStorage.setItem(READER_FULLSCREEN_PROMPT_KEY, enabled ? '1' : '0');
  } catch { /* ignore */ }
}

export function loadFullscreenPromptSetting(): boolean {
  try {
    const value = window.localStorage.getItem(READER_FULLSCREEN_PROMPT_KEY);
    if (value === null) return true; // 預設開啟
    return value === '1';
  } catch {
    return true;
  }
}

/**
 * Create a profile saver function that saves current reader settings to localStorage.
 * This is a bridge function that encapsulates the save logic with state and UI sync.
 * 
 * @param state - The reader state containing current settings
 * @param syncUi - Callback to sync UI after saving
 * @returns A function that saves the current profile
 */
export function createProfileSaver(
  state: ReaderState,
  syncUi: () => void,
): () => void {
  return () => {
    const payload: ReaderProfile = {
      fontFamily: state.currentReaderSettings.fontFamily,
      fontSize: state.currentReaderSettings.fontSize,
      lineHeight: state.currentReaderSettings.lineHeight,
      paragraphSpacing: state.currentReaderSettings.paragraphSpacing,
      pagePaddingX: state.currentReaderSettings.pagePaddingX,
      pagePaddingY: state.currentReaderSettings.pagePaddingY,
      pageMaxWidth: state.currentReaderSettings.pageMaxWidth,
      removeSingleEmptyParagraph: state.removeSingleEmptyParagraph,
    };
    
    try {
      saveReaderProfile(payload);
      state.savedProfile = { ...payload };
      state.hasSavedProfile = true;
      syncUi();
    } catch {
      window.alert('儲存設定檔失敗');
    }
  };
}

/**
 * Create a profile loader function that loads saved reader settings from localStorage.
 * This is a bridge function that encapsulates the load logic with state and UI sync.
 * 
 * @param state - The reader state to update with loaded settings
 * @param syncUi - Callback to sync UI after loading
 * @param blocks - The original blocks array for filtering
 * @param render - Callback to trigger re-render if needed
 * @returns A function that loads the saved profile and returns whether settings changed
 */
export function createProfileLoader(
  state: ReaderState,
  syncUi: () => void,
  blocks: Block[],
  render: () => void,
): () => boolean {
  return () => {
    const p = loadReaderProfileRaw();
    if (!p) {
      state.savedProfile = null;
      state.hasSavedProfile = false;
      syncUi();
      return false;
    }
    
    let changed = false;

    // Load font family
    const pFontFamily = typeof p.fontFamily === 'string' && p.fontFamily.trim() ? p.fontFamily : null;
    if (pFontFamily && state.currentReaderSettings.fontFamily !== pFontFamily) {
      state.currentReaderSettings.fontFamily = pFontFamily;
      changed = true;
    }

    // Load numeric settings with clamping
    for (const key of Object.keys(READER_LIMITS) as (keyof typeof READER_LIMITS)[]) {
      const next = clampSetting(key, safeNum(p[key]));
      if (next === null || state.currentReaderSettings[key] === next) continue;
      state.currentReaderSettings[key] = next;
      changed = true;
    }

    // Load removeSingleEmptyParagraph setting
    const pRemove = typeof p.removeSingleEmptyParagraph === 'boolean' ? p.removeSingleEmptyParagraph : null;
    if (pRemove !== null && state.removeSingleEmptyParagraph !== pRemove) {
      state.removeSingleEmptyParagraph = pRemove;
      syncUi();
      state.pagedBlocks = applyEmptyParagraphFilter(blocks, state.removeSingleEmptyParagraph);
      changed = true;
    }

    // Update saved profile snapshot
    state.savedProfile = {
      fontFamily: pFontFamily ?? state.currentReaderSettings.fontFamily,
      fontSize: clampSetting('fontSize', safeNum(p.fontSize)) ?? state.currentReaderSettings.fontSize,
      lineHeight: clampSetting('lineHeight', safeNum(p.lineHeight)) ?? state.currentReaderSettings.lineHeight,
      paragraphSpacing: clampSetting('paragraphSpacing', safeNum(p.paragraphSpacing)) ?? state.currentReaderSettings.paragraphSpacing,
      pagePaddingX: clampSetting('pagePaddingX', safeNum(p.pagePaddingX)) ?? state.currentReaderSettings.pagePaddingX,
      pagePaddingY: clampSetting('pagePaddingY', safeNum(p.pagePaddingY)) ?? state.currentReaderSettings.pagePaddingY,
      pageMaxWidth: clampSetting('pageMaxWidth', safeNum(p.pageMaxWidth)) ?? state.currentReaderSettings.pageMaxWidth,
      removeSingleEmptyParagraph: pRemove ?? state.removeSingleEmptyParagraph,
    };
    state.hasSavedProfile = true;
    syncUi();
    
    return changed;
  };
}

/**
 * Create a position saver function that saves the current reading position to localStorage.
 * This function handles deduplication to avoid unnecessary writes when the position hasn't changed.
 * 
 * @param state - The reader state containing current page position
 * @param novelId - The novel identifier
 * @param chapterKey - The chapter identifier (pathname + search)
 * @returns A function that saves the current cursor position
 */
export function createPositionSaver(
  state: ReaderState,
  novelId: string,
  chapterKey: string,
): () => void {
  return () => {
    if (state.pageStarts.length === 0) return;
    
    const currentCursor = state.pageStarts[state.pageIndex];
    if (!currentCursor) return;
    
    // Deduplicate: skip if position hasn't changed
    if (state.lastSavedCursor && 
        state.lastSavedCursor.bi === currentCursor.bi && 
        state.lastSavedCursor.off === currentCursor.off) {
      return;
    }
    
    saveCurrentCursor(novelId, chapterKey, currentCursor);
    state.lastSavedCursor = { ...currentCursor };
  };
}
