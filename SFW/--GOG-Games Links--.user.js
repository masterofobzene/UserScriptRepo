// ==UserScript==
// @name         ::GOG-Games Links::
// @namespace    masterofobzene-GOG-Games
// @version      3.1
// @description  Adds a YouTube button per game card to search for no-commentary gameplay videos. It was made with deepseek AI.
// @author       masterofobzene
// @license      MIT
// @match        *://gog-games.to/*
// @grant        none
// @icon         https://files.mastodon.social/accounts/avatars/114/061/563/113/485/047/original/f9c6c7664af152f1.png
// @downloadURL https://update.greasyfork.org/scripts/528067/%3A%3AGOG-Games%20Links%3A%3A.user.js
// @updateURL https://update.greasyfork.org/scripts/528067/%3A%3AGOG-Games%20Links%3A%3A.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const YT_BUTTON_CLASS = 'yt-search-unique';
    const PROCESSED_ATTR = 'data-yt-processed-v2';
    const PURPLE_COLOR = '#6a1b9a';
    const HOVER_COLOR = '#4a148c';
    let processing = false;

    function createYouTubeButton(gameName) {
        const button = document.createElement('button');
        button.className = YT_BUTTON_CLASS;
        button.textContent = 'YouTube Search';
        button.style.cssText = `
            padding: 6px 12px !important;
            background: ${PURPLE_COLOR} !important;
            color: white !important;
            border: none !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            margin: 8px 0 !important;
            font-family: Arial !important;
            transition: background 0.2s !important;
            display: inline-block !important;
            position: relative !important;
            z-index: 1000 !important;
        `;

        const handleClick = (event) => {
            event.stopImmediatePropagation();
            event.preventDefault();
            window.open(`https://youtube.com/results?search_query=${encodeURIComponent(gameName + ' no commentary')}`, '_blank');
        };

        button.addEventListener('mouseover', () => button.style.background = HOVER_COLOR);
        button.addEventListener('mouseout', () => button.style.background = PURPLE_COLOR);
        button.addEventListener('click', handleClick, true); // Use capturing phase
        button.addEventListener('auxclick', handleClick, true);

        return button;
    }

    function processCard(card) {
        if (processing || card.hasAttribute(PROCESSED_ATTR)) return;

        processing = true;
        try {
            const existingButton = card.querySelector(`.${YT_BUTTON_CLASS}`);
            if (existingButton) {
                existingButton.remove();
            }

            const gameName = [
                () => card.querySelector('img[alt]')?.alt?.trim(),
                () => card.querySelector('[class*="title"]')?.textContent?.trim(),
                () => card.querySelector('h3, h4')?.textContent?.trim()
            ].reduce((acc, fn) => acc || fn(), '');

            if (!gameName) return;

            const container = card.querySelector('.actions, .card-footer') || card.querySelector('a')?.parentElement || card;
            if (container && !container.querySelector(`.${YT_BUTTON_CLASS}`)) {
                container.prepend(createYouTubeButton(gameName));
                card.setAttribute(PROCESSED_ATTR, 'true');
            }
        } finally {
            processing = false;
        }
    }

    function processAllCards() {
        const cards = document.querySelectorAll('[class*="card"]:not([${PROCESSED_ATTR}])');
        cards.forEach(card => {
            if (!card.hasAttribute(PROCESSED_ATTR)) {
                processCard(card);
            }
        });
    }

    // Initial processing after full load
    window.addEventListener('load', () => {
        setTimeout(processAllCards, 2000);
    }, {once: true});

    // Targeted mutation observation
    const mainContent = document.getElementById('main') || document.querySelector('main') || document.body;
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.matches('[class*="card"]')) {
                        processCard(node);
                    }
                });
            }
        });
    });

    observer.observe(mainContent, {
        childList: true,
        subtree: true
    });
})();