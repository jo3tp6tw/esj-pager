import { extractBlocksFromHtml } from './extract';
import { buildPageStarts, walkOnePage, type Cursor, type PageLayout } from './pagination';
import {
  getAdjacentChapterHrefs,
  getChapterTitle,
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

function main(): void {
  const root = getForumContent();
  if (!root) return;

  const title = getChapterTitle();
  const blocks = extractBlocksFromHtml(root.innerHTML);
  const chapterNav = getAdjacentChapterHrefs();
  const novelDetailHref = getNovelDetailHref();
  mountReader(title, blocks, chapterNav, novelDetailHref);
  console.info('[esj-pager]', title, 'blocks:', blocks.length);
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
    headerPageLabel,
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
    readerSettingPagePaddingValue,
    btnReaderFontDec,
    btnReaderFontInc,
    btnReaderLineHeightDec,
    btnReaderLineHeightInc,
    btnReaderParaSpacingDec,
    btnReaderParaSpacingInc,
    btnReaderPagePaddingDec,
    btnReaderPagePaddingInc,
    btnRemoveSingleEmptyParagraph,
    iconRemoveSingleEmptyOffEl,
    iconRemoveSingleEmptyOnEl,
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

  let pageStarts: Cursor[] = [];
  let pageIndex = 0;
  let lastCanvasW = -1;
  let lastCanvasH = -1;
  let chromeVisible = true;
  let activeChromePreset: ChromePreset | null = null;
  let activeChromeSettings: ChromeSettings = chromeSettingsTablet;
  let pendingTapNextTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTapTs = 0;
  let removeSingleEmptyParagraph = false;
  let pagedBlocks: Block[] = blocks;
  const currentReaderSettings: ReaderSettings = { ...readerSettings };

  const readerLimits = {
    fontSize: { min: 18, max: 40, step: 1 },
    lineHeight: { min: 1.2, max: 2.4, step: 0.05 },
    paragraphSpacing: { min: 0, max: 36, step: 2 },
    pagePadding: { min: 8, max: 48, step: 2 },
  };

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

  function formatLineHeight(v: number): string {
    return Number(v.toFixed(2)).toString();
  }

  function updateReaderSettingsUi(): void {
    readerSettingFontValue.textContent = `${currentReaderSettings.fontSize}`;
    readerSettingLineHeightValue.textContent = formatLineHeight(currentReaderSettings.lineHeight);
    readerSettingParaSpacingValue.textContent = `${currentReaderSettings.paragraphSpacing}`;
    readerSettingPagePaddingValue.textContent = `${currentReaderSettings.pagePadding}`;

    btnReaderFontDec.disabled = currentReaderSettings.fontSize <= readerLimits.fontSize.min;
    btnReaderFontInc.disabled = currentReaderSettings.fontSize >= readerLimits.fontSize.max;

    btnReaderLineHeightDec.disabled = currentReaderSettings.lineHeight <= readerLimits.lineHeight.min;
    btnReaderLineHeightInc.disabled = currentReaderSettings.lineHeight >= readerLimits.lineHeight.max;

    btnReaderParaSpacingDec.disabled =
      currentReaderSettings.paragraphSpacing <= readerLimits.paragraphSpacing.min;
    btnReaderParaSpacingInc.disabled =
      currentReaderSettings.paragraphSpacing >= readerLimits.paragraphSpacing.max;

    btnReaderPagePaddingDec.disabled = currentReaderSettings.pagePadding <= readerLimits.pagePadding.min;
    btnReaderPagePaddingInc.disabled = currentReaderSettings.pagePadding >= readerLimits.pagePadding.max;
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
    btnRemoveSingleEmptyParagraph.setAttribute('aria-pressed', removeSingleEmptyParagraph ? 'true' : 'false');
    iconRemoveSingleEmptyOffEl.style.display = removeSingleEmptyParagraph ? 'none' : '';
    iconRemoveSingleEmptyOnEl.style.display = removeSingleEmptyParagraph ? '' : 'none';
  }

  function toggleRemoveSingleEmptyParagraph(): void {
    removeSingleEmptyParagraph = !removeSingleEmptyParagraph;
    updateRemoveSingleEmptyParagraphUi();
    pagedBlocks = applyEmptyParagraphFilter(blocks);
    pageIndex = 0;
    lastCanvasW = -1;
    lastCanvasH = -1;
    render();
  }

  function adjustReaderSetting(
    key: keyof Pick<ReaderSettings, 'fontSize' | 'lineHeight' | 'paragraphSpacing' | 'pagePadding'>,
    delta: number,
  ): void {
    const limits = readerLimits[key];
    const next = clamp(roundByStep((currentReaderSettings[key] as number) + delta, limits.step), limits.min, limits.max);
    if (next === currentReaderSettings[key]) return;
    currentReaderSettings[key] = next;
    updateReaderSettingsUi();
    lastCanvasW = -1;
    lastCanvasH = -1;
    render();
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
      headerPageLabel.textContent = '0 / 0';
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
    headerPageLabel.textContent = `${cur} / ${total}`;
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
    if (ok) window.location.href = chapterNav.prev;
  }

  function confirmGoNextChapter(): void {
    if (!chapterNav.next) return;
    const ok = window.confirm('已在最後一頁，是否前往下一章？');
    if (ok) window.location.href = chapterNav.next;
  }

  function toggleChrome(): void {
    chromeVisible = !chromeVisible;
    applyChromeVisibility();
    syncCanvasTapLayerLayout();
  }

  function handleSideTapPaging(): void {
    const now = Date.now();
    const doubleTapWindowMs = 280;
    const isDoubleTap = now - lastTapTs <= doubleTapWindowMs;
    lastTapTs = now;

    if (isDoubleTap) {
      if (pendingTapNextTimer) {
        clearTimeout(pendingTapNextTimer);
        pendingTapNextTimer = null;
      }
      if (pageIndex <= 0) {
        confirmGoPrevChapter();
      } else {
        goPrevPage();
      }
      return;
    }

    pendingTapNextTimer = setTimeout(() => {
      pendingTapNextTimer = null;
      if (pageIndex >= pageStarts.length - 1) {
        confirmGoNextChapter();
      } else {
        goNextPage();
      }
    }, doubleTapWindowMs);
  }

  function render(): void {
    updateResponsiveChrome();
    const dpr = window.devicePixelRatio || 1;
    const width = canvasWrap.clientWidth;
    const height = canvasWrap.clientHeight;
    if (width === 0 || height === 0) return;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'top';
    ctx.font = `${currentReaderSettings.fontSize}px ${currentReaderSettings.fontFamily}`;

    const maxWidth = Math.max(0, width - currentReaderSettings.pagePadding * 2);
    const maxHeight = Math.max(0, height - currentReaderSettings.pagePadding * 2);
    const linePx = currentReaderSettings.fontSize * currentReaderSettings.lineHeight;

    const layout: PageLayout = {
      pad: currentReaderSettings.pagePadding,
      maxWidth,
      maxHeight,
      linePx,
      paraSpacing: currentReaderSettings.paragraphSpacing,
    };

    const sameSize = pageStarts.length > 0 && width === lastCanvasW && height === lastCanvasH;
    if (!sameSize) {
      pageStarts = buildPageStarts(ctx, pagedBlocks, layout);
      lastCanvasW = width;
      lastCanvasH = height;
      pageIndex = Math.min(pageIndex, Math.max(0, pageStarts.length - 1));
    }

    updatePageChrome();
    syncCanvasTapLayerLayout();

    if (pageStarts.length === 0) return;

    walkOnePage(ctx, pagedBlocks, pageStarts[pageIndex], layout, true);
    drawBottomMetadata(
      ctx,
      width,
      height,
      title,
      `${pageIndex + 1} / ${pageStarts.length}`,
      currentReaderSettings,
      maxWidth,
    );
  }

  btnHeaderMenu.addEventListener('click', () => {
    if (drawerOverlay.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });
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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drawerOverlay.classList.contains('open')) {
      closeDrawer();
      return;
    }
    if (pageJumpOverlay.classList.contains('open')) {
      closePageJump();
      return;
    }
    if (!chromeVisible) {
      chromeVisible = true;
      applyChromeVisibility();
      syncCanvasTapLayerLayout();
    }
  });

  btnPrevChap.addEventListener('click', () => {
    if (chapterNav.prev) window.location.href = chapterNav.prev;
  });
  btnPrevPage.addEventListener('click', goPrevPage);
  btnNextPage.addEventListener('click', goNextPage);
  btnTapPrevPage.addEventListener('click', handleSideTapPaging);
  btnTapChrome.addEventListener('click', toggleChrome);
  btnTapNextPage.addEventListener('click', handleSideTapPaging);
  btnReaderFontDec.addEventListener('click', () => {
    adjustReaderSetting('fontSize', -readerLimits.fontSize.step);
  });
  btnReaderFontInc.addEventListener('click', () => {
    adjustReaderSetting('fontSize', readerLimits.fontSize.step);
  });
  btnReaderLineHeightDec.addEventListener('click', () => {
    adjustReaderSetting('lineHeight', -readerLimits.lineHeight.step);
  });
  btnReaderLineHeightInc.addEventListener('click', () => {
    adjustReaderSetting('lineHeight', readerLimits.lineHeight.step);
  });
  btnReaderParaSpacingDec.addEventListener('click', () => {
    adjustReaderSetting('paragraphSpacing', -readerLimits.paragraphSpacing.step);
  });
  btnReaderParaSpacingInc.addEventListener('click', () => {
    adjustReaderSetting('paragraphSpacing', readerLimits.paragraphSpacing.step);
  });
  btnReaderPagePaddingDec.addEventListener('click', () => {
    adjustReaderSetting('pagePadding', -readerLimits.pagePadding.step);
  });
  btnReaderPagePaddingInc.addEventListener('click', () => {
    adjustReaderSetting('pagePadding', readerLimits.pagePadding.step);
  });
  btnRemoveSingleEmptyParagraph.addEventListener('click', toggleRemoveSingleEmptyParagraph);
  btnNextChap.addEventListener('click', () => {
    if (chapterNav.next) window.location.href = chapterNav.next;
  });

  updateRemoveSingleEmptyParagraphUi();
  updateReaderSettingsUi();
  updateResponsiveChrome();
  render();
  window.addEventListener('resize', render);
}

main();
