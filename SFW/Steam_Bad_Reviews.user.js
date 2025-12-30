// ==UserScript==
// @name         Steam_Bad_Reviews
// @namespace    Steam_Bad_Reviews
// @version      1.0
// @description  Auto-select "Negative" review type on Steam app pages
// @author       masterofobzene
// @match        https://store.steampowered.com/app/*
// @grant        none
// @run-at       document-end
// @icon         https://store.steampowered.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_Bad_Reviews.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_Bad_Reviews.user.js
// ==/UserScript==

(function() {
    'use strict';
    const interval = setInterval(() => {
        const negativeRadio = document.getElementById('review_type_negative');
        if (negativeRadio) {
            negativeRadio.checked = true;
            negativeRadio.dispatchEvent(new Event('change'));
            clearInterval(interval);
        }
    }, 500);
})();
