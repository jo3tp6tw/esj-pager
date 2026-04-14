# esj-pager 專案概覽

## 專案目標

- 把 ESJ 章節頁改造成全螢幕 Canvas 分頁閱讀器，取代原頁面長捲動。
- 內容來源完全來自頁面 DOM（正文與留言），不依賴站方 API。
- 以 userscript 形式使用（Tampermonkey / Violentmonkey）。

## 新同事 3 分鐘上手路徑

1. `src/main.ts`：閱讀器主流程、狀態管理、UI 事件、快捷鍵、字體切換、render 策略。
2. `src/pagination.ts`：核心分頁邏輯（`buildPageStarts` / `walkOnePage` / `wrapByChar`）。
3. `src/reader/dom.ts` + `src/reader/styles.ts`：閱讀器 DOM 組裝與 UI 樣式。
4. `src/extract.ts` + `src/types.ts`：正文/留言抽取與 `Block` 型別。
5. `src/reader/settings.ts` + `src/site.ts`：預設參數與站點 selector/navigation。

## 技術與建置

| 項目 | 說明 |
|------|------|
| 語言 | TypeScript |
| 打包 | esbuild（IIFE） |
| 產物 | `dist/esj-pager.user.js` |
| 指令 | `npm run build` / `npm run watch` |
| 圖示 | Lucide（具名 import，tree-shaking） |

## 程式結構（現況）

- `src/main.ts`：閱讀器初始化、設定持久化、翻頁互動、字體來源（本機/Web Font）切換、局部預覽與重算流程。
- `src/pagination.ts`：分頁游標計算、畫面區塊繪製規則、留言區專用樣式（meta/main/divider）。
- `src/extract.ts`：正文區塊與留言區塊萃取（含回覆引用處理）。
- `src/types.ts`：`Block` 型別定義（`paragraph`/`img`/`commentMeta`/`commentMain`/`commentDivider`）。
- `src/reader/dom.ts`：header/footer/drawer/調整面板/跳頁面板/字體區塊 DOM refs。
- `src/reader/styles.ts`：閱讀器所有樣式（含字體區塊與 Web Font 快捷按鈕樣式）。
- `src/reader/settings.ts`：閱讀參數預設值與 RWD chrome preset。
- `src/reader/renderCanvas.ts`：底部 metadata 繪製。
- `src/site.ts`：正文、留言、標題、上下章、目錄連結 selector。
- `src/lucideIcons.ts`：專案 icon 封裝。

## 功能現況

### 內容來源與分頁

- 正文與留言皆會轉成 `Block[]` 後分頁，留言接在文章後方。
- 分頁以 `Cursor`（block index + offset）保存每頁起點，記憶體占用低。
- 正文使用可調字級/行高/段距/邊距/最大寬度。
- 留言區有專用排版：
  - `commentMain`：主內容
  - `commentMeta`：較小灰字（固定間距）
  - `commentDivider`：動態寬度分隔線（黑字，依可用寬度計算）

### 圖片頁處理

- 圖片依可用寬度等比例縮放繪製。
- 當頁空間不足時顯示 `【圖】` 佔位，圖片延後到下一頁。
- 超高圖片允許在該頁垂直捲動（`canvasWrap` 滾動）。
- 圖片載入採快取，載入完成後自動重算重繪。

### 閱讀器 UI

- 覆蓋式閱讀器，header/footer 可顯示/隱藏。
- Header：左上選單、中間章節標題、右上全螢幕切換（expand/shrink）。
- Footer：上章 / 上頁 / 頁碼區 / 下頁 / 下章。
- 頁碼區可開啟跳頁面板輸入頁碼。
- Canvas 底部繪製章名 + `目前頁 / 總頁數`。

### 互動與快捷鍵

- 點擊區：
  - 左/右區點擊翻頁
  - 中間區切換 chrome 顯示
- 手勢：
  - 滑動（含滑鼠左鍵拖曳）左右翻頁
  - 滾輪可滾動超高圖片頁
  - 右鍵（contextmenu）可執行上一頁
- 快捷鍵：
  - `ArrowLeft` / `ArrowRight` 翻頁
  - `F` 切換全螢幕
  - `Esc` 關閉抽屜/面板或恢復 chrome
- 已在 capture 階段攔截左右鍵，避免原站快捷鍵干擾。

### 左側抽屜區塊

- `目錄`：最上方入口（icon + 文字），高度與 header 一致。
- `閱讀設定`：顯示目前數值，可開啟調整面板。
- `設定檔`：顯示已儲存參數，可儲存/還原。
- `字體`：
  - 字體來源切換：本機字體 / Web Font
  - 本機字體：僅顯示本機可偵測字體白名單
  - Web Font：可手動填 CSS URL + family，並有一鍵快捷（思源宋體/思源黑體，可選字重 100~900）

### 調整面板（閱讀參數）

- 以浮動面板調整字級、行高、段距、邊距、最大寬度、去除空段落。
- 開啟面板時記錄錨點 cursor。
- 調整過程做局部預覽（從錨點起算當頁）。
- 右下角 `確定` 後才做全章重算，並回到包含錨點的頁面。

### 持久化（localStorage / sessionStorage）

- `reader profile`：儲存閱讀參數（含 `fontFamily`）與 `去除空段落`。
- `last page`：依章節 URL 記錄最後閱讀頁碼。
- `web font config`：記錄最近一次 Web Font URL + family。
- `fullscreen restore flag`（session）：跨章導頁後第一次點擊嘗試恢復全螢幕。

### RWD

- `chromeSettings` 依寬度套用 `mobile / tablet / desktop` preset。
- `readerSettings` 為單一組可調參數，不分 breakpoint。

## 已知限制（現況）

- Web Font 依網路與來源可用性，首次載入可能有延遲或失敗 fallback。
- 本機字體偵測為前端推估（canvas 寬度比對），不是 OS 層級精準查詢。
- 圖片未提供縮放手勢或獨立圖片檢視器。
