// ==UserScript==
// @name         Steam Search Block Games
// @namespace    Steam_Search_Block_Games
// @version      1.0
// @author       masterofobzene
// @description  Block button to hide individual games.
// @match        https://store.steampowered.com/search/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @license      GNU GPLv3
// @icon         https://store.steampowered.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_Block_Games.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_Block_Games.user.js
// ==/UserScript==

(function() {
    'use strict';

    let hidden = GM_getValue('hiddenGames', {});

    const save = () => GM_setValue('hiddenGames', hidden);

    function hideBlocked() {
        document.querySelectorAll('[data-ds-appid]').forEach(row => {
            if (hidden[row.dataset.dsAppid]) row.style.display = 'none';
        });
    }

    function addButtons() {
        document.querySelectorAll('[data-ds-appid]:not(.block-btn-added)').forEach(row => {
            row.classList.add('block-btn-added');
            const id = row.dataset.dsAppid;
            if (!id || hidden[id]) return;

            const thumbs = row.querySelector('.search_review_summary');
            if (!thumbs) return;

            const btn = document.createElement('button');
            btn.textContent = 'Block';
            btn.title = 'Block this game';
            btn.style.cssText = `
                cursor: pointer;
                font-size: 11px;
                margin-left: 30px;
                margin-top: -40px;
                padding: 2px 6px;
                background: #a00;
                color: #fff;
                border: none;
                border-radius: 2px;
                vertical-align: middle;
            `;
            btn.onclick = e => {
                e.preventDefault();
                e.stopPropagation();
                const name = row.querySelector('.title').textContent.trim();
                hidden[id] = name;
                save();
                row.style.display = 'none';
            };

            thumbs.insertAdjacentElement('afterend', btn);
        });
    }

    const observer = new MutationObserver(() => {
        hideBlocked();
        addButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function tryAdd() {
        hideBlocked();
        addButtons();
    }

    tryAdd();
    setTimeout(tryAdd, 900);
    setTimeout(tryAdd, 2200);
    setTimeout(tryAdd, 4000);

    GM_registerMenuCommand('Unblock All', () => {
        if (confirm('Unblock all?')) {
            hidden = {};
            save();
            location.reload();
        }
    });
})();
