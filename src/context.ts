import type { ReaderState, ChapterNav } from './readerState';
import type { ReaderDomRefs } from './reader/dom';
import type { Block } from './types';

/** Base context shared by all modules */
export type BaseContext = {
  state: ReaderState;
  refs: ReaderDomRefs;
  render: () => void;
};

/** Full reader context with all common dependencies */
export type ReaderContext = BaseContext & {
  blocks: Block[];
  chapterNav: ChapterNav;
  novelId: string;
  chapterKey: string;
};

/** Context for modules that need UI sync callback */
export type SyncContext = ReaderContext & {
  syncUi: () => void;
};

/** Context for modules that need chrome functions */
export type ChromeDependentContext = ReaderContext & {
  applyChromeVisibility: () => void;
  syncCanvasTapLayerLayout: () => void;
};

/** Context for panel manager */
export type PanelContext = ChromeDependentContext & {
  syncUi: () => void;
};

/** Context for event handlers */
export type EventHandlerContext = ReaderContext & {
  goPrevPage: () => void;
  goNextPage: () => void;
  confirmGoPrevChapter: () => void;
  confirmGoNextChapter: () => void;
  toggleChrome: () => void;
  closeDrawer: () => void;
  openDrawer: () => void;
  closePageJump: () => void;
  closeReaderAdjust: (apply: boolean, hideDrawerAndChrome: boolean) => void;
};

/** Context for render module */
export type RenderContext = ReaderContext & {
  getImageRenderInfo: (src: string, maxWidth: number) => { ready: boolean; drawWidth: number; drawHeight: number };
  ensureImage: (src: string) => import('./readerState').ImageCacheEntry;
  saveCurrentPosition: () => void;
  updatePageChrome: () => void;
  syncCanvasTapLayerLayout: () => void;
  updateResponsiveChrome: () => void;
};
