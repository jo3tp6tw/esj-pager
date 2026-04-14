import type { Cursor } from './pagination';
import type { Block } from './types';
import {
  chromeSettingsTablet,
  readerSettings,
  type ReaderSettings,
  type ChromePreset,
  type ChromeSettings,
} from './reader/settings';

export type ChapterNav = { prev: string; next: string };

export type ImageCacheEntry = {
  img: HTMLImageElement;
  status: 'loading' | 'loaded' | 'error';
  naturalWidth: number;
  naturalHeight: number;
};

export type ReaderProfile = Pick<
  ReaderSettings,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'paragraphSpacing' | 'pagePaddingX' | 'pagePaddingY' | 'pageMaxWidth'
> & {
  removeSingleEmptyParagraph: boolean;
};

export type WebFontConfig = {
  cssUrl: string;
  family: string;
};

export type LastPageEntry = {
  novelId: string;
  chapter: string;
  page: number;
  ts: number;
};

export type SettingLimit = { min: number; max: number; step: number };

export const READER_LIMITS = {
  fontSize: { min: 14, max: 56, step: 1 },
  lineHeight: { min: 1, max: 3.2, step: 0.05 },
  paragraphSpacing: { min: 0, max: 72, step: 2 },
  pagePaddingX: { min: 0, max: 180, step: 2 },
  pagePaddingY: { min: 0, max: 180, step: 2 },
  pageMaxWidth: { min: 320, max: 2400, step: 20 },
} as const;

export type ReaderLimitKey = keyof typeof READER_LIMITS;

export type ReaderState = {
  pageStarts: Cursor[];
  pageIndex: number;
  lastCanvasW: number;
  lastCanvasH: number;
  chromeVisible: boolean;
  activeChromePreset: ChromePreset | null;
  activeChromeSettings: ChromeSettings;
  swipeStartX: number | null;
  swipeStartY: number | null;
  suppressNextSideTap: boolean;
  removeSingleEmptyParagraph: boolean;
  pagedBlocks: Block[];
  currentReaderSettings: ReaderSettings;
  pendingRestorePageIndex: number | null;
  lastSavedPageIndex: number;
  hasSavedProfile: boolean;
  readerSettingsExpanded: boolean;
  profileExpanded: boolean;
  savedProfile: ReaderProfile | null;
  imageCache: Map<string, ImageCacheEntry>;
  lastRenderedPageIndex: number;
  shouldRestoreFullscreenOnNextTap: boolean;
  adjustAnchorCursor: Cursor | null;
  previewFromAdjust: boolean;
  fontSource: 'local' | 'web';
  webFontLinkEl: HTMLLinkElement | null;
};

export function createReaderState(blocks: Block[]): ReaderState {
  return {
    pageStarts: [],
    pageIndex: 0,
    lastCanvasW: -1,
    lastCanvasH: -1,
    chromeVisible: true,
    activeChromePreset: null,
    activeChromeSettings: chromeSettingsTablet,
    swipeStartX: null,
    swipeStartY: null,
    suppressNextSideTap: false,
    removeSingleEmptyParagraph: false,
    pagedBlocks: blocks,
    currentReaderSettings: { ...readerSettings },
    pendingRestorePageIndex: null,
    lastSavedPageIndex: -1,
    hasSavedProfile: false,
    readerSettingsExpanded: false,
    profileExpanded: false,
    savedProfile: null,
    imageCache: new Map(),
    lastRenderedPageIndex: -1,
    shouldRestoreFullscreenOnNextTap: false,
    adjustAnchorCursor: null,
    previewFromAdjust: false,
    fontSource: 'local',
    webFontLinkEl: null,
  };
}
