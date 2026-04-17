import type { PanelContext } from '../context';
import { applyChromeVisibility, syncCanvasTapLayerLayout } from './chromeManager';
import { clearCharWidthCache } from '../pagination';
import { findPageIndexByCursor } from '../utils';

/**
 * Open the drawer panel
 * Validates: Requirements 5.1, 5.4
 */
export function openDrawer(ctx: PanelContext): void {
  const { refs } = ctx;
  refs.drawerOverlay.classList.add('open');
  refs.drawerOverlay.setAttribute('aria-hidden', 'false');
  refs.btnHeaderMenu.setAttribute('aria-expanded', 'true');
}

/**
 * Close the drawer panel
 * Validates: Requirements 5.1, 5.4
 */
export function closeDrawer(ctx: PanelContext): void {
  const { refs } = ctx;
  refs.drawerOverlay.classList.remove('open');
  refs.drawerOverlay.setAttribute('aria-hidden', 'true');
  refs.btnHeaderMenu.setAttribute('aria-expanded', 'false');
}

/**
 * Open the reader adjust panel
 * Validates: Requirements 5.2, 5.4
 */
export function openReaderAdjust(ctx: PanelContext): void {
  const { state: s, refs } = ctx;
  
  closeDrawer(ctx);
  
  if (s.chromeVisible) {
    s.chromeVisible = false;
    applyChromeVisibility(ctx);
    syncCanvasTapLayerLayout(ctx);
  }
  
  // Save current settings snapshot
  s.snapshotBeforeAdjust = { ...s.currentReaderSettings };
  s.adjustAnchorCursor = s.pageStarts[s.pageIndex] ? { ...s.pageStarts[s.pageIndex] } : { bi: 0, off: 0 };
  s.previewFromAdjust = true;
  
  ctx.syncUi();
  
  refs.readerAdjustOverlay.classList.add('open');
  refs.readerAdjustOverlay.setAttribute('aria-hidden', 'false');
}

/**
 * Close the reader adjust panel
 * Validates: Requirements 5.2, 5.4
 */
export function closeReaderAdjust(ctx: PanelContext, apply: boolean, hideDrawerAndChrome: boolean): void {
  const { refs } = ctx;
  
  if (ctx.state.previewFromAdjust) {
    if (apply) {
      finalizeReaderAdjustRebuild(ctx);
    } else {
      cancelReaderAdjust(ctx);
    }
  }
  
  refs.readerAdjustOverlay.classList.remove('open');
  refs.readerAdjustOverlay.setAttribute('aria-hidden', 'true');
  
  if (hideDrawerAndChrome) {
    // Confirm button: hide chrome and close drawer
    if (ctx.state.chromeVisible) {
      ctx.state.chromeVisible = false;
      applyChromeVisibility(ctx);
      syncCanvasTapLayerLayout(ctx);
    }
    closeDrawer(ctx);
  } else {
    // Cancel button: restore chrome and open drawer
    if (!ctx.state.chromeVisible) {
      ctx.state.chromeVisible = true;
      applyChromeVisibility(ctx);
      syncCanvasTapLayerLayout(ctx);
    }
    openDrawer(ctx);
  }
}

/**
 * Cancel reader adjust and restore original settings
 * Validates: Requirements 5.2
 */
export function cancelReaderAdjust(ctx: PanelContext): void {
  const { state: s } = ctx;
  
  // Restore original settings
  if (s.snapshotBeforeAdjust) {
    s.currentReaderSettings = { ...s.snapshotBeforeAdjust };
    s.snapshotBeforeAdjust = null;
  }
  
  // Exit preview mode
  s.previewFromAdjust = false;
  s.adjustAnchorCursor = null;
  
  // Update UI
  ctx.syncUi();
  
  // Recalculate and restore position
  clearCharWidthCache();
  s.lastCanvasW = -1;
  s.lastCanvasH = -1;
  ctx.render();
}

/**
 * Finalize reader adjust rebuild for preview mode cleanup
 * Validates: Requirements 5.2
 */
export function finalizeReaderAdjustRebuild(ctx: PanelContext): void {
  const { state: s } = ctx;
  
  const anchor = s.adjustAnchorCursor;
  s.previewFromAdjust = false;
  s.adjustAnchorCursor = null;
  
  if (!anchor) return;
  
  s.lastCanvasW = -1;
  s.lastCanvasH = -1;
  ctx.render();
  
  if (s.pageStarts.length > 0) {
    s.pageIndex = findPageIndexByCursor(s.pageStarts, anchor);
    ctx.render();
  }
}

/**
 * Open the page jump dialog
 * Validates: Requirements 5.3, 5.4
 */
export function openPageJump(ctx: PanelContext): void {
  const { state: s, refs } = ctx;
  const total = s.pageStarts.length;
  
  if (total === 0) return;
  
  refs.pageJumpInput.value = String(s.pageIndex + 1);
  refs.pageJumpTotalEl.textContent = String(total);
  refs.pageJumpInput.min = '1';
  refs.pageJumpInput.max = String(total);
  
  refs.pageJumpOverlay.classList.add('open');
  refs.pageJumpOverlay.setAttribute('aria-hidden', 'false');
  
  requestAnimationFrame(() => {
    refs.pageJumpInput.focus();
    refs.pageJumpInput.select();
  });
}

/**
 * Close the page jump dialog
 * Validates: Requirements 5.3, 5.4
 */
export function closePageJump(ctx: PanelContext): void {
  const { refs } = ctx;
  refs.pageJumpOverlay.classList.remove('open');
  refs.pageJumpOverlay.setAttribute('aria-hidden', 'true');
  refs.pageJumpInput.blur();
}

/**
 * Submit page jump and navigate to the specified page
 * Validates: Requirements 5.3
 */
export function submitPageJump(ctx: PanelContext): void {
  const { state: s, refs, render } = ctx;
  const total = s.pageStarts.length;
  
  if (total === 0) return;
  
  const raw = parseInt(String(refs.pageJumpInput.value), 10);
  if (Number.isNaN(raw)) {
    closePageJump(ctx);
    return;
  }
  
  s.pageIndex = Math.max(1, Math.min(total, raw)) - 1;
  closePageJump(ctx);
  render();
}

/**
 * Open the fullscreen prompt dialog
 * Validates: Requirements 5.4
 */
export function openFullscreenPrompt(ctx: PanelContext): void {
  const { refs } = ctx;
  refs.fullscreenPromptOverlay.classList.add('open');
  refs.fullscreenPromptOverlay.setAttribute('aria-hidden', 'false');
}

/**
 * Close the fullscreen prompt dialog
 * Validates: Requirements 5.4
 */
export function closeFullscreenPrompt(ctx: PanelContext): void {
  const { refs } = ctx;
  refs.fullscreenPromptOverlay.classList.remove('open');
  refs.fullscreenPromptOverlay.setAttribute('aria-hidden', 'true');
}

/**
 * Confirm fullscreen and enter fullscreen mode
 * Validates: Requirements 5.4
 */
export function confirmFullscreen(ctx: PanelContext): void {
  const { state: s, refs } = ctx;
  
  closeFullscreenPrompt(ctx);
  
  // Hide chrome (header/footer)
  if (s.chromeVisible) {
    s.chromeVisible = false;
    applyChromeVisibility(ctx);
    syncCanvasTapLayerLayout(ctx);
  }
  
  // Close drawer
  closeDrawer(ctx);
  
  // Enter fullscreen
  void refs.readerRoot.requestFullscreen().catch(() => {});
}

/**
 * Set reader settings expanded state
 * Validates: Requirements 5.1
 */
export function setReaderSettingsExpanded(ctx: PanelContext, expanded: boolean): void {
  const { state: s, refs } = ctx;
  
  s.readerSettingsExpanded = expanded;
  refs.btnReaderSettingsDropdown.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  refs.readerSettingsContent.classList.toggle('open', expanded);
  refs.iconReaderSettingsChevronDownEl.style.display = expanded ? 'none' : '';
  refs.iconReaderSettingsChevronUpEl.style.display = expanded ? '' : 'none';
}

/**
 * Set profile expanded state
 * Validates: Requirements 5.1
 */
export function setProfileExpanded(ctx: PanelContext, expanded: boolean): void {
  const { state: s, refs } = ctx;
  
  s.profileExpanded = expanded;
  refs.btnProfileDropdown.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  refs.profileContent.classList.toggle('open', expanded);
  refs.iconProfileChevronDownEl.style.display = expanded ? 'none' : '';
  refs.iconProfileChevronUpEl.style.display = expanded ? '' : 'none';
}
