import type { RenderContext } from '../context';
import type { PageLayout } from '../pagination';
import { buildPageStarts, walkOnePage } from '../pagination';
import { drawBottomMetadata } from './renderCanvas';
import { findPageIndexByCursor } from '../utils';

/**
 * Create a renderer function with all necessary dependencies
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */
export function createRenderer(ctx: RenderContext): () => void {
  const { state: s, refs, blocks, render: _render, chapterNav } = ctx;
  const { canvasWrap, canvas } = refs;

  return function render(): void {
    ctx.updateResponsiveChrome();
    
    const dpr = window.devicePixelRatio || 1;
    const width = canvasWrap.clientWidth;
    const viewportHeight = canvasWrap.clientHeight;
    
    if (width === 0 || viewportHeight === 0) return;
    
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    
    const maxHeight = Math.max(0, viewportHeight - s.currentReaderSettings.pagePaddingY * 2);
    const availableTextWidth = Math.max(0, width - s.currentReaderSettings.pagePaddingX * 2);
    const textWidth = Math.min(availableTextWidth, s.currentReaderSettings.pageMaxWidth);
    const textLeft = Math.max(0, Math.floor((width - textWidth) / 2));
    const linePx = s.currentReaderSettings.fontSize * s.currentReaderSettings.lineHeight;
    
    const layout: PageLayout = {
      padX: s.currentReaderSettings.pagePaddingX,
      padY: s.currentReaderSettings.pagePaddingY,
      textLeft,
      textWidth,
      maxWidth: textWidth,
      maxHeight,
      linePx,
      paraSpacing: s.currentReaderSettings.paragraphSpacing,
    };
    
    const useAdjustPreview = s.previewFromAdjust && s.adjustAnchorCursor !== null;
    const sameSize = !useAdjustPreview && s.pageStarts.length > 0 && width === s.lastCanvasW && viewportHeight === s.lastCanvasH;
    
    if (!sameSize) {
      if (!useAdjustPreview) {
        s.pageStarts = buildPageStarts(canvasCtx, s.pagedBlocks, layout, {
          imagePlaceholderText: '【圖】',
          getImageRenderInfo: ctx.getImageRenderInfo,
        });
        s.lastCanvasW = width;
        s.lastCanvasH = viewportHeight;
        
        if (s.pendingRestoreCursor !== null) {
          s.pageIndex = findPageIndexByCursor(s.pageStarts, s.pendingRestoreCursor);
          s.pendingRestoreCursor = null;
        }
        
        s.pageIndex = Math.min(s.pageIndex, Math.max(0, s.pageStarts.length - 1));
      }
    }
    
    ctx.updatePageChrome();
    ctx.syncCanvasTapLayerLayout();
    
    if (!useAdjustPreview) ctx.saveCurrentPosition();
    
    const startCursor = useAdjustPreview ? s.adjustAnchorCursor : s.pageStarts[s.pageIndex];
    if (!startCursor) return;
    if (!useAdjustPreview && s.pageStarts.length === 0) return;
    
    let drawHeight = viewportHeight;
    const startBlock = s.pagedBlocks[startCursor.bi];
    if (startBlock?.type === 'img') {
      const info = ctx.getImageRenderInfo(startBlock.src, layout.maxWidth);
      if (info.ready && info.drawHeight > layout.maxHeight) {
        drawHeight = s.currentReaderSettings.pagePaddingY * 2 + info.drawHeight;
      }
    }
    
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(drawHeight * dpr);
    canvas.style.height = `${drawHeight}px`;
    canvasWrap.style.overflowY = drawHeight > viewportHeight ? 'auto' : 'hidden';
    
    if (s.pageIndex !== s.lastRenderedPageIndex) {
      canvasWrap.scrollTop = 0;
      s.lastRenderedPageIndex = s.pageIndex;
    }
    
    canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasCtx.clearRect(0, 0, width, drawHeight);
    canvasCtx.fillStyle = '#111';
    canvasCtx.textBaseline = 'top';
    canvasCtx.font = `${s.currentReaderSettings.fontSize}px ${s.currentReaderSettings.fontFamily}`;
    
    walkOnePage(canvasCtx, s.pagedBlocks, startCursor, layout, true, {
      imagePlaceholderText: '【圖】',
      getImageRenderInfo: ctx.getImageRenderInfo,
      drawImage: (src, x, y, w, h) => {
        const entry = ctx.ensureImage(src);
        if (entry.status !== 'loaded') {
          canvasCtx.fillText('【圖】', x, y);
          return;
        }
        canvasCtx.drawImage(entry.img, x, y, w, h);
      },
    });
    
    drawBottomMetadata(
      canvasCtx,
      drawHeight,
      refs.readerRoot.querySelector('.esj-header-title')?.textContent || '',
      `${s.pageIndex + 1} / ${s.pageStarts.length}`,
      s.currentReaderSettings,
      textLeft,
      textWidth,
    );
  };
}
