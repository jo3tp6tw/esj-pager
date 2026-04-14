import {
  AArrowDown,
  AArrowUp,
  ALargeSmall,
  createElement,
  ChevronsLeft,
  ChevronsRight,
  Diff,
  Menu,
  Minus,
  MoveLeft,
  MoveRight,
  PenLine,
  Plus,
  Square,
  SquareCheck,
  TableOfContents,
} from 'lucide';
import type { IconNode } from 'lucide';

function makeIcon(icon: IconNode, size: number): SVGElement {
  return createElement(icon, {
    width: size,
    height: size,
    class: 'esj-lucide-icon',
  }) as SVGElement;
}

/** 上章／下章 */
export function iconPrevChapter(size = 20): SVGElement {
  return makeIcon(ChevronsLeft, size);
}

export function iconNextChapter(size = 20): SVGElement {
  return makeIcon(ChevronsRight, size);
}

/** 上頁／下頁 */
export function iconPrevPage(size = 22): SVGElement {
  return makeIcon(MoveLeft, size);
}

export function iconNextPage(size = 22): SVGElement {
  return makeIcon(MoveRight, size);
}

/** 頂欄選單 */
export function iconMenu(size = 22): SVGElement {
  return makeIcon(Menu, size);
}

/** 抽屜章節目錄 */
export function iconTableOfContents(size = 22): SVGElement {
  return makeIcon(TableOfContents, size);
}

/** 字級 */
export function iconFontSize(size = 18): SVGElement {
  return makeIcon(ALargeSmall, size);
}

/** 行高/段距/頁邊距 */
export function iconDiff(size = 18): SVGElement {
  return makeIcon(Diff, size);
}

/** 變大 */
export function iconAArrowUp(size = 18): SVGElement {
  return makeIcon(AArrowUp, size);
}

/** 變小 */
export function iconAArrowDown(size = 18): SVGElement {
  return makeIcon(AArrowDown, size);
}

/** 加 */
export function iconPlus(size = 18): SVGElement {
  return makeIcon(Plus, size);
}

/** 減 */
export function iconMinus(size = 18): SVGElement {
  return makeIcon(Minus, size);
}

/** 跳頁編輯 */
export function iconPenLine(size = 18): SVGElement {
  return makeIcon(PenLine, size);
}

/** 未勾選方框 */
export function iconSquare(size = 18): SVGElement {
  return makeIcon(Square, size);
}

/** 已勾選方框 */
export function iconSquareCheck(size = 18): SVGElement {
  return makeIcon(SquareCheck, size);
}
