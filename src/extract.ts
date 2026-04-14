import type { Block } from './types';

/**
 * Parse forum HTML into normalized blocks.
 * Rule: treat "<br> paragraph <br>" as one paragraph unit.
 */
export function extractBlocksFromHtml(html: string): Block[] {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('script, style, iframe, .ads, .ad').forEach((el) => el.remove());

  const blocks: Block[] = [];
  const paragraphParts: string[] = [];

  const HARD_BREAK_TAGS = new Set([
    'P',
    'DIV',
    'LI',
    'SECTION',
    'ARTICLE',
    'BLOCKQUOTE',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
  ]);

  const flushParagraph = (allowEmpty = false): void => {
    if (paragraphParts.length === 0) {
      if (allowEmpty) {
        blocks.push({ type: 'paragraph', text: '' });
      }
      return;
    }

    const text = paragraphParts.join('');
    paragraphParts.length = 0;

    if (!text.trim() && !allowEmpty) return;
    blocks.push({ type: 'paragraph', text });
  };

  const walk = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const raw = child.textContent ?? '';
        if (raw.trim()) paragraphParts.push(raw);
      } else if (child instanceof HTMLElement) {
        if (child.tagName === 'BR') {
          // On ESJ content, each <br> acts like a paragraph separator.
          // Consecutive <br> therefore represent empty paragraphs.
          flushParagraph(true);
        } else if (child.tagName === 'IMG') {
          flushParagraph();
          const img = child as HTMLImageElement;
          const src =
            img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
          if (src) blocks.push({ type: 'img', src });
        } else {
          walk(child);
          if (HARD_BREAK_TAGS.has(child.tagName)) {
            flushParagraph();
          }
        }
      }
    }
  };

  walk(temp);
  flushParagraph();
  return blocks;
}

/**
 * Parse ESJ comments section into paragraph blocks.
 * Output is intentionally text-only so it can reuse the existing paginator.
 */
export function extractCommentBlocksFromHtml(html: string): Block[] {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('script, style, iframe').forEach((el) => el.remove());

  const commentEls = [...temp.querySelectorAll<HTMLElement>('.comment')];
  if (commentEls.length === 0) return [];

  const blocks: Block[] = [];
  blocks.push({ type: 'commentMeta', text: '' });
  blocks.push({ type: 'commentMeta', text: '========== 留言區 ==========' });
  blocks.push({ type: 'commentMeta', text: '' });

  for (const el of commentEls) {
    const floor = (el.querySelector('.comment-floor')?.textContent ?? '').trim();
    const author = (el.querySelector('.comment-title a, .comment-title')?.textContent ?? '').trim();
    const time = (el.querySelector('.comment-meta:not(.comment-floor)')?.textContent ?? '').trim();
    const quoteEl = el.querySelector<HTMLElement>('blockquote');
    const quoteText = (quoteEl?.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    const textEl = el.querySelector<HTMLElement>('.comment-text');
    const text = (textEl?.textContent ?? '').replace(/\u00a0/g, ' ').trim();

    const headerParts = [floor, author, time].filter((v) => v.length > 0);
    blocks.push({ type: 'commentDivider' });
    if (headerParts.length > 0) {
      blocks.push({ type: 'commentMeta', text: headerParts.join('  ') });
    }
    if (quoteText) {
      blocks.push({ type: 'commentMeta', text: `回覆：${quoteText}` });
    }
    blocks.push({ type: 'commentMain', text: text || '[無文字內容]' });
    blocks.push({ type: 'commentMeta', text: '' });
  }

  return blocks;
}
