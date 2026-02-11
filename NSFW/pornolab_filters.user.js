// ==UserScript==
// @name         Pornolab Filters
// @namespace    pornolab-filters
// @version      1.2
// @author       masterofobzene
// @description  Persistent client-side blacklist to filter topics (titles) and forums (categories) separately in pornolab also unhides pagination buttons
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

        // Title filter
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

        // Forum filter
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

    // ==================== FULL PAGINATION ====================
    function buildFullPagination() {
        // Ищем оба блока пагинации (верхний и нижний)
        const paginationContainers = document.querySelectorAll('.bottom_info .nav, p.small');

        paginationContainers.forEach(container => {
            const text = container.textContent || '';
            const totalMatch = text.match(/из\s*<b>(\d+)<\/b>/) || text.match(/из\s*(\d+)/);
            if (!totalMatch) return;

            const totalPages = parseInt(totalMatch[1]);
            if (!totalPages || totalPages <= 1) return;

            // Текущая страница
            const currentBold = container.querySelector('b');
            const currentPage = currentBold ? parseInt(currentBold.textContent) : 1;

            // Базовый URL (убираем старый start)
            let base = location.href.split('&start=')[0].split('?start=')[0];
            if (!base.includes('?')) base += '?';
            else base += '&';

            let html = `<a class="menu-root" href="#pg-jump">Страницы</a> :&nbsp;&nbsp; `;

            // Кнопка "Пред."
            if (currentPage > 1) {
                const prev = (currentPage - 2) * 50;
                html += `<a class="pg" href="${base}start=${prev}">Пред.</a>&nbsp;&nbsp;`;
            }

            // Все страницы подряд
            for (let i = 1; i <= totalPages; i++) {
                if (i === currentPage) {
                    html += `<b>${i}</b>`;
                } else {
                    const start = (i - 1) * 50;
                    html += `<a class="pg" href="${base}start=${start}">${i}</a>`;
                }
                if (i < totalPages) html += ', ';
            }

            // Кнопка "След."
            if (currentPage < totalPages) {
                const next = currentPage * 50;
                html += `&nbsp;&nbsp;<a class="pg" href="${base}start=${next}">След.</a>`;
            }

            // Заменяем содержимое
            const targetP = container.querySelector('p[style*="float: right"]') || container.querySelector('p') || container;
            if (targetP) targetP.innerHTML = html;
        });
    }

    function attachObservers(table) {
        new MutationObserver(() => {
            applyFilter(table);
            buildFullPagination();
        }).observe(table, { childList: true, subtree: true });
    }

    waitForTable(table => {
        createUI(table);
        applyFilter(table);
        buildFullPagination();           // сразу при загрузке
        attachObservers(table);
    });

    // На случай, если пагинация подгружается позже
    setTimeout(buildFullPagination, 800);

})();
