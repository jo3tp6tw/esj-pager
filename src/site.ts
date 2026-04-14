/** DOM selectors and site-specific helpers (adjust when the site changes). */

export const SELECTORS = {
  forumContent: '.forum-content',
  comments: '#comments',
  title: 'h2, .forum-content-title',
} as const;

export function getForumContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SELECTORS.forumContent);
}

export function getCommentsRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SELECTORS.comments);
}

export function getChapterTitle(): string {
  const el = document.querySelector(SELECTORS.title);
  const fromDom = el?.textContent?.trim();
  return fromDom || document.title;
}

const PREV_LINK_TEXTS = ['上一篇', '上一章', 'Previous', 'Prev', '<<'];
const NEXT_LINK_TEXTS = ['下一篇', '下一章', 'Next', '>>'];

function isChapterHref(href: string): boolean {
  try {
    const u = new URL(href, window.location.origin);
    return /^\/forum\/\d+\/\d+\.html$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function pickValidHrefBySelectors(root: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const a = root.querySelector<HTMLAnchorElement>(selector);
    if (!a?.href) continue;
    if (!isChapterHref(a.href)) continue;
    return a.href;
  }
  return '';
}

function pickValidHrefByText(root: ParentNode, candidates: string[]): string {
  const links = [...root.querySelectorAll<HTMLAnchorElement>('a')];
  for (const text of candidates) {
    const match = links.find((a) => (a.textContent ?? '').includes(text) && isChapterHref(a.href));
    if (match) return match.href;
  }
  return '';
}

/** 優先依 entry-navigation 左右欄位抓上下章，最後再用文字 fallback。 */
export function getAdjacentChapterHrefs(): { prev: string; next: string } {
  const navs = [...document.querySelectorAll<HTMLElement>('.entry-navigation')];
  const preferredNav = (navs.length > 0 ? navs[navs.length - 1] : null) ?? navs[0] ?? document;

  const prev =
    pickValidHrefBySelectors(preferredNav, [
      '.column.text-left a',
      'a.btn-prev',
      'a[rel="prev"]',
    ]) || pickValidHrefByText(preferredNav, PREV_LINK_TEXTS) || pickValidHrefByText(document, PREV_LINK_TEXTS);

  const next =
    pickValidHrefBySelectors(preferredNav, [
      '.column.text-right a',
      'a.btn-next',
      'a[rel="next"]',
    ]) || pickValidHrefByText(preferredNav, NEXT_LINK_TEXTS) || pickValidHrefByText(document, NEXT_LINK_TEXTS);

  return { prev, next };
}

/** 從 URL 取出小說 ID（/forum/{novelId}/{chapterId}）。 */
export function getNovelId(): string {
  const m = window.location.pathname.match(/\/forum\/(\d+)\//);
  return m?.[1] ?? '';
}

/** 章節目錄／作品詳情（/forum/{id}/ → /detail/{id}）。 */
export function getNovelDetailHref(): string {
  const id = getNovelId();
  if (!id) return '';
  return `${window.location.origin}/detail/${id}`;
}
