// ==UserScript==
// @name         Pornpaw Gallery Filter
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Hide galleries on pornpaw.com based on specific words in gallery name or tags
// @author       masterofobzene
// @match        https://www.pornpaw.com/*
// @match        https://pornpaw.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @icon         https://www.pornpaw.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Pornpaw%20Gallery%20Filter.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Pornpaw%20Gallery%20Filter.user.js
// ==/UserScript==

(function() {
    'use strict';

    function createFilterUI() {
        const filterDiv = document.createElement('div');
        filterDiv.style.cssText = 'position:fixed;top:10px;right:10px;background:#fff;border:1px solid #ccc;padding:10px;z-index:1000;';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter words to filter (comma-separated)';
        input.value = GM_getValue('filterWords', '');
        input.style.marginRight = '5px';
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.onclick = () => {
            GM_setValue('filterWords', input.value);
            location.reload();
        };
        filterDiv.append(input, saveButton);
        document.body.appendChild(filterDiv);
    }

    function filterGalleries() {
        const filterWords = GM_getValue('filterWords', '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
        if (!filterWords.length) return;
        const container = document.querySelector('.col-lg-12.text-center');
        if (!container) return;
        const headers = container.querySelectorAll('div.mb-1');
        headers.forEach(header => {
            const titleLink = header.querySelector('a[href^="/gallery/"]');
            const title = titleLink ? titleLink.textContent.toLowerCase() : '';
            const tagLinks = header.querySelectorAll('a[href*="/category/"]');
            const tags = Array.from(tagLinks).map(link => link.textContent.toLowerCase());
            const shouldHide = filterWords.some(word => title.includes(word) || tags.some(tag => tag.includes(word)));
            if (shouldHide) {
                header.style.display = 'none';
                let current = header.nextElementSibling;
                while (current && !current.matches('div.mb-1') && !(current.tagName === 'DIV' && current.style.clear && current.style.clear.includes('both'))) {
                    current.style.display = 'none';
                    current = current.nextElementSibling;
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createFilterUI();
            filterGalleries();
        });
    } else {
        createFilterUI();
        filterGalleries();
    }
})();