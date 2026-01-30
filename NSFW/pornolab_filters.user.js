// ==UserScript==
// @name         Pornolab Filters
// @namespace    pornolab-filters
// @version      1.0
// @author       masterofobzene
// @description  Persistent client-side blacklist to filter 'topics' (post names) and 'forum' (category) in pornolab
// @match        *://pornolab.net/forum/tracker.php*
// @icon         https://pornolab.net/favicon.ico
// @grant        none
// @run-at       document-end
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/pornolab_filters.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/pornolab_filters.user.js

// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'pornolab_blacklist_words';

    function waitForTable(cb) {
        const t = document.querySelector('#tor-tbl');
        if (t) return cb(t);

        const obs = new MutationObserver(() => {
            const t = document.querySelector('#tor-tbl');
            if (t) {
                obs.disconnect();
                cb(t);
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    function getWords() {
        return (localStorage.getItem(STORAGE_KEY) || '')
            .toLowerCase()
            .split(/[\s,]+/)
            .filter(Boolean);
    }

    function saveWords(val) {
        localStorage.setItem(STORAGE_KEY, val.trim());
    }

    function createUI(table) {
        // Prevent duplicate UI
        if (document.getElementById('pl-blacklist-box')) return;

        const box = document.createElement('div');
        box.id = 'pl-blacklist-box';
        box.style.cssText = `
            margin: 15px 0;
            padding: 10px;
            border: 1px solid #666;
            background: #1b1b1b;
        `;

        box.innerHTML = `
            <div style="font-weight:bold; margin-bottom:6px;">
                Client-side blacklist (persistent):
            </div>
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.style.cssText = `
            width: 100%;
            max-width: 700px;
            padding: 8px;
            font-size: 14px;
        `;
        input.placeholder = 'word1 word2 word3';

        input.value = localStorage.getItem(STORAGE_KEY) || '';

        input.addEventListener('input', () => {
            saveWords(input.value);
            applyFilter(table);
        });

        box.appendChild(input);
        table.parentNode.insertBefore(box, table);
    }

    function applyFilter(table) {
    const words = getWords();

    table.querySelectorAll('tbody > tr').forEach(row => {
        if (!row.cells || row.cells.length < 4) {
            row.style.display = '';
            return;
        }

        // CORRECT columns
        const forumCell = row.cells[2]; 
        const topicCell = row.cells[3];

        const forumText = forumCell.textContent || '';
        const topicText = topicCell.textContent || '';

        const combined = (forumText + ' ' + topicText).toLowerCase();

        row.style.display = words.some(w => combined.includes(w))
            ? 'none'
            : '';
    });
    }

    function attachTableObserver(table) {
        new MutationObserver(() => applyFilter(table))
            .observe(table, { childList: true, subtree: true });
    }

    waitForTable(table => {
        createUI(table);
        applyFilter(table);
        attachTableObserver(table);
    });

})();
