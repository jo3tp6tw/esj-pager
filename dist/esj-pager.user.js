// ==UserScript==
// @name         ESJ Zone 翻頁閱讀
// @namespace    https://github.com/jo3tp6tw/esj-pager
// @version      2.1
// @description  將 ESJ Zone 閱讀改為翻頁模式
// @author       jo3tp6tw
// @homepageURL  https://github.com/jo3tp6tw/esj-pager
// @supportURL   https://github.com/jo3tp6tw/esj-pager/issues
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
  var COMMENT_MAIN_MIN_SIZE = 18;
  var COMMENT_MAIN_LINE_PX = 30;
  var COMMENT_MAIN_PARA_SPACING = 10;
  var COMMENT_META_MIN_SIZE = 12;
  var COMMENT_META_SCALE = 0.7;
  var COMMENT_META_LINE_PX = 22;
  var COMMENT_META_PARA_SPACING = 6;
  var COMMENT_DIVIDER_MIN_SIZE = 13;
  var COMMENT_DIVIDER_SIZE_OFFSET = 4;
  function getBlockTextStyle(ctx, block, layout) {
    const baseFont = ctx.font;
    const baseSizeRaw = Number.parseFloat(baseFont);
    const baseSize = Number.isFinite(baseSizeRaw) ? baseSizeRaw : 20;
    const family = baseFont.replace(/^[\d.]+px\s*/, "") || "sans-serif";
    if (block.type === "commentMain") {
      return {
        font: `${Math.max(COMMENT_MAIN_MIN_SIZE, Math.round(baseSize))}px ${family}`,
        linePx: COMMENT_MAIN_LINE_PX,
        paraSpacing: COMMENT_MAIN_PARA_SPACING,
        fillStyle: "#111"
      };
    }
    if (block.type === "commentMeta") {
      const halfSize = Math.max(COMMENT_META_MIN_SIZE, Math.round(baseSize * COMMENT_META_SCALE));
      return {
        font: `${halfSize}px ${family}`,
        linePx: COMMENT_META_LINE_PX,
        paraSpacing: COMMENT_META_PARA_SPACING,
        fillStyle: "#999"
      };
    }
    if (block.type === "commentDivider") {
      return {
        font: `${Math.max(COMMENT_DIVIDER_MIN_SIZE, Math.round(baseSize - COMMENT_DIVIDER_SIZE_OFFSET))}px ${family}`,
        linePx: COMMENT_META_LINE_PX,
        paraSpacing: COMMENT_META_PARA_SPACING,
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
  var charWidthCache = /* @__PURE__ */ new Map();
  function measureCharWidth(ctx, ch) {
    const key = `${ctx.font}\0${ch}`;
    let w = charWidthCache.get(key);
    if (w === void 0) {
      w = ctx.measureText(ch).width;
      charWidthCache.set(key, w);
    }
    return w;
  }
  function clearCharWidthCache() {
    charWidthCache.clear();
  }
  var dividerCache = null;
  function buildDividerLine(ctx, maxWidth) {
    if (maxWidth <= 0) return "\u2500";
    if (dividerCache && dividerCache.font === ctx.font && dividerCache.maxWidth === maxWidth) {
      return dividerCache.line;
    }
    const unit = "\u2500";
    const unitWidth = ctx.measureText(unit).width;
    if (unitWidth <= 0) return unit;
    const count = Math.max(1, Math.floor(maxWidth / unitWidth));
    const line = unit.repeat(count);
    dividerCache = { font: ctx.font, maxWidth, line };
    return line;
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
      const chWidth = measureCharWidth(ctx, ch);
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
  var PREV_LINK_TEXTS = ["\u4E0A\u4E00\u7BC7", "\u4E0A\u4E00\u7AE0", "Previous", "Prev", "<<"];
  var NEXT_LINK_TEXTS = ["\u4E0B\u4E00\u7BC7", "\u4E0B\u4E00\u7AE0", "Next", ">>"];
  function isChapterHref(href) {
    try {
      const u = new URL(href, window.location.origin);
      return /^\/forum\/\d+\/\d+\.html$/i.test(u.pathname);
    } catch {
      return false;
    }
  }
  function pickValidHrefBySelectors(root, selectors) {
    for (const selector of selectors) {
      const a = root.querySelector(selector);
      if (!a?.href) continue;
      if (!isChapterHref(a.href)) continue;
      return a.href;
    }
    return "";
  }
  function pickValidHrefByText(root, candidates) {
    const links = [...root.querySelectorAll("a")];
    for (const text of candidates) {
      const match = links.find((a) => (a.textContent ?? "").includes(text) && isChapterHref(a.href));
      if (match) return match.href;
    }
    return "";
  }
  function getAdjacentChapterHrefs() {
    const navs = [...document.querySelectorAll(".entry-navigation")];
    const preferredNav = (navs.length > 0 ? navs[navs.length - 1] : null) ?? navs[0] ?? document;
    const prev = pickValidHrefBySelectors(preferredNav, [
      ".column.text-left a",
      "a.btn-prev",
      'a[rel="prev"]'
    ]) || pickValidHrefByText(preferredNav, PREV_LINK_TEXTS) || pickValidHrefByText(document, PREV_LINK_TEXTS);
    const next = pickValidHrefBySelectors(preferredNav, [
      ".column.text-right a",
      "a.btn-next",
      'a[rel="next"]'
    ]) || pickValidHrefByText(preferredNav, NEXT_LINK_TEXTS) || pickValidHrefByText(document, NEXT_LINK_TEXTS);
    return { prev, next };
  }
  function getNovelId() {
    const m = window.location.pathname.match(/\/forum\/(\d+)\//);
    return m?.[1] ?? "";
  }
  function getNovelDetailHref() {
    const id = getNovelId();
    if (!id) return "";
    return `${window.location.origin}/detail/${id}`;
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
    const otherSettingsSection = document.createElement("section");
    otherSettingsSection.className = "esj-drawer-other-settings";
    otherSettingsSection.setAttribute("aria-label", "\u5176\u4ED6\u8A2D\u5B9A");
    const otherSettingsTitle = document.createElement("div");
    otherSettingsTitle.className = "esj-drawer-reader-settings-title";
    otherSettingsTitle.textContent = "\u5176\u4ED6\u8A2D\u5B9A";
    const fullscreenPromptRow = document.createElement("div");
    fullscreenPromptRow.className = "esj-setting-row esj-setting-checkbox-row";
    const fullscreenPromptLabel = document.createElement("div");
    fullscreenPromptLabel.className = "esj-setting-label";
    const fullscreenPromptLabelText = document.createElement("span");
    fullscreenPromptLabelText.textContent = "\u5168\u87A2\u5E55\u63D0\u793A";
    fullscreenPromptLabel.appendChild(fullscreenPromptLabelText);
    const btnFullscreenPromptToggle = document.createElement("button");
    btnFullscreenPromptToggle.type = "button";
    btnFullscreenPromptToggle.className = "esj-setting-btn esj-setting-checkbox-btn";
    btnFullscreenPromptToggle.setAttribute("aria-label", "\u5168\u87A2\u5E55\u63D0\u793A");
    btnFullscreenPromptToggle.setAttribute("aria-pressed", "true");
    const iconFullscreenPromptCheckEl = iconCheck(18);
    btnFullscreenPromptToggle.appendChild(iconFullscreenPromptCheckEl);
    const fullscreenPromptControls = document.createElement("div");
    fullscreenPromptControls.className = "esj-setting-controls";
    fullscreenPromptControls.appendChild(btnFullscreenPromptToggle);
    fullscreenPromptRow.appendChild(fullscreenPromptLabel);
    fullscreenPromptRow.appendChild(fullscreenPromptControls);
    otherSettingsSection.appendChild(otherSettingsTitle);
    const removeSingleEmptyRow = document.createElement("div");
    removeSingleEmptyRow.className = "esj-setting-row esj-setting-checkbox-row";
    const removeSingleEmptyLabel = document.createElement("div");
    removeSingleEmptyLabel.className = "esj-setting-label";
    const removeSingleEmptyLabelText = document.createElement("span");
    removeSingleEmptyLabelText.textContent = "\u53BB\u9664\u7A7A\u6BB5\u843D";
    removeSingleEmptyLabel.appendChild(removeSingleEmptyLabelText);
    const btnRemoveSingleEmptyToggle = document.createElement("button");
    btnRemoveSingleEmptyToggle.type = "button";
    btnRemoveSingleEmptyToggle.className = "esj-setting-btn esj-setting-checkbox-btn";
    btnRemoveSingleEmptyToggle.setAttribute("aria-label", "\u53BB\u9664\u7A7A\u6BB5\u843D");
    btnRemoveSingleEmptyToggle.setAttribute("aria-pressed", "false");
    const iconRemoveSingleEmptyCheckEl = iconCheck(18);
    iconRemoveSingleEmptyCheckEl.style.display = "none";
    btnRemoveSingleEmptyToggle.appendChild(iconRemoveSingleEmptyCheckEl);
    const removeSingleEmptyControls = document.createElement("div");
    removeSingleEmptyControls.className = "esj-setting-controls";
    removeSingleEmptyControls.appendChild(btnRemoveSingleEmptyToggle);
    removeSingleEmptyRow.appendChild(removeSingleEmptyLabel);
    removeSingleEmptyRow.appendChild(removeSingleEmptyControls);
    otherSettingsSection.appendChild(removeSingleEmptyRow);
    otherSettingsSection.appendChild(fullscreenPromptRow);
    readerSettingsSection.appendChild(otherSettingsSection);
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
    const readerAdjustActions = document.createElement("div");
    readerAdjustActions.className = "esj-reader-adjust-actions";
    const btnReaderAdjustCancel = document.createElement("button");
    btnReaderAdjustCancel.type = "button";
    btnReaderAdjustCancel.id = "esj-reader-adjust-cancel";
    btnReaderAdjustCancel.textContent = "\u53D6\u6D88";
    const btnReaderAdjustApply = document.createElement("button");
    btnReaderAdjustApply.type = "button";
    btnReaderAdjustApply.id = "esj-reader-adjust-apply";
    btnReaderAdjustApply.textContent = "\u78BA\u5B9A";
    readerAdjustActions.appendChild(btnReaderAdjustCancel);
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
    const fullscreenPromptOverlay = document.createElement("div");
    fullscreenPromptOverlay.id = "esj-fullscreen-prompt-overlay";
    fullscreenPromptOverlay.setAttribute("role", "dialog");
    fullscreenPromptOverlay.setAttribute("aria-modal", "true");
    fullscreenPromptOverlay.setAttribute("aria-hidden", "true");
    const fullscreenPromptBackdrop = document.createElement("div");
    fullscreenPromptBackdrop.className = "esj-fullscreen-prompt-backdrop";
    const fullscreenPromptPanel = document.createElement("div");
    fullscreenPromptPanel.className = "esj-fullscreen-prompt-panel";
    const fullscreenPromptTitle = document.createElement("div");
    fullscreenPromptTitle.className = "esj-fullscreen-prompt-title";
    fullscreenPromptTitle.textContent = "\u9032\u5165\u5168\u87A2\u5E55\u6A21\u5F0F\uFF1F";
    const fullscreenPromptMessage = document.createElement("div");
    fullscreenPromptMessage.className = "esj-fullscreen-prompt-message";
    fullscreenPromptMessage.textContent = "\u5168\u87A2\u5E55\u6A21\u5F0F\u53EF\u63D0\u4F9B\u66F4\u597D\u7684\u95B1\u8B80\u9AD4\u9A57";
    const fullscreenPromptActions = document.createElement("div");
    fullscreenPromptActions.className = "esj-fullscreen-prompt-actions";
    const btnFullscreenPromptCancel = document.createElement("button");
    btnFullscreenPromptCancel.type = "button";
    btnFullscreenPromptCancel.id = "esj-fullscreen-prompt-cancel";
    btnFullscreenPromptCancel.textContent = "\u53D6\u6D88";
    const btnFullscreenPromptConfirm = document.createElement("button");
    btnFullscreenPromptConfirm.type = "button";
    btnFullscreenPromptConfirm.id = "esj-fullscreen-prompt-confirm";
    btnFullscreenPromptConfirm.textContent = "\u78BA\u5B9A";
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
      btnFullscreenPromptConfirm
    };
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

    .esj-drawer-other-settings {
      border-top: 1px solid #ececec;
      margin-top: 4px;
      padding: 8px 4px 0;
    }

    .esj-setting-checkbox-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 2px;
      margin-top: 0;
    }

    .esj-setting-checkbox-btn {
      width: 24px;
      height: 24px;
      border: 1px solid #aaa;
      border-radius: 4px;
      background: #fff;
      color: #111;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .esj-setting-checkbox-btn[aria-pressed="true"] {
      background: #111;
      border-color: #111;
      color: #fff;
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
      gap: 10px;
      justify-content: flex-end;
      margin-top: 4px;
    }

    .esj-reader-adjust-actions button {
      padding: 8px 16px;
      font-size: 15px;
      border: 1px solid #aaa;
      border-radius: 6px;
      background: #fff;
      color: #111;
      cursor: pointer;
    }

    #esj-reader-adjust-apply {
      background: #111;
      color: #fff;
      border-color: #111;
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

    #esj-fullscreen-prompt-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
    }

    #esj-fullscreen-prompt-overlay[aria-hidden="false"] {
      display: flex;
    }

    .esj-fullscreen-prompt-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
    }

    .esj-fullscreen-prompt-panel {
      position: relative;
      z-index: 1;
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      max-width: 90%;
      width: 320px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .esj-fullscreen-prompt-title {
      font-size: 18px;
      font-weight: 600;
      color: #111;
      margin-bottom: 12px;
    }

    .esj-fullscreen-prompt-message {
      font-size: 14px;
      color: #666;
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .esj-fullscreen-prompt-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .esj-fullscreen-prompt-actions button {
      padding: 10px 20px;
      font-size: 15px;
      border: 1px solid #aaa;
      border-radius: 6px;
      background: #fff;
      color: #111;
      cursor: pointer;
    }

    #esj-fullscreen-prompt-confirm {
      background: #111;
      color: #fff;
      border-color: #111;
    }
  `;
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

  // src/readerState.ts
  var READER_LIMITS = {
    fontSize: { min: 14, max: 56, step: 1 },
    lineHeight: { min: 1, max: 3.2, step: 0.05 },
    paragraphSpacing: { min: 0, max: 72, step: 2 },
    pagePaddingX: { min: 0, max: 180, step: 2 },
    pagePaddingY: { min: 0, max: 180, step: 2 },
    pageMaxWidth: { min: 320, max: 2400, step: 20 }
  };
  function createReaderState(blocks) {
    return {
      pageStarts: [],
      pageIndex: 0,
      lastCanvasW: -1,
      lastCanvasH: -1,
      chromeVisible: true,
      activeChromePreset: null,
      activeChromeSettings: chromeSettingsTablet,
      swipeStartX: null,
      swipeStartY: null,
      suppressNextSideTap: false,
      removeSingleEmptyParagraph: false,
      showFullscreenPrompt: true,
      pagedBlocks: blocks,
      currentReaderSettings: { ...readerSettings },
      pendingRestoreCursor: null,
      lastSavedCursor: null,
      hasSavedProfile: false,
      readerSettingsExpanded: false,
      profileExpanded: false,
      savedProfile: null,
      imageCache: /* @__PURE__ */ new Map(),
      lastRenderedPageIndex: -1,
      adjustAnchorCursor: null,
      previewFromAdjust: false,
      snapshotBeforeAdjust: null,
      fontSource: "local",
      webFontLinkEl: null
    };
  }

  // src/utils.ts
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
  function safeNum(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  function clampSetting(key, raw) {
    if (raw === null) return null;
    const lim = READER_LIMITS[key];
    return clamp(roundByStep(raw, lim.step), lim.min, lim.max);
  }
  function applyEmptyParagraphFilter(source, removeSingleEmpty) {
    if (!removeSingleEmpty) return source;
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

  // src/storage.ts
  var READER_PROFILE_STORAGE_KEY = "esj-pager:reader-profile:v1";
  var READER_LAST_PAGE_STORAGE_KEY = "esj-pager:last-page:v3";
  var READER_LAST_PAGE_MAX_NOVELS = 10;
  var READER_WEB_FONT_STORAGE_KEY = "esj-pager:web-font:v1";
  var READER_FULLSCREEN_PROMPT_KEY = "esj-pager:fullscreen-prompt:v1";
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
  function loadLastPageEntries() {
    try {
      const raw = window.localStorage.getItem(READER_LAST_PAGE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function loadSavedCursor(novelId, chapterKey) {
    if (!novelId) return null;
    const entries = loadLastPageEntries();
    const entry = entries.find((e) => e.novelId === novelId);
    if (!entry) return null;
    if (entry.chapter !== chapterKey) return null;
    if (!entry.cursor || typeof entry.cursor.bi !== "number" || typeof entry.cursor.off !== "number") return null;
    return { bi: Math.max(0, Math.floor(entry.cursor.bi)), off: Math.max(0, Math.floor(entry.cursor.off)) };
  }
  function saveCurrentCursor(novelId, chapterKey, cursor) {
    if (!novelId) return;
    try {
      let entries = loadLastPageEntries();
      entries = entries.filter((e) => e.novelId !== novelId);
      entries.push({ novelId, chapter: chapterKey, cursor: { bi: cursor.bi, off: cursor.off }, ts: Date.now() });
      if (entries.length > READER_LAST_PAGE_MAX_NOVELS) {
        entries.sort((a, b) => a.ts - b.ts);
        entries = entries.slice(entries.length - READER_LAST_PAGE_MAX_NOVELS);
      }
      window.localStorage.setItem(READER_LAST_PAGE_STORAGE_KEY, JSON.stringify(entries));
    } catch {
    }
  }
  function saveReaderProfile(profile) {
    window.localStorage.setItem(READER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }
  function loadReaderProfileRaw() {
    try {
      const raw = window.localStorage.getItem(READER_PROFILE_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function saveFullscreenPromptSetting(enabled) {
    try {
      window.localStorage.setItem(READER_FULLSCREEN_PROMPT_KEY, enabled ? "1" : "0");
    } catch {
    }
  }
  function loadFullscreenPromptSetting() {
    try {
      const value = window.localStorage.getItem(READER_FULLSCREEN_PROMPT_KEY);
      if (value === null) return true;
      return value === "1";
    } catch {
      return true;
    }
  }
  function createProfileSaver(state, syncUi) {
    return () => {
      const payload = {
        fontFamily: state.currentReaderSettings.fontFamily,
        fontSize: state.currentReaderSettings.fontSize,
        lineHeight: state.currentReaderSettings.lineHeight,
        paragraphSpacing: state.currentReaderSettings.paragraphSpacing,
        pagePaddingX: state.currentReaderSettings.pagePaddingX,
        pagePaddingY: state.currentReaderSettings.pagePaddingY,
        pageMaxWidth: state.currentReaderSettings.pageMaxWidth,
        removeSingleEmptyParagraph: state.removeSingleEmptyParagraph
      };
      try {
        saveReaderProfile(payload);
        state.savedProfile = { ...payload };
        state.hasSavedProfile = true;
        syncUi();
      } catch {
        window.alert("\u5132\u5B58\u8A2D\u5B9A\u6A94\u5931\u6557");
      }
    };
  }
  function createProfileLoader(state, syncUi, blocks, render) {
    return () => {
      const p = loadReaderProfileRaw();
      if (!p) {
        state.savedProfile = null;
        state.hasSavedProfile = false;
        syncUi();
        return false;
      }
      let changed = false;
      const pFontFamily = typeof p.fontFamily === "string" && p.fontFamily.trim() ? p.fontFamily : null;
      if (pFontFamily && state.currentReaderSettings.fontFamily !== pFontFamily) {
        state.currentReaderSettings.fontFamily = pFontFamily;
        changed = true;
      }
      for (const key of Object.keys(READER_LIMITS)) {
        const next = clampSetting(key, safeNum(p[key]));
        if (next === null || state.currentReaderSettings[key] === next) continue;
        state.currentReaderSettings[key] = next;
        changed = true;
      }
      const pRemove = typeof p.removeSingleEmptyParagraph === "boolean" ? p.removeSingleEmptyParagraph : null;
      if (pRemove !== null && state.removeSingleEmptyParagraph !== pRemove) {
        state.removeSingleEmptyParagraph = pRemove;
        syncUi();
        state.pagedBlocks = applyEmptyParagraphFilter(blocks, state.removeSingleEmptyParagraph);
        changed = true;
      }
      state.savedProfile = {
        fontFamily: pFontFamily ?? state.currentReaderSettings.fontFamily,
        fontSize: clampSetting("fontSize", safeNum(p.fontSize)) ?? state.currentReaderSettings.fontSize,
        lineHeight: clampSetting("lineHeight", safeNum(p.lineHeight)) ?? state.currentReaderSettings.lineHeight,
        paragraphSpacing: clampSetting("paragraphSpacing", safeNum(p.paragraphSpacing)) ?? state.currentReaderSettings.paragraphSpacing,
        pagePaddingX: clampSetting("pagePaddingX", safeNum(p.pagePaddingX)) ?? state.currentReaderSettings.pagePaddingX,
        pagePaddingY: clampSetting("pagePaddingY", safeNum(p.pagePaddingY)) ?? state.currentReaderSettings.pagePaddingY,
        pageMaxWidth: clampSetting("pageMaxWidth", safeNum(p.pageMaxWidth)) ?? state.currentReaderSettings.pageMaxWidth,
        removeSingleEmptyParagraph: pRemove ?? state.removeSingleEmptyParagraph
      };
      state.hasSavedProfile = true;
      syncUi();
      return changed;
    };
  }
  function createPositionSaver(state, novelId, chapterKey) {
    return () => {
      if (state.pageStarts.length === 0) return;
      const currentCursor = state.pageStarts[state.pageIndex];
      if (!currentCursor) return;
      if (state.lastSavedCursor && state.lastSavedCursor.bi === currentCursor.bi && state.lastSavedCursor.off === currentCursor.off) {
        return;
      }
      saveCurrentCursor(novelId, chapterKey, currentCursor);
      state.lastSavedCursor = { ...currentCursor };
    };
  }

  // src/fonts.ts
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
  var fontDetectCanvas = document.createElement("canvas");
  var fontDetectCtx = fontDetectCanvas.getContext("2d");
  function isFontFamilyLikelyAvailable(family) {
    if (!fontDetectCtx) return false;
    const text = "abcdefghijklmnopqrstuvwxyz0123456789\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341";
    const baseFamilies = ["monospace", "serif", "sans-serif"];
    const baseWidths = baseFamilies.map((base) => {
      fontDetectCtx.font = `72px ${base}`;
      return fontDetectCtx.measureText(text).width;
    });
    fontDetectCtx.font = `72px "${family}", monospace`;
    const testWidth = fontDetectCtx.measureText(text).width;
    return !baseWidths.some((w) => Math.abs(testWidth - w) < 0.01);
  }
  function isAnyFontFamilyAvailable(families) {
    return families.some((family) => isFontFamilyLikelyAvailable(family));
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
  function ensureWebFontStylesheet(cssUrl, currentLinkEl) {
    if (currentLinkEl && currentLinkEl.href === cssUrl) return currentLinkEl;
    if (currentLinkEl) currentLinkEl.remove();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    document.head.appendChild(link);
    return link;
  }
  async function loadWebFont(cssUrl, family) {
    const familyExpr = family.includes(",") ? family : `"${family}"`;
    await Promise.race([
      document.fonts.load(`16px ${familyExpr}`),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  }

  // src/eventHandlers.ts
  function createEventHandlers(ctx) {
    const { state, refs, chapterNav } = ctx;
    const { canvasWrap, drawerOverlay, pageJumpOverlay, readerAdjustOverlay } = refs;
    function handleSideTap() {
      if (state.suppressNextSideTap) {
        state.suppressNextSideTap = false;
        return;
      }
      if (state.pageIndex >= state.pageStarts.length - 1) {
        ctx.confirmGoNextChapter();
      } else {
        ctx.goNextPage();
      }
    }
    function handleSwipePointerDown(e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      state.swipeStartX = e.clientX;
      state.swipeStartY = e.clientY;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    function resetSwipeTracking() {
      state.swipeStartX = null;
      state.swipeStartY = null;
    }
    function handleSwipePointerUp(e) {
      if (state.swipeStartX === null || state.swipeStartY === null) return;
      const dx = e.clientX - state.swipeStartX;
      const dy = e.clientY - state.swipeStartY;
      resetSwipeTracking();
      const swipeThresholdPx = 36;
      if (Math.abs(dx) < swipeThresholdPx) return;
      if (Math.abs(dx) <= Math.abs(dy)) return;
      state.suppressNextSideTap = true;
      if (dx < 0) {
        if (state.pageIndex >= state.pageStarts.length - 1) {
          ctx.confirmGoNextChapter();
        } else {
          ctx.goNextPage();
        }
        return;
      }
      if (state.pageIndex <= 0) {
        ctx.confirmGoPrevChapter();
      } else {
        ctx.goPrevPage();
      }
    }
    function handleCanvasTapWheel(e) {
      const maxScrollTop = canvasWrap.scrollHeight - canvasWrap.clientHeight;
      if (maxScrollTop <= 0) return;
      const nextScrollTop = Math.max(
        0,
        Math.min(maxScrollTop, canvasWrap.scrollTop + e.deltaY)
      );
      if (nextScrollTop === canvasWrap.scrollTop) return;
      e.preventDefault();
      canvasWrap.scrollTop = nextScrollTop;
    }
    function handleRightClickPrevPage(e) {
      e.preventDefault();
      if (state.pageIndex <= 0) {
        ctx.confirmGoPrevChapter();
        return;
      }
      ctx.goPrevPage();
    }
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
          ctx.closeDrawer();
          return;
        }
        if (pageJumpOverlay.classList.contains("open")) {
          ctx.closePageJump();
          return;
        }
        if (readerAdjustOverlay.classList.contains("open")) {
          ctx.closeReaderAdjust(false, false);
          ctx.openDrawer();
          return;
        }
        if (!state.chromeVisible) {
          ctx.toggleChrome();
        }
        return;
      }
      if (!shouldInterceptReaderHotkey(e)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (state.pageIndex <= 0) {
          ctx.confirmGoPrevChapter();
        } else {
          ctx.goPrevPage();
        }
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (state.pageIndex >= state.pageStarts.length - 1) {
          ctx.confirmGoNextChapter();
        } else {
          ctx.goNextPage();
        }
        return;
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {
          });
        } else {
          void refs.readerRoot.requestFullscreen().catch(() => {
          });
        }
      }
    };
    function bindAll(signal) {
      const {
        btnTapPrevPage,
        btnTapChrome,
        btnTapNextPage
      } = refs;
      window.addEventListener("keydown", handleReaderHotkeys, {
        capture: true,
        signal
      });
      window.addEventListener(
        "keyup",
        (e) => {
          if (!shouldInterceptReaderHotkey(e)) return;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        },
        { capture: true, signal }
      );
      btnTapPrevPage.addEventListener("click", handleSideTap, { signal });
      btnTapPrevPage.addEventListener("pointerdown", handleSwipePointerDown, {
        signal
      });
      btnTapPrevPage.addEventListener("pointerup", handleSwipePointerUp, {
        signal
      });
      btnTapPrevPage.addEventListener("pointercancel", resetSwipeTracking, {
        signal
      });
      btnTapPrevPage.addEventListener("wheel", handleCanvasTapWheel, {
        passive: false,
        signal
      });
      btnTapPrevPage.addEventListener("contextmenu", handleRightClickPrevPage, {
        signal
      });
      btnTapChrome.addEventListener("click", ctx.toggleChrome, { signal });
      btnTapChrome.addEventListener("pointerdown", handleSwipePointerDown, {
        signal
      });
      btnTapChrome.addEventListener("pointerup", handleSwipePointerUp, { signal });
      btnTapChrome.addEventListener("pointercancel", resetSwipeTracking, {
        signal
      });
      btnTapChrome.addEventListener("wheel", handleCanvasTapWheel, {
        passive: false,
        signal
      });
      btnTapChrome.addEventListener("contextmenu", handleRightClickPrevPage, {
        signal
      });
      btnTapNextPage.addEventListener("click", handleSideTap, { signal });
      btnTapNextPage.addEventListener("pointerdown", handleSwipePointerDown, {
        signal
      });
      btnTapNextPage.addEventListener("pointerup", handleSwipePointerUp, {
        signal
      });
      btnTapNextPage.addEventListener("pointercancel", resetSwipeTracking, {
        signal
      });
      btnTapNextPage.addEventListener("wheel", handleCanvasTapWheel, {
        passive: false,
        signal
      });
      btnTapNextPage.addEventListener("contextmenu", handleRightClickPrevPage, {
        signal
      });
    }
    return {
      handleSideTap,
      handleSwipe: {
        down: handleSwipePointerDown,
        up: handleSwipePointerUp,
        reset: resetSwipeTracking
      },
      handleWheel: handleCanvasTapWheel,
      handleContextMenu: handleRightClickPrevPage,
      handleKeyboard: handleReaderHotkeys,
      bindAll
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
    const metaFontSize = 13;
    const metaY = Math.max(metaFontSize, height - Math.max(settings.pagePaddingY / 2, metaFontSize));
    const metaGap = 12;
    ctx.textBaseline = "middle";
    ctx.font = `${metaFontSize}px ${settings.fontFamily}`;
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

  // src/reader/render.ts
  function createRenderer(ctx) {
    const { state: s, refs, blocks, render: _render, chapterNav } = ctx;
    const { canvasWrap, canvas } = refs;
    return function render() {
      ctx.updateResponsiveChrome();
      const dpr = window.devicePixelRatio || 1;
      const width = canvasWrap.clientWidth;
      const viewportHeight = canvasWrap.clientHeight;
      if (width === 0 || viewportHeight === 0) return;
      const canvasCtx = canvas.getContext("2d");
      if (!canvasCtx) return;
      const maxHeight = Math.max(0, viewportHeight - s.currentReaderSettings.pagePaddingY * 2);
      const availableTextWidth = Math.max(0, width - s.currentReaderSettings.pagePaddingX * 2);
      const textWidth = Math.min(availableTextWidth, s.currentReaderSettings.pageMaxWidth);
      const textLeft = Math.max(0, Math.floor((width - textWidth) / 2));
      const linePx = s.currentReaderSettings.fontSize * s.currentReaderSettings.lineHeight;
      const layout = {
        padX: s.currentReaderSettings.pagePaddingX,
        padY: s.currentReaderSettings.pagePaddingY,
        textLeft,
        textWidth,
        maxWidth: textWidth,
        maxHeight,
        linePx,
        paraSpacing: s.currentReaderSettings.paragraphSpacing
      };
      const useAdjustPreview = s.previewFromAdjust && s.adjustAnchorCursor !== null;
      const sameSize = !useAdjustPreview && s.pageStarts.length > 0 && width === s.lastCanvasW && viewportHeight === s.lastCanvasH;
      if (!sameSize) {
        if (!useAdjustPreview) {
          s.pageStarts = buildPageStarts(canvasCtx, s.pagedBlocks, layout, {
            imagePlaceholderText: "\u3010\u5716\u3011",
            getImageRenderInfo: ctx.getImageRenderInfo
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
      if (startBlock?.type === "img") {
        const info = ctx.getImageRenderInfo(startBlock.src, layout.maxWidth);
        if (info.ready && info.drawHeight > layout.maxHeight) {
          drawHeight = s.currentReaderSettings.pagePaddingY * 2 + info.drawHeight;
        }
      }
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(drawHeight * dpr);
      canvas.style.height = `${drawHeight}px`;
      canvasWrap.style.overflowY = drawHeight > viewportHeight ? "auto" : "hidden";
      if (s.pageIndex !== s.lastRenderedPageIndex) {
        canvasWrap.scrollTop = 0;
        s.lastRenderedPageIndex = s.pageIndex;
      }
      canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvasCtx.clearRect(0, 0, width, drawHeight);
      canvasCtx.fillStyle = "#111";
      canvasCtx.textBaseline = "top";
      canvasCtx.font = `${s.currentReaderSettings.fontSize}px ${s.currentReaderSettings.fontFamily}`;
      walkOnePage(canvasCtx, s.pagedBlocks, startCursor, layout, true, {
        imagePlaceholderText: "\u3010\u5716\u3011",
        getImageRenderInfo: ctx.getImageRenderInfo,
        drawImage: (src, x, y, w, h) => {
          const entry = ctx.ensureImage(src);
          if (entry.status !== "loaded") {
            canvasCtx.fillText("\u3010\u5716\u3011", x, y);
            return;
          }
          canvasCtx.drawImage(entry.img, x, y, w, h);
        }
      });
      drawBottomMetadata(
        canvasCtx,
        drawHeight,
        refs.readerRoot.querySelector(".esj-header-title")?.textContent || "",
        `${s.pageIndex + 1} / ${s.pageStarts.length}`,
        s.currentReaderSettings,
        textLeft,
        textWidth
      );
    };
  }

  // src/reader/uiSync.ts
  function syncFontSourceUi(ctx) {
    const { state: s, refs } = ctx;
    const { selectFontSource, selectLocalFont, fontLocalRow, fontWebControls } = refs;
    selectFontSource.value = s.fontSource;
    selectLocalFont.disabled = s.fontSource !== "local";
    fontLocalRow.classList.toggle("hidden", s.fontSource !== "local");
    fontWebControls.classList.toggle("open", s.fontSource === "web");
  }
  function syncLocalFontSelectUi(ctx) {
    const { state: s, refs } = ctx;
    const { selectLocalFont } = refs;
    const match = LOCAL_FONT_OPTIONS.find((opt) => opt.value === s.currentReaderSettings.fontFamily);
    if (match) {
      selectLocalFont.value = match.value;
      return;
    }
    selectLocalFont.value = "";
  }
  function syncReaderAdjustUi(ctx) {
    const { state: s, refs } = ctx;
    function syncOne(key, valueEl, rangeEl, decBtn, incBtn) {
      const limits = READER_LIMITS[key];
      const value = s.currentReaderSettings[key];
      valueEl.textContent = key === "lineHeight" ? formatLineHeight(value) : String(value);
      rangeEl.min = String(limits.min);
      rangeEl.max = String(limits.max);
      rangeEl.step = String(limits.step);
      rangeEl.value = String(value);
      decBtn.disabled = value <= limits.min;
      incBtn.disabled = value >= limits.max;
    }
    syncOne(
      "fontSize",
      refs.readerAdjustFontValue,
      refs.rangeReaderAdjustFont,
      refs.btnReaderAdjustFontDec,
      refs.btnReaderAdjustFontInc
    );
    syncOne(
      "lineHeight",
      refs.readerAdjustLineHeightValue,
      refs.rangeReaderAdjustLineHeight,
      refs.btnReaderAdjustLineHeightDec,
      refs.btnReaderAdjustLineHeightInc
    );
    syncOne(
      "paragraphSpacing",
      refs.readerAdjustParaSpacingValue,
      refs.rangeReaderAdjustParaSpacing,
      refs.btnReaderAdjustParaSpacingDec,
      refs.btnReaderAdjustParaSpacingInc
    );
    syncOne(
      "pagePaddingX",
      refs.readerAdjustPagePaddingXValue,
      refs.rangeReaderAdjustPagePaddingX,
      refs.btnReaderAdjustPagePaddingXDec,
      refs.btnReaderAdjustPagePaddingXInc
    );
    syncOne(
      "pagePaddingY",
      refs.readerAdjustPagePaddingYValue,
      refs.rangeReaderAdjustPagePaddingY,
      refs.btnReaderAdjustPagePaddingYDec,
      refs.btnReaderAdjustPagePaddingYInc
    );
    syncOne(
      "pageMaxWidth",
      refs.readerAdjustPageMaxWidthValue,
      refs.rangeReaderAdjustPageMaxWidth,
      refs.btnReaderAdjustPageMaxWidthDec,
      refs.btnReaderAdjustPageMaxWidthInc
    );
  }
  function updateReaderSettingsUi(ctx) {
    const { state: s, refs } = ctx;
    refs.readerSettingFontValue.textContent = `${s.currentReaderSettings.fontSize}`;
    refs.readerSettingLineHeightValue.textContent = formatLineHeight(s.currentReaderSettings.lineHeight);
    refs.readerSettingParaSpacingValue.textContent = `${s.currentReaderSettings.paragraphSpacing}`;
    refs.readerSettingPagePaddingXValue.textContent = `${s.currentReaderSettings.pagePaddingX}`;
    refs.readerSettingPagePaddingYValue.textContent = `${s.currentReaderSettings.pagePaddingY}`;
    refs.readerSettingPageMaxWidthValue.textContent = `${s.currentReaderSettings.pageMaxWidth}`;
    syncLocalFontSelectUi(ctx);
    syncReaderAdjustUi(ctx);
    refs.btnProfileRestore.disabled = !s.hasSavedProfile;
  }
  function updateProfileUi(ctx) {
    const { state: s, refs } = ctx;
    if (!s.savedProfile) {
      refs.profileFontValue.textContent = "-";
      refs.profileLineHeightValue.textContent = "-";
      refs.profileParaSpacingValue.textContent = "-";
      refs.profilePagePaddingXValue.textContent = "-";
      refs.profilePagePaddingYValue.textContent = "-";
      refs.profilePageMaxWidthValue.textContent = "-";
      refs.profileRemoveSingleEmptyValue.textContent = "-";
      return;
    }
    refs.profileFontValue.textContent = String(s.savedProfile.fontSize);
    refs.profileLineHeightValue.textContent = formatLineHeight(s.savedProfile.lineHeight);
    refs.profileParaSpacingValue.textContent = String(s.savedProfile.paragraphSpacing);
    refs.profilePagePaddingXValue.textContent = String(s.savedProfile.pagePaddingX);
    refs.profilePagePaddingYValue.textContent = String(s.savedProfile.pagePaddingY);
    refs.profilePageMaxWidthValue.textContent = String(s.savedProfile.pageMaxWidth);
    refs.profileRemoveSingleEmptyValue.textContent = s.savedProfile.removeSingleEmptyParagraph ? "ON" : "OFF";
  }
  function updateRemoveSingleEmptyParagraphUi(ctx) {
    const { state: s, refs } = ctx;
    refs.btnRemoveSingleEmptyToggle.setAttribute("aria-pressed", s.removeSingleEmptyParagraph ? "true" : "false");
    refs.iconRemoveSingleEmptyCheckEl.style.display = s.removeSingleEmptyParagraph ? "" : "none";
  }
  function updateFullscreenPromptUi(ctx) {
    const { state: s, refs } = ctx;
    refs.btnFullscreenPromptToggle.setAttribute("aria-pressed", s.showFullscreenPrompt ? "true" : "false");
    refs.iconFullscreenPromptCheckEl.style.display = s.showFullscreenPrompt ? "" : "none";
  }
  function syncHeaderFullscreenUi(ctx) {
    const { refs } = ctx;
    const isFullscreen = Boolean(document.fullscreenElement);
    refs.btnHeaderFullscreen.setAttribute("aria-pressed", isFullscreen ? "true" : "false");
    refs.btnHeaderFullscreen.setAttribute("aria-label", isFullscreen ? "\u96E2\u958B\u5168\u87A2\u5E55" : "\u9032\u5165\u5168\u87A2\u5E55");
    refs.iconHeaderFullscreenExpand.style.display = isFullscreen ? "none" : "";
    refs.iconHeaderFullscreenShrink.style.display = isFullscreen ? "" : "none";
  }
  function updatePageChrome(ctx) {
    const { state: s, refs, chapterNav } = ctx;
    const total = s.pageStarts.length;
    if (total === 0) {
      refs.footerPageCur.textContent = "0";
      refs.footerPageTotal.textContent = "0";
      refs.btnFooterPageJump.disabled = true;
      refs.pageJumpTotalEl.textContent = "0";
      refs.pageJumpInput.removeAttribute("max");
      refs.btnPrevPage.disabled = true;
      refs.btnNextPage.disabled = true;
      return;
    }
    refs.footerPageCur.textContent = String(s.pageIndex + 1);
    refs.footerPageTotal.textContent = String(total);
    refs.btnFooterPageJump.disabled = false;
    refs.pageJumpTotalEl.textContent = String(total);
    refs.pageJumpInput.max = String(total);
    refs.pageJumpInput.min = "1";
    refs.btnPrevPage.disabled = s.pageIndex <= 0;
    refs.btnNextPage.disabled = s.pageIndex >= total - 1;
  }

  // src/reader/chromeManager.ts
  function setIconSize(el, size) {
    if (!el) return;
    el.setAttribute("width", String(size));
    el.setAttribute("height", String(size));
  }
  function applyChromeSettings(ctx, settings) {
    ctx.state.activeChromeSettings = settings;
    const { refs } = ctx;
    const { readerRoot } = refs;
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
    setIconSize(refs.iconHeaderMenu, settings.iconMenuSize);
    setIconSize(refs.iconHeaderFullscreenExpand, settings.iconMenuSize);
    setIconSize(refs.iconHeaderFullscreenShrink, settings.iconMenuSize);
    setIconSize(refs.iconTocEl, settings.iconTableOfContentsSize);
    setIconSize(refs.iconPrevChapEl, settings.iconChapterSize);
    setIconSize(refs.iconNextChapEl, settings.iconChapterSize);
    setIconSize(refs.iconPrevPageEl, settings.iconPageSize);
    setIconSize(refs.iconNextPageEl, settings.iconPageSize);
    setIconSize(refs.iconFooterPageJumpEl, settings.iconPageSize);
  }
  function applyChromeVisibility(ctx) {
    ctx.refs.readerRoot.classList.toggle("esj-chrome-hidden", !ctx.state.chromeVisible);
  }
  function updateResponsiveChrome(ctx) {
    const preset = getChromePreset(window.innerWidth);
    if (preset === ctx.state.activeChromePreset) return;
    ctx.state.activeChromePreset = preset;
    applyChromeSettings(ctx, getChromeSettingsForPreset(preset));
    syncCanvasTapLayerLayout(ctx);
  }
  function toggleChrome(ctx) {
    ctx.state.chromeVisible = !ctx.state.chromeVisible;
    applyChromeVisibility(ctx);
    syncCanvasTapLayerLayout(ctx);
  }
  function syncCanvasTapLayerLayout(ctx) {
    const { refs, state, chapterNav } = ctx;
    const { canvasWrap, footerPageCell, btnTapPrevPage, btnTapChrome, btnTapNextPage } = refs;
    const wrapRect = canvasWrap.getBoundingClientRect();
    const w = wrapRect.width;
    if (w <= 0) return;
    const topPx = state.chromeVisible ? state.activeChromeSettings.headerHeight : 0;
    const bottomPx = state.chromeVisible ? state.activeChromeSettings.footerHeight : 0;
    let leftW, midLeft, midW, rightStart, rightW;
    if (state.chromeVisible) {
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
    const total = state.pageStarts.length;
    btnTapPrevPage.disabled = !(total > 0 && (state.pageIndex > 0 || Boolean(chapterNav.prev)));
    btnTapNextPage.disabled = !(total > 0 && (state.pageIndex < total - 1 || Boolean(chapterNav.next)));
  }

  // src/reader/panelManager.ts
  function openDrawer(ctx) {
    const { refs } = ctx;
    refs.drawerOverlay.classList.add("open");
    refs.drawerOverlay.setAttribute("aria-hidden", "false");
    refs.btnHeaderMenu.setAttribute("aria-expanded", "true");
  }
  function closeDrawer(ctx) {
    const { refs } = ctx;
    refs.drawerOverlay.classList.remove("open");
    refs.drawerOverlay.setAttribute("aria-hidden", "true");
    refs.btnHeaderMenu.setAttribute("aria-expanded", "false");
  }
  function openReaderAdjust(ctx) {
    const { state: s, refs } = ctx;
    closeDrawer(ctx);
    if (s.chromeVisible) {
      s.chromeVisible = false;
      applyChromeVisibility(ctx);
      syncCanvasTapLayerLayout(ctx);
    }
    s.snapshotBeforeAdjust = { ...s.currentReaderSettings };
    s.adjustAnchorCursor = s.pageStarts[s.pageIndex] ? { ...s.pageStarts[s.pageIndex] } : { bi: 0, off: 0 };
    s.previewFromAdjust = true;
    ctx.syncUi();
    refs.readerAdjustOverlay.classList.add("open");
    refs.readerAdjustOverlay.setAttribute("aria-hidden", "false");
  }
  function closeReaderAdjust(ctx, apply, hideDrawerAndChrome) {
    const { refs } = ctx;
    if (ctx.state.previewFromAdjust) {
      if (apply) {
        finalizeReaderAdjustRebuild(ctx);
      } else {
        cancelReaderAdjust(ctx);
      }
    }
    refs.readerAdjustOverlay.classList.remove("open");
    refs.readerAdjustOverlay.setAttribute("aria-hidden", "true");
    if (hideDrawerAndChrome) {
      if (ctx.state.chromeVisible) {
        ctx.state.chromeVisible = false;
        applyChromeVisibility(ctx);
        syncCanvasTapLayerLayout(ctx);
      }
      closeDrawer(ctx);
    } else {
      if (!ctx.state.chromeVisible) {
        ctx.state.chromeVisible = true;
        applyChromeVisibility(ctx);
        syncCanvasTapLayerLayout(ctx);
      }
      openDrawer(ctx);
    }
  }
  function cancelReaderAdjust(ctx) {
    const { state: s } = ctx;
    if (s.snapshotBeforeAdjust) {
      s.currentReaderSettings = { ...s.snapshotBeforeAdjust };
      s.snapshotBeforeAdjust = null;
    }
    s.previewFromAdjust = false;
    s.adjustAnchorCursor = null;
    ctx.syncUi();
    clearCharWidthCache();
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
    ctx.render();
  }
  function finalizeReaderAdjustRebuild(ctx) {
    const { state: s } = ctx;
    const anchor = s.adjustAnchorCursor;
    s.previewFromAdjust = false;
    s.adjustAnchorCursor = null;
    if (!anchor) return;
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
    ctx.render();
    if (s.pageStarts.length > 0) {
      s.pageIndex = findPageIndexByCursor(s.pageStarts, anchor);
      ctx.render();
    }
  }
  function openPageJump(ctx) {
    const { state: s, refs } = ctx;
    const total = s.pageStarts.length;
    if (total === 0) return;
    refs.pageJumpInput.value = String(s.pageIndex + 1);
    refs.pageJumpTotalEl.textContent = String(total);
    refs.pageJumpInput.min = "1";
    refs.pageJumpInput.max = String(total);
    refs.pageJumpOverlay.classList.add("open");
    refs.pageJumpOverlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      refs.pageJumpInput.focus();
      refs.pageJumpInput.select();
    });
  }
  function closePageJump(ctx) {
    const { refs } = ctx;
    refs.pageJumpOverlay.classList.remove("open");
    refs.pageJumpOverlay.setAttribute("aria-hidden", "true");
    refs.pageJumpInput.blur();
  }
  function submitPageJump(ctx) {
    const { state: s, refs, render } = ctx;
    const total = s.pageStarts.length;
    if (total === 0) return;
    const raw = parseInt(String(refs.pageJumpInput.value), 10);
    if (Number.isNaN(raw)) {
      closePageJump(ctx);
      return;
    }
    s.pageIndex = Math.max(1, Math.min(total, raw)) - 1;
    closePageJump(ctx);
    render();
  }
  function openFullscreenPrompt(ctx) {
    const { refs } = ctx;
    refs.fullscreenPromptOverlay.classList.add("open");
    refs.fullscreenPromptOverlay.setAttribute("aria-hidden", "false");
  }
  function closeFullscreenPrompt(ctx) {
    const { refs } = ctx;
    refs.fullscreenPromptOverlay.classList.remove("open");
    refs.fullscreenPromptOverlay.setAttribute("aria-hidden", "true");
  }
  function confirmFullscreen(ctx) {
    const { state: s, refs } = ctx;
    closeFullscreenPrompt(ctx);
    if (s.chromeVisible) {
      s.chromeVisible = false;
      applyChromeVisibility(ctx);
      syncCanvasTapLayerLayout(ctx);
    }
    closeDrawer(ctx);
    void refs.readerRoot.requestFullscreen().catch(() => {
    });
  }
  function setReaderSettingsExpanded(ctx, expanded) {
    const { state: s, refs } = ctx;
    s.readerSettingsExpanded = expanded;
    refs.btnReaderSettingsDropdown.setAttribute("aria-expanded", expanded ? "true" : "false");
    refs.readerSettingsContent.classList.toggle("open", expanded);
    refs.iconReaderSettingsChevronDownEl.style.display = expanded ? "none" : "";
    refs.iconReaderSettingsChevronUpEl.style.display = expanded ? "" : "none";
  }
  function setProfileExpanded(ctx, expanded) {
    const { state: s, refs } = ctx;
    s.profileExpanded = expanded;
    refs.btnProfileDropdown.setAttribute("aria-expanded", expanded ? "true" : "false");
    refs.profileContent.classList.toggle("open", expanded);
    refs.iconProfileChevronDownEl.style.display = expanded ? "none" : "";
    refs.iconProfileChevronUpEl.style.display = expanded ? "" : "none";
  }

  // src/reader/pageNavigation.ts
  function goPrevPage(ctx) {
    const { state: s, render } = ctx;
    if (s.pageIndex > 0) {
      s.pageIndex -= 1;
      render();
    }
  }
  function goNextPage(ctx) {
    const { state: s, render } = ctx;
    if (s.pageIndex < s.pageStarts.length - 1) {
      s.pageIndex += 1;
      render();
    }
  }
  function confirmGoPrevChapter(ctx) {
    const { chapterNav } = ctx;
    if (!chapterNav.prev) return;
    if (window.confirm("\u5DF2\u5728\u7B2C\u4E00\u9801\uFF0C\u662F\u5426\u524D\u5F80\u4E0A\u4E00\u7AE0\uFF1F")) {
      window.location.href = chapterNav.prev;
    }
  }
  function confirmGoNextChapter(ctx) {
    const { chapterNav } = ctx;
    if (!chapterNav.next) return;
    if (window.confirm("\u5DF2\u5728\u6700\u5F8C\u4E00\u9801\uFF0C\u662F\u5426\u524D\u5F80\u4E0B\u4E00\u7AE0\uFF1F")) {
      window.location.href = chapterNav.next;
    }
  }

  // src/reader/settingsManager.ts
  function adjustReaderSetting(ctx, key, delta) {
    const { state: s, render } = ctx;
    const limits = READER_LIMITS[key];
    const next = clamp(roundByStep(s.currentReaderSettings[key] + delta, limits.step), limits.min, limits.max);
    if (next === s.currentReaderSettings[key]) return;
    s.currentReaderSettings[key] = next;
    ctx.syncUi();
    if (!s.previewFromAdjust) {
      s.lastCanvasW = -1;
      s.lastCanvasH = -1;
    }
    render();
  }
  function toggleRemoveSingleEmptyParagraph(ctx) {
    const { state: s, blocks, render } = ctx;
    s.removeSingleEmptyParagraph = !s.removeSingleEmptyParagraph;
    ctx.syncUi();
    s.pagedBlocks = applyEmptyParagraphFilter(blocks, s.removeSingleEmptyParagraph);
    if (!s.previewFromAdjust) {
      s.pageIndex = 0;
      s.lastCanvasW = -1;
      s.lastCanvasH = -1;
    }
    render();
  }
  async function applyWebFont(ctx, cssUrl, family) {
    const { state: s, render } = ctx;
    s.webFontLinkEl = ensureWebFontStylesheet(cssUrl, s.webFontLinkEl);
    await loadWebFont(cssUrl, family);
    s.currentReaderSettings.fontFamily = family;
    s.fontSource = "web";
    ctx.syncUi();
    clearCharWidthCache();
    s.lastCanvasW = -1;
    s.lastCanvasH = -1;
    render();
    saveWebFontConfig({ cssUrl, family });
  }

  // src/imageCache.ts
  function ensureImage(ctx, src) {
    const { state: s, render } = ctx;
    const cached = s.imageCache.get(src);
    if (cached) return cached;
    const img = new Image();
    const entry = { img, status: "loading", naturalWidth: 0, naturalHeight: 0 };
    img.onload = () => {
      entry.status = "loaded";
      entry.naturalWidth = img.naturalWidth || 0;
      entry.naturalHeight = img.naturalHeight || 0;
      s.lastCanvasW = -1;
      s.lastCanvasH = -1;
      render();
    };
    img.onerror = () => {
      entry.status = "error";
      s.lastCanvasW = -1;
      s.lastCanvasH = -1;
      render();
    };
    img.src = src;
    s.imageCache.set(src, entry);
    return entry;
  }
  function getImageRenderInfo(ctx, src, maxWidth) {
    const entry = ensureImage(ctx, src);
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

  // src/main.ts
  function main() {
    const root = getForumContent();
    if (!root) return;
    const title = getChapterTitle();
    const blocks = extractBlocksFromHtml(root.innerHTML);
    const commentsRoot = getCommentsRoot();
    const commentBlocks = commentsRoot ? extractCommentBlocksFromHtml(commentsRoot.innerHTML) : [];
    const allBlocks = [...blocks, ...commentBlocks];
    mountReader(title, allBlocks, getAdjacentChapterHrefs(), getNovelDetailHref());
    console.info("[esj-pager]", title, "blocks:", allBlocks.length);
  }
  function mountReader(title, blocks, chapterNav, novelDetailHref) {
    const refs = createReaderDom(title, novelDetailHref, chapterNav);
    refs.style.textContent = buildReaderStyles();
    document.head.appendChild(refs.style);
    document.body.appendChild(refs.readerRoot);
    const rootEl = document.documentElement;
    const bodyEl = document.body;
    const prevRootOverflow = rootEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    rootEl.style.overflow = "hidden";
    bodyEl.style.overflow = "hidden";
    const eventAc = new AbortController();
    window.addEventListener("pagehide", () => {
      eventAc.abort();
      rootEl.style.overflow = prevRootOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
    }, { once: true });
    const s = createReaderState(blocks);
    const novelId = getNovelId();
    const chapterKey = `${window.location.pathname}${window.location.search}`;
    ["\u672C\u6A5F\u5B57\u9AD4", "Web Font"].forEach((text, i) => {
      const option = document.createElement("option");
      option.value = i === 0 ? "local" : "web";
      option.textContent = text;
      refs.selectFontSource.appendChild(option);
    });
    LOCAL_FONT_OPTIONS.forEach((option) => {
      if (option.detectFamilies && !isAnyFontFamilyAvailable(option.detectFamilies)) return;
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      refs.selectLocalFont.appendChild(el);
    });
    const baseContext = { state: s, refs, blocks, chapterNav, novelId, chapterKey, render: () => {
    } };
    const renderContext = { ...baseContext, getImageRenderInfo: (src, maxWidth) => getImageRenderInfo(baseContext, src, maxWidth), ensureImage: (src) => ensureImage(baseContext, src), saveCurrentPosition: () => {
    }, updatePageChrome: () => updatePageChrome(baseContext), syncCanvasTapLayerLayout: () => syncCanvasTapLayerLayout(baseContext), updateResponsiveChrome: () => updateResponsiveChrome(baseContext) };
    const render = createRenderer(renderContext);
    baseContext.render = render;
    renderContext.render = render;
    renderContext.saveCurrentPosition = createPositionSaver(s, novelId, chapterKey);
    const syncUi = () => [syncFontSourceUi, updateReaderSettingsUi, updateProfileUi].forEach((fn) => fn(baseContext));
    const saveReaderProfile2 = createProfileSaver(s, syncUi);
    const loadSavedReaderProfile = createProfileLoader(s, syncUi, blocks, render);
    const panelContext = { ...baseContext, syncUi, applyChromeVisibility: () => applyChromeVisibility(baseContext), syncCanvasTapLayerLayout: () => syncCanvasTapLayerLayout(baseContext) };
    const settingsContext = { ...baseContext, syncUi };
    const eventHandlerContext = { ...baseContext, goPrevPage: () => goPrevPage(baseContext), goNextPage: () => goNextPage(baseContext), confirmGoPrevChapter: () => confirmGoPrevChapter(baseContext), confirmGoNextChapter: () => confirmGoNextChapter(baseContext), toggleChrome: () => toggleChrome(baseContext), closeDrawer: () => closeDrawer(panelContext), openDrawer: () => openDrawer(panelContext), closePageJump: () => closePageJump(panelContext), closeReaderAdjust: (apply, hideDrawerAndChrome) => closeReaderAdjust(panelContext, apply, hideDrawerAndChrome) };
    const eventHandlers = createEventHandlers(eventHandlerContext);
    const toggleFullscreenPromptSetting = () => {
      s.showFullscreenPrompt = !s.showFullscreenPrompt;
      updateFullscreenPromptUi(baseContext);
      saveFullscreenPromptSetting(s.showFullscreenPrompt);
    };
    const toggleFullscreen = () => document.fullscreenElement ? void document.exitFullscreen().catch(() => {
    }) : void refs.readerRoot.requestFullscreen().catch(() => {
    });
    refs.btnHeaderMenu.addEventListener("click", () => refs.drawerOverlay.classList.contains("open") ? closeDrawer(panelContext) : openDrawer(panelContext));
    refs.btnHeaderFullscreen.addEventListener("click", toggleFullscreen);
    refs.drawerBackdrop.addEventListener("click", () => closeDrawer(panelContext));
    refs.btnFooterPageJump.addEventListener("click", () => openPageJump(panelContext));
    [refs.pageJumpBackdrop, refs.pageJumpCancel].forEach((el) => el.addEventListener("click", () => closePageJump(panelContext)));
    refs.pageJumpOk.addEventListener("click", () => submitPageJump(panelContext));
    refs.pageJumpInput.addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault(), submitPageJump(panelContext)));
    [refs.pageJumpPanel, refs.fullscreenPromptPanel, refs.readerAdjustPanel].forEach((el) => el.addEventListener("click", (e) => e.stopPropagation()));
    refs.fullscreenPromptBackdrop.addEventListener("click", () => closeFullscreenPrompt(panelContext));
    refs.btnFullscreenPromptCancel.addEventListener("click", () => closeFullscreenPrompt(panelContext));
    refs.btnFullscreenPromptConfirm.addEventListener("click", () => confirmFullscreen(panelContext));
    refs.btnFullscreenPromptToggle.addEventListener("click", toggleFullscreenPromptSetting);
    refs.readerAdjustBackdrop.addEventListener("click", () => closeReaderAdjust(panelContext, false, false));
    eventHandlers.bindAll(eventAc.signal);
    refs.btnPrevChap.addEventListener("click", () => chapterNav.prev && (window.location.href = chapterNav.prev));
    refs.btnPrevPage.addEventListener("click", () => goPrevPage(baseContext));
    refs.btnNextPage.addEventListener("click", () => goNextPage(baseContext));
    refs.btnNextChap.addEventListener("click", () => chapterNav.next && (window.location.href = chapterNav.next));
    refs.btnReaderSettingsAdjust.addEventListener("click", () => openReaderAdjust(panelContext));
    refs.btnReaderSettingsDropdown.addEventListener("click", () => setReaderSettingsExpanded(panelContext, !s.readerSettingsExpanded));
    refs.selectFontSource.addEventListener("change", () => {
      s.fontSource = refs.selectFontSource.value === "web" ? "web" : "local";
      syncFontSourceUi(baseContext);
    });
    refs.selectLocalFont.addEventListener("change", () => {
      if (s.fontSource !== "local") return;
      const next = refs.selectLocalFont.value;
      if (!next || next === s.currentReaderSettings.fontFamily) return;
      s.currentReaderSettings.fontFamily = next;
      updateReaderSettingsUi(baseContext);
      clearCharWidthCache();
      s.lastCanvasW = s.lastCanvasH = -1;
      render();
    });
    const applyWebFontFromInputs = async () => {
      const cssUrl = refs.inputWebFontCssUrl.value.trim();
      const family = refs.inputWebFontFamily.value.trim();
      if (!cssUrl || !family) return window.alert("\u8ACB\u8F38\u5165 Web Font \u7684 CSS URL \u8207 font-family");
      if (!/^https:\/\//i.test(cssUrl)) return window.alert("Web Font URL \u5FC5\u9808\u662F https://");
      refs.btnApplyWebFont.disabled = true;
      try {
        await applyWebFont(settingsContext, cssUrl, family);
      } catch {
        window.alert("Web Font \u5957\u7528\u5931\u6557\uFF0C\u8ACB\u78BA\u8A8D URL \u8207 font-family");
      } finally {
        refs.btnApplyWebFont.disabled = false;
      }
    };
    refs.fontWebControls.addEventListener("click", (e) => {
      const presetBtn = e.target?.closest(".esj-font-preset-btn");
      if (!presetBtn) return;
      const presetId = presetBtn.dataset.fontPreset ?? "";
      const row = presetBtn.closest(".esj-font-preset-row");
      const weightSelect = row?.querySelector(".esj-font-weight-select");
      const weight = Number(weightSelect?.value ?? 400);
      const config = getPresetWebFontConfig(presetId, weight);
      if (!config) return;
      refs.inputWebFontCssUrl.value = config.cssUrl;
      refs.inputWebFontFamily.value = config.family;
      void applyWebFontFromInputs();
    });
    refs.btnApplyWebFont.addEventListener("click", () => void applyWebFontFromInputs());
    refs.btnProfileDropdown.addEventListener("click", () => setProfileExpanded(panelContext, !s.profileExpanded));
    refs.btnProfileSave.addEventListener("click", saveReaderProfile2);
    refs.btnProfileRestore.addEventListener("click", () => {
      const changed = loadSavedReaderProfile();
      if (!s.hasSavedProfile) return window.alert("\u5C1A\u672A\u5132\u5B58\u8A2D\u5B9A\u6A94");
      if (!changed) return;
      clearCharWidthCache();
      s.lastCanvasW = s.lastCanvasH = -1;
      render();
    });
    const applyReaderSettingFromSlider = (key, rawValue) => {
      const limits = READER_LIMITS[key];
      if (!Number.isFinite(rawValue)) return;
      const next = clamp(roundByStep(rawValue, limits.step), limits.min, limits.max);
      if (next === s.currentReaderSettings[key]) return;
      s.currentReaderSettings[key] = next;
      updateReaderSettingsUi(baseContext);
      if (!s.previewFromAdjust) s.lastCanvasW = s.lastCanvasH = -1;
      render();
    };
    const bindAdjustRow = (key, decBtn, incBtn, rangeEl) => {
      decBtn.addEventListener("click", () => adjustReaderSetting(settingsContext, key, -READER_LIMITS[key].step));
      incBtn.addEventListener("click", () => adjustReaderSetting(settingsContext, key, READER_LIMITS[key].step));
      rangeEl.addEventListener("input", () => applyReaderSettingFromSlider(key, Number(rangeEl.value)));
    };
    bindAdjustRow("fontSize", refs.btnReaderAdjustFontDec, refs.btnReaderAdjustFontInc, refs.rangeReaderAdjustFont);
    bindAdjustRow("lineHeight", refs.btnReaderAdjustLineHeightDec, refs.btnReaderAdjustLineHeightInc, refs.rangeReaderAdjustLineHeight);
    bindAdjustRow("paragraphSpacing", refs.btnReaderAdjustParaSpacingDec, refs.btnReaderAdjustParaSpacingInc, refs.rangeReaderAdjustParaSpacing);
    bindAdjustRow("pagePaddingX", refs.btnReaderAdjustPagePaddingXDec, refs.btnReaderAdjustPagePaddingXInc, refs.rangeReaderAdjustPagePaddingX);
    bindAdjustRow("pagePaddingY", refs.btnReaderAdjustPagePaddingYDec, refs.btnReaderAdjustPagePaddingYInc, refs.rangeReaderAdjustPagePaddingY);
    bindAdjustRow("pageMaxWidth", refs.btnReaderAdjustPageMaxWidthDec, refs.btnReaderAdjustPageMaxWidthInc, refs.rangeReaderAdjustPageMaxWidth);
    refs.btnRemoveSingleEmptyToggle.addEventListener("click", () => toggleRemoveSingleEmptyParagraph(settingsContext));
    refs.btnReaderAdjustCancel.addEventListener("click", () => closeReaderAdjust(panelContext, false, false));
    refs.btnReaderAdjustApply.addEventListener("click", () => closeReaderAdjust(panelContext, true, true));
    updateRemoveSingleEmptyParagraphUi(baseContext);
    s.showFullscreenPrompt = loadFullscreenPromptSetting();
    updateFullscreenPromptUi(baseContext);
    loadSavedReaderProfile();
    s.pendingRestoreCursor = loadSavedCursor(novelId, chapterKey);
    const savedWebFont = loadWebFontConfig();
    if (savedWebFont) {
      refs.inputWebFontCssUrl.value = savedWebFont.cssUrl;
      refs.inputWebFontFamily.value = savedWebFont.family;
    }
    setReaderSettingsExpanded(panelContext, false);
    setProfileExpanded(panelContext, false);
    updateProfileUi(baseContext);
    syncFontSourceUi(baseContext);
    updateReaderSettingsUi(baseContext);
    updateResponsiveChrome(baseContext);
    const initialPreset = getChromePreset(window.innerWidth);
    s.activeChromePreset = initialPreset;
    applyChromeSettings(baseContext, getChromeSettingsForPreset(initialPreset));
    const handleLayoutChange = () => {
      const anchorCursor = s.pageStarts[s.pageIndex] ? { ...s.pageStarts[s.pageIndex] } : null;
      s.lastCanvasW = s.lastCanvasH = -1;
      render();
      if (anchorCursor && s.pageStarts.length > 0) {
        s.pageIndex = findPageIndexByCursor(s.pageStarts, anchorCursor);
        render();
      }
    };
    document.addEventListener("fullscreenchange", () => {
      syncHeaderFullscreenUi(baseContext);
      handleLayoutChange();
    }, { signal: eventAc.signal });
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && handleLayoutChange(), { signal: eventAc.signal });
    syncHeaderFullscreenUi(baseContext);
    render();
    if (s.showFullscreenPrompt && !document.fullscreenElement) openFullscreenPrompt(panelContext);
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(render, 150);
    }, { signal: eventAc.signal });
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
