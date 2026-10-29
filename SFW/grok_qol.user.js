// ==UserScript==
// @name         Grok QoL
// @namespace    Grok_QOL
// @version      1.4
// @description  Move code copy button to end of block; use standard scrollbars on grok.com
// @author       masterofobzene
// @match        https://grok.com/*
// @grant        GM_addStyle
// @icon         https://grok.com/images/favicon.svg
// @run-at       document-idle
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/grok_qol.user.js.user
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/grok_qol.user.js.user
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    *,*::before,*::after{scrollbar-width:auto!important;scrollbar-color:auto!important}
    *::-webkit-scrollbar{width:12px!important;height:12px!important}
    *::-webkit-scrollbar-track{background:transparent!important}
    *::-webkit-scrollbar-thumb{background-color:rgba(128,128,128,.5)!important;border-radius:6px!important;border:2px solid transparent!important;background-clip:content-box!important}
    *::-webkit-scrollbar-thumb:hover{background-color:rgba(128,128,128,.8)!important}

    .chat-code-block .gm-top-header{display:none!important}

    .gm-bottom-bar{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      height:2.5rem;
      padding:0 12px;
      border-top:1px solid var(--border-l1, rgba(128,128,128,.25));
      border-radius:0 0 12px 12px;
      background:inherit;
      font-size:13px;
    }
    .gm-bottom-bar button{
      display:inline-flex;
      align-items:center;
      gap:4px;
      padding:4px 10px;
      border-radius:6px;
      border:none;
      background:transparent;
      cursor:pointer;
      color:inherit;
      opacity:.7;
    }
    .gm-bottom-bar button:hover{opacity:1;background:rgba(128,128,128,.15)}

    .chat-code-block .shiki{border-radius:12px 12px 0 0!important}
    .chat-code-block pre,.chat-code-block code{
      user-select:text!important;
      -webkit-user-select:text!important;
      cursor:text!important;
    }
  `);

  function getFullCode(pre) {
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let t = '';
    let n;
    while ((n = walker.nextNode())) t += n.nodeValue;
    return t;
  }

  function addBottomBar(block) {
    if (block.querySelector('.gm-bottom-bar')) return;

    const border = block.querySelector('.border');
    if (!border) return;

    const header = border.querySelector('.flex.flex-row');
    const pre = border.querySelector('pre');
    if (!header || !pre) return;

    header.classList.add('gm-top-header');

    const bar = document.createElement('div');
    bar.className = 'gm-bottom-bar';

    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const text = getFullCode(pre);
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied';
        setTimeout(() => btn.textContent = 'Copy', 1000);
      });
    });

    bar.appendChild(btn);
    border.appendChild(bar);
  }

  function scan() {
    document.querySelectorAll('.chat-code-block').forEach(addBottomBar);
  }

  let t = null;
  const obs = new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(scan, 250);
  });

  scan();
  obs.observe(document.body, { childList: true, subtree: true });
})();
