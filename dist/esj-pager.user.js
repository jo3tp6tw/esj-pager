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
  function extractCommentBlocksFromHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    temp.querySelectorAll("script, style, iframe").forEach((el) => el.remove());
    const commentEls = [...temp.querySelectorAll(".comment")];
    if (commentEls.length === 0) return [];
    const blocks = [];
    blocks.push({ type: "commentMeta", text: "" });
    blocks.push({ type: "commentMeta", text: "========== \u7559\u8A00\u5340 ==========" });
    blocks.push({ type: "commentMeta", text: "" });
    for (const el of commentEls) {
      const floor = (el.querySelector(".comment-floor")?.textContent ?? "").trim();
      const author = (el.querySelector(".comment-title a, .comment-title")?.textContent ?? "").trim();
      const time = (el.querySelector(".comment-meta:not(.comment-floor)")?.textContent ?? "").trim();
      const quoteEl = el.querySelector("blockquote");
      const quoteText = (quoteEl?.textContent ?? "").replace(/\u00a0/g, " ").trim();
      const textEl = el.querySelector(".comment-text");
      const text = (textEl?.textContent ?? "").replace(/\u00a0/g, " ").trim();
      const headerParts = [floor, author, time].filter((v) => v.length > 0);
      blocks.push({ type: "commentDivider" });
      if (headerParts.length > 0) {
        blocks.push({ type: "commentMeta", text: headerParts.join("  ") });
      }
      if (quoteText) {
        blocks.push({ type: "commentMeta", text: `\u56DE\u8986\uFF1A${quoteText}` });
      }
      blocks.push({ type: "commentMain", text: text || "[\u7121\u6587\u5B57\u5167\u5BB9]" });
      blocks.push({ type: "commentMeta", text: "" });
    }
    return blocks;
  }

  // src/pagination.ts
  function getBlockTextStyle(ctx, block, layout) {
    const baseFont = ctx.font;
    const baseSizeRaw = Number.parseFloat(baseFont);
    const baseSize = Number.isFinite(baseSizeRaw) ? baseSizeRaw : 20;
    const family = baseFont.replace(/^[\d.]+px\s*/, "") || "sans-serif";
    if (block.type === "commentMain") {
      return {
        font: `${Math.max(18, Math.round(baseSize))}px ${family}`,
        linePx: 30,
        paraSpacing: 10,
        fillStyle: "#111"
      };
    }
    if (block.type === "commentMeta") {
      const halfSize = Math.max(12, Math.round(baseSize * 0.7));
      return {
        font: `${halfSize}px ${family}`,
        linePx: 22,
        paraSpacing: 6,
        fillStyle: "#999"
      };
    }
    if (block.type === "commentDivider") {
      return {
        font: `${Math.max(13, Math.round(baseSize - 4))}px ${family}`,
        linePx: 22,
        paraSpacing: 6,
        fillStyle: "#111"
      };
    }
    return {
      font: baseFont,
      linePx: layout.linePx,
      paraSpacing: layout.paraSpacing,
      fillStyle: "#111"
    };
  }
  function bottomY(layout) {
    return layout.padY + layout.maxHeight;
  }
  function buildDividerLine(ctx, maxWidth) {
    if (maxWidth <= 0) return "\u2500";
    const unit = "\u2500";
    const unitWidth = ctx.measureText(unit).width;
    if (unitWidth <= 0) return unit;
    const count = Math.max(1, Math.floor(maxWidth / unitWidth));
    return unit.repeat(count);
  }
  function walkOnePage(ctx, blocks, start, layout, draw, options = {}) {
    let y = layout.padY;
    let bi = start.bi;
    let off = start.off;
    if (bi >= blocks.length) return null;
    while (bi < blocks.length) {
      const block = blocks[bi];
      const textStyle = getBlockTextStyle(ctx, block, layout);
      const prevFont = ctx.font;
      const prevFill = ctx.fillStyle;
      ctx.font = textStyle.font;
      ctx.fillStyle = textStyle.fillStyle;
      const linePx = textStyle.linePx;
      const paraSpacing = textStyle.paraSpacing;
      if (block.type === "img") {
        const tag = options.imagePlaceholderText ?? "[\u5716\u7247]";
        const bot2 = bottomY(layout);
        const imageInfo = options.getImageRenderInfo?.(block.src, layout.maxWidth) ?? null;
        if (imageInfo && imageInfo.ready) {
          const imageTooTallForPage = imageInfo.drawHeight > layout.maxHeight;
          const imageFitsCurrentPage = y + imageInfo.drawHeight <= bot2;
          if (imageFitsCurrentPage || y <= layout.padY && imageTooTallForPage) {
            if (draw) {
              if (options.drawImage) {
                options.drawImage(block.src, layout.textLeft, y, imageInfo.drawWidth, imageInfo.drawHeight);
              } else {
                ctx.fillText(tag, layout.textLeft, y);
              }
            }
            y += imageInfo.drawHeight + layout.paraSpacing;
            bi += 1;
            off = 0;
            continue;
          }
          if (y + linePx <= bot2 && draw) {
            ctx.fillText("\u3010\u5716\u3011", layout.textLeft, y);
          }
          ctx.font = prevFont;
          ctx.fillStyle = prevFill;
          return { bi, off: 0 };
        }
        if (y + linePx > bot2 && y > layout.padY) {
          ctx.font = prevFont;
          ctx.fillStyle = prevFill;
          return { bi, off: 0 };
        }
        if (draw) ctx.fillText(tag, layout.textLeft, y);
        y += linePx + paraSpacing;
        bi += 1;
        off = 0;
        ctx.font = prevFont;
        ctx.fillStyle = prevFill;
        continue;
      }
      const text = block.type === "commentDivider" ? buildDividerLine(ctx, layout.maxWidth) : block.text;
      if (text.length === 0) {
        const bot2 = bottomY(layout);
        if (y + paraSpacing > bot2) {
          ctx.font = prevFont;
          ctx.fillStyle = prevFill;
          return { bi: bi + 1, off: 0 };
        }
        y += paraSpacing;
        bi += 1;
        off = 0;
        ctx.font = prevFont;
        ctx.fillStyle = prevFill;
        continue;
      }
      const remainder = text.slice(off);
      const lines = wrapByChar(ctx, remainder, layout.maxWidth);
      for (let i = 0; i < lines.length; i++) {
        if (y + linePx > bottomY(layout)) {
          let newOff = off;
          for (let j = 0; j < i; j++) newOff += lines[j].length;
          ctx.font = prevFont;
          ctx.fillStyle = prevFill;
          return { bi, off: newOff };
        }
        if (draw) ctx.fillText(lines[i], layout.textLeft, y);
        y += linePx;
      }
      const bot = bottomY(layout);
      if (y + paraSpacing > bot) {
        ctx.font = prevFont;
        ctx.fillStyle = prevFill;
        return { bi: bi + 1, off: 0 };
      }
      y += paraSpacing;
      bi += 1;
      off = 0;
      ctx.font = prevFont;
      ctx.fillStyle = prevFill;
    }
    return null;
  }
  function buildPageStarts(ctx, blocks, layout, options = {}) {
    if (blocks.length === 0) return [];
    const starts = [];
    let cur = { bi: 0, off: 0 };
    const maxPages = Math.max(100, blocks.length * 20);
    for (let n = 0; n < maxPages; n++) {
      starts.push({ ...cur });
      const next = walkOnePage(ctx, blocks, cur, layout, false, options);
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
    comments: "#comments",
    title: "h2, .forum-content-title"
  };
  function getForumContent() {
    return document.querySelector(SELECTORS.forumContent);
  }
  function getCommentsRoot() {
    return document.querySelector(SELECTORS.comments);
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

  // node_modules/lucide/dist/esm/icons/a-large-small.js
  var ALargeSmall = [
    ["path", { d: "m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16" }],
    ["path", { d: "M15.697 14h5.606" }],
    ["path", { d: "m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" }],
    ["path", { d: "M3.304 13h6.392" }]
  ];

  // node_modules/lucide/dist/esm/icons/arrow-down-to-line.js
  var ArrowDownToLine = [
    ["path", { d: "M12 17V3" }],
    ["path", { d: "m6 11 6 6 6-6" }],
    ["path", { d: "M19 21H5" }]
  ];

  // node_modules/lucide/dist/esm/icons/check.js
  var Check = [["path", { d: "M20 6 9 17l-5-5" }]];

  // node_modules/lucide/dist/esm/icons/chevron-down.js
  var ChevronDown = [["path", { d: "m6 9 6 6 6-6" }]];

  // node_modules/lucide/dist/esm/icons/chevron-up.js
  var ChevronUp = [["path", { d: "m18 15-6-6-6 6" }]];

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

  // node_modules/lucide/dist/esm/icons/clipboard-paste.js
  var ClipboardPaste = [
    ["path", { d: "M11 14h10" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v1.344" }],
    ["path", { d: "m17 18 4-4-4-4" }],
    ["path", { d: "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113" }],
    ["rect", { x: "8", y: "2", width: "8", height: "4", rx: "1" }]
  ];

  // node_modules/lucide/dist/esm/icons/diff.js
  var Diff = [
    ["path", { d: "M12 3v14" }],
    ["path", { d: "M5 10h14" }],
    ["path", { d: "M5 21h14" }]
  ];

  // node_modules/lucide/dist/esm/icons/expand.js
  var Expand = [
    ["path", { d: "m15 15 6 6" }],
    ["path", { d: "m15 9 6-6" }],
    ["path", { d: "M21 16v5h-5" }],
    ["path", { d: "M21 8V3h-5" }],
    ["path", { d: "M3 16v5h5" }],
    ["path", { d: "m3 21 6-6" }],
    ["path", { d: "M3 8V3h5" }],
    ["path", { d: "M9 9 3 3" }]
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

  // node_modules/lucide/dist/esm/icons/shrink.js
  var Shrink = [
    ["path", { d: "m15 15 6 6m-6-6v4.8m0-4.8h4.8" }],
    ["path", { d: "M9 19.8V15m0 0H4.2M9 15l-6 6" }],
    ["path", { d: "M15 4.2V9m0 0h4.8M15 9l6-6" }],
    ["path", { d: "M9 4.2V9m0 0H4.2M9 9 3 3" }]
  ];

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
  function iconExpand(size = 22) {
    return makeIcon(Expand, size);
  }
  function iconShrink(size = 22) {
    return makeIcon(Shrink, size);
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
  function iconPlus(size = 18) {
    return makeIcon(Plus, size);
  }
  function iconMinus(size = 18) {
    return makeIcon(Minus, size);
  }
  function iconPenLine(size = 18) {
    return makeIcon(PenLine, size);
  }
  function iconCheck(size = 18) {
    return makeIcon(Check, size);
  }
  function iconArrowDownToLine(size = 18) {
    return makeIcon(ArrowDownToLine, size);
  }
  function iconClipboardPaste(size = 18) {
    return makeIcon(ClipboardPaste, size);
  }
  function iconChevronDown(size = 18) {
    return makeIcon(ChevronDown, size);
  }
  function iconChevronUp(size = 18) {
    return makeIcon(ChevronUp, size);
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
    const btnHeaderFullscreen = document.createElement("button");
    btnHeaderFullscreen.type = "button";
    btnHeaderFullscreen.className = "esj-header-menu-btn";
    btnHeaderFullscreen.id = "esj-header-fullscreen-btn";
    btnHeaderFullscreen.setAttribute("aria-label", "\u9032\u5165\u5168\u87A2\u5E55");
    btnHeaderFullscreen.setAttribute("aria-pressed", "false");
    const iconHeaderFullscreenExpand = iconExpand();
    const iconHeaderFullscreenShrink = iconShrink();
    iconHeaderFullscreenShrink.style.display = "none";
    btnHeaderFullscreen.appendChild(iconHeaderFullscreenExpand);
    btnHeaderFullscreen.appendChild(iconHeaderFullscreenShrink);
    header.appendChild(btnHeaderMenu);
    header.appendChild(headerTitle);
    header.appendChild(btnHeaderFullscreen);
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
      const tocText = document.createElement("span");
      tocText.className = "esj-drawer-toc-text";
      tocText.textContent = "\u76EE\u9304";
      tocLinkDrawer.appendChild(tocText);
      drawerNav.appendChild(tocLinkDrawer);
      drawerPanel.appendChild(drawerNav);
    }
    const readerSettingsSection = document.createElement("section");
    readerSettingsSection.className = "esj-drawer-reader-settings";
    readerSettingsSection.setAttribute("aria-label", "\u95B1\u8B80\u8A2D\u5B9A");
    const readerSettingsHead = document.createElement("div");
    readerSettingsHead.className = "esj-drawer-reader-settings-head";
    const readerSettingsTitle = document.createElement("div");
    readerSettingsTitle.className = "esj-drawer-reader-settings-title";
    readerSettingsTitle.textContent = "\u95B1\u8B80\u8A2D\u5B9A";
    const btnReaderSettingsAdjust = document.createElement("button");
    btnReaderSettingsAdjust.type = "button";
    btnReaderSettingsAdjust.className = "esj-setting-btn";
    btnReaderSettingsAdjust.setAttribute("aria-label", "\u8ABF\u6574\u95B1\u8B80\u8A2D\u5B9A");
    btnReaderSettingsAdjust.appendChild(iconPenLine(18));
    const btnReaderSettingsDropdown = document.createElement("button");
    btnReaderSettingsDropdown.type = "button";
    btnReaderSettingsDropdown.className = "esj-setting-btn";
    btnReaderSettingsDropdown.setAttribute("aria-label", "\u5C55\u958B\u6216\u6536\u5408\u95B1\u8B80\u8A2D\u5B9A");
    btnReaderSettingsDropdown.setAttribute("aria-expanded", "false");
    const iconReaderSettingsChevronDownEl = iconChevronDown(18);
    const iconReaderSettingsChevronUpEl = iconChevronUp(18);
    iconReaderSettingsChevronUpEl.style.display = "none";
    btnReaderSettingsDropdown.appendChild(iconReaderSettingsChevronDownEl);
    btnReaderSettingsDropdown.appendChild(iconReaderSettingsChevronUpEl);
    readerSettingsHead.appendChild(readerSettingsTitle);
    readerSettingsHead.appendChild(btnReaderSettingsDropdown);
    readerSettingsSection.appendChild(readerSettingsHead);
    const readerSettingsActions = document.createElement("div");
    readerSettingsActions.className = "esj-drawer-settings-actions";
    readerSettingsActions.appendChild(btnReaderSettingsAdjust);
    readerSettingsSection.appendChild(readerSettingsActions);
    const readerSettingsContent = document.createElement("div");
    readerSettingsContent.className = "esj-drawer-settings-content";
    function makeSettingRow(labelText, iconLeft) {
      const row = document.createElement("div");
      row.className = "esj-setting-row";
      const labelWrap = document.createElement("div");
      labelWrap.className = "esj-setting-label";
      labelWrap.appendChild(iconLeft);
      const labelTextEl = document.createElement("span");
      labelTextEl.textContent = labelText;
      labelWrap.appendChild(labelTextEl);
      const valueEl = document.createElement("span");
      valueEl.className = "esj-setting-value";
      valueEl.textContent = "-";
      const controls = document.createElement("div");
      controls.className = "esj-setting-controls";
      controls.appendChild(valueEl);
      row.appendChild(labelWrap);
      row.appendChild(controls);
      return { row, valueEl };
    }
    const fontRow = makeSettingRow(
      "\u5B57\u7D1A",
      iconFontSize(18)
    );
    const lineHeightRow = makeSettingRow(
      "\u884C\u9AD8",
      iconDiff(18)
    );
    const paraSpacingRow = makeSettingRow(
      "\u6BB5\u8DDD",
      iconDiff(18)
    );
    const pagePaddingRow = makeSettingRow(
      "\u5DE6\u53F3\u908A\u8DDD",
      iconDiff(18)
    );
    const pagePaddingYRow = makeSettingRow(
      "\u4E0A\u4E0B\u908A\u8DDD",
      iconDiff(18)
    );
    const pageMaxWidthRow = makeSettingRow(
      "\u6700\u5927\u5BEC\u5EA6",
      iconDiff(18)
    );
    readerSettingsContent.appendChild(fontRow.row);
    readerSettingsContent.appendChild(lineHeightRow.row);
    readerSettingsContent.appendChild(paraSpacingRow.row);
    readerSettingsContent.appendChild(pagePaddingRow.row);
    readerSettingsContent.appendChild(pagePaddingYRow.row);
    readerSettingsContent.appendChild(pageMaxWidthRow.row);
    const removeSingleEmptyRow = document.createElement("div");
    removeSingleEmptyRow.className = "esj-setting-toggle-row";
    const removeSingleEmptyLabel = document.createElement("div");
    removeSingleEmptyLabel.className = "esj-setting-label";
    const removeSingleEmptyLabelText = document.createElement("span");
    removeSingleEmptyLabelText.textContent = "\u53BB\u9664\u7A7A\u6BB5\u843D";
    removeSingleEmptyLabel.appendChild(removeSingleEmptyLabelText);
    const readerRemoveSingleEmptyValue = document.createElement("span");
    readerRemoveSingleEmptyValue.className = "esj-setting-value esj-setting-onoff";
    readerRemoveSingleEmptyValue.textContent = "OFF";
    removeSingleEmptyRow.appendChild(removeSingleEmptyLabel);
    removeSingleEmptyRow.appendChild(readerRemoveSingleEmptyValue);
    readerSettingsContent.appendChild(removeSingleEmptyRow);
    readerSettingsSection.appendChild(readerSettingsContent);
    const profileSection = document.createElement("section");
    profileSection.className = "esj-drawer-profile-section";
    profileSection.setAttribute("aria-label", "\u8A2D\u5B9A\u6A94");
    const profileHeader = document.createElement("div");
    profileHeader.className = "esj-drawer-profile-header";
    const profileTitle = document.createElement("div");
    profileTitle.className = "esj-drawer-reader-settings-title";
    profileTitle.textContent = "\u8A2D\u5B9A\u6A94";
    const profileHeaderActions = document.createElement("div");
    profileHeaderActions.className = "esj-drawer-profile-header-actions";
    const btnProfileDropdown = document.createElement("button");
    btnProfileDropdown.type = "button";
    btnProfileDropdown.className = "esj-setting-btn";
    btnProfileDropdown.setAttribute("aria-label", "\u5C55\u958B\u6216\u6536\u5408\u8A2D\u5B9A\u6A94\u53C3\u6578");
    btnProfileDropdown.setAttribute("aria-expanded", "false");
    const iconProfileChevronDownEl = iconChevronDown(18);
    const iconProfileChevronUpEl = iconChevronUp(18);
    iconProfileChevronUpEl.style.display = "none";
    btnProfileDropdown.appendChild(iconProfileChevronDownEl);
    btnProfileDropdown.appendChild(iconProfileChevronUpEl);
    profileHeaderActions.appendChild(btnProfileDropdown);
    profileHeader.appendChild(profileTitle);
    profileHeader.appendChild(profileHeaderActions);
    const profileActions = document.createElement("div");
    profileActions.className = "esj-drawer-profile-actions";
    const btnProfileSave = document.createElement("button");
    btnProfileSave.type = "button";
    btnProfileSave.className = "esj-setting-btn";
    btnProfileSave.setAttribute("aria-label", "\u5132\u5B58\u53C3\u6578\u8A2D\u5B9A\u6A94");
    btnProfileSave.appendChild(iconArrowDownToLine(18));
    const btnProfileRestore = document.createElement("button");
    btnProfileRestore.type = "button";
    btnProfileRestore.className = "esj-setting-btn";
    btnProfileRestore.setAttribute("aria-label", "\u9084\u539F\u53C3\u6578\u8A2D\u5B9A\u6A94");
    btnProfileRestore.appendChild(iconClipboardPaste(18));
    profileActions.appendChild(btnProfileSave);
    profileActions.appendChild(btnProfileRestore);
    const profileContent = document.createElement("div");
    profileContent.className = "esj-drawer-profile-content";
    function makeProfileValueRow(labelText) {
      const row = document.createElement("div");
      row.className = "esj-setting-row";
      const label = document.createElement("div");
      label.className = "esj-setting-label";
      const labelTextEl = document.createElement("span");
      labelTextEl.textContent = labelText;
      label.appendChild(labelTextEl);
      const valueEl = document.createElement("span");
      valueEl.className = "esj-setting-value";
      valueEl.textContent = "-";
      row.appendChild(label);
      row.appendChild(valueEl);
      return { row, valueEl };
    }
    const profileFontRow = makeProfileValueRow("\u5B57\u7D1A");
    const profileLineHeightRow = makeProfileValueRow("\u884C\u9AD8");
    const profileParaSpacingRow = makeProfileValueRow("\u6BB5\u8DDD");
    const profilePagePaddingXRow = makeProfileValueRow("\u5DE6\u53F3\u908A\u8DDD");
    const profilePagePaddingYRow = makeProfileValueRow("\u4E0A\u4E0B\u908A\u8DDD");
    const profilePageMaxWidthRow = makeProfileValueRow("\u6700\u5927\u5BEC\u5EA6");
    const profileRemoveSingleEmptyRow = makeProfileValueRow("\u53BB\u9664\u7A7A\u6BB5\u843D");
    profileRemoveSingleEmptyRow.valueEl.classList.add("esj-setting-onoff");
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
    const fontSection = document.createElement("section");
    fontSection.className = "esj-drawer-font-section";
    fontSection.setAttribute("aria-label", "\u5B57\u9AD4");
    const fontTitle = document.createElement("div");
    fontTitle.className = "esj-drawer-reader-settings-title";
    fontTitle.textContent = "\u5B57\u9AD4";
    const fontSourceRow = document.createElement("div");
    fontSourceRow.className = "esj-setting-row";
    const fontSourceLabel = document.createElement("div");
    fontSourceLabel.className = "esj-setting-label";
    const fontSourceLabelText = document.createElement("span");
    fontSourceLabelText.textContent = "\u5B57\u9AD4\u4F86\u6E90";
    fontSourceLabel.appendChild(fontSourceLabelText);
    const fontSourceControls = document.createElement("div");
    fontSourceControls.className = "esj-setting-controls";
    const selectFontSource = document.createElement("select");
    selectFontSource.id = "esj-font-source-select";
    selectFontSource.className = "esj-setting-select";
    selectFontSource.setAttribute("aria-label", "\u5B57\u9AD4\u4F86\u6E90");
    fontSourceControls.appendChild(selectFontSource);
    fontSourceRow.appendChild(fontSourceLabel);
    fontSourceRow.appendChild(fontSourceControls);
    const localFontRow = document.createElement("div");
    localFontRow.className = "esj-setting-row esj-font-local-row";
    const localFontLabel = document.createElement("div");
    localFontLabel.className = "esj-setting-label";
    const localFontLabelText = document.createElement("span");
    localFontLabelText.textContent = "\u672C\u6A5F\u5B57\u9AD4";
    localFontLabel.appendChild(localFontLabelText);
    const localFontControls = document.createElement("div");
    localFontControls.className = "esj-setting-controls";
    const selectLocalFont = document.createElement("select");
    selectLocalFont.id = "esj-local-font-select";
    selectLocalFont.className = "esj-setting-select";
    selectLocalFont.setAttribute("aria-label", "\u9078\u64C7\u672C\u6A5F\u5B57\u9AD4");
    localFontControls.appendChild(selectLocalFont);
    localFontRow.appendChild(localFontLabel);
    localFontRow.appendChild(localFontControls);
    fontSection.appendChild(fontTitle);
    fontSection.appendChild(fontSourceRow);
    fontSection.appendChild(localFontRow);
    const fontWebControls = document.createElement("div");
    fontWebControls.className = "esj-font-web-controls";
    const fontWebPresets = document.createElement("div");
    fontWebPresets.className = "esj-font-web-presets";
    function makeWebFontPresetRow(label, presetId) {
      const row = document.createElement("div");
      row.className = "esj-font-preset-row";
      const rowLabel = document.createElement("span");
      rowLabel.className = "esj-font-preset-label";
      rowLabel.textContent = `${label} \u7C97\u7D30\uFF1A`;
      const weightSelect = document.createElement("select");
      weightSelect.className = "esj-setting-select esj-font-weight-select";
      for (let w = 100; w <= 900; w += 100) {
        const opt = document.createElement("option");
        opt.value = String(w);
        opt.textContent = String(w);
        if (w === 400) opt.selected = true;
        weightSelect.appendChild(opt);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "esj-setting-btn esj-font-preset-btn";
      btn.textContent = "\u5957\u7528";
      btn.dataset.fontPreset = presetId;
      row.appendChild(rowLabel);
      row.appendChild(weightSelect);
      row.appendChild(btn);
      return row;
    }
    fontWebPresets.appendChild(makeWebFontPresetRow("\u601D\u6E90\u5B8B\u9AD4", "noto-serif-tc"));
    fontWebPresets.appendChild(makeWebFontPresetRow("\u601D\u6E90\u9ED1\u9AD4", "noto-sans-tc"));
    const inputWebFontCssUrl = document.createElement("input");
    inputWebFontCssUrl.type = "url";
    inputWebFontCssUrl.className = "esj-setting-input";
    inputWebFontCssUrl.placeholder = "Web Font CSS URL";
    inputWebFontCssUrl.setAttribute("aria-label", "Web Font CSS URL");
    const inputWebFontFamily = document.createElement("input");
    inputWebFontFamily.type = "text";
    inputWebFontFamily.className = "esj-setting-input";
    inputWebFontFamily.placeholder = "font-family";
    inputWebFontFamily.setAttribute("aria-label", "Web Font font-family");
    const btnApplyWebFont = document.createElement("button");
    btnApplyWebFont.type = "button";
    btnApplyWebFont.className = "esj-setting-btn esj-font-web-apply-btn";
    btnApplyWebFont.textContent = "\u5957\u7528";
    fontWebControls.appendChild(fontWebPresets);
    fontWebControls.appendChild(inputWebFontCssUrl);
    fontWebControls.appendChild(inputWebFontFamily);
    fontWebControls.appendChild(btnApplyWebFont);
    fontSection.appendChild(fontWebControls);
    readerSettingsSection.appendChild(fontSection);
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
    const readerAdjustOverlay = document.createElement("div");
    readerAdjustOverlay.id = "esj-reader-adjust-overlay";
    readerAdjustOverlay.setAttribute("role", "dialog");
    readerAdjustOverlay.setAttribute("aria-modal", "true");
    readerAdjustOverlay.setAttribute("aria-hidden", "true");
    const readerAdjustBackdrop = document.createElement("div");
    readerAdjustBackdrop.className = "esj-reader-adjust-backdrop";
    const readerAdjustPanel = document.createElement("div");
    readerAdjustPanel.className = "esj-reader-adjust-panel";
    const readerAdjustTitle = document.createElement("div");
    readerAdjustTitle.className = "esj-reader-adjust-title";
    readerAdjustTitle.textContent = "\u95B1\u8B80\u53C3\u6578\u8ABF\u6574";
    function makeAdjustRow(labelText) {
      const row = document.createElement("div");
      row.className = "esj-reader-adjust-item";
      const label = document.createElement("div");
      label.className = "esj-reader-adjust-item-label";
      label.textContent = labelText;
      const valueEl = document.createElement("span");
      valueEl.className = "esj-reader-adjust-item-value";
      valueEl.textContent = "-";
      label.appendChild(valueEl);
      const controls = document.createElement("div");
      controls.className = "esj-reader-adjust-row";
      const decBtn = document.createElement("button");
      decBtn.type = "button";
      decBtn.className = "esj-reader-adjust-btn";
      decBtn.setAttribute("aria-label", `${labelText}\u6E1B\u5C11`);
      decBtn.appendChild(iconMinus(18));
      const rangeEl = document.createElement("input");
      rangeEl.type = "range";
      rangeEl.className = "esj-reader-adjust-range";
      rangeEl.step = "1";
      rangeEl.min = "0";
      rangeEl.max = "100";
      rangeEl.value = "50";
      const incBtn = document.createElement("button");
      incBtn.type = "button";
      incBtn.className = "esj-reader-adjust-btn";
      incBtn.setAttribute("aria-label", `${labelText}\u589E\u52A0`);
      incBtn.appendChild(iconPlus(18));
      controls.appendChild(decBtn);
      controls.appendChild(rangeEl);
      controls.appendChild(incBtn);
      row.appendChild(label);
      row.appendChild(controls);
      return { row, valueEl, decBtn, rangeEl, incBtn };
    }
    const adjustFontRow = makeAdjustRow("\u5B57\u7D1A");
    const adjustLineHeightRow = makeAdjustRow("\u884C\u9AD8");
    const adjustParaSpacingRow = makeAdjustRow("\u6BB5\u8DDD");
    const adjustPagePaddingXRow = makeAdjustRow("\u5DE6\u53F3\u908A\u8DDD");
    const adjustPagePaddingYRow = makeAdjustRow("\u4E0A\u4E0B\u908A\u8DDD");
    const adjustPageMaxWidthRow = makeAdjustRow("\u6700\u5927\u5BEC\u5EA6");
    readerAdjustPanel.appendChild(readerAdjustTitle);
    readerAdjustPanel.appendChild(adjustFontRow.row);
    readerAdjustPanel.appendChild(adjustLineHeightRow.row);
    readerAdjustPanel.appendChild(adjustParaSpacingRow.row);
    readerAdjustPanel.appendChild(adjustPagePaddingXRow.row);
    readerAdjustPanel.appendChild(adjustPagePaddingYRow.row);
    readerAdjustPanel.appendChild(adjustPageMaxWidthRow.row);
    const readerAdjustRemoveSingleEmptyRow = document.createElement("div");
    readerAdjustRemoveSingleEmptyRow.className = "esj-reader-adjust-item";
    const readerAdjustRemoveSingleEmptyLabel = document.createElement("div");
    readerAdjustRemoveSingleEmptyLabel.className = "esj-reader-adjust-item-label";
    const readerAdjustRemoveSingleEmptyLabelText = document.createElement("span");
    readerAdjustRemoveSingleEmptyLabelText.textContent = "\u53BB\u9664\u7A7A\u6BB5\u843D";
    readerAdjustRemoveSingleEmptyLabel.appendChild(readerAdjustRemoveSingleEmptyLabelText);
    const readerAdjustRemoveSingleEmptyBtn = document.createElement("button");
    readerAdjustRemoveSingleEmptyBtn.type = "button";
    readerAdjustRemoveSingleEmptyBtn.className = "esj-reader-adjust-btn esj-reader-adjust-toggle-btn";
    readerAdjustRemoveSingleEmptyBtn.setAttribute("aria-label", "\u53BB\u9664\u7A7A\u6BB5\u843D");
    readerAdjustRemoveSingleEmptyBtn.setAttribute("aria-pressed", "false");
    const iconReaderAdjustRemoveSingleEmptyCheckEl = iconCheck(18);
    iconReaderAdjustRemoveSingleEmptyCheckEl.style.display = "none";
    readerAdjustRemoveSingleEmptyBtn.appendChild(iconReaderAdjustRemoveSingleEmptyCheckEl);
    const readerAdjustRemoveSingleEmptyControls = document.createElement("div");
    readerAdjustRemoveSingleEmptyControls.className = "esj-reader-adjust-row";
    readerAdjustRemoveSingleEmptyControls.appendChild(readerAdjustRemoveSingleEmptyBtn);
    readerAdjustRemoveSingleEmptyRow.appendChild(readerAdjustRemoveSingleEmptyLabel);
    readerAdjustRemoveSingleEmptyRow.appendChild(readerAdjustRemoveSingleEmptyControls);
    readerAdjustPanel.appendChild(readerAdjustRemoveSingleEmptyRow);
    const readerAdjustActions = document.createElement("div");
    readerAdjustActions.className = "esj-reader-adjust-actions";
    const btnReaderAdjustApply = document.createElement("button");
    btnReaderAdjustApply.type = "button";
    btnReaderAdjustApply.id = "esj-reader-adjust-apply";
    btnReaderAdjustApply.textContent = "\u78BA\u5B9A";
    readerAdjustActions.appendChild(btnReaderAdjustApply);
    readerAdjustPanel.appendChild(readerAdjustActions);
    readerAdjustOverlay.appendChild(readerAdjustBackdrop);
    readerAdjustOverlay.appendChild(readerAdjustPanel);
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
    readerRoot.appendChild(readerAdjustOverlay);
    readerRoot.appendChild(pageJumpOverlay);
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
      readerRemoveSingleEmptyValue,
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
      btnReaderAdjustRemoveSingleEmpty: readerAdjustRemoveSingleEmptyBtn,
      btnReaderAdjustApply,
      iconReaderAdjustRemoveSingleEmptyCheckEl,
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
  function drawBottomMetadata(ctx, height, title, pageLabel, settings, textLeft, textWidth) {
    const metaY = height - settings.pagePaddingY / 2;
    const metaGap = 12;
    ctx.textBaseline = "middle";
    ctx.font = `13px ${settings.fontFamily}`;
    ctx.fillStyle = "#666";
    const rightW = ctx.measureText(pageLabel).width;
    const rightX = textLeft + textWidth;
    ctx.textAlign = "right";
    ctx.fillText(pageLabel, rightX, metaY);
    const titleMaxW = Math.max(0, textWidth - rightW - metaGap);
    const metaTitle = ellipsizeToWidth(ctx, title, titleMaxW);
    ctx.textAlign = "left";
    ctx.fillText(metaTitle, textLeft, metaY);
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
    pagePaddingX: 24,
    pagePaddingY: 24,
    pageMaxWidth: 880
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
      gap: 8px;
      height: var(--esj-header-h);
      min-height: var(--esj-header-h);
      padding: 0 16px;
      box-sizing: border-box;
      color: #111;
      text-decoration: none;
      border-top: 1px solid #e0e0e0;
      border-bottom: 1px solid #e0e0e0;
      background: #fff;
      -webkit-tap-highlight-color: transparent;
    }

    .esj-drawer-toc-text {
      font-size: 16px;
      color: #111;
      line-height: 1;
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
      gap: 4px;
    }

    .esj-drawer-reader-settings-title {
      font-size: 13px;
      color: #666;
      padding: 2px 4px 6px;
    }

    .esj-drawer-reader-settings-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-right: 4px;
    }

    .esj-drawer-settings-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 4px;
    }

    .esj-drawer-settings-content {
      display: none;
    }

    .esj-drawer-settings-content.open {
      display: block;
    }

    .esj-setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 2px;
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
      min-width: 0;
      flex-shrink: 0;
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
      min-width: 40px;
      text-align: center;
      font-size: 13px;
      color: #111;
      font-variant-numeric: tabular-nums;
    }

    .esj-setting-onoff {
      min-width: 44px;
      letter-spacing: 0.4px;
    }

    .esj-drawer-profile-section {
      border-top: 1px solid #ececec;
      margin-top: 4px;
      padding-top: 8px;
    }

    .esj-drawer-profile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-right: 4px;
    }

    .esj-drawer-profile-header-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .esj-drawer-profile-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 4px;
    }

    .esj-drawer-profile-content {
      display: none;
      margin-top: 4px;
    }

    .esj-drawer-profile-content.open {
      display: block;
    }

    .esj-drawer-font-section {
      border-top: 1px solid #ececec;
      margin-top: 4px;
      padding: 8px 4px 0;
    }

    .esj-setting-select {
      min-width: 160px;
      max-width: 190px;
      height: 32px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #fff;
      color: #111;
      padding: 0 8px;
      font-size: 13px;
    }

    .esj-font-web-controls {
      display: none;
      flex-direction: column;
      gap: 8px;
      margin: 8px 2px 2px;
    }

    .esj-font-web-controls.open {
      display: flex;
    }

    .esj-font-web-presets {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .esj-font-preset-row {
      display: grid;
      grid-template-columns: 1fr 84px 60px;
      align-items: center;
      gap: 8px;
    }

    .esj-font-preset-label {
      font-size: 13px;
      color: #333;
      white-space: nowrap;
    }

    .esj-font-weight-select {
      min-width: 84px;
      max-width: 84px;
    }

    .esj-font-preset-btn {
      width: 60px;
      height: 30px;
    }

    .esj-font-local-row.hidden {
      display: none;
    }

    .esj-setting-input {
      width: 100%;
      box-sizing: border-box;
      height: 32px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #fff;
      color: #111;
      padding: 0 8px;
      font-size: 13px;
    }

    .esj-font-web-apply-btn {
      width: 100%;
      height: 32px;
    }

    #esj-reader-adjust-overlay {
      position: fixed;
      inset: 0;
      z-index: 28;
      display: none;
      align-items: flex-start;
      justify-content: center;
      padding: min(16vh, 96px) 16px 24px;
      box-sizing: border-box;
      pointer-events: none;
    }

    #esj-reader-adjust-overlay.open {
      display: flex;
      pointer-events: auto;
    }

    .esj-reader-adjust-backdrop {
      position: absolute;
      inset: 0;
      background: transparent;
    }

    .esj-reader-adjust-panel {
      position: relative;
      width: min(460px, 100%);
      border: 1px solid #cfcfcf;
      border-radius: 10px;
      padding: 14px 14px 12px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
      color: #111;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .esj-reader-adjust-title {
      font-size: 15px;
      text-align: center;
      margin-bottom: 4px;
    }

    .esj-reader-adjust-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .esj-reader-adjust-item-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 13px;
      color: #444;
    }

    .esj-reader-adjust-item-value {
      font-variant-numeric: tabular-nums;
      color: #111;
    }

    .esj-reader-adjust-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .esj-reader-adjust-btn {
      width: 34px;
      height: 34px;
      border: 1px solid #bfbfbf;
      border-radius: 8px;
      background: #fff;
      color: #111;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      cursor: pointer;
      flex-shrink: 0;
    }

    .esj-reader-adjust-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }

    .esj-reader-adjust-range {
      flex: 1;
      min-width: 0;
    }

    .esj-setting-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: #333;
      padding: 6px 2px;
      margin-top: 0;
    }

    .esj-reader-adjust-toggle-btn {
      margin-left: 0;
    }

    .esj-reader-adjust-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 4px;
    }

    #esj-reader-adjust-apply {
      padding: 8px 16px;
      font-size: 15px;
      border: 1px solid #111;
      border-radius: 6px;
      background: #111;
      color: #fff;
      cursor: pointer;
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
      position: fixed;
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
  var READER_PROFILE_STORAGE_KEY = "esj-pager:reader-profile:v1";
  var READER_LAST_PAGE_STORAGE_KEY = "esj-pager:last-page:v1";
  var READER_FULLSCREEN_RESTORE_KEY = "esj-pager:restore-fullscreen-once:v1";
  var READER_WEB_FONT_STORAGE_KEY = "esj-pager:web-font:v1";
  var LOCAL_FONT_OPTIONS = [
    { label: "\u7CFB\u7D71\u9810\u8A2D", value: "serif" },
    {
      label: "\u601D\u6E90\u5B8B\u9AD4",
      value: '"Source Han Serif TC", "Source Han Serif", "Noto Serif CJK TC", "Noto Serif TC", "\u601D\u6E90\u5B8B\u9AD4", serif',
      detectFamilies: ["Source Han Serif TC", "Source Han Serif", "Noto Serif CJK TC", "Noto Serif TC", "\u601D\u6E90\u5B8B\u9AD4"]
    },
    {
      label: "\u601D\u6E90\u9ED1\u9AD4",
      value: '"Source Han Sans TC", "Source Han Sans", "Noto Sans CJK TC", "Noto Sans TC", "\u601D\u6E90\u9ED1\u9AD4", sans-serif',
      detectFamilies: ["Source Han Sans TC", "Source Han Sans", "Noto Sans CJK TC", "Noto Sans TC", "\u601D\u6E90\u9ED1\u9AD4"]
    },
    {
      label: "\u5FAE\u8EDF\u6B63\u9ED1\u9AD4",
      value: '"Microsoft JhengHei", sans-serif',
      detectFamilies: ["Microsoft JhengHei"]
    },
    {
      label: "\u65B0\u7D30\u660E\u9AD4",
      value: '"PMingLiU", serif',
      detectFamilies: ["PMingLiU"]
    }
  ];
  function main() {
    const root = getForumContent();
    if (!root) return;
    const title = getChapterTitle();
    const blocks = extractBlocksFromHtml(root.innerHTML);
    const commentsRoot = getCommentsRoot();
    const commentBlocks = commentsRoot ? extractCommentBlocksFromHtml(commentsRoot.innerHTML) : [];
    const allBlocks = [...blocks, ...commentBlocks];
    const chapterNav = getAdjacentChapterHrefs();
    const novelDetailHref = getNovelDetailHref();
    mountReader(title, allBlocks, chapterNav, novelDetailHref);
    console.info("[esj-pager]", title, "blocks:", allBlocks.length);
  }
  function mountReader(title, blocks, chapterNav, novelDetailHref) {
    const refs = createReaderDom(title, novelDetailHref, chapterNav);
    const {
      style,
      readerRoot,
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
      readerSettingPagePaddingXValue,
      readerSettingPagePaddingYValue,
      readerSettingPageMaxWidthValue,
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
      profileFontValue,
      profileLineHeightValue,
      profileParaSpacingValue,
      profilePagePaddingXValue,
      profilePagePaddingYValue,
      profilePageMaxWidthValue,
      profileRemoveSingleEmptyValue,
      selectFontSource,
      fontLocalRow,
      selectLocalFont,
      fontWebControls,
      inputWebFontCssUrl,
      inputWebFontFamily,
      btnApplyWebFont,
      readerRemoveSingleEmptyValue,
      readerAdjustOverlay,
      readerAdjustBackdrop,
      readerAdjustPanel,
      readerAdjustFontValue,
      btnReaderAdjustFontDec,
      rangeReaderAdjustFont,
      btnReaderAdjustFontInc,
      readerAdjustLineHeightValue,
      btnReaderAdjustLineHeightDec,
      rangeReaderAdjustLineHeight,
      btnReaderAdjustLineHeightInc,
      readerAdjustParaSpacingValue,
      btnReaderAdjustParaSpacingDec,
      rangeReaderAdjustParaSpacing,
      btnReaderAdjustParaSpacingInc,
      readerAdjustPagePaddingXValue,
      btnReaderAdjustPagePaddingXDec,
      rangeReaderAdjustPagePaddingX,
      btnReaderAdjustPagePaddingXInc,
      readerAdjustPagePaddingYValue,
      btnReaderAdjustPagePaddingYDec,
      rangeReaderAdjustPagePaddingY,
      btnReaderAdjustPagePaddingYInc,
      readerAdjustPageMaxWidthValue,
      btnReaderAdjustPageMaxWidthDec,
      rangeReaderAdjustPageMaxWidth,
      btnReaderAdjustPageMaxWidthInc,
      btnReaderAdjustRemoveSingleEmpty,
      btnReaderAdjustApply,
      iconReaderAdjustRemoveSingleEmptyCheckEl,
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
    const rootEl = document.documentElement;
    const bodyEl = document.body;
    const prevRootOverflow = rootEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    rootEl.style.overflow = "hidden";
    bodyEl.style.overflow = "hidden";
    const restorePageScroll = () => {
      rootEl.style.overflow = prevRootOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
    };
    window.addEventListener("pagehide", restorePageScroll, { once: true });
    let pageStarts = [];
    let pageIndex = 0;
    let lastCanvasW = -1;
    let lastCanvasH = -1;
    let chromeVisible = true;
    let activeChromePreset = null;
    let activeChromeSettings = chromeSettingsTablet;
    let swipeStartX = null;
    let swipeStartY = null;
    let suppressNextSideTap = false;
    let removeSingleEmptyParagraph = false;
    let pagedBlocks = blocks;
    const currentReaderSettings = { ...readerSettings };
    const chapterPageStorageKey = `${window.location.pathname}${window.location.search}`;
    let pendingRestorePageIndex = null;
    let lastSavedPageIndex = -1;
    const readerLimits = {
      fontSize: { min: 14, max: 56, step: 1 },
      lineHeight: { min: 1, max: 3.2, step: 0.05 },
      paragraphSpacing: { min: 0, max: 72, step: 2 },
      pagePaddingX: { min: 0, max: 180, step: 2 },
      pagePaddingY: { min: 0, max: 180, step: 2 },
      pageMaxWidth: { min: 320, max: 2400, step: 20 }
    };
    let hasSavedProfile = false;
    let readerSettingsExpanded = false;
    let profileExpanded = false;
    let savedProfile = null;
    const imageCache = /* @__PURE__ */ new Map();
    let lastRenderedPageIndex = -1;
    let shouldRestoreFullscreenOnNextTap = false;
    let adjustAnchorCursor = null;
    let previewFromAdjust = false;
    let fontSource = "local";
    let webFontLinkEl = null;
    const sourceLocalOption = document.createElement("option");
    sourceLocalOption.value = "local";
    sourceLocalOption.textContent = "\u672C\u6A5F\u5B57\u9AD4";
    selectFontSource.appendChild(sourceLocalOption);
    const sourceWebOption = document.createElement("option");
    sourceWebOption.value = "web";
    sourceWebOption.textContent = "Web Font";
    selectFontSource.appendChild(sourceWebOption);
    selectFontSource.value = "local";
    function isFontFamilyLikelyAvailable(family) {
      const canvasEl = document.createElement("canvas");
      const ctx = canvasEl.getContext("2d");
      if (!ctx) return false;
      const text = "abcdefghijklmnopqrstuvwxyz0123456789\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341";
      const baseFamilies = ["monospace", "serif", "sans-serif"];
      const baseWidths = baseFamilies.map((base) => {
        ctx.font = `72px ${base}`;
        return ctx.measureText(text).width;
      });
      ctx.font = `72px "${family}", monospace`;
      const testWidth = ctx.measureText(text).width;
      return !baseWidths.some((w) => Math.abs(testWidth - w) < 0.01);
    }
    function isAnyFontFamilyAvailable(families) {
      return families.some((family) => isFontFamilyLikelyAvailable(family));
    }
    function syncFontSourceUi() {
      selectFontSource.value = fontSource;
      selectLocalFont.disabled = fontSource !== "local";
      fontLocalRow.classList.toggle("hidden", fontSource !== "local");
      fontWebControls.classList.toggle("open", fontSource === "web");
    }
    function saveWebFontConfig(config) {
      try {
        window.localStorage.setItem(READER_WEB_FONT_STORAGE_KEY, JSON.stringify(config));
      } catch {
      }
    }
    function loadWebFontConfig() {
      try {
        const raw = window.localStorage.getItem(READER_WEB_FONT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.cssUrl !== "string" || typeof parsed.family !== "string") return null;
        const cssUrl = parsed.cssUrl.trim();
        const family = parsed.family.trim();
        if (!cssUrl || !family) return null;
        return { cssUrl, family };
      } catch {
        return null;
      }
    }
    function ensureWebFontStylesheet(cssUrl) {
      if (webFontLinkEl && webFontLinkEl.href === cssUrl) return;
      if (webFontLinkEl) webFontLinkEl.remove();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssUrl;
      document.head.appendChild(link);
      webFontLinkEl = link;
    }
    async function applyWebFont(cssUrl, family) {
      ensureWebFontStylesheet(cssUrl);
      const familyExpr = family.includes(",") ? family : `"${family}"`;
      await Promise.race([
        document.fonts.load(`16px ${familyExpr}`),
        new Promise((resolve) => setTimeout(resolve, 2500))
      ]);
      currentReaderSettings.fontFamily = family;
      fontSource = "web";
      syncFontSourceUi();
      updateReaderSettingsUi();
      lastCanvasW = -1;
      lastCanvasH = -1;
      render();
      saveWebFontConfig({ cssUrl, family });
    }
    function getPresetWebFontConfig(presetId, weight) {
      const clampedWeight = Math.max(100, Math.min(900, Math.round(weight / 100) * 100));
      if (presetId === "noto-serif-tc") {
        return {
          cssUrl: `https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@${clampedWeight}&display=swap`,
          family: "Noto Serif TC"
        };
      }
      if (presetId === "noto-sans-tc") {
        return {
          cssUrl: `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@${clampedWeight}&display=swap`,
          family: "Noto Sans TC"
        };
      }
      return null;
    }
    for (const option of LOCAL_FONT_OPTIONS) {
      if (option.detectFamilies && !isAnyFontFamilyAvailable(option.detectFamilies)) continue;
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      selectLocalFont.appendChild(el);
    }
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
    function markFullscreenRestoreForNextChapterNavigation() {
      try {
        if (document.fullscreenElement) {
          window.sessionStorage.setItem(READER_FULLSCREEN_RESTORE_KEY, "1");
        } else {
          window.sessionStorage.removeItem(READER_FULLSCREEN_RESTORE_KEY);
        }
      } catch {
      }
    }
    function loadFullscreenRestoreFlag() {
      try {
        shouldRestoreFullscreenOnNextTap = window.sessionStorage.getItem(READER_FULLSCREEN_RESTORE_KEY) === "1";
      } catch {
        shouldRestoreFullscreenOnNextTap = false;
      }
    }
    function clearFullscreenRestoreFlag() {
      shouldRestoreFullscreenOnNextTap = false;
      try {
        window.sessionStorage.removeItem(READER_FULLSCREEN_RESTORE_KEY);
      } catch {
      }
    }
    function restoreFullscreenOnFirstTap() {
      if (!shouldRestoreFullscreenOnNextTap) return;
      if (document.fullscreenElement) {
        clearFullscreenRestoreFlag();
        return;
      }
      clearFullscreenRestoreFlag();
      void readerRoot.requestFullscreen().catch(() => {
      });
    }
    function ensureImage(src) {
      const cached = imageCache.get(src);
      if (cached) return cached;
      const img = new Image();
      const entry = {
        img,
        status: "loading",
        naturalWidth: 0,
        naturalHeight: 0
      };
      img.onload = () => {
        entry.status = "loaded";
        entry.naturalWidth = img.naturalWidth || 0;
        entry.naturalHeight = img.naturalHeight || 0;
        lastCanvasW = -1;
        lastCanvasH = -1;
        render();
      };
      img.onerror = () => {
        entry.status = "error";
        lastCanvasW = -1;
        lastCanvasH = -1;
        render();
      };
      img.src = src;
      imageCache.set(src, entry);
      return entry;
    }
    function getImageRenderInfo(src, maxWidth) {
      const entry = ensureImage(src);
      if (entry.status !== "loaded" || entry.naturalWidth <= 0 || entry.naturalHeight <= 0) {
        return { ready: false, drawWidth: maxWidth, drawHeight: Math.max(80, Math.floor(maxWidth * 0.56)) };
      }
      const scale = maxWidth > 0 ? Math.min(1, maxWidth / entry.naturalWidth) : 1;
      return {
        ready: true,
        drawWidth: Math.max(1, Math.floor(entry.naturalWidth * scale)),
        drawHeight: Math.max(1, Math.floor(entry.naturalHeight * scale))
      };
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
      setIconSize(iconHeaderFullscreenExpand, settings.iconMenuSize);
      setIconSize(iconHeaderFullscreenShrink, settings.iconMenuSize);
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
    function compareCursor(a, b) {
      if (a.bi !== b.bi) return a.bi - b.bi;
      return a.off - b.off;
    }
    function findPageIndexByCursor(starts, target) {
      if (starts.length === 0) return 0;
      let idx = 0;
      for (let i = 0; i < starts.length; i += 1) {
        if (compareCursor(starts[i], target) <= 0) idx = i;
        else break;
      }
      return idx;
    }
    function formatLineHeight(v) {
      return Number(v.toFixed(2)).toString();
    }
    function syncLocalFontSelectUi() {
      const match = LOCAL_FONT_OPTIONS.find((opt) => opt.value === currentReaderSettings.fontFamily);
      if (match) {
        selectLocalFont.value = match.value;
        return;
      }
      selectLocalFont.value = "";
    }
    function updateReaderSettingsUi() {
      readerSettingFontValue.textContent = `${currentReaderSettings.fontSize}`;
      readerSettingLineHeightValue.textContent = formatLineHeight(currentReaderSettings.lineHeight);
      readerSettingParaSpacingValue.textContent = `${currentReaderSettings.paragraphSpacing}`;
      readerSettingPagePaddingXValue.textContent = `${currentReaderSettings.pagePaddingX}`;
      readerSettingPagePaddingYValue.textContent = `${currentReaderSettings.pagePaddingY}`;
      readerSettingPageMaxWidthValue.textContent = `${currentReaderSettings.pageMaxWidth}`;
      syncLocalFontSelectUi();
      syncReaderAdjustUi();
      btnProfileRestore.disabled = !hasSavedProfile;
    }
    function setProfileExpanded(expanded) {
      profileExpanded = expanded;
      btnProfileDropdown.setAttribute("aria-expanded", expanded ? "true" : "false");
      profileContent.classList.toggle("open", expanded);
      iconProfileChevronDownEl.style.display = expanded ? "none" : "";
      iconProfileChevronUpEl.style.display = expanded ? "" : "none";
    }
    function setReaderSettingsExpanded(expanded) {
      readerSettingsExpanded = expanded;
      btnReaderSettingsDropdown.setAttribute("aria-expanded", expanded ? "true" : "false");
      readerSettingsContent.classList.toggle("open", expanded);
      iconReaderSettingsChevronDownEl.style.display = expanded ? "none" : "";
      iconReaderSettingsChevronUpEl.style.display = expanded ? "" : "none";
    }
    function updateProfileUi() {
      if (!savedProfile) {
        profileFontValue.textContent = "-";
        profileLineHeightValue.textContent = "-";
        profileParaSpacingValue.textContent = "-";
        profilePagePaddingXValue.textContent = "-";
        profilePagePaddingYValue.textContent = "-";
        profilePageMaxWidthValue.textContent = "-";
        profileRemoveSingleEmptyValue.textContent = "-";
        return;
      }
      profileFontValue.textContent = String(savedProfile.fontSize);
      profileLineHeightValue.textContent = formatLineHeight(savedProfile.lineHeight);
      profileParaSpacingValue.textContent = String(savedProfile.paragraphSpacing);
      profilePagePaddingXValue.textContent = String(savedProfile.pagePaddingX);
      profilePagePaddingYValue.textContent = String(savedProfile.pagePaddingY);
      profilePageMaxWidthValue.textContent = String(savedProfile.pageMaxWidth);
      profileRemoveSingleEmptyValue.textContent = savedProfile.removeSingleEmptyParagraph ? "ON" : "OFF";
    }
    function saveReaderProfile() {
      const payload = {
        fontFamily: currentReaderSettings.fontFamily,
        fontSize: currentReaderSettings.fontSize,
        lineHeight: currentReaderSettings.lineHeight,
        paragraphSpacing: currentReaderSettings.paragraphSpacing,
        pagePaddingX: currentReaderSettings.pagePaddingX,
        pagePaddingY: currentReaderSettings.pagePaddingY,
        pageMaxWidth: currentReaderSettings.pageMaxWidth,
        removeSingleEmptyParagraph
      };
      try {
        window.localStorage.setItem(READER_PROFILE_STORAGE_KEY, JSON.stringify(payload));
        savedProfile = { ...payload };
        hasSavedProfile = true;
        updateProfileUi();
        updateReaderSettingsUi();
      } catch {
        window.alert("\u5132\u5B58\u8A2D\u5B9A\u6A94\u5931\u6557");
      }
    }
    function loadSavedReaderProfile() {
      try {
        const raw = window.localStorage.getItem(READER_PROFILE_STORAGE_KEY);
        if (!raw) {
          savedProfile = null;
          hasSavedProfile = false;
          updateProfileUi();
          return false;
        }
        const parsed = JSON.parse(raw);
        let changed = false;
        if (typeof parsed.fontFamily === "string" && parsed.fontFamily.trim().length > 0) {
          if (currentReaderSettings.fontFamily !== parsed.fontFamily) {
            currentReaderSettings.fontFamily = parsed.fontFamily;
            changed = true;
          }
        }
        for (const key of Object.keys(readerLimits)) {
          const nextRaw = parsed[key];
          if (!Number.isFinite(nextRaw)) continue;
          const limits = readerLimits[key];
          const next = clamp(roundByStep(nextRaw, limits.step), limits.min, limits.max);
          if (currentReaderSettings[key] === next) continue;
          currentReaderSettings[key] = next;
          changed = true;
        }
        if (typeof parsed.removeSingleEmptyParagraph === "boolean") {
          const nextRemoveSingleEmptyParagraph = parsed.removeSingleEmptyParagraph;
          if (removeSingleEmptyParagraph !== nextRemoveSingleEmptyParagraph) {
            removeSingleEmptyParagraph = nextRemoveSingleEmptyParagraph;
            updateRemoveSingleEmptyParagraphUi();
            pagedBlocks = applyEmptyParagraphFilter(blocks);
            changed = true;
          }
        }
        savedProfile = {
          fontFamily: typeof parsed.fontFamily === "string" && parsed.fontFamily.trim().length > 0 ? parsed.fontFamily : currentReaderSettings.fontFamily,
          fontSize: Number.isFinite(parsed.fontSize) ? clamp(roundByStep(parsed.fontSize, readerLimits.fontSize.step), readerLimits.fontSize.min, readerLimits.fontSize.max) : currentReaderSettings.fontSize,
          lineHeight: Number.isFinite(parsed.lineHeight) ? clamp(roundByStep(parsed.lineHeight, readerLimits.lineHeight.step), readerLimits.lineHeight.min, readerLimits.lineHeight.max) : currentReaderSettings.lineHeight,
          paragraphSpacing: Number.isFinite(parsed.paragraphSpacing) ? clamp(roundByStep(parsed.paragraphSpacing, readerLimits.paragraphSpacing.step), readerLimits.paragraphSpacing.min, readerLimits.paragraphSpacing.max) : currentReaderSettings.paragraphSpacing,
          pagePaddingX: Number.isFinite(parsed.pagePaddingX) ? clamp(roundByStep(parsed.pagePaddingX, readerLimits.pagePaddingX.step), readerLimits.pagePaddingX.min, readerLimits.pagePaddingX.max) : currentReaderSettings.pagePaddingX,
          pagePaddingY: Number.isFinite(parsed.pagePaddingY) ? clamp(roundByStep(parsed.pagePaddingY, readerLimits.pagePaddingY.step), readerLimits.pagePaddingY.min, readerLimits.pagePaddingY.max) : currentReaderSettings.pagePaddingY,
          pageMaxWidth: Number.isFinite(parsed.pageMaxWidth) ? clamp(roundByStep(parsed.pageMaxWidth, readerLimits.pageMaxWidth.step), readerLimits.pageMaxWidth.min, readerLimits.pageMaxWidth.max) : currentReaderSettings.pageMaxWidth,
          removeSingleEmptyParagraph: typeof parsed.removeSingleEmptyParagraph === "boolean" ? parsed.removeSingleEmptyParagraph : removeSingleEmptyParagraph
        };
        hasSavedProfile = true;
        updateProfileUi();
        updateReaderSettingsUi();
        return changed;
      } catch {
        savedProfile = null;
        hasSavedProfile = false;
        updateProfileUi();
        return false;
      }
    }
    function loadSavedPageIndex() {
      try {
        const raw = window.localStorage.getItem(READER_LAST_PAGE_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const savedPage = parsed[chapterPageStorageKey];
        if (!Number.isFinite(savedPage)) return;
        const nextIndex = Math.max(0, Math.floor(savedPage) - 1);
        pendingRestorePageIndex = nextIndex;
      } catch {
      }
    }
    function saveCurrentPageIndex() {
      if (pageStarts.length === 0) return;
      if (pageIndex === lastSavedPageIndex) return;
      try {
        const raw = window.localStorage.getItem(READER_LAST_PAGE_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed[chapterPageStorageKey] = pageIndex + 1;
        window.localStorage.setItem(READER_LAST_PAGE_STORAGE_KEY, JSON.stringify(parsed));
        lastSavedPageIndex = pageIndex;
      } catch {
      }
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
      readerRemoveSingleEmptyValue.textContent = removeSingleEmptyParagraph ? "ON" : "OFF";
      btnReaderAdjustRemoveSingleEmpty.setAttribute("aria-pressed", removeSingleEmptyParagraph ? "true" : "false");
      iconReaderAdjustRemoveSingleEmptyCheckEl.style.display = removeSingleEmptyParagraph ? "" : "none";
    }
    function toggleRemoveSingleEmptyParagraph() {
      removeSingleEmptyParagraph = !removeSingleEmptyParagraph;
      updateRemoveSingleEmptyParagraphUi();
      pagedBlocks = applyEmptyParagraphFilter(blocks);
      if (!previewFromAdjust) {
        pageIndex = 0;
        lastCanvasW = -1;
        lastCanvasH = -1;
      }
      render();
    }
    function adjustReaderSetting(key, delta) {
      const limits = readerLimits[key];
      const next = clamp(roundByStep(currentReaderSettings[key] + delta, limits.step), limits.min, limits.max);
      if (next === currentReaderSettings[key]) return;
      currentReaderSettings[key] = next;
      updateReaderSettingsUi();
      if (!previewFromAdjust) {
        lastCanvasW = -1;
        lastCanvasH = -1;
      }
      render();
    }
    function finalizeReaderAdjustRebuild() {
      const anchor = adjustAnchorCursor;
      previewFromAdjust = false;
      adjustAnchorCursor = null;
      if (!anchor) return;
      lastCanvasW = -1;
      lastCanvasH = -1;
      render();
      if (pageStarts.length > 0) {
        pageIndex = findPageIndexByCursor(pageStarts, anchor);
        render();
      }
    }
    function closeReaderAdjust(restoreChrome = false) {
      if (previewFromAdjust) {
        finalizeReaderAdjustRebuild();
      }
      readerAdjustOverlay.classList.remove("open");
      readerAdjustOverlay.setAttribute("aria-hidden", "true");
      if (restoreChrome && !chromeVisible) {
        chromeVisible = true;
        applyChromeVisibility();
        syncCanvasTapLayerLayout();
      }
      openDrawer();
    }
    function syncReaderAdjustUi() {
      function syncOne(key, valueEl, rangeEl, decBtn, incBtn) {
        const limits = readerLimits[key];
        const value = currentReaderSettings[key];
        valueEl.textContent = key === "lineHeight" ? formatLineHeight(value) : String(value);
        rangeEl.min = String(limits.min);
        rangeEl.max = String(limits.max);
        rangeEl.step = String(limits.step);
        rangeEl.value = String(value);
        decBtn.disabled = value <= limits.min;
        incBtn.disabled = value >= limits.max;
      }
      syncOne("fontSize", readerAdjustFontValue, rangeReaderAdjustFont, btnReaderAdjustFontDec, btnReaderAdjustFontInc);
      syncOne(
        "lineHeight",
        readerAdjustLineHeightValue,
        rangeReaderAdjustLineHeight,
        btnReaderAdjustLineHeightDec,
        btnReaderAdjustLineHeightInc
      );
      syncOne(
        "paragraphSpacing",
        readerAdjustParaSpacingValue,
        rangeReaderAdjustParaSpacing,
        btnReaderAdjustParaSpacingDec,
        btnReaderAdjustParaSpacingInc
      );
      syncOne(
        "pagePaddingX",
        readerAdjustPagePaddingXValue,
        rangeReaderAdjustPagePaddingX,
        btnReaderAdjustPagePaddingXDec,
        btnReaderAdjustPagePaddingXInc
      );
      syncOne(
        "pagePaddingY",
        readerAdjustPagePaddingYValue,
        rangeReaderAdjustPagePaddingY,
        btnReaderAdjustPagePaddingYDec,
        btnReaderAdjustPagePaddingYInc
      );
      syncOne(
        "pageMaxWidth",
        readerAdjustPageMaxWidthValue,
        rangeReaderAdjustPageMaxWidth,
        btnReaderAdjustPageMaxWidthDec,
        btnReaderAdjustPageMaxWidthInc
      );
    }
    function openReaderAdjust() {
      closeDrawer();
      if (chromeVisible) {
        chromeVisible = false;
        applyChromeVisibility();
        syncCanvasTapLayerLayout();
      }
      adjustAnchorCursor = pageStarts[pageIndex] ? { ...pageStarts[pageIndex] } : { bi: 0, off: 0 };
      previewFromAdjust = true;
      syncReaderAdjustUi();
      readerAdjustOverlay.classList.add("open");
      readerAdjustOverlay.setAttribute("aria-hidden", "false");
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
      if (ok) {
        markFullscreenRestoreForNextChapterNavigation();
        window.location.href = chapterNav.prev;
      }
    }
    function confirmGoNextChapter() {
      if (!chapterNav.next) return;
      const ok = window.confirm("\u5DF2\u5728\u6700\u5F8C\u4E00\u9801\uFF0C\u662F\u5426\u524D\u5F80\u4E0B\u4E00\u7AE0\uFF1F");
      if (ok) {
        markFullscreenRestoreForNextChapterNavigation();
        window.location.href = chapterNav.next;
      }
    }
    function toggleChrome() {
      chromeVisible = !chromeVisible;
      applyChromeVisibility();
      syncCanvasTapLayerLayout();
    }
    function syncHeaderFullscreenUi() {
      const isFullscreen = Boolean(document.fullscreenElement);
      btnHeaderFullscreen.setAttribute("aria-pressed", isFullscreen ? "true" : "false");
      btnHeaderFullscreen.setAttribute("aria-label", isFullscreen ? "\u96E2\u958B\u5168\u87A2\u5E55" : "\u9032\u5165\u5168\u87A2\u5E55");
      iconHeaderFullscreenExpand.style.display = isFullscreen ? "none" : "";
      iconHeaderFullscreenShrink.style.display = isFullscreen ? "" : "none";
    }
    function toggleFullscreen() {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {
        });
        return;
      }
      void readerRoot.requestFullscreen().catch(() => {
      });
    }
    function handleSideTapPaging() {
      if (suppressNextSideTap) {
        suppressNextSideTap = false;
        return;
      }
      if (pageIndex >= pageStarts.length - 1) {
        confirmGoNextChapter();
      } else {
        goNextPage();
      }
    }
    function handleSwipePointerDown(e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      swipeStartX = e.clientX;
      swipeStartY = e.clientY;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    function resetSwipeTracking() {
      swipeStartX = null;
      swipeStartY = null;
    }
    function handleSwipePointerUp(e) {
      if (swipeStartX === null || swipeStartY === null) return;
      const dx = e.clientX - swipeStartX;
      const dy = e.clientY - swipeStartY;
      resetSwipeTracking();
      const swipeThresholdPx = 36;
      if (Math.abs(dx) < swipeThresholdPx) return;
      if (Math.abs(dx) <= Math.abs(dy)) return;
      suppressNextSideTap = true;
      if (dx < 0) {
        if (pageIndex <= 0) {
          confirmGoPrevChapter();
        } else {
          goPrevPage();
        }
        return;
      }
      if (pageIndex >= pageStarts.length - 1) {
        confirmGoNextChapter();
      } else {
        goNextPage();
      }
    }
    function handleCanvasTapWheel(e) {
      const maxScrollTop = canvasWrap.scrollHeight - canvasWrap.clientHeight;
      if (maxScrollTop <= 0) return;
      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, canvasWrap.scrollTop + e.deltaY));
      if (nextScrollTop === canvasWrap.scrollTop) return;
      e.preventDefault();
      canvasWrap.scrollTop = nextScrollTop;
    }
    function handleRightClickPrevPage(e) {
      e.preventDefault();
      if (pageIndex <= 0) {
        confirmGoPrevChapter();
        return;
      }
      goPrevPage();
    }
    function render() {
      updateResponsiveChrome();
      const dpr = window.devicePixelRatio || 1;
      const width = canvasWrap.clientWidth;
      const viewportHeight = canvasWrap.clientHeight;
      if (width === 0 || viewportHeight === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const maxHeight = Math.max(0, viewportHeight - currentReaderSettings.pagePaddingY * 2);
      const availableTextWidth = Math.max(0, width - currentReaderSettings.pagePaddingX * 2);
      const textWidth = Math.min(availableTextWidth, currentReaderSettings.pageMaxWidth);
      const textLeft = Math.max(0, Math.floor((width - textWidth) / 2));
      const linePx = currentReaderSettings.fontSize * currentReaderSettings.lineHeight;
      const layout = {
        padX: currentReaderSettings.pagePaddingX,
        padY: currentReaderSettings.pagePaddingY,
        textLeft,
        textWidth,
        maxWidth: textWidth,
        maxHeight,
        linePx,
        paraSpacing: currentReaderSettings.paragraphSpacing
      };
      const useAdjustPreview = previewFromAdjust && adjustAnchorCursor !== null;
      const sameSize = !useAdjustPreview && pageStarts.length > 0 && width === lastCanvasW && viewportHeight === lastCanvasH;
      if (!sameSize) {
        if (!useAdjustPreview) {
          pageStarts = buildPageStarts(ctx, pagedBlocks, layout, {
            imagePlaceholderText: "\u3010\u5716\u3011",
            getImageRenderInfo
          });
          lastCanvasW = width;
          lastCanvasH = viewportHeight;
          if (pendingRestorePageIndex !== null) {
            pageIndex = pendingRestorePageIndex;
            pendingRestorePageIndex = null;
          }
          pageIndex = Math.min(pageIndex, Math.max(0, pageStarts.length - 1));
        }
      }
      updatePageChrome();
      syncCanvasTapLayerLayout();
      if (!useAdjustPreview) {
        saveCurrentPageIndex();
      }
      const startCursor = useAdjustPreview ? adjustAnchorCursor : pageStarts[pageIndex];
      if (!startCursor) return;
      if (!useAdjustPreview && pageStarts.length === 0) return;
      let drawHeight = viewportHeight;
      const startBlock = pagedBlocks[startCursor.bi];
      if (startBlock?.type === "img") {
        const info = getImageRenderInfo(startBlock.src, layout.maxWidth);
        if (info.ready && info.drawHeight > layout.maxHeight) {
          drawHeight = currentReaderSettings.pagePaddingY * 2 + info.drawHeight;
        }
      }
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(drawHeight * dpr);
      canvas.style.height = `${drawHeight}px`;
      canvasWrap.style.overflowY = drawHeight > viewportHeight ? "auto" : "hidden";
      if (pageIndex !== lastRenderedPageIndex) {
        canvasWrap.scrollTop = 0;
        lastRenderedPageIndex = pageIndex;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, drawHeight);
      ctx.fillStyle = "#111";
      ctx.textBaseline = "top";
      ctx.font = `${currentReaderSettings.fontSize}px ${currentReaderSettings.fontFamily}`;
      walkOnePage(ctx, pagedBlocks, startCursor, layout, true, {
        imagePlaceholderText: "\u3010\u5716\u3011",
        getImageRenderInfo,
        drawImage: (src, x, y, w, h) => {
          const entry = ensureImage(src);
          if (entry.status !== "loaded") {
            ctx.fillText("\u3010\u5716\u3011", x, y);
            return;
          }
          ctx.drawImage(entry.img, x, y, w, h);
        }
      });
      drawBottomMetadata(
        ctx,
        drawHeight,
        title,
        `${pageIndex + 1} / ${pageStarts.length}`,
        currentReaderSettings,
        textLeft,
        textWidth
      );
    }
    btnHeaderMenu.addEventListener("click", () => {
      if (drawerOverlay.classList.contains("open")) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
    btnHeaderFullscreen.addEventListener("click", toggleFullscreen);
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
    readerAdjustBackdrop.addEventListener("click", () => {
      closeReaderAdjust(true);
    });
    readerAdjustPanel.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    function isEditableTarget(target) {
      const el = target;
      const tag = el?.tagName?.toLowerCase();
      return Boolean(el?.isContentEditable) || tag === "input" || tag === "textarea" || tag === "select";
    }
    function shouldInterceptReaderHotkey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (isEditableTarget(e.target)) return false;
      return e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key.toLowerCase() === "f";
    }
    const handleReaderHotkeys = (e) => {
      if (e.key === "Escape") {
        if (drawerOverlay.classList.contains("open")) {
          closeDrawer();
          return;
        }
        if (pageJumpOverlay.classList.contains("open")) {
          closePageJump();
          return;
        }
        if (readerAdjustOverlay.classList.contains("open")) {
          closeReaderAdjust();
          return;
        }
        if (!chromeVisible) {
          chromeVisible = true;
          applyChromeVisibility();
          syncCanvasTapLayerLayout();
        }
        return;
      }
      if (!shouldInterceptReaderHotkey(e)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (pageIndex <= 0) {
          confirmGoPrevChapter();
        } else {
          goPrevPage();
        }
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (pageIndex >= pageStarts.length - 1) {
          confirmGoNextChapter();
        } else {
          goNextPage();
        }
        return;
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleReaderHotkeys, { capture: true });
    window.addEventListener("keyup", (e) => {
      if (!shouldInterceptReaderHotkey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, { capture: true });
    btnPrevChap.addEventListener("click", () => {
      if (!chapterNav.prev) return;
      markFullscreenRestoreForNextChapterNavigation();
      window.location.href = chapterNav.prev;
    });
    btnPrevPage.addEventListener("click", goPrevPage);
    btnNextPage.addEventListener("click", goNextPage);
    btnTapPrevPage.addEventListener("click", handleSideTapPaging);
    btnTapPrevPage.addEventListener("pointerdown", handleSwipePointerDown);
    btnTapPrevPage.addEventListener("pointerup", handleSwipePointerUp);
    btnTapPrevPage.addEventListener("pointercancel", resetSwipeTracking);
    btnTapPrevPage.addEventListener("wheel", handleCanvasTapWheel, { passive: false });
    btnTapPrevPage.addEventListener("contextmenu", handleRightClickPrevPage);
    btnTapChrome.addEventListener("click", toggleChrome);
    btnTapChrome.addEventListener("wheel", handleCanvasTapWheel, { passive: false });
    btnTapChrome.addEventListener("contextmenu", handleRightClickPrevPage);
    btnTapNextPage.addEventListener("click", handleSideTapPaging);
    btnTapNextPage.addEventListener("pointerdown", handleSwipePointerDown);
    btnTapNextPage.addEventListener("pointerup", handleSwipePointerUp);
    btnTapNextPage.addEventListener("pointercancel", resetSwipeTracking);
    btnTapNextPage.addEventListener("wheel", handleCanvasTapWheel, { passive: false });
    btnTapNextPage.addEventListener("contextmenu", handleRightClickPrevPage);
    btnReaderSettingsAdjust.addEventListener("click", openReaderAdjust);
    btnReaderSettingsDropdown.addEventListener("click", () => {
      setReaderSettingsExpanded(!readerSettingsExpanded);
    });
    selectFontSource.addEventListener("change", () => {
      fontSource = selectFontSource.value === "web" ? "web" : "local";
      syncFontSourceUi();
    });
    selectLocalFont.addEventListener("change", () => {
      if (fontSource !== "local") return;
      const next = selectLocalFont.value;
      if (!next || next === currentReaderSettings.fontFamily) return;
      currentReaderSettings.fontFamily = next;
      updateReaderSettingsUi();
      lastCanvasW = -1;
      lastCanvasH = -1;
      render();
    });
    const applyWebFontFromInputs = async () => {
      const cssUrl = inputWebFontCssUrl.value.trim();
      const family = inputWebFontFamily.value.trim();
      if (!cssUrl || !family) {
        window.alert("\u8ACB\u8F38\u5165 Web Font \u7684 CSS URL \u8207 font-family");
        return;
      }
      if (!/^https:\/\//i.test(cssUrl)) {
        window.alert("Web Font URL \u5FC5\u9808\u662F https://");
        return;
      }
      btnApplyWebFont.disabled = true;
      try {
        await applyWebFont(cssUrl, family);
      } catch {
        window.alert("Web Font \u5957\u7528\u5931\u6557\uFF0C\u8ACB\u78BA\u8A8D URL \u8207 font-family");
      } finally {
        btnApplyWebFont.disabled = false;
      }
    };
    fontWebControls.addEventListener("click", (e) => {
      const target = e.target;
      const presetBtn = target?.closest(".esj-font-preset-btn");
      if (!presetBtn) return;
      const presetId = presetBtn.dataset.fontPreset ?? "";
      const row = presetBtn.closest(".esj-font-preset-row");
      const weightSelect = row?.querySelector(".esj-font-weight-select");
      const weight = Number(weightSelect?.value ?? 400);
      const config = getPresetWebFontConfig(presetId, weight);
      if (!config) return;
      inputWebFontCssUrl.value = config.cssUrl;
      inputWebFontFamily.value = config.family;
      void applyWebFontFromInputs();
    });
    btnApplyWebFont.addEventListener("click", () => {
      void applyWebFontFromInputs();
    });
    btnProfileDropdown.addEventListener("click", () => {
      setProfileExpanded(!profileExpanded);
    });
    btnProfileSave.addEventListener("click", saveReaderProfile);
    btnProfileRestore.addEventListener("click", () => {
      const changed = loadSavedReaderProfile();
      if (!hasSavedProfile) {
        window.alert("\u5C1A\u672A\u5132\u5B58\u8A2D\u5B9A\u6A94");
        return;
      }
      if (!changed) return;
      lastCanvasW = -1;
      lastCanvasH = -1;
      render();
    });
    function applyReaderSettingFromSlider(key, rawValue) {
      const limits = readerLimits[key];
      if (!Number.isFinite(rawValue)) return;
      const next = clamp(roundByStep(rawValue, limits.step), limits.min, limits.max);
      if (next === currentReaderSettings[key]) return;
      currentReaderSettings[key] = next;
      updateReaderSettingsUi();
      if (!previewFromAdjust) {
        lastCanvasW = -1;
        lastCanvasH = -1;
      }
      render();
    }
    function bindAdjustRow(key, decBtn, incBtn, rangeEl) {
      decBtn.addEventListener("click", () => {
        adjustReaderSetting(key, -readerLimits[key].step);
      });
      incBtn.addEventListener("click", () => {
        adjustReaderSetting(key, readerLimits[key].step);
      });
      rangeEl.addEventListener("input", () => {
        applyReaderSettingFromSlider(key, Number(rangeEl.value));
      });
    }
    bindAdjustRow("fontSize", btnReaderAdjustFontDec, btnReaderAdjustFontInc, rangeReaderAdjustFont);
    bindAdjustRow("lineHeight", btnReaderAdjustLineHeightDec, btnReaderAdjustLineHeightInc, rangeReaderAdjustLineHeight);
    bindAdjustRow("paragraphSpacing", btnReaderAdjustParaSpacingDec, btnReaderAdjustParaSpacingInc, rangeReaderAdjustParaSpacing);
    bindAdjustRow("pagePaddingX", btnReaderAdjustPagePaddingXDec, btnReaderAdjustPagePaddingXInc, rangeReaderAdjustPagePaddingX);
    bindAdjustRow("pagePaddingY", btnReaderAdjustPagePaddingYDec, btnReaderAdjustPagePaddingYInc, rangeReaderAdjustPagePaddingY);
    bindAdjustRow("pageMaxWidth", btnReaderAdjustPageMaxWidthDec, btnReaderAdjustPageMaxWidthInc, rangeReaderAdjustPageMaxWidth);
    btnReaderAdjustRemoveSingleEmpty.addEventListener("click", toggleRemoveSingleEmptyParagraph);
    btnReaderAdjustApply.addEventListener("click", () => {
      finalizeReaderAdjustRebuild();
      closeReaderAdjust(true);
    });
    btnNextChap.addEventListener("click", () => {
      if (!chapterNav.next) return;
      markFullscreenRestoreForNextChapterNavigation();
      window.location.href = chapterNav.next;
    });
    updateRemoveSingleEmptyParagraphUi();
    loadSavedReaderProfile();
    loadSavedPageIndex();
    loadFullscreenRestoreFlag();
    const savedWebFont = loadWebFontConfig();
    if (savedWebFont) {
      inputWebFontCssUrl.value = savedWebFont.cssUrl;
      inputWebFontFamily.value = savedWebFont.family;
    }
    setReaderSettingsExpanded(false);
    setProfileExpanded(false);
    updateProfileUi();
    syncFontSourceUi();
    updateReaderSettingsUi();
    updateResponsiveChrome();
    readerRoot.addEventListener("pointerdown", restoreFullscreenOnFirstTap, { capture: true });
    document.addEventListener("fullscreenchange", syncHeaderFullscreenUi);
    syncHeaderFullscreenUi();
    render();
    window.addEventListener("resize", render);
  }
  main();
})();
/*! Bundled license information:

lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/createElement.js:
lucide/dist/esm/icons/a-large-small.js:
lucide/dist/esm/icons/arrow-down-to-line.js:
lucide/dist/esm/icons/check.js:
lucide/dist/esm/icons/chevron-down.js:
lucide/dist/esm/icons/chevron-up.js:
lucide/dist/esm/icons/chevrons-left.js:
lucide/dist/esm/icons/chevrons-right.js:
lucide/dist/esm/icons/clipboard-paste.js:
lucide/dist/esm/icons/diff.js:
lucide/dist/esm/icons/expand.js:
lucide/dist/esm/icons/menu.js:
lucide/dist/esm/icons/minus.js:
lucide/dist/esm/icons/move-left.js:
lucide/dist/esm/icons/move-right.js:
lucide/dist/esm/icons/pen-line.js:
lucide/dist/esm/icons/plus.js:
lucide/dist/esm/icons/shrink.js:
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
