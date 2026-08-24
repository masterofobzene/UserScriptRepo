// ==UserScript==
// @name         Steam_Bad_Reviews
// @namespace    Steam_Bad_Reviews
// @version      1.3
// @description  Auto-select "Negative" + "Recent" on Steam app pages
// @author       masterofobzene
// @match        https://store.steampowered.com/app/*
// @grant        none
// @run-at       document-idle
// @icon         https://store.steampowered.com/favicon.ico
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_Bad_Reviews.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_Bad_Reviews.user.js
// ==/UserScript==

(function() {
    'use strict';

    let applied = false;

    function clickRadio(selector) {
        const input = document.querySelector(selector);
        if (!input) return false;
        if (input.checked) return true;

        // Click the input itself
        input.click();

        // Also click the parent label (React sometimes binds handlers there)
        const label = input.closest('label');
        if (label) label.click();

        // Fire synthetic events to ensure Steam's handlers catch it
        ['mousedown', 'mouseup', 'click', 'change'].forEach(type => {
            input.dispatchEvent(new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        });

        // Force-check if nothing else worked
        if (!input.checked) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        return input.checked;
    }

    function applyFilters() {
        if (applied) return;

        const neg = clickRadio('input[name="review_type"][value="negative"]');
        const rec = clickRadio('input[name="review_context"][value="recent"]');

        if (neg && rec) {
            applied = true;
            console.log('[Steam Bad Reviews] Negative + Recent filters applied');
        }
    }

    // Watch for Steam's AJAX-injected review section
    const observer = new MutationObserver(() => applyFilters());
    observer.observe(document.body, { childList: true, subtree: true });

    // Try in case it's already present
    applyFilters();

    // Stop watching after 20 seconds
    setTimeout(() => observer.disconnect(), 20000);
})();
