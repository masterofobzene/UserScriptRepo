// ==UserScript==
// @name         YT Music Controls
// @description  Forces controls to be always visible.
// @namespace    masterofobzene
// @author       masterofobzene
// @match        https://music.youtube.com/*
// @grant        none
// @license      GNU GPLv3
// @run-at       document-end
// @version      1.0
// @icon         https://music.youtube.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/YT_Music_Controls.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/YT_Music_Controls.user.js
// ==/UserScript==

(function() {
    'use strict';

    const css = `
        /* Force volume slider visible + interactive + sized */
        #volume-slider,
        tp-yt-paper-slider#volume-slider {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            width: 140px !important;
            min-width: 140px !important;
            max-width: 140px !important;
        }

        /* Shuffle & Repeat always visible */
        [title*="Shuffle"],
        [title*="Repeat"],
        paper-icon-button[title*="Shuffle"],
        paper-icon-button[title*="Repeat"] {
            display: inline-flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            min-width: 44px !important;
        }

        /* Collapse placeholder / gap area aggressively */
        .middle-controls-right,
        .player-controls-middle-right,
        #right-controls > *:not(#volume-slider):not([title*="Shuffle"]):not([title*="Repeat"]):not(.volume-container) {
            flex: 0 0 auto !important;
            width: auto !important;
            min-width: 0 !important;
        }

        #right-controls,
        .right-controls {
            gap: 0 !important;
            padding-left: 4px !important;
            margin-left: 0 !important;
            flex-shrink: 0 !important;
        }

        /* Hide any explicit placeholder if exists */
        [class*="volume-placeholder"],
        [class*="expand-button"],
        .volume-container[hidden],
        .volume-container:not(:has(#volume-slider)) {
            display: none !important;
            width: 0 !important;
            min-width: 0 !important;
            flex: none !important;
        }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    setInterval(() => {
        document.querySelectorAll('#volume-slider, [title*="Shuffle"], [title*="Repeat"]').forEach(el => {
            el.removeAttribute('hidden');
            el.removeAttribute('disabled');
            el.style.cssText += ';display:flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;';
        });

        // Force remove gap every cycle
        const volContainer = document.querySelector('.middle-controls-right, .player-controls-middle-right');
        if (volContainer) {
            volContainer.style.flexGrow = '0';
            volContainer.style.minWidth = '0';
            volContainer.style.width = 'auto';
        }
    }, 800);

})();
