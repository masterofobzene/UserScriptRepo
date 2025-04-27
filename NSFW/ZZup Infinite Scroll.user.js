// ==UserScript==
// @name         ZZup Infinite Scroll
// @namespace    http://zzup.com/
// @version      1.1
// @description  Repaginates zzup so you get "infinite scroll"
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @icon         https://zzup.com/favicon.ico
// @match        https://zzup.com/pages/page-*.html
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @connect      zzup.com
// @run-at       document-end
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/
// ==/UserScript==

(function() {
    'use strict';

    // Create control button
    const btn = document.createElement('button');
    btn.textContent = 'Load Subsequent Pages';
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 9999;
        background: #2196F3;
        color: white;
        padding: 12px 18px;
        font-size: 14px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: all 0.2s ease;
    `;

    document.body.appendChild(btn);

    let currentPage = parseInt(window.location.pathname.match(/page-(\d+)\.html/)[1]);
    let isRunning = false;
    const maxPages = 100;

    btn.addEventListener('click', async function() {
        if (isRunning) {
            stopLoading();
            return;
        }

        isRunning = true;
        btn.style.background = '#4CAF50';

        while (isRunning && currentPage < maxPages) {
            btn.textContent = `Loading Page ${currentPage + 1}...`;

            try {
                const nextPage = currentPage + 1;
                const content = await fetchPage(nextPage);
                appendContent(content);
                currentPage = nextPage;

                // Add spacing between pages
                const spacer = document.createElement('div');
                spacer.style.height = '50px';
                document.body.appendChild(spacer);
            } catch (error) {
                console.error(error);
                stopLoading();
                btn.style.background = '#f44336';
                btn.textContent = `Failed at Page ${currentPage + 1}`;
                setTimeout(() => {
                    btn.style.background = '#2196F3';
                    btn.textContent = 'Load Subsequent Pages';
                }, 2000);
                break;
            }
        }

        stopLoading();
    });

    function fetchPage(pageNumber) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: 'GET',
                url: `https://zzup.com/pages/page-${pageNumber}.html`,
                timeout: 10000,
                onload: function(response) {
                    response.status === 200 ? resolve(response.responseText) : reject(`HTTP ${response.status}`);
                },
                onerror: reject,
                ontimeout: () => reject('Timeout')
            });
        });
    }

    function appendContent(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const bodyContent = doc.body.innerHTML;

        const pageContainer = document.createElement('div');
        pageContainer.innerHTML = bodyContent;
        document.body.appendChild(pageContainer);
    }

    function stopLoading() {
        isRunning = false;
        btn.style.background = '#2196F3';
        btn.textContent = currentPage >= maxPages
            ? 'Maximum Pages Reached'
            : 'Load Subsequent Pages';
    }
})();