// ==UserScript==
// @name         Realbooru Page bookmark
// @namespace    Realboorubookmark
// @version      1.6
// @description  Save/Load current page on realbooru.com
// @author       masterofobzene
// @match        https://realbooru.com/*
// @icon         https://realbooru.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
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
        btn.textContent = saved ? 'Load last page\nRight-click to reset' : 'Save current page';
        btn.style.background = saved ? '#43a047' : '#1e88e5';
    }

    function init() {
        if (btn) return;

        btn = document.createElement('button');
        btn.type = 'button';

        Object.assign(btn.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 999999,
            padding: '12px 16px',
            color: 'white',
            background: '#1e88e5',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            whiteSpace: 'pre-line',
            textAlign: 'center',
            minWidth: '140px',
            lineHeight: '1.4'
        });

        btn.addEventListener('click', e => {
            if (e.button !== 0) return;
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
        });

        btn.addEventListener('contextmenu', e => {
            e.preventDefault();
            const saved = GM_getValue(KEY);
            if (saved && confirm('Delete saved page?\n' + saved)) {
                GM_setValue(KEY, null);
                update();
                alert('Saved page deleted');
            }
        });

        document.body.appendChild(btn);
        update();
    }

    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);

    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            update();
        }
    }).observe(document, { subtree: true, childList: true });
})();
