// ==UserScript==
// @name         Steam Search Block Games
// @namespace    Steam_Search_Block_Games
// @version      1.1
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

        const btn = document.createElement('button');

        btn.textContent = 'Block';
        btn.title = 'Block this game';

        btn.style.cssText = `
            cursor:pointer;
            font-size:11px;
            padding:2px 6px;
            background:#a00;
            color:#fff;
            border:none;
            border-radius:2px;
            position:absolute;
            right:100px;
            top:20px;
            z-index:5;
        `;

        btn.onclick = e => {

            e.preventDefault();
            e.stopPropagation();

            const name = row.querySelector('.title')?.textContent.trim() || 'Unknown';

            hidden[id] = name;
            save();

            row.style.display = 'none';
        };

        row.style.position = 'relative';
        row.appendChild(btn);

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
setTimeout(tryAdd, 1000);
setTimeout(tryAdd, 2500);
setTimeout(tryAdd, 4000);

GM_registerMenuCommand('Unblock All', () => {
    if (confirm('Unblock all?')) {
        hidden = {};
        save();
        location.reload();
    }
});

})();
