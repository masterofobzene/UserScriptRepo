// ==UserScript==
// @name         Heavy-R Tag Hider
// @namespace   Heavy-R-Tag-Hider
// @version      1.0
// @description  Hide videos/pics with listed tags
// @author       masterofobzene
// @match        https://www.heavy-r.com/*
// @grant        none
// @run-at       document-end
// @icon         https://www.heavy-r.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Heavy-R_Tag_Hider.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Heavy-R_Tag_Hider.user.js
// ==/UserScript==

(function() {
    'use strict';
    const badTags = new Set(['shit','scat','poop','shitting','murder','kill','death','cartoon','anime','tranny'
        // add more lowercase tags here
    ]);
    function hide() {
        document.querySelectorAll('a[href*="/free_porn/"]').forEach(a=>{
            if(badTags.has(a.innerText.trim().toLowerCase())){
                const c = a.closest('.video-item') || a.closest('.col-xxs-12');
                if(c) c.style.setProperty('display','none','important');
            }
        });
    }
    new MutationObserver(hide).observe(document.body,{childList:true,subtree:true});
    hide();
    window.addEventListener('load', hide);
})();
