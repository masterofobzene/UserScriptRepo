// ==UserScript==
// @name         Realbooru Page Pointer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Save/Load current page on realbooru.com
// @author       masterofobzene
// @match        https://realbooru.com/*
// @icon         https://realbooru.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/realbooru_pointer.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/realbooru_pointer.user.js
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'realbooru_last_url';

    function createButton() {
        const btn = document.createElement('button');
        btn.style.position = 'fixed';
        btn.style.top = '10px';
        btn.style.right = '10px';
        btn.style.zIndex = '9999';
        btn.style.padding = '8px 12px';
        btn.style.background = '#1e88e5';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '14px';
        btn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';

        updateButton(btn);
        document.body.appendChild(btn);

        btn.addEventListener('click', () => {
            const saved = GM_getValue(STORAGE_KEY, null);
            if (saved) {
                if (confirm('Load last saved page?\n' + saved)) {
                    location.href = saved;
                }
            } else {
                GM_setValue(STORAGE_KEY, location.href);
                updateButton(btn);
                alert('Page saved!');
            }
        });
    }

    function updateButton(btn) {
        const saved = GM_getValue(STORAGE_KEY, null);
        btn.textContent = saved ? 'Load last page' : 'Save current page';
        btn.style.background = saved ? '#43a047' : '#1e88e5';
    }

    // Update button text/color if URL changes (e.g., SPA navigation)
    let currentUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== currentUrl) {
            currentUrl = location.href;
            const btn = document.querySelector('button[data-realbooru-pointer]');
            if (btn) updateButton(btn);
        }
    }).observe(document, { subtree: true, childList: true });

    createButton();
})();
