/** DOM selectors and site-specific helpers (adjust when the site changes). */

export const SELECTORS = {
  forumContent: '.forum-content',
  title: 'h2, .forum-content-title',
} as const;

export function getForumContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SELECTORS.forumContent);
}

export function getChapterTitle(): string {
  const el = document.querySelector(SELECTORS.title);
  const fromDom = el?.textContent?.trim();
  return fromDom || document.title;
}

/** 與站內「上一篇／下一篇」連結文字一致（依站方文案調整）。 */
export function getAdjacentChapterHrefs(): { prev: string; next: string } {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a')];
  const prev = links.find((a) => a.textContent?.includes('上一篇'))?.href ?? '';
  const next = links.find((a) => a.textContent?.includes('下一篇'))?.href ?? '';
  return { prev, next };
}

/** 章節目錄／作品詳情（/forum/{id}/ → /detail/{id}）。 */
export function getNovelDetailHref(): string {
  const m = window.location.pathname.match(/\/forum\/(\d+)\//);
  if (!m) return '';
  return `${window.location.origin}/detail/${m[1]}`;
}
