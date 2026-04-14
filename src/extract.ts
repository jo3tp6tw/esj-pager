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
