// ==UserScript==
// @name         ESJ Zone：電子紙閱讀模式
// @namespace    emi
// @version      1.0
// @description  將 ESJ Zone 的下拉滾動頁面轉換為翻頁模式，專為電子紙閱讀器設計，也適用於手機和桌面瀏覽器。
// @match        https://www.esjzone.cc/forum/*
// @match        https://www.esjzone.cc/detail/*
// @match        https://www.esjzone.one/forum/*
// @match        https://www.esjzone.one/detail/*
// @match        https://www.esjzone.me/forum/*
// @match        https://www.esjzone.me/detail/*
// @grant        none
// @license      MIT
// ==/UserScript==
 
(async function() {
    'use strict';
 
    const content = document.querySelector('.forum-content');
    if (!content) return;
 
    // --- Enable safe area insets for notch/punch-hole phones ---
    let vpMeta = document.querySelector('meta[name="viewport"]');
    if (vpMeta) {
        if (!vpMeta.content.includes('viewport-fit=cover')) {
            vpMeta.content += ', viewport-fit=cover';
        }
    } else {
        vpMeta = document.createElement('meta');
        vpMeta.name = 'viewport';
        vpMeta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
        document.head.appendChild(vpMeta);
    }
 
    // --- Config ---
    const LINE_HEIGHT_MIN = 0.8;
    const LINE_HEIGHT_MAX = 5.0;
    const LINE_HEIGHT_STEP = 0.1;
    const PARA_MIN = 0;
    const PARA_MAX = 5.0;
    const PARA_STEP = 0.1;
    let lineHeight = parseFloat(localStorage.getItem('eink-line-height')) || 1.8;
    let paraSpacing = parseFloat(localStorage.getItem('eink-para-spacing')) || 0.6;
    const FONT_MIN = 14;
    const FONT_MAX = 36;
    const FONT_STEP = 2;
    let fontSize = parseInt(localStorage.getItem('eink-font-size')) || 20;
 
    // --- Font family detection ---
    const FONT_CANDIDATES = [
        { name: '宋體', family: 'SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif' },
        { name: '黑體', family: '"Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif' },
        { name: '楷體', family: 'KaiTi, "AR PL UKai", STKaiti, serif' },
        { name: '明體', family: '"Noto Serif CJK TC", "Source Han Serif TC", "PMingLiU", serif' },
        { name: '圓體', family: '"Microsoft JhengHei", "Noto Sans CJK TC", sans-serif' },
        { name: '系統', family: 'sans-serif' },
    ];
    function isFontAvailable(family) {
        const t = '測試字體ABCabc123', c = document.createElement('canvas').getContext('2d');
        c.font = '72px monospace';
        const dw = c.measureText(t).width;
        c.font = '72px "' + family.split(',')[0].trim().replace(/"/g, '') + '", monospace';
        return c.measureText(t).width !== dw;
    }
    const availableFonts = FONT_CANDIDATES.filter(f => f.name === '系統' || isFontAvailable(f.family));
    let fontFamily = localStorage.getItem('eink-font-family') || availableFonts[0].family;
 
    // --- Layout ---
    const screenH = window.innerHeight;
    const PADDING = Math.round(screenH * 0.02);
    const HEADER_HEIGHT = Math.round(screenH * 0.07);
    const NAV_HEIGHT = Math.round(screenH * 0.07);
 
    // --- Extract paragraphs ---
    const rawHTML = content.innerHTML;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHTML;
    tempDiv.querySelectorAll('script, style, iframe, .ads, .ad').forEach(el => el.remove());
 
    const blocks = [];
    const walk = (node) => {
        for (const child of node.childNodes) {
            if (child.nodeType === 3) {
                const t = child.textContent.trim();
                if (t) blocks.push({ type: 'text', text: t });
            } else if (child.tagName === 'BR') {
                blocks.push({ type: 'break' });
            } else if (child.tagName === 'IMG') {
                const src = child.src || child.getAttribute('data-src') || child.getAttribute('data-original') || '';
                if (src) blocks.push({ type: 'img', src: src });
            } else if (child.tagName === 'P' || child.tagName === 'DIV') {
                const imgs = child.querySelectorAll('img');
                if (imgs.length > 0) {
                    for (const c of child.childNodes) {
                        if (c.nodeType === 3) {
                            const t = c.textContent.trim();
                            if (t) blocks.push({ type: 'text', text: t });
                        } else if (c.tagName === 'IMG') {
                            const src = c.src || c.getAttribute('data-src') || c.getAttribute('data-original') || '';
                            if (src) blocks.push({ type: 'img', src: src });
                        } else if (c.querySelector && c.querySelector('img')) {
                            c.querySelectorAll('img').forEach(img => {
                                const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
                                if (src) blocks.push({ type: 'img', src: src });
                            });
                        } else {
                            const t = c.textContent.trim();
                            if (t) blocks.push({ type: 'text', text: t });
                        }
                    }
                } else {
                    // Walk <p> children to handle <br> as paragraph breaks
                    let hasContent = false;
                    for (const c of child.childNodes) {
                        if (c.nodeType === 3) {
                            const t = c.textContent.trim();
                            if (t) { blocks.push({ type: 'text', text: t }); hasContent = true; }
                        } else if (c.tagName === 'BR') {
                            blocks.push({ type: 'break' });
                        } else {
                            const t = c.textContent.trim();
                            if (t) { blocks.push({ type: 'text', text: t }); hasContent = true; }
                        }
                    }
                    if (!hasContent) blocks.push({ type: 'break' });
                }
            } else {
                walk(child);
            }
        }
    };
    walk(tempDiv);
    if (blocks.length === 0) return;
 
    // --- Get title and chapter nav ---
    const title = document.querySelector('h2, .forum-content-title')?.textContent?.trim() || document.title;
    const allLinks = [...document.querySelectorAll('a')];
    const prevLink = allLinks.find(a => a.textContent.includes('上一篇'))?.href || '';
    const nextLink = allLinks.find(a => a.textContent.includes('下一篇'))?.href || '';
    const urlMatch = window.location.pathname.match(/\/forum\/(\d+)\//);
    const homeLink = urlMatch ? '/detail/' + urlMatch[1] : '';
 
    // --- Pre-load images ---
    const imgSizes = {};
    const imgPromises = [];
    for (const block of blocks) {
        if (block.type === 'img') {
            imgPromises.push(new Promise(resolve => {
                const img = new Image();
                img.onload = () => { imgSizes[block.src] = { w: img.naturalWidth, h: img.naturalHeight }; resolve(); };
                img.onerror = () => { imgSizes[block.src] = { w: 100, h: 100 }; resolve(); };
                img.src = block.src;
            }));
        }
    }
    await Promise.all(imgPromises);
 
    // --- Build DOM ---
    document.body.className = 'eink-mode';
    document.body.innerHTML = `
        <div id="eink-root">
            <div id="eink-body"></div>
            <div id="eink-status">
                <span id="eink-status-title"></span>
                <span id="eink-status-page"></span>
            </div>
        </div>
        <div id="eink-header">
            <button id="btn-menu">☰</button>
            <span id="eink-title"></span>
            <button id="btn-fs">⛶</button>
        </div>
        <div id="eink-footer">
            ${prevLink ? '<a href="'+prevLink+'" class="ft-chap">←</a>' : '<span class="ft-chap"></span>'}
            <button id="btn-prev" class="ft-page">‹ 上頁</button>
            <span id="eink-info" class="ft-info"><input id="page-input" type="number" min="1" value="1"> / <span id="page-total"></span></span>
            <button id="btn-next" class="ft-page">下頁 ›</button>
            ${nextLink ? '<a href="'+nextLink+'" class="ft-chap">→</a>' : '<span class="ft-chap"></span>'}
        </div>
        <div class="eink-tap" id="eink-tap-l"></div>
        <div class="eink-tap" id="eink-tap-m"></div>
        <div class="eink-tap" id="eink-tap-r"></div>
        <div id="eink-overlay"></div>
        <div id="eink-menu">
            ${homeLink ? '<a href="'+homeLink+'" class="menu-item">⌂</a>' : ''}
            <button class="menu-item" id="menu-font-toggle">A± <span id="font-arrow">▸</span></button>
            <div id="menu-font-sub" style="display:none;">
                <button class="menu-item menu-sub" id="menu-font-up">A+</button>
                <button class="menu-item menu-sub" id="menu-font-down">A-</button>
            </div>
            <button class="menu-item" id="menu-lh-toggle">行距± <span id="lh-arrow">▸</span></button>
            <div id="menu-lh-sub" style="display:none;">
                <button class="menu-item menu-sub" id="menu-lh-up">+</button>
                <button class="menu-item menu-sub" id="menu-lh-down">-</button>
            </div>
            <button class="menu-item" id="menu-ps-toggle">段距± <span id="ps-arrow">▸</span></button>
            <div id="menu-ps-sub" style="display:none;">
                <button class="menu-item menu-sub" id="menu-ps-up">+</button>
                <button class="menu-item menu-sub" id="menu-ps-down">-</button>
            </div>
            <button class="menu-item" id="menu-ff-toggle">字體 <span id="ff-arrow">▸</span></button>
            <div id="menu-ff-sub" style="display:none;"></div>
            <button class="menu-item" id="menu-fullscreen">⛶ 全螢幕</button>
        </div>
    `;
 
    const bodyEl = document.getElementById('eink-body');
    const headerEl = document.getElementById('eink-header');
    const footerEl = document.getElementById('eink-footer');
    const titleEl = document.getElementById('eink-title');
    const infoEl = document.getElementById('eink-info');
    const rootEl = document.getElementById('eink-root');
 
    // --- Styles ---
    function applyStyles() {
        let s = document.getElementById('eink-styles');
        if (s) s.remove();
        s = document.createElement('style');
        s.id = 'eink-styles';
        s.textContent = `
            body.eink-mode {
                background: #fff !important; color: #000 !important;
                margin: 0 !important; padding: 0 !important; overflow: hidden !important;
            }
            body.eink-mode * { background: transparent !important; color: #000 !important; box-shadow: none !important; }
            #eink-root {
                font-family: ${fontFamily};
                font-size: ${fontSize}px; line-height: ${lineHeight};
                max-width: 1000px; margin: 0 auto;
                padding: max(${PADDING}px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(${PADDING}px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
                height: 100vh; box-sizing: border-box; position: relative;
            }
            #eink-body { height: 100%; overflow: hidden; }
            #eink-status {
                position: absolute; bottom: 2px; left: 24px; right: 24px;
                display: flex; justify-content: space-between;
                font-size: ${Math.max(8, Math.round(PADDING * 0.45))}px;
                color: #999 !important; line-height: 1;
            }
            #eink-status-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 12px; flex: 1; min-width: 0; }
            #eink-status-page { flex-shrink: 0; }
            #eink-header {
                position: fixed; top: 0; left: 0; right: 0; z-index: 10000;
                height: ${HEADER_HEIGHT}px;
                padding-top: env(safe-area-inset-top);
                display: flex; align-items: center;
                justify-content: space-between; padding: 0 24px 0 0;
                border-bottom: 1px solid #ddd; background: rgba(255,255,255,0.95) !important;
                font-size: ${Math.max(12, Math.round(HEADER_HEIGHT * 0.4))}px;
                color: #888 !important; box-sizing: border-box;
            }
            #eink-header button {
                width: ${HEADER_HEIGHT}px; height: ${HEADER_HEIGHT}px; padding: 0;
                border: none; background: transparent !important;
                cursor: pointer; font-size: ${Math.max(12, Math.round(HEADER_HEIGHT * 0.5))}px;
                color: #000 !important; display: flex; align-items: center; justify-content: center;
            }
            #btn-menu { border-right: 1px solid #ddd; }
            #btn-fs { border-left: 1px solid #ddd; }
            #eink-footer {
                position: fixed; bottom: 0; left: 0; right: 0; z-index: 10000;
                display: flex; align-items: center; border-top: 1px solid #ddd;
                font-size: ${Math.max(12, Math.round(NAV_HEIGHT * 0.3))}px;
                height: ${NAV_HEIGHT}px; box-sizing: border-box; user-select: none;
                background: rgba(255,255,255,0.95) !important;
                padding-bottom: env(safe-area-inset-bottom); padding-left: 0; padding-right: 0; padding-top: 0;
            }
            #eink-footer a, #eink-footer button, #eink-footer span {
                display: flex; align-items: center; justify-content: center;
                height: 100%; border: none;
                background: transparent !important; color: #000 !important;
                text-decoration: none; cursor: pointer; padding: 0; margin: 0;
                font-size: ${Math.max(12, Math.round(NAV_HEIGHT * 0.3))}px;
                box-sizing: border-box;
            }
            #eink-footer .ft-chap { width: 11%; border-right: 1px solid #ddd; }
            #eink-footer .ft-chap:last-child { border-right: none; border-left: 1px solid #ddd; }
            #eink-footer .ft-page { width: 22%; border-right: 1px solid #ddd; }
            #eink-footer #btn-next { border-right: none; border-left: 1px solid #ddd; }
            #eink-footer .ft-info { width: 34%; cursor: default; }
            #eink-footer > :last-child { border-right: none; }
            #eink-footer button:disabled { opacity: 0.25; cursor: default; }
            #page-input {
                width: 2.5em; text-align: center; border: 1px solid #aaa;
                background: #fff !important; color: #000 !important;
                font-size: inherit; padding: 2px; margin: 0;
                -moz-appearance: textfield;
            }
            #page-input::-webkit-outer-spin-button,
            #page-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            .eink-tap { position: fixed; z-index: 9999; top: 0; bottom: 0; }
            #eink-tap-l { left: 0; width: 30%; }
            #eink-tap-m { left: 30%; width: 30%; }
            #eink-tap-r { right: 0; width: 40%; }
            #eink-overlay {
                display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.3); z-index: 10001;
            }
            #eink-overlay.open { display: block; }
            #eink-menu {
                position: fixed; top: 0; left: -35%; width: 30%; height: 100%;
                background: #fff !important; border-right: 1px solid #ccc; z-index: 10002;
                display: flex; flex-direction: column; padding: ${PADDING}px;
                box-sizing: border-box; overflow-y: auto;
            }
            #eink-menu.open { left: 0; }
            .menu-item {
                display: block; width: 100%; padding: ${Math.round(screenH * 0.015)}px 0;
                border: none; border-bottom: 1px solid #ddd;
                background: transparent !important; color: #000 !important;
                font-size: ${Math.max(14, Math.round(screenH * 0.02))}px;
                text-align: left; text-decoration: none; cursor: pointer;
                font-family: ${fontFamily};
            }
            .menu-sub {
                padding-left: ${Math.round(screenH * 0.02)}px;
                font-size: ${Math.max(12, Math.round(screenH * 0.018))}px;
            }
        `;
        document.head.appendChild(s);
    }
 
    // --- Canvas rendering ---
    let pages = [];
    let page = 0;
 
    // Canvas font needs a single font name, not CSS fallback list
    function getCanvasFont() {
        const primary = fontFamily.split(',')[0].trim().replace(/"/g, '');
        return `${fontSize}px ${primary}`;
    }
 
    function getAvailH() {
        return bodyEl.clientHeight;
    }
 
    const lineH = () => fontSize * lineHeight;
    const paraGap = () => fontSize * paraSpacing;
 
    // Paginate using Canvas measureText — no DOM, no scrollHeight
    function paginate() {
        pages = [];
        const cvs = document.createElement('canvas');
        const ctx = cvs.getContext('2d');
        ctx.font = getCanvasFont();
 
        const availH = getAvailH();
        const availW = bodyEl.clientWidth;
 
        // Lay out all blocks into a flat list of draw commands
        // Each command: { type: 'text'|'img', ... }
        // Then slice into pages by y position
 
        let pageItems = [];
        let y = fontSize * 0.1; // small top offset for font ascenders
 
        function newPage() {
            if (pageItems.length > 0) pages.push(pageItems);
            pageItems = [];
            y = fontSize * 0.1;
        }
 
        function wrapText(text, isBreak) {
            if (isBreak) {
                const gap = lineH() * 0.5;
                if (y + gap > availH) newPage();
                else y += gap;
                return;
            }
            const lh = lineH();
            let x = 0;
            let lineChars = '';
 
            const flushLine = () => {
                if (lineChars.length === 0) return;
                if (y + lh > availH) newPage();
                pageItems.push({ type: 'line', text: lineChars, y: y });
                y += lh;
                lineChars = '';
                x = 0;
            };
 
            for (let ci = 0; ci < text.length; ci++) {
                const ch = text[ci];
                const cw = ctx.measureText(ch).width;
                if (x + cw > availW && lineChars.length > 0) {
                    flushLine();
                }
                lineChars += ch;
                x += cw;
            }
            flushLine(); // last line
            // Paragraph spacing
            const pg = paraGap();
            if (pg > 0) {
                if (y + pg > availH) newPage();
                else y += pg;
            }
        }
 
        for (const block of blocks) {
            if (block.type === 'img') {
                const info = imgSizes[block.src] || { w: 100, h: 100 };
                const scale = Math.min(1, availW / info.w);
                const imgH = Math.round(info.h * scale);
                const imgW = Math.round(info.w * scale);
                if (y + imgH > availH) newPage();
                pageItems.push({ type: 'img', src: block.src, y: y, w: imgW, h: imgH });
                y += imgH;
                newPage(); // image always ends the page
            } else if (block.type === 'break') {
                wrapText('', true);
            } else {
                wrapText(block.text, false);
            }
        }
        if (pageItems.length > 0) pages.push(pageItems);
    }
 
    // Render current page onto a canvas element
    function render() {
        bodyEl.innerHTML = '';
        const availH = getAvailH();
        const availW = bodyEl.clientWidth;
 
        const cvs = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        cvs.width = availW * dpr;
        cvs.height = availH * dpr;
        cvs.style.width = availW + 'px';
        cvs.style.height = availH + 'px';
        bodyEl.appendChild(cvs);
 
        const ctx = cvs.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.font = getCanvasFont();
        ctx.fillStyle = '#000';
        ctx.textBaseline = 'top';
 
        const items = pages[page] || [];
        for (const item of items) {
            if (item.type === 'line') {
                ctx.fillText(item.text, 0, item.y);
            } else if (item.type === 'img') {
                const img = new Image();
                img.onload = () => ctx.drawImage(img, 0, item.y, item.w, item.h);
                img.src = item.src;
            }
        }
 
        titleEl.textContent = title;
        document.getElementById('page-input').value = page + 1;
        document.getElementById('page-input').max = pages.length;
        document.getElementById('page-total').textContent = pages.length;
        document.getElementById('eink-status-title').textContent = title;
        document.getElementById('eink-status-page').textContent = (page + 1) + '/' + pages.length;
        document.getElementById('btn-prev').disabled = (page === 0);
        document.getElementById('btn-next').disabled = (page === pages.length - 1);
    }
 
    function prev() {
        if (page > 0) { page--; render(); }
        else if (prevLink) {
            customConfirm('回到上一章？').then(ok => { if (ok) window.location.href = prevLink; });
        }
    }
    function next() {
        if (page < pages.length - 1) { page++; render(); }
        else if (nextLink) {
            customConfirm('進入下一章？').then(ok => { if (ok) window.location.href = nextLink; });
        }
    }
 
    function repaginate() {
        applyStyles();
        const ratio = pages.length > 0 ? page / pages.length : 0;
        paginate();
        page = Math.min(Math.round(ratio * pages.length), pages.length - 1);
        render();
    }
 
    function changeFontSize(d) { fontSize = Math.max(FONT_MIN, Math.min(FONT_MAX, fontSize + d)); localStorage.setItem('eink-font-size', fontSize); repaginate(); }
    function changeLineHeight(d) { lineHeight = Math.max(LINE_HEIGHT_MIN, Math.min(LINE_HEIGHT_MAX, parseFloat((lineHeight + d).toFixed(1)))); localStorage.setItem('eink-line-height', lineHeight); repaginate(); }
    function changeParaSpacing(d) { paraSpacing = Math.max(PARA_MIN, Math.min(PARA_MAX, parseFloat((paraSpacing + d).toFixed(1)))); localStorage.setItem('eink-para-spacing', paraSpacing); repaginate(); }
    function changeFontFamily(f) { fontFamily = f; localStorage.setItem('eink-font-family', fontFamily); repaginate(); }
 
    // --- Events ---
    const menuEl = document.getElementById('eink-menu');
    const overlayEl = document.getElementById('eink-overlay');
    function toggleMenu() { menuEl.classList.toggle('open'); overlayEl.classList.toggle('open'); }
 
    document.getElementById('btn-menu').addEventListener('click', toggleMenu);
    overlayEl.addEventListener('click', toggleMenu);
 
    function setupToggle(toggleId, subId, arrowId) {
        document.getElementById(toggleId).addEventListener('click', () => {
            const sub = document.getElementById(subId);
            const arrow = document.getElementById(arrowId);
            sub.style.display = sub.style.display === 'none' ? 'block' : 'none';
            arrow.textContent = sub.style.display === 'none' ? '▸' : '▾';
        });
    }
    setupToggle('menu-font-toggle', 'menu-font-sub', 'font-arrow');
    setupToggle('menu-lh-toggle', 'menu-lh-sub', 'lh-arrow');
    setupToggle('menu-ps-toggle', 'menu-ps-sub', 'ps-arrow');
    setupToggle('menu-ff-toggle', 'menu-ff-sub', 'ff-arrow');
 
    document.getElementById('menu-font-up').addEventListener('click', () => changeFontSize(FONT_STEP));
    document.getElementById('menu-font-down').addEventListener('click', () => changeFontSize(-FONT_STEP));
    document.getElementById('menu-lh-up').addEventListener('click', () => changeLineHeight(LINE_HEIGHT_STEP));
    document.getElementById('menu-lh-down').addEventListener('click', () => changeLineHeight(-LINE_HEIGHT_STEP));
    document.getElementById('menu-ps-up').addEventListener('click', () => changeParaSpacing(PARA_STEP));
    document.getElementById('menu-ps-down').addEventListener('click', () => changeParaSpacing(-PARA_STEP));
 
    const ffSub = document.getElementById('menu-ff-sub');
    availableFonts.forEach(f => {
        const btn = document.createElement('button');
        btn.className = 'menu-item menu-sub';
        btn.textContent = f.name;
        btn.style.fontFamily = f.family;
        btn.addEventListener('click', () => changeFontFamily(f.family));
        ffSub.appendChild(btn);
    });
 
    // Fullscreen
    function toggleFullscreen() {
        if (document.fullscreenElement) { document.exitFullscreen(); }
        else { document.documentElement.requestFullscreen().catch(() => {}); }
    }
    document.getElementById('menu-fullscreen').addEventListener('click', () => { toggleFullscreen(); toggleMenu(); });
    document.getElementById('btn-fs').addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => {
        document.getElementById('menu-fullscreen').textContent = document.fullscreenElement ? '⛶ 退出全螢幕' : '⛶ 全螢幕';
        // Add extra top padding in fullscreen to avoid punch-hole cameras
        const isFS = !!document.fullscreenElement;
        rootEl.style.paddingTop = isFS ? Math.max(PADDING, Math.round(screenH * 0.04)) + 'px' : '';
        setTimeout(repaginate, 300);
    });
 
    // Custom confirm dialog (doesn't exit fullscreen like native confirm)
    function customConfirm(msg) {
        return new Promise(resolve => {
            const bg = document.createElement('div');
            bg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:20000;display:flex;align-items:center;justify-content:center;';
            const box = document.createElement('div');
            box.style.cssText = 'background:#fff!important;padding:24px;border:1px solid #999;text-align:center;font-size:16px;color:#000!important;min-width:200px;';
            const text = document.createElement('div');
            text.textContent = msg;
            text.style.marginBottom = '16px';
            const btnYes = document.createElement('button');
            btnYes.textContent = '確定';
            btnYes.style.cssText = 'padding:8px 24px;margin:0 8px;border:1px solid #999;background:#f5f5f5!important;cursor:pointer;font-size:14px;color:#000!important;';
            const btnNo = document.createElement('button');
            btnNo.textContent = '取消';
            btnNo.style.cssText = btnYes.style.cssText;
            box.appendChild(text);
            box.appendChild(btnNo);
            box.appendChild(btnYes);
            bg.appendChild(box);
            document.body.appendChild(bg);
            btnYes.addEventListener('click', () => { bg.remove(); resolve(true); });
            btnNo.addEventListener('click', () => { bg.remove(); resolve(false); });
            bg.addEventListener('click', (e) => { if (e.target === bg) { bg.remove(); resolve(false); } });
        });
    }
 
    // Toggle header/footer (no repagination needed — they're overlays)
    let barsHidden = false;
    function toggleBars() {
        barsHidden = !barsHidden;
        headerEl.style.display = barsHidden ? 'none' : '';
        footerEl.style.display = barsHidden ? 'none' : '';
    }
 
    document.getElementById('btn-prev').addEventListener('click', prev);
    document.getElementById('btn-next').addEventListener('click', next);
 
    const pageInput = document.getElementById('page-input');
    function jumpToPage() {
        let target = parseInt(pageInput.value) - 1;
        if (isNaN(target)) return;
        target = Math.max(0, Math.min(pages.length - 1, target));
        page = target;
        render();
    }
    pageInput.addEventListener('change', jumpToPage);
    pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pageInput.blur(); } });
 
    document.getElementById('eink-tap-l').addEventListener('click', prev);
    document.getElementById('eink-tap-m').addEventListener('click', toggleBars);
    document.getElementById('eink-tap-r').addEventListener('click', next);
 
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') prev();
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
    });
 
    // --- Init ---
    applyStyles();
    paginate();
    render();
})();