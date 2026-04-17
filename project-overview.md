# esj-pager 專案概覽

## 專案目標

- 把 ESJ Zone 章節頁改造成全螢幕 Canvas 分頁閱讀器，取代原頁面長捲動。
- 內容來源完全來自頁面 DOM（正文與留言），不依賴站方 API。
- 以 userscript 形式使用（Tampermonkey / Violentmonkey）。

## 技術與建置

| 項目 | 說明 |
|------|------|
| 語言 | TypeScript（strict mode） |
| 打包 | esbuild（IIFE） |
| 產物 | `dist/esj-pager.user.js` |
| 指令 | `npm run build` / `npm run watch` |
| 圖示 | Lucide（具名 import，tree-shaking） |
| 型別檢查 | `tsconfig.json`（target ES2020，moduleResolution bundler） |

## 程式結構

```
src/
├── main.ts              (1028)  進入點 + mountReader 閱讀器主流程
├── readerState.ts       (110)   共用型別、READER_LIMITS 常數、ReaderState 物件工廠
├── utils.ts             (70)    純工具函式（clamp、roundByStep、cursor 比較、空段過濾等）
├── storage.ts           (105)   所有 localStorage / sessionStorage 讀寫（profile、last-page、web font、fullscreen restore）
├── fonts.ts             (89)    本機字體白名單、字體偵測、Web Font 載入/stylesheet 管理、Google Fonts 快捷
├── pagination.ts        (288)   分頁游標計算、逐行排版、留言區專用樣式、字元寬度快取、分隔線快取
├── extract.ts           (115)   正文區塊與留言區塊萃取（含回覆引用處理）
├── types.ts             (7)     Block 型別定義（paragraph / img / commentMeta / commentMain / commentDivider）
├── site.ts              (87)    ESJ Zone DOM selector：正文、留言、標題、上下章、目錄連結、novelId 解析
├── lucideIcons.ts       (130)   專案 icon 封裝
├── reader/
│   ├── dom.ts           (868)   header / footer / drawer / 調整面板 / 跳頁面板 / 字體區塊 DOM 建構與 refs
│   ├── styles.ts        (751)   閱讀器所有 CSS（含 Web Font 快捷按鈕樣式）
│   ├── settings.ts      (121)   閱讀參數預設值、RWD chrome preset（mobile / tablet / desktop）
│   └── renderCanvas.ts  (56)    Canvas 底部 metadata 繪製（章名 + 頁碼）
```

### 模組依賴關係

```
main.ts ──→ readerState.ts ──→ reader/settings.ts
       ──→ storage.ts ──→ readerState.ts (types)
       ──→ fonts.ts ──→ readerState.ts (types)
       ──→ utils.ts ──→ readerState.ts (types)
       ──→ pagination.ts
       ──→ extract.ts
       ──→ site.ts
       ──→ reader/dom.ts, reader/styles.ts, reader/renderCanvas.ts
```

### 狀態管理

`mountReader` 內使用 `ReaderState` 物件（`createReaderState()` 建立）統一管理閱讀器執行期狀態，包含：

- 分頁資訊（`pageStarts`、`pageIndex`、`pendingRestoreCursor`）
- Canvas 尺寸快取（`lastCanvasW`、`lastCanvasH`）
- Chrome/UI 狀態（`chromeVisible`、`activeChromePreset`、`readerSettingsExpanded` 等）
- 手勢追蹤（`swipeStartX`、`swipeStartY`、`suppressNextSideTap`）
- 設定（`currentReaderSettings`、`removeSingleEmptyParagraph`）
- Profile（`savedProfile`、`hasSavedProfile`）
- 調整面板預覽（`adjustAnchorCursor`、`previewFromAdjust`）
- 字體（`fontSource`、`webFontLinkEl`）
- 圖片快取（`imageCache`）

### 事件管理

所有 window/document 層級的事件監聽透過 `AbortController` 統一管理，`pagehide` 時呼叫 `abort()` 清除全部監聽。`resize` 事件以 150ms debounce 節流。

## 功能現況

### 內容來源與分頁

- 正文與留言皆轉成 `Block[]` 後分頁，留言接在文章後方。
- 分頁以 `Cursor`（block index + offset）保存每頁起點，記憶體占用低。
- 正文使用可調字級/行高/段距/邊距/最大寬度。
- 留言區有專用排版：
  - `commentMain`：主內容
  - `commentMeta`：較小灰字（固定間距）
  - `commentDivider`：動態寬度分隔線（黑字，依可用寬度計算，結果快取）

### 效能優化

- `pagination.ts` 使用字元寬度快取（`charWidthCache`），避免重複 `ctx.measureText` 呼叫。
- 分隔線（`buildDividerLine`）結果快取，同 font/maxWidth 不重算。
- `resize` 事件 debounce 150ms，避免連續觸發重排。
- 字體偵測共用單一離屏 canvas（`fonts.ts` 模組作用域分配），不重複建立。
- 字體變更時清除字元寬度快取（`clearCharWidthCache`）。
- **全螢幕與背景切換優化**：
  - 監聽 `fullscreenchange` 和 `visibilitychange` 事件
  - 狀態改變時記錄當前 Cursor，重新計算後恢復到相同內容位置
  - 避免背景切換導致的佈局錯誤

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
- Canvas 底部繪製章名 + `目前頁 / 總頁數`，底部文字有 `Math.max` 防護避免被小 padding 裁切。

### 互動與快捷鍵

- 點擊區：
  - 左/右區點擊翻頁（左右皆為下一頁，方便單手操作）
  - 中間區切換 chrome 顯示
- 手勢：
  - 左滑下一頁、右滑上一頁（含滑鼠左鍵拖曳）
  - 滾輪可滾動超高圖片頁
  - 右鍵（contextmenu）執行上一頁
- 快捷鍵：
  - `ArrowLeft` / `ArrowRight` 翻頁
  - `F` 切換全螢幕
  - `Esc` 關閉抽屜/面板或恢復 chrome
- 已在 capture 階段攔截左右鍵，避免原站快捷鍵干擾。

### 左側抽屜區塊

- `目錄`：最上方入口（icon + 文字），高度與 header 一致。
- `閱讀設定`：顯示目前數值，可開啟調整面板。
- `設定檔`：顯示已儲存參數，可儲存/還原。還原時使用 runtime 型別驗證（`safeNum`、`clampSetting`）確保安全。
- `字體`：
  - 字體來源切換：本機字體 / Web Font
  - 本機字體：僅顯示本機可偵測字體白名單（系統預設、思源宋體、思源黑體、微軟正黑體、新細明體）
  - Web Font：可手動填 CSS URL + family，並有一鍵快捷（Noto Serif TC / Noto Sans TC，可選字重 100~900）

### 調整面板（閱讀參數）

- 以浮動面板調整字級、行高、段距、邊距、最大寬度、去除空段落。
- 開啟面板時記錄錨點 cursor。
- 調整過程做局部預覽（從錨點起算當頁）。
- 右下角 `確定` 後才做全章重算，並回到包含錨點的頁面。

### 持久化（localStorage / sessionStorage）

所有讀寫邏輯集中於 `storage.ts`，key 清單：

| Key | Storage | 說明 |
|-----|---------|------|
| `esj-pager:reader-profile:v1` | local | 閱讀參數（含 fontFamily）與「去除空段落」開關 |
| `esj-pager:last-page:v3` | local | 以 novelId 為鍵的 LRU 陣列（最多 10 部小說），記錄 chapter + **Cursor**（內容位置） |
| `esj-pager:web-font:v1` | local | 最近一次 Web Font CSS URL + family |
| `esj-pager:restore-fullscreen-once:v1` | session | 跨章導頁後第一次點擊嘗試恢復全螢幕 |

**Cursor 記憶機制**：
- 不再記錄頁碼（因為視窗尺寸改變會導致總頁數變化）
- 改為記錄 `Cursor`（`{ bi: number, off: number }`），表示內容的絕對位置
- 重新計算分頁後，使用 `findPageIndexByCursor` 找到包含該 Cursor 的頁面
- 確保無論視窗尺寸如何改變，都能回到相同的內容位置

### 章節導航

- 上一章/下一章連結從 DOM 擷取，支援多組候選文字（`上一篇`、`上一章`、`Previous` 等）作為 fallback。
- 已在首尾頁時會彈出確認對話框再導航。
- novelId 從 URL pattern `/forum/(\d+)/` 解析。

### RWD

- `chromeSettings` 依寬度套用 `mobile / tablet / desktop` preset。
- `readerSettings` 為單一組可調參數，不分 breakpoint。

## 已知限制

- Web Font 依網路與來源可用性，首次載入可能有延遲或失敗 fallback。
- 本機字體偵測為前端推估（canvas 寬度比對），不是 OS 層級精準查詢。
- 圖片未提供縮放手勢或獨立圖片檢視器。
