import { extractBlocksFromHtml, extractCommentBlocksFromHtml } from './extract';
import { buildPageStarts, walkOnePage, type Cursor, type PageLayout } from './pagination';
import {
  getAdjacentChapterHrefs,
  getChapterTitle,
  getCommentsRoot,
  getForumContent,
  getNovelDetailHref,
} from './site';
import type { Block } from './types';
import { createReaderDom } from './reader/dom';
import { drawBottomMetadata } from './reader/renderCanvas';
import {
  chromeSettingsTablet,
  getChromePreset,
  getChromeSettingsForPreset,
  readerSettings,
  type ReaderSettings,
  type ChromePreset,
  type ChromeSettings,
} from './reader/settings';
import { buildReaderStyles } from './reader/styles';

type ChapterNav = { prev: string; next: string };
type ImageCacheEntry = {
  img: HTMLImageElement;
  status: 'loading' | 'loaded' | 'error';
  naturalWidth: number;
  naturalHeight: number;
};
const READER_PROFILE_STORAGE_KEY = 'esj-pager:reader-profile:v1';
const READER_LAST_PAGE_STORAGE_KEY = 'esj-pager:last-page:v1';
const READER_FULLSCREEN_RESTORE_KEY = 'esj-pager:restore-fullscreen-once:v1';
const READER_WEB_FONT_STORAGE_KEY = 'esj-pager:web-font:v1';
type ReaderProfile = Pick<
  ReaderSettings,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'paragraphSpacing' | 'pagePaddingX' | 'pagePaddingY' | 'pageMaxWidth'
> & {
  removeSingleEmptyParagraph: boolean;
};

type WebFontConfig = {
  cssUrl: string;
  family: string;
};

const LOCAL_FONT_OPTIONS: Array<{ label: string; value: string; detectFamilies?: string[] }> = [
  { label: '系統預設', value: 'serif' },
  {
    label: '思源宋體',
    value: '"Source Han Serif TC", "Source Han Serif", "Noto Serif CJK TC", "Noto Serif TC", "思源宋體", serif',
    detectFamilies: ['Source Han Serif TC', 'Source Han Serif', 'Noto Serif CJK TC', 'Noto Serif TC', '思源宋體'],
  },
  {
    label: '思源黑體',
    value: '"Source Han Sans TC", "Source Han Sans", "Noto Sans CJK TC", "Noto Sans TC", "思源黑體", sans-serif',
    detectFamilies: ['Source Han Sans TC', 'Source Han Sans', 'Noto Sans CJK TC', 'Noto Sans TC', '思源黑體'],
  },
  {
    label: '微軟正黑體',
    value: '"Microsoft JhengHei", sans-serif',
    detectFamilies: ['Microsoft JhengHei'],
  },
  {
    label: '新細明體',
    value: '"PMingLiU", serif',
    detectFamilies: ['PMingLiU'],
  },
];

function main(): void {
  const root = getForumContent();
  if (!root) return;

  const title = getChapterTitle();
  const blocks = extractBlocksFromHtml(root.innerHTML);
  const commentsRoot = getCommentsRoot();
  const commentBlocks = commentsRoot ? extractCommentBlocksFromHtml(commentsRoot.innerHTML) : [];
  const allBlocks = [...blocks, ...commentBlocks];
  const chapterNav = getAdjacentChapterHrefs();
  const novelDetailHref = getNovelDetailHref();
  mountReader(title, allBlocks, chapterNav, novelDetailHref);
  console.info('[esj-pager]', title, 'blocks:', allBlocks.length);
}

function mountReader(
  title: string,
  blocks: Block[],
  chapterNav: ChapterNav,
  novelDetailHref: string,
): void {
  const refs = createReaderDom(title, novelDetailHref, chapterNav);
  const {
    style,
    readerRoot,
    btnHeaderMenu,
    iconHeaderMenu,
    btnHeaderFullscreen,
    iconHeaderFullscreenExpand,
    iconHeaderFullscreenShrink,
    drawerOverlay,
    drawerBackdrop,
    iconTocEl,
    canvasWrap,
    canvas,
    btnTapPrevPage,
    btnTapChrome,
    btnTapNextPage,
    btnPrevChap,
    iconPrevChapEl,
    btnPrevPage,
    iconPrevPageEl,
    footerPageCell,
    btnFooterPageJump,
    iconFooterPageJumpEl,
    footerPageCur,
    footerPageTotal,
    btnNextPage,
    iconNextPageEl,
    btnNextChap,
    iconNextChapEl,
    readerSettingFontValue,
    readerSettingLineHeightValue,
    readerSettingParaSpacingValue,
    readerSettingPagePaddingXValue,
    readerSettingPagePaddingYValue,
    readerSettingPageMaxWidthValue,
    btnReaderSettingsAdjust,
    btnReaderSettingsDropdown,
    iconReaderSettingsChevronDownEl,
    iconReaderSettingsChevronUpEl,
    readerSettingsContent,
    btnProfileSave,
    btnProfileRestore,
    btnProfileDropdown,
    iconProfileChevronDownEl,
    iconProfileChevronUpEl,
    profileContent,
    profileFontValue,
    profileLineHeightValue,
    profileParaSpacingValue,
    profilePagePaddingXValue,
    profilePagePaddingYValue,
    profilePageMaxWidthValue,
    profileRemoveSingleEmptyValue,
    selectFontSource,
    fontLocalRow,
    selectLocalFont,
    fontWebControls,
    inputWebFontCssUrl,
    inputWebFontFamily,
    btnApplyWebFont,
    readerRemoveSingleEmptyValue,
    readerAdjustOverlay,
    readerAdjustBackdrop,
    readerAdjustPanel,
    readerAdjustFontValue,
    btnReaderAdjustFontDec,
    rangeReaderAdjustFont,
    btnReaderAdjustFontInc,
    readerAdjustLineHeightValue,
    btnReaderAdjustLineHeightDec,
    rangeReaderAdjustLineHeight,
    btnReaderAdjustLineHeightInc,
    readerAdjustParaSpacingValue,
    btnReaderAdjustParaSpacingDec,
    rangeReaderAdjustParaSpacing,
    btnReaderAdjustParaSpacingInc,
    readerAdjustPagePaddingXValue,
    btnReaderAdjustPagePaddingXDec,
    rangeReaderAdjustPagePaddingX,
    btnReaderAdjustPagePaddingXInc,
    readerAdjustPagePaddingYValue,
    btnReaderAdjustPagePaddingYDec,
    rangeReaderAdjustPagePaddingY,
    btnReaderAdjustPagePaddingYInc,
    readerAdjustPageMaxWidthValue,
    btnReaderAdjustPageMaxWidthDec,
    rangeReaderAdjustPageMaxWidth,
    btnReaderAdjustPageMaxWidthInc,
    btnReaderAdjustRemoveSingleEmpty,
    btnReaderAdjustApply,
    iconReaderAdjustRemoveSingleEmptyCheckEl,
    pageJumpOverlay,
    pageJumpBackdrop,
    pageJumpPanel,
    pageJumpInput,
    pageJumpTotalEl,
    pageJumpCancel,
    pageJumpOk,
  } = refs;

  style.textContent = buildReaderStyles();
  document.head.appendChild(style);
  document.body.appendChild(readerRoot);
  const rootEl = document.documentElement;
  const bodyEl = document.body;
  const prevRootOverflow = rootEl.style.overflow;
  const prevBodyOverflow = bodyEl.style.overflow;
  rootEl.style.overflow = 'hidden';
  bodyEl.style.overflow = 'hidden';

  const restorePageScroll = (): void => {
    rootEl.style.overflow = prevRootOverflow;
    bodyEl.style.overflow = prevBodyOverflow;
  };
  window.addEventListener('pagehide', restorePageScroll, { once: true });

  let pageStarts: Cursor[] = [];
  let pageIndex = 0;
  let lastCanvasW = -1;
  let lastCanvasH = -1;
  let chromeVisible = true;
  let activeChromePreset: ChromePreset | null = null;
  let activeChromeSettings: ChromeSettings = chromeSettingsTablet;
  let swipeStartX: number | null = null;
  let swipeStartY: number | null = null;
  let suppressNextSideTap = false;
  let removeSingleEmptyParagraph = false;
  let pagedBlocks: Block[] = blocks;
  const currentReaderSettings: ReaderSettings = { ...readerSettings };
  const chapterPageStorageKey = `${window.location.pathname}${window.location.search}`;
  let pendingRestorePageIndex: number | null = null;
  let lastSavedPageIndex = -1;

  const readerLimits = {
    fontSize: { min: 14, max: 56, step: 1 },
    lineHeight: { min: 1, max: 3.2, step: 0.05 },
    paragraphSpacing: { min: 0, max: 72, step: 2 },
    pagePaddingX: { min: 0, max: 180, step: 2 },
    pagePaddingY: { min: 0, max: 180, step: 2 },
    pageMaxWidth: { min: 320, max: 2400, step: 20 },
  };
  let hasSavedProfile = false;
  let readerSettingsExpanded = false;
  let profileExpanded = false;
  let savedProfile: ReaderProfile | null = null;
  const imageCache = new Map<string, ImageCacheEntry>();
  let lastRenderedPageIndex = -1;
  let shouldRestoreFullscreenOnNextTap = false;
  let adjustAnchorCursor: Cursor | null = null;
  let previewFromAdjust = false;
  let fontSource: 'local' | 'web' = 'local';
  let webFontLinkEl: HTMLLinkElement | null = null;

  const sourceLocalOption = document.createElement('option');
  sourceLocalOption.value = 'local';
  sourceLocalOption.textContent = '本機字體';
  selectFontSource.appendChild(sourceLocalOption);
  const sourceWebOption = document.createElement('option');
  sourceWebOption.value = 'web';
  sourceWebOption.textContent = 'Web Font';
  selectFontSource.appendChild(sourceWebOption);
  selectFontSource.value = 'local';

  function isFontFamilyLikelyAvailable(family: string): boolean {
    const canvasEl = document.createElement('canvas');
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return false;
    const text = 'abcdefghijklmnopqrstuvwxyz0123456789一二三四五六七八九十';
    const baseFamilies = ['monospace', 'serif', 'sans-serif'] as const;
    const baseWidths = baseFamilies.map((base) => {
      ctx.font = `72px ${base}`;
      return ctx.measureText(text).width;
    });
    ctx.font = `72px "${family}", monospace`;
    const testWidth = ctx.measureText(text).width;
    return !baseWidths.some((w) => Math.abs(testWidth - w) < 0.01);
  }

  function isAnyFontFamilyAvailable(families: string[]): boolean {
    return families.some((family) => isFontFamilyLikelyAvailable(family));
  }

  function syncFontSourceUi(): void {
    selectFontSource.value = fontSource;
    selectLocalFont.disabled = fontSource !== 'local';
    fontLocalRow.classList.toggle('hidden', fontSource !== 'local');
    fontWebControls.classList.toggle('open', fontSource === 'web');
  }

  function saveWebFontConfig(config: WebFontConfig): void {
    try {
      window.localStorage.setItem(READER_WEB_FONT_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage failures.
    }
  }

  function loadWebFontConfig(): WebFontConfig | null {
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

  function ensureWebFontStylesheet(cssUrl: string): void {
    if (webFontLinkEl && webFontLinkEl.href === cssUrl) return;
    if (webFontLinkEl) webFontLinkEl.remove();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.appendChild(link);
    webFontLinkEl = link;
  }

  async function applyWebFont(cssUrl: string, family: string): Promise<void> {
    ensureWebFontStylesheet(cssUrl);
    const familyExpr = family.includes(',') ? family : `"${family}"`;
    await Promise.race([
      document.fonts.load(`16px ${familyExpr}`),
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]);
    currentReaderSettings.fontFamily = family;
    fontSource = 'web';
    syncFontSourceUi();
    updateReaderSettingsUi();
    lastCanvasW = -1;
    lastCanvasH = -1;
    render();
    saveWebFontConfig({ cssUrl, family });
  }

  function getPresetWebFontConfig(presetId: string, weight: number): WebFontConfig | null {
    const clampedWeight = Math.max(100, Math.min(900, Math.round(weight / 100) * 100));
    if (presetId === 'noto-serif-tc') {
      return {
        cssUrl: `https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@${clampedWeight}&display=swap`,
        family: 'Noto Serif TC',
      };
    }
    if (presetId === 'noto-sans-tc') {
      return {
        cssUrl: `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@${clampedWeight}&display=swap`,
        family: 'Noto Sans TC',
      };
    }
    return null;
  }

  for (const option of LOCAL_FONT_OPTIONS) {
    if (option.detectFamilies && !isAnyFontFamilyAvailable(option.detectFamilies)) continue;
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    selectLocalFont.appendChild(el);
  }

  function closeDrawer(): void {
    drawerOverlay.classList.remove('open');
    drawerOverlay.setAttribute('aria-hidden', 'true');
    btnHeaderMenu.setAttribute('aria-expanded', 'false');
  }

  function openDrawer(): void {
    drawerOverlay.classList.add('open');
    drawerOverlay.setAttribute('aria-hidden', 'false');
    btnHeaderMenu.setAttribute('aria-expanded', 'true');
  }

  function markFullscreenRestoreForNextChapterNavigation(): void {
    try {
      if (document.fullscreenElement) {
        window.sessionStorage.setItem(READER_FULLSCREEN_RESTORE_KEY, '1');
      } else {
        window.sessionStorage.removeItem(READER_FULLSCREEN_RESTORE_KEY);
      }
    } catch {
      // Ignore storage failures.
    }
  }

  function loadFullscreenRestoreFlag(): void {
    try {
      shouldRestoreFullscreenOnNextTap = window.sessionStorage.getItem(READER_FULLSCREEN_RESTORE_KEY) === '1';
    } catch {
      shouldRestoreFullscreenOnNextTap = false;
    }
  }

  function clearFullscreenRestoreFlag(): void {
    shouldRestoreFullscreenOnNextTap = false;
    try {
      window.sessionStorage.removeItem(READER_FULLSCREEN_RESTORE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  function restoreFullscreenOnFirstTap(): void {
    if (!shouldRestoreFullscreenOnNextTap) return;
    if (document.fullscreenElement) {
      clearFullscreenRestoreFlag();
      return;
    }
    clearFullscreenRestoreFlag();
    void readerRoot.requestFullscreen().catch(() => {
      // Ignore request failure to avoid breaking tap interactions.
    });
  }

  function ensureImage(src: string): ImageCacheEntry {
    const cached = imageCache.get(src);
    if (cached) return cached;
    const img = new Image();
    const entry: ImageCacheEntry = {
      img,
      status: 'loading',
      naturalWidth: 0,
      naturalHeight: 0,
    };
    img.onload = () => {
      entry.status = 'loaded';
      entry.naturalWidth = img.naturalWidth || 0;
      entry.naturalHeight = img.naturalHeight || 0;
      lastCanvasW = -1;
      lastCanvasH = -1;
      render();
    };
    img.onerror = () => {
      entry.status = 'error';
      lastCanvasW = -1;
      lastCanvasH = -1;
      render();
    };
    img.src = src;
    imageCache.set(src, entry);
    return entry;
  }

  function getImageRenderInfo(src: string, maxWidth: number): { ready: boolean; drawWidth: number; drawHeight: number } {
    const entry = ensureImage(src);
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

  function setIconSize(el: SVGElement | null, size: number): void {
    if (!el) return;
    el.setAttribute('width', String(size));
    el.setAttribute('height', String(size));
  }

  function applyChromeSettings(settings: ChromeSettings): void {
    activeChromeSettings = settings;
    readerRoot.style.setProperty('--esj-header-h', `${settings.headerHeight}px`);
    readerRoot.style.setProperty('--esj-footer-h', `${settings.footerHeight}px`);
    readerRoot.style.setProperty('--esj-header-gap', `${settings.headerGap}px`);
    readerRoot.style.setProperty('--esj-header-pad-l', `${settings.headerPadLeft}px`);
    readerRoot.style.setProperty('--esj-header-pad-r', `${settings.headerPadRight}px`);
    readerRoot.style.setProperty('--esj-header-menu-btn-size', `${settings.headerMenuButtonSize}px`);
    readerRoot.style.setProperty('--esj-header-title-font-size', `${settings.headerTitleFontSize}px`);
    readerRoot.style.setProperty('--esj-header-page-font-size', `${settings.headerPageFontSize}px`);
    readerRoot.style.setProperty('--esj-footer-chapter-btn-width', `${settings.footerChapterButtonWidth}px`);
    readerRoot.style.setProperty('--esj-footer-chapter-btn-max-width', `${settings.footerChapterButtonMaxWidth}px`);
    readerRoot.style.setProperty('--esj-footer-chapter-btn-pad-x', `${settings.footerChapterButtonPadX}px`);
    readerRoot.style.setProperty('--esj-footer-page-font-size', `${settings.footerPageFontSize}px`);
    readerRoot.style.setProperty('--esj-footer-pagecell-pad-x', `${settings.footerPageCellPadX}px`);
    readerRoot.style.setProperty('--esj-footer-page-btn-pad-y', `${settings.footerPageButtonPadY}px`);
    readerRoot.style.setProperty('--esj-footer-page-btn-pad-x', `${settings.footerPageButtonPadX}px`);

    setIconSize(iconHeaderMenu, settings.iconMenuSize);
    setIconSize(iconHeaderFullscreenExpand, settings.iconMenuSize);
    setIconSize(iconHeaderFullscreenShrink, settings.iconMenuSize);
    setIconSize(iconTocEl, settings.iconTableOfContentsSize);
    setIconSize(iconPrevChapEl, settings.iconChapterSize);
    setIconSize(iconNextChapEl, settings.iconChapterSize);
    setIconSize(iconPrevPageEl, settings.iconPageSize);
    setIconSize(iconNextPageEl, settings.iconPageSize);
    setIconSize(iconFooterPageJumpEl, settings.iconPageSize);
  }

  function applyChromeVisibility(): void {
    readerRoot.classList.toggle('esj-chrome-hidden', !chromeVisible);
  }

  function roundByStep(value: number, step: number): number {
    return Math.round(value / step) * step;
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function compareCursor(a: Cursor, b: Cursor): number {
    if (a.bi !== b.bi) return a.bi - b.bi;
    return a.off - b.off;
  }

  function findPageIndexByCursor(starts: Cursor[], target: Cursor): number {
    if (starts.length === 0) return 0;
    let idx = 0;
    for (let i = 0; i < starts.length; i += 1) {
      if (compareCursor(starts[i], target) <= 0) idx = i;
      else break;
    }
    return idx;
  }

  function formatLineHeight(v: number): string {
    return Number(v.toFixed(2)).toString();
  }

  function syncLocalFontSelectUi(): void {
    const match = LOCAL_FONT_OPTIONS.find((opt) => opt.value === currentReaderSettings.fontFamily);
    if (match) {
      selectLocalFont.value = match.value;
      return;
    }
    selectLocalFont.value = '';
  }

  function updateReaderSettingsUi(): void {
    readerSettingFontValue.textContent = `${currentReaderSettings.fontSize}`;
    readerSettingLineHeightValue.textContent = formatLineHeight(currentReaderSettings.lineHeight);
    readerSettingParaSpacingValue.textContent = `${currentReaderSettings.paragraphSpacing}`;
    readerSettingPagePaddingXValue.textContent = `${currentReaderSettings.pagePaddingX}`;
    readerSettingPagePaddingYValue.textContent = `${currentReaderSettings.pagePaddingY}`;
    readerSettingPageMaxWidthValue.textContent = `${currentReaderSettings.pageMaxWidth}`;
    syncLocalFontSelectUi();
    syncReaderAdjustUi();
    btnProfileRestore.disabled = !hasSavedProfile;
  }

  function setProfileExpanded(expanded: boolean): void {
    profileExpanded = expanded;
    btnProfileDropdown.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    profileContent.classList.toggle('open', expanded);
    iconProfileChevronDownEl.style.display = expanded ? 'none' : '';
    iconProfileChevronUpEl.style.display = expanded ? '' : 'none';
  }

  function setReaderSettingsExpanded(expanded: boolean): void {
    readerSettingsExpanded = expanded;
    btnReaderSettingsDropdown.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    readerSettingsContent.classList.toggle('open', expanded);
    iconReaderSettingsChevronDownEl.style.display = expanded ? 'none' : '';
    iconReaderSettingsChevronUpEl.style.display = expanded ? '' : 'none';
  }

  function updateProfileUi(): void {
    if (!savedProfile) {
      profileFontValue.textContent = '-';
      profileLineHeightValue.textContent = '-';
      profileParaSpacingValue.textContent = '-';
      profilePagePaddingXValue.textContent = '-';
      profilePagePaddingYValue.textContent = '-';
      profilePageMaxWidthValue.textContent = '-';
      profileRemoveSingleEmptyValue.textContent = '-';
      return;
    }
    profileFontValue.textContent = String(savedProfile.fontSize);
    profileLineHeightValue.textContent = formatLineHeight(savedProfile.lineHeight);
    profileParaSpacingValue.textContent = String(savedProfile.paragraphSpacing);
    profilePagePaddingXValue.textContent = String(savedProfile.pagePaddingX);
    profilePagePaddingYValue.textContent = String(savedProfile.pagePaddingY);
    profilePageMaxWidthValue.textContent = String(savedProfile.pageMaxWidth);
    profileRemoveSingleEmptyValue.textContent = savedProfile.removeSingleEmptyParagraph ? 'ON' : 'OFF';
  }

  function saveReaderProfile(): void {
    const payload: ReaderProfile = {
      fontFamily: currentReaderSettings.fontFamily,
      fontSize: currentReaderSettings.fontSize,
      lineHeight: currentReaderSettings.lineHeight,
      paragraphSpacing: currentReaderSettings.paragraphSpacing,
      pagePaddingX: currentReaderSettings.pagePaddingX,
      pagePaddingY: currentReaderSettings.pagePaddingY,
      pageMaxWidth: currentReaderSettings.pageMaxWidth,
      removeSingleEmptyParagraph,
    };
    try {
      window.localStorage.setItem(READER_PROFILE_STORAGE_KEY, JSON.stringify(payload));
      savedProfile = { ...payload };
      hasSavedProfile = true;
      updateProfileUi();
      updateReaderSettingsUi();
    } catch {
      window.alert('儲存設定檔失敗');
    }
  }

  function loadSavedReaderProfile(): boolean {
    try {
      const raw = window.localStorage.getItem(READER_PROFILE_STORAGE_KEY);
      if (!raw) {
        savedProfile = null;
        hasSavedProfile = false;
        updateProfileUi();
        return false;
      }
      const parsed = JSON.parse(raw) as Partial<
        Record<keyof typeof readerLimits, number> & { fontFamily: string; removeSingleEmptyParagraph: boolean }
      >;
      let changed = false;
      if (typeof parsed.fontFamily === 'string' && parsed.fontFamily.trim().length > 0) {
        if (currentReaderSettings.fontFamily !== parsed.fontFamily) {
          currentReaderSettings.fontFamily = parsed.fontFamily;
          changed = true;
        }
      }
      for (const key of Object.keys(readerLimits) as (keyof typeof readerLimits)[]) {
        const nextRaw = parsed[key];
        if (!Number.isFinite(nextRaw)) continue;
        const limits = readerLimits[key];
        const next = clamp(roundByStep(nextRaw as number, limits.step), limits.min, limits.max);
        if (currentReaderSettings[key] === next) continue;
        currentReaderSettings[key] = next;
        changed = true;
      }
      if (typeof (parsed as { removeSingleEmptyParagraph?: unknown }).removeSingleEmptyParagraph === 'boolean') {
        const nextRemoveSingleEmptyParagraph = (parsed as { removeSingleEmptyParagraph: boolean }).removeSingleEmptyParagraph;
        if (removeSingleEmptyParagraph !== nextRemoveSingleEmptyParagraph) {
          removeSingleEmptyParagraph = nextRemoveSingleEmptyParagraph;
          updateRemoveSingleEmptyParagraphUi();
          pagedBlocks = applyEmptyParagraphFilter(blocks);
          changed = true;
        }
      }
      savedProfile = {
        fontFamily:
          typeof parsed.fontFamily === 'string' && parsed.fontFamily.trim().length > 0
            ? parsed.fontFamily
            : currentReaderSettings.fontFamily,
        fontSize: Number.isFinite(parsed.fontSize) ? clamp(roundByStep(parsed.fontSize as number, readerLimits.fontSize.step), readerLimits.fontSize.min, readerLimits.fontSize.max) : currentReaderSettings.fontSize,
        lineHeight: Number.isFinite(parsed.lineHeight) ? clamp(roundByStep(parsed.lineHeight as number, readerLimits.lineHeight.step), readerLimits.lineHeight.min, readerLimits.lineHeight.max) : currentReaderSettings.lineHeight,
        paragraphSpacing: Number.isFinite(parsed.paragraphSpacing) ? clamp(roundByStep(parsed.paragraphSpacing as number, readerLimits.paragraphSpacing.step), readerLimits.paragraphSpacing.min, readerLimits.paragraphSpacing.max) : currentReaderSettings.paragraphSpacing,
        pagePaddingX: Number.isFinite(parsed.pagePaddingX) ? clamp(roundByStep(parsed.pagePaddingX as number, readerLimits.pagePaddingX.step), readerLimits.pagePaddingX.min, readerLimits.pagePaddingX.max) : currentReaderSettings.pagePaddingX,
        pagePaddingY: Number.isFinite(parsed.pagePaddingY) ? clamp(roundByStep(parsed.pagePaddingY as number, readerLimits.pagePaddingY.step), readerLimits.pagePaddingY.min, readerLimits.pagePaddingY.max) : currentReaderSettings.pagePaddingY,
        pageMaxWidth: Number.isFinite(parsed.pageMaxWidth) ? clamp(roundByStep(parsed.pageMaxWidth as number, readerLimits.pageMaxWidth.step), readerLimits.pageMaxWidth.min, readerLimits.pageMaxWidth.max) : currentReaderSettings.pageMaxWidth,
        removeSingleEmptyParagraph:
          typeof (parsed as { removeSingleEmptyParagraph?: unknown }).removeSingleEmptyParagraph === 'boolean'
            ? (parsed as { removeSingleEmptyParagraph: boolean }).removeSingleEmptyParagraph
            : removeSingleEmptyParagraph,
      };
      hasSavedProfile = true;
      updateProfileUi();
      updateReaderSettingsUi();
      return changed;
    } catch {
      savedProfile = null;
      hasSavedProfile = false;
      updateProfileUi();
      return false;
    }
  }

  function loadSavedPageIndex(): void {
    try {
      const raw = window.localStorage.getItem(READER_LAST_PAGE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const savedPage = parsed[chapterPageStorageKey];
      if (!Number.isFinite(savedPage)) return;
      const nextIndex = Math.max(0, Math.floor(savedPage as number) - 1);
      pendingRestorePageIndex = nextIndex;
    } catch {
      // Ignore bad storage content and continue with first page.
    }
  }

  function saveCurrentPageIndex(): void {
    if (pageStarts.length === 0) return;
    if (pageIndex === lastSavedPageIndex) return;
    try {
      const raw = window.localStorage.getItem(READER_LAST_PAGE_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      parsed[chapterPageStorageKey] = pageIndex + 1;
      window.localStorage.setItem(READER_LAST_PAGE_STORAGE_KEY, JSON.stringify(parsed));
      lastSavedPageIndex = pageIndex;
    } catch {
      // Ignore storage failures silently.
    }
  }

  function applyEmptyParagraphFilter(source: Block[]): Block[] {
    if (!removeSingleEmptyParagraph) return source;

    const out: Block[] = [];
    let i = 0;
    while (i < source.length) {
      const b = source[i];
      const isEmptyParagraph =
        b.type === 'paragraph' && b.text.trim().length === 0;
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

  function updateRemoveSingleEmptyParagraphUi(): void {
    readerRemoveSingleEmptyValue.textContent = removeSingleEmptyParagraph ? 'ON' : 'OFF';
    btnReaderAdjustRemoveSingleEmpty.setAttribute('aria-pressed', removeSingleEmptyParagraph ? 'true' : 'false');
    iconReaderAdjustRemoveSingleEmptyCheckEl.style.display = removeSingleEmptyParagraph ? '' : 'none';
  }

  function toggleRemoveSingleEmptyParagraph(): void {
    removeSingleEmptyParagraph = !removeSingleEmptyParagraph;
    updateRemoveSingleEmptyParagraphUi();
    pagedBlocks = applyEmptyParagraphFilter(blocks);
    if (!previewFromAdjust) {
      pageIndex = 0;
      lastCanvasW = -1;
      lastCanvasH = -1;
    }
    render();
  }

  function adjustReaderSetting(
    key: keyof Pick<
      ReaderSettings,
      'fontSize' | 'lineHeight' | 'paragraphSpacing' | 'pagePaddingX' | 'pagePaddingY' | 'pageMaxWidth'
    >,
    delta: number,
  ): void {
    const limits = readerLimits[key];
    const next = clamp(roundByStep((currentReaderSettings[key] as number) + delta, limits.step), limits.min, limits.max);
    if (next === currentReaderSettings[key]) return;
    currentReaderSettings[key] = next;
    updateReaderSettingsUi();
    if (!previewFromAdjust) {
      lastCanvasW = -1;
      lastCanvasH = -1;
    }
    render();
  }

  function finalizeReaderAdjustRebuild(): void {
    const anchor = adjustAnchorCursor;
    previewFromAdjust = false;
    adjustAnchorCursor = null;
    if (!anchor) return;
    lastCanvasW = -1;
    lastCanvasH = -1;
    render();
    if (pageStarts.length > 0) {
      pageIndex = findPageIndexByCursor(pageStarts, anchor);
      render();
    }
  }

  function closeReaderAdjust(restoreChrome = false): void {
    if (previewFromAdjust) {
      finalizeReaderAdjustRebuild();
    }
    readerAdjustOverlay.classList.remove('open');
    readerAdjustOverlay.setAttribute('aria-hidden', 'true');
    if (restoreChrome && !chromeVisible) {
      chromeVisible = true;
      applyChromeVisibility();
      syncCanvasTapLayerLayout();
    }
    openDrawer();
  }

  function syncReaderAdjustUi(): void {
    function syncOne(
      key: keyof typeof readerLimits,
      valueEl: HTMLSpanElement,
      rangeEl: HTMLInputElement,
      decBtn: HTMLButtonElement,
      incBtn: HTMLButtonElement,
    ): void {
      const limits = readerLimits[key];
      const value = currentReaderSettings[key];
      valueEl.textContent = key === 'lineHeight' ? formatLineHeight(value) : String(value);
      rangeEl.min = String(limits.min);
      rangeEl.max = String(limits.max);
      rangeEl.step = String(limits.step);
      rangeEl.value = String(value);
      decBtn.disabled = value <= limits.min;
      incBtn.disabled = value >= limits.max;
    }
    syncOne('fontSize', readerAdjustFontValue, rangeReaderAdjustFont, btnReaderAdjustFontDec, btnReaderAdjustFontInc);
    syncOne(
      'lineHeight',
      readerAdjustLineHeightValue,
      rangeReaderAdjustLineHeight,
      btnReaderAdjustLineHeightDec,
      btnReaderAdjustLineHeightInc,
    );
    syncOne(
      'paragraphSpacing',
      readerAdjustParaSpacingValue,
      rangeReaderAdjustParaSpacing,
      btnReaderAdjustParaSpacingDec,
      btnReaderAdjustParaSpacingInc,
    );
    syncOne(
      'pagePaddingX',
      readerAdjustPagePaddingXValue,
      rangeReaderAdjustPagePaddingX,
      btnReaderAdjustPagePaddingXDec,
      btnReaderAdjustPagePaddingXInc,
    );
    syncOne(
      'pagePaddingY',
      readerAdjustPagePaddingYValue,
      rangeReaderAdjustPagePaddingY,
      btnReaderAdjustPagePaddingYDec,
      btnReaderAdjustPagePaddingYInc,
    );
    syncOne(
      'pageMaxWidth',
      readerAdjustPageMaxWidthValue,
      rangeReaderAdjustPageMaxWidth,
      btnReaderAdjustPageMaxWidthDec,
      btnReaderAdjustPageMaxWidthInc,
    );
  }

  function openReaderAdjust(): void {
    closeDrawer();
    if (chromeVisible) {
      chromeVisible = false;
      applyChromeVisibility();
      syncCanvasTapLayerLayout();
    }
    adjustAnchorCursor = pageStarts[pageIndex] ? { ...pageStarts[pageIndex] } : { bi: 0, off: 0 };
    previewFromAdjust = true;
    syncReaderAdjustUi();
    readerAdjustOverlay.classList.add('open');
    readerAdjustOverlay.setAttribute('aria-hidden', 'false');
  }

  function updateResponsiveChrome(): void {
    const preset = getChromePreset(window.innerWidth);
    if (preset === activeChromePreset) return;
    activeChromePreset = preset;
    applyChromeSettings(getChromeSettingsForPreset(preset));
    syncCanvasTapLayerLayout();
  }

  function updatePageChrome(): void {
    const total = pageStarts.length;
    if (total === 0) {
      footerPageCur.textContent = '0';
      footerPageTotal.textContent = '0';
      btnFooterPageJump.disabled = true;
      pageJumpTotalEl.textContent = '0';
      pageJumpInput.removeAttribute('max');
      btnPrevPage.disabled = true;
      btnNextPage.disabled = true;
      return;
    }
    const cur = pageIndex + 1;
    footerPageCur.textContent = String(cur);
    footerPageTotal.textContent = String(total);
    btnFooterPageJump.disabled = false;
    pageJumpTotalEl.textContent = String(total);
    pageJumpInput.max = String(total);
    pageJumpInput.min = '1';
    btnPrevPage.disabled = pageIndex <= 0;
    btnNextPage.disabled = pageIndex >= total - 1;
  }

  function closePageJump(): void {
    pageJumpOverlay.classList.remove('open');
    pageJumpOverlay.setAttribute('aria-hidden', 'true');
    pageJumpInput.blur();
  }

  function openPageJump(): void {
    const total = pageStarts.length;
    if (total === 0) return;
    pageJumpInput.value = String(pageIndex + 1);
    pageJumpTotalEl.textContent = String(total);
    pageJumpInput.min = '1';
    pageJumpInput.max = String(total);
    pageJumpOverlay.classList.add('open');
    pageJumpOverlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      pageJumpInput.focus();
      pageJumpInput.select();
    });
  }

  function submitPageJump(): void {
    const total = pageStarts.length;
    if (total === 0) return;
    const raw = parseInt(String(pageJumpInput.value), 10);
    if (Number.isNaN(raw)) {
      closePageJump();
      return;
    }
    const clamped = Math.max(1, Math.min(total, raw));
    pageIndex = clamped - 1;
    closePageJump();
    render();
  }

  function syncCanvasTapLayerLayout(): void {
    const wrapRect = canvasWrap.getBoundingClientRect();
    const w = wrapRect.width;
    if (w <= 0) return;

    const topPx = chromeVisible ? activeChromeSettings.headerHeight : 0;
    const bottomPx = chromeVisible ? activeChromeSettings.footerHeight : 0;

    let leftW: number;
    let midLeft: number;
    let midW: number;
    let rightStart: number;
    let rightW: number;

    if (chromeVisible) {
      const cellRect = footerPageCell.getBoundingClientRect();
      leftW = Math.max(0, Math.round(cellRect.left - wrapRect.left));
      midLeft = leftW;
      midW = Math.max(0, Math.round(cellRect.width));
      rightStart = Math.max(0, Math.round(cellRect.right - wrapRect.left));
      rightW = Math.max(0, Math.round(wrapRect.right - cellRect.right));
    } else {
      const third = Math.floor(w / 3);
      leftW = third;
      midLeft = third;
      midW = third;
      rightStart = third * 2;
      rightW = w - third * 2;
    }

    const vTop = `${topPx}px`;
    const vBottom = `${bottomPx}px`;

    btnTapPrevPage.style.top = vTop;
    btnTapPrevPage.style.bottom = vBottom;
    btnTapPrevPage.style.left = '0px';
    btnTapPrevPage.style.width = `${leftW}px`;

    btnTapChrome.style.top = vTop;
    btnTapChrome.style.bottom = vBottom;
    btnTapChrome.style.left = `${midLeft}px`;
    btnTapChrome.style.width = `${midW}px`;

    btnTapNextPage.style.top = vTop;
    btnTapNextPage.style.bottom = vBottom;
    btnTapNextPage.style.left = `${rightStart}px`;
    btnTapNextPage.style.width = `${rightW}px`;

    const total = pageStarts.length;
    const canTapPrev = total > 0 && (pageIndex > 0 || Boolean(chapterNav.prev));
    const canTapNext = total > 0 && (pageIndex < total - 1 || Boolean(chapterNav.next));
    btnTapPrevPage.disabled = !canTapPrev;
    btnTapNextPage.disabled = !canTapNext;
  }

  function goPrevPage(): void {
    if (pageIndex > 0) {
      pageIndex -= 1;
      render();
    }
  }

  function goNextPage(): void {
    if (pageIndex < pageStarts.length - 1) {
      pageIndex += 1;
      render();
    }
  }

  function confirmGoPrevChapter(): void {
    if (!chapterNav.prev) return;
    const ok = window.confirm('已在第一頁，是否前往上一章？');
    if (ok) {
      markFullscreenRestoreForNextChapterNavigation();
      window.location.href = chapterNav.prev;
    }
  }

  function confirmGoNextChapter(): void {
    if (!chapterNav.next) return;
    const ok = window.confirm('已在最後一頁，是否前往下一章？');
    if (ok) {
      markFullscreenRestoreForNextChapterNavigation();
      window.location.href = chapterNav.next;
    }
  }

  function toggleChrome(): void {
    chromeVisible = !chromeVisible;
    applyChromeVisibility();
    syncCanvasTapLayerLayout();
  }

  function syncHeaderFullscreenUi(): void {
    const isFullscreen = Boolean(document.fullscreenElement);
    btnHeaderFullscreen.setAttribute('aria-pressed', isFullscreen ? 'true' : 'false');
    btnHeaderFullscreen.setAttribute('aria-label', isFullscreen ? '離開全螢幕' : '進入全螢幕');
    iconHeaderFullscreenExpand.style.display = isFullscreen ? 'none' : '';
    iconHeaderFullscreenShrink.style.display = isFullscreen ? '' : 'none';
  }

  function toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {
        // Ignore exit failure.
      });
      return;
    }
    void readerRoot.requestFullscreen().catch(() => {
      // Ignore request failure.
    });
  }

  function handleSideTapPaging(): void {
    if (suppressNextSideTap) {
      suppressNextSideTap = false;
      return;
    }
    if (pageIndex >= pageStarts.length - 1) {
      confirmGoNextChapter();
    } else {
      goNextPage();
    }
  }

  function handleSwipePointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeStartX = e.clientX;
    swipeStartY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function resetSwipeTracking(): void {
    swipeStartX = null;
    swipeStartY = null;
  }

  function handleSwipePointerUp(e: PointerEvent): void {
    if (swipeStartX === null || swipeStartY === null) return;
    const dx = e.clientX - swipeStartX;
    const dy = e.clientY - swipeStartY;
    resetSwipeTracking();
    const swipeThresholdPx = 36;
    if (Math.abs(dx) < swipeThresholdPx) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;

    suppressNextSideTap = true;
    if (dx < 0) {
      if (pageIndex <= 0) {
        confirmGoPrevChapter();
      } else {
        goPrevPage();
      }
      return;
    }
    if (pageIndex >= pageStarts.length - 1) {
      confirmGoNextChapter();
    } else {
      goNextPage();
    }
  }

  function handleCanvasTapWheel(e: WheelEvent): void {
    const maxScrollTop = canvasWrap.scrollHeight - canvasWrap.clientHeight;
    if (maxScrollTop <= 0) return;
    const nextScrollTop = Math.max(0, Math.min(maxScrollTop, canvasWrap.scrollTop + e.deltaY));
    if (nextScrollTop === canvasWrap.scrollTop) return;
    e.preventDefault();
    canvasWrap.scrollTop = nextScrollTop;
  }

  function handleRightClickPrevPage(e: MouseEvent): void {
    e.preventDefault();
    if (pageIndex <= 0) {
      confirmGoPrevChapter();
      return;
    }
    goPrevPage();
  }

  function render(): void {
    updateResponsiveChrome();
    const dpr = window.devicePixelRatio || 1;
    const width = canvasWrap.clientWidth;
    const viewportHeight = canvasWrap.clientHeight;
    if (width === 0 || viewportHeight === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const maxHeight = Math.max(0, viewportHeight - currentReaderSettings.pagePaddingY * 2);
    const availableTextWidth = Math.max(0, width - currentReaderSettings.pagePaddingX * 2);
    const textWidth = Math.min(availableTextWidth, currentReaderSettings.pageMaxWidth);
    const textLeft = Math.max(0, Math.floor((width - textWidth) / 2));
    const linePx = currentReaderSettings.fontSize * currentReaderSettings.lineHeight;

    const layout: PageLayout = {
      padX: currentReaderSettings.pagePaddingX,
      padY: currentReaderSettings.pagePaddingY,
      textLeft,
      textWidth,
      maxWidth: textWidth,
      maxHeight,
      linePx,
      paraSpacing: currentReaderSettings.paragraphSpacing,
    };

    const useAdjustPreview = previewFromAdjust && adjustAnchorCursor !== null;
    const sameSize = !useAdjustPreview && pageStarts.length > 0 && width === lastCanvasW && viewportHeight === lastCanvasH;
    if (!sameSize) {
      if (!useAdjustPreview) {
        pageStarts = buildPageStarts(ctx, pagedBlocks, layout, {
          imagePlaceholderText: '【圖】',
          getImageRenderInfo,
        });
        lastCanvasW = width;
        lastCanvasH = viewportHeight;
        if (pendingRestorePageIndex !== null) {
          pageIndex = pendingRestorePageIndex;
          pendingRestorePageIndex = null;
        }
        pageIndex = Math.min(pageIndex, Math.max(0, pageStarts.length - 1));
      }
    }

    updatePageChrome();
    syncCanvasTapLayerLayout();
    if (!useAdjustPreview) {
      saveCurrentPageIndex();
    }

    const startCursor = useAdjustPreview ? adjustAnchorCursor : pageStarts[pageIndex];
    if (!startCursor) return;
    if (!useAdjustPreview && pageStarts.length === 0) return;

    let drawHeight = viewportHeight;
    const startBlock = pagedBlocks[startCursor.bi];
    if (startBlock?.type === 'img') {
      const info = getImageRenderInfo(startBlock.src, layout.maxWidth);
      if (info.ready && info.drawHeight > layout.maxHeight) {
        drawHeight = currentReaderSettings.pagePaddingY * 2 + info.drawHeight;
      }
    }

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(drawHeight * dpr);
    canvas.style.height = `${drawHeight}px`;
    canvasWrap.style.overflowY = drawHeight > viewportHeight ? 'auto' : 'hidden';
    if (pageIndex !== lastRenderedPageIndex) {
      canvasWrap.scrollTop = 0;
      lastRenderedPageIndex = pageIndex;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, drawHeight);
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'top';
    ctx.font = `${currentReaderSettings.fontSize}px ${currentReaderSettings.fontFamily}`;

    walkOnePage(ctx, pagedBlocks, startCursor, layout, true, {
      imagePlaceholderText: '【圖】',
      getImageRenderInfo,
      drawImage: (src, x, y, w, h) => {
        const entry = ensureImage(src);
        if (entry.status !== 'loaded') {
          ctx.fillText('【圖】', x, y);
          return;
        }
        ctx.drawImage(entry.img, x, y, w, h);
      },
    });
    drawBottomMetadata(
      ctx,
      drawHeight,
      title,
      `${pageIndex + 1} / ${pageStarts.length}`,
      currentReaderSettings,
      textLeft,
      textWidth,
    );
  }

  btnHeaderMenu.addEventListener('click', () => {
    if (drawerOverlay.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });
  btnHeaderFullscreen.addEventListener('click', toggleFullscreen);
  drawerBackdrop.addEventListener('click', closeDrawer);

  btnFooterPageJump.addEventListener('click', openPageJump);
  pageJumpBackdrop.addEventListener('click', closePageJump);
  pageJumpCancel.addEventListener('click', closePageJump);
  pageJumpOk.addEventListener('click', submitPageJump);

  pageJumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitPageJump();
    }
  });

  pageJumpPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  readerAdjustBackdrop.addEventListener('click', () => {
    closeReaderAdjust(true);
  });
  readerAdjustPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  function isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    const tag = el?.tagName?.toLowerCase();
    return Boolean(el?.isContentEditable) || tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  function shouldInterceptReaderHotkey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (isEditableTarget(e.target)) return false;
    return e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key.toLowerCase() === 'f';
  }

  const handleReaderHotkeys = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (drawerOverlay.classList.contains('open')) {
        closeDrawer();
        return;
      }
      if (pageJumpOverlay.classList.contains('open')) {
        closePageJump();
        return;
      }
      if (readerAdjustOverlay.classList.contains('open')) {
        closeReaderAdjust();
        return;
      }
      if (!chromeVisible) {
        chromeVisible = true;
        applyChromeVisibility();
        syncCanvasTapLayerLayout();
      }
      return;
    }

    if (!shouldInterceptReaderHotkey(e)) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (pageIndex <= 0) {
        confirmGoPrevChapter();
      } else {
        goPrevPage();
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (pageIndex >= pageStarts.length - 1) {
        confirmGoNextChapter();
      } else {
        goNextPage();
      }
      return;
    }

    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toggleFullscreen();
    }
  };

  // Capture on window to beat site-level key handlers.
  window.addEventListener('keydown', handleReaderHotkeys, { capture: true });
  // Some sites bind chapter switching on keyup.
  window.addEventListener('keyup', (e) => {
    if (!shouldInterceptReaderHotkey(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, { capture: true });

  btnPrevChap.addEventListener('click', () => {
    if (!chapterNav.prev) return;
    markFullscreenRestoreForNextChapterNavigation();
    window.location.href = chapterNav.prev;
  });
  btnPrevPage.addEventListener('click', goPrevPage);
  btnNextPage.addEventListener('click', goNextPage);
  btnTapPrevPage.addEventListener('click', handleSideTapPaging);
  btnTapPrevPage.addEventListener('pointerdown', handleSwipePointerDown);
  btnTapPrevPage.addEventListener('pointerup', handleSwipePointerUp);
  btnTapPrevPage.addEventListener('pointercancel', resetSwipeTracking);
  btnTapPrevPage.addEventListener('wheel', handleCanvasTapWheel, { passive: false });
  btnTapPrevPage.addEventListener('contextmenu', handleRightClickPrevPage);
  btnTapChrome.addEventListener('click', toggleChrome);
  btnTapChrome.addEventListener('wheel', handleCanvasTapWheel, { passive: false });
  btnTapChrome.addEventListener('contextmenu', handleRightClickPrevPage);
  btnTapNextPage.addEventListener('click', handleSideTapPaging);
  btnTapNextPage.addEventListener('pointerdown', handleSwipePointerDown);
  btnTapNextPage.addEventListener('pointerup', handleSwipePointerUp);
  btnTapNextPage.addEventListener('pointercancel', resetSwipeTracking);
  btnTapNextPage.addEventListener('wheel', handleCanvasTapWheel, { passive: false });
  btnTapNextPage.addEventListener('contextmenu', handleRightClickPrevPage);
  btnReaderSettingsAdjust.addEventListener('click', openReaderAdjust);
  btnReaderSettingsDropdown.addEventListener('click', () => {
    setReaderSettingsExpanded(!readerSettingsExpanded);
  });
  selectFontSource.addEventListener('change', () => {
    fontSource = selectFontSource.value === 'web' ? 'web' : 'local';
    syncFontSourceUi();
  });
  selectLocalFont.addEventListener('change', () => {
    if (fontSource !== 'local') return;
    const next = selectLocalFont.value;
    if (!next || next === currentReaderSettings.fontFamily) return;
    currentReaderSettings.fontFamily = next;
    updateReaderSettingsUi();
    lastCanvasW = -1;
    lastCanvasH = -1;
    render();
  });
  const applyWebFontFromInputs = async (): Promise<void> => {
    const cssUrl = inputWebFontCssUrl.value.trim();
    const family = inputWebFontFamily.value.trim();
    if (!cssUrl || !family) {
      window.alert('請輸入 Web Font 的 CSS URL 與 font-family');
      return;
    }
    if (!/^https:\/\//i.test(cssUrl)) {
      window.alert('Web Font URL 必須是 https://');
      return;
    }
    btnApplyWebFont.disabled = true;
    try {
      await applyWebFont(cssUrl, family);
    } catch {
      window.alert('Web Font 套用失敗，請確認 URL 與 font-family');
    } finally {
      btnApplyWebFont.disabled = false;
    }
  };
  fontWebControls.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const presetBtn = target?.closest<HTMLButtonElement>('.esj-font-preset-btn');
    if (!presetBtn) return;
    const presetId = presetBtn.dataset.fontPreset ?? '';
    const row = presetBtn.closest('.esj-font-preset-row');
    const weightSelect = row?.querySelector<HTMLSelectElement>('.esj-font-weight-select');
    const weight = Number(weightSelect?.value ?? 400);
    const config = getPresetWebFontConfig(presetId, weight);
    if (!config) return;
    inputWebFontCssUrl.value = config.cssUrl;
    inputWebFontFamily.value = config.family;
    void applyWebFontFromInputs();
  });
  btnApplyWebFont.addEventListener('click', () => {
    void applyWebFontFromInputs();
  });
  btnProfileDropdown.addEventListener('click', () => {
    setProfileExpanded(!profileExpanded);
  });
  btnProfileSave.addEventListener('click', saveReaderProfile);
  btnProfileRestore.addEventListener('click', () => {
    const changed = loadSavedReaderProfile();
    if (!hasSavedProfile) {
      window.alert('尚未儲存設定檔');
      return;
    }
    if (!changed) return;
    lastCanvasW = -1;
    lastCanvasH = -1;
    render();
  });
  function applyReaderSettingFromSlider(key: keyof typeof readerLimits, rawValue: number): void {
    const limits = readerLimits[key];
    if (!Number.isFinite(rawValue)) return;
    const next = clamp(roundByStep(rawValue, limits.step), limits.min, limits.max);
    if (next === currentReaderSettings[key]) return;
    currentReaderSettings[key] = next;
    updateReaderSettingsUi();
    if (!previewFromAdjust) {
      lastCanvasW = -1;
      lastCanvasH = -1;
    }
    render();
  }
  function bindAdjustRow(
    key: keyof typeof readerLimits,
    decBtn: HTMLButtonElement,
    incBtn: HTMLButtonElement,
    rangeEl: HTMLInputElement,
  ): void {
    decBtn.addEventListener('click', () => {
      adjustReaderSetting(key, -readerLimits[key].step);
    });
    incBtn.addEventListener('click', () => {
      adjustReaderSetting(key, readerLimits[key].step);
    });
    rangeEl.addEventListener('input', () => {
      applyReaderSettingFromSlider(key, Number(rangeEl.value));
    });
  }
  bindAdjustRow('fontSize', btnReaderAdjustFontDec, btnReaderAdjustFontInc, rangeReaderAdjustFont);
  bindAdjustRow('lineHeight', btnReaderAdjustLineHeightDec, btnReaderAdjustLineHeightInc, rangeReaderAdjustLineHeight);
  bindAdjustRow('paragraphSpacing', btnReaderAdjustParaSpacingDec, btnReaderAdjustParaSpacingInc, rangeReaderAdjustParaSpacing);
  bindAdjustRow('pagePaddingX', btnReaderAdjustPagePaddingXDec, btnReaderAdjustPagePaddingXInc, rangeReaderAdjustPagePaddingX);
  bindAdjustRow('pagePaddingY', btnReaderAdjustPagePaddingYDec, btnReaderAdjustPagePaddingYInc, rangeReaderAdjustPagePaddingY);
  bindAdjustRow('pageMaxWidth', btnReaderAdjustPageMaxWidthDec, btnReaderAdjustPageMaxWidthInc, rangeReaderAdjustPageMaxWidth);
  btnReaderAdjustRemoveSingleEmpty.addEventListener('click', toggleRemoveSingleEmptyParagraph);
  btnReaderAdjustApply.addEventListener('click', () => {
    finalizeReaderAdjustRebuild();
    closeReaderAdjust(true);
  });
  btnNextChap.addEventListener('click', () => {
    if (!chapterNav.next) return;
    markFullscreenRestoreForNextChapterNavigation();
    window.location.href = chapterNav.next;
  });

  updateRemoveSingleEmptyParagraphUi();
  loadSavedReaderProfile();
  loadSavedPageIndex();
  loadFullscreenRestoreFlag();
  const savedWebFont = loadWebFontConfig();
  if (savedWebFont) {
    inputWebFontCssUrl.value = savedWebFont.cssUrl;
    inputWebFontFamily.value = savedWebFont.family;
  }
  setReaderSettingsExpanded(false);
  setProfileExpanded(false);
  updateProfileUi();
  syncFontSourceUi();
  updateReaderSettingsUi();
  updateResponsiveChrome();
  readerRoot.addEventListener('pointerdown', restoreFullscreenOnFirstTap, { capture: true });
  document.addEventListener('fullscreenchange', syncHeaderFullscreenUi);
  syncHeaderFullscreenUi();
  render();
  window.addEventListener('resize', render);
}

main();
