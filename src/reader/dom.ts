import {
  iconArrowDownToLine,
  iconChevronDown,
  iconChevronUp,
  iconClipboardPaste,
  iconDiff,
  iconExpand,
  iconFontSize,
  iconMenu,
  iconMinus,
  iconNextChapter,
  iconNextPage,
  iconPenLine,
  iconPlus,
  iconPrevChapter,
  iconPrevPage,
  iconCheck,
  iconTableOfContents,
  iconShrink,
} from '../lucideIcons';

export type ReaderDomRefs = {
  style: HTMLStyleElement;
  readerRoot: HTMLDivElement;
  header: HTMLDivElement;
  btnHeaderMenu: HTMLButtonElement;
  iconHeaderMenu: SVGElement;
  btnHeaderFullscreen: HTMLButtonElement;
  iconHeaderFullscreenExpand: SVGElement;
  iconHeaderFullscreenShrink: SVGElement;
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
  readerSettingPagePaddingXValue: HTMLSpanElement;
  readerSettingPagePaddingYValue: HTMLSpanElement;
  readerSettingPageMaxWidthValue: HTMLSpanElement;
  btnReaderSettingsAdjust: HTMLButtonElement;
  btnReaderSettingsDropdown: HTMLButtonElement;
  iconReaderSettingsChevronDownEl: SVGElement;
  iconReaderSettingsChevronUpEl: SVGElement;
  readerSettingsContent: HTMLDivElement;
  btnProfileSave: HTMLButtonElement;
  btnProfileRestore: HTMLButtonElement;
  btnProfileDropdown: HTMLButtonElement;
  iconProfileChevronDownEl: SVGElement;
  iconProfileChevronUpEl: SVGElement;
  profileContent: HTMLDivElement;
  profileFontValue: HTMLSpanElement;
  profileLineHeightValue: HTMLSpanElement;
  profileParaSpacingValue: HTMLSpanElement;
  profilePagePaddingXValue: HTMLSpanElement;
  profilePagePaddingYValue: HTMLSpanElement;
  profilePageMaxWidthValue: HTMLSpanElement;
  profileRemoveSingleEmptyValue: HTMLSpanElement;
  selectFontSource: HTMLSelectElement;
  fontLocalRow: HTMLDivElement;
  selectLocalFont: HTMLSelectElement;
  fontWebControls: HTMLDivElement;
  inputWebFontCssUrl: HTMLInputElement;
  inputWebFontFamily: HTMLInputElement;
  btnApplyWebFont: HTMLButtonElement;
  btnRemoveSingleEmptyToggle: HTMLButtonElement;
  iconRemoveSingleEmptyCheckEl: SVGElement;
  btnFullscreenPromptToggle: HTMLButtonElement;
  iconFullscreenPromptCheckEl: SVGElement;
  readerAdjustOverlay: HTMLDivElement;
  readerAdjustBackdrop: HTMLDivElement;
  readerAdjustPanel: HTMLDivElement;
  readerAdjustFontValue: HTMLSpanElement;
  btnReaderAdjustFontDec: HTMLButtonElement;
  rangeReaderAdjustFont: HTMLInputElement;
  btnReaderAdjustFontInc: HTMLButtonElement;
  readerAdjustLineHeightValue: HTMLSpanElement;
  btnReaderAdjustLineHeightDec: HTMLButtonElement;
  rangeReaderAdjustLineHeight: HTMLInputElement;
  btnReaderAdjustLineHeightInc: HTMLButtonElement;
  readerAdjustParaSpacingValue: HTMLSpanElement;
  btnReaderAdjustParaSpacingDec: HTMLButtonElement;
  rangeReaderAdjustParaSpacing: HTMLInputElement;
  btnReaderAdjustParaSpacingInc: HTMLButtonElement;
  readerAdjustPagePaddingXValue: HTMLSpanElement;
  btnReaderAdjustPagePaddingXDec: HTMLButtonElement;
  rangeReaderAdjustPagePaddingX: HTMLInputElement;
  btnReaderAdjustPagePaddingXInc: HTMLButtonElement;
  readerAdjustPagePaddingYValue: HTMLSpanElement;
  btnReaderAdjustPagePaddingYDec: HTMLButtonElement;
  rangeReaderAdjustPagePaddingY: HTMLInputElement;
  btnReaderAdjustPagePaddingYInc: HTMLButtonElement;
  readerAdjustPageMaxWidthValue: HTMLSpanElement;
  btnReaderAdjustPageMaxWidthDec: HTMLButtonElement;
  rangeReaderAdjustPageMaxWidth: HTMLInputElement;
  btnReaderAdjustPageMaxWidthInc: HTMLButtonElement;
  btnReaderAdjustCancel: HTMLButtonElement;
  btnReaderAdjustApply: HTMLButtonElement;
  pageJumpOverlay: HTMLDivElement;
  pageJumpBackdrop: HTMLDivElement;
  pageJumpPanel: HTMLDivElement;
  pageJumpInput: HTMLInputElement;
  pageJumpTotalEl: HTMLSpanElement;
  pageJumpCancel: HTMLButtonElement;
  pageJumpOk: HTMLButtonElement;
  fullscreenPromptOverlay: HTMLDivElement;
  fullscreenPromptBackdrop: HTMLDivElement;
  fullscreenPromptPanel: HTMLDivElement;
  btnFullscreenPromptCancel: HTMLButtonElement;
  btnFullscreenPromptConfirm: HTMLButtonElement;
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

  const btnHeaderFullscreen = document.createElement('button');
  btnHeaderFullscreen.type = 'button';
  btnHeaderFullscreen.className = 'esj-header-menu-btn';
  btnHeaderFullscreen.id = 'esj-header-fullscreen-btn';
  btnHeaderFullscreen.setAttribute('aria-label', '進入全螢幕');
  btnHeaderFullscreen.setAttribute('aria-pressed', 'false');
  const iconHeaderFullscreenExpand = iconExpand();
  const iconHeaderFullscreenShrink = iconShrink();
  iconHeaderFullscreenShrink.style.display = 'none';
  btnHeaderFullscreen.appendChild(iconHeaderFullscreenExpand);
  btnHeaderFullscreen.appendChild(iconHeaderFullscreenShrink);

  header.appendChild(btnHeaderMenu);
  header.appendChild(headerTitle);
  header.appendChild(btnHeaderFullscreen);

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
    const tocText = document.createElement('span');
    tocText.className = 'esj-drawer-toc-text';
    tocText.textContent = '目錄';
    tocLinkDrawer.appendChild(tocText);
    drawerNav.appendChild(tocLinkDrawer);
    drawerPanel.appendChild(drawerNav);
  }

  const readerSettingsSection = document.createElement('section');
  readerSettingsSection.className = 'esj-drawer-reader-settings';
  readerSettingsSection.setAttribute('aria-label', '閱讀設定');

  const readerSettingsHead = document.createElement('div');
  readerSettingsHead.className = 'esj-drawer-reader-settings-head';
  const readerSettingsTitle = document.createElement('div');
  readerSettingsTitle.className = 'esj-drawer-reader-settings-title';
  readerSettingsTitle.textContent = '閱讀設定';
  const btnReaderSettingsAdjust = document.createElement('button');
  btnReaderSettingsAdjust.type = 'button';
  btnReaderSettingsAdjust.className = 'esj-setting-btn';
  btnReaderSettingsAdjust.setAttribute('aria-label', '調整閱讀設定');
  btnReaderSettingsAdjust.appendChild(iconPenLine(18));
  const btnReaderSettingsDropdown = document.createElement('button');
  btnReaderSettingsDropdown.type = 'button';
  btnReaderSettingsDropdown.className = 'esj-setting-btn';
  btnReaderSettingsDropdown.setAttribute('aria-label', '展開或收合閱讀設定');
  btnReaderSettingsDropdown.setAttribute('aria-expanded', 'false');
  const iconReaderSettingsChevronDownEl = iconChevronDown(18);
  const iconReaderSettingsChevronUpEl = iconChevronUp(18);
  iconReaderSettingsChevronUpEl.style.display = 'none';
  btnReaderSettingsDropdown.appendChild(iconReaderSettingsChevronDownEl);
  btnReaderSettingsDropdown.appendChild(iconReaderSettingsChevronUpEl);
  readerSettingsHead.appendChild(readerSettingsTitle);
  readerSettingsHead.appendChild(btnReaderSettingsDropdown);
  readerSettingsSection.appendChild(readerSettingsHead);
  const readerSettingsActions = document.createElement('div');
  readerSettingsActions.className = 'esj-drawer-settings-actions';
  readerSettingsActions.appendChild(btnReaderSettingsAdjust);
  readerSettingsSection.appendChild(readerSettingsActions);
  const readerSettingsContent = document.createElement('div');
  readerSettingsContent.className = 'esj-drawer-settings-content';

  function makeSettingRow(
    labelText: string,
    iconLeft: SVGElement,
  ): { row: HTMLDivElement; valueEl: HTMLSpanElement } {
    const row = document.createElement('div');
    row.className = 'esj-setting-row';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'esj-setting-label';
    labelWrap.appendChild(iconLeft);
    const labelTextEl = document.createElement('span');
    labelTextEl.textContent = labelText;
    labelWrap.appendChild(labelTextEl);

    const valueEl = document.createElement('span');
    valueEl.className = 'esj-setting-value';
    valueEl.textContent = '-';

    const controls = document.createElement('div');
    controls.className = 'esj-setting-controls';
    controls.appendChild(valueEl);
    row.appendChild(labelWrap);
    row.appendChild(controls);
    return { row, valueEl };
  }

  const fontRow = makeSettingRow(
    '字級',
    iconFontSize(18),
  );
  const lineHeightRow = makeSettingRow(
    '行高',
    iconDiff(18),
  );
  const paraSpacingRow = makeSettingRow(
    '段距',
    iconDiff(18),
  );
  const pagePaddingRow = makeSettingRow(
    '左右邊距',
    iconDiff(18),
  );
  const pagePaddingYRow = makeSettingRow(
    '上下邊距',
    iconDiff(18),
  );
  const pageMaxWidthRow = makeSettingRow(
    '最大寬度',
    iconDiff(18),
  );

  readerSettingsContent.appendChild(fontRow.row);
  readerSettingsContent.appendChild(lineHeightRow.row);
  readerSettingsContent.appendChild(paraSpacingRow.row);
  readerSettingsContent.appendChild(pagePaddingRow.row);
  readerSettingsContent.appendChild(pagePaddingYRow.row);
  readerSettingsContent.appendChild(pageMaxWidthRow.row);
  readerSettingsSection.appendChild(readerSettingsContent);

  const profileSection = document.createElement('section');
  profileSection.className = 'esj-drawer-profile-section';
  profileSection.setAttribute('aria-label', '設定檔');

  const profileHeader = document.createElement('div');
  profileHeader.className = 'esj-drawer-profile-header';
  const profileTitle = document.createElement('div');
  profileTitle.className = 'esj-drawer-reader-settings-title';
  profileTitle.textContent = '設定檔';
  const profileHeaderActions = document.createElement('div');
  profileHeaderActions.className = 'esj-drawer-profile-header-actions';
  const btnProfileDropdown = document.createElement('button');
  btnProfileDropdown.type = 'button';
  btnProfileDropdown.className = 'esj-setting-btn';
  btnProfileDropdown.setAttribute('aria-label', '展開或收合設定檔參數');
  btnProfileDropdown.setAttribute('aria-expanded', 'false');
  const iconProfileChevronDownEl = iconChevronDown(18);
  const iconProfileChevronUpEl = iconChevronUp(18);
  iconProfileChevronUpEl.style.display = 'none';
  btnProfileDropdown.appendChild(iconProfileChevronDownEl);
  btnProfileDropdown.appendChild(iconProfileChevronUpEl);
  profileHeaderActions.appendChild(btnProfileDropdown);
  profileHeader.appendChild(profileTitle);
  profileHeader.appendChild(profileHeaderActions);

  const profileActions = document.createElement('div');
  profileActions.className = 'esj-drawer-profile-actions';

  const btnProfileSave = document.createElement('button');
  btnProfileSave.type = 'button';
  btnProfileSave.className = 'esj-setting-btn';
  btnProfileSave.setAttribute('aria-label', '儲存參數設定檔');
  btnProfileSave.appendChild(iconArrowDownToLine(18));

  const btnProfileRestore = document.createElement('button');
  btnProfileRestore.type = 'button';
  btnProfileRestore.className = 'esj-setting-btn';
  btnProfileRestore.setAttribute('aria-label', '還原參數設定檔');
  btnProfileRestore.appendChild(iconClipboardPaste(18));

  profileActions.appendChild(btnProfileSave);
  profileActions.appendChild(btnProfileRestore);
  const profileContent = document.createElement('div');
  profileContent.className = 'esj-drawer-profile-content';

  function makeProfileValueRow(labelText: string): { row: HTMLDivElement; valueEl: HTMLSpanElement } {
    const row = document.createElement('div');
    row.className = 'esj-setting-row';
    const label = document.createElement('div');
    label.className = 'esj-setting-label';
    const labelTextEl = document.createElement('span');
    labelTextEl.textContent = labelText;
    label.appendChild(labelTextEl);
    const valueEl = document.createElement('span');
    valueEl.className = 'esj-setting-value';
    valueEl.textContent = '-';
    row.appendChild(label);
    row.appendChild(valueEl);
    return { row, valueEl };
  }

  const profileFontRow = makeProfileValueRow('字級');
  const profileLineHeightRow = makeProfileValueRow('行高');
  const profileParaSpacingRow = makeProfileValueRow('段距');
  const profilePagePaddingXRow = makeProfileValueRow('左右邊距');
  const profilePagePaddingYRow = makeProfileValueRow('上下邊距');
  const profilePageMaxWidthRow = makeProfileValueRow('最大寬度');
  const profileRemoveSingleEmptyRow = makeProfileValueRow('去除空段落');
  profileRemoveSingleEmptyRow.valueEl.classList.add('esj-setting-onoff');

  profileContent.appendChild(profileFontRow.row);
  profileContent.appendChild(profileLineHeightRow.row);
  profileContent.appendChild(profileParaSpacingRow.row);
  profileContent.appendChild(profilePagePaddingXRow.row);
  profileContent.appendChild(profilePagePaddingYRow.row);
  profileContent.appendChild(profilePageMaxWidthRow.row);
  profileContent.appendChild(profileRemoveSingleEmptyRow.row);

  profileSection.appendChild(profileHeader);
  profileSection.appendChild(profileActions);
  profileSection.appendChild(profileContent);
  readerSettingsSection.appendChild(profileSection);

  const fontSection = document.createElement('section');
  fontSection.className = 'esj-drawer-font-section';
  fontSection.setAttribute('aria-label', '字體');
  const fontTitle = document.createElement('div');
  fontTitle.className = 'esj-drawer-reader-settings-title';
  fontTitle.textContent = '字體';
  const fontSourceRow = document.createElement('div');
  fontSourceRow.className = 'esj-setting-row';
  const fontSourceLabel = document.createElement('div');
  fontSourceLabel.className = 'esj-setting-label';
  const fontSourceLabelText = document.createElement('span');
  fontSourceLabelText.textContent = '字體來源';
  fontSourceLabel.appendChild(fontSourceLabelText);
  const fontSourceControls = document.createElement('div');
  fontSourceControls.className = 'esj-setting-controls';
  const selectFontSource = document.createElement('select');
  selectFontSource.id = 'esj-font-source-select';
  selectFontSource.className = 'esj-setting-select';
  selectFontSource.setAttribute('aria-label', '字體來源');
  fontSourceControls.appendChild(selectFontSource);
  fontSourceRow.appendChild(fontSourceLabel);
  fontSourceRow.appendChild(fontSourceControls);

  const localFontRow = document.createElement('div');
  localFontRow.className = 'esj-setting-row esj-font-local-row';
  const localFontLabel = document.createElement('div');
  localFontLabel.className = 'esj-setting-label';
  const localFontLabelText = document.createElement('span');
  localFontLabelText.textContent = '本機字體';
  localFontLabel.appendChild(localFontLabelText);
  const localFontControls = document.createElement('div');
  localFontControls.className = 'esj-setting-controls';
  const selectLocalFont = document.createElement('select');
  selectLocalFont.id = 'esj-local-font-select';
  selectLocalFont.className = 'esj-setting-select';
  selectLocalFont.setAttribute('aria-label', '選擇本機字體');
  localFontControls.appendChild(selectLocalFont);
  localFontRow.appendChild(localFontLabel);
  localFontRow.appendChild(localFontControls);
  fontSection.appendChild(fontTitle);
  fontSection.appendChild(fontSourceRow);
  fontSection.appendChild(localFontRow);
  const fontWebControls = document.createElement('div');
  fontWebControls.className = 'esj-font-web-controls';
  const fontWebPresets = document.createElement('div');
  fontWebPresets.className = 'esj-font-web-presets';
  function makeWebFontPresetRow(label: string, presetId: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'esj-font-preset-row';
    const rowLabel = document.createElement('span');
    rowLabel.className = 'esj-font-preset-label';
    rowLabel.textContent = `${label} 粗細：`;
    const weightSelect = document.createElement('select');
    weightSelect.className = 'esj-setting-select esj-font-weight-select';
    for (let w = 100; w <= 900; w += 100) {
      const opt = document.createElement('option');
      opt.value = String(w);
      opt.textContent = String(w);
      if (w === 400) opt.selected = true;
      weightSelect.appendChild(opt);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'esj-setting-btn esj-font-preset-btn';
    btn.textContent = '套用';
    btn.dataset.fontPreset = presetId;
    row.appendChild(rowLabel);
    row.appendChild(weightSelect);
    row.appendChild(btn);
    return row;
  }
  fontWebPresets.appendChild(makeWebFontPresetRow('思源宋體', 'noto-serif-tc'));
  fontWebPresets.appendChild(makeWebFontPresetRow('思源黑體', 'noto-sans-tc'));
  const inputWebFontCssUrl = document.createElement('input');
  inputWebFontCssUrl.type = 'url';
  inputWebFontCssUrl.className = 'esj-setting-input';
  inputWebFontCssUrl.placeholder = 'Web Font CSS URL';
  inputWebFontCssUrl.setAttribute('aria-label', 'Web Font CSS URL');
  const inputWebFontFamily = document.createElement('input');
  inputWebFontFamily.type = 'text';
  inputWebFontFamily.className = 'esj-setting-input';
  inputWebFontFamily.placeholder = 'font-family';
  inputWebFontFamily.setAttribute('aria-label', 'Web Font font-family');
  const btnApplyWebFont = document.createElement('button');
  btnApplyWebFont.type = 'button';
  btnApplyWebFont.className = 'esj-setting-btn esj-font-web-apply-btn';
  btnApplyWebFont.textContent = '套用';
  fontWebControls.appendChild(fontWebPresets);
  fontWebControls.appendChild(inputWebFontCssUrl);
  fontWebControls.appendChild(inputWebFontFamily);
  fontWebControls.appendChild(btnApplyWebFont);
  fontSection.appendChild(fontWebControls);
  readerSettingsSection.appendChild(fontSection);
  
  const otherSettingsSection = document.createElement('section');
  otherSettingsSection.className = 'esj-drawer-other-settings';
  otherSettingsSection.setAttribute('aria-label', '其他設定');
  const otherSettingsTitle = document.createElement('div');
  otherSettingsTitle.className = 'esj-drawer-reader-settings-title';
  otherSettingsTitle.textContent = '其他設定';
  
  const fullscreenPromptRow = document.createElement('div');
  fullscreenPromptRow.className = 'esj-setting-row esj-setting-checkbox-row';
  const fullscreenPromptLabel = document.createElement('div');
  fullscreenPromptLabel.className = 'esj-setting-label';
  const fullscreenPromptLabelText = document.createElement('span');
  fullscreenPromptLabelText.textContent = '全螢幕提示';
  fullscreenPromptLabel.appendChild(fullscreenPromptLabelText);
  
  const btnFullscreenPromptToggle = document.createElement('button');
  btnFullscreenPromptToggle.type = 'button';
  btnFullscreenPromptToggle.className = 'esj-setting-btn esj-setting-checkbox-btn';
  btnFullscreenPromptToggle.setAttribute('aria-label', '全螢幕提示');
  btnFullscreenPromptToggle.setAttribute('aria-pressed', 'true');
  const iconFullscreenPromptCheckEl = iconCheck(18);
  btnFullscreenPromptToggle.appendChild(iconFullscreenPromptCheckEl);
  
  const fullscreenPromptControls = document.createElement('div');
  fullscreenPromptControls.className = 'esj-setting-controls';
  fullscreenPromptControls.appendChild(btnFullscreenPromptToggle);
  
  fullscreenPromptRow.appendChild(fullscreenPromptLabel);
  fullscreenPromptRow.appendChild(fullscreenPromptControls);
  otherSettingsSection.appendChild(otherSettingsTitle);
  
  const removeSingleEmptyRow = document.createElement('div');
  removeSingleEmptyRow.className = 'esj-setting-row esj-setting-checkbox-row';
  const removeSingleEmptyLabel = document.createElement('div');
  removeSingleEmptyLabel.className = 'esj-setting-label';
  const removeSingleEmptyLabelText = document.createElement('span');
  removeSingleEmptyLabelText.textContent = '去除空段落';
  removeSingleEmptyLabel.appendChild(removeSingleEmptyLabelText);
  
  const btnRemoveSingleEmptyToggle = document.createElement('button');
  btnRemoveSingleEmptyToggle.type = 'button';
  btnRemoveSingleEmptyToggle.className = 'esj-setting-btn esj-setting-checkbox-btn';
  btnRemoveSingleEmptyToggle.setAttribute('aria-label', '去除空段落');
  btnRemoveSingleEmptyToggle.setAttribute('aria-pressed', 'false');
  const iconRemoveSingleEmptyCheckEl = iconCheck(18);
  iconRemoveSingleEmptyCheckEl.style.display = 'none';
  btnRemoveSingleEmptyToggle.appendChild(iconRemoveSingleEmptyCheckEl);
  
  const removeSingleEmptyControls = document.createElement('div');
  removeSingleEmptyControls.className = 'esj-setting-controls';
  removeSingleEmptyControls.appendChild(btnRemoveSingleEmptyToggle);
  
  removeSingleEmptyRow.appendChild(removeSingleEmptyLabel);
  removeSingleEmptyRow.appendChild(removeSingleEmptyControls);
  otherSettingsSection.appendChild(removeSingleEmptyRow);
  
  otherSettingsSection.appendChild(fullscreenPromptRow);
  readerSettingsSection.appendChild(otherSettingsSection);
  
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

  const readerAdjustOverlay = document.createElement('div');
  readerAdjustOverlay.id = 'esj-reader-adjust-overlay';
  readerAdjustOverlay.setAttribute('role', 'dialog');
  readerAdjustOverlay.setAttribute('aria-modal', 'true');
  readerAdjustOverlay.setAttribute('aria-hidden', 'true');

  const readerAdjustBackdrop = document.createElement('div');
  readerAdjustBackdrop.className = 'esj-reader-adjust-backdrop';

  const readerAdjustPanel = document.createElement('div');
  readerAdjustPanel.className = 'esj-reader-adjust-panel';

  const readerAdjustTitle = document.createElement('div');
  readerAdjustTitle.className = 'esj-reader-adjust-title';
  readerAdjustTitle.textContent = '閱讀參數調整';

  function makeAdjustRow(labelText: string): {
    row: HTMLDivElement;
    valueEl: HTMLSpanElement;
    decBtn: HTMLButtonElement;
    rangeEl: HTMLInputElement;
    incBtn: HTMLButtonElement;
  } {
    const row = document.createElement('div');
    row.className = 'esj-reader-adjust-item';
    const label = document.createElement('div');
    label.className = 'esj-reader-adjust-item-label';
    label.textContent = labelText;
    const valueEl = document.createElement('span');
    valueEl.className = 'esj-reader-adjust-item-value';
    valueEl.textContent = '-';
    label.appendChild(valueEl);

    const controls = document.createElement('div');
    controls.className = 'esj-reader-adjust-row';
    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'esj-reader-adjust-btn';
    decBtn.setAttribute('aria-label', `${labelText}減少`);
    decBtn.appendChild(iconMinus(18));
    const rangeEl = document.createElement('input');
    rangeEl.type = 'range';
    rangeEl.className = 'esj-reader-adjust-range';
    rangeEl.step = '1';
    rangeEl.min = '0';
    rangeEl.max = '100';
    rangeEl.value = '50';
    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'esj-reader-adjust-btn';
    incBtn.setAttribute('aria-label', `${labelText}增加`);
    incBtn.appendChild(iconPlus(18));
    controls.appendChild(decBtn);
    controls.appendChild(rangeEl);
    controls.appendChild(incBtn);
    row.appendChild(label);
    row.appendChild(controls);
    return { row, valueEl, decBtn, rangeEl, incBtn };
  }

  const adjustFontRow = makeAdjustRow('字級');
  const adjustLineHeightRow = makeAdjustRow('行高');
  const adjustParaSpacingRow = makeAdjustRow('段距');
  const adjustPagePaddingXRow = makeAdjustRow('左右邊距');
  const adjustPagePaddingYRow = makeAdjustRow('上下邊距');
  const adjustPageMaxWidthRow = makeAdjustRow('最大寬度');
  readerAdjustPanel.appendChild(readerAdjustTitle);
  readerAdjustPanel.appendChild(adjustFontRow.row);
  readerAdjustPanel.appendChild(adjustLineHeightRow.row);
  readerAdjustPanel.appendChild(adjustParaSpacingRow.row);
  readerAdjustPanel.appendChild(adjustPagePaddingXRow.row);
  readerAdjustPanel.appendChild(adjustPagePaddingYRow.row);
  readerAdjustPanel.appendChild(adjustPageMaxWidthRow.row);
  const readerAdjustActions = document.createElement('div');
  readerAdjustActions.className = 'esj-reader-adjust-actions';
  const btnReaderAdjustCancel = document.createElement('button');
  btnReaderAdjustCancel.type = 'button';
  btnReaderAdjustCancel.id = 'esj-reader-adjust-cancel';
  btnReaderAdjustCancel.textContent = '取消';
  const btnReaderAdjustApply = document.createElement('button');
  btnReaderAdjustApply.type = 'button';
  btnReaderAdjustApply.id = 'esj-reader-adjust-apply';
  btnReaderAdjustApply.textContent = '確定';
  readerAdjustActions.appendChild(btnReaderAdjustCancel);
  readerAdjustActions.appendChild(btnReaderAdjustApply);
  readerAdjustPanel.appendChild(readerAdjustActions);
  readerAdjustOverlay.appendChild(readerAdjustBackdrop);
  readerAdjustOverlay.appendChild(readerAdjustPanel);

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

  const fullscreenPromptOverlay = document.createElement('div');
  fullscreenPromptOverlay.id = 'esj-fullscreen-prompt-overlay';
  fullscreenPromptOverlay.setAttribute('role', 'dialog');
  fullscreenPromptOverlay.setAttribute('aria-modal', 'true');
  fullscreenPromptOverlay.setAttribute('aria-hidden', 'true');

  const fullscreenPromptBackdrop = document.createElement('div');
  fullscreenPromptBackdrop.className = 'esj-fullscreen-prompt-backdrop';

  const fullscreenPromptPanel = document.createElement('div');
  fullscreenPromptPanel.className = 'esj-fullscreen-prompt-panel';

  const fullscreenPromptTitle = document.createElement('div');
  fullscreenPromptTitle.className = 'esj-fullscreen-prompt-title';
  fullscreenPromptTitle.textContent = '進入全螢幕模式？';

  const fullscreenPromptMessage = document.createElement('div');
  fullscreenPromptMessage.className = 'esj-fullscreen-prompt-message';
  fullscreenPromptMessage.textContent = '全螢幕模式可提供更好的閱讀體驗';

  const fullscreenPromptActions = document.createElement('div');
  fullscreenPromptActions.className = 'esj-fullscreen-prompt-actions';

  const btnFullscreenPromptCancel = document.createElement('button');
  btnFullscreenPromptCancel.type = 'button';
  btnFullscreenPromptCancel.id = 'esj-fullscreen-prompt-cancel';
  btnFullscreenPromptCancel.textContent = '取消';

  const btnFullscreenPromptConfirm = document.createElement('button');
  btnFullscreenPromptConfirm.type = 'button';
  btnFullscreenPromptConfirm.id = 'esj-fullscreen-prompt-confirm';
  btnFullscreenPromptConfirm.textContent = '確定';

  fullscreenPromptActions.appendChild(btnFullscreenPromptCancel);
  fullscreenPromptActions.appendChild(btnFullscreenPromptConfirm);

  fullscreenPromptPanel.appendChild(fullscreenPromptTitle);
  fullscreenPromptPanel.appendChild(fullscreenPromptMessage);
  fullscreenPromptPanel.appendChild(fullscreenPromptActions);

  fullscreenPromptOverlay.appendChild(fullscreenPromptBackdrop);
  fullscreenPromptOverlay.appendChild(fullscreenPromptPanel);

  readerRoot.appendChild(canvasWrap);
  readerRoot.appendChild(header);
  readerRoot.appendChild(footer);
  readerRoot.appendChild(drawerOverlay);
  readerRoot.appendChild(readerAdjustOverlay);
  readerRoot.appendChild(pageJumpOverlay);
  readerRoot.appendChild(fullscreenPromptOverlay);

  return {
    style,
    readerRoot,
    header,
    btnHeaderMenu,
    iconHeaderMenu,
    btnHeaderFullscreen,
    iconHeaderFullscreenExpand,
    iconHeaderFullscreenShrink,
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
    readerSettingPagePaddingXValue: pagePaddingRow.valueEl,
    readerSettingPagePaddingYValue: pagePaddingYRow.valueEl,
    readerSettingPageMaxWidthValue: pageMaxWidthRow.valueEl,
    btnReaderSettingsAdjust,
    btnReaderSettingsDropdown,
    iconReaderSettingsChevronDownEl,
    iconReaderSettingsChevronUpEl,
    readerSettingsContent,
    btnProfileSave,
    btnProfileRestore,
    btnProfileDropdown,
    iconProfileChevronDownEl,
    iconProfileChevronUpEl,
    profileContent,
    profileFontValue: profileFontRow.valueEl,
    profileLineHeightValue: profileLineHeightRow.valueEl,
    profileParaSpacingValue: profileParaSpacingRow.valueEl,
    profilePagePaddingXValue: profilePagePaddingXRow.valueEl,
    profilePagePaddingYValue: profilePagePaddingYRow.valueEl,
    profilePageMaxWidthValue: profilePageMaxWidthRow.valueEl,
    profileRemoveSingleEmptyValue: profileRemoveSingleEmptyRow.valueEl,
    selectFontSource,
    fontLocalRow: localFontRow,
    selectLocalFont,
    fontWebControls,
    inputWebFontCssUrl,
    inputWebFontFamily,
    btnApplyWebFont,
    btnRemoveSingleEmptyToggle,
    iconRemoveSingleEmptyCheckEl,
    btnFullscreenPromptToggle,
    iconFullscreenPromptCheckEl,
    readerAdjustOverlay,
    readerAdjustBackdrop,
    readerAdjustPanel,
    readerAdjustFontValue: adjustFontRow.valueEl,
    btnReaderAdjustFontDec: adjustFontRow.decBtn,
    rangeReaderAdjustFont: adjustFontRow.rangeEl,
    btnReaderAdjustFontInc: adjustFontRow.incBtn,
    readerAdjustLineHeightValue: adjustLineHeightRow.valueEl,
    btnReaderAdjustLineHeightDec: adjustLineHeightRow.decBtn,
    rangeReaderAdjustLineHeight: adjustLineHeightRow.rangeEl,
    btnReaderAdjustLineHeightInc: adjustLineHeightRow.incBtn,
    readerAdjustParaSpacingValue: adjustParaSpacingRow.valueEl,
    btnReaderAdjustParaSpacingDec: adjustParaSpacingRow.decBtn,
    rangeReaderAdjustParaSpacing: adjustParaSpacingRow.rangeEl,
    btnReaderAdjustParaSpacingInc: adjustParaSpacingRow.incBtn,
    readerAdjustPagePaddingXValue: adjustPagePaddingXRow.valueEl,
    btnReaderAdjustPagePaddingXDec: adjustPagePaddingXRow.decBtn,
    rangeReaderAdjustPagePaddingX: adjustPagePaddingXRow.rangeEl,
    btnReaderAdjustPagePaddingXInc: adjustPagePaddingXRow.incBtn,
    readerAdjustPagePaddingYValue: adjustPagePaddingYRow.valueEl,
    btnReaderAdjustPagePaddingYDec: adjustPagePaddingYRow.decBtn,
    rangeReaderAdjustPagePaddingY: adjustPagePaddingYRow.rangeEl,
    btnReaderAdjustPagePaddingYInc: adjustPagePaddingYRow.incBtn,
    readerAdjustPageMaxWidthValue: adjustPageMaxWidthRow.valueEl,
    btnReaderAdjustPageMaxWidthDec: adjustPageMaxWidthRow.decBtn,
    rangeReaderAdjustPageMaxWidth: adjustPageMaxWidthRow.rangeEl,
    btnReaderAdjustPageMaxWidthInc: adjustPageMaxWidthRow.incBtn,
    btnReaderAdjustCancel,
    btnReaderAdjustApply,
    pageJumpOverlay,
    pageJumpBackdrop,
    pageJumpPanel,
    pageJumpInput,
    pageJumpTotalEl,
    pageJumpCancel,
    pageJumpOk,
    fullscreenPromptOverlay,
    fullscreenPromptBackdrop,
    fullscreenPromptPanel,
    btnFullscreenPromptCancel,
    btnFullscreenPromptConfirm,
  };
}
