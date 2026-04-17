import type { ReaderContext } from '../context';
import { LOCAL_FONT_OPTIONS } from '../fonts';
import { READER_LIMITS } from '../readerState';
import { formatLineHeight } from '../utils';

/**
 * Sync font source dropdown and related UI visibility
 */
export function syncFontSourceUi(ctx: ReaderContext): void {
  const { state: s, refs } = ctx;
  const { selectFontSource, selectLocalFont, fontLocalRow, fontWebControls } = refs;

  selectFontSource.value = s.fontSource;
  selectLocalFont.disabled = s.fontSource !== 'local';
  fontLocalRow.classList.toggle('hidden', s.fontSource !== 'local');
  fontWebControls.classList.toggle('open', s.fontSource === 'web');
}

/**
 * Sync local font select dropdown to match current font family
 */
export function syncLocalFontSelectUi(ctx: ReaderContext): void {
  const { state: s, refs } = ctx;
  const { selectLocalFont } = refs;

  const match = LOCAL_FONT_OPTIONS.find((opt) => opt.value === s.currentReaderSettings.fontFamily);
  if (match) {
    selectLocalFont.value = match.value;
    return;
  }
  selectLocalFont.value = '';
}

/**
 * Sync all reader adjust panel values and button states
 */
export function syncReaderAdjustUi(ctx: ReaderContext): void {
  const { state: s, refs } = ctx;

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

  syncOne(
    'fontSize',
    refs.readerAdjustFontValue,
    refs.rangeReaderAdjustFont,
    refs.btnReaderAdjustFontDec,
    refs.btnReaderAdjustFontInc,
  );
  syncOne(
    'lineHeight',
    refs.readerAdjustLineHeightValue,
    refs.rangeReaderAdjustLineHeight,
    refs.btnReaderAdjustLineHeightDec,
    refs.btnReaderAdjustLineHeightInc,
  );
  syncOne(
    'paragraphSpacing',
    refs.readerAdjustParaSpacingValue,
    refs.rangeReaderAdjustParaSpacing,
    refs.btnReaderAdjustParaSpacingDec,
    refs.btnReaderAdjustParaSpacingInc,
  );
  syncOne(
    'pagePaddingX',
    refs.readerAdjustPagePaddingXValue,
    refs.rangeReaderAdjustPagePaddingX,
    refs.btnReaderAdjustPagePaddingXDec,
    refs.btnReaderAdjustPagePaddingXInc,
  );
  syncOne(
    'pagePaddingY',
    refs.readerAdjustPagePaddingYValue,
    refs.rangeReaderAdjustPagePaddingY,
    refs.btnReaderAdjustPagePaddingYDec,
    refs.btnReaderAdjustPagePaddingYInc,
  );
  syncOne(
    'pageMaxWidth',
    refs.readerAdjustPageMaxWidthValue,
    refs.rangeReaderAdjustPageMaxWidth,
    refs.btnReaderAdjustPageMaxWidthDec,
    refs.btnReaderAdjustPageMaxWidthInc,
  );
}

/**
 * Update all reader settings display values in the drawer
 */
export function updateReaderSettingsUi(ctx: ReaderContext): void {
  const { state: s, refs } = ctx;

  refs.readerSettingFontValue.textContent = `${s.currentReaderSettings.fontSize}`;
  refs.readerSettingLineHeightValue.textContent = formatLineHeight(s.currentReaderSettings.lineHeight);
  refs.readerSettingParaSpacingValue.textContent = `${s.currentReaderSettings.paragraphSpacing}`;
  refs.readerSettingPagePaddingXValue.textContent = `${s.currentReaderSettings.pagePaddingX}`;
  refs.readerSettingPagePaddingYValue.textContent = `${s.currentReaderSettings.pagePaddingY}`;
  refs.readerSettingPageMaxWidthValue.textContent = `${s.currentReaderSettings.pageMaxWidth}`;
  
  syncLocalFontSelectUi(ctx);
  syncReaderAdjustUi(ctx);
  
  refs.btnProfileRestore.disabled = !s.hasSavedProfile;
}

/**
 * Update saved profile display values in the drawer
 */
export function updateProfileUi(ctx: ReaderContext): void {
  const { state: s, refs } = ctx;

  if (!s.savedProfile) {
    refs.profileFontValue.textContent = '-';
    refs.profileLineHeightValue.textContent = '-';
    refs.profileParaSpacingValue.textContent = '-';
    refs.profilePagePaddingXValue.textContent = '-';
    refs.profilePagePaddingYValue.textContent = '-';
    refs.profilePageMaxWidthValue.textContent = '-';
    refs.profileRemoveSingleEmptyValue.textContent = '-';
    return;
  }

  refs.profileFontValue.textContent = String(s.savedProfile.fontSize);
  refs.profileLineHeightValue.textContent = formatLineHeight(s.savedProfile.lineHeight);
  refs.profileParaSpacingValue.textContent = String(s.savedProfile.paragraphSpacing);
  refs.profilePagePaddingXValue.textContent = String(s.savedProfile.pagePaddingX);
  refs.profilePagePaddingYValue.textContent = String(s.savedProfile.pagePaddingY);
  refs.profilePageMaxWidthValue.textContent = String(s.savedProfile.pageMaxWidth);
  refs.profileRemoveSingleEmptyValue.textContent = s.savedProfile.removeSingleEmptyParagraph ? 'ON' : 'OFF';
}

/**
 * Update remove single empty paragraph toggle UI state
 */
export function updateRemoveSingleEmptyParagraphUi(ctx: ReaderContext): void {
  const { state: s, refs } = ctx;

  refs.btnRemoveSingleEmptyToggle.setAttribute('aria-pressed', s.removeSingleEmptyParagraph ? 'true' : 'false');
  refs.iconRemoveSingleEmptyCheckEl.style.display = s.removeSingleEmptyParagraph ? '' : 'none';
}

/**
 * Update fullscreen prompt toggle UI state
 */
export function updateFullscreenPromptUi(ctx: ReaderContext): void {
  const { state: s, refs } = ctx;

  refs.btnFullscreenPromptToggle.setAttribute('aria-pressed', s.showFullscreenPrompt ? 'true' : 'false');
  refs.iconFullscreenPromptCheckEl.style.display = s.showFullscreenPrompt ? '' : 'none';
}

/**
 * Sync header fullscreen button state based on document.fullscreenElement
 */
export function syncHeaderFullscreenUi(ctx: ReaderContext): void {
  const { refs } = ctx;

  const isFullscreen = Boolean(document.fullscreenElement);
  refs.btnHeaderFullscreen.setAttribute('aria-pressed', isFullscreen ? 'true' : 'false');
  refs.btnHeaderFullscreen.setAttribute('aria-label', isFullscreen ? '離開全螢幕' : '進入全螢幕');
  refs.iconHeaderFullscreenExpand.style.display = isFullscreen ? 'none' : '';
  refs.iconHeaderFullscreenShrink.style.display = isFullscreen ? '' : 'none';
}

/**
 * Update footer page numbers and navigation button states
 */
export function updatePageChrome(ctx: ReaderContext): void {
  const { state: s, refs, chapterNav } = ctx;

  const total = s.pageStarts.length;
  if (total === 0) {
    refs.footerPageCur.textContent = '0';
    refs.footerPageTotal.textContent = '0';
    refs.btnFooterPageJump.disabled = true;
    refs.pageJumpTotalEl.textContent = '0';
    refs.pageJumpInput.removeAttribute('max');
    refs.btnPrevPage.disabled = true;
    refs.btnNextPage.disabled = true;
    return;
  }

  refs.footerPageCur.textContent = String(s.pageIndex + 1);
  refs.footerPageTotal.textContent = String(total);
  refs.btnFooterPageJump.disabled = false;
  refs.pageJumpTotalEl.textContent = String(total);
  refs.pageJumpInput.max = String(total);
  refs.pageJumpInput.min = '1';
  refs.btnPrevPage.disabled = s.pageIndex <= 0;
  refs.btnNextPage.disabled = s.pageIndex >= total - 1;
}

/**
 * Create a function that forces full re-render by invalidating cache
 */
export function createForceRerender(ctx: ReaderContext): () => void {
  return () => {
    const { state: s, render } = ctx;
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
    render();
  };
}
