import type { LastPageEntry, ReaderProfile, WebFontConfig } from './readerState';

const READER_PROFILE_STORAGE_KEY = 'esj-pager:reader-profile:v1';
const READER_LAST_PAGE_STORAGE_KEY = 'esj-pager:last-page:v2';
const READER_LAST_PAGE_MAX_NOVELS = 10;
const READER_FULLSCREEN_RESTORE_KEY = 'esj-pager:restore-fullscreen-once:v1';
const READER_WEB_FONT_STORAGE_KEY = 'esj-pager:web-font:v1';

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

export function loadSavedPageIndex(novelId: string, chapterKey: string): number | null {
  if (!novelId) return null;
  const entries = loadLastPageEntries();
  const entry = entries.find((e) => e.novelId === novelId);
  if (!entry) return null;
  if (entry.chapter !== chapterKey) return null;
  if (!Number.isFinite(entry.page)) return null;
  return Math.max(0, Math.floor(entry.page) - 1);
}

export function saveCurrentPageIndex(
  novelId: string,
  chapterKey: string,
  pageIndex: number,
): void {
  if (!novelId) return;
  try {
    let entries = loadLastPageEntries();
    entries = entries.filter((e) => e.novelId !== novelId);
    entries.push({ novelId, chapter: chapterKey, page: pageIndex + 1, ts: Date.now() });
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

export function markFullscreenRestore(): void {
  try {
    if (document.fullscreenElement) {
      window.sessionStorage.setItem(READER_FULLSCREEN_RESTORE_KEY, '1');
    } else {
      window.sessionStorage.removeItem(READER_FULLSCREEN_RESTORE_KEY);
    }
  } catch { /* ignore */ }
}

export function loadFullscreenRestoreFlag(): boolean {
  try {
    return window.sessionStorage.getItem(READER_FULLSCREEN_RESTORE_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearFullscreenRestoreFlag(): void {
  try {
    window.sessionStorage.removeItem(READER_FULLSCREEN_RESTORE_KEY);
  } catch { /* ignore */ }
}
