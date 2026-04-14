import {
  iconAArrowDown,
  iconAArrowUp,
  iconDiff,
  iconFontSize,
  iconMenu,
  iconMinus,
  iconNextChapter,
  iconNextPage,
  iconPenLine,
  iconPlus,
  iconPrevChapter,
  iconPrevPage,
  iconSquare,
  iconSquareCheck,
  iconTableOfContents,
} from '../lucideIcons';

export type ReaderDomRefs = {
  style: HTMLStyleElement;
  readerRoot: HTMLDivElement;
  header: HTMLDivElement;
  btnHeaderMenu: HTMLButtonElement;
  iconHeaderMenu: SVGElement;
  headerPageLabel: HTMLSpanElement;
  drawerOverlay: HTMLDivElement;
  drawerBackdrop: HTMLDivElement;
  iconTocEl: SVGElement | null;
  canvasWrap: HTMLDivElement;
  canvas: HTMLCanvasElement;
  btnTapPrevPage: HTMLButtonElement;
  btnTapChrome: HTMLButtonElement;
  btnTapNextPage: HTMLButtonElement;
  footer: HTMLDivElement;
  btnPrevChap: HTMLButtonElement;
  iconPrevChapEl: SVGElement;
  btnPrevPage: HTMLButtonElement;
  iconPrevPageEl: SVGElement;
  footerPageCell: HTMLDivElement;
  btnFooterPageJump: HTMLButtonElement;
  iconFooterPageJumpEl: SVGElement;
  footerPageCur: HTMLSpanElement;
  footerPageTotal: HTMLSpanElement;
  btnNextPage: HTMLButtonElement;
  iconNextPageEl: SVGElement;
  btnNextChap: HTMLButtonElement;
  iconNextChapEl: SVGElement;
  readerSettingFontValue: HTMLSpanElement;
  readerSettingLineHeightValue: HTMLSpanElement;
  readerSettingParaSpacingValue: HTMLSpanElement;
  readerSettingPagePaddingValue: HTMLSpanElement;
  btnReaderFontDec: HTMLButtonElement;
  btnReaderFontInc: HTMLButtonElement;
  btnReaderLineHeightDec: HTMLButtonElement;
  btnReaderLineHeightInc: HTMLButtonElement;
  btnReaderParaSpacingDec: HTMLButtonElement;
  btnReaderParaSpacingInc: HTMLButtonElement;
  btnReaderPagePaddingDec: HTMLButtonElement;
  btnReaderPagePaddingInc: HTMLButtonElement;
  btnRemoveSingleEmptyParagraph: HTMLButtonElement;
  iconRemoveSingleEmptyOffEl: SVGElement;
  iconRemoveSingleEmptyOnEl: SVGElement;
  pageJumpOverlay: HTMLDivElement;
  pageJumpBackdrop: HTMLDivElement;
  pageJumpPanel: HTMLDivElement;
  pageJumpInput: HTMLInputElement;
  pageJumpTotalEl: HTMLSpanElement;
  pageJumpCancel: HTMLButtonElement;
  pageJumpOk: HTMLButtonElement;
};

export function createReaderDom(
  title: string,
  novelDetailHref: string,
  chapterNav: { prev: string; next: string },
): ReaderDomRefs {
  const style = document.createElement('style');

  const readerRoot = document.createElement('div');
  readerRoot.id = 'esj-reader-root';

  const header = document.createElement('div');
  header.id = 'esj-reader-header';

  const btnHeaderMenu = document.createElement('button');
  btnHeaderMenu.type = 'button';
  btnHeaderMenu.className = 'esj-header-menu-btn';
  btnHeaderMenu.id = 'esj-header-menu-btn';
  btnHeaderMenu.setAttribute('aria-label', '選單');
  btnHeaderMenu.setAttribute('aria-expanded', 'false');
  btnHeaderMenu.setAttribute('aria-controls', 'esj-reader-drawer');
  const iconHeaderMenu = iconMenu();
  btnHeaderMenu.appendChild(iconHeaderMenu);

  const headerTitle = document.createElement('div');
  headerTitle.id = 'esj-reader-header-title';
  headerTitle.textContent = title;

  const headerPage = document.createElement('div');
  headerPage.id = 'esj-reader-header-page';
  const headerPageLabel = document.createElement('span');
  headerPageLabel.id = 'esj-header-page-label';
  headerPageLabel.textContent = '1 / 1';
  headerPage.appendChild(headerPageLabel);

  header.appendChild(btnHeaderMenu);
  header.appendChild(headerTitle);
  header.appendChild(headerPage);

  const drawerOverlay = document.createElement('div');
  drawerOverlay.id = 'esj-reader-drawer';
  drawerOverlay.setAttribute('role', 'dialog');
  drawerOverlay.setAttribute('aria-modal', 'true');
  drawerOverlay.setAttribute('aria-hidden', 'true');
  drawerOverlay.setAttribute('aria-label', '選單');

  const drawerBackdrop = document.createElement('div');
  drawerBackdrop.className = 'esj-drawer-backdrop';

  const drawerPanel = document.createElement('aside');
  drawerPanel.className = 'esj-drawer-panel';
  let iconTocEl: SVGElement | null = null;

  if (novelDetailHref) {
    const drawerNav = document.createElement('nav');
    drawerNav.className = 'esj-drawer-nav';
    drawerNav.setAttribute('aria-label', '目錄');
    const tocLinkDrawer = document.createElement('a');
    tocLinkDrawer.className = 'esj-drawer-toc-row';
    tocLinkDrawer.href = novelDetailHref;
    tocLinkDrawer.setAttribute('aria-label', '章節目錄');
    iconTocEl = iconTableOfContents();
    tocLinkDrawer.appendChild(iconTocEl);
    drawerNav.appendChild(tocLinkDrawer);
    drawerPanel.appendChild(drawerNav);
  }

  const readerSettingsSection = document.createElement('section');
  readerSettingsSection.className = 'esj-drawer-reader-settings';
  readerSettingsSection.setAttribute('aria-label', '閱讀設定');

  const readerSettingsTitle = document.createElement('div');
  readerSettingsTitle.className = 'esj-drawer-reader-settings-title';
  readerSettingsTitle.textContent = '閱讀設定';
  readerSettingsSection.appendChild(readerSettingsTitle);

  function makeSettingRow(
    labelText: string,
    iconLeft: SVGElement,
    decIcon: SVGElement,
    incIcon: SVGElement,
    decAriaLabel: string,
    incAriaLabel: string,
  ): {
    row: HTMLDivElement;
    valueEl: HTMLSpanElement;
    decBtn: HTMLButtonElement;
    incBtn: HTMLButtonElement;
  } {
    const row = document.createElement('div');
    row.className = 'esj-setting-row';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'esj-setting-label';
    labelWrap.appendChild(iconLeft);
    const labelTextEl = document.createElement('span');
    labelTextEl.textContent = labelText;
    labelWrap.appendChild(labelTextEl);

    const controls = document.createElement('div');
    controls.className = 'esj-setting-controls';

    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'esj-setting-btn';
    decBtn.setAttribute('aria-label', decAriaLabel);
    decBtn.appendChild(decIcon);

    const valueEl = document.createElement('span');
    valueEl.className = 'esj-setting-value';
    valueEl.textContent = '-';

    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'esj-setting-btn';
    incBtn.setAttribute('aria-label', incAriaLabel);
    incBtn.appendChild(incIcon);

    controls.appendChild(decBtn);
    controls.appendChild(valueEl);
    controls.appendChild(incBtn);
    row.appendChild(labelWrap);
    row.appendChild(controls);
    return { row, valueEl, decBtn, incBtn };
  }

  const fontRow = makeSettingRow(
    '字級',
    iconFontSize(18),
    iconAArrowDown(18),
    iconAArrowUp(18),
    '字級變小',
    '字級變大',
  );
  const lineHeightRow = makeSettingRow(
    '行高',
    iconDiff(18),
    iconMinus(18),
    iconPlus(18),
    '行高減少',
    '行高增加',
  );
  const paraSpacingRow = makeSettingRow(
    '段距',
    iconDiff(18),
    iconMinus(18),
    iconPlus(18),
    '段距減少',
    '段距增加',
  );
  const pagePaddingRow = makeSettingRow(
    '頁邊距',
    iconDiff(18),
    iconMinus(18),
    iconPlus(18),
    '頁邊距減少',
    '頁邊距增加',
  );

  readerSettingsSection.appendChild(fontRow.row);
  readerSettingsSection.appendChild(lineHeightRow.row);
  readerSettingsSection.appendChild(paraSpacingRow.row);
  readerSettingsSection.appendChild(pagePaddingRow.row);

  const removeSingleEmptyRow = document.createElement('button');
  removeSingleEmptyRow.type = 'button';
  removeSingleEmptyRow.className = 'esj-setting-toggle-row';
  removeSingleEmptyRow.setAttribute('aria-label', '去除空段落');
  removeSingleEmptyRow.setAttribute('aria-pressed', 'false');

  const removeSingleEmptyLabel = document.createElement('div');
  removeSingleEmptyLabel.className = 'esj-setting-label';
  const removeSingleEmptyLabelText = document.createElement('span');
  removeSingleEmptyLabelText.textContent = '去除空段落';
  removeSingleEmptyLabel.appendChild(removeSingleEmptyLabelText);

  const removeSingleEmptyIconWrap = document.createElement('span');
  removeSingleEmptyIconWrap.className = 'esj-setting-toggle-icon';
  const iconRemoveSingleEmptyOffEl = iconSquare(18);
  const iconRemoveSingleEmptyOnEl = iconSquareCheck(18);
  iconRemoveSingleEmptyOnEl.style.display = 'none';
  removeSingleEmptyIconWrap.appendChild(iconRemoveSingleEmptyOffEl);
  removeSingleEmptyIconWrap.appendChild(iconRemoveSingleEmptyOnEl);

  removeSingleEmptyRow.appendChild(removeSingleEmptyLabel);
  removeSingleEmptyRow.appendChild(removeSingleEmptyIconWrap);
  readerSettingsSection.appendChild(removeSingleEmptyRow);
  drawerPanel.appendChild(readerSettingsSection);

  drawerOverlay.appendChild(drawerBackdrop);
  drawerOverlay.appendChild(drawerPanel);

  const canvasWrap = document.createElement('div');
  canvasWrap.id = 'esj-reader-canvas-wrap';

  const canvas = document.createElement('canvas');
  canvas.id = 'esj-reader-canvas';
  canvasWrap.appendChild(canvas);

  const canvasTapLayer = document.createElement('div');
  canvasTapLayer.id = 'esj-canvas-tap-layer';

  const btnTapPrevPage = document.createElement('button');
  btnTapPrevPage.type = 'button';
  btnTapPrevPage.className = 'esj-canvas-tap-btn esj-canvas-tap-prev';
  btnTapPrevPage.setAttribute('aria-label', '上頁（點擊閱讀區左側）');
  btnTapPrevPage.tabIndex = -1;

  const btnTapChrome = document.createElement('button');
  btnTapChrome.type = 'button';
  btnTapChrome.className = 'esj-canvas-tap-btn esj-canvas-tap-chrome';
  btnTapChrome.setAttribute('aria-label', '顯示或隱藏頂欄與底欄');
  btnTapChrome.tabIndex = -1;

  const btnTapNextPage = document.createElement('button');
  btnTapNextPage.type = 'button';
  btnTapNextPage.className = 'esj-canvas-tap-btn esj-canvas-tap-next';
  btnTapNextPage.setAttribute('aria-label', '下頁（點擊閱讀區右側）');
  btnTapNextPage.tabIndex = -1;

  canvasTapLayer.appendChild(btnTapPrevPage);
  canvasTapLayer.appendChild(btnTapChrome);
  canvasTapLayer.appendChild(btnTapNextPage);
  canvasWrap.appendChild(canvasTapLayer);

  const footer = document.createElement('div');
  footer.id = 'esj-reader-footer';

  const btnPrevChap = document.createElement('button');
  btnPrevChap.type = 'button';
  btnPrevChap.id = 'esj-reader-btn-prev-chap';
  btnPrevChap.className = 'esj-footer-chap';
  btnPrevChap.setAttribute('aria-label', '上一章');
  const iconPrevChapEl = iconPrevChapter();
  btnPrevChap.appendChild(iconPrevChapEl);
  btnPrevChap.disabled = !chapterNav.prev;

  const btnPrevPage = document.createElement('button');
  btnPrevPage.type = 'button';
  btnPrevPage.id = 'esj-reader-btn-prev-page';
  btnPrevPage.className = 'esj-footer-page';
  btnPrevPage.setAttribute('aria-label', '上頁');
  const iconPrevPageEl = iconPrevPage();
  btnPrevPage.appendChild(iconPrevPageEl);

  const footerPageCell = document.createElement('div');
  footerPageCell.className = 'esj-footer-pagecell';
  footerPageCell.id = 'esj-footer-pagecell';

  const footerPageDisplay = document.createElement('div');
  footerPageDisplay.id = 'esj-footer-page-display';
  const footerPageCur = document.createElement('span');
  footerPageCur.id = 'esj-footer-page-cur';
  footerPageCur.textContent = '1';
  const footerPageSep = document.createElement('span');
  footerPageSep.className = 'esj-footer-page-sep';
  footerPageSep.textContent = '/';
  const footerPageTotal = document.createElement('span');
  footerPageTotal.id = 'esj-footer-page-total';
  footerPageTotal.textContent = '1';
  footerPageDisplay.appendChild(footerPageCur);
  footerPageDisplay.appendChild(footerPageSep);
  footerPageDisplay.appendChild(footerPageTotal);

  const btnFooterPageJump = document.createElement('button');
  btnFooterPageJump.type = 'button';
  btnFooterPageJump.id = 'esj-footer-page-jump';
  btnFooterPageJump.className = 'esj-footer-page-jump-btn';
  btnFooterPageJump.setAttribute('aria-label', '跳轉頁碼');
  const iconFooterPageJumpEl = iconPenLine();
  btnFooterPageJump.appendChild(iconFooterPageJumpEl);

  footerPageCell.appendChild(footerPageDisplay);
  footerPageCell.appendChild(btnFooterPageJump);

  const btnNextPage = document.createElement('button');
  btnNextPage.type = 'button';
  btnNextPage.id = 'esj-reader-btn-next-page';
  btnNextPage.className = 'esj-footer-page';
  btnNextPage.setAttribute('aria-label', '下頁');
  const iconNextPageEl = iconNextPage();
  btnNextPage.appendChild(iconNextPageEl);

  const btnNextChap = document.createElement('button');
  btnNextChap.type = 'button';
  btnNextChap.id = 'esj-reader-btn-next-chap';
  btnNextChap.className = 'esj-footer-chap';
  btnNextChap.setAttribute('aria-label', '下一章');
  const iconNextChapEl = iconNextChapter();
  btnNextChap.appendChild(iconNextChapEl);
  btnNextChap.disabled = !chapterNav.next;

  footer.appendChild(btnPrevChap);
  footer.appendChild(btnPrevPage);
  footer.appendChild(footerPageCell);
  footer.appendChild(btnNextPage);
  footer.appendChild(btnNextChap);

  const pageJumpOverlay = document.createElement('div');
  pageJumpOverlay.id = 'esj-page-jump-overlay';
  pageJumpOverlay.setAttribute('role', 'dialog');
  pageJumpOverlay.setAttribute('aria-modal', 'true');
  pageJumpOverlay.setAttribute('aria-hidden', 'true');

  const pageJumpBackdrop = document.createElement('div');
  pageJumpBackdrop.className = 'esj-page-jump-backdrop';

  const pageJumpPanel = document.createElement('div');
  pageJumpPanel.className = 'esj-page-jump-panel';

  const pageJumpTitle = document.createElement('div');
  pageJumpTitle.className = 'esj-page-jump-title';
  pageJumpTitle.textContent = '跳轉頁碼';

  const pageJumpRow = document.createElement('div');
  pageJumpRow.className = 'esj-page-jump-row';

  const pageJumpInput = document.createElement('input');
  pageJumpInput.type = 'number';
  pageJumpInput.id = 'esj-page-jump-input';
  pageJumpInput.min = '1';
  pageJumpInput.inputMode = 'numeric';

  const pageJumpSlash = document.createElement('span');
  pageJumpSlash.textContent = '/';

  const pageJumpTotalEl = document.createElement('span');
  pageJumpTotalEl.id = 'esj-page-jump-total';
  pageJumpTotalEl.textContent = '1';

  pageJumpRow.appendChild(pageJumpInput);
  pageJumpRow.appendChild(pageJumpSlash);
  pageJumpRow.appendChild(pageJumpTotalEl);

  const pageJumpActions = document.createElement('div');
  pageJumpActions.className = 'esj-page-jump-actions';

  const pageJumpCancel = document.createElement('button');
  pageJumpCancel.type = 'button';
  pageJumpCancel.id = 'esj-page-jump-cancel';
  pageJumpCancel.textContent = '取消';

  const pageJumpOk = document.createElement('button');
  pageJumpOk.type = 'button';
  pageJumpOk.id = 'esj-page-jump-ok';
  pageJumpOk.textContent = '前往';

  pageJumpActions.appendChild(pageJumpCancel);
  pageJumpActions.appendChild(pageJumpOk);

  pageJumpPanel.appendChild(pageJumpTitle);
  pageJumpPanel.appendChild(pageJumpRow);
  pageJumpPanel.appendChild(pageJumpActions);

  pageJumpOverlay.appendChild(pageJumpBackdrop);
  pageJumpOverlay.appendChild(pageJumpPanel);

  readerRoot.appendChild(canvasWrap);
  readerRoot.appendChild(header);
  readerRoot.appendChild(footer);
  readerRoot.appendChild(drawerOverlay);
  readerRoot.appendChild(pageJumpOverlay);

  return {
    style,
    readerRoot,
    header,
    btnHeaderMenu,
    iconHeaderMenu,
    headerPageLabel,
    drawerOverlay,
    drawerBackdrop,
    iconTocEl,
    canvasWrap,
    canvas,
    btnTapPrevPage,
    btnTapChrome,
    btnTapNextPage,
    footer,
    btnPrevChap,
    iconPrevChapEl,
    btnPrevPage,
    iconPrevPageEl,
    footerPageCell,
    btnFooterPageJump,
    iconFooterPageJumpEl,
    footerPageCur,
    footerPageTotal,
    btnNextPage,
    iconNextPageEl,
    btnNextChap,
    iconNextChapEl,
    readerSettingFontValue: fontRow.valueEl,
    readerSettingLineHeightValue: lineHeightRow.valueEl,
    readerSettingParaSpacingValue: paraSpacingRow.valueEl,
    readerSettingPagePaddingValue: pagePaddingRow.valueEl,
    btnReaderFontDec: fontRow.decBtn,
    btnReaderFontInc: fontRow.incBtn,
    btnReaderLineHeightDec: lineHeightRow.decBtn,
    btnReaderLineHeightInc: lineHeightRow.incBtn,
    btnReaderParaSpacingDec: paraSpacingRow.decBtn,
    btnReaderParaSpacingInc: paraSpacingRow.incBtn,
    btnReaderPagePaddingDec: pagePaddingRow.decBtn,
    btnReaderPagePaddingInc: pagePaddingRow.incBtn,
    btnRemoveSingleEmptyParagraph: removeSingleEmptyRow,
    iconRemoveSingleEmptyOffEl,
    iconRemoveSingleEmptyOnEl,
    pageJumpOverlay,
    pageJumpBackdrop,
    pageJumpPanel,
    pageJumpInput,
    pageJumpTotalEl,
    pageJumpCancel,
    pageJumpOk,
  };
}
