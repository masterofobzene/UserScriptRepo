// ==UserScript==
// @name         Realbooru Page bookmark
// @namespace    Realbooru_bookmark
// @version      1.3
// @description  Save/Load current page on realbooru.com
// @author       masterofobzene
// @match        https://realbooru.com/*
// @icon         https://realbooru.com/favicon.ico
// @grant        GM_setValue
// @run-at       document-end
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/realbooru_bookmark.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/realbooru_bookmark.user.js
// ==/UserScript==

(function () {
    'use strict';

    const KEY = 'realbooru_last_url';
    let btn = null;

    function update() {
        const saved = GM_getValue(KEY);
        btn.textContent = saved ? 'Load last page\n(Right click to reset)' : 'Save current page';
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
            fontSize: '9px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            whiteSpace: 'pre-line',
            textAlign: 'center'
        });

        // Left click: save or load
        btn.onclick = (e) => {
            e.preventDefault();
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

        // Right click: delete saved URL
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            const saved = GM_getValue(KEY);
            if (saved && confirm('Delete saved page?\n' + saved)) {
                GM_setValue(KEY, null);
                update();
                alert('Saved page deleted');
            }
        };

        document.body.appendChild(btn);
        update();
    }

    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);

    // Handle SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (btn) update();
        }
    }).observe(document, { subtree: true, childList: true });
})();
