export function buildReaderStyles(): string {
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
