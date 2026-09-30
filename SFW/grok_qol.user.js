// ==UserScript==
// @name         Grok QoL
// @namespace    Grok_QOL
// @version      1.0
// @description  Move code copy button to end of block; use standard scrollbars on grok.com
// @author       masterofobzene
// @match        https://grok.com/*
// @grant        GM_addStyle
// @icon         https://grok.com/favicon.ico
// @run-at       document-idle
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/grok_qol.user.js.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/grok_qol.user.js.user.js
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    /* Standard scrollbars everywhere */
    *, *::before, *::after {
      scrollbar-width: auto !important;
      scrollbar-color: auto !important;
    }
    *::-webkit-scrollbar {
      width: 12px !important;
      height: 12px !important;
    }
    *::-webkit-scrollbar-track {
      background: transparent !important;
    }
    *::-webkit-scrollbar-thumb {
      background-color: rgba(128,128,128,0.5) !important;
      border-radius: 6px !important;
      border: 2px solid transparent !important;
      background-clip: content-box !important;
    }
    *::-webkit-scrollbar-thumb:hover {
      background-color: rgba(128,128,128,0.8) !important;
    }

    /* Bottom bar for moved copy button */
    .gm-copy-bottom {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 4px 8px;
      border-top: 1px solid var(--border-color, rgba(0,0,0,0.1));
      background: inherit;
      border-radius: 0 0 12px 12px;
    }
    .gm-copy-bottom button {
      margin: 0 !important;
    }
  `);

  function moveCopyButtons() {
    document.querySelectorAll('.chat-code-block').forEach(block => {
      if (block.dataset.gmCopyMoved) return;

      const headerActions = block.querySelector('.group\\/code-header .ml-auto, [class*="code-header"] .ml-auto');
      if (!headerActions) return;

      const copyBtn = Array.from(headerActions.querySelectorAll('button')).find(b => {
        const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
        return label.includes('copy');
      });
      if (!copyBtn) return;

      // Create bottom bar and move the button
      const bottom = document.createElement('div');
      bottom.className = 'gm-copy-bottom';
      bottom.appendChild(copyBtn);
      block.appendChild(bottom);

      block.dataset.gmCopyMoved = '1';
    });
  }

  moveCopyButtons();

  // Handle dynamically loaded responses
  const observer = new MutationObserver(() => moveCopyButtons());
  observer.observe(document.body, { childList: true, subtree: true });
})();
