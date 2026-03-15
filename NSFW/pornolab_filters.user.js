// ==UserScript==
// @name Pornolab Filters
// @namespace pornolab-filters
// @version 1.5
// @author masterofobzene
// @description Persistent client-side blacklist — now with whole-word matching + unhides pagination
// @match *://pornolab.net/forum/tracker.php*
// @icon https://pornolab.net/favicon.ico
// @grant none
// @run-at document-end
// @downloadURL https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/pornolab_filters.user.js
// @updateURL https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/pornolab_filters.user.js
// ==/UserScript==


(function () {
    'use strict';

    const STORAGE_KEY_TITLES = 'pornolab_blacklist_titles';
    const STORAGE_KEY_FORUMS = 'pornolab_blacklist_forums';

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function waitForTable(callback) {
        const table = document.querySelector('#tor-tbl');
        if (table) return callback(table);

        const observer = new MutationObserver(() => {
            const t = document.querySelector('#tor-tbl');
            if (t) {
                observer.disconnect();
                callback(t);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function getWords(key) {
        return (localStorage.getItem(key) || '')
            .toLowerCase()
            .split(/[\s,]+/)
            .filter(Boolean);
    }

    function saveWords(key, value) {
        localStorage.setItem(key, value.trim());
    }

    function createUI(table) {
        if (document.getElementById('pl-blacklist-box')) return;

        const box = document.createElement('div');
        box.id = 'pl-blacklist-box';
        box.style.cssText = `
            margin: 15px 0;
            padding: 12px;
            border: 1px solid #666;
            background: #1b1b1b;
            color: #ddd;
        `;

        box.innerHTML = `<div style="font-weight:bold; margin-bottom:10px;">Client-side blacklist (whole words only):</div>`;

        // Titles
        const titleLabel = document.createElement('div');
        titleLabel.textContent = 'Hide titles containing:';
        titleLabel.style.margin = '8px 0 4px';
        box.appendChild(titleLabel);

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'ts shemale amateur onlyfans';
        titleInput.value = localStorage.getItem(STORAGE_KEY_TITLES) || '';
        titleInput.style.cssText = 'width:100%; max-width:700px; padding:8px; font-size:14px; box-sizing:border-box;';
        titleInput.addEventListener('input', () => {
            saveWords(STORAGE_KEY_TITLES, titleInput.value);
            applyFilter(table);
        });
        box.appendChild(titleInput);

        // Forums
        const forumLabel = document.createElement('div');
        forumLabel.textContent = 'Hide forums containing:';
        forumLabel.style.margin = '16px 0 4px';
        box.appendChild(forumLabel);

        const forumInput = document.createElement('input');
        forumInput.type = 'text';
        forumInput.placeholder = 'amateur shemale onlyfans milf';
        forumInput.value = localStorage.getItem(STORAGE_KEY_FORUMS) || '';
        forumInput.style.cssText = 'width:100%; max-width:700px; padding:8px; font-size:14px; box-sizing:border-box;';
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

        // Delay needed because tablesorter / ajax sorting often runs after DOM is ready
        setTimeout(() => {
            const rows = table.querySelectorAll('tbody > tr');
            rows.forEach(row => {
                if (!row.cells || row.cells.length < 5) {
                    row.style.display = '';
                    return;
                }

                // Forum name cell = index 2, Topic title cell = index 3
                const forumCell = row.cells[2];
                const topicCell = row.cells[3];

                const forumText = (forumCell?.textContent || '').toLowerCase().trim();
                const topicText = (topicCell?.textContent || '').toLowerCase().trim();

                const hideByForum = forumWords.some(word =>
                    new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(forumText)
                );

                const hideByTitle = titleWords.some(word =>
                    new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(topicText)
                );

                row.style.display = (hideByForum || hideByTitle) ? 'none' : '';
            });
        }, 1400); // increased delay to outrun most site scripts
    }

    function buildFullPagination() {
        document.querySelectorAll('.bottom_info .nav').forEach(nav => {
            const text = nav.textContent || '';
            const totalMatch = text.match(/из\s*<b>(\d+)<\/b>/) || text.match(/из\s*(\d+)/);
            if (!totalMatch) return;

            const totalPages = parseInt(totalMatch[1], 10);
            if (totalPages <= 1) return;

            const currentPageElem = nav.querySelector('b');
            const currentPage = currentPageElem ? parseInt(currentPageElem.textContent, 10) : 1;

            let baseUrl = '';
            const link = nav.querySelector('a.pg') || nav.querySelector('a[href*="tracker.php"]');
            if (link) {
                let href = link.getAttribute('href') || '';
                href = href.replace(/[?&]start=\d+(&?)/g, (m, p) => p || '');
                href = href.replace(/[?&]$/, '');
                baseUrl = href + (href.includes('?') ? '&' : '?');
            } else {
                const url = new URL(location.href);
                url.searchParams.delete('start');
                baseUrl = url.toString() + (url.search ? '&' : '?');
            }

            let html = `<a class="menu-root" href="#pg-jump">Страницы</a> :&nbsp;&nbsp;`;

            if (currentPage > 1) {
                html += `<a class="pg" href="${baseUrl}start=${(currentPage - 2) * 50}">Пред.</a>&nbsp;&nbsp;`;
            }

            for (let i = 1; i <= totalPages; i++) {
                if (i === currentPage) {
                    html += `<b>${i}</b>`;
                } else {
                    html += `<a class="pg" href="${baseUrl}start=${(i - 1) * 50}">${i}</a>`;
                }
                if (i < totalPages) html += ', ';
            }

            if (currentPage < totalPages) {
                html += `&nbsp;&nbsp;<a class="pg" href="${baseUrl}start=${currentPage * 50}">След.</a>`;
            }

            const target = nav.querySelector('p[style*="float: right"]') || nav;
            if (target) target.innerHTML = html;
        });
    }

    function attachObservers(table) {
        new MutationObserver(() => {
            applyFilter(table);
            buildFullPagination();
        }).observe(table, { childList: true, subtree: true, characterData: true });
    }

    waitForTable(table => {
        createUI(table);
        attachObservers(table);

        // Multiple delayed runs to survive site re-sorting / ajax
        setTimeout(() => { applyFilter(table); buildFullPagination(); }, 1400);
        setTimeout(() => { applyFilter(table); buildFullPagination(); }, 3000);
        setTimeout(() => { applyFilter(table); buildFullPagination(); }, 5500);
    });

    // Extra safety run
    setTimeout(buildFullPagination, 1200);
})();
