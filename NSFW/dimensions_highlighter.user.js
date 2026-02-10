// ==UserScript==
// @name         ImageFap Photo Dimensions Highlighter
// @namespace    Dimensions_Highlighter
// @version      1.0
// @description  Highlights dimension text on single photo pages:  green (>=1000px), orange (601-999px), red (<=600px)
// @author       masterofobzene
// @match        https://www.imagefap.com/pictures/*
// @grant        none
// @icon         https://www.imagefap.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/dimensions_highlighter.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/dimensions_highlighter.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Target the exact <font><b>W</b> x <b>H</b></font> structure
    document.querySelectorAll('font').forEach(font => {
        const bolds = font.querySelectorAll('b');
        if (bolds.length === 2 && font.textContent.trim().match(/^\d+\s*x\s*\d+$/)) {
            const w = parseInt(bolds[0].textContent);
            const h = parseInt(bolds[1].textContent);
            const maxSide = Math.max(w, h);

            let bg = '#FFA500'; // bright orange
            let color = '#000'; // black text
            if (maxSide >= 1000) {
                bg = '#00CC00'; // darker green
                color = '#000';
            } else if (maxSide <= 600) {
                bg = '#FF0000'; // bright red
                color = '#FFF';
            }

            font.style.backgroundColor = bg;
            font.style.color = color;
            font.style.padding = '6px 12px';
            font.style.borderRadius = '6px';
            font.style.display = 'inline-block';
            font.style.fontWeight = 'bold';
        }
    });
})();
