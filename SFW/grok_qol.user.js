// ==UserScript==
// @name         Grok QoL
// @namespace    Grok_QOL
// @version      1.8
// @description  Move code copy button to end of block; use standard scrollbars on grok.com
// @author       masterofobzene
// @match        https://grok.com/*
// @grant        GM_addStyle
// @icon         https://grok.com/images/favicon.svg
// @run-at       document-idle
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/grok_qol.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/grok_qol.user.js
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    /* Force classic non-rounded system scrollbars */
    html, body, * {
      scrollbar-width: auto !important;
      scrollbar-color: #888 #e0e0e0 !important;
    }

    *::-webkit-scrollbar {
      width: 16px !important;
      height: 16px !important;
      background: #e0e0e0 !important;
    }
    *::-webkit-scrollbar-track {
      background: #e0e0e0 !important;
      border-radius: 0 !important;
    }
    *::-webkit-scrollbar-thumb {
      background: #888 !important;
      border-radius: 0 !important;          /* ← no rounded */
      border: 2px solid #e0e0e0 !important;
      background-clip: padding-box !important;
    }
    *::-webkit-scrollbar-thumb:hover {
      background: #666 !important;
    }
    *::-webkit-scrollbar-corner {
      background: #e0e0e0 !important;
    }

    /* Completely hide Grok's custom / modern / rounded scrollbar elements */
    [data-radix-scroll-area-scrollbar],
    [data-radix-scroll-area-thumb],
    [class*="ScrollBar"],
    [class*="scroll-bar"],
    [class*="scrollbar-thumb"],
    [class*="scrollbar-track"],
    [class*="scroll-feather"],
    .scrollbar-gutter-stable::-webkit-scrollbar-thumb,
    div[style*="border-radius"][style*="overflow"] {
      display: none !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      pointer-events: none !important;
      border-radius: 0 !important;
    }

    /* hide native top copy buttons */
    button:has(use[href*="-copy"]) {
      display: none !important;
    }

    .gm-bottom-bar {
      display: flex !important;
      align-items: center;
      justify-content: flex-end;
      height: 2.5rem;
      padding: 0 12px;
      border-top: 1px solid var(--border-l1, rgba(128,128,128,.25));
      border-radius: 0 0 12px 12px;
      background: inherit;
      font-size: 13px;
      width: 100%;
      box-sizing: border-box;
    }
    .gm-bottom-bar button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 6px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: inherit;
      opacity: .7;
    }
    .gm-bottom-bar button:hover {
      opacity: 1;
      background: rgba(128,128,128,.15);
    }

    pre.shiki { border-radius: 0 !important; }
    pre.shiki, pre.shiki code {
      user-select: text !important;
      -webkit-user-select: text !important;
      cursor: text !important;
    }
  `);

  function getFullCode(pre) {
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let t = '';
    let n;
    while ((n = walker.nextNode())) t += n.nodeValue;
    return t;
  }

  function addBottomBar(pre) {
    let container = pre.parentElement;
    while (container && container !== document.body) {
      if (container.querySelector('button:has(use[href*="-copy"])') ||
          container.querySelector('div.flex.flex-row, div[class*="rounded-t"]')) {
        break;
      }
      container = container.parentElement;
    }
    if (!container || container.querySelector('.gm-bottom-bar')) return;

    const bar = document.createElement('div');
    bar.className = 'gm-bottom-bar';

    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(getFullCode(pre)).then(() => {
        btn.textContent = 'Copied';
        setTimeout(() => btn.textContent = 'Copy', 1000);
      });
    });

    bar.appendChild(btn);
    container.appendChild(bar);
  }

  function scan() {
    document.querySelectorAll('pre.shiki, pre').forEach(pre => {
      const hasCopyNearby = pre.closest('div')?.querySelector('button:has(use[href*="-copy"]), use[href*="-copy"]');
      if (hasCopyNearby || pre.classList.contains('shiki')) {
        addBottomBar(pre);
      }
    });
  }

  let t = null;
  const obs = new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(scan, 150);
  });

  scan();
  obs.observe(document.body, { childList: true, subtree: true });
})();
