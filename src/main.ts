import { extractBlocksFromHtml, extractCommentBlocksFromHtml } from './extract';
import { clearCharWidthCache } from './pagination';
import { getAdjacentChapterHrefs, getChapterTitle, getCommentsRoot, getForumContent, getNovelDetailHref, getNovelId } from './site';
import type { Block } from './types';
import { createReaderDom } from './reader/dom';
import { buildReaderStyles } from './reader/styles';
import { createReaderState, READER_LIMITS, type ChapterNav, type ReaderState } from './readerState';
import { roundByStep, clamp, findPageIndexByCursor } from './utils';
import { loadWebFontConfig, loadSavedCursor, saveFullscreenPromptSetting, loadFullscreenPromptSetting, createProfileSaver, createProfileLoader, createPositionSaver } from './storage';
import { LOCAL_FONT_OPTIONS, isAnyFontFamilyAvailable, getPresetWebFontConfig } from './fonts';
import type { ReaderContext, EventHandlerContext, RenderContext, SyncContext, PanelContext } from './context';
import { createEventHandlers } from './eventHandlers';
import { createRenderer } from './reader/render';
import { syncFontSourceUi, updateReaderSettingsUi, updateProfileUi, updateRemoveSingleEmptyParagraphUi, updateFullscreenPromptUi, syncHeaderFullscreenUi, updatePageChrome } from './reader/uiSync';
import { openDrawer, closeDrawer, openReaderAdjust, closeReaderAdjust, openPageJump, closePageJump, submitPageJump, openFullscreenPrompt, closeFullscreenPrompt, confirmFullscreen, setReaderSettingsExpanded, setProfileExpanded } from './reader/panelManager';
import { applyChromeSettings, applyChromeVisibility, updateResponsiveChrome, toggleChrome, syncCanvasTapLayerLayout } from './reader/chromeManager';
import { goPrevPage, goNextPage, confirmGoPrevChapter, confirmGoNextChapter } from './reader/pageNavigation';
import { adjustReaderSetting, toggleRemoveSingleEmptyParagraph, applyWebFont } from './reader/settingsManager';
import { ensureImage, getImageRenderInfo } from './imageCache';
import { getChromePreset, getChromeSettingsForPreset } from './reader/settings';

function main(): void {
  const root = getForumContent();
  if (!root) return;
  const title = getChapterTitle();
  const blocks = extractBlocksFromHtml(root.innerHTML);
  const commentsRoot = getCommentsRoot();
  const commentBlocks = commentsRoot ? extractCommentBlocksFromHtml(commentsRoot.innerHTML) : [];
  const allBlocks = [...blocks, ...commentBlocks];
  mountReader(title, allBlocks, getAdjacentChapterHrefs(), getNovelDetailHref());
  console.info('[esj-pager]', title, 'blocks:', allBlocks.length);
}

function mountReader(title: string, blocks: Block[], chapterNav: ChapterNav, novelDetailHref: string): void {
  const refs = createReaderDom(title, novelDetailHref, chapterNav);

  // Initialize DOM
  refs.style.textContent = buildReaderStyles();
  document.head.appendChild(refs.style);
  document.body.appendChild(refs.readerRoot);
  const rootEl = document.documentElement;
  const bodyEl = document.body;
  const prevRootOverflow = rootEl.style.overflow;
  const prevBodyOverflow = bodyEl.style.overflow;
  rootEl.style.overflow = 'hidden';
  bodyEl.style.overflow = 'hidden';

  const eventAc = new AbortController();
  window.addEventListener('pagehide', () => { eventAc.abort(); rootEl.style.overflow = prevRootOverflow; bodyEl.style.overflow = prevBodyOverflow; }, { once: true });

  // Initialize state and context
  const s: ReaderState = createReaderState(blocks);
  const novelId = getNovelId();
  const chapterKey = `${window.location.pathname}${window.location.search}`;

  // Font source select setup
  ['本機字體', 'Web Font'].forEach((text, i) => { const option = document.createElement('option'); option.value = i === 0 ? 'local' : 'web'; option.textContent = text; refs.selectFontSource.appendChild(option); });
  LOCAL_FONT_OPTIONS.forEach(option => { if (option.detectFamilies && !isAnyFontFamilyAvailable(option.detectFamilies)) return; const el = document.createElement('option'); el.value = option.value; el.textContent = option.label; refs.selectLocalFont.appendChild(el); });

  // Create contexts
  const baseContext: ReaderContext = { state: s, refs, blocks, chapterNav, novelId, chapterKey, render: () => {} };
  const renderContext: RenderContext = { ...baseContext, getImageRenderInfo: (src: string, maxWidth: number) => getImageRenderInfo(baseContext, src, maxWidth), ensureImage: (src: string) => ensureImage(baseContext, src), saveCurrentPosition: () => {}, updatePageChrome: () => updatePageChrome(baseContext), syncCanvasTapLayerLayout: () => syncCanvasTapLayerLayout(baseContext), updateResponsiveChrome: () => updateResponsiveChrome(baseContext) };
  const render = createRenderer(renderContext);
  baseContext.render = render;
  renderContext.render = render;
  renderContext.saveCurrentPosition = createPositionSaver(s, novelId, chapterKey);

  // Create UI sync and storage functions
  const syncUi = () => [syncFontSourceUi, updateReaderSettingsUi, updateProfileUi].forEach(fn => fn(baseContext));
  const saveReaderProfile = createProfileSaver(s, syncUi);
  const loadSavedReaderProfile = createProfileLoader(s, syncUi, blocks, render);

  // Create specialized contexts
  const panelContext: PanelContext = { ...baseContext, syncUi, applyChromeVisibility: () => applyChromeVisibility(baseContext), syncCanvasTapLayerLayout: () => syncCanvasTapLayerLayout(baseContext) };
  const settingsContext: SyncContext = { ...baseContext, syncUi };
  const eventHandlerContext: EventHandlerContext = { ...baseContext, goPrevPage: () => goPrevPage(baseContext), goNextPage: () => goNextPage(baseContext), confirmGoPrevChapter: () => confirmGoPrevChapter(baseContext), confirmGoNextChapter: () => confirmGoNextChapter(baseContext), toggleChrome: () => toggleChrome(baseContext), closeDrawer: () => closeDrawer(panelContext), openDrawer: () => openDrawer(panelContext), closePageJump: () => closePageJump(panelContext), closeReaderAdjust: (apply: boolean, hideDrawerAndChrome: boolean) => closeReaderAdjust(panelContext, apply, hideDrawerAndChrome) };

  // Create event handlers
  const eventHandlers = createEventHandlers(eventHandlerContext);

  // UI toggle functions
  const toggleFullscreenPromptSetting = () => { s.showFullscreenPrompt = !s.showFullscreenPrompt; updateFullscreenPromptUi(baseContext); saveFullscreenPromptSetting(s.showFullscreenPrompt); };
  const toggleFullscreen = () => document.fullscreenElement ? void document.exitFullscreen().catch(() => {}) : void refs.readerRoot.requestFullscreen().catch(() => {});

  // Event binding - Core UI
  refs.btnHeaderMenu.addEventListener('click', () => refs.drawerOverlay.classList.contains('open') ? closeDrawer(panelContext) : openDrawer(panelContext));
  refs.btnHeaderFullscreen.addEventListener('click', toggleFullscreen);
  refs.drawerBackdrop.addEventListener('click', () => closeDrawer(panelContext));
  refs.btnFooterPageJump.addEventListener('click', () => openPageJump(panelContext));
  [refs.pageJumpBackdrop, refs.pageJumpCancel].forEach(el => el.addEventListener('click', () => closePageJump(panelContext)));
  refs.pageJumpOk.addEventListener('click', () => submitPageJump(panelContext));
  refs.pageJumpInput.addEventListener('keydown', e => e.key === 'Enter' && (e.preventDefault(), submitPageJump(panelContext)));
  [refs.pageJumpPanel, refs.fullscreenPromptPanel, refs.readerAdjustPanel].forEach(el => el.addEventListener('click', e => e.stopPropagation()));
  refs.fullscreenPromptBackdrop.addEventListener('click', () => closeFullscreenPrompt(panelContext));
  refs.btnFullscreenPromptCancel.addEventListener('click', () => closeFullscreenPrompt(panelContext));
  refs.btnFullscreenPromptConfirm.addEventListener('click', () => confirmFullscreen(panelContext));
  refs.btnFullscreenPromptToggle.addEventListener('click', toggleFullscreenPromptSetting);
  refs.readerAdjustBackdrop.addEventListener('click', () => closeReaderAdjust(panelContext, false, false));

  // Bind all event handlers
  eventHandlers.bindAll(eventAc.signal);

  // Navigation
  refs.btnPrevChap.addEventListener('click', () => chapterNav.prev && (window.location.href = chapterNav.prev));
  refs.btnPrevPage.addEventListener('click', () => goPrevPage(baseContext));
  refs.btnNextPage.addEventListener('click', () => goNextPage(baseContext));
  refs.btnNextChap.addEventListener('click', () => chapterNav.next && (window.location.href = chapterNav.next));

  // Settings
  refs.btnReaderSettingsAdjust.addEventListener('click', () => openReaderAdjust(panelContext));
  refs.btnReaderSettingsDropdown.addEventListener('click', () => setReaderSettingsExpanded(panelContext, !s.readerSettingsExpanded));
  refs.selectFontSource.addEventListener('change', () => { s.fontSource = refs.selectFontSource.value === 'web' ? 'web' : 'local'; syncFontSourceUi(baseContext); });
  refs.selectLocalFont.addEventListener('change', () => { if (s.fontSource !== 'local') return; const next = refs.selectLocalFont.value; if (!next || next === s.currentReaderSettings.fontFamily) return; s.currentReaderSettings.fontFamily = next; updateReaderSettingsUi(baseContext); clearCharWidthCache(); s.lastCanvasW = s.lastCanvasH = -1; render(); });

  // Web font handling
  const applyWebFontFromInputs = async () => { const cssUrl = refs.inputWebFontCssUrl.value.trim(); const family = refs.inputWebFontFamily.value.trim(); if (!cssUrl || !family) return window.alert('請輸入 Web Font 的 CSS URL 與 font-family'); if (!/^https:\/\//i.test(cssUrl)) return window.alert('Web Font URL 必須是 https://'); refs.btnApplyWebFont.disabled = true; try { await applyWebFont(settingsContext, cssUrl, family); } catch { window.alert('Web Font 套用失敗，請確認 URL 與 font-family'); } finally { refs.btnApplyWebFont.disabled = false; } };
  refs.fontWebControls.addEventListener('click', e => { const presetBtn = (e.target as HTMLElement)?.closest<HTMLButtonElement>('.esj-font-preset-btn'); if (!presetBtn) return; const presetId = presetBtn.dataset.fontPreset ?? ''; const row = presetBtn.closest('.esj-font-preset-row'); const weightSelect = row?.querySelector<HTMLSelectElement>('.esj-font-weight-select'); const weight = Number(weightSelect?.value ?? 400); const config = getPresetWebFontConfig(presetId, weight); if (!config) return; refs.inputWebFontCssUrl.value = config.cssUrl; refs.inputWebFontFamily.value = config.family; void applyWebFontFromInputs(); });
  refs.btnApplyWebFont.addEventListener('click', () => void applyWebFontFromInputs());

  // Profile management
  refs.btnProfileDropdown.addEventListener('click', () => setProfileExpanded(panelContext, !s.profileExpanded));
  refs.btnProfileSave.addEventListener('click', saveReaderProfile);
  refs.btnProfileRestore.addEventListener('click', () => { const changed = loadSavedReaderProfile(); if (!s.hasSavedProfile) return window.alert('尚未儲存設定檔'); if (!changed) return; clearCharWidthCache(); s.lastCanvasW = s.lastCanvasH = -1; render(); });

  // Reader adjust controls
  const applyReaderSettingFromSlider = (key: keyof typeof READER_LIMITS, rawValue: number) => { const limits = READER_LIMITS[key]; if (!Number.isFinite(rawValue)) return; const next = clamp(roundByStep(rawValue, limits.step), limits.min, limits.max); if (next === s.currentReaderSettings[key]) return; s.currentReaderSettings[key] = next; updateReaderSettingsUi(baseContext); if (!s.previewFromAdjust) s.lastCanvasW = s.lastCanvasH = -1; render(); };
  const bindAdjustRow = (key: keyof typeof READER_LIMITS, decBtn: HTMLButtonElement, incBtn: HTMLButtonElement, rangeEl: HTMLInputElement) => { decBtn.addEventListener('click', () => adjustReaderSetting(settingsContext, key, -READER_LIMITS[key].step)); incBtn.addEventListener('click', () => adjustReaderSetting(settingsContext, key, READER_LIMITS[key].step)); rangeEl.addEventListener('input', () => applyReaderSettingFromSlider(key, Number(rangeEl.value))); };
  bindAdjustRow('fontSize', refs.btnReaderAdjustFontDec, refs.btnReaderAdjustFontInc, refs.rangeReaderAdjustFont);
  bindAdjustRow('lineHeight', refs.btnReaderAdjustLineHeightDec, refs.btnReaderAdjustLineHeightInc, refs.rangeReaderAdjustLineHeight);
  bindAdjustRow('paragraphSpacing', refs.btnReaderAdjustParaSpacingDec, refs.btnReaderAdjustParaSpacingInc, refs.rangeReaderAdjustParaSpacing);
  bindAdjustRow('pagePaddingX', refs.btnReaderAdjustPagePaddingXDec, refs.btnReaderAdjustPagePaddingXInc, refs.rangeReaderAdjustPagePaddingX);
  bindAdjustRow('pagePaddingY', refs.btnReaderAdjustPagePaddingYDec, refs.btnReaderAdjustPagePaddingYInc, refs.rangeReaderAdjustPagePaddingY);
  bindAdjustRow('pageMaxWidth', refs.btnReaderAdjustPageMaxWidthDec, refs.btnReaderAdjustPageMaxWidthInc, refs.rangeReaderAdjustPageMaxWidth);
  refs.btnRemoveSingleEmptyToggle.addEventListener('click', () => toggleRemoveSingleEmptyParagraph(settingsContext));
  refs.btnReaderAdjustCancel.addEventListener('click', () => closeReaderAdjust(panelContext, false, false));
  refs.btnReaderAdjustApply.addEventListener('click', () => closeReaderAdjust(panelContext, true, true));

  // Initialize UI state
  updateRemoveSingleEmptyParagraphUi(baseContext);
  s.showFullscreenPrompt = loadFullscreenPromptSetting();
  updateFullscreenPromptUi(baseContext);
  loadSavedReaderProfile();
  s.pendingRestoreCursor = loadSavedCursor(novelId, chapterKey);
  const savedWebFont = loadWebFontConfig();
  if (savedWebFont) { refs.inputWebFontCssUrl.value = savedWebFont.cssUrl; refs.inputWebFontFamily.value = savedWebFont.family; }
  setReaderSettingsExpanded(panelContext, false);
  setProfileExpanded(panelContext, false);
  updateProfileUi(baseContext);
  syncFontSourceUi(baseContext);
  updateReaderSettingsUi(baseContext);
  updateResponsiveChrome(baseContext);

  // Initialize chrome settings
  const initialPreset = getChromePreset(window.innerWidth);
  s.activeChromePreset = initialPreset;
  applyChromeSettings(baseContext, getChromeSettingsForPreset(initialPreset));

  // Document event listeners
  const handleLayoutChange = () => { const anchorCursor = s.pageStarts[s.pageIndex] ? { ...s.pageStarts[s.pageIndex] } : null; s.lastCanvasW = s.lastCanvasH = -1; render(); if (anchorCursor && s.pageStarts.length > 0) { s.pageIndex = findPageIndexByCursor(s.pageStarts, anchorCursor); render(); } };
  document.addEventListener('fullscreenchange', () => { syncHeaderFullscreenUi(baseContext); handleLayoutChange(); }, { signal: eventAc.signal });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && handleLayoutChange(), { signal: eventAc.signal });

  // Initial render and setup
  syncHeaderFullscreenUi(baseContext);
  render();
  if (s.showFullscreenPrompt && !document.fullscreenElement) openFullscreenPrompt(panelContext);
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(render, 150); }, { signal: eventAc.signal });
}

main();