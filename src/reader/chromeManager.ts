import type { ReaderContext } from '../context';
import type { ChromeSettings } from './settings';
import { getChromePreset, getChromeSettingsForPreset } from './settings';

/**
 * Set icon size for SVG elements
 */
function setIconSize(el: SVGElement | null, size: number): void {
  if (!el) return;
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
}

/**
 * Apply chrome settings to CSS custom properties and icon sizes
 * Validates: Requirements 8.1, 8.4
 */
export function applyChromeSettings(ctx: ReaderContext, settings: ChromeSettings): void {
  ctx.state.activeChromeSettings = settings;
  const { refs } = ctx;
  const { readerRoot } = refs;

  // Apply CSS custom properties
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

  // Apply icon sizes
  setIconSize(refs.iconHeaderMenu, settings.iconMenuSize);
  setIconSize(refs.iconHeaderFullscreenExpand, settings.iconMenuSize);
  setIconSize(refs.iconHeaderFullscreenShrink, settings.iconMenuSize);
  setIconSize(refs.iconTocEl, settings.iconTableOfContentsSize);
  setIconSize(refs.iconPrevChapEl, settings.iconChapterSize);
  setIconSize(refs.iconNextChapEl, settings.iconChapterSize);
  setIconSize(refs.iconPrevPageEl, settings.iconPageSize);
  setIconSize(refs.iconNextPageEl, settings.iconPageSize);
  setIconSize(refs.iconFooterPageJumpEl, settings.iconPageSize);
}

/**
 * Apply chrome visibility state to DOM
 * Validates: Requirements 8.2
 */
export function applyChromeVisibility(ctx: ReaderContext): void {
  ctx.refs.readerRoot.classList.toggle('esj-chrome-hidden', !ctx.state.chromeVisible);
}

/**
 * Update responsive chrome based on window width
 * Validates: Requirements 8.3
 */
export function updateResponsiveChrome(ctx: ReaderContext): void {
  const preset = getChromePreset(window.innerWidth);
  if (preset === ctx.state.activeChromePreset) return;
  ctx.state.activeChromePreset = preset;
  applyChromeSettings(ctx, getChromeSettingsForPreset(preset));
  syncCanvasTapLayerLayout(ctx);
}

/**
 * Toggle chrome visibility
 * Validates: Requirements 8.2
 */
export function toggleChrome(ctx: ReaderContext): void {
  ctx.state.chromeVisible = !ctx.state.chromeVisible;
  applyChromeVisibility(ctx);
  syncCanvasTapLayerLayout(ctx);
}

/**
 * Sync canvas tap layer layout based on chrome visibility and footer dimensions
 * Validates: Requirements 8.2
 */
export function syncCanvasTapLayerLayout(ctx: ReaderContext): void {
  const { refs, state, chapterNav } = ctx;
  const { canvasWrap, footerPageCell, btnTapPrevPage, btnTapChrome, btnTapNextPage } = refs;

  const wrapRect = canvasWrap.getBoundingClientRect();
  const w = wrapRect.width;
  if (w <= 0) return;

  const topPx = state.chromeVisible ? state.activeChromeSettings.headerHeight : 0;
  const bottomPx = state.chromeVisible ? state.activeChromeSettings.footerHeight : 0;

  let leftW: number, midLeft: number, midW: number, rightStart: number, rightW: number;

  if (state.chromeVisible) {
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

  const total = state.pageStarts.length;
  btnTapPrevPage.disabled = !(total > 0 && (state.pageIndex > 0 || Boolean(chapterNav.prev)));
  btnTapNextPage.disabled = !(total > 0 && (state.pageIndex < total - 1 || Boolean(chapterNav.next)));
}
