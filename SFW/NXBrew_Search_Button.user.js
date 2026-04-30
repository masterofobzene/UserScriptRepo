// ==UserScript==
// @name         NSWPEDIA Search Button
// @namespace    NSWPEDIA_Search_Button
// @version      1.4
// @description  Adds SEARCH ON NSWPEDIA button on each game card on Nintendo game catalog.
// @author       masterofobzene
// @match        https://www.nintendo.com/us/store/games/*
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/NXBrew_Search_Button.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/NXBrew_Search_Button.user.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    function addButtons() {
        document.querySelectorAll('a[aria-label][href*="/products/"]').forEach(link => {
            if (link.dataset.nxbrewAdded) return;
            link.dataset.nxbrewAdded = '1';

            let name = link.getAttribute('aria-label');
            if (!name) return;

            console.log('[NSWPEDIA] Game found:', name);

            name = name
                .replace(/[™®]/g, '')
                .replace(/\s*(Nintendo Switch|Switch 2|\(Switch\)|Edition|Deluxe|DLC|Bundle|\+.*|–.*)$/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            if (!name) return;

            const url = `https://nswpedia.com/?s=${encodeURIComponent(name)}`;

            const btn = document.createElement('a');
            btn.href = url;
            btn.target = "_blank";
            btn.rel = "noopener noreferrer";
            btn.textContent = "SEARCH ON NSWPEDIA";
            btn.style.cssText = `
                display: block !important;
                margin: 12px auto 8px !important;
                padding: 10px 18px !important;
                background: #e60012 !important;
                color: white !important;
                font-size: 15px !important;
                font-weight: bold !important;
                border-radius: 6px !important;
                text-decoration: none !important;
                text-align: center;
                width: fit-content;
                min-width: 180px;
                box-shadow: 0 3px 8px rgba(0,0,0,0.3) !important;
                z-index: 10 !important;
            `;

            link.parentElement.appendChild(btn);
        });
    }

    const obs = new MutationObserver(addButtons);
    obs.observe(document.body, { childList: true, subtree: true });

    [300, 1000, 2500, 4500].forEach(d => setTimeout(addButtons, d));

    window.addEventListener('load', addButtons);
})();
