# esj-pager 專案概覽

## 新同事 3 分鐘上手路徑

1. 先看 `src/main.ts`：掌握整體流程（初始化、事件、render、手勢、章節導覽）。
2. 再看 `src/reader/dom.ts` + `src/reader/styles.ts`：理解 UI 組裝與樣式分層（header/footer/drawer/設定列）。
3. 接著看 `src/reader/settings.ts`：知道 RWD chrome preset 與 reader 預設參數來源。
4. 再看 `src/extract.ts` + `src/pagination.ts`：理解「HTML → Block[] → 分頁游標」核心演算法。
5. 最後看 `src/site.ts` + `src/lucideIcons.ts`：補齊站點資料來源與 icon 封裝細節。

## 專案目標

- 將 ESJ 章節頁改成全螢幕翻頁閱讀器（Canvas 分頁渲染），取代長捲動閱讀。
- 內容來源完全來自頁面既有 DOM（`.forum-content`），不依賴站方 API。
- 以 userscript 形式部署（Tampermonkey / Violentmonkey）。

## 技術與建置

| 項目 | 說明 |
|------|------|
| 語言 | TypeScript |
| 打包 | esbuild（IIFE） |
| 產物 | `dist/esj-pager.user.js` |
| 指令 | `npm run build` / `npm run watch` |
| 圖示 | Lucide（具名 import，tree-shaking） |

## 目前程式結構

- `src/main.ts`：閱讀器主流程（狀態、事件、分頁重算、翻頁手勢、章節跳轉）。
- `src/reader/settings.ts`：`readerSettings`、`chromeSettings`（mobile/tablet/desktop）與 breakpoint 判斷。
- `src/reader/styles.ts`：閱讀器樣式字串（header/footer/drawer/設定列/跳頁浮層）。
- `src/reader/dom.ts`：閱讀器 DOM 組裝與 refs 回傳。
- `src/reader/renderCanvas.ts`：Canvas 底部資訊列（標題 + 頁碼）與 ellipsis 處理。
- `src/extract.ts`：HTML 轉 `Block[]`（包含空段落與圖片 block）。
- `src/pagination.ts`：`buildPageStarts` / `walkOnePage` / `wrapByChar`。
- `src/site.ts`：章節標題、目錄連結、上下章連結等站點資訊抽取。
- `src/lucideIcons.ts`：專案內使用的 Lucide icon 工具函式。

## 目前功能現狀

### 內容與分頁

- 章節內容先轉成 `Block[]`（`paragraph` / `img`），再以 Canvas 逐頁排版。
- 分頁僅儲存每頁起始游標（`Cursor`），避免複製整頁內容。
- 正文顯示區使用 `readerSettings`（字級、行高、段距、頁邊距）即時重排。

### 閱讀器 UI

- 全螢幕覆蓋式閱讀器，header/footer 為半透明浮層，可中間點擊顯示/隱藏。
- 底欄為五欄導覽（上章／上頁／中間資訊區／下頁／下章）。
- 中間資訊區顯示頁碼，並附 `pen-line` 按鈕開啟跳頁對話框。
- Canvas 底部 padding 區會額外畫「左側章節標題 + 右側頁碼」資訊列。

### 章節與手勢

- 章節導覽支援上一章/下一章按鈕。
- 閱讀區左右點擊手勢：
  - 單擊：下一頁
  - 雙擊：上一頁
  - 第一頁雙擊：詢問後可前往上一章
  - 最後一頁單擊：詢問後可前往下一章
- 中間區塊點擊：切換 header/footer 顯示。

### 左側選單（抽屜）

- 含章節目錄入口（table-of-contents icon）。
- 含閱讀設定列（圖示 + 中文 + 加減）：
  - 字級（`a-large-small` + `a-arrow-up/down`）
  - 行高 / 段距 / 頁邊距（`diff` + `plus/minus`）
- 含切換項目：`去除空段落`（`square` / `square-check`）。
  - 規則：只移除「單一」空段落；連續 2 個以上空段落保留。

### RWD（目前範圍）

- 目前 RWD 主要套用在 `chromeSettings`（header/footer/按鈕與 icon 尺寸）。
- 依寬度切換 preset：
  - `mobile`：`<= 640`
  - `tablet`：`641 ~ 1024`
  - `desktop`：`> 1024`
- `readerSettings` 目前為同一組可調值，不做 breakpoint 分流。

## 已知限制（現況）

- 圖片目前以 `[圖片]` 文字占位，尚未在 Canvas 內繪製實圖。
- 閱讀設定與開關目前為執行期狀態，尚未持久化（未寫入 localStorage）。
- 跳頁目前是單純頁碼定位，尚未做內容錨點式還原。
