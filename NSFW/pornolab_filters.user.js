// ==UserScript==
// @name         Pornolab Filters
// @namespace    pornolab-filters
// @version      1.1
// @author       masterofobzene
// @description  Persistent client-side blacklist to filter topics (titles) and forums (categories) separately in pornolab
// @match        *://pornolab.net/forum/tracker.php*
// @icon         https://pornolab.net/favicon.ico
// @grant        none
// @run-at       document-end
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/pornolab_filters.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/pornolab_filters.user.js
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY_TITLES = 'pornolab_blacklist_titles';
    const STORAGE_KEY_FORUMS = 'pornolab_blacklist_forums';

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

    function getWords(key) {
        return (localStorage.getItem(key) || '')
            .toLowerCase()
            .split(/[\s,]+/)
            .filter(Boolean);
    }

    function saveWords(key, val) {
        localStorage.setItem(key, val.trim());
    }

    function createUI(table) {
        if (document.getElementById('pl-blacklist-box')) return;

        const box = document.createElement('div');
        box.id = 'pl-blacklist-box';
        box.style.cssText = `
            margin: 15px 0;
            padding: 10px;
            border: 1px solid #666;
            background: #1b1b1b;
        `;

        box.innerHTML = `<div style="font-weight:bold; margin-bottom:10px;">Client-side blacklist (persistent):</div>`;

        // Title input
        const titleLabel = document.createElement('div');
        titleLabel.textContent = 'Hide titles containing:';
        titleLabel.style.marginTop = '8px';
        box.appendChild(titleLabel);

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.style.cssText = `width: 100%; max-width: 700px; padding: 8px; font-size: 14px;`;
        titleInput.placeholder = 'word1 word2 word3';
        titleInput.value = localStorage.getItem(STORAGE_KEY_TITLES) || '';

        titleInput.addEventListener('input', () => {
            saveWords(STORAGE_KEY_TITLES, titleInput.value);
            applyFilter(table);
        });
        box.appendChild(titleInput);

        // Forum input
        const forumLabel = document.createElement('div');
        forumLabel.textContent = 'Hide forums containing:';
        forumLabel.style.marginTop = '12px';
        box.appendChild(forumLabel);

        const forumInput = document.createElement('input');
        forumInput.type = 'text';
        forumInput.style.cssText = `width: 100%; max-width: 700px; padding: 8px; font-size: 14px;`;
        forumInput.placeholder = 'word1 word2 word3';
        forumInput.value = localStorage.getItem(STORAGE_KEY_FORUMS) || '';

        forumInput.addEventListener('input', () => {
            saveWords(STORAGE_KEY_FORUMS, forumInput.value);
            applyFilter(table);
        });
        box.appendChild(forumInput);

        table.parentNode.insertBefore(box, table);
    }

    function applyFilter(table) {
        const titleWords = getWords(STORAGE_KEY_TITLES);
        const forumWords = getWords(STORAGE_KEY_FORUMS);

        table.querySelectorAll('tbody > tr').forEach(row => {
            if (!row.cells || row.cells.length < 4) {
                row.style.display = '';
                return;
            }

            const forumCell = row.cells[2];
            const topicCell = row.cells[3];

            const forumText = (forumCell.textContent || '').toLowerCase();
            const topicText = (topicCell.textContent || '').toLowerCase();

            const hideByForum = forumWords.some(w => forumText.includes(w));
            const hideByTitle = titleWords.some(w => topicText.includes(w));

            row.style.display = (hideByForum || hideByTitle) ? 'none' : '';
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
