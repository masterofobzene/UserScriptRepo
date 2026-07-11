// ==UserScript==
// @name         GOG Store Game Hider
// @namespace    GOG_Store_Game_Hider
// @version      1.0
// @description  Hide games on GOG store
// @match        https://www.gog.com/*/games
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @license      GNU GPLv3
// @author       masterofobzene
// @icon         https://www.gog.com/favicon.ico
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/GOG_Store_Game_Hider.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/GOG_Store_Game_Hider.user.js
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'gogHiddenGames';
    const SELECTOR = 'product-tile.ng-star-inserted, product-tile-extended.ng-star-inserted';
    let hiddenGames = new Set();

    function load() {
        try { hiddenGames = new Set(JSON.parse(GM_getValue(STORAGE_KEY, '[]'))); } catch(e) {}
    }
    function save() {
        GM_setValue(STORAGE_KEY, JSON.stringify([...hiddenGames]));
    }

    function getGameIdentifier(card) {
        const link = card.querySelector('a[href*="/game/"]');
        if (link) {
            const match = link.getAttribute('href').match(/\/game\/([^/?]+)/);
            if (match) return match[1];
        }
        const img = card.querySelector('img[alt$=" - cover art image"]');
        return img ? img.alt.replace(/ - cover art image$/, '').trim() : null;
    }

    // Hide all currently visible cards with the given game identifier
    function hideAllCardsWithId(id) {
        document.querySelectorAll(SELECTOR).forEach(card => {
            if (getGameIdentifier(card) === id) card.style.display = 'none';
        });
    }

    function addHideButton(card) {
        if (card.querySelector('.gog-hide-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'gog-hide-btn';
        btn.textContent = '✕';
        btn.title = 'Hide this game';
        Object.assign(btn.style, {
            position:'absolute', top:'5px', right:'5px', zIndex:'99',
            background:'rgba(0,0,0,0.65)', color:'#fff', border:'none',
            borderRadius:'50%', width:'26px', height:'26px', fontSize:'16px',
            lineHeight:'26px', textAlign:'center', cursor:'pointer',
            opacity:'0.7', transition:'opacity 0.2s',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(2px)'
        });
        btn.onmouseenter = () => btn.style.opacity = '1';
        btn.onmouseleave = () => btn.style.opacity = '0.7';
        btn.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            const id = getGameIdentifier(card);
            if (id) {
                hiddenGames.add(id);
                save();
                hideAllCardsWithId(id);
            }
        });
        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
        card.appendChild(btn);
    }

    function processCard(card) {
        if (!card || card.dataset.gogHider) return;
        const id = getGameIdentifier(card);
        if (id && hiddenGames.has(id)) card.style.display = 'none';
        addHideButton(card);
        card.dataset.gogHider = '1';
    }

    function scan() {
        document.querySelectorAll(SELECTOR).forEach(processCard);
    }

    new MutationObserver(muts => {
        for (const m of muts) {
            for (const n of m.addedNodes) {
                if (n.nodeType !== 1) continue;
                if (n.matches && n.matches(SELECTOR)) processCard(n);
                if (n.querySelectorAll) n.querySelectorAll(SELECTOR).forEach(processCard);
            }
        }
    }).observe(document.body, { childList: true, subtree: true });

    load();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
    else scan();
})();
