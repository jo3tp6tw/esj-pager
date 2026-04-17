import type { ReaderContext } from '../context';

/**
 * Go to the previous page
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
export function goPrevPage(ctx: ReaderContext): void {
  const { state: s, render } = ctx;
  if (s.pageIndex > 0) {
    s.pageIndex -= 1;
    render();
  }
}

/**
 * Go to the next page
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
export function goNextPage(ctx: ReaderContext): void {
  const { state: s, render } = ctx;
  if (s.pageIndex < s.pageStarts.length - 1) {
    s.pageIndex += 1;
    render();
  }
}

/**
 * Confirm and navigate to the previous chapter
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
export function confirmGoPrevChapter(ctx: ReaderContext): void {
  const { chapterNav } = ctx;
  if (!chapterNav.prev) return;
  if (window.confirm('已在第一頁，是否前往上一章？')) {
    window.location.href = chapterNav.prev;
  }
}

/**
 * Confirm and navigate to the next chapter
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
export function confirmGoNextChapter(ctx: ReaderContext): void {
  const { chapterNav } = ctx;
  if (!chapterNav.next) return;
  if (window.confirm('已在最後一頁，是否前往下一章？')) {
    window.location.href = chapterNav.next;
  }
}