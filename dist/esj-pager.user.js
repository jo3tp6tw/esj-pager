// ==UserScript==
// @name         ESJ Zone 翻頁閱讀
// @namespace    esj-pager
// @version      0.1.0
// @description  將 ESJ Zone 閱讀改為翻頁模式（開發中）
// @match        https://www.esjzone.cc/forum/*
// @match        https://www.esjzone.cc/detail/*
// @match        https://www.esjzone.one/forum/*
// @match        https://www.esjzone.one/detail/*
// @match        https://www.esjzone.me/forum/*
// @match        https://www.esjzone.me/detail/*
// @grant        none
// @license      MIT
// ==/UserScript==


"use strict";
(() => {
  // src/extract.ts
  function extractBlocksFromHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    temp.querySelectorAll("script, style, iframe, .ads, .ad").forEach((el) => el.remove());
    const blocks = [];
    const paragraphParts = [];
    const HARD_BREAK_TAGS = /* @__PURE__ */ new Set([
      "P",
      "DIV",
      "LI",
      "SECTION",
      "ARTICLE",
      "BLOCKQUOTE",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6"
    ]);
    const flushParagraph = (allowEmpty = false) => {
      if (paragraphParts.length === 0) {
        if (allowEmpty) {
          blocks.push({ type: "paragraph", text: "" });
        }
        return;
      }
      const text = paragraphParts.join("");
      paragraphParts.length = 0;
      if (!text.trim() && !allowEmpty) return;
      blocks.push({ type: "paragraph", text });
    };
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const raw = child.textContent ?? "";
          if (raw.trim()) paragraphParts.push(raw);
        } else if (child instanceof HTMLElement) {
          if (child.tagName === "BR") {
            flushParagraph(true);
          } else if (child.tagName === "IMG") {
            flushParagraph();
            const img = child;
            const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
            if (src) blocks.push({ type: "img", src });
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

  // src/pagination.ts
  function bottomY(layout) {
    return layout.pad + layout.maxHeight;
  }
  function walkOnePage(ctx, blocks, start, layout, draw) {
    let y = layout.pad;
    let bi = start.bi;
    let off = start.off;
    if (bi >= blocks.length) return null;
    while (bi < blocks.length) {
      const block = blocks[bi];
      if (block.type === "img") {
        const tag = "[\u5716\u7247]";
        const bot2 = bottomY(layout);
        if (y + layout.linePx > bot2 && y > layout.pad) {
          return { bi, off: 0 };
        }
        if (draw) ctx.fillText(tag, layout.pad, y);
        y += layout.linePx + layout.paraSpacing;
        bi += 1;
        off = 0;
        continue;
      }
      const text = block.text;
      if (text.length === 0) {
        const bot2 = bottomY(layout);
        if (y + layout.paraSpacing > bot2) {
          return { bi: bi + 1, off: 0 };
        }
        y += layout.paraSpacing;
        bi += 1;
        off = 0;
        continue;
      }
      const remainder = text.slice(off);
      const lines = wrapByChar(ctx, remainder, layout.maxWidth);
      for (let i = 0; i < lines.length; i++) {
        if (y + layout.linePx > bottomY(layout)) {
          let newOff = off;
          for (let j = 0; j < i; j++) newOff += lines[j].length;
          return { bi, off: newOff };
        }
        if (draw) ctx.fillText(lines[i], layout.pad, y);
        y += layout.linePx;
      }
      const bot = bottomY(layout);
      if (y + layout.paraSpacing > bot) {
        return { bi: bi + 1, off: 0 };
      }
      y += layout.paraSpacing;
      bi += 1;
      off = 0;
    }
    return null;
  }
  function buildPageStarts(ctx, blocks, layout) {
    if (blocks.length === 0) return [];
    const starts = [];
    let cur = { bi: 0, off: 0 };
    const maxPages = Math.max(100, blocks.length * 20);
    for (let n = 0; n < maxPages; n++) {
      starts.push({ ...cur });
      const next = walkOnePage(ctx, blocks, cur, layout, false);
      if (next === null) break;
      if (next.bi === cur.bi && next.off === cur.off) break;
      cur = next;
    }
    return starts;
  }
  function wrapByChar(ctx, text, maxWidth) {
    if (!text) return [];
    if (maxWidth <= 0) return [text];
    const lines = [];
    let line = "";
    let width = 0;
    for (const ch of text) {
      const chWidth = ctx.measureText(ch).width;
      if (line && width + chWidth > maxWidth) {
        lines.push(line);
        line = ch;
        width = chWidth;
      } else {
        line += ch;
        width += chWidth;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // src/site.ts
  var SELECTORS = {
    forumContent: ".forum-content",
    title: "h2, .forum-content-title"
  };
  function getForumContent() {
    return document.querySelector(SELECTORS.forumContent);
  }
  function getChapterTitle() {
    const el = document.querySelector(SELECTORS.title);
    const fromDom = el?.textContent?.trim();
    return fromDom || document.title;
  }
  function getAdjacentChapterHrefs() {
    const links = [...document.querySelectorAll("a")];
    const prev = links.find((a) => a.textContent?.includes("\u4E0A\u4E00\u7BC7"))?.href ?? "";
    const next = links.find((a) => a.textContent?.includes("\u4E0B\u4E00\u7BC7"))?.href ?? "";
    return { prev, next };
  }
  function getNovelDetailHref() {
    const m = window.location.pathname.match(/\/forum\/(\d+)\//);
    if (!m) return "";
    return `${window.location.origin}/detail/${m[1]}`;
  }

  // node_modules/lucide/dist/esm/defaultAttributes.js
  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  };

  // node_modules/lucide/dist/esm/createElement.js
  var createSVGElement = ([tag, attrs, children]) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach((name) => {
      element.setAttribute(name, String(attrs[name]));
    });
    if (children?.length) {
      children.forEach((child) => {
        const childElement = createSVGElement(child);
        element.appendChild(childElement);
      });
    }
    return element;
  };
  var createElement = (iconNode, customAttrs = {}) => {
    const tag = "svg";
    const attrs = {
      ...defaultAttributes,
      ...customAttrs
    };
    return createSVGElement([tag, attrs, iconNode]);
  };

  // node_modules/lucide/dist/esm/icons/a-arrow-down.js
  var AArrowDown = [
    ["path", { d: "m14 12 4 4 4-4" }],
    ["path", { d: "M18 16V7" }],
    ["path", { d: "m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" }],
    ["path", { d: "M3.304 13h6.392" }]
  ];

  // node_modules/lucide/dist/esm/icons/a-arrow-up.js
  var AArrowUp = [
    ["path", { d: "m14 11 4-4 4 4" }],
    ["path", { d: "M18 16V7" }],
    ["path", { d: "m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" }],
    ["path", { d: "M3.304 13h6.392" }]
  ];

  // node_modules/lucide/dist/esm/icons/a-large-small.js
  var ALargeSmall = [
    ["path", { d: "m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16" }],
    ["path", { d: "M15.697 14h5.606" }],
    ["path", { d: "m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" }],
    ["path", { d: "M3.304 13h6.392" }]
  ];

  // node_modules/lucide/dist/esm/icons/chevrons-left.js
  var ChevronsLeft = [
    ["path", { d: "m11 17-5-5 5-5" }],
    ["path", { d: "m18 17-5-5 5-5" }]
  ];

  // node_modules/lucide/dist/esm/icons/chevrons-right.js
  var ChevronsRight = [
    ["path", { d: "m6 17 5-5-5-5" }],
    ["path", { d: "m13 17 5-5-5-5" }]
  ];

  // node_modules/lucide/dist/esm/icons/diff.js
  var Diff = [
    ["path", { d: "M12 3v14" }],
    ["path", { d: "M5 10h14" }],
    ["path", { d: "M5 21h14" }]
  ];

  // node_modules/lucide/dist/esm/icons/menu.js
  var Menu = [
    ["path", { d: "M4 5h16" }],
    ["path", { d: "M4 12h16" }],
    ["path", { d: "M4 19h16" }]
  ];

  // node_modules/lucide/dist/esm/icons/minus.js
  var Minus = [["path", { d: "M5 12h14" }]];

  // node_modules/lucide/dist/esm/icons/move-left.js
  var MoveLeft = [
    ["path", { d: "M6 8L2 12L6 16" }],
    ["path", { d: "M2 12H22" }]
  ];

  // node_modules/lucide/dist/esm/icons/move-right.js
  var MoveRight = [
    ["path", { d: "M18 8L22 12L18 16" }],
    ["path", { d: "M2 12H22" }]
  ];

  // node_modules/lucide/dist/esm/icons/pen-line.js
  var PenLine = [
    ["path", { d: "M13 21h8" }],
    [
      "path",
      {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
      }
    ]
  ];

  // node_modules/lucide/dist/esm/icons/plus.js
  var Plus = [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "M12 5v14" }]
  ];

  // node_modules/lucide/dist/esm/icons/square-check.js
  var SquareCheck = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
    ["path", { d: "m9 12 2 2 4-4" }]
  ];

  // node_modules/lucide/dist/esm/icons/square.js
  var Square = [["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }]];

  // node_modules/lucide/dist/esm/icons/table-of-contents.js
  var TableOfContents = [
    ["path", { d: "M16 5H3" }],
    ["path", { d: "M16 12H3" }],
    ["path", { d: "M16 19H3" }],
    ["path", { d: "M21 5h.01" }],
    ["path", { d: "M21 12h.01" }],
    ["path", { d: "M21 19h.01" }]
  ];

  // src/lucideIcons.ts
  function makeIcon(icon, size) {
    return createElement(icon, {
      width: size,
      height: size,
      class: "esj-lucide-icon"
    });
  }
  function iconPrevChapter(size = 20) {
    return makeIcon(ChevronsLeft, size);
  }
  function iconNextChapter(size = 20) {
    return makeIcon(ChevronsRight, size);
  }
  function iconPrevPage(size = 22) {
    return makeIcon(MoveLeft, size);
  }
  function iconNextPage(size = 22) {
    return makeIcon(MoveRight, size);
  }
  function iconMenu(size = 22) {
    return makeIcon(Menu, size);
  }
  function iconTableOfContents(size = 22) {
    return makeIcon(TableOfContents, size);
  }
  function iconFontSize(size = 18) {
    return makeIcon(ALargeSmall, size);
  }
  function iconDiff(size = 18) {
    return makeIcon(Diff, size);
  }
  function iconAArrowUp(size = 18) {
    return makeIcon(AArrowUp, size);
  }
  function iconAArrowDown(size = 18) {
    return makeIcon(AArrowDown, size);
  }
  function iconPlus(size = 18) {
    return makeIcon(Plus, size);
  }
  function iconMinus(size = 18) {
    return makeIcon(Minus, size);
  }
  function iconPenLine(size = 18) {
    return makeIcon(PenLine, size);
  }
  function iconSquare(size = 18) {
    return makeIcon(Square, size);
  }
  function iconSquareCheck(size = 18) {
    return makeIcon(SquareCheck, size);
  }

  // src/reader/dom.ts
  function createReaderDom(title, novelDetailHref, chapterNav) {
    const style = document.createElement("style");
    const readerRoot = document.createElement("div");
    readerRoot.id = "esj-reader-root";
    const header = document.createElement("div");
    header.id = "esj-reader-header";
    const btnHeaderMenu = document.createElement("button");
    btnHeaderMenu.type = "button";
    btnHeaderMenu.className = "esj-header-menu-btn";
    btnHeaderMenu.id = "esj-header-menu-btn";
    btnHeaderMenu.setAttribute("aria-label", "\u9078\u55AE");
    btnHeaderMenu.setAttribute("aria-expanded", "false");
    btnHeaderMenu.setAttribute("aria-controls", "esj-reader-drawer");
    const iconHeaderMenu = iconMenu();
    btnHeaderMenu.appendChild(iconHeaderMenu);
    const headerTitle = document.createElement("div");
    headerTitle.id = "esj-reader-header-title";
    headerTitle.textContent = title;
    const headerPage = document.createElement("div");
    headerPage.id = "esj-reader-header-page";
    const headerPageLabel = document.createElement("span");
    headerPageLabel.id = "esj-header-page-label";
    headerPageLabel.textContent = "1 / 1";
    headerPage.appendChild(headerPageLabel);
    header.appendChild(btnHeaderMenu);
    header.appendChild(headerTitle);
    header.appendChild(headerPage);
    const drawerOverlay = document.createElement("div");
    drawerOverlay.id = "esj-reader-drawer";
    drawerOverlay.setAttribute("role", "dialog");
    drawerOverlay.setAttribute("aria-modal", "true");
    drawerOverlay.setAttribute("aria-hidden", "true");
    drawerOverlay.setAttribute("aria-label", "\u9078\u55AE");
    const drawerBackdrop = document.createElement("div");
    drawerBackdrop.className = "esj-drawer-backdrop";
    const drawerPanel = document.createElement("aside");
    drawerPanel.className = "esj-drawer-panel";
    let iconTocEl = null;
    if (novelDetailHref) {
      const drawerNav = document.createElement("nav");
      drawerNav.className = "esj-drawer-nav";
      drawerNav.setAttribute("aria-label", "\u76EE\u9304");
      const tocLinkDrawer = document.createElement("a");
      tocLinkDrawer.className = "esj-drawer-toc-row";
      tocLinkDrawer.href = novelDetailHref;
      tocLinkDrawer.setAttribute("aria-label", "\u7AE0\u7BC0\u76EE\u9304");
      iconTocEl = iconTableOfContents();
      tocLinkDrawer.appendChild(iconTocEl);
      drawerNav.appendChild(tocLinkDrawer);
      drawerPanel.appendChild(drawerNav);
    }
    const readerSettingsSection = document.createElement("section");
    readerSettingsSection.className = "esj-drawer-reader-settings";
    readerSettingsSection.setAttribute("aria-label", "\u95B1\u8B80\u8A2D\u5B9A");
    const readerSettingsTitle = document.createElement("div");
    readerSettingsTitle.className = "esj-drawer-reader-settings-title";
    readerSettingsTitle.textContent = "\u95B1\u8B80\u8A2D\u5B9A";
    readerSettingsSection.appendChild(readerSettingsTitle);
    function makeSettingRow(labelText, iconLeft, decIcon, incIcon, decAriaLabel, incAriaLabel) {
      const row = document.createElement("div");
      row.className = "esj-setting-row";
      const labelWrap = document.createElement("div");
      labelWrap.className = "esj-setting-label";
      labelWrap.appendChild(iconLeft);
      const labelTextEl = document.createElement("span");
      labelTextEl.textContent = labelText;
      labelWrap.appendChild(labelTextEl);
      const controls = document.createElement("div");
      controls.className = "esj-setting-controls";
      const decBtn = document.createElement("button");
      decBtn.type = "button";
      decBtn.className = "esj-setting-btn";
      decBtn.setAttribute("aria-label", decAriaLabel);
      decBtn.appendChild(decIcon);
      const valueEl = document.createElement("span");
      valueEl.className = "esj-setting-value";
      valueEl.textContent = "-";
      const incBtn = document.createElement("button");
      incBtn.type = "button";
      incBtn.className = "esj-setting-btn";
      incBtn.setAttribute("aria-label", incAriaLabel);
      incBtn.appendChild(incIcon);
      controls.appendChild(decBtn);
      controls.appendChild(valueEl);
      controls.appendChild(incBtn);
      row.appendChild(labelWrap);
      row.appendChild(controls);
      return { row, valueEl, decBtn, incBtn };
    }
    const fontRow = makeSettingRow(
      "\u5B57\u7D1A",
      iconFontSize(18),
      iconAArrowDown(18),
      iconAArrowUp(18),
      "\u5B57\u7D1A\u8B8A\u5C0F",
      "\u5B57\u7D1A\u8B8A\u5927"
    );
    const lineHeightRow = makeSettingRow(
      "\u884C\u9AD8",
      iconDiff(18),
      iconMinus(18),
      iconPlus(18),
      "\u884C\u9AD8\u6E1B\u5C11",
      "\u884C\u9AD8\u589E\u52A0"
    );
    const paraSpacingRow = makeSettingRow(
      "\u6BB5\u8DDD",
      iconDiff(18),
      iconMinus(18),
      iconPlus(18),
      "\u6BB5\u8DDD\u6E1B\u5C11",
      "\u6BB5\u8DDD\u589E\u52A0"
    );
    const pagePaddingRow = makeSettingRow(
      "\u9801\u908A\u8DDD",
      iconDiff(18),
      iconMinus(18),
      iconPlus(18),
      "\u9801\u908A\u8DDD\u6E1B\u5C11",
      "\u9801\u908A\u8DDD\u589E\u52A0"
    );
    readerSettingsSection.appendChild(fontRow.row);
    readerSettingsSection.appendChild(lineHeightRow.row);
    readerSettingsSection.appendChild(paraSpacingRow.row);
    readerSettingsSection.appendChild(pagePaddingRow.row);
    const removeSingleEmptyRow = document.createElement("button");
    removeSingleEmptyRow.type = "button";
    removeSingleEmptyRow.className = "esj-setting-toggle-row";
    removeSingleEmptyRow.setAttribute("aria-label", "\u53BB\u9664\u7A7A\u6BB5\u843D");
    removeSingleEmptyRow.setAttribute("aria-pressed", "false");
    const removeSingleEmptyLabel = document.createElement("div");
    removeSingleEmptyLabel.className = "esj-setting-label";
    const removeSingleEmptyLabelText = document.createElement("span");
    removeSingleEmptyLabelText.textContent = "\u53BB\u9664\u7A7A\u6BB5\u843D";
    removeSingleEmptyLabel.appendChild(removeSingleEmptyLabelText);
    const removeSingleEmptyIconWrap = document.createElement("span");
    removeSingleEmptyIconWrap.className = "esj-setting-toggle-icon";
    const iconRemoveSingleEmptyOffEl = iconSquare(18);
    const iconRemoveSingleEmptyOnEl = iconSquareCheck(18);
    iconRemoveSingleEmptyOnEl.style.display = "none";
    removeSingleEmptyIconWrap.appendChild(iconRemoveSingleEmptyOffEl);
    removeSingleEmptyIconWrap.appendChild(iconRemoveSingleEmptyOnEl);
    removeSingleEmptyRow.appendChild(removeSingleEmptyLabel);
    removeSingleEmptyRow.appendChild(removeSingleEmptyIconWrap);
    readerSettingsSection.appendChild(removeSingleEmptyRow);
    drawerPanel.appendChild(readerSettingsSection);
    drawerOverlay.appendChild(drawerBackdrop);
    drawerOverlay.appendChild(drawerPanel);
    const canvasWrap = document.createElement("div");
    canvasWrap.id = "esj-reader-canvas-wrap";
    const canvas = document.createElement("canvas");
    canvas.id = "esj-reader-canvas";
    canvasWrap.appendChild(canvas);
    const canvasTapLayer = document.createElement("div");
    canvasTapLayer.id = "esj-canvas-tap-layer";
    const btnTapPrevPage = document.createElement("button");
    btnTapPrevPage.type = "button";
    btnTapPrevPage.className = "esj-canvas-tap-btn esj-canvas-tap-prev";
    btnTapPrevPage.setAttribute("aria-label", "\u4E0A\u9801\uFF08\u9EDE\u64CA\u95B1\u8B80\u5340\u5DE6\u5074\uFF09");
    btnTapPrevPage.tabIndex = -1;
    const btnTapChrome = document.createElement("button");
    btnTapChrome.type = "button";
    btnTapChrome.className = "esj-canvas-tap-btn esj-canvas-tap-chrome";
    btnTapChrome.setAttribute("aria-label", "\u986F\u793A\u6216\u96B1\u85CF\u9802\u6B04\u8207\u5E95\u6B04");
    btnTapChrome.tabIndex = -1;
    const btnTapNextPage = document.createElement("button");
    btnTapNextPage.type = "button";
    btnTapNextPage.className = "esj-canvas-tap-btn esj-canvas-tap-next";
    btnTapNextPage.setAttribute("aria-label", "\u4E0B\u9801\uFF08\u9EDE\u64CA\u95B1\u8B80\u5340\u53F3\u5074\uFF09");
    btnTapNextPage.tabIndex = -1;
    canvasTapLayer.appendChild(btnTapPrevPage);
    canvasTapLayer.appendChild(btnTapChrome);
    canvasTapLayer.appendChild(btnTapNextPage);
    canvasWrap.appendChild(canvasTapLayer);
    const footer = document.createElement("div");
    footer.id = "esj-reader-footer";
    const btnPrevChap = document.createElement("button");
    btnPrevChap.type = "button";
    btnPrevChap.id = "esj-reader-btn-prev-chap";
    btnPrevChap.className = "esj-footer-chap";
    btnPrevChap.setAttribute("aria-label", "\u4E0A\u4E00\u7AE0");
    const iconPrevChapEl = iconPrevChapter();
    btnPrevChap.appendChild(iconPrevChapEl);
    btnPrevChap.disabled = !chapterNav.prev;
    const btnPrevPage = document.createElement("button");
    btnPrevPage.type = "button";
    btnPrevPage.id = "esj-reader-btn-prev-page";
    btnPrevPage.className = "esj-footer-page";
    btnPrevPage.setAttribute("aria-label", "\u4E0A\u9801");
    const iconPrevPageEl = iconPrevPage();
    btnPrevPage.appendChild(iconPrevPageEl);
    const footerPageCell = document.createElement("div");
    footerPageCell.className = "esj-footer-pagecell";
    footerPageCell.id = "esj-footer-pagecell";
    const footerPageDisplay = document.createElement("div");
    footerPageDisplay.id = "esj-footer-page-display";
    const footerPageCur = document.createElement("span");
    footerPageCur.id = "esj-footer-page-cur";
    footerPageCur.textContent = "1";
    const footerPageSep = document.createElement("span");
    footerPageSep.className = "esj-footer-page-sep";
    footerPageSep.textContent = "/";
    const footerPageTotal = document.createElement("span");
    footerPageTotal.id = "esj-footer-page-total";
    footerPageTotal.textContent = "1";
    footerPageDisplay.appendChild(footerPageCur);
    footerPageDisplay.appendChild(footerPageSep);
    footerPageDisplay.appendChild(footerPageTotal);
    const btnFooterPageJump = document.createElement("button");
    btnFooterPageJump.type = "button";
    btnFooterPageJump.id = "esj-footer-page-jump";
    btnFooterPageJump.className = "esj-footer-page-jump-btn";
    btnFooterPageJump.setAttribute("aria-label", "\u8DF3\u8F49\u9801\u78BC");
    const iconFooterPageJumpEl = iconPenLine();
    btnFooterPageJump.appendChild(iconFooterPageJumpEl);
    footerPageCell.appendChild(footerPageDisplay);
    footerPageCell.appendChild(btnFooterPageJump);
    const btnNextPage = document.createElement("button");
    btnNextPage.type = "button";
    btnNextPage.id = "esj-reader-btn-next-page";
    btnNextPage.className = "esj-footer-page";
    btnNextPage.setAttribute("aria-label", "\u4E0B\u9801");
    const iconNextPageEl = iconNextPage();
    btnNextPage.appendChild(iconNextPageEl);
    const btnNextChap = document.createElement("button");
    btnNextChap.type = "button";
    btnNextChap.id = "esj-reader-btn-next-chap";
    btnNextChap.className = "esj-footer-chap";
    btnNextChap.setAttribute("aria-label", "\u4E0B\u4E00\u7AE0");
    const iconNextChapEl = iconNextChapter();
    btnNextChap.appendChild(iconNextChapEl);
    btnNextChap.disabled = !chapterNav.next;
    footer.appendChild(btnPrevChap);
    footer.appendChild(btnPrevPage);
    footer.appendChild(footerPageCell);
    footer.appendChild(btnNextPage);
    footer.appendChild(btnNextChap);
    const pageJumpOverlay = document.createElement("div");
    pageJumpOverlay.id = "esj-page-jump-overlay";
    pageJumpOverlay.setAttribute("role", "dialog");
    pageJumpOverlay.setAttribute("aria-modal", "true");
    pageJumpOverlay.setAttribute("aria-hidden", "true");
    const pageJumpBackdrop = document.createElement("div");
    pageJumpBackdrop.className = "esj-page-jump-backdrop";
    const pageJumpPanel = document.createElement("div");
    pageJumpPanel.className = "esj-page-jump-panel";
    const pageJumpTitle = document.createElement("div");
    pageJumpTitle.className = "esj-page-jump-title";
    pageJumpTitle.textContent = "\u8DF3\u8F49\u9801\u78BC";
    const pageJumpRow = document.createElement("div");
    pageJumpRow.className = "esj-page-jump-row";
    const pageJumpInput = document.createElement("input");
    pageJumpInput.type = "number";
    pageJumpInput.id = "esj-page-jump-input";
    pageJumpInput.min = "1";
    pageJumpInput.inputMode = "numeric";
    const pageJumpSlash = document.createElement("span");
    pageJumpSlash.textContent = "/";
    const pageJumpTotalEl = document.createElement("span");
    pageJumpTotalEl.id = "esj-page-jump-total";
    pageJumpTotalEl.textContent = "1";
    pageJumpRow.appendChild(pageJumpInput);
    pageJumpRow.appendChild(pageJumpSlash);
    pageJumpRow.appendChild(pageJumpTotalEl);
    const pageJumpActions = document.createElement("div");
    pageJumpActions.className = "esj-page-jump-actions";
    const pageJumpCancel = document.createElement("button");
    pageJumpCancel.type = "button";
    pageJumpCancel.id = "esj-page-jump-cancel";
    pageJumpCancel.textContent = "\u53D6\u6D88";
    const pageJumpOk = document.createElement("button");
    pageJumpOk.type = "button";
    pageJumpOk.id = "esj-page-jump-ok";
    pageJumpOk.textContent = "\u524D\u5F80";
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
      pageJumpOk
    };
  }

  // src/reader/renderCanvas.ts
  function ellipsizeToWidth(ctx, raw, maxWidth) {
    if (maxWidth <= 0) return "";
    if (ctx.measureText(raw).width <= maxWidth) return raw;
    const ellipsis = "...";
    const ellipsisW = ctx.measureText(ellipsis).width;
    if (ellipsisW >= maxWidth) return ellipsis;
    let lo = 0;
    let hi = raw.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = raw.slice(0, mid) + ellipsis;
      if (ctx.measureText(candidate).width <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return raw.slice(0, lo) + ellipsis;
  }
  function drawBottomMetadata(ctx, width, height, title, pageLabel, settings, maxWidth) {
    const metaY = height - settings.pagePadding / 2;
    const metaGap = 12;
    ctx.textBaseline = "middle";
    ctx.font = `13px ${settings.fontFamily}`;
    ctx.fillStyle = "#666";
    const rightW = ctx.measureText(pageLabel).width;
    const rightX = width - settings.pagePadding;
    ctx.textAlign = "right";
    ctx.fillText(pageLabel, rightX, metaY);
    const titleMaxW = Math.max(0, maxWidth - rightW - metaGap);
    const metaTitle = ellipsizeToWidth(ctx, title, titleMaxW);
    ctx.textAlign = "left";
    ctx.fillText(metaTitle, settings.pagePadding, metaY);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#111";
    ctx.font = `${settings.fontSize}px ${settings.fontFamily}`;
  }

  // src/reader/settings.ts
  var readerSettings = {
    fontFamily: '"Noto Serif CJK TC", "Source Han Serif TC", PMingLiU, serif',
    fontSize: 26,
    lineHeight: 1.8,
    paragraphSpacing: 18,
    pagePadding: 24
  };
  var chromeSettingsMobile = {
    headerHeight: 48,
    footerHeight: 46,
    headerGap: 8,
    headerPadLeft: 6,
    headerPadRight: 8,
    headerMenuButtonSize: 38,
    headerTitleFontSize: 16,
    headerPageFontSize: 12,
    footerChapterButtonWidth: 48,
    footerChapterButtonMaxWidth: 56,
    footerChapterButtonPadX: 2,
    footerPageFontSize: 14,
    footerPageCellPadX: 4,
    footerPageButtonPadY: 4,
    footerPageButtonPadX: 8,
    iconMenuSize: 20,
    iconChapterSize: 18,
    iconPageSize: 20,
    iconTableOfContentsSize: 20
  };
  var chromeSettingsTablet = {
    headerHeight: 56,
    footerHeight: 52,
    headerGap: 12,
    headerPadLeft: 8,
    headerPadRight: 12,
    headerMenuButtonSize: 44,
    headerTitleFontSize: 18,
    headerPageFontSize: 13,
    footerChapterButtonWidth: 56,
    footerChapterButtonMaxWidth: 72,
    footerChapterButtonPadX: 4,
    footerPageFontSize: 16,
    footerPageCellPadX: 6,
    footerPageButtonPadY: 6,
    footerPageButtonPadX: 10,
    iconMenuSize: 22,
    iconChapterSize: 20,
    iconPageSize: 22,
    iconTableOfContentsSize: 22
  };
  var chromeSettingsDesktop = {
    headerHeight: 60,
    footerHeight: 56,
    headerGap: 14,
    headerPadLeft: 10,
    headerPadRight: 14,
    headerMenuButtonSize: 46,
    headerTitleFontSize: 19,
    headerPageFontSize: 14,
    footerChapterButtonWidth: 60,
    footerChapterButtonMaxWidth: 76,
    footerChapterButtonPadX: 6,
    footerPageFontSize: 17,
    footerPageCellPadX: 8,
    footerPageButtonPadY: 7,
    footerPageButtonPadX: 12,
    iconMenuSize: 24,
    iconChapterSize: 22,
    iconPageSize: 24,
    iconTableOfContentsSize: 24
  };
  function getChromePreset(width) {
    if (width <= 640) return "mobile";
    if (width <= 1024) return "tablet";
    return "desktop";
  }
  function getChromeSettingsForPreset(preset) {
    if (preset === "mobile") return chromeSettingsMobile;
    if (preset === "desktop") return chromeSettingsDesktop;
    return chromeSettingsTablet;
  }

  // src/reader/styles.ts
  function buildReaderStyles() {
    return `
    #esj-reader-root {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: #fff;
      color: #111;
      display: block;
      --esj-header-h: 56px;
      --esj-footer-h: 52px;
      --esj-header-gap: 12px;
      --esj-header-pad-l: 8px;
      --esj-header-pad-r: 12px;
      --esj-header-menu-btn-size: 44px;
      --esj-header-title-font-size: 18px;
      --esj-header-page-font-size: 13px;
      --esj-footer-chapter-btn-width: 56px;
      --esj-footer-chapter-btn-max-width: 72px;
      --esj-footer-chapter-btn-pad-x: 4px;
      --esj-footer-page-font-size: 16px;
      --esj-footer-pagecell-pad-x: 6px;
      --esj-footer-page-btn-pad-y: 6px;
      --esj-footer-page-btn-pad-x: 10px;
    }

    #esj-reader-root.esj-chrome-hidden #esj-reader-header,
    #esj-reader-root.esj-chrome-hidden #esj-reader-footer {
      visibility: hidden;
      pointer-events: none;
    }

    #esj-reader-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: var(--esj-header-h);
      z-index: 6;
      display: flex;
      align-items: center;
      gap: var(--esj-header-gap);
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      padding: 0 var(--esj-header-pad-r) 0 var(--esj-header-pad-l);
      font-size: var(--esj-header-title-font-size);
      line-height: 1;
      background: rgba(255, 255, 255, 0.62);
    }

    .esj-header-menu-btn {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--esj-header-menu-btn-size);
      height: var(--esj-header-menu-btn-size);
      margin: 0;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #111;
      cursor: pointer;
    }

    #esj-reader-header-title {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #esj-reader-header-page {
      flex-shrink: 0;
      font-size: var(--esj-header-page-font-size);
      color: #888;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #esj-reader-drawer {
      position: fixed;
      inset: 0;
      z-index: 30;
      visibility: hidden;
      pointer-events: none;
    }

    #esj-reader-drawer.open {
      visibility: visible;
      pointer-events: auto;
    }

    .esj-drawer-backdrop {
      position: absolute;
      inset: 0;
      background: transparent;
    }

    .esj-drawer-panel {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: min(288px, 86vw);
      max-width: 86vw;
      box-sizing: border-box;
      background: #fff;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
      border-right: 1px solid #e0e0e0;
      padding: 0;
      display: flex;
      flex-direction: column;
      overflow: auto;
      color: #111;
    }

    .esj-drawer-nav {
      display: flex;
      flex-direction: column;
      margin: 0;
      font-size: 15px;
    }

    .esj-drawer-toc-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      min-height: 66px;
      padding: 10px 16px;
      box-sizing: border-box;
      color: #111;
      text-decoration: none;
      border-top: 1px solid #e0e0e0;
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
      -webkit-tap-highlight-color: transparent;
    }

    a.esj-drawer-toc-row:any-link,
    a.esj-drawer-toc-row:hover,
    a.esj-drawer-toc-row:active,
    a.esj-drawer-toc-row:focus,
    a.esj-drawer-toc-row:focus-visible {
      color: #111;
    }

    a.esj-drawer-toc-row:focus {
      outline: none;
    }

    a.esj-drawer-toc-row:focus-visible {
      outline: 2px solid #bbb;
      outline-offset: 2px;
    }

    a.esj-drawer-toc-row .esj-lucide-icon {
      color: #111;
    }

    .esj-drawer-reader-settings {
      padding: 12px 12px 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .esj-drawer-reader-settings-title {
      font-size: 13px;
      color: #666;
      padding: 2px 4px 6px;
    }

    .esj-setting-row {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      background: #fff;
      padding: 6px 8px;
    }

    .esj-setting-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      font-size: 14px;
      color: #333;
      width: 100%;
    }

    .esj-setting-label span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .esj-setting-controls {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      justify-content: flex-end;
    }

    .esj-setting-btn {
      width: 30px;
      height: 30px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #fff;
      color: #222;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      cursor: pointer;
    }

    .esj-setting-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }

    .esj-setting-value {
      min-width: 0;
      flex: 1;
      text-align: center;
      font-size: 13px;
      color: #111;
      font-variant-numeric: tabular-nums;
    }

    .esj-setting-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      background: #fff;
      color: #333;
      padding: 10px 8px;
      margin-top: 2px;
    }

    .esj-setting-toggle-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      color: #111;
    }

    #esj-reader-canvas-wrap {
      position: absolute;
      inset: 0;
      z-index: 0;
      padding: 0;
      overflow: hidden;
    }

    #esj-reader-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    #esj-canvas-tap-layer {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
    }

    .esj-canvas-tap-btn {
      position: absolute;
      left: 0;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      pointer-events: auto;
    }

    .esj-canvas-tap-btn:disabled {
      cursor: default;
      pointer-events: none;
    }

    #esj-reader-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: var(--esj-footer-h);
      z-index: 6;
      display: flex;
      align-items: stretch;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      background: rgba(255, 255, 255, 0.62);
      user-select: none;
    }

    #esj-reader-footer button {
      border: none;
      border-right: 1px solid #ddd;
      background: transparent;
      color: #111;
      cursor: pointer;
    }

    #esj-reader-footer button:last-child {
      border-right: none;
    }

    #esj-reader-footer button:disabled {
      opacity: 0.35;
      cursor: default;
    }

    #esj-reader-footer .esj-footer-page {
      flex: 1;
      min-width: 0;
      font-size: var(--esj-footer-page-font-size);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #esj-reader-footer .esj-footer-chap {
      flex: 0 0 var(--esj-footer-chapter-btn-width);
      max-width: var(--esj-footer-chapter-btn-max-width);
      font-size: 13px;
      padding: 0 var(--esj-footer-chapter-btn-pad-x);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .esj-lucide-icon {
      display: block;
      flex-shrink: 0;
    }

    #esj-reader-footer .esj-footer-pagecell {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px solid #ddd;
      padding: 0 var(--esj-footer-pagecell-pad-x);
    }

    #esj-footer-page-display {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      max-width: 100%;
      padding: 0 2px;
      background: transparent;
      font-size: 15px;
      color: #111;
      font-variant-numeric: tabular-nums;
    }

    #esj-footer-page-jump {
      margin-left: 6px;
      width: 34px;
      height: 34px;
      border: 1px solid #aaa;
      border-radius: 6px;
      background: transparent;
      color: #111;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    #esj-footer-page-jump:disabled {
      opacity: 0.4;
      cursor: default;
    }

    #esj-footer-page-sep {
      color: #888;
      padding: 0 2px;
    }

    #esj-page-jump-overlay {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: none;
      align-items: flex-start;
      justify-content: center;
      padding: min(28vh, 180px) 16px 24px;
      box-sizing: border-box;
      pointer-events: none;
    }

    #esj-page-jump-overlay.open {
      display: flex;
      pointer-events: auto;
    }

    .esj-page-jump-backdrop {
      position: absolute;
      inset: 0;
      background: transparent;
    }

    .esj-page-jump-panel {
      position: relative;
      width: min(320px, 100%);
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      color: #111;
      pointer-events: auto;
    }

    .esj-page-jump-title {
      font-size: 15px;
      margin-bottom: 12px;
      text-align: center;
    }

    .esj-page-jump-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 14px;
      font-size: 16px;
    }

    #esj-page-jump-input {
      width: 4.5em;
      text-align: center;
      font-size: 18px;
      padding: 8px;
      border: 1px solid #999;
      border-radius: 4px;
      background: #fff;
      color: #111;
    }

    #esj-page-jump-input::-webkit-outer-spin-button,
    #esj-page-jump-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    #esj-page-jump-input {
      -moz-appearance: textfield;
    }

    .esj-page-jump-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .esj-page-jump-actions button {
      padding: 8px 16px;
      font-size: 15px;
      border: 1px solid #aaa;
      border-radius: 4px;
      background: #f5f5f5;
      color: #111;
      cursor: pointer;
    }

    .esj-page-jump-actions button[type="button"]:last-child {
      background: #111;
      color: #fff;
      border-color: #111;
    }
  `;
  }

  // src/main.ts
  function main() {
    const root = getForumContent();
    if (!root) return;
    const title = getChapterTitle();
    const blocks = extractBlocksFromHtml(root.innerHTML);
    const chapterNav = getAdjacentChapterHrefs();
    const novelDetailHref = getNovelDetailHref();
    mountReader(title, blocks, chapterNav, novelDetailHref);
    console.info("[esj-pager]", title, "blocks:", blocks.length);
  }
  function mountReader(title, blocks, chapterNav, novelDetailHref) {
    const refs = createReaderDom(title, novelDetailHref, chapterNav);
    const {
      style,
      readerRoot,
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
      readerSettingFontValue,
      readerSettingLineHeightValue,
      readerSettingParaSpacingValue,
      readerSettingPagePaddingValue,
      btnReaderFontDec,
      btnReaderFontInc,
      btnReaderLineHeightDec,
      btnReaderLineHeightInc,
      btnReaderParaSpacingDec,
      btnReaderParaSpacingInc,
      btnReaderPagePaddingDec,
      btnReaderPagePaddingInc,
      btnRemoveSingleEmptyParagraph,
      iconRemoveSingleEmptyOffEl,
      iconRemoveSingleEmptyOnEl,
      pageJumpOverlay,
      pageJumpBackdrop,
      pageJumpPanel,
      pageJumpInput,
      pageJumpTotalEl,
      pageJumpCancel,
      pageJumpOk
    } = refs;
    style.textContent = buildReaderStyles();
    document.head.appendChild(style);
    document.body.appendChild(readerRoot);
    let pageStarts = [];
    let pageIndex = 0;
    let lastCanvasW = -1;
    let lastCanvasH = -1;
    let chromeVisible = true;
    let activeChromePreset = null;
    let activeChromeSettings = chromeSettingsTablet;
    let pendingTapNextTimer = null;
    let lastTapTs = 0;
    let removeSingleEmptyParagraph = false;
    let pagedBlocks = blocks;
    const currentReaderSettings = { ...readerSettings };
    const readerLimits = {
      fontSize: { min: 18, max: 40, step: 1 },
      lineHeight: { min: 1.2, max: 2.4, step: 0.05 },
      paragraphSpacing: { min: 0, max: 36, step: 2 },
      pagePadding: { min: 8, max: 48, step: 2 }
    };
    function closeDrawer() {
      drawerOverlay.classList.remove("open");
      drawerOverlay.setAttribute("aria-hidden", "true");
      btnHeaderMenu.setAttribute("aria-expanded", "false");
    }
    function openDrawer() {
      drawerOverlay.classList.add("open");
      drawerOverlay.setAttribute("aria-hidden", "false");
      btnHeaderMenu.setAttribute("aria-expanded", "true");
    }
    function setIconSize(el, size) {
      if (!el) return;
      el.setAttribute("width", String(size));
      el.setAttribute("height", String(size));
    }
    function applyChromeSettings(settings) {
      activeChromeSettings = settings;
      readerRoot.style.setProperty("--esj-header-h", `${settings.headerHeight}px`);
      readerRoot.style.setProperty("--esj-footer-h", `${settings.footerHeight}px`);
      readerRoot.style.setProperty("--esj-header-gap", `${settings.headerGap}px`);
      readerRoot.style.setProperty("--esj-header-pad-l", `${settings.headerPadLeft}px`);
      readerRoot.style.setProperty("--esj-header-pad-r", `${settings.headerPadRight}px`);
      readerRoot.style.setProperty("--esj-header-menu-btn-size", `${settings.headerMenuButtonSize}px`);
      readerRoot.style.setProperty("--esj-header-title-font-size", `${settings.headerTitleFontSize}px`);
      readerRoot.style.setProperty("--esj-header-page-font-size", `${settings.headerPageFontSize}px`);
      readerRoot.style.setProperty("--esj-footer-chapter-btn-width", `${settings.footerChapterButtonWidth}px`);
      readerRoot.style.setProperty("--esj-footer-chapter-btn-max-width", `${settings.footerChapterButtonMaxWidth}px`);
      readerRoot.style.setProperty("--esj-footer-chapter-btn-pad-x", `${settings.footerChapterButtonPadX}px`);
      readerRoot.style.setProperty("--esj-footer-page-font-size", `${settings.footerPageFontSize}px`);
      readerRoot.style.setProperty("--esj-footer-pagecell-pad-x", `${settings.footerPageCellPadX}px`);
      readerRoot.style.setProperty("--esj-footer-page-btn-pad-y", `${settings.footerPageButtonPadY}px`);
      readerRoot.style.setProperty("--esj-footer-page-btn-pad-x", `${settings.footerPageButtonPadX}px`);
      setIconSize(iconHeaderMenu, settings.iconMenuSize);
      setIconSize(iconTocEl, settings.iconTableOfContentsSize);
      setIconSize(iconPrevChapEl, settings.iconChapterSize);
      setIconSize(iconNextChapEl, settings.iconChapterSize);
      setIconSize(iconPrevPageEl, settings.iconPageSize);
      setIconSize(iconNextPageEl, settings.iconPageSize);
      setIconSize(iconFooterPageJumpEl, settings.iconPageSize);
    }
    function applyChromeVisibility() {
      readerRoot.classList.toggle("esj-chrome-hidden", !chromeVisible);
    }
    function roundByStep(value, step) {
      return Math.round(value / step) * step;
    }
    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    function formatLineHeight(v) {
      return Number(v.toFixed(2)).toString();
    }
    function updateReaderSettingsUi() {
      readerSettingFontValue.textContent = `${currentReaderSettings.fontSize}`;
      readerSettingLineHeightValue.textContent = formatLineHeight(currentReaderSettings.lineHeight);
      readerSettingParaSpacingValue.textContent = `${currentReaderSettings.paragraphSpacing}`;
      readerSettingPagePaddingValue.textContent = `${currentReaderSettings.pagePadding}`;
      btnReaderFontDec.disabled = currentReaderSettings.fontSize <= readerLimits.fontSize.min;
      btnReaderFontInc.disabled = currentReaderSettings.fontSize >= readerLimits.fontSize.max;
      btnReaderLineHeightDec.disabled = currentReaderSettings.lineHeight <= readerLimits.lineHeight.min;
      btnReaderLineHeightInc.disabled = currentReaderSettings.lineHeight >= readerLimits.lineHeight.max;
      btnReaderParaSpacingDec.disabled = currentReaderSettings.paragraphSpacing <= readerLimits.paragraphSpacing.min;
      btnReaderParaSpacingInc.disabled = currentReaderSettings.paragraphSpacing >= readerLimits.paragraphSpacing.max;
      btnReaderPagePaddingDec.disabled = currentReaderSettings.pagePadding <= readerLimits.pagePadding.min;
      btnReaderPagePaddingInc.disabled = currentReaderSettings.pagePadding >= readerLimits.pagePadding.max;
    }
    function applyEmptyParagraphFilter(source) {
      if (!removeSingleEmptyParagraph) return source;
      const out = [];
      let i = 0;
      while (i < source.length) {
        const b = source[i];
        const isEmptyParagraph = b.type === "paragraph" && b.text.trim().length === 0;
        if (!isEmptyParagraph) {
          out.push(b);
          i += 1;
          continue;
        }
        let j = i;
        while (j < source.length) {
          const bj = source[j];
          if (bj.type !== "paragraph") break;
          if (bj.text.trim().length > 0) break;
          j += 1;
        }
        const runLen = j - i;
        if (runLen >= 2) {
          for (let k = i; k < j; k += 1) out.push(source[k]);
        }
        i = j;
      }
      return out;
    }
    function updateRemoveSingleEmptyParagraphUi() {
      btnRemoveSingleEmptyParagraph.setAttribute("aria-pressed", removeSingleEmptyParagraph ? "true" : "false");
      iconRemoveSingleEmptyOffEl.style.display = removeSingleEmptyParagraph ? "none" : "";
      iconRemoveSingleEmptyOnEl.style.display = removeSingleEmptyParagraph ? "" : "none";
    }
    function toggleRemoveSingleEmptyParagraph() {
      removeSingleEmptyParagraph = !removeSingleEmptyParagraph;
      updateRemoveSingleEmptyParagraphUi();
      pagedBlocks = applyEmptyParagraphFilter(blocks);
      pageIndex = 0;
      lastCanvasW = -1;
      lastCanvasH = -1;
      render();
    }
    function adjustReaderSetting(key, delta) {
      const limits = readerLimits[key];
      const next = clamp(roundByStep(currentReaderSettings[key] + delta, limits.step), limits.min, limits.max);
      if (next === currentReaderSettings[key]) return;
      currentReaderSettings[key] = next;
      updateReaderSettingsUi();
      lastCanvasW = -1;
      lastCanvasH = -1;
      render();
    }
    function updateResponsiveChrome() {
      const preset = getChromePreset(window.innerWidth);
      if (preset === activeChromePreset) return;
      activeChromePreset = preset;
      applyChromeSettings(getChromeSettingsForPreset(preset));
      syncCanvasTapLayerLayout();
    }
    function updatePageChrome() {
      const total = pageStarts.length;
      if (total === 0) {
        headerPageLabel.textContent = "0 / 0";
        footerPageCur.textContent = "0";
        footerPageTotal.textContent = "0";
        btnFooterPageJump.disabled = true;
        pageJumpTotalEl.textContent = "0";
        pageJumpInput.removeAttribute("max");
        btnPrevPage.disabled = true;
        btnNextPage.disabled = true;
        return;
      }
      const cur = pageIndex + 1;
      headerPageLabel.textContent = `${cur} / ${total}`;
      footerPageCur.textContent = String(cur);
      footerPageTotal.textContent = String(total);
      btnFooterPageJump.disabled = false;
      pageJumpTotalEl.textContent = String(total);
      pageJumpInput.max = String(total);
      pageJumpInput.min = "1";
      btnPrevPage.disabled = pageIndex <= 0;
      btnNextPage.disabled = pageIndex >= total - 1;
    }
    function closePageJump() {
      pageJumpOverlay.classList.remove("open");
      pageJumpOverlay.setAttribute("aria-hidden", "true");
      pageJumpInput.blur();
    }
    function openPageJump() {
      const total = pageStarts.length;
      if (total === 0) return;
      pageJumpInput.value = String(pageIndex + 1);
      pageJumpTotalEl.textContent = String(total);
      pageJumpInput.min = "1";
      pageJumpInput.max = String(total);
      pageJumpOverlay.classList.add("open");
      pageJumpOverlay.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        pageJumpInput.focus();
        pageJumpInput.select();
      });
    }
    function submitPageJump() {
      const total = pageStarts.length;
      if (total === 0) return;
      const raw = parseInt(String(pageJumpInput.value), 10);
      if (Number.isNaN(raw)) {
        closePageJump();
        return;
      }
      const clamped = Math.max(1, Math.min(total, raw));
      pageIndex = clamped - 1;
      closePageJump();
      render();
    }
    function syncCanvasTapLayerLayout() {
      const wrapRect = canvasWrap.getBoundingClientRect();
      const w = wrapRect.width;
      if (w <= 0) return;
      const topPx = chromeVisible ? activeChromeSettings.headerHeight : 0;
      const bottomPx = chromeVisible ? activeChromeSettings.footerHeight : 0;
      let leftW;
      let midLeft;
      let midW;
      let rightStart;
      let rightW;
      if (chromeVisible) {
        const cellRect = footerPageCell.getBoundingClientRect();
        leftW = Math.max(0, Math.round(cellRect.left - wrapRect.left));
        midLeft = leftW;
        midW = Math.max(0, Math.round(cellRect.width));
        rightStart = Math.max(0, Math.round(cellRect.right - wrapRect.left));
        rightW = Math.max(0, Math.round(wrapRect.right - cellRect.right));
      } else {
        const third = Math.floor(w / 3);
        leftW = third;
        midLeft = third;
        midW = third;
        rightStart = third * 2;
        rightW = w - third * 2;
      }
      const vTop = `${topPx}px`;
      const vBottom = `${bottomPx}px`;
      btnTapPrevPage.style.top = vTop;
      btnTapPrevPage.style.bottom = vBottom;
      btnTapPrevPage.style.left = "0px";
      btnTapPrevPage.style.width = `${leftW}px`;
      btnTapChrome.style.top = vTop;
      btnTapChrome.style.bottom = vBottom;
      btnTapChrome.style.left = `${midLeft}px`;
      btnTapChrome.style.width = `${midW}px`;
      btnTapNextPage.style.top = vTop;
      btnTapNextPage.style.bottom = vBottom;
      btnTapNextPage.style.left = `${rightStart}px`;
      btnTapNextPage.style.width = `${rightW}px`;
      const total = pageStarts.length;
      const canTapPrev = total > 0 && (pageIndex > 0 || Boolean(chapterNav.prev));
      const canTapNext = total > 0 && (pageIndex < total - 1 || Boolean(chapterNav.next));
      btnTapPrevPage.disabled = !canTapPrev;
      btnTapNextPage.disabled = !canTapNext;
    }
    function goPrevPage() {
      if (pageIndex > 0) {
        pageIndex -= 1;
        render();
      }
    }
    function goNextPage() {
      if (pageIndex < pageStarts.length - 1) {
        pageIndex += 1;
        render();
      }
    }
    function confirmGoPrevChapter() {
      if (!chapterNav.prev) return;
      const ok = window.confirm("\u5DF2\u5728\u7B2C\u4E00\u9801\uFF0C\u662F\u5426\u524D\u5F80\u4E0A\u4E00\u7AE0\uFF1F");
      if (ok) window.location.href = chapterNav.prev;
    }
    function confirmGoNextChapter() {
      if (!chapterNav.next) return;
      const ok = window.confirm("\u5DF2\u5728\u6700\u5F8C\u4E00\u9801\uFF0C\u662F\u5426\u524D\u5F80\u4E0B\u4E00\u7AE0\uFF1F");
      if (ok) window.location.href = chapterNav.next;
    }
    function toggleChrome() {
      chromeVisible = !chromeVisible;
      applyChromeVisibility();
      syncCanvasTapLayerLayout();
    }
    function handleSideTapPaging() {
      const now = Date.now();
      const doubleTapWindowMs = 280;
      const isDoubleTap = now - lastTapTs <= doubleTapWindowMs;
      lastTapTs = now;
      if (isDoubleTap) {
        if (pendingTapNextTimer) {
          clearTimeout(pendingTapNextTimer);
          pendingTapNextTimer = null;
        }
        if (pageIndex <= 0) {
          confirmGoPrevChapter();
        } else {
          goPrevPage();
        }
        return;
      }
      pendingTapNextTimer = setTimeout(() => {
        pendingTapNextTimer = null;
        if (pageIndex >= pageStarts.length - 1) {
          confirmGoNextChapter();
        } else {
          goNextPage();
        }
      }, doubleTapWindowMs);
    }
    function render() {
      updateResponsiveChrome();
      const dpr = window.devicePixelRatio || 1;
      const width = canvasWrap.clientWidth;
      const height = canvasWrap.clientHeight;
      if (width === 0 || height === 0) return;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#111";
      ctx.textBaseline = "top";
      ctx.font = `${currentReaderSettings.fontSize}px ${currentReaderSettings.fontFamily}`;
      const maxWidth = Math.max(0, width - currentReaderSettings.pagePadding * 2);
      const maxHeight = Math.max(0, height - currentReaderSettings.pagePadding * 2);
      const linePx = currentReaderSettings.fontSize * currentReaderSettings.lineHeight;
      const layout = {
        pad: currentReaderSettings.pagePadding,
        maxWidth,
        maxHeight,
        linePx,
        paraSpacing: currentReaderSettings.paragraphSpacing
      };
      const sameSize = pageStarts.length > 0 && width === lastCanvasW && height === lastCanvasH;
      if (!sameSize) {
        pageStarts = buildPageStarts(ctx, pagedBlocks, layout);
        lastCanvasW = width;
        lastCanvasH = height;
        pageIndex = Math.min(pageIndex, Math.max(0, pageStarts.length - 1));
      }
      updatePageChrome();
      syncCanvasTapLayerLayout();
      if (pageStarts.length === 0) return;
      walkOnePage(ctx, pagedBlocks, pageStarts[pageIndex], layout, true);
      drawBottomMetadata(
        ctx,
        width,
        height,
        title,
        `${pageIndex + 1} / ${pageStarts.length}`,
        currentReaderSettings,
        maxWidth
      );
    }
    btnHeaderMenu.addEventListener("click", () => {
      if (drawerOverlay.classList.contains("open")) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
    drawerBackdrop.addEventListener("click", closeDrawer);
    btnFooterPageJump.addEventListener("click", openPageJump);
    pageJumpBackdrop.addEventListener("click", closePageJump);
    pageJumpCancel.addEventListener("click", closePageJump);
    pageJumpOk.addEventListener("click", submitPageJump);
    pageJumpInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitPageJump();
      }
    });
    pageJumpPanel.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (drawerOverlay.classList.contains("open")) {
        closeDrawer();
        return;
      }
      if (pageJumpOverlay.classList.contains("open")) {
        closePageJump();
        return;
      }
      if (!chromeVisible) {
        chromeVisible = true;
        applyChromeVisibility();
        syncCanvasTapLayerLayout();
      }
    });
    btnPrevChap.addEventListener("click", () => {
      if (chapterNav.prev) window.location.href = chapterNav.prev;
    });
    btnPrevPage.addEventListener("click", goPrevPage);
    btnNextPage.addEventListener("click", goNextPage);
    btnTapPrevPage.addEventListener("click", handleSideTapPaging);
    btnTapChrome.addEventListener("click", toggleChrome);
    btnTapNextPage.addEventListener("click", handleSideTapPaging);
    btnReaderFontDec.addEventListener("click", () => {
      adjustReaderSetting("fontSize", -readerLimits.fontSize.step);
    });
    btnReaderFontInc.addEventListener("click", () => {
      adjustReaderSetting("fontSize", readerLimits.fontSize.step);
    });
    btnReaderLineHeightDec.addEventListener("click", () => {
      adjustReaderSetting("lineHeight", -readerLimits.lineHeight.step);
    });
    btnReaderLineHeightInc.addEventListener("click", () => {
      adjustReaderSetting("lineHeight", readerLimits.lineHeight.step);
    });
    btnReaderParaSpacingDec.addEventListener("click", () => {
      adjustReaderSetting("paragraphSpacing", -readerLimits.paragraphSpacing.step);
    });
    btnReaderParaSpacingInc.addEventListener("click", () => {
      adjustReaderSetting("paragraphSpacing", readerLimits.paragraphSpacing.step);
    });
    btnReaderPagePaddingDec.addEventListener("click", () => {
      adjustReaderSetting("pagePadding", -readerLimits.pagePadding.step);
    });
    btnReaderPagePaddingInc.addEventListener("click", () => {
      adjustReaderSetting("pagePadding", readerLimits.pagePadding.step);
    });
    btnRemoveSingleEmptyParagraph.addEventListener("click", toggleRemoveSingleEmptyParagraph);
    btnNextChap.addEventListener("click", () => {
      if (chapterNav.next) window.location.href = chapterNav.next;
    });
    updateRemoveSingleEmptyParagraphUi();
    updateReaderSettingsUi();
    updateResponsiveChrome();
    render();
    window.addEventListener("resize", render);
  }
  main();
})();
/*! Bundled license information:

lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/createElement.js:
lucide/dist/esm/icons/a-arrow-down.js:
lucide/dist/esm/icons/a-arrow-up.js:
lucide/dist/esm/icons/a-large-small.js:
lucide/dist/esm/icons/chevrons-left.js:
lucide/dist/esm/icons/chevrons-right.js:
lucide/dist/esm/icons/diff.js:
lucide/dist/esm/icons/menu.js:
lucide/dist/esm/icons/minus.js:
lucide/dist/esm/icons/move-left.js:
lucide/dist/esm/icons/move-right.js:
lucide/dist/esm/icons/pen-line.js:
lucide/dist/esm/icons/plus.js:
lucide/dist/esm/icons/square-check.js:
lucide/dist/esm/icons/square.js:
lucide/dist/esm/icons/table-of-contents.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v1.8.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
//# sourceMappingURL=esj-pager.user.js.map
