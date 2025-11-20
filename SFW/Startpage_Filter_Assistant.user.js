// ==UserScript==
// @name         Startpage Filter Assistant v1.6
// @namespace    SearXNGFilterAssistant
// @version      1.6
// @match        *://www.startpage.com/*
// @grant        none
// @description  Add predefined filters to Startpage searches.
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @match        *://*/*
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Startpage_Filter_Assistant.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Startpage_Filter_Assistant.user.js
// ==/UserScript==

(function () {
    'use strict';

    const FILTERS = {
        'No "Best Lists"': '-"2..100 best" -"best free" -"top 2..100"',
        'No Online Apps': '-online -cloud',
        'No Ads': '!ad',
        'Only PDFs': 'filetype:pdf',
        'GitHub Only': 'site:github.com',
        'No Linux': '-linux -ubuntu',
        'No Apple': '-apple -ios -mac',
        'No Help': '-inurl:(help docs forum support community)'
    };

    function getRealInput() {
        return document.querySelector('input[placeholder*="Search"], input[aria-label*="search"], input[type="search"]') ||
               Array.from(document.querySelectorAll('input')).find(i => i.value && !i.name && i.offsetParent !== null);
    }

    function applyFilters() {
        const input = getRealInput();
        if (!input) return;

        let q = input.value.trim();

        // Remove old filters with better regex
        Object.values(FILTERS).forEach(f => {
            const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:^|\\s)${esc}(?=\\s|$)`, 'gi');
            q = q.replace(regex, '');
        });

        q = q.replace(/\s+/g, ' ').trim(); // Clean extra spaces

        // Add active ones
        const active = Array.from(document.querySelectorAll('#spfa-panel input:checked'))
            .map(c => c.dataset.f)
            .filter(Boolean);

        if (active.length > 0) {
            q += ' ' + active.join(' ');
        }

        input.value = q.trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function createPanel() {
        const p = document.createElement('div');
        p.id = 'spfa-panel';
        p.style = 'position:fixed;bottom:20px;right:20px;background:#fff;padding:15px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:99999;font:13px/1.4 Inter,sans-serif;max-width:270px;border:1px solid #ddd;';
        p.innerHTML = `<b>Quick Filters</b><br>` +
            Object.entries(FILTERS).map(([n, f]) =>
                `<label style="display:block;margin:6px 0;"><input type="checkbox" data-f="${f.replace(/"/g, '&quot;')}"> ${n}</label>`
            ).join('');
        document.body.appendChild(p);

        p.addEventListener('change', e => {
            if (e.target.type === 'checkbox') {
                localStorage.setItem('spfa_' + e.target.dataset.f, e.target.checked);
                applyFilters();
            }
        });

        // Restore state
        p.querySelectorAll('input').forEach(c => {
            c.checked = localStorage.getItem('spfa_' + c.dataset.f) === 'true';
        });
    }

    // Wait for React input
    const waitForInput = setInterval(() => {
        if (getRealInput()) {
            clearInterval(waitForInput);
            createPanel();
            applyFilters();
        }
    }, 200);

    // Re-apply on changes
    new MutationObserver(applyFilters).observe(document.body, { childList: true, subtree: true });

    // Initial apply
    setTimeout(applyFilters, 1000);
})();
