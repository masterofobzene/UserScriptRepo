// ==UserScript==
// @name         Realbooru Page Pointer
// @namespace    RealbooruPointer
// @version      1.2
// @description  Save/Load current page on realbooru.com
// @author       masterofobzene
// @match        https://realbooru.com/*
// @icon         https://realbooru.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/realbooru_pointer.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/realbooru_pointer.user.js
// ==/UserScript==

(function () {
    'use strict';

    const KEY = 'realbooru_last_url';
    let btn = null;

    function update() {
        const saved = GM_getValue(KEY);
        btn.textContent = saved ? 'Load last page' : 'Save current page';
        btn.style.background = saved ? '#43a047' : '#1e88e5';
    }

    function init() {
        if (btn) return;

        btn = document.createElement('button');
        Object.assign(btn.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '999999',
            padding: '10px 15px',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        });

        btn.onclick = () => {
            const saved = GM_getValue(KEY);
            if (saved) {
                if (confirm('Load last page?\n' + saved)) {
                    GM_setValue(KEY, null);
                    location.href = saved;
                }
            } else {
                GM_setValue(KEY, location.href);
                update();
                alert('Page saved');
            }
        };

        document.body.appendChild(btn);
        update();
    }

    // Ensure button appears even if body loads late
    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);

    // Re-check on SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (btn) update();
        }
    }).observe(document, { subtree: true, childList: true });
})();
