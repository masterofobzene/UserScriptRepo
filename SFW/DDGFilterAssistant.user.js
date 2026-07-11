// ==UserScript==
// @name         DuckDuckGo Filter Assistant
// @namespace    DDGFilterAssistant
// @version      1.0
// @match        *://duckduckgo.com/*
// @match        *://*.duckduckgo.com/*
// @icon         https://duckduckgo.com/favicon.ico
// @grant        none
// @description  Add/remove recurring filters to DuckDuckGo searches
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/DDGFilterAssistant.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/DDGFilterAssistant.user.js
// ==/UserScript==

(function () {
    'use strict';

    const FILTERS = {
        'No "Best Lists"': '-"2..100 best" -"best free" -"top 2..100"',
        'No AI': '-AI',
        'No Online Apps': '-online -cloud',
        'No News/Sports': '-news -sports',
        'Only PDFs': 'filetype:pdf',
        'GitHub Only': 'site:github.com',
        'Reddit Only': 'site:reddit.com',
        'No Linux': '-linux -ubuntu',
        'No Apple': '-apple -ios -mac',
        'No Android': '-android -droid -apk'
    };

    let baseQuery = '';
    let settingInput = false;

    const inputSelector = 'input[name="q"], input[type="search"], input[aria-label*="search" i], input[placeholder*="Search" i]';

    function getInput() {
        return document.querySelector(inputSelector);
    }

    function stripFilters(text) {
        let clean = text;
        Object.values(FILTERS).forEach(f => {
            const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            clean = clean.replace(new RegExp(`(?:^|\\s)${esc}(?=\\s|$)`, 'gi'), '');
        });
        return clean.replace(/\s+/g, ' ').trim();
    }

    function getActiveFilterString() {
        return Array.from(document.querySelectorAll('#ddgfa-panel input:checked'))
            .map(cb => cb.dataset.f)
            .filter(Boolean)
            .join(' ');
    }

    function buildFullQuery() {
        const active = getActiveFilterString();
        return (baseQuery + (active ? ' ' + active : '')).trim();
    }

    function updateInput() {
        const input = getInput();
        if (!input || settingInput) return;
        const desired = buildFullQuery();
        if (input.value !== desired) {
            settingInput = true;
            input.value = desired;
            settingInput = false;
        }
    }

    function interceptValueSetter(input) {
        const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        Object.defineProperty(input, 'value', {
            get: originalDescriptor.get,
            set: function(val) {
                if (settingInput) {
                    originalDescriptor.set.call(this, val);
                } else {
                    originalDescriptor.set.call(this, val);
                    updateInput();
                }
            },
            configurable: true
        });
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'ddgfa-panel';
        panel.style = 'position:fixed; bottom:20px; right:20px; background:#fff; padding:15px; border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.2); z-index:99999; font:13px/1.4 Inter,sans-serif; max-width:270px; border:1px solid #ddd;';

        // Container for title and clear button
        const titleRow = document.createElement('div');
        titleRow.style = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
        const title = document.createElement('b');
        title.textContent = 'Quick Filters';
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '🧹';
        clearBtn.style = 'border:none; background:none; font-size:18px; font-weight:bold; cursor:pointer; padding:0 4px; line-height:1; color:#666;';
        clearBtn.title = 'Clear all filters';
        titleRow.appendChild(title);
        titleRow.appendChild(clearBtn);

        panel.appendChild(titleRow);

        const filtersContainer = document.createElement('div');
        filtersContainer.innerHTML = Object.entries(FILTERS).map(([name, filter]) =>
            `<label style="display:block; margin:6px 0;"><input type="checkbox" data-f="${filter.replace(/"/g, '&quot;')}"> ${name}</label>`
        ).join('');
        panel.appendChild(filtersContainer);
        document.body.appendChild(panel);

        // Restore check states
        panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            const key = 'ddgfa_' + cb.dataset.f;
            cb.checked = localStorage.getItem(key) === 'true';
        });

        // Checkbox change
        panel.addEventListener('change', e => {
            if (e.target.type === 'checkbox') {
                localStorage.setItem('ddgfa_' + e.target.dataset.f, e.target.checked);
                updateInput();
            }
        });

        // Clear all button
        clearBtn.addEventListener('click', () => {
            panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
                localStorage.setItem('ddgfa_' + cb.dataset.f, false);
            });
            updateInput();
        });
    }

    function init() {
        const input = getInput();
        if (!input) {
            setTimeout(init, 200);
            return;
        }

        const params = new URLSearchParams(location.search);
        const urlQ = params.get('q');
        baseQuery = urlQ ? stripFilters(decodeURIComponent(urlQ)) : stripFilters(input.value);

        interceptValueSetter(input);
        createPanel();
        updateInput();

        input.addEventListener('input', () => {
            if (!settingInput) {
                baseQuery = stripFilters(input.value);
                updateInput();
            }
        });
    }

    init();
})();
