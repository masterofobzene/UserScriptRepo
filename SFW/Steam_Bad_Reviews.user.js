// ==UserScript==
// @name         Steam_Bad_Reviews
// @namespace    Steam_Bad_Reviews
// @version      1.2
// @description  Auto-select "Negative" + "Recent" on Steam app pages
// @author       masterofobzene
// @match        https://store.steampowered.com/app/*
// @grant        none
// @run-at       document-end
// @icon         https://store.steampowered.com/favicon.ico
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_Bad_Reviews.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_Bad_Reviews.user.js
// ==/UserScript==

(function() {
    'use strict';
    const interval = setInterval(() => {
        const negative = document.getElementById('review_type_negative');
        const recent = document.getElementById('review_context_recent');
        if (negative && recent) {
            negative.checked = true;
            negative.dispatchEvent(new Event('change'));
            recent.checked = true;
            recent.dispatchEvent(new Event('change'));
            clearInterval(interval);
        }
    }, 500);
})();
