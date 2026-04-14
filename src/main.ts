import { extractBlocksFromHtml, extractCommentBlocksFromHtml } from './extract';
import { buildPageStarts, clearCharWidthCache, walkOnePage, type Cursor, type PageLayout } from './pagination';
import {
  getAdjacentChapterHrefs,
  getChapterTitle,
  getCommentsRoot,
  getForumContent,
  getNovelDetailHref,
  getNovelId,
} from './site';
import type { Block } from './types';
import { createReaderDom } from './reader/dom';
import { drawBottomMetadata } from './reader/renderCanvas';
import {
  getChromePreset,
  getChromeSettingsForPreset,
  type ReaderSettings,
  type ChromeSettings,
} from './reader/settings';
import { buildReaderStyles } from './reader/styles';
import { createReaderState, READER_LIMITS, type ChapterNav, type ImageCacheEntry, type ReaderState } from './readerState';
import { roundByStep, clamp, findPageIndexByCursor, formatLineHeight, safeNum, clampSetting, applyEmptyParagraphFilter } from './utils';
import {
  saveWebFontConfig,
  loadWebFontConfig,
  loadSavedPageIndex,
  saveCurrentPageIndex as storeSaveCurrentPageIndex,
  saveReaderProfile as storeSaveReaderProfile,
  loadReaderProfileRaw,
  markFullscreenRestore,
  loadFullscreenRestoreFlag,
  clearFullscreenRestoreFlag,
} from './storage';
import {
  LOCAL_FONT_OPTIONS,
  isAnyFontFamilyAvailable,
  getPresetWebFontConfig,
  ensureWebFontStylesheet,
  loadWebFont,
} from './fonts';

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

  const eventAc = new AbortController();
  const eventSignal = eventAc.signal;

  const restorePageScroll = (): void => {
    eventAc.abort();
    rootEl.style.overflow = prevRootOverflow;
    bodyEl.style.overflow = prevBodyOverflow;
  };
  window.addEventListener('pagehide', restorePageScroll, { once: true });

  const s: ReaderState = createReaderState(blocks);
  const novelId = getNovelId();
  const chapterKey = `${window.location.pathname}${window.location.search}`;

  // --- Font source select setup ---
  const sourceLocalOption = document.createElement('option');
  sourceLocalOption.value = 'local';
  sourceLocalOption.textContent = '本機字體';
  selectFontSource.appendChild(sourceLocalOption);
  const sourceWebOption = document.createElement('option');
  sourceWebOption.value = 'web';
  sourceWebOption.textContent = 'Web Font';
  selectFontSource.appendChild(sourceWebOption);
  selectFontSource.value = 'local';

  for (const option of LOCAL_FONT_OPTIONS) {
    if (option.detectFamilies && !isAnyFontFamilyAvailable(option.detectFamilies)) continue;
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    selectLocalFont.appendChild(el);
  }

  // --- UI sync helpers ---

  function syncFontSourceUi(): void {
    selectFontSource.value = s.fontSource;
    selectLocalFont.disabled = s.fontSource !== 'local';
    fontLocalRow.classList.toggle('hidden', s.fontSource !== 'local');
    fontWebControls.classList.toggle('open', s.fontSource === 'web');
  }

  function syncLocalFontSelectUi(): void {
    const match = LOCAL_FONT_OPTIONS.find((opt) => opt.value === s.currentReaderSettings.fontFamily);
    if (match) {
      selectLocalFont.value = match.value;
      return;
    }
    selectLocalFont.value = '';
  }

  function syncReaderAdjustUi(): void {
    function syncOne(
      key: keyof typeof READER_LIMITS,
      valueEl: HTMLSpanElement,
      rangeEl: HTMLInputElement,
      decBtn: HTMLButtonElement,
      incBtn: HTMLButtonElement,
    ): void {
      const limits = READER_LIMITS[key];
      const value = s.currentReaderSettings[key];
      valueEl.textContent = key === 'lineHeight' ? formatLineHeight(value) : String(value);
      rangeEl.min = String(limits.min);
      rangeEl.max = String(limits.max);
      rangeEl.step = String(limits.step);
      rangeEl.value = String(value);
      decBtn.disabled = value <= limits.min;
      incBtn.disabled = value >= limits.max;
    }
    syncOne('fontSize', readerAdjustFontValue, rangeReaderAdjustFont, btnReaderAdjustFontDec, btnReaderAdjustFontInc);
    syncOne('lineHeight', readerAdjustLineHeightValue, rangeReaderAdjustLineHeight, btnReaderAdjustLineHeightDec, btnReaderAdjustLineHeightInc);
    syncOne('paragraphSpacing', readerAdjustParaSpacingValue, rangeReaderAdjustParaSpacing, btnReaderAdjustParaSpacingDec, btnReaderAdjustParaSpacingInc);
    syncOne('pagePaddingX', readerAdjustPagePaddingXValue, rangeReaderAdjustPagePaddingX, btnReaderAdjustPagePaddingXDec, btnReaderAdjustPagePaddingXInc);
    syncOne('pagePaddingY', readerAdjustPagePaddingYValue, rangeReaderAdjustPagePaddingY, btnReaderAdjustPagePaddingYDec, btnReaderAdjustPagePaddingYInc);
    syncOne('pageMaxWidth', readerAdjustPageMaxWidthValue, rangeReaderAdjustPageMaxWidth, btnReaderAdjustPageMaxWidthDec, btnReaderAdjustPageMaxWidthInc);
  }

  function updateReaderSettingsUi(): void {
    readerSettingFontValue.textContent = `${s.currentReaderSettings.fontSize}`;
    readerSettingLineHeightValue.textContent = formatLineHeight(s.currentReaderSettings.lineHeight);
    readerSettingParaSpacingValue.textContent = `${s.currentReaderSettings.paragraphSpacing}`;
    readerSettingPagePaddingXValue.textContent = `${s.currentReaderSettings.pagePaddingX}`;
    readerSettingPagePaddingYValue.textContent = `${s.currentReaderSettings.pagePaddingY}`;
    readerSettingPageMaxWidthValue.textContent = `${s.currentReaderSettings.pageMaxWidth}`;
    syncLocalFontSelectUi();
    syncReaderAdjustUi();
    btnProfileRestore.disabled = !s.hasSavedProfile;
  }

  function updateProfileUi(): void {
    if (!s.savedProfile) {
      profileFontValue.textContent = '-';
      profileLineHeightValue.textContent = '-';
      profileParaSpacingValue.textContent = '-';
      profilePagePaddingXValue.textContent = '-';
      profilePagePaddingYValue.textContent = '-';
      profilePageMaxWidthValue.textContent = '-';
      profileRemoveSingleEmptyValue.textContent = '-';
      return;
    }
    profileFontValue.textContent = String(s.savedProfile.fontSize);
    profileLineHeightValue.textContent = formatLineHeight(s.savedProfile.lineHeight);
    profileParaSpacingValue.textContent = String(s.savedProfile.paragraphSpacing);
    profilePagePaddingXValue.textContent = String(s.savedProfile.pagePaddingX);
    profilePagePaddingYValue.textContent = String(s.savedProfile.pagePaddingY);
    profilePageMaxWidthValue.textContent = String(s.savedProfile.pageMaxWidth);
    profileRemoveSingleEmptyValue.textContent = s.savedProfile.removeSingleEmptyParagraph ? 'ON' : 'OFF';
  }

  function updateRemoveSingleEmptyParagraphUi(): void {
    readerRemoveSingleEmptyValue.textContent = s.removeSingleEmptyParagraph ? 'ON' : 'OFF';
    btnReaderAdjustRemoveSingleEmpty.setAttribute('aria-pressed', s.removeSingleEmptyParagraph ? 'true' : 'false');
    iconReaderAdjustRemoveSingleEmptyCheckEl.style.display = s.removeSingleEmptyParagraph ? '' : 'none';
  }

  function setProfileExpanded(expanded: boolean): void {
    s.profileExpanded = expanded;
    btnProfileDropdown.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    profileContent.classList.toggle('open', expanded);
    iconProfileChevronDownEl.style.display = expanded ? 'none' : '';
    iconProfileChevronUpEl.style.display = expanded ? '' : 'none';
  }

  function setReaderSettingsExpanded(expanded: boolean): void {
    s.readerSettingsExpanded = expanded;
    btnReaderSettingsDropdown.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    readerSettingsContent.classList.toggle('open', expanded);
    iconReaderSettingsChevronDownEl.style.display = expanded ? 'none' : '';
    iconReaderSettingsChevronUpEl.style.display = expanded ? '' : 'none';
  }

  // --- Storage bridge functions ---

  function saveReaderProfile(): void {
    const payload = {
      fontFamily: s.currentReaderSettings.fontFamily,
      fontSize: s.currentReaderSettings.fontSize,
      lineHeight: s.currentReaderSettings.lineHeight,
      paragraphSpacing: s.currentReaderSettings.paragraphSpacing,
      pagePaddingX: s.currentReaderSettings.pagePaddingX,
      pagePaddingY: s.currentReaderSettings.pagePaddingY,
      pageMaxWidth: s.currentReaderSettings.pageMaxWidth,
      removeSingleEmptyParagraph: s.removeSingleEmptyParagraph,
    };
    try {
      storeSaveReaderProfile(payload);
      s.savedProfile = { ...payload };
      s.hasSavedProfile = true;
      updateProfileUi();
      updateReaderSettingsUi();
    } catch {
      window.alert('儲存設定檔失敗');
    }
  }

  function loadSavedReaderProfile(): boolean {
    const p = loadReaderProfileRaw();
    if (!p) {
      s.savedProfile = null;
      s.hasSavedProfile = false;
      updateProfileUi();
      return false;
    }
    let changed = false;

    const pFontFamily = typeof p.fontFamily === 'string' && p.fontFamily.trim() ? p.fontFamily : null;
    if (pFontFamily && s.currentReaderSettings.fontFamily !== pFontFamily) {
      s.currentReaderSettings.fontFamily = pFontFamily;
      changed = true;
    }

    for (const key of Object.keys(READER_LIMITS) as (keyof typeof READER_LIMITS)[]) {
      const next = clampSetting(key, safeNum(p[key]));
      if (next === null || s.currentReaderSettings[key] === next) continue;
      s.currentReaderSettings[key] = next;
      changed = true;
    }

    const pRemove = typeof p.removeSingleEmptyParagraph === 'boolean' ? p.removeSingleEmptyParagraph : null;
    if (pRemove !== null && s.removeSingleEmptyParagraph !== pRemove) {
      s.removeSingleEmptyParagraph = pRemove;
      updateRemoveSingleEmptyParagraphUi();
      s.pagedBlocks = applyEmptyParagraphFilter(blocks, s.removeSingleEmptyParagraph);
      changed = true;
    }

    s.savedProfile = {
      fontFamily: pFontFamily ?? s.currentReaderSettings.fontFamily,
      fontSize: clampSetting('fontSize', safeNum(p.fontSize)) ?? s.currentReaderSettings.fontSize,
      lineHeight: clampSetting('lineHeight', safeNum(p.lineHeight)) ?? s.currentReaderSettings.lineHeight,
      paragraphSpacing: clampSetting('paragraphSpacing', safeNum(p.paragraphSpacing)) ?? s.currentReaderSettings.paragraphSpacing,
      pagePaddingX: clampSetting('pagePaddingX', safeNum(p.pagePaddingX)) ?? s.currentReaderSettings.pagePaddingX,
      pagePaddingY: clampSetting('pagePaddingY', safeNum(p.pagePaddingY)) ?? s.currentReaderSettings.pagePaddingY,
      pageMaxWidth: clampSetting('pageMaxWidth', safeNum(p.pageMaxWidth)) ?? s.currentReaderSettings.pageMaxWidth,
      removeSingleEmptyParagraph: pRemove ?? s.removeSingleEmptyParagraph,
    };
    s.hasSavedProfile = true;
    updateProfileUi();
    updateReaderSettingsUi();
    return changed;
  }

  function saveCurrentPageIndex(): void {
    if (s.pageStarts.length === 0) return;
    if (s.pageIndex === s.lastSavedPageIndex) return;
    storeSaveCurrentPageIndex(novelId, chapterKey, s.pageIndex);
    s.lastSavedPageIndex = s.pageIndex;
  }

  // --- Web font ---

  async function applyWebFont(cssUrl: string, family: string): Promise<void> {
    s.webFontLinkEl = ensureWebFontStylesheet(cssUrl, s.webFontLinkEl);
    await loadWebFont(cssUrl, family);
    s.currentReaderSettings.fontFamily = family;
    s.fontSource = 'web';
    syncFontSourceUi();
    updateReaderSettingsUi();
    clearCharWidthCache();
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
    render();
    saveWebFontConfig({ cssUrl, family });
  }

  // --- Drawer ---

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

  // --- Fullscreen ---

  function restoreFullscreenOnFirstTap(): void {
    if (!s.shouldRestoreFullscreenOnNextTap) return;
    if (document.fullscreenElement) {
      s.shouldRestoreFullscreenOnNextTap = false;
      clearFullscreenRestoreFlag();
      return;
    }
    s.shouldRestoreFullscreenOnNextTap = false;
    clearFullscreenRestoreFlag();
    void readerRoot.requestFullscreen().catch(() => {});
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
      void document.exitFullscreen().catch(() => {});
      return;
    }
    void readerRoot.requestFullscreen().catch(() => {});
  }

  // --- Image cache ---

  function ensureImage(src: string): ImageCacheEntry {
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

  // --- Chrome ---

  function setIconSize(el: SVGElement | null, size: number): void {
    if (!el) return;
    el.setAttribute('width', String(size));
    el.setAttribute('height', String(size));
  }

  function applyChromeSettings(settings: ChromeSettings): void {
    s.activeChromeSettings = settings;
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
    readerRoot.classList.toggle('esj-chrome-hidden', !s.chromeVisible);
  }

  function updateResponsiveChrome(): void {
    const preset = getChromePreset(window.innerWidth);
    if (preset === s.activeChromePreset) return;
    s.activeChromePreset = preset;
    applyChromeSettings(getChromeSettingsForPreset(preset));
    syncCanvasTapLayerLayout();
  }

  function updatePageChrome(): void {
    const total = s.pageStarts.length;
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
    footerPageCur.textContent = String(s.pageIndex + 1);
    footerPageTotal.textContent = String(total);
    btnFooterPageJump.disabled = false;
    pageJumpTotalEl.textContent = String(total);
    pageJumpInput.max = String(total);
    pageJumpInput.min = '1';
    btnPrevPage.disabled = s.pageIndex <= 0;
    btnNextPage.disabled = s.pageIndex >= total - 1;
  }

  function toggleChrome(): void {
    s.chromeVisible = !s.chromeVisible;
    applyChromeVisibility();
    syncCanvasTapLayerLayout();
  }

  // --- Canvas tap layer ---

  function syncCanvasTapLayerLayout(): void {
    const wrapRect = canvasWrap.getBoundingClientRect();
    const w = wrapRect.width;
    if (w <= 0) return;
    const topPx = s.chromeVisible ? s.activeChromeSettings.headerHeight : 0;
    const bottomPx = s.chromeVisible ? s.activeChromeSettings.footerHeight : 0;
    let leftW: number, midLeft: number, midW: number, rightStart: number, rightW: number;
    if (s.chromeVisible) {
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
    const total = s.pageStarts.length;
    btnTapPrevPage.disabled = !(total > 0 && (s.pageIndex > 0 || Boolean(chapterNav.prev)));
    btnTapNextPage.disabled = !(total > 0 && (s.pageIndex < total - 1 || Boolean(chapterNav.next)));
  }

  // --- Page navigation ---

  function goPrevPage(): void {
    if (s.pageIndex > 0) { s.pageIndex -= 1; render(); }
  }

  function goNextPage(): void {
    if (s.pageIndex < s.pageStarts.length - 1) { s.pageIndex += 1; render(); }
  }

  function confirmGoPrevChapter(): void {
    if (!chapterNav.prev) return;
    if (window.confirm('已在第一頁，是否前往上一章？')) {
      markFullscreenRestore();
      window.location.href = chapterNav.prev;
    }
  }

  function confirmGoNextChapter(): void {
    if (!chapterNav.next) return;
    if (window.confirm('已在最後一頁，是否前往下一章？')) {
      markFullscreenRestore();
      window.location.href = chapterNav.next;
    }
  }

  // --- Reader adjust panel ---

  function adjustReaderSetting(
    key: keyof Pick<ReaderSettings, 'fontSize' | 'lineHeight' | 'paragraphSpacing' | 'pagePaddingX' | 'pagePaddingY' | 'pageMaxWidth'>,
    delta: number,
  ): void {
    const limits = READER_LIMITS[key];
    const next = clamp(roundByStep((s.currentReaderSettings[key] as number) + delta, limits.step), limits.min, limits.max);
    if (next === s.currentReaderSettings[key]) return;
    s.currentReaderSettings[key] = next;
    updateReaderSettingsUi();
    if (!s.previewFromAdjust) { s.lastCanvasW = -1; s.lastCanvasH = -1; }
    render();
  }

  function finalizeReaderAdjustRebuild(): void {
    const anchor = s.adjustAnchorCursor;
    s.previewFromAdjust = false;
    s.adjustAnchorCursor = null;
    if (!anchor) return;
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
    render();
    if (s.pageStarts.length > 0) {
      s.pageIndex = findPageIndexByCursor(s.pageStarts, anchor);
      render();
    }
  }

  function closeReaderAdjust(restoreChrome = false): void {
    if (s.previewFromAdjust) finalizeReaderAdjustRebuild();
    readerAdjustOverlay.classList.remove('open');
    readerAdjustOverlay.setAttribute('aria-hidden', 'true');
    if (restoreChrome && !s.chromeVisible) {
      s.chromeVisible = true;
      applyChromeVisibility();
      syncCanvasTapLayerLayout();
    }
    openDrawer();
  }

  function openReaderAdjust(): void {
    closeDrawer();
    if (s.chromeVisible) {
      s.chromeVisible = false;
      applyChromeVisibility();
      syncCanvasTapLayerLayout();
    }
    s.adjustAnchorCursor = s.pageStarts[s.pageIndex] ? { ...s.pageStarts[s.pageIndex] } : { bi: 0, off: 0 };
    s.previewFromAdjust = true;
    syncReaderAdjustUi();
    readerAdjustOverlay.classList.add('open');
    readerAdjustOverlay.setAttribute('aria-hidden', 'false');
  }

  function toggleRemoveSingleEmptyParagraph(): void {
    s.removeSingleEmptyParagraph = !s.removeSingleEmptyParagraph;
    updateRemoveSingleEmptyParagraphUi();
    s.pagedBlocks = applyEmptyParagraphFilter(blocks, s.removeSingleEmptyParagraph);
    if (!s.previewFromAdjust) { s.pageIndex = 0; s.lastCanvasW = -1; s.lastCanvasH = -1; }
    render();
  }

  // --- Page jump ---

  function closePageJump(): void {
    pageJumpOverlay.classList.remove('open');
    pageJumpOverlay.setAttribute('aria-hidden', 'true');
    pageJumpInput.blur();
  }

  function openPageJump(): void {
    const total = s.pageStarts.length;
    if (total === 0) return;
    pageJumpInput.value = String(s.pageIndex + 1);
    pageJumpTotalEl.textContent = String(total);
    pageJumpInput.min = '1';
    pageJumpInput.max = String(total);
    pageJumpOverlay.classList.add('open');
    pageJumpOverlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => { pageJumpInput.focus(); pageJumpInput.select(); });
  }

  function submitPageJump(): void {
    const total = s.pageStarts.length;
    if (total === 0) return;
    const raw = parseInt(String(pageJumpInput.value), 10);
    if (Number.isNaN(raw)) { closePageJump(); return; }
    s.pageIndex = Math.max(1, Math.min(total, raw)) - 1;
    closePageJump();
    render();
  }

  // --- Input handlers ---

  function handleSideTapPaging(): void {
    if (s.suppressNextSideTap) { s.suppressNextSideTap = false; return; }
    if (s.pageIndex >= s.pageStarts.length - 1) confirmGoNextChapter();
    else goNextPage();
  }

  function handleSwipePointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    s.swipeStartX = e.clientX;
    s.swipeStartY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function resetSwipeTracking(): void {
    s.swipeStartX = null;
    s.swipeStartY = null;
  }

  function handleSwipePointerUp(e: PointerEvent): void {
    if (s.swipeStartX === null || s.swipeStartY === null) return;
    const dx = e.clientX - s.swipeStartX;
    const dy = e.clientY - s.swipeStartY;
    resetSwipeTracking();
    const swipeThresholdPx = 36;
    if (Math.abs(dx) < swipeThresholdPx) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    s.suppressNextSideTap = true;
    if (dx < 0) {
      if (s.pageIndex >= s.pageStarts.length - 1) confirmGoNextChapter();
      else goNextPage();
      return;
    }
    if (s.pageIndex <= 0) confirmGoPrevChapter();
    else goPrevPage();
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
    if (s.pageIndex <= 0) { confirmGoPrevChapter(); return; }
    goPrevPage();
  }

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
      if (drawerOverlay.classList.contains('open')) { closeDrawer(); return; }
      if (pageJumpOverlay.classList.contains('open')) { closePageJump(); return; }
      if (readerAdjustOverlay.classList.contains('open')) { closeReaderAdjust(); return; }
      if (!s.chromeVisible) { s.chromeVisible = true; applyChromeVisibility(); syncCanvasTapLayerLayout(); }
      return;
    }
    if (!shouldInterceptReaderHotkey(e)) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (s.pageIndex <= 0) confirmGoPrevChapter(); else goPrevPage();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (s.pageIndex >= s.pageStarts.length - 1) confirmGoNextChapter(); else goNextPage();
      return;
    }
    if (e.key.toLowerCase() === 'f') {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      toggleFullscreen();
    }
  };

  // --- Render ---

  function render(): void {
    updateResponsiveChrome();
    const dpr = window.devicePixelRatio || 1;
    const width = canvasWrap.clientWidth;
    const viewportHeight = canvasWrap.clientHeight;
    if (width === 0 || viewportHeight === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const maxHeight = Math.max(0, viewportHeight - s.currentReaderSettings.pagePaddingY * 2);
    const availableTextWidth = Math.max(0, width - s.currentReaderSettings.pagePaddingX * 2);
    const textWidth = Math.min(availableTextWidth, s.currentReaderSettings.pageMaxWidth);
    const textLeft = Math.max(0, Math.floor((width - textWidth) / 2));
    const linePx = s.currentReaderSettings.fontSize * s.currentReaderSettings.lineHeight;
    const layout: PageLayout = {
      padX: s.currentReaderSettings.pagePaddingX,
      padY: s.currentReaderSettings.pagePaddingY,
      textLeft, textWidth, maxWidth: textWidth, maxHeight, linePx,
      paraSpacing: s.currentReaderSettings.paragraphSpacing,
    };
    const useAdjustPreview = s.previewFromAdjust && s.adjustAnchorCursor !== null;
    const sameSize = !useAdjustPreview && s.pageStarts.length > 0 && width === s.lastCanvasW && viewportHeight === s.lastCanvasH;
    if (!sameSize) {
      if (!useAdjustPreview) {
        s.pageStarts = buildPageStarts(ctx, s.pagedBlocks, layout, { imagePlaceholderText: '【圖】', getImageRenderInfo });
        s.lastCanvasW = width;
        s.lastCanvasH = viewportHeight;
        if (s.pendingRestorePageIndex !== null) { s.pageIndex = s.pendingRestorePageIndex; s.pendingRestorePageIndex = null; }
        s.pageIndex = Math.min(s.pageIndex, Math.max(0, s.pageStarts.length - 1));
      }
    }
    updatePageChrome();
    syncCanvasTapLayerLayout();
    if (!useAdjustPreview) saveCurrentPageIndex();
    const startCursor = useAdjustPreview ? s.adjustAnchorCursor : s.pageStarts[s.pageIndex];
    if (!startCursor) return;
    if (!useAdjustPreview && s.pageStarts.length === 0) return;
    let drawHeight = viewportHeight;
    const startBlock = s.pagedBlocks[startCursor.bi];
    if (startBlock?.type === 'img') {
      const info = getImageRenderInfo(startBlock.src, layout.maxWidth);
      if (info.ready && info.drawHeight > layout.maxHeight) drawHeight = s.currentReaderSettings.pagePaddingY * 2 + info.drawHeight;
    }
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(drawHeight * dpr);
    canvas.style.height = `${drawHeight}px`;
    canvasWrap.style.overflowY = drawHeight > viewportHeight ? 'auto' : 'hidden';
    if (s.pageIndex !== s.lastRenderedPageIndex) { canvasWrap.scrollTop = 0; s.lastRenderedPageIndex = s.pageIndex; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, drawHeight);
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'top';
    ctx.font = `${s.currentReaderSettings.fontSize}px ${s.currentReaderSettings.fontFamily}`;
    walkOnePage(ctx, s.pagedBlocks, startCursor, layout, true, {
      imagePlaceholderText: '【圖】',
      getImageRenderInfo,
      drawImage: (src, x, y, w, h) => {
        const entry = ensureImage(src);
        if (entry.status !== 'loaded') { ctx.fillText('【圖】', x, y); return; }
        ctx.drawImage(entry.img, x, y, w, h);
      },
    });
    drawBottomMetadata(ctx, drawHeight, title, `${s.pageIndex + 1} / ${s.pageStarts.length}`, s.currentReaderSettings, textLeft, textWidth);
  }

  // --- Event binding ---

  btnHeaderMenu.addEventListener('click', () => {
    if (drawerOverlay.classList.contains('open')) closeDrawer(); else openDrawer();
  });
  btnHeaderFullscreen.addEventListener('click', toggleFullscreen);
  drawerBackdrop.addEventListener('click', closeDrawer);
  btnFooterPageJump.addEventListener('click', openPageJump);
  pageJumpBackdrop.addEventListener('click', closePageJump);
  pageJumpCancel.addEventListener('click', closePageJump);
  pageJumpOk.addEventListener('click', submitPageJump);
  pageJumpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitPageJump(); } });
  pageJumpPanel.addEventListener('click', (e) => { e.stopPropagation(); });
  readerAdjustBackdrop.addEventListener('click', () => { closeReaderAdjust(true); });
  readerAdjustPanel.addEventListener('click', (e) => { e.stopPropagation(); });

  window.addEventListener('keydown', handleReaderHotkeys, { capture: true, signal: eventSignal });
  window.addEventListener('keyup', (e) => {
    if (!shouldInterceptReaderHotkey(e)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  }, { capture: true, signal: eventSignal });

  btnPrevChap.addEventListener('click', () => {
    if (!chapterNav.prev) return;
    markFullscreenRestore();
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
  btnReaderSettingsDropdown.addEventListener('click', () => { setReaderSettingsExpanded(!s.readerSettingsExpanded); });
  selectFontSource.addEventListener('change', () => {
    s.fontSource = selectFontSource.value === 'web' ? 'web' : 'local';
    syncFontSourceUi();
  });
  selectLocalFont.addEventListener('change', () => {
    if (s.fontSource !== 'local') return;
    const next = selectLocalFont.value;
    if (!next || next === s.currentReaderSettings.fontFamily) return;
    s.currentReaderSettings.fontFamily = next;
    updateReaderSettingsUi();
    clearCharWidthCache();
    s.lastCanvasW = -1; s.lastCanvasH = -1;
    render();
  });
  const applyWebFontFromInputs = async (): Promise<void> => {
    const cssUrl = inputWebFontCssUrl.value.trim();
    const family = inputWebFontFamily.value.trim();
    if (!cssUrl || !family) { window.alert('請輸入 Web Font 的 CSS URL 與 font-family'); return; }
    if (!/^https:\/\//i.test(cssUrl)) { window.alert('Web Font URL 必須是 https://'); return; }
    btnApplyWebFont.disabled = true;
    try { await applyWebFont(cssUrl, family); }
    catch { window.alert('Web Font 套用失敗，請確認 URL 與 font-family'); }
    finally { btnApplyWebFont.disabled = false; }
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
  btnApplyWebFont.addEventListener('click', () => { void applyWebFontFromInputs(); });
  btnProfileDropdown.addEventListener('click', () => { setProfileExpanded(!s.profileExpanded); });
  btnProfileSave.addEventListener('click', saveReaderProfile);
  btnProfileRestore.addEventListener('click', () => {
    const changed = loadSavedReaderProfile();
    if (!s.hasSavedProfile) { window.alert('尚未儲存設定檔'); return; }
    if (!changed) return;
    clearCharWidthCache();
    s.lastCanvasW = -1; s.lastCanvasH = -1;
    render();
  });
  function applyReaderSettingFromSlider(key: keyof typeof READER_LIMITS, rawValue: number): void {
    const limits = READER_LIMITS[key];
    if (!Number.isFinite(rawValue)) return;
    const next = clamp(roundByStep(rawValue, limits.step), limits.min, limits.max);
    if (next === s.currentReaderSettings[key]) return;
    s.currentReaderSettings[key] = next;
    updateReaderSettingsUi();
    if (!s.previewFromAdjust) { s.lastCanvasW = -1; s.lastCanvasH = -1; }
    render();
  }
  function bindAdjustRow(key: keyof typeof READER_LIMITS, decBtn: HTMLButtonElement, incBtn: HTMLButtonElement, rangeEl: HTMLInputElement): void {
    decBtn.addEventListener('click', () => { adjustReaderSetting(key, -READER_LIMITS[key].step); });
    incBtn.addEventListener('click', () => { adjustReaderSetting(key, READER_LIMITS[key].step); });
    rangeEl.addEventListener('input', () => { applyReaderSettingFromSlider(key, Number(rangeEl.value)); });
  }
  bindAdjustRow('fontSize', btnReaderAdjustFontDec, btnReaderAdjustFontInc, rangeReaderAdjustFont);
  bindAdjustRow('lineHeight', btnReaderAdjustLineHeightDec, btnReaderAdjustLineHeightInc, rangeReaderAdjustLineHeight);
  bindAdjustRow('paragraphSpacing', btnReaderAdjustParaSpacingDec, btnReaderAdjustParaSpacingInc, rangeReaderAdjustParaSpacing);
  bindAdjustRow('pagePaddingX', btnReaderAdjustPagePaddingXDec, btnReaderAdjustPagePaddingXInc, rangeReaderAdjustPagePaddingX);
  bindAdjustRow('pagePaddingY', btnReaderAdjustPagePaddingYDec, btnReaderAdjustPagePaddingYInc, rangeReaderAdjustPagePaddingY);
  bindAdjustRow('pageMaxWidth', btnReaderAdjustPageMaxWidthDec, btnReaderAdjustPageMaxWidthInc, rangeReaderAdjustPageMaxWidth);
  btnReaderAdjustRemoveSingleEmpty.addEventListener('click', toggleRemoveSingleEmptyParagraph);
  btnReaderAdjustApply.addEventListener('click', () => { finalizeReaderAdjustRebuild(); closeReaderAdjust(true); });
  btnNextChap.addEventListener('click', () => {
    if (!chapterNav.next) return;
    markFullscreenRestore();
    window.location.href = chapterNav.next;
  });

  // --- Init ---

  updateRemoveSingleEmptyParagraphUi();
  loadSavedReaderProfile();
  s.pendingRestorePageIndex = loadSavedPageIndex(novelId, chapterKey);
  s.shouldRestoreFullscreenOnNextTap = loadFullscreenRestoreFlag();
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
  readerRoot.addEventListener('pointerdown', restoreFullscreenOnFirstTap, { capture: true, signal: eventSignal });
  document.addEventListener('fullscreenchange', syncHeaderFullscreenUi, { signal: eventSignal });
  syncHeaderFullscreenUi();
  render();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 150);
  }, { signal: eventSignal });
}

main();
