// ==UserScript==
// @name         ImageFap Auto-Pagination
// @namespace    imagefap.autopager
// @version      1.1
// @description  Load ImageFap gallery pages in batches.
// @match        http*://www.imagefap.com/pictures/*
// @grant        none
// @run-at       document-idle
// @icon         https://www.imagefap.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/imagefap_autopager.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/imagefap_autopager.user.js
// ==/UserScript==

(() => {
    'use strict';

    const mainGallery = document.querySelector('#gallery');
    if (!mainGallery) return;

    // Detect current page
    const url = new URL(location.href);
    const currentPage = parseInt(url.searchParams.get('page') || '0', 10);

    let maxPage = 0;
    const pageLinks = [...mainGallery.querySelectorAll('a[href*="page="]')];
    pageLinks.forEach(a => {
        const m = a.href.match(/[\?&]page=(\d+)/);
        if (m) maxPage = Math.max(maxPage, parseInt(m[1], 10));
    });

    console.log('[ImageFap] Initial pages detected:', maxPage + 1);

    const loadedPages = new Set([currentPage]);
    let nextPageToLoad = currentPage + 1;
    const BATCH_SIZE = 10;
    let loading = false;

    const separatorStyle = `
        margin: 40px 0;
        border-top: 4px solid #666;
        text-align: center;
        font: bold 16px verdana;
        color: #444;
    `;

    async function loadPage(page) {
        if (loadedPages.has(page)) return;
        loadedPages.add(page);

        const url = new URL(location.href);
        url.searchParams.set('page', page);

        console.log('[ImageFap] Loading page', page + 1);

        const res = await fetch(url.toString(), { credentials: 'include' });
        const html = await res.text();

        const doc = new DOMParser().parseFromString(html, 'text/html');
        const gallery = doc.querySelector('#gallery');
        if (!gallery) return;

        // Update maxPage from newly loaded page
        const newLinks = gallery.querySelectorAll('a[href*="page="]');
        [...newLinks].forEach(a => {
            const m = a.href.match(/[\?&]page=(\d+)/);
            if (m) {
                const p = parseInt(m[1], 10);
                if (p > maxPage) {
                    maxPage = p;
                    console.log('[ImageFap] Updated maxPage to', maxPage + 1);
                }
            }
        });

        const wrapper = document.createElement('div');
        wrapper.style.marginTop = '30px';

        const sep = document.createElement('div');
        sep.style.cssText = separatorStyle;
        sep.textContent = `Page ${page + 1}`;
        wrapper.appendChild(sep);

        [...gallery.children].forEach(node => {
            wrapper.appendChild(node.cloneNode(true));
        });

        mainGallery.parentNode.appendChild(wrapper);
    }

    async function loadNextBatch(size = BATCH_SIZE) {
        if (loading) return;
        loading = true;

        let loadedThisBatch = 0;

        try {
            while (
                loadedThisBatch < size &&
                nextPageToLoad <= maxPage
            ) {
                await loadPage(nextPageToLoad);
                nextPageToLoad++;
                loadedThisBatch++;
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (err) {
            console.error('[ImageFap] Error during batch load:', err);
        } finally {
            loading = false;
            updateButton();
        }
    }

    function updateButton() {
        if (nextPageToLoad > maxPage) {
            button.textContent = 'All pages loaded 👌';
            button.disabled = true;
            button.style.opacity = '0.7';
        } else {
            button.textContent = 'Continue loading 👇';
            button.disabled = false;
        }
    }

    const button = document.createElement('button');
    button.style.cssText = `
        display: block;
        margin: 50px auto;
        padding: 14px 28px;
        font-size: 18px;
        font-weight: bold;
        background: #1e88e5;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
    `;

    button.addEventListener('click', () => loadNextBatch(BATCH_SIZE));

    document.body.appendChild(button);

    // Initial auto-load
    setTimeout(() => {
        const initialSize = currentPage === 0 ? 9 : BATCH_SIZE;
        loadNextBatch(initialSize);
    }, 1500);

})();
