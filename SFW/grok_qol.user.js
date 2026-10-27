// ==UserScript==
// @name         Grok QoL
// @namespace    Grok_QOL
// @version      1.1
// @description  Move code copy button to end of block; use standard scrollbars on grok.com
// @author       masterofobzene
// @match        https://grok.com/*
// @grant        GM_addStyle
// @icon         https://grok.com/images/favicon.svg
// @run-at       document-idle
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/grok_qol.user.js.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/grok_qol.user.js.user.js

(function () {
  'use strict';

  const CHECK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  GM_addStyle(`
    *, *::before, *::after {
      scrollbar-width: auto !important;
      scrollbar-color: auto !important;
    }
    *::-webkit-scrollbar { width: 12px !important; height: 12px !important; }
    *::-webkit-scrollbar-track { background: transparent !important; }
    *::-webkit-scrollbar-thumb {
      background-color: rgba(128,128,128,0.5) !important;
      border-radius: 6px !important;
      border: 2px solid transparent !important;
      background-clip: content-box !important;
    }
    *::-webkit-scrollbar-thumb:hover { background-color: rgba(128,128,128,0.8) !important; }

    /* visual reorder only – no DOM moves */
    .chat-code-block .border.border-border-l1.rounded-xl {
      display: flex !important;
      flex-direction: column-reverse !important;
    }
    .chat-code-block .border.border-border-l1 > .flex.flex-row {
      border-radius: 0 0 0.75rem 0.75rem !important;
      border-top: 1px solid var(--border-l1, rgba(128,128,128,0.2)) !important;
    }
    .chat-code-block .border.border-border-l1 > .shiki {
      border-radius: 0.75rem 0.75rem 0 0 !important;
    }

    /* force clean selection */
    .chat-code-block,
    .chat-code-block * {
      -webkit-user-select: text !important;
      user-select: text !important;
    }
    .chat-code-block pre,
    .chat-code-block code {
      cursor: text !important;
    }
  `);

  function copyCode(btn, pre) {
    const codeEl = pre.querySelector('code') || pre;
    navigator.clipboard.writeText(codeEl.textContent).then(() => {
      const orig = btn.innerHTML;
      btn.innerHTML = CHECK_ICON;
      setTimeout(() => { btn.innerHTML = orig; }, 1000);
    });
  }

  function patchButtons() {
    document.querySelectorAll('.chat-code-block button').forEach(btn => {
      if (btn.dataset.gmPatched) return;
      const label = (btn.getAttribute('aria-label') || '') + (btn.textContent || '');
      if (!/copy/i.test(label)) return;

      const block = btn.closest('.chat-code-block');
      const pre = block?.querySelector('pre');
      if (!pre) return;

      btn.dataset.gmPatched = '1';
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        copyCode(btn, pre);
      }, true);
    });
  }

  // very light observer – only new nodes, never during active selection
  let selecting = false;
  document.addEventListener('mousedown', e => {
    if (e.target.closest('.chat-code-block pre, .chat-code-block code')) {
      selecting = true;
    }
  }, true);
  document.addEventListener('mouseup', () => { selecting = false; }, true);
  document.addEventListener('selectstart', e => {
    if (e.target.closest('.chat-code-block')) selecting = true;
  }, true);

  let pending = false;
  const observer = new MutationObserver(() => {
    if (selecting || pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (!selecting) patchButtons();
    });
  });

  patchButtons();
  observer.observe(document.body, { childList: true, subtree: true });
})();
