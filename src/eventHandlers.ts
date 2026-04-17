import type { EventHandlerContext } from './context';

export type EventHandlers = {
  handleSideTap: () => void;
  handleSwipe: {
    down: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    reset: () => void;
  };
  handleWheel: (e: WheelEvent) => void;
  handleContextMenu: (e: MouseEvent) => void;
  handleKeyboard: (e: KeyboardEvent) => void;
  bindAll: (signal: AbortSignal) => void;
};

/**
 * Creates unified event handlers for the reader.
 * Handles tap-to-page, swipe gestures, wheel scrolling, context menu, and keyboard shortcuts.
 */
export function createEventHandlers(ctx: EventHandlerContext): EventHandlers {
  const { state, refs, chapterNav } = ctx;
  const { canvasWrap, drawerOverlay, pageJumpOverlay, readerAdjustOverlay } = refs;

  // --- Side tap paging ---

  function handleSideTap(): void {
    if (state.suppressNextSideTap) {
      state.suppressNextSideTap = false;
      return;
    }
    if (state.pageIndex >= state.pageStarts.length - 1) {
      ctx.confirmGoNextChapter();
    } else {
      ctx.goNextPage();
    }
  }

  // --- Swipe gestures ---

  function handleSwipePointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    state.swipeStartX = e.clientX;
    state.swipeStartY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function resetSwipeTracking(): void {
    state.swipeStartX = null;
    state.swipeStartY = null;
  }

  function handleSwipePointerUp(e: PointerEvent): void {
    if (state.swipeStartX === null || state.swipeStartY === null) return;
    const dx = e.clientX - state.swipeStartX;
    const dy = e.clientY - state.swipeStartY;
    resetSwipeTracking();

    const swipeThresholdPx = 36;
    if (Math.abs(dx) < swipeThresholdPx) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;

    state.suppressNextSideTap = true;

    if (dx < 0) {
      // Swipe left: next page
      if (state.pageIndex >= state.pageStarts.length - 1) {
        ctx.confirmGoNextChapter();
      } else {
        ctx.goNextPage();
      }
      return;
    }

    // Swipe right: prev page
    if (state.pageIndex <= 0) {
      ctx.confirmGoPrevChapter();
    } else {
      ctx.goPrevPage();
    }
  }

  // --- Wheel scrolling ---

  function handleCanvasTapWheel(e: WheelEvent): void {
    const maxScrollTop = canvasWrap.scrollHeight - canvasWrap.clientHeight;
    if (maxScrollTop <= 0) return;

    const nextScrollTop = Math.max(
      0,
      Math.min(maxScrollTop, canvasWrap.scrollTop + e.deltaY),
    );
    if (nextScrollTop === canvasWrap.scrollTop) return;

    e.preventDefault();
    canvasWrap.scrollTop = nextScrollTop;
  }

  // --- Context menu (right-click) ---

  function handleRightClickPrevPage(e: MouseEvent): void {
    e.preventDefault();
    if (state.pageIndex <= 0) {
      ctx.confirmGoPrevChapter();
      return;
    }
    ctx.goPrevPage();
  }

  // --- Keyboard shortcuts ---

  function isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    const tag = el?.tagName?.toLowerCase();
    return (
      Boolean(el?.isContentEditable) ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select'
    );
  }

  function shouldInterceptReaderHotkey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (isEditableTarget(e.target)) return false;
    return (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key.toLowerCase() === 'f'
    );
  }

  const handleReaderHotkeys = (e: KeyboardEvent): void => {
    // Escape key: close panels or show chrome
    if (e.key === 'Escape') {
      if (drawerOverlay.classList.contains('open')) {
        ctx.closeDrawer();
        return;
      }
      if (pageJumpOverlay.classList.contains('open')) {
        ctx.closePageJump();
        return;
      }
      if (readerAdjustOverlay.classList.contains('open')) {
        ctx.closeReaderAdjust(false, false);
        ctx.openDrawer();
        return;
      }
      if (!state.chromeVisible) {
        ctx.toggleChrome();
      }
      return;
    }

    if (!shouldInterceptReaderHotkey(e)) return;

    // Arrow left: prev page
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (state.pageIndex <= 0) {
        ctx.confirmGoPrevChapter();
      } else {
        ctx.goPrevPage();
      }
      return;
    }

    // Arrow right: next page
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (state.pageIndex >= state.pageStarts.length - 1) {
        ctx.confirmGoNextChapter();
      } else {
        ctx.goNextPage();
      }
      return;
    }

    // F key: toggle fullscreen
    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      } else {
        void refs.readerRoot.requestFullscreen().catch(() => {});
      }
    }
  };

  // --- Bind all event listeners ---

  function bindAll(signal: AbortSignal): void {
    const {
      btnTapPrevPage,
      btnTapChrome,
      btnTapNextPage,
    } = refs;

    // Keyboard events
    window.addEventListener('keydown', handleReaderHotkeys, {
      capture: true,
      signal,
    });
    window.addEventListener(
      'keyup',
      (e) => {
        if (!shouldInterceptReaderHotkey(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      },
      { capture: true, signal },
    );

    // Tap area events (prev page area)
    btnTapPrevPage.addEventListener('click', handleSideTap, { signal });
    btnTapPrevPage.addEventListener('pointerdown', handleSwipePointerDown, {
      signal,
    });
    btnTapPrevPage.addEventListener('pointerup', handleSwipePointerUp, {
      signal,
    });
    btnTapPrevPage.addEventListener('pointercancel', resetSwipeTracking, {
      signal,
    });
    btnTapPrevPage.addEventListener('wheel', handleCanvasTapWheel, {
      passive: false,
      signal,
    });
    btnTapPrevPage.addEventListener('contextmenu', handleRightClickPrevPage, {
      signal,
    });

    // Tap area events (chrome toggle area)
    btnTapChrome.addEventListener('click', ctx.toggleChrome, { signal });
    btnTapChrome.addEventListener('pointerdown', handleSwipePointerDown, {
      signal,
    });
    btnTapChrome.addEventListener('pointerup', handleSwipePointerUp, { signal });
    btnTapChrome.addEventListener('pointercancel', resetSwipeTracking, {
      signal,
    });
    btnTapChrome.addEventListener('wheel', handleCanvasTapWheel, {
      passive: false,
      signal,
    });
    btnTapChrome.addEventListener('contextmenu', handleRightClickPrevPage, {
      signal,
    });

    // Tap area events (next page area)
    btnTapNextPage.addEventListener('click', handleSideTap, { signal });
    btnTapNextPage.addEventListener('pointerdown', handleSwipePointerDown, {
      signal,
    });
    btnTapNextPage.addEventListener('pointerup', handleSwipePointerUp, {
      signal,
    });
    btnTapNextPage.addEventListener('pointercancel', resetSwipeTracking, {
      signal,
    });
    btnTapNextPage.addEventListener('wheel', handleCanvasTapWheel, {
      passive: false,
      signal,
    });
    btnTapNextPage.addEventListener('contextmenu', handleRightClickPrevPage, {
      signal,
    });
  }

  return {
    handleSideTap,
    handleSwipe: {
      down: handleSwipePointerDown,
      up: handleSwipePointerUp,
      reset: resetSwipeTracking,
    },
    handleWheel: handleCanvasTapWheel,
    handleContextMenu: handleRightClickPrevPage,
    handleKeyboard: handleReaderHotkeys,
    bindAll,
  };
}
